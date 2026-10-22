from datetime import datetime, timezone
from sqlalchemy import Column, Integer, String, Boolean, DateTime, ForeignKey, Text
from sqlalchemy.orm import relationship
from app.database import Base

def utc_now():
    return datetime.now(timezone.utc)

class Task(Base):
    __tablename__ = "tasks"

    id = Column(Integer, primary_key=True, index=True)
    title = Column(String(255), nullable=False)
    subject = Column(String(100), nullable=False, index=True)
    topic = Column(String(150), nullable=False)
    date = Column(String(10), nullable=False, index=True)  # YYYY-MM-DD
    start_time = Column(String(5), nullable=True)          # HH:MM
    duration = Column(Integer, default=60)                # minutes
    priority = Column(String(20), default="medium")       # low, medium, high
    is_completed = Column(Boolean, default=False, index=True)
    description = Column(Text, nullable=True)
    
    plan_id = Column(Integer, ForeignKey("study_plans.id", ondelete="SET NULL"), nullable=True)
    created_at = Column(DateTime, default=utc_now)
    updated_at = Column(DateTime, default=utc_now, onupdate=utc_now)

    study_plan = relationship("StudyPlan", back_populates="tasks")
