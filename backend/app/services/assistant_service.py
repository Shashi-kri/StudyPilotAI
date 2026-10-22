import re
import json
import logging
from datetime import date, timedelta
from typing import Dict, Any, List, Optional
from sqlalchemy.orm import Session
from sqlalchemy import desc

from app.config import settings
from app.models.task import Task
from app.models.plan import StudyPlan
from app.schemas.assistant import ChatMessageRequest, ChatMessageResponse, AssistantAction
from app.schemas.plan import PlanGenerateRequest, SubjectInput
from app.services.ai_service import generate_deterministic_plan

logger = logging.getLogger(__name__)

def process_assistant_message(db: Session, req: ChatMessageRequest) -> ChatMessageResponse:
    """Processes incoming conversational queries with intent recognition, card rendering, and actions."""
    text = req.message.strip().lower()
    today = date.today()

    # 1. Intent: Pending tasks / "Show me my pending tasks" / "What tasks do I have?"
    if any(k in text for k in ["pending", "what tasks", "my tasks", "todo", "to do", "due"]):
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
            reply=f"You currently have {total_pending} pending task{'s' if total_pending != 1 else ''}. Here are your most urgent upcoming sessions:",
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

    # 2. Intent: Which topics should I revise next / recommendation
    if any(k in text for k in ["revise next", "what should i study", "recommend", "next topic", "priority"]):
        urgent_tasks = db.query(Task).filter(
            Task.is_completed == False,
            Task.priority == "high"
        ).order_by(Task.date.asc()).limit(3).all()

        if not urgent_tasks:
            urgent_tasks = db.query(Task).filter(
                Task.is_completed == False
            ).order_by(Task.date.asc()).limit(3).all()

        if urgent_tasks:
            recommendations = [
                {
                    "subject": t.subject,
                    "topic": t.topic,
                    "priority": t.priority,
                    "reason": f"Scheduled for {t.date} with high exam weight."
                } for t in urgent_tasks
            ]
            return ChatMessageResponse(
                reply="Based on your upcoming exams and priority ratings, here are the top topics you should tackle next:",
                card_type="recommendation",
                card_data={
                    "title": "Recommended Focus Topics",
                    "items": recommendations
                },
                suggested_actions=[
                    AssistantAction(label="Start Top Task", action_type="navigate", payload={"route": "/tasks"}),
                    AssistantAction(label="Open Planner", action_type="navigate", payload={"route": "/planner"})
                ],
                generation_mode=settings.AI_PROVIDER
            )
        else:
            return ChatMessageResponse(
                reply="You don't have any high-priority topics scheduled yet. Let's create a targeted revision plan for your upcoming exams!",
                card_type="info",
                suggested_actions=[
                    AssistantAction(label="Create Study Plan", action_type="navigate", payload={"route": "/planner"})
                ],
                generation_mode=settings.AI_PROVIDER
            )

    # 3. Intent: Add session / task ("Add a one-hour revision session for operating systems tomorrow")
    if "add" in text and any(k in text for k in ["session", "task", "hour", "study"]):
        # Extract target date (tomorrow or default today)
        target_date = today + timedelta(days=1) if "tomorrow" in text else today
        
        # Extract subject
        subject_guess = "General Study"
        if "operating system" in text or "os" in text:
            subject_guess = "Operating Systems"
        elif "dsa" in text or "data structure" in text or "algorithm" in text:
            subject_guess = "Data Structures & Algorithms"
        elif "network" in text:
            subject_guess = "Computer Networks"
        elif "dbms" in text or "database" in text:
            subject_guess = "Database Systems"

        # Duration
        dur = 60
        match_dur = re.search(r"(\d+)\s*(hour|hr|minute|min)", text)
        if match_dur:
            val = int(match_dur.group(1))
            unit = match_dur.group(2)
            dur = val * 60 if "h" in unit else val

        proposed_task = {
            "title": f"Revision Session: {subject_guess}",
            "subject": subject_guess,
            "topic": "Core Revision",
            "date": target_date.strftime("%Y-%m-%d"),
            "start_time": "14:00",
            "duration": dur,
            "priority": "high",
            "description": f"Quick-paced review of essential {subject_guess} principles requested via Alexa+ Assistant."
        }

        return ChatMessageResponse(
            reply=f"I've prepared a {dur}-minute study session for **{subject_guess}** on **{target_date.strftime('%b %d, %Y')}**. Would you like me to add this to your schedule?",
            card_type="task_preview",
            card_data=proposed_task,
            suggested_actions=[
                AssistantAction(label="Confirm & Save Session", action_type="create_task", payload=proposed_task),
                AssistantAction(label="Cancel", action_type="info", payload={"message": "Cancelled"})
            ],
            generation_mode=settings.AI_PROVIDER
        )

    # 4. Intent: "Create a 7-day DSA revision plan" or "Computer Networks exam in 10 days"
    days_match = re.search(r"(\d+)[ -]day", text) or re.search(r"in\s+(\d+)\s+days?", text)
    if "plan" in text or "exam" in text or days_match:
        plan_days = int(days_match.group(1)) if days_match else 7
        exam_target = today + timedelta(days=plan_days)

        subject_name = "Data Structures & Algorithms"
        topics = ["Arrays & Two Pointers", "Stacks & Queues", "Trees & BST", "Graph Traversals", "Dynamic Programming"]
        if "network" in text:
            subject_name = "Computer Networks"
            topics = ["OSI & TCP/IP Stack", "Subnetting & Routing", "TCP Congestion Control", "DNS & HTTP/3", "Network Security"]
        elif "os" in text or "operating system" in text:
            subject_name = "Operating Systems"
            topics = ["Processes & Threads", "CPU Scheduling", "Synchronization & Mutex", "Virtual Memory & Paging", "File Systems"]

        plan_req = PlanGenerateRequest(
            student_name="Student",
            subjects=[
                SubjectInput(name=subject_name, difficulty="hard", topics=topics)
            ],
            exam_date=exam_target.strftime("%Y-%m-%d"),
            daily_hours=2.5,
            preferred_days=["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"],
            topic_priority={t: "high" for t in topics[:2]}
        )

        plan_res = generate_deterministic_plan(plan_req)

        return ChatMessageResponse(
            reply=f"I've generated a tailored {plan_days}-day study plan for **{subject_name}** targeting your exam on **{exam_target.strftime('%b %d, %Y')}** ({plan_res.total_tasks_count} sessions, {plan_res.total_hours_planned} total hours).",
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
                    label="Save Plan to Tasks",
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

    # 5. Default conversational response with Alexa+ inspired guidance
    total_count = db.query(Task).count()
    completed_count = db.query(Task).filter(Task.is_completed == True).count()
    
    return ChatMessageResponse(
        reply=(
            f"Hello! I am your StudyPilot companion. You have completed {completed_count} out of {total_count} tasks so far. "
            "I can generate comprehensive revision plans, schedule focus sessions, or prioritize your difficult topics. "
            "What would you like to accomplish today?"
        ),
        card_type="metric_card",
        card_data={
            "total_tasks": total_count,
            "completed_tasks": completed_count,
            "completion_rate": round((completed_count / total_count * 100), 1) if total_count > 0 else 0
        },
        suggested_actions=[
            AssistantAction(label="Create 7-Day DSA Plan", action_type="chat_query", payload={"query": "Create a 7-day DSA revision plan"}),
            AssistantAction(label="Show Pending Tasks", action_type="chat_query", payload={"query": "Show me my pending tasks"}),
            AssistantAction(label="What Should I Revise Next?", action_type="chat_query", payload={"query": "Which topics should I revise next?"})
        ],
        generation_mode=settings.AI_PROVIDER
    )
