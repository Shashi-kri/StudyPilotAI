import asyncio
import json
import logging
import re
from datetime import date, datetime, timedelta
from typing import Dict, Any, List, Optional, Tuple
from sqlalchemy.orm import Session
import httpx

from app.config import settings
from app.models.task import Task
from app.models.plan import StudyPlan
from app.schemas.assistant import ChatMessageRequest, ChatMessageResponse, AssistantAction
from app.schemas.plan import PlanGenerateRequest, SubjectInput
from app.services.ai_service import generate_deterministic_plan, record_generation_result

logger = logging.getLogger(__name__)

# ---------------------------------------------------------------------------
# Database Context Extraction Helpers
# ---------------------------------------------------------------------------

def _load_subject_difficulties(db: Session) -> Dict[str, str]:
    """Extract subject->difficulty mapping from existing study plans."""
    diff_map: Dict[str, str] = {}
    plans = db.query(StudyPlan).all()
    for p in plans:
        if p.subject_difficulty:
            try:
                parsed = json.loads(p.subject_difficulty)
                if isinstance(parsed, dict):
                    for sub, diff in parsed.items():
                        diff_map[sub.strip().lower()] = str(diff).lower()
            except Exception:
                pass
    return diff_map


def _get_student_context(db: Session, today: date) -> Dict[str, Any]:
    """Retrieve actual pending tasks, overdue tasks, today's schedule, and difficulty metadata."""
    today_str = today.strftime("%Y-%m-%d")
    all_pending = db.query(Task).filter(Task.is_completed == False).order_by(Task.date.asc(), Task.start_time.asc()).all()
    total_tasks = db.query(Task).count()
    completed_tasks = db.query(Task).filter(Task.is_completed == True).count()
    diff_map = _load_subject_difficulties(db)

    overdue: List[Task] = []
    today_tasks: List[Task] = []
    upcoming: List[Task] = []

    for t in all_pending:
        t_date = t.date or ""
        if t_date < today_str:
            overdue.append(t)
        elif t_date == today_str:
            today_tasks.append(t)
        else:
            upcoming.append(t)

    return {
        "today_str": today_str,
        "total_tasks": total_tasks,
        "completed_tasks": completed_tasks,
        "pending_tasks": all_pending,
        "overdue_tasks": overdue,
        "today_tasks": today_tasks,
        "upcoming_tasks": upcoming,
        "diff_map": diff_map
    }


def _task_to_dict(t: Task, difficulty: Optional[str] = None) -> Dict[str, Any]:
    """Convert Task ORM object to frontend card representation."""
    return {
        "id": t.id,
        "title": t.title,
        "subject": t.subject,
        "topic": t.topic,
        "date": t.date,
        "start_time": t.start_time,
        "duration": t.duration,
        "priority": t.priority,
        "difficulty": difficulty
    }


# ---------------------------------------------------------------------------
# Rule-Based Intent Classifier (Deterministic Backbone)
# ---------------------------------------------------------------------------

def classify_user_intent(text: str) -> Tuple[str, Dict[str, Any]]:
    """
    Classifies user message into specific actionable intents.
    Returns (intent_name, extracted_parameters).
    """
    tl = text.lower()
    params: Dict[str, Any] = {}

    # Check for time constraint e.g. "30 minutes", "30 mins", "1 hour", "2 hours", "45 min"
    time_match = re.search(r"(\d+)\s*(?:minutes?|mins?|hours?|hrs?|h|m)\b", tl)
    has_limited_time = any(k in tl for k in ["only have", "have only", "limited time", "short on time", "quick study", "in a rush"])

    # 1. Time-constrained query
    if (time_match and any(k in tl for k in ["study", "do", "task", "have", "time"])) or (has_limited_time and "what" in tl):
        if time_match:
            val = int(time_match.group(1))
            raw = time_match.group(0).lower()
            mins = val * 60 if ("hour" in raw or "hr" in raw or raw.endswith("h")) else val
            params["minutes"] = mins
        else:
            params["minutes"] = None  # User said limited time without specifying duration
        return "time_constrained", params

    # 2. Why study this first / Why this recommendation?
    if any(k in tl for k in ["why should i study this", "why this first", "why study this", "why first", "why this task", "why recommend"]):
        return "why_first", params

    # 3. Easiest task
    if any(k in tl for k in ["easiest", "least difficult", "simple task", "quickest win", "easy task", "easy topic", "which is easy"]):
        return "easiest", params

    # 4. Priority / what to prioritize
    if any(k in tl for k in ["prioritise", "prioritize", "most urgent", "highest priority", "top priority", "focus first", "what to prioritize", "which task first"]):
        return "prioritise", params

    # 5. What should I study today / today's schedule
    if any(k in tl for k in ["study today", "tasks today", "today's task", "today tasks", "schedule today", "what to study today", "what do i have today"]):
        return "today_tasks", params

    # 6. Show pending tasks / todos
    if any(k in tl for k in ["pending", "what tasks", "my tasks", "todo", "to do", "overdue", "not done", "show tasks", "list tasks"]):
        return "pending_tasks", params

    # 7. Create plan
    if any(k in tl for k in ["create", "generate", "make", "build"]) and any(k in tl for k in ["plan", "schedule", "revision", "dsa", "prep"]):
        return "create_plan", params

    # 8. Add session
    if any(k in tl for k in ["add session", "schedule session", "book session", "create session"]):
        return "add_session", params

    # 9. Progress
    if any(k in tl for k in ["progress", "how am i doing", "completion", "stats", "score", "streak", "percentage"]):
        return "progress", params

    # 10. Countdown
    if any(k in tl for k in ["countdown", "days left", "days until", "how many days", "exam date"]):
        return "countdown", params

    # 11. General recommend (e.g. "what should I study?", "recommend")
    if any(k in tl for k in ["what should i study", "what to study", "recommend", "next topic", "revise next"]):
        return "prioritise", params

    return "general_query", params


