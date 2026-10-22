import asyncio
import json
import logging
import re
from datetime import date, timedelta
from typing import Dict, Any, List, Optional
from sqlalchemy.orm import Session
from sqlalchemy import desc

import httpx

from app.config import settings
from app.models.task import Task
from app.models.plan import StudyPlan
from app.schemas.assistant import ChatMessageRequest, ChatMessageResponse, AssistantAction
from app.schemas.plan import PlanGenerateRequest, SubjectInput
from app.services.ai_service import generate_deterministic_plan

logger = logging.getLogger(__name__)

# ---------------------------------------------------------------------------
# Intent Classification Helpers
# ---------------------------------------------------------------------------

INTENT_KEYWORDS = {
    "pending_tasks": ["pending", "what tasks", "my tasks", "todo", "to do", "due", "overdue", "not done"],
    "recommend":     ["revise next", "what should i study", "recommend", "next topic", "priority", "focus on", "what to study"],
    "add_session":   ["add", "schedule", "book", "create session"],
    "create_plan":   ["plan", "exam", "revision plan", "study plan", "prepare for"],
    "progress":      ["progress", "how am i doing", "completion", "stats", "score", "streak", "percentage"],
    "countdown":     ["how many days", "countdown", "days left", "days until", "time left"],
}

def classify_intent(text: str) -> str:
    """Rule-based intent classifier with keyword matching. Returns intent name."""
    text_l = text.lower()
    for intent, keywords in INTENT_KEYWORDS.items():
        if any(k in text_l for k in keywords):
            return intent
    return "fallback"


async def _classify_with_gemini(text: str) -> str:
    """Use Gemini to classify user intent when AI provider is configured."""
    if not (settings.AI_PROVIDER == "gemini" and settings.GEMINI_API_KEY):
        return classify_intent(text)

    prompt = f"""You are an intent classifier for a study assistant app. 
Classify the user message into exactly one of these intents:
- pending_tasks: asking about pending, due, or incomplete study tasks
- recommend: asking what to study next or for topic recommendations
- add_session: requesting to add/schedule a study session
- create_plan: requesting to generate a multi-day study plan for an exam
- progress: asking about study progress, completion rate, or streaks
- countdown: asking how many days until an exam
- fallback: anything else

User message: "{text}"

Reply with ONLY the intent name, nothing else."""

    url = f"https://generativelanguage.googleapis.com/v1beta/models/{settings.AI_MODEL_NAME}:generateContent?key={settings.GEMINI_API_KEY}"
    payload = {
        "contents": [{"parts": [{"text": prompt}]}],
        "generationConfig": {"temperature": 0.0, "maxOutputTokens": 300}
    }
    try:
        async with httpx.AsyncClient(timeout=10.0) as client:
            resp = await client.post(url, json=payload)
            resp.raise_for_status()
            data = resp.json()
            parts = data.get("candidates", [{}])[0].get("content", {}).get("parts", [])
            text_parts = [p.get("text", "") for p in parts if "text" in p]
            if not text_parts:
                return classify_intent(text)
            intent_raw = text_parts[-1].strip().lower()
            # Clean up in case model adds punctuation
            intent_clean = re.sub(r"[^a-z_]", "", intent_raw)
            if intent_clean in INTENT_KEYWORDS or intent_clean == "fallback":
                return intent_clean
    except Exception as e:
        logger.warning(f"Gemini intent classification failed: {e}")
    return classify_intent(text)


async def _generate_gemini_reply(user_message: str, context: str, history: List[Dict]) -> str:
    """Use Gemini to generate a free-form conversational response for unrecognized queries."""
    if not (settings.AI_PROVIDER == "gemini" and settings.GEMINI_API_KEY):
        return None

    history_text = "\n".join([
        f"{'User' if h['role'] == 'user' else 'Assistant'}: {h['content']}"
        for h in history[-6:]
    ])

    prompt = f"""You are StudyPilot AI, a helpful and motivating academic study assistant.
You help students plan their exam preparation, prioritize topics, and stay on track.
Keep responses concise (2-3 sentences), warm, and action-oriented.

Student context: {context}

Recent conversation:
{history_text}

Student: {user_message}
Assistant:"""

    url = f"https://generativelanguage.googleapis.com/v1beta/models/{settings.AI_MODEL_NAME}:generateContent?key={settings.GEMINI_API_KEY}"
    payload = {
        "contents": [{"parts": [{"text": prompt}]}],
        "generationConfig": {"temperature": 0.7, "maxOutputTokens": 600}
    }
    for attempt in range(2):
        try:
            async with httpx.AsyncClient(timeout=20.0) as client:
                resp = await client.post(url, json=payload)
                if resp.status_code == 503 and attempt == 0:
                    logger.info("Gemini conversational reply 503 spike. Retrying in 1.5s...")
                    await asyncio.sleep(1.5)
                    continue
                resp.raise_for_status()
                data = resp.json()
                parts = data.get("candidates", [{}])[0].get("content", {}).get("parts", [])
                text_parts = [p.get("text", "") for p in parts if "text" in p]
                if text_parts:
                    return "".join(text_parts).strip()
        except Exception as e:
            if attempt == 1 or not isinstance(e, httpx.HTTPStatusError) or e.response.status_code != 503:
                logger.warning(f"Gemini conversational reply failed: {e}")
    return None


