from typing import Optional
from datetime import datetime
from pydantic import BaseModel, Field, ConfigDict

class TaskBase(BaseModel):
    title: str = Field(..., min_length=1, max_length=255, description="Task title")
    subject: str = Field(..., min_length=1, max_length=100, description="Subject name")
    topic: str = Field(..., min_length=1, max_length=150, description="Topic name")
    date: str = Field(..., pattern=r"^\d{4}-\d{2}-\d{2}$", description="Date in YYYY-MM-DD")
    start_time: Optional[str] = Field(None, pattern=r"^([01]\d|2[0-3]):[0-5]\d$", description="Start time HH:MM")
    duration: int = Field(60, ge=5, le=480, description="Estimated duration in minutes")
    priority: str = Field("medium", pattern=r"^(low|medium|high)$", description="Priority level")
    is_completed: bool = False
    description: Optional[str] = None
    plan_id: Optional[int] = None

class TaskCreate(TaskBase):
    pass

class TaskUpdate(BaseModel):
    title: Optional[str] = Field(None, min_length=1, max_length=255)
    subject: Optional[str] = Field(None, min_length=1, max_length=100)
    topic: Optional[str] = Field(None, min_length=1, max_length=150)
    date: Optional[str] = Field(None, pattern=r"^\d{4}-\d{2}-\d{2}$")
    start_time: Optional[str] = Field(None, pattern=r"^([01]\d|2[0-3]):[0-5]\d$")
    duration: Optional[int] = Field(None, ge=5, le=480)
    priority: Optional[str] = Field(None, pattern=r"^(low|medium|high)$")
    is_completed: Optional[bool] = None
    description: Optional[str] = None

class TaskResponse(TaskBase):
    model_config = ConfigDict(from_attributes=True)

    id: int
    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None