# ---------------------------------------------------------------------------
# Gemini Integration with Grounded Task Context
# ---------------------------------------------------------------------------

async def _call_gemini_with_task_context(
    user_message: str,
    context_data: Dict[str, Any],
    history: List[Dict[str, str]],
    guidance: str
) -> Optional[str]:
    """
    Invokes Gemini to generate an articulate, student-friendly explanation
    grounded STRICTLY in real retrieved database records.
    """
    if not (settings.AI_PROVIDER == "gemini" and settings.GEMINI_API_KEY):
        return None

    history_text = "\n".join([
        f"{'Student' if h.get('role') == 'user' else 'StudyPilot Assistant'}: {h.get('content', '')}"
        for h in history[-4:]
    ])

    prompt = f"""You are StudyPilot AI, an intelligent, motivating academic study companion.
Answer the student's question accurately, warmly, and concisely (2 to 3 sentences max).

CRITICAL GROUNDING RULES:
1. Ground your response STRICTLY in the real student task data provided below.
2. NEVER invent or hallucinate task names, dates, priorities, or difficulty levels.
3. If difficulty is unspecified in the plan, mention that or refer to task duration.
4. Keep the tone encouraging, clear, and action-oriented.

CURRENT STUDENT DATA:
- Today's Date: {context_data.get('today_str')}
- Overdue Tasks: {json.dumps([_task_to_dict(t) for t in context_data.get('overdue_tasks', [])])}
- Today's Scheduled Tasks: {json.dumps([_task_to_dict(t) for t in context_data.get('today_tasks', [])])}
- Upcoming Pending Tasks: {json.dumps([_task_to_dict(t) for t in context_data.get('upcoming_tasks', [])[:5]])}
- Subject Difficulty Ratings from Study Plans: {json.dumps(context_data.get('diff_map', {}))}

INSTRUCTION FOR THIS QUERY:
{guidance}

Recent Conversation:
{history_text}

Student: "{user_message}"
StudyPilot Assistant:"""

    url = f"https://generativelanguage.googleapis.com/v1beta/models/{settings.AI_MODEL_NAME}:generateContent?key={settings.GEMINI_API_KEY}"
    payload = {
        "contents": [{"parts": [{"text": prompt}]}],
        "generationConfig": {"temperature": 0.4, "maxOutputTokens": 400}
    }

    for attempt in range(2):
        try:
            async with httpx.AsyncClient(timeout=15.0) as client:
                resp = await client.post(url, json=payload)
                if resp.status_code == 503 and attempt == 0:
                    await asyncio.sleep(1.0)
                    continue
                resp.raise_for_status()
                data = resp.json()
                parts = data.get("candidates", [{}])[0].get("content", {}).get("parts", [])
                text_parts = [p.get("text", "") for p in parts if "text" in p]
                if text_parts:
                    record_generation_result("gemini")
                    return "".join(text_parts).strip()
        except Exception as e:
            logger.warning(f"Gemini grounded generation failed (attempt {attempt}): {e}")

    return None


# ---------------------------------------------------------------------------
# Core Assistant Message Processor
# ---------------------------------------------------------------------------

