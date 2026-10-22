from datetime import date, timedelta, datetime
from typing import List
from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from sqlalchemy import desc, asc

from app.database import get_db
from app.config import settings
from app.models.task import Task
from app.models.plan import StudyPlan
from app.schemas.dashboard import DashboardStatsResponse, DailyProgressMetric
from app.schemas.task import TaskResponse

router = APIRouter(tags=["Dashboard"])

WEEKDAY_NAMES = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"]

@router.get("/dashboard", response_model=DashboardStatsResponse)
def get_dashboard_data(db: Session = Depends(get_db)):
    today = date.today()
    today_str = today.strftime("%Y-%m-%d")

    # Overall task metrics
    all_tasks = db.query(Task).all()
    total_tasks = len(all_tasks)
    completed_tasks = sum(1 for t in all_tasks if t.is_completed)
    pending_tasks = total_tasks - completed_tasks
    completion_percentage = round((completed_tasks / total_tasks * 100), 1) if total_tasks > 0 else 0.0

    # Today's schedule
    today_tasks = (
        db.query(Task)
        .filter(Task.date == today_str)
        .order_by(asc(Task.start_time), desc(Task.priority))
        .all()
    )

    # Upcoming sessions (tasks on dates after today)
    upcoming_tasks = (
        db.query(Task)
        .filter(Task.date > today_str)
        .order_by(asc(Task.date), asc(Task.start_time))
        .limit(6)
        .all()
    )

    # Next exam countdown
    latest_plan = (
        db.query(StudyPlan)
        .filter(StudyPlan.exam_date >= today_str)
        .order_by(asc(StudyPlan.exam_date))
        .first()
    )

    countdown_days = None
    next_exam_date = None
    next_exam_title = None

    if latest_plan and latest_plan.exam_date:
        try:
            ex_date = datetime.strptime(latest_plan.exam_date, "%Y-%m-%d").date()
            diff = (ex_date - today).days
            if diff >= 0:
                countdown_days = diff
                next_exam_date = latest_plan.exam_date
                next_exam_title = latest_plan.title
        except ValueError:
            pass

    # Weekly progress visualization (7-day window: Monday to Sunday of current week)
    # Find Monday of this week
    start_of_week = today - timedelta(days=today.weekday())
    weekly_metrics: List[DailyProgressMetric] = []

    for i in range(7):
        day_date = start_of_week + timedelta(days=i)
        day_str = day_date.strftime("%Y-%m-%d")
        day_tasks = [t for t in all_tasks if t.date == day_str]
        
        comp_count = sum(1 for t in day_tasks if t.is_completed)
        pend_count = sum(1 for t in day_tasks if not t.is_completed)
        mins = sum(t.duration for t in day_tasks)

        weekly_metrics.append(DailyProgressMetric(
            day_name=WEEKDAY_NAMES[day_date.weekday()],
            date_str=day_str,
            completed=comp_count,
            pending=pend_count,
            total_minutes=mins
        ))

    # Welcome message based on time of day
    hour = datetime.now().hour
    greeting = "Good morning" if hour < 12 else ("Good afternoon" if hour < 17 else "Good evening")
    welcome_msg = f"{greeting}, Scholar! Ready to conquer today's study goals?"

    ai_mode = "mock"
    if settings.AI_PROVIDER != "mock" and (settings.GEMINI_API_KEY or settings.OPENAI_API_KEY):
        ai_mode = "llm"

    from app.services.assistant_service import _compute_streak
    streak = _compute_streak(db, today)

    return DashboardStatsResponse(
        welcome_message=welcome_msg,
        today_date=today.strftime("%A, %B %d, %Y"),
        exam_countdown_days=countdown_days,
        next_exam_date=next_exam_date,
        next_exam_title=next_exam_title,
        total_tasks=total_tasks,
        completed_tasks=completed_tasks,
        pending_tasks=pending_tasks,
        completion_percentage=completion_percentage,
        streak_days=streak,
        today_schedule=[TaskResponse.model_validate(t) for t in today_tasks],
        upcoming_sessions=[TaskResponse.model_validate(t) for t in upcoming_tasks],
        weekly_progress=weekly_metrics,
        ai_mode=ai_mode
    )
