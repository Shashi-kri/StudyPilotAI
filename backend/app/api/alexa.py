"""
StudyPilot AI — Alexa Skills Kit (ASK) Request Handler
=======================================================
Handles incoming POST requests from the Alexa service, including:
  - LaunchRequest          → Welcome greeting + dashboard summary
  - CreateStudyPlanIntent  → Generate a study plan via ai_service
  - ShowPendingTasksIntent → List incomplete tasks
  - AddStudySessionIntent  → Propose and save a session
  - GetProgressIntent      → Completion rate + streak
  - RecommendTopicsIntent  → Priority-sorted topic list
  - CheckExamCountdownIntent → Days until next exam
  - MarkTaskCompleteIntent → Toggle a task complete
  - AMAZON.HelpIntent
  - AMAZON.StopIntent / AMAZON.CancelIntent

Alexa Webhook URL: POST /api/alexa/webhook
Configure this URL in the Alexa Developer Console under:
  Build → Endpoint → HTTPS → Default endpoint
"""

import hashlib
import hmac
import base64
import logging
from datetime import date, timedelta, datetime
from typing import Dict, Any, Optional
from urllib.parse import urlparse

from fastapi import APIRouter, Request, HTTPException, status, Depends
from sqlalchemy.orm import Session

from app.database import get_db
from app.config import settings
from app.models.task import Task
from app.models.plan import StudyPlan
from app.services.ai_service import generate_deterministic_plan
from app.services.task_service import create_task, toggle_task_completion
from app.schemas.task import TaskCreate
from app.schemas.plan import PlanGenerateRequest, SubjectInput

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/alexa", tags=["Alexa Skills Kit"])


# ---------------------------------------------------------------------------
# SSML Helpers
# ---------------------------------------------------------------------------

def ssml(text: str, rate: str = "medium") -> str:
    """Wrap text in SSML speak tags with adjustable rate."""
    return f'<speak><prosody rate="{rate}">{text}</prosody></speak>'


def build_response(
    speech: str,
    reprompt: Optional[str] = None,
    card_title: str = "StudyPilot AI",
    card_text: str = "",
    should_end_session: bool = False,
    apl_document: Optional[Dict] = None,
    apl_datasource: Optional[Dict] = None
) -> Dict[str, Any]:
    """Build a standard Alexa JSON response."""
    directives = []

    if apl_document:
        directives.append({
            "type": "Alexa.Presentation.APL.RenderDocument",
            "token": "studypilot-card",
            "document": apl_document,
            "datasources": apl_datasource or {}
        })

    response: Dict[str, Any] = {
        "version": "1.0",
        "response": {
            "outputSpeech": {
                "type": "SSML",
                "ssml": ssml(speech)
            },
            "card": {
                "type": "Simple",
                "title": card_title,
                "content": card_text or speech
            },
            "shouldEndSession": should_end_session
        }
    }

    if reprompt:
        response["response"]["reprompt"] = {
            "outputSpeech": {"type": "SSML", "ssml": ssml(reprompt)}
        }
    if directives:
        response["response"]["directives"] = directives

    return response


def get_slot(intent: Dict, slot_name: str, default: str = "") -> str:
    """Safely extract a slot value from an Alexa IntentRequest."""
    try:
        return intent["slots"][slot_name]["value"] or default
    except (KeyError, TypeError):
        return default


# ---------------------------------------------------------------------------
# Intent Handlers
# ---------------------------------------------------------------------------

def handle_launch(db: Session) -> Dict:
    today = date.today()
    total = db.query(Task).count()
    completed = db.query(Task).filter(Task.is_completed == True).count()
    pending = total - completed
    hour = datetime.now().hour
    greeting = "Good morning" if hour < 12 else ("Good afternoon" if hour < 17 else "Good evening")

    latest_plan = (
        db.query(StudyPlan)
        .filter(StudyPlan.exam_date >= today.strftime("%Y-%m-%d"))
        .order_by(StudyPlan.exam_date.asc())
        .first()
    )
    countdown_text = ""
    if latest_plan and latest_plan.exam_date:
        try:
            exam_d = datetime.strptime(latest_plan.exam_date, "%Y-%m-%d").date()
            days_left = (exam_d - today).days
            countdown_text = f" Your next exam is in {days_left} days."
        except ValueError:
            pass

    speech = (
        f"{greeting}! Welcome to StudyPilot A.I. "
        f"You have {pending} pending task{'s' if pending != 1 else ''} and {completed} completed.{countdown_text} "
        "You can ask me to create a study plan, show pending tasks, check your progress, or add a session. What would you like to do?"
    )
    reprompt = "Would you like to create a study plan, see your pending tasks, or check your exam countdown?"

    return build_response(speech, reprompt, card_text=f"📚 {pending} pending | ✅ {completed} completed{countdown_text}")


