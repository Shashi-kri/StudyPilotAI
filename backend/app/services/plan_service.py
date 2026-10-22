import json
from typing import List, Optional
from sqlalchemy.orm import Session
from sqlalchemy import desc
from app.models.plan import StudyPlan
from app.models.task import Task
from app.schemas.plan import StudyPlanSaveRequest

def save_study_plan(db: Session, plan_in: StudyPlanSaveRequest) -> StudyPlan:
    plan = StudyPlan(
        title=plan_in.title.strip(),
        student_name=plan_in.student_name.strip() if plan_in.student_name else None,
        exam_date=plan_in.exam_date,
        daily_hours=plan_in.daily_hours,
        preferred_days=json.dumps(plan_in.preferred_days),
        subject_difficulty=json.dumps(plan_in.subject_difficulty),
        topic_priority=json.dumps(plan_in.topic_priority),
        break_preferences=plan_in.break_preferences,
        total_tasks=len(plan_in.tasks),
        raw_plan_json=json.dumps([t.model_dump() for t in plan_in.tasks])
    )
    db.add(plan)
    db.flush() # get plan.id

    # Create associated tasks
    task_entities = []
    for t in plan_in.tasks:
        task_entities.append(Task(
            title=t.title.strip(),
            subject=t.subject.strip(),
            topic=t.topic.strip(),
            date=t.date,
            start_time=t.start_time,
            duration=t.duration,
            priority=t.priority,
            is_completed=False,
            description=t.description,
            plan_id=plan.id
        ))

    db.add_all(task_entities)
    db.commit()
    db.refresh(plan)
    return plan

def get_study_plans(db: Session) -> List[StudyPlan]:
    return db.query(StudyPlan).order_by(desc(StudyPlan.created_at)).all()

def get_study_plan_by_id(db: Session, plan_id: int) -> Optional[StudyPlan]:
    return db.query(StudyPlan).filter(StudyPlan.id == plan_id).first()
