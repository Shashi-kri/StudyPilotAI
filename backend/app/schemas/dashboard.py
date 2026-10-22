from typing import List, Optional
from pydantic import BaseModel
from app.schemas.task import TaskResponse

class DailyProgressMetric(BaseModel):
    day_name: str      # e.g., "Mon", "Tue"
    date_str: str      # e.g., "2026-10-21"
    completed: int
    pending: int
    total_minutes: int

class DashboardStatsResponse(BaseModel):
    welcome_message: str
    today_date: str
    exam_countdown_days: Optional[int] = None
    next_exam_date: Optional[str] = None
    next_exam_title: Optional[str] = None
    total_tasks: int
    completed_tasks: int
    pending_tasks: int
    completion_percentage: float
    streak_days: int = 0
    today_schedule: List[TaskResponse]
    upcoming_sessions: List[TaskResponse]
    weekly_progress: List[DailyProgressMetric]
    ai_mode: str = "mock" # "mock" or "llm"