def handle_show_pending_tasks(db: Session) -> Dict:
    pending = db.query(Task).filter(Task.is_completed == False).order_by(Task.date.asc()).limit(5).all()
    total_pending = db.query(Task).filter(Task.is_completed == False).count()

    if not pending:
        return build_response(
            "Fantastic! You have no pending tasks. You are completely caught up. Would you like to create a new study plan?",
            reprompt="Say 'create study plan' to get started, or 'stop' to exit.",
            card_text="✅ All tasks complete! Great work."
        )

    task_lines = []
    card_lines = []
    for i, t in enumerate(pending[:3], 1):
        task_lines.append(f"Task {i}: {t.title}, scheduled for {t.date}.")
        card_lines.append(f"{i}. {t.title} — {t.date} ({t.duration} min)")

    speech = (
        f"You have {total_pending} pending task{'s' if total_pending != 1 else ''}. "
        "Here are your next three: " + " ".join(task_lines) +
        " Say 'add session' to schedule a new one, or 'mark complete' to finish a task."
    )
    return build_response(
        speech,
        reprompt="Would you like to create a plan or add a session?",
        card_title="Pending Tasks",
        card_text="\n".join(card_lines) + f"\n\nTotal pending: {total_pending}"
    )


def handle_create_plan(intent: Dict, db: Session) -> Dict:
    subject_slot = get_slot(intent, "subject", "Data Structures and Algorithms")
    days_slot = get_slot(intent, "days", "7")

    try:
        plan_days = max(3, min(90, int(days_slot)))
    except ValueError:
        plan_days = 7

    today = date.today()
    exam_date = today + timedelta(days=plan_days)

    # Map Alexa subject slot values to canonical names + default topics
    subject_map = {
        "dsa": ("Data Structures & Algorithms", ["Arrays & Two Pointers", "Stacks & Queues", "Trees & BST", "Graph Traversals", "Dynamic Programming"]),
        "data structures": ("Data Structures & Algorithms", ["Arrays & Two Pointers", "Stacks & Queues", "Trees & BST", "Graph Traversals", "Dynamic Programming"]),
        "algorithms": ("Data Structures & Algorithms", ["Sorting", "Binary Search", "Graph Algorithms", "Greedy", "Dynamic Programming"]),
        "computer networks": ("Computer Networks", ["OSI Model", "TCP/IP", "Subnetting", "Routing Protocols", "Network Security"]),
        "networking": ("Computer Networks", ["OSI Model", "TCP/IP", "Subnetting", "Routing Protocols", "Network Security"]),
        "operating systems": ("Operating Systems", ["Processes & Threads", "CPU Scheduling", "Memory Management", "File Systems", "Synchronization"]),
        "databases": ("Database Systems", ["ER Model", "SQL", "Normalization", "Transactions", "Indexing"]),
        "dbms": ("Database Systems", ["ER Model", "SQL", "Normalization", "Transactions", "Indexing"]),
        "mathematics": ("Mathematics", ["Calculus", "Linear Algebra", "Probability", "Discrete Math", "Statistics"]),
        "physics": ("Physics", ["Mechanics", "Thermodynamics", "Electromagnetism", "Optics", "Modern Physics"]),
    }

    subject_lower = subject_slot.lower().strip()
    subject_name, topics = ("Data Structures & Algorithms", ["Arrays & Two Pointers", "Stacks & Queues", "Trees & BST", "Graph Traversals", "Dynamic Programming"])
    for key, val in subject_map.items():
        if key in subject_lower:
            subject_name, topics = val
            break

    req = PlanGenerateRequest(
        student_name="Student",
        subjects=[SubjectInput(name=subject_name, difficulty="hard", topics=topics)],
        exam_date=exam_date.strftime("%Y-%m-%d"),
        daily_hours=2.5,
        preferred_days=["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"],
        topic_priority={t: "high" for t in topics[:2]}
    )

    plan = generate_deterministic_plan(req)

    speech = (
        f"I've generated a {plan_days}-day {subject_name} study plan with {plan.total_tasks_count} sessions "
        f"totalling {plan.total_hours_planned} hours, targeting your exam on {exam_date.strftime('%B %d')}. "
        "Open the StudyPilot app to review and save the full plan to your task list."
    )
    card_text = (
        f"📅 {plan_days}-day plan for {subject_name}\n"
        f"🎯 Exam: {exam_date.strftime('%b %d, %Y')}\n"
        f"📚 {plan.total_tasks_count} sessions | {plan.total_hours_planned} hours\n"
        "Open StudyPilot AI app to save."
    )
    return build_response(speech, card_title="Study Plan Generated", card_text=card_text, should_end_session=False)


