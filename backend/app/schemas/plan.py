from typing import List, Optional, Dict
from datetime import datetime
from pydantic import BaseModel, Field, ConfigDict

class SubjectInput(BaseModel):
    name: str = Field(..., min_length=1, max_length=100)
    difficulty: str = Field("medium", pattern=r"^(easy|medium|hard)$")
    topics: List[str] = Field(..., min_length=1)

class PlanGenerateRequest(BaseModel):
    student_name: Optional[str] = Field(None, max_length=100)
    subjects: List[SubjectInput] = Field(..., min_length=1)
    exam_date: str = Field(..., pattern=r"^\d{4}-\d{2}-\d{2}$")
    daily_hours: float = Field(2.0, ge=0.5, le=14.0)
    preferred_days: List[str] = Field(
        default=["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"],
        min_length=1
    )
    topic_priority: Optional[Dict[str, str]] = Field(default_factory=dict) # topic -> high/medium/low
    break_preferences: Optional[str] = Field("10 min break per hour")
    is_revision_prioritized: bool = True

class PlannedTaskItem(BaseModel):
    date: str = Field(..., pattern=r"^\d{4}-\d{2}-\d{2}$")
    start_time: Optional[str] = Field("09:00", pattern=r"^([01]\d|2[0-3]):[0-5]\d$")
    subject: str
    topic: str
    title: str
    duration: int = Field(60, ge=15, le=360)
    priority: str = Field("medium", pattern=r"^(low|medium|high)$")
    description: str

class PlanGenerateResponse(BaseModel):
    plan_title: str
    student_name: Optional[str] = None
    exam_date: str
    daily_hours: float
    total_study_days: int
    total_hours_planned: float
    total_tasks_count: int
    is_workload_feasible: bool = True
    feasibility_notes: Optional[str] = None
    tasks: List[PlannedTaskItem]
    generation_mode: str = "mock" # "mock" or "llm"
    model_name: Optional[str] = None

class StudyPlanSaveRequest(BaseModel):
    title: str
    student_name: Optional[str] = None
    exam_date: str
    daily_hours: float
    preferred_days: List[str]
    subject_difficulty: Dict[str, str] = Field(default_factory=dict)
    topic_priority: Dict[str, str] = Field(default_factory=dict)
    break_preferences: Optional[str] = None
    tasks: List[PlannedTaskItem]

class StudyPlanResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    title: str
    student_name: Optional[str] = None
    exam_date: Optional[str] = None
    daily_hours: float
    total_tasks: int
    created_at: datetime
