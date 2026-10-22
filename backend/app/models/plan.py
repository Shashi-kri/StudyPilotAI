from datetime import datetime, timezone
from sqlalchemy import Column, Integer, String, Float, Text, DateTime
from sqlalchemy.orm import relationship
from app.database import Base

def utc_now():
    return datetime.now(timezone.utc)

class StudyPlan(Base):
    __tablename__ = "study_plans"

    id = Column(Integer, primary_key=True, index=True)
    title = Column(String(255), nullable=False)
    student_name = Column(String(100), nullable=True)
    exam_date = Column(String(10), nullable=True)         # YYYY-MM-DD
    daily_hours = Column(Float, default=2.0)
    preferred_days = Column(Text, nullable=True)          # JSON list of weekdays
    subject_difficulty = Column(Text, nullable=True)      # JSON dict
    topic_priority = Column(Text, nullable=True)          # JSON dict
    break_preferences = Column(String(100), nullable=True)
    total_tasks = Column(Integer, default=0)
    raw_plan_json = Column(Text, nullable=True)
    created_at = Column(DateTime, default=utc_now)

    tasks = relationship("Task", back_populates="study_plan", cascade="all, delete-orphan")