def handle_add_session(intent: Dict, db: Session) -> Dict:
    subject_slot = get_slot(intent, "subject", "general study")
    duration_slot = get_slot(intent, "duration", "60")
    when_slot = get_slot(intent, "when", "today")

    try:
        dur = max(15, min(300, int(duration_slot)))
    except ValueError:
        dur = 60

    today = date.today()
    target_date = today + timedelta(days=1) if "tomorrow" in when_slot.lower() else today

    subject_map = {
        "dsa": "Data Structures & Algorithms",
        "data structures": "Data Structures & Algorithms",
        "networks": "Computer Networks",
        "networking": "Computer Networks",
        "operating systems": "Operating Systems",
        "databases": "Database Systems",
        "dbms": "Database Systems",
        "math": "Mathematics",
        "physics": "Physics",
    }
    subject_name = subject_map.get(subject_slot.lower().strip(), subject_slot.title())

    task_data = TaskCreate(
        title=f"Study Session: {subject_name}",
        subject=subject_name,
        topic="Core Revision",
        date=target_date.strftime("%Y-%m-%d"),
        start_time="14:00",
        duration=dur,
        priority="high",
        description=f"Session added via Alexa: {dur} minutes of {subject_name}.",
        is_completed=False
    )
    create_task(db, task_data)

    speech = (
        f"Done! I've added a {dur}-minute {subject_name} session on {target_date.strftime('%B %d')} at 2 PM to your schedule. "
        "Is there anything else I can help you with?"
    )
    return build_response(
        speech,
        reprompt="Say 'show pending tasks', 'create study plan', or 'stop'.",
        card_title="Session Added",
        card_text=f"✅ {dur} min {subject_name}\n📅 {target_date.strftime('%b %d, %Y')} at 14:00"
    )


def handle_get_progress(db: Session) -> Dict:
    total = db.query(Task).count()
    completed = db.query(Task).filter(Task.is_completed == True).count()
    pending = total - completed
    rate = round((completed / total * 100), 1) if total > 0 else 0

    # Compute streak
    streak = 0
    check = date.today()
    for _ in range(30):
        d_str = check.strftime("%Y-%m-%d")
        if db.query(Task).filter(Task.date == d_str, Task.is_completed == True).count() > 0:
            streak += 1
            check -= timedelta(days=1)
        else:
            break

    streak_text = f" You're on a {streak}-day study streak!" if streak > 0 else ""
    speech = (
        f"You've completed {completed} out of {total} tasks, that's a {rate} percent completion rate. "
        f"{pending} tasks are still pending.{streak_text} Keep up the great work!"
    )
    card_text = (
        f"✅ Completed: {completed}/{total} ({rate}%)\n"
        f"📝 Pending: {pending}\n"
        + (f"🔥 Streak: {streak} days!" if streak > 0 else "")
    )
    return build_response(speech, card_title="Your Progress", card_text=card_text)


def handle_recommend_topics(db: Session) -> Dict:
    high_tasks = db.query(Task).filter(
        Task.is_completed == False,
        Task.priority == "high"
    ).order_by(Task.date.asc()).limit(3).all()

    if not high_tasks:
        high_tasks = db.query(Task).filter(Task.is_completed == False).order_by(Task.date.asc()).limit(3).all()

    if not high_tasks:
        return build_response(
            "You have no pending tasks. You are all caught up! Create a new study plan to continue preparing.",
            reprompt="Say 'create study plan' to get started.",
            card_text="No pending tasks found."
        )

    topic_lines = [f"{t.topic} in {t.subject}" for t in high_tasks]
    speech = (
        f"Based on your schedule, I recommend focusing on: {', '.join(topic_lines[:2])}. "
        "These are your highest priority upcoming topics. Start with the first one for best results."
    )
    return build_response(
        speech,
        reprompt="Would you like to add a study session for any of these topics?",
        card_title="Recommended Topics",
        card_text="\n".join([f"• {l}" for l in topic_lines])
    )


def handle_exam_countdown(db: Session) -> Dict:
    today = date.today()
    latest_plan = (
        db.query(StudyPlan)
        .filter(StudyPlan.exam_date >= today.strftime("%Y-%m-%d"))
        .order_by(StudyPlan.exam_date.asc())
        .first()
    )
    if not latest_plan or not latest_plan.exam_date:
        return build_response(
            "I don't see any upcoming exam plans. Create a study plan with an exam date in the StudyPilot app first.",
            reprompt="Say 'create study plan' to get started.",
            card_text="No upcoming exams found."
        )
    try:
        exam_d = datetime.strptime(latest_plan.exam_date, "%Y-%m-%d").date()
        days_left = (exam_d - today).days
        urgency = "Very soon!" if days_left <= 3 else ("Getting close!" if days_left <= 7 else "You have time, keep the pace!")
        speech = (
            f"Your next exam is in {days_left} day{'s' if days_left != 1 else ''} "
            f"on {exam_d.strftime('%B %d')}. {urgency}"
        )
        card_text = f"📅 Exam: {latest_plan.exam_date}\n⏳ {days_left} days remaining\n{urgency}"
    except ValueError:
        speech = "I couldn't read the exam date. Please check it in the app."
        card_text = "Error reading exam date."

    return build_response(speech, card_title="Exam Countdown", card_text=card_text)