async def process_assistant_message(db: Session, req: ChatMessageRequest) -> ChatMessageResponse:
    """
    Main entry point for processing conversational messages.
    Retrieves real database context, computes deterministic truth, and explains naturally.
    """
    text = req.message.strip()
    today = date.today()
    history = req.conversation_history or []

    # 1. Retrieve real database records
    ctx = _get_student_context(db, today)
    all_pending = ctx["pending_tasks"]
    overdue = ctx["overdue_tasks"]
    today_tasks = ctx["today_tasks"]
    upcoming = ctx["upcoming_tasks"]
    diff_map = ctx["diff_map"]

    # 2. Classify intent
    intent, params = classify_user_intent(text)
    logger.info(f"Assistant processed query '{text[:40]}...' -> intent: {intent}")

    # =======================================================================
    # Case 1: "What should I study today?"
    # =======================================================================
    if intent == "today_tasks":
        if today_tasks:
            task_cards = [_task_to_dict(t, diff_map.get(t.subject.strip().lower())) for t in today_tasks]
            default_reply = (
                f"You have **{len(today_tasks)}** task{'s' if len(today_tasks) != 1 else ''} scheduled for today ({today.strftime('%b %d')}). "
                f"Your first session is **{today_tasks[0].title}** ({today_tasks[0].duration} mins, {today_tasks[0].priority} priority)."
            )
            guidance = f"Explain what the student has scheduled for today ({today.strftime('%Y-%m-%d')}). Highlight the first session: {today_tasks[0].title}."
            gemini_reply = await _call_gemini_with_task_context(text, ctx, history, guidance)

            return ChatMessageResponse(
                reply=gemini_reply or default_reply,
                card_type="task_list",
                card_data={
                    "title": f"Today's Schedule ({today.strftime('%b %d')})",
                    "total_count": len(today_tasks),
                    "tasks": task_cards
                },
                suggested_actions=[
                    AssistantAction(label="Open Task Manager", action_type="navigate", payload={"route": "/tasks"}),
                    AssistantAction(label="Start Focus Timer", action_type="navigate", payload={"route": "/weekly"})
                ],
                generation_mode="gemini" if gemini_reply else "mock",
                intent="today_tasks"
            )

        elif overdue:
            task_cards = [_task_to_dict(t, diff_map.get(t.subject.strip().lower())) for t in overdue[:4]]
            default_reply = (
                f"You don't have new tasks scheduled for today, but you have **{len(overdue)}** overdue task{'s' if len(overdue) != 1 else ''}. "
                f"I recommend catching up on **{overdue[0].title}** first."
            )
            guidance = f"Inform the student they have no sessions scheduled for today, but have {len(overdue)} overdue tasks. Recommend starting with {overdue[0].title}."
            gemini_reply = await _call_gemini_with_task_context(text, ctx, history, guidance)

            return ChatMessageResponse(
                reply=gemini_reply or default_reply,
                card_type="task_list",
                card_data={
                    "title": "Overdue Tasks Requiring Attention",
                    "total_count": len(overdue),
                    "tasks": task_cards
                },
                suggested_actions=[
                    AssistantAction(label="Review Overdue Tasks", action_type="navigate", payload={"route": "/tasks"}),
                    AssistantAction(label="Create New Plan", action_type="navigate", payload={"route": "/planner"})
                ],
                generation_mode="gemini" if gemini_reply else "mock",
                intent="today_tasks"
            )

        elif upcoming:
            task_cards = [_task_to_dict(t, diff_map.get(t.subject.strip().lower())) for t in upcoming[:3]]
            next_t = upcoming[0]
            default_reply = (
                f"You have a clean schedule today! Your next study session is **{next_t.title}** ({next_t.subject}) "
                f"scheduled for **{next_t.date}**."
            )
            guidance = f"Let the student know their schedule is clear today and mention their next upcoming task ({next_t.title} on {next_t.date})."
            gemini_reply = await _call_gemini_with_task_context(text, ctx, history, guidance)

            return ChatMessageResponse(
                reply=gemini_reply or default_reply,
                card_type="task_list",
                card_data={
                    "title": "Upcoming Study Sessions",
                    "total_count": len(upcoming),
                    "tasks": task_cards
                },
                suggested_actions=[
                    AssistantAction(label="Open Planner", action_type="navigate", payload={"route": "/planner"}),
                    AssistantAction(label="View Full Schedule", action_type="navigate", payload={"route": "/weekly"})
                ],
                generation_mode="gemini" if gemini_reply else "mock",
                intent="today_tasks"
            )

        else:
            return ChatMessageResponse(
                reply="You don't have any pending tasks right now. You're completely caught up! Would you like to create a study plan for your next exam?",
                card_type="info",
                card_data={"title": "All Caught Up", "message": "No pending or scheduled tasks found."},
                suggested_actions=[
                    AssistantAction(label="Create Study Plan", action_type="navigate", payload={"route": "/planner"}),
                    AssistantAction(label="View Dashboard", action_type="navigate", payload={"route": "/dashboard"})
                ],
                generation_mode="mock",
                intent="today_tasks"
            )

    # =======================================================================
    # Case 2: "Which task should I prioritise?"
    # =======================================================================
    if intent == "prioritise":
        if not all_pending:
            return ChatMessageResponse(
                reply="You don't have any pending tasks to prioritise right now. You're all caught up! Let's generate a study plan.",
                card_type="info",
                suggested_actions=[
                    AssistantAction(label="Create Study Plan", action_type="navigate", payload={"route": "/planner"})
                ],
                generation_mode="mock",
                intent="prioritise"
            )

        # Multi-factor ranking:
        # 1. Overdue with high priority
        # 2. Overdue with medium/low priority
        # 3. Today's high priority
        # 4. Today's other priority
        # 5. Upcoming high priority (earliest date)
        # 6. Upcoming other priority (earliest date)
        def score_task(t: Task) -> Tuple[int, str, int]:
            is_overdue = 0 if (t.date or "") < ctx["today_str"] else 1
            prio_rank = 0 if t.priority == "high" else (1 if t.priority == "medium" else 2)
            date_str = t.date or "9999-99-99"
            return (is_overdue, prio_rank, date_str)

        ranked = sorted(all_pending, key=score_task)
        top_task = ranked[0]

        recommendations = []
        for t in ranked[:3]:
            # Real contextual reason
            if (t.date or "") < ctx["today_str"]:
                reason = f"Overdue since {t.date} with {t.priority.upper()} priority — address immediately to stay on track."
            elif t.date == ctx["today_str"]:
                reason = f"Due today ({t.date}) with {t.priority.upper()} priority ({t.duration} mins)."
            else:
                reason = f"Upcoming deadline on {t.date} with {t.priority.upper()} priority."

            recommendations.append({
                "subject": t.subject,
                "topic": t.topic,
                "priority": t.priority,
                "reason": reason
            })

        top_is_overdue = (top_task.date or "") < ctx["today_str"]
        status_phrase = f"overdue since {top_task.date}" if top_is_overdue else f"scheduled for {top_task.date}"
        default_reply = (
            f"You should prioritise **{top_task.title}** ({top_task.subject}). It is marked as **{top_task.priority.upper()} priority** "
            f"and is {status_phrase}. Tackling this first eliminates your highest academic bottleneck."
        )

        guidance = (
            f"Recommend prioritizing {top_task.title} ({top_task.subject}). "
            f"Explain using real data: priority={top_task.priority}, date={top_task.date}, overdue={top_is_overdue}."
        )
        gemini_reply = await _call_gemini_with_task_context(text, ctx, history, guidance)

        return ChatMessageResponse(
            reply=gemini_reply or default_reply,
            card_type="recommendation",
            card_data={
                "title": "Prioritized Task Recommendations",
                "items": recommendations
            },
            suggested_actions=[
                AssistantAction(label="Open Task Manager", action_type="navigate", payload={"route": "/tasks"}),
                AssistantAction(label="Why this first?", action_type="chat_query", payload={"query": "Why should I study this first?"})
            ],
            generation_mode="gemini" if gemini_reply else "mock",
            intent="prioritise"
        )

    # =======================================================================
    # Case 3: "Which is the easiest?" / "Which task is easiest?"
    # =======================================================================
    if intent == "easiest":
        if not all_pending:
            return ChatMessageResponse(
                reply="You don't have any pending tasks right now. Create a study plan to populate your revision schedule!",
                card_type="info",
                suggested_actions=[
                    AssistantAction(label="Create Study Plan", action_type="navigate", payload={"route": "/planner"})
                ],
                generation_mode="mock",
                intent="easiest"
            )

        # Inspect real difficulty ratings and task duration:
        # Check if any pending task's subject is explicitly tagged as 'easy'
        easy_tasks = [t for t in all_pending if diff_map.get(t.subject.strip().lower()) == "easy"]

        if easy_tasks:
            # Sort by shortest duration among easy tasks
            easy_tasks.sort(key=lambda t: t.duration)
            easiest_task = easy_tasks[0]
            default_reply = (
                f"Based on your study plan's difficulty rating of **easy** for {easiest_task.subject}, "
                f"**{easiest_task.title}** is your easiest pending task (duration: **{easiest_task.duration} mins**). "
                f"Starting here gives you a quick, confidence-boosting win!"
            )
            items = [{
                "subject": easiest_task.subject,
                "topic": easiest_task.topic,
                "priority": easiest_task.priority,
                "reason": f"Rated 'easy' in study plan with a manageable {easiest_task.duration}-minute session."
            }]
        else:
            # No subject explicitly tagged 'easy' -> compare actual duration & priority
            # Shortest duration task with lowest priority is the least demanding
            prio_weights = {"low": 1, "medium": 2, "high": 3}
            sorted_by_ease = sorted(all_pending, key=lambda t: (t.duration, prio_weights.get(t.priority, 2)))
            easiest_task = sorted_by_ease[0]
            sub_diff = diff_map.get(easiest_task.subject.strip().lower())

            diff_note = f" (rated as '{sub_diff}' difficulty)" if sub_diff else " (no explicit 'easy' tag is set in your study plan)"
            default_reply = (
                f"While no subject is marked as 'easy'{diff_note}, **{easiest_task.title}** ({easiest_task.subject}) "
                f"is your least demanding pending session with the shortest duration of **{easiest_task.duration} minutes**. "
                f"It's a great low-friction way to build study momentum."
            )
            items = [{
                "subject": easiest_task.subject,
                "topic": easiest_task.topic,
                "priority": easiest_task.priority,
                "reason": f"Shortest duration session ({easiest_task.duration} mins) among your pending tasks."
            }]

        guidance = (
            f"Answer which task is easiest. Easiest candidate: {easiest_task.title} ({easiest_task.subject}), "
            f"duration={easiest_task.duration}m, subject difficulty={diff_map.get(easiest_task.subject.strip().lower(), 'unspecified')}. "
            f"Do not invent fake ratings if unspecified."
        )
        gemini_reply = await _call_gemini_with_task_context(text, ctx, history, guidance)

        return ChatMessageResponse(
            reply=gemini_reply or default_reply,
            card_type="recommendation",
            card_data={
                "title": "Easiest / Quickest Task",
                "items": items
            },
            suggested_actions=[
                AssistantAction(label="Start Top Task", action_type="navigate", payload={"route": "/tasks"}),
                AssistantAction(label="Which should I prioritise?", action_type="chat_query", payload={"query": "Which task should I prioritise?"})
            ],
            generation_mode="gemini" if gemini_reply else "mock",
            intent="easiest"
        )

    # =======================================================================
    # Case 4: "Why should I study this first?"
    # =======================================================================
    if intent == "why_first":
        if not all_pending:
            return ChatMessageResponse(
                reply="You don't have any pending tasks right now. Once you schedule study sessions, I can explain prioritization for each one.",
                card_type="info",
                generation_mode="mock",
                intent="why_first"
            )

        # Inspect conversation history for the task mentioned or recommended previously
        target_task = None
        for h in reversed(history):
            content = h.get("content", "")
            for t in all_pending:
                if t.title.lower() in content.lower() or t.topic.lower() in content.lower():
                    target_task = t
                    break
            if target_task:
                break

        # Fallback to the top priority task if no specific task was identified in history
        if not target_task:
            def score_task(t: Task) -> Tuple[int, str, int]:
                is_overdue = 0 if (t.date or "") < ctx["today_str"] else 1
                prio_rank = 0 if t.priority == "high" else (1 if t.priority == "medium" else 2)
                date_str = t.date or "9999-99-99"
                return (is_overdue, prio_rank, date_str)
            target_task = sorted(all_pending, key=score_task)[0]

        is_overdue = (target_task.date or "") < ctx["today_str"]
        is_today = target_task.date == ctx["today_str"]
        sub_diff = diff_map.get(target_task.subject.strip().lower())

        reasons = []
        if is_overdue:
            reasons.append(f"it was scheduled for **{target_task.date}** and is currently overdue")
        elif is_today:
            reasons.append(f"it is scheduled for **today ({target_task.date})**")
        else:
            reasons.append(f"it has an upcoming target date of **{target_task.date}**")

        reasons.append(f"has **{target_task.priority.upper()} priority** in your exam syllabus")
        if sub_diff:
            reasons.append(f"belongs to **{target_task.subject}** (classified as '{sub_diff}')")

        reason_str = " and ".join(reasons)
        default_reply = (
            f"I recommend studying **{target_task.title}** first because {reason_str}. "
            f"Covering high-priority topics early maximizes long-term memory retention and prevents last-minute cramming."
        )

        guidance = (
            f"Explain why the student should study '{target_task.title}' ({target_task.subject}) first. "
            f"Real attributes: date={target_task.date}, overdue={is_overdue}, priority={target_task.priority}, duration={target_task.duration}m."
        )
        gemini_reply = await _call_gemini_with_task_context(text, ctx, history, guidance)

        return ChatMessageResponse(
            reply=gemini_reply or default_reply,
            card_type="recommendation",
            card_data={
                "title": f"Why Prioritize: {target_task.title}",
                "items": [{
                    "subject": target_task.subject,
                    "topic": target_task.topic,
                    "priority": target_task.priority,
                    "reason": f"{'Overdue' if is_overdue else 'Due'} {target_task.date} • {target_task.duration} mins • {target_task.priority.upper()} priority"
                }]
            },
            suggested_actions=[
                AssistantAction(label="Open Task Manager", action_type="navigate", payload={"route": "/tasks"}),
                AssistantAction(label="Show Pending Tasks", action_type="chat_query", payload={"query": "Show my pending tasks"})
            ],
            generation_mode="gemini" if gemini_reply else "mock",
            intent="why_first"
        )

    # =======================================================================
    # Case 5: "I have only 30 minutes. What should I study?" (Time-Constrained)
    # =======================================================================
    if intent == "time_constrained":
        minutes = params.get("minutes")

        # If user didn't specify duration, ask for clarification
        if not minutes:
            return ChatMessageResponse(
                reply="How much time do you have available right now? Let me know (e.g., **15 minutes**, **30 minutes**, or **1 hour**) and I'll find the perfect session or review topic for your schedule.",
                card_type="info",
                card_data={"title": "Time Availability", "message": "Specify your available minutes."},
                suggested_actions=[
                    AssistantAction(label="I have 30 minutes", action_type="chat_query", payload={"query": "I have only 30 minutes. What should I study?"}),
                    AssistantAction(label="I have 1 hour", action_type="chat_query", payload={"query": "I have 1 hour to study"}),
                    AssistantAction(label="Show Pending Tasks", action_type="chat_query", payload={"query": "Show my pending tasks"})
                ],
                generation_mode="mock",
                intent="time_constrained"
            )

        if not all_pending:
            return ChatMessageResponse(
                reply=f"You don't have any pending study sessions right now. With your **{minutes} minutes**, you could review your formula sheets or generate a new study plan!",
                card_type="info",
                suggested_actions=[
                    AssistantAction(label="Create Study Plan", action_type="navigate", payload={"route": "/planner"})
                ],
                generation_mode="mock",
                intent="time_constrained"
            )

        # Look for tasks with duration <= minutes
        matching_tasks = [t for t in all_pending if t.duration <= minutes]

        if matching_tasks:
            # Sort matching tasks by priority ('high' first) and earliest date
            matching_tasks.sort(key=lambda t: (0 if t.priority == "high" else 1, t.date or "9999-99-99"))
            best_match = matching_tasks[0]
            default_reply = (
                f"For your **{minutes}-minute** window, **{best_match.title}** ({best_match.subject}) fits your schedule "
                f"at **{best_match.duration} minutes** ({best_match.priority} priority, scheduled for {best_match.date})."
            )
            guidance = f"The student has {minutes} minutes available. Recommend the matching task {best_match.title} ({best_match.duration} mins)."
            gemini_reply = await _call_gemini_with_task_context(text, ctx, history, guidance)

            return ChatMessageResponse(
                reply=gemini_reply or default_reply,
                card_type="task_list",
                card_data={
                    "title": f"Tasks Fitting Within {minutes} Minutes",
                    "total_count": len(matching_tasks),
                    "tasks": [_task_to_dict(t) for t in matching_tasks[:4]]
                },
                suggested_actions=[
                    AssistantAction(label="Start Top Task", action_type="navigate", payload={"route": "/tasks"}),
                    AssistantAction(label="Show All Tasks", action_type="navigate", payload={"route": "/tasks"})
                ],
                generation_mode="gemini" if gemini_reply else "mock",
                intent="time_constrained"
            )
        else:
            # All tasks are longer than the available time window
            shortest = min(all_pending, key=lambda t: t.duration)
            default_reply = (
                f"All your scheduled tasks are longer than **{minutes} minutes** (your shortest pending task is **{shortest.title}** at **{shortest.duration} mins**). "
                f"I recommend doing a focused **{minutes}-minute sprint** on **{shortest.title}**, focusing on key definitions and examples."
            )
            guidance = (
                f"Student has {minutes} mins, but all pending tasks are longer. Shortest is {shortest.title} ({shortest.duration}m). "
                f"Suggest tackling the first {minutes} minutes of that session as a sprint."
            )
            gemini_reply = await _call_gemini_with_task_context(text, ctx, history, guidance)

            # Offer to schedule a quick session
            quick_session = {
                "title": f"Quick {minutes}-min Revision: {shortest.subject}",
                "subject": shortest.subject,
                "topic": f"Sprint on {shortest.topic}",
                "date": today.strftime("%Y-%m-%d"),
                "start_time": "14:00",
                "duration": minutes,
                "priority": "medium",
                "description": f"Focused {minutes}-minute study sprint on {shortest.topic}.",
                "is_completed": False
            }

            return ChatMessageResponse(
                reply=gemini_reply or default_reply,
                card_type="task_preview",
                card_data=quick_session,
                suggested_actions=[
                    AssistantAction(label=f"Schedule {minutes}-Min Sprint", action_type="create_task", payload=quick_session),
                    AssistantAction(label="View Task Manager", action_type="navigate", payload={"route": "/tasks"})
                ],
                generation_mode="gemini" if gemini_reply else "mock",
                intent="time_constrained"
            )

    # =======================================================================
    # Case 6: "Show my pending tasks"
    # =======================================================================
    if intent == "pending_tasks":
        if not all_pending:
            return ChatMessageResponse(
                reply="Great job! You have zero pending tasks right now. You're completely caught up! Would you like to generate a new study schedule?",
                card_type="info",
                card_data={"title": "All Tasks Complete", "message": "No pending tasks found."},
                suggested_actions=[
                    AssistantAction(label="Create Study Plan", action_type="navigate", payload={"route": "/planner"}),
                    AssistantAction(label="View Dashboard", action_type="navigate", payload={"route": "/dashboard"})
                ],
                generation_mode="mock",
                intent="pending_tasks"
            )

        task_cards = [_task_to_dict(t, diff_map.get(t.subject.strip().lower())) for t in all_pending[:5]]
        default_reply = (
            f"You currently have **{len(all_pending)}** pending task{'s' if len(all_pending) != 1 else ''}. "
            f"Here are your most urgent upcoming sessions:"
        )

        guidance = f"The student asked for pending tasks. State there are {len(all_pending)} pending tasks and highlight the first one."
        gemini_reply = await _call_gemini_with_task_context(text, ctx, history, guidance)

        return ChatMessageResponse(
            reply=gemini_reply or default_reply,
            card_type="task_list",
            card_data={
                "title": "Pending Study Tasks",
                "total_count": len(all_pending),
                "tasks": task_cards
            },
            suggested_actions=[
                AssistantAction(label="Open Task Manager", action_type="navigate", payload={"route": "/tasks"}),
                AssistantAction(label="Which should I prioritise?", action_type="chat_query", payload={"query": "Which task should I prioritise?"})
            ],
            generation_mode="gemini" if gemini_reply else "mock",
            intent="pending_tasks"
        )

    # =======================================================================
    # Case 7: "Create a 7-day DSA study plan" (Plan Generation)
    # =======================================================================
    if intent == "create_plan":
        tl = text.lower()
        days_match = re.search(r"(\d+)[\s-]day", tl) or re.search(r"in\s+(\d+)\s+days?", tl)
        plan_days = int(days_match.group(1)) if days_match else 7
        plan_days = max(3, min(90, plan_days))
        exam_target = today + timedelta(days=plan_days)

        subject_name = "Data Structures & Algorithms"
        topics = ["Arrays & Two Pointers", "Stacks & Queues", "Trees & BST", "Graph Traversals", "Dynamic Programming"]

        subject_patterns = {
            "computer network": ("Computer Networks", ["OSI & TCP/IP Stack", "Subnetting & Routing", "TCP Congestion Control", "DNS & HTTP/3", "Network Security"]),
            "network":          ("Computer Networks", ["OSI & TCP/IP Stack", "Subnetting & Routing", "TCP Congestion Control", "DNS & HTTP/3", "Network Security"]),
            "operating system": ("Operating Systems", ["Processes & Threads", "CPU Scheduling", "Synchronization & Mutex", "Virtual Memory & Paging", "File Systems"]),
            " os ":             ("Operating Systems", ["Processes & Threads", "CPU Scheduling", "Synchronization & Mutex", "Virtual Memory & Paging", "File Systems"]),
            "dbms":             ("Database Systems", ["ER Model & Normalization", "SQL & Joins", "Transactions & ACID", "Indexing & B-Trees", "Query Optimization"]),
            "database":         ("Database Systems", ["ER Model & Normalization", "SQL & Joins", "Transactions & ACID", "Indexing & B-Trees", "Query Optimization"]),
            "math":             ("Mathematics", ["Calculus & Limits", "Linear Algebra", "Probability & Statistics", "Discrete Math", "Number Theory"]),
        }
        for keyword, (name, tlist) in subject_patterns.items():
            if keyword in tl:
                subject_name = name
                topics = tlist
                break

        plan_req = PlanGenerateRequest(
            student_name="Student",
            subjects=[SubjectInput(name=subject_name, difficulty="hard", topics=topics)],
            exam_date=exam_target.strftime("%Y-%m-%d"),
            daily_hours=2.5,
            preferred_days=["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"],
            topic_priority={t: "high" for t in topics[:2]}
        )

        plan_res = generate_deterministic_plan(plan_req)

        return ChatMessageResponse(
            reply=f"I've generated a tailored **{plan_days}-day study plan** for **{subject_name}** targeting your exam on **{exam_target.strftime('%b %d, %Y')}** — {plan_res.total_tasks_count} sessions totalling {plan_res.total_hours_planned} hours.",
            card_type="plan_preview",
            card_data={
                "plan_title": plan_res.plan_title,
                "exam_date": plan_res.exam_date,
                "daily_hours": plan_res.daily_hours,
                "total_study_days": plan_res.total_study_days,
                "total_hours_planned": plan_res.total_hours_planned,
                "tasks_count": plan_res.total_tasks_count,
                "tasks": [t.model_dump() for t in plan_res.tasks[:4]],
                "full_plan_request": plan_req.model_dump(),
                "full_tasks": [t.model_dump() for t in plan_res.tasks]
            },
            suggested_actions=[
                AssistantAction(
                    label="💾 Save Plan to Tasks",
                    action_type="save_plan",
                    payload={
                        "title": plan_res.plan_title,
                        "exam_date": plan_res.exam_date,
                        "daily_hours": plan_res.daily_hours,
                        "preferred_days": plan_req.preferred_days,
                        "tasks": [t.model_dump() for t in plan_res.tasks]
                    }
                ),
                AssistantAction(label="Customize in Planner", action_type="navigate", payload={"route": "/planner"})
            ],
            generation_mode=settings.AI_PROVIDER,
            intent="create_plan"
        )

    # =======================================================================
    # Case 8: "add_session"
    # =======================================================================
    if intent == "add_session":
        tl = text.lower()
        target_date = today + timedelta(days=1) if "tomorrow" in tl else today

        subject_guess = "General Study"
        subject_map = {
            "operating system": "Operating Systems", "os ": "Operating Systems",
            "dsa": "Data Structures & Algorithms", "data structure": "Data Structures & Algorithms", "algorithm": "Data Structures & Algorithms",
            "network": "Computer Networks",
            "dbms": "Database Systems", "database": "Database Systems",
            "math": "Mathematics", "calculus": "Mathematics",
            "physics": "Physics", "chemistry": "Chemistry",
        }
        for keyword, subject in subject_map.items():
            if keyword in tl:
                subject_guess = subject
                break

        dur = 60
        match_dur = re.search(r"(\d+)\s*(hour|hr|h|minute|min|m)\b", tl)
        if match_dur:
            val = int(match_dur.group(1))
            unit = match_dur.group(2)
            dur = val * 60 if unit.startswith("h") else val
        dur = max(15, min(300, dur))

        proposed_task = {
            "title": f"Study Session: {subject_guess}",
            "subject": subject_guess,
            "topic": "Core Revision",
            "date": target_date.strftime("%Y-%m-%d"),
            "start_time": "14:00",
            "duration": dur,
            "priority": "high",
            "description": f"Focused review of essential {subject_guess} principles.",
            "is_completed": False
        }

        return ChatMessageResponse(
            reply=f"I've prepared a **{dur}-minute study session** for **{subject_guess}** on **{target_date.strftime('%b %d, %Y')}**. Shall I add this to your schedule?",
            card_type="task_preview",
            card_data=proposed_task,
            suggested_actions=[
                AssistantAction(label="✅ Confirm & Save Session", action_type="create_task", payload=proposed_task),
                AssistantAction(label="Cancel", action_type="chat_query", payload={"query": "Show my pending tasks"})
            ],
            generation_mode=settings.AI_PROVIDER,
            intent="add_session"
        )

    # =======================================================================
    # Case 9: "progress" / stats
    # =======================================================================
    if intent == "progress":
        total_count = ctx["total_tasks"]
        completed_count = ctx["completed_tasks"]
        pending_count = len(all_pending)
        rate = round((completed_count / total_count * 100), 1) if total_count > 0 else 0
        streak = _compute_streak(db, today)

        reply = (
            f"You've completed **{completed_count}** out of **{total_count}** tasks "
            f"(**{rate}%** completion rate). "
        )
        if streak > 0:
            reply += f"🔥 You're on a **{streak}-day study streak** — keep it going!"
        if pending_count > 0:
            reply += f" You have **{pending_count}** tasks still pending."

        return ChatMessageResponse(
            reply=reply,
            card_type="metric_card",
            card_data={
                "total_tasks": total_count,
                "completed_tasks": completed_count,
                "pending_tasks": pending_count,
                "completion_rate": rate,
                "streak_days": streak
            },
            suggested_actions=[
                AssistantAction(label="View Dashboard", action_type="navigate", payload={"route": "/dashboard"}),
                AssistantAction(label="Show Pending Tasks", action_type="chat_query", payload={"query": "Show my pending tasks"})
            ],
            generation_mode=settings.AI_PROVIDER,
            intent="progress"
        )

    # =======================================================================
    # Case 10: "countdown"
    # =======================================================================
    if intent == "countdown":
        latest_plan = (
            db.query(StudyPlan)
            .filter(StudyPlan.exam_date >= today.strftime("%Y-%m-%d"))
            .order_by(StudyPlan.exam_date.asc())
            .first()
        )
        if latest_plan and latest_plan.exam_date:
            try:
                exam_d = datetime.strptime(latest_plan.exam_date, "%Y-%m-%d").date()
                days_left = (exam_d - today).days
                urgency = "🔴 Very soon!" if days_left <= 3 else ("🟡 Getting close!" if days_left <= 7 else "🟢 You have time — keep the pace!")
                reply = f"Your next exam **({latest_plan.title})** is in **{days_left} day{'s' if days_left != 1 else ''}** on {latest_plan.exam_date}. {urgency}"
            except ValueError:
                reply = "I couldn't calculate the countdown — please check your exam date in the planner."
        else:
            reply = "I don't see any upcoming exam plans. Create a study plan with an exam date first!"

        return ChatMessageResponse(
            reply=reply,
            card_type="info",
            suggested_actions=[
                AssistantAction(label="Open Study Planner", action_type="navigate", payload={"route": "/planner"}),
                AssistantAction(label="View Dashboard", action_type="navigate", payload={"route": "/dashboard"})
            ],
            generation_mode=settings.AI_PROVIDER,
            intent="countdown"
        )

    # =======================================================================
    # Case 11: General Conversational Fallback (Gemini with Context or Helpful Default)
    # =======================================================================
    guidance = "Answer the student's question helpfully using their actual tasks and schedule."
    gemini_reply = await _call_gemini_with_task_context(text, ctx, history, guidance)

    if gemini_reply:
        return ChatMessageResponse(
            reply=gemini_reply,
            card_type=None,
            suggested_actions=[
                AssistantAction(label="Show Pending Tasks", action_type="chat_query", payload={"query": "Show my pending tasks"}),
                AssistantAction(label="Which should I prioritise?", action_type="chat_query", payload={"query": "Which task should I prioritise?"}),
                AssistantAction(label="Create Study Plan", action_type="chat_query", payload={"query": "Create a 7-day DSA study plan"})
            ],
            generation_mode="gemini",
            intent="general_query"
        )

    streak = _compute_streak(db, today)
    return ChatMessageResponse(
        reply=(
            f"Hello! I'm your StudyPilot AI study assistant. You've completed {ctx['completed_tasks']} of {ctx['total_tasks']} tasks"
            + (f" and you're on a 🔥 {streak}-day streak!" if streak > 0 else ".")
            + " I can help prioritize tasks, identify your easiest sessions, plan exam prep, or review today's schedule. What would you like to focus on?"
        ),
        card_type="metric_card",
        card_data={
            "total_tasks": ctx["total_tasks"],
            "completed_tasks": ctx["completed_tasks"],
            "completion_rate": round((ctx["completed_tasks"] / ctx["total_tasks"] * 100), 1) if ctx["total_tasks"] > 0 else 0,
            "streak_days": streak
        },
        suggested_actions=[
            AssistantAction(label="What should I study today?", action_type="chat_query", payload={"query": "What should I study today?"}),
            AssistantAction(label="Which task should I prioritise?", action_type="chat_query", payload={"query": "Which task should I prioritise?"}),
            AssistantAction(label="Which is the easiest?", action_type="chat_query", payload={"query": "Which is the easiest?"})
        ],
        generation_mode="mock",
        intent="general_query"
    )


def _compute_streak(db: Session, today: date) -> int:
    """Compute how many consecutive days (ending today or yesterday) had at least one completed task."""
    streak = 0
    check_date = today
    for _ in range(365):
        date_str = check_date.strftime("%Y-%m-%d")
        count = db.query(Task).filter(
            Task.date == date_str,
            Task.is_completed == True
        ).count()
        if count > 0:
            streak += 1
            check_date -= timedelta(days=1)
        else:
            if check_date == today:
                check_date -= timedelta(days=1)
                continue
            break
    return streak