# ---------------------------------------------------------------------------
# Main assistant entry point (now async to support Gemini calls)
# ---------------------------------------------------------------------------

async def process_assistant_message(db: Session, req: ChatMessageRequest) -> ChatMessageResponse:
    """Processes incoming conversational queries with intent recognition, card rendering, and actions."""
    text = req.message.strip()
    text_lower = text.lower()
    today = date.today()
    history = req.conversation_history or []

    # Classify intent — try Gemini if available, fall back to keyword matching
    intent = await _classify_with_gemini(text) if (settings.AI_PROVIDER == "gemini" and settings.GEMINI_API_KEY) else classify_intent(text_lower)
    logger.info(f"Intent classified as: {intent} (provider={settings.AI_PROVIDER})")

    # -----------------------------------------------------------------------
    # Intent: pending_tasks
    # -----------------------------------------------------------------------
    if intent == "pending_tasks":
        pending = db.query(Task).filter(Task.is_completed == False).order_by(Task.date.asc()).limit(5).all()
        total_pending = db.query(Task).filter(Task.is_completed == False).count()

        if not pending:
            return ChatMessageResponse(
                reply="Great job! You have zero pending tasks right now. You're completely caught up! Would you like to generate a new study schedule?",
                card_type="info",
                card_data={"title": "All Tasks Complete", "message": "No pending tasks found."},
                suggested_actions=[
                    AssistantAction(label="Create Study Plan", action_type="navigate", payload={"route": "/planner"}),
                    AssistantAction(label="View All Tasks", action_type="navigate", payload={"route": "/tasks"})
                ],
                generation_mode=settings.AI_PROVIDER
            )

        task_data = [
            {
                "id": t.id,
                "title": t.title,
                "subject": t.subject,
                "date": t.date,
                "duration": t.duration,
                "priority": t.priority
            } for t in pending
        ]
        return ChatMessageResponse(
            reply=f"You currently have **{total_pending}** pending task{'s' if total_pending != 1 else ''}. Here are your most urgent upcoming sessions:",
            card_type="task_list",
            card_data={
                "title": "Pending Study Tasks",
                "total_count": total_pending,
                "tasks": task_data
            },
            suggested_actions=[
                AssistantAction(label="Open Task Manager", action_type="navigate", payload={"route": "/tasks"}),
                AssistantAction(label="View Weekly Schedule", action_type="navigate", payload={"route": "/weekly"})
            ],
            generation_mode=settings.AI_PROVIDER
        )

    # -----------------------------------------------------------------------
    # Intent: recommend
    # -----------------------------------------------------------------------
    if intent == "recommend":
        urgent_tasks = db.query(Task).filter(
            Task.is_completed == False,
            Task.priority == "high"
        ).order_by(Task.date.asc()).limit(3).all()

        if not urgent_tasks:
            urgent_tasks = db.query(Task).filter(Task.is_completed == False).order_by(Task.date.asc()).limit(3).all()

        if urgent_tasks:
            recommendations = [
                {
                    "subject": t.subject,
                    "topic": t.topic,
                    "priority": t.priority,
                    "reason": f"Scheduled for {t.date} — tackle early for maximum retention."
                } for t in urgent_tasks
            ]
            return ChatMessageResponse(
                reply="Based on your upcoming deadlines and priority ratings, here are the top topics you should tackle next:",
                card_type="recommendation",
                card_data={"title": "Recommended Focus Topics", "items": recommendations},
                suggested_actions=[
                    AssistantAction(label="Start Top Task", action_type="navigate", payload={"route": "/tasks"}),
                    AssistantAction(label="Open Planner", action_type="navigate", payload={"route": "/planner"})
                ],
                generation_mode=settings.AI_PROVIDER
            )
        return ChatMessageResponse(
            reply="You don't have any high-priority topics scheduled yet. Let's create a targeted revision plan!",
            card_type="info",
            suggested_actions=[
                AssistantAction(label="Create Study Plan", action_type="navigate", payload={"route": "/planner"})
            ],
            generation_mode=settings.AI_PROVIDER
        )

    # -----------------------------------------------------------------------
    # Intent: progress / stats
    # -----------------------------------------------------------------------
    if intent == "progress":
        total_count = db.query(Task).count()
        completed_count = db.query(Task).filter(Task.is_completed == True).count()
        pending_count = total_count - completed_count
        rate = round((completed_count / total_count * 100), 1) if total_count > 0 else 0

        # Compute study streak (consecutive days with at least one completed task)
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
            generation_mode=settings.AI_PROVIDER
        )

    # -----------------------------------------------------------------------
    # Intent: countdown
    # -----------------------------------------------------------------------
    if intent == "countdown":
        latest_plan = (
            db.query(StudyPlan)
            .filter(StudyPlan.exam_date >= today.strftime("%Y-%m-%d"))
            .order_by(StudyPlan.exam_date.asc())
            .first()
        )
        if latest_plan and latest_plan.exam_date:
            try:
                from datetime import datetime
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
            generation_mode=settings.AI_PROVIDER
        )

    # -----------------------------------------------------------------------
    # Intent: add_session
    # -----------------------------------------------------------------------
    if intent == "add_session" and any(k in text_lower for k in ["session", "task", "hour", "study", "add", "schedule"]):
        target_date = today + timedelta(days=1) if "tomorrow" in text_lower else today

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
            if keyword in text_lower:
                subject_guess = subject
                break

        dur = 60
        match_dur = re.search(r"(\d+)\s*(hour|hr|h|minute|min|m)\b", text_lower)
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
            "description": f"Quick-paced review of essential {subject_guess} principles requested via Alexa+ Assistant.",
            "is_completed": False
        }

        return ChatMessageResponse(
            reply=f"I've prepared a **{dur}-minute study session** for **{subject_guess}** on **{target_date.strftime('%b %d, %Y')}**. Shall I add this to your schedule?",
            card_type="task_preview",
            card_data=proposed_task,
            suggested_actions=[
                AssistantAction(label="✅ Confirm & Save Session", action_type="create_task", payload=proposed_task),
                AssistantAction(label="Cancel", action_type="chat_query", payload={"query": "What should I study next?"})
            ],
            generation_mode=settings.AI_PROVIDER
        )

    # -----------------------------------------------------------------------
    # Intent: create_plan
    # -----------------------------------------------------------------------
    if intent == "create_plan":
        days_match = re.search(r"(\d+)[\s-]day", text_lower) or re.search(r"in\s+(\d+)\s+days?", text_lower)
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
            if keyword in text_lower:
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
            generation_mode=settings.AI_PROVIDER
        )

    # -----------------------------------------------------------------------
    # Fallback: Try Gemini for free-form response, else canned reply
    # -----------------------------------------------------------------------
    total_count = db.query(Task).count()
    completed_count = db.query(Task).filter(Task.is_completed == True).count()
    context = f"{completed_count}/{total_count} tasks completed"

    gemini_reply = await _generate_gemini_reply(text, context, history)
    if gemini_reply:
        return ChatMessageResponse(
            reply=gemini_reply,
            card_type=None,
            suggested_actions=[
                AssistantAction(label="Show Pending Tasks", action_type="chat_query", payload={"query": "Show my pending tasks"}),
                AssistantAction(label="Create Study Plan", action_type="chat_query", payload={"query": "Create a 7-day DSA revision plan"}),
                AssistantAction(label="What Should I Study?", action_type="chat_query", payload={"query": "Which topics should I revise next?"})
            ],
            generation_mode="gemini"
        )

    # Pure mock fallback
    streak = _compute_streak(db, today)
    return ChatMessageResponse(
        reply=(
            f"Hello! I'm your StudyPilot Alexa+ companion. You've completed {completed_count} of {total_count} tasks"
            + (f" and you're on a 🔥 {streak}-day streak!" if streak > 0 else ".")
            + " I can generate revision plans, schedule focus sessions, or show your progress. What would you like?"
        ),
        card_type="metric_card",
        card_data={
            "total_tasks": total_count,
            "completed_tasks": completed_count,
            "completion_rate": round((completed_count / total_count * 100), 1) if total_count > 0 else 0,
            "streak_days": streak
        },
        suggested_actions=[
            AssistantAction(label="Create 7-Day DSA Plan", action_type="chat_query", payload={"query": "Create a 7-day DSA revision plan"}),
            AssistantAction(label="Show Pending Tasks", action_type="chat_query", payload={"query": "Show me my pending tasks"}),
            AssistantAction(label="What Should I Revise Next?", action_type="chat_query", payload={"query": "Which topics should I revise next?"})
        ],
        generation_mode=settings.AI_PROVIDER
    )


def _compute_streak(db: Session, today: date) -> int:
    """Compute how many consecutive days (ending today or yesterday) had at least one completed task."""
    streak = 0
    check_date = today
    # Allow streak to include today even if day just started
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
            # Allow one miss for today (day just started)
            if check_date == today:
                check_date -= timedelta(days=1)
                continue
            break
    return streak