def handle_mark_task_complete(intent: Dict, db: Session) -> Dict:
    task_title_slot = get_slot(intent, "taskTitle", "")
    if not task_title_slot:
        return build_response(
            "I didn't catch which task. Please open the StudyPilot app to mark tasks complete, or rephrase with the task name.",
            reprompt="Try saying: 'mark Data Structures complete'."
        )

    # Find nearest matching incomplete task by title similarity
    tasks = db.query(Task).filter(Task.is_completed == False).all()
    matched = None
    for t in tasks:
        if task_title_slot.lower() in t.title.lower() or task_title_slot.lower() in t.subject.lower():
            matched = t
            break

    if not matched:
        return build_response(
            f"I couldn't find a pending task matching '{task_title_slot}'. Open the app to check your task list.",
            reprompt="Try saying the subject name, like 'mark Computer Networks complete'."
        )

    toggle_task_completion(db, matched.id)
    speech = f"Great job! I've marked '{matched.title}' as complete. That's one more ticked off!"
    return build_response(speech, card_title="Task Completed ✅", card_text=f"✅ {matched.title}")


def handle_help() -> Dict:
    speech = (
        "StudyPilot AI can help you in several ways. "
        "Say 'create study plan' to generate a revision schedule. "
        "Say 'show pending tasks' to see what's due. "
        "Say 'add a session' to schedule a study block. "
        "Say 'my progress' to check your completion rate. "
        "Say 'exam countdown' to see how many days until your exam. "
        "Or say 'what should I study next' for personalized recommendations. "
        "What would you like to do?"
    )
    return build_response(
        speech,
        reprompt="Say 'show pending tasks', 'create study plan', or 'my progress'.",
        card_title="StudyPilot AI Help",
        card_text=(
            "Commands:\n"
            "• 'Create study plan'\n"
            "• 'Show pending tasks'\n"
            "• 'Add a session'\n"
            "• 'My progress'\n"
            "• 'Exam countdown'\n"
            "• 'What should I study next?'"
        )
    )


def handle_stop() -> Dict:
    return build_response(
        "Good luck with your studies! Stay consistent and you'll crush your exams. Goodbye!",
        should_end_session=True,
        card_text="👋 See you next time! Keep studying!"
    )


# ---------------------------------------------------------------------------
# Main Webhook Route
# ---------------------------------------------------------------------------

@router.post("")
@router.post("/")
@router.post("/webhook")
async def alexa_webhook(request: Request, db: Session = Depends(get_db)):
    """
    Primary Alexa Skills Kit webhook endpoint.
    Receives Alexa IntentRequests and returns SSML + card responses.

    Configure this URL in Alexa Developer Console:
      Build > Endpoint > HTTPS > Default region > https://<your-domain>/api/alexa/webhook
    """
    try:
        body = await request.json()
    except Exception:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid JSON body")

    request_type = body.get("request", {}).get("type", "")
    alexa_request = body.get("request", {})
    intent = alexa_request.get("intent", {})
    intent_name = intent.get("name", "")

    logger.info(f"Alexa webhook: requestType={request_type}, intent={intent_name}")

    # --- LaunchRequest ---
    if request_type == "LaunchRequest":
        return handle_launch(db)

    # --- IntentRequest ---
    if request_type == "IntentRequest":
        if intent_name == "ShowPendingTasksIntent":
            return handle_show_pending_tasks(db)

        if intent_name == "CreateStudyPlanIntent":
            return handle_create_plan(intent, db)

        if intent_name == "AddStudySessionIntent":
            return handle_add_session(intent, db)

        if intent_name == "GetProgressIntent":
            return handle_get_progress(db)

        if intent_name == "RecommendTopicsIntent":
            return handle_recommend_topics(db)

        if intent_name == "CheckExamCountdownIntent":
            return handle_exam_countdown(db)

        if intent_name == "MarkTaskCompleteIntent":
            return handle_mark_task_complete(intent, db)

        if intent_name in ("AMAZON.HelpIntent",):
            return handle_help()

        if intent_name in ("AMAZON.StopIntent", "AMAZON.CancelIntent"):
            return handle_stop()

        # Unknown intent — graceful fallback
        return build_response(
            "I'm not sure how to help with that. Try saying 'help' to see what I can do.",
            reprompt="Say 'help' for a list of commands.",
        )

    # --- SessionEndedRequest ---
    if request_type == "SessionEndedRequest":
        return {"version": "1.0", "response": {}}

    raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=f"Unknown requestType: {request_type}")
