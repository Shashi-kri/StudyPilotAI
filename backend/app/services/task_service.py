from typing import List, Optional
from datetime import date
from sqlalchemy.orm import Session
from sqlalchemy import desc, asc
from app.models.task import Task
from app.schemas.task import TaskCreate, TaskUpdate

def get_tasks(
    db: Session,
    filter_type: Optional[str] = "all", # all, today, upcoming, completed, pending
    subject: Optional[str] = None
) -> List[Task]:
    query = db.query(Task)
    today_str = date.today().strftime("%Y-%m-%d")

    if subject:
        query = query.filter(Task.subject == subject)

    if filter_type == "today":
        query = query.filter(Task.date == today_str)
    elif filter_type == "upcoming":
        query = query.filter(Task.date > today_str)
    elif filter_type == "completed":
        query = query.filter(Task.is_completed == True)
    elif filter_type == "pending":
        query = query.filter(Task.is_completed == False)

    # Order by date asc, start_time asc, priority desc
    return query.order_by(asc(Task.date), asc(Task.start_time), desc(Task.priority)).all()

def get_task_by_id(db: Session, task_id: int) -> Optional[Task]:
    return db.query(Task).filter(Task.id == task_id).first()

def create_task(db: Session, task_in: TaskCreate) -> Task:
    task = Task(
        title=task_in.title.strip(),
        subject=task_in.subject.strip(),
        topic=task_in.topic.strip(),
        date=task_in.date,
        start_time=task_in.start_time,
        duration=task_in.duration,
        priority=task_in.priority,
        is_completed=task_in.is_completed,
        description=task_in.description.strip() if task_in.description else None,
        plan_id=task_in.plan_id
    )
    db.add(task)
    db.commit()
    db.refresh(task)
    return task

def update_task(db: Session, task_id: int, task_in: TaskUpdate) -> Optional[Task]:
    task = get_task_by_id(db, task_id)
    if not task:
        return None

    update_data = task_in.model_dump(exclude_unset=True)
    for field, value in update_data.items():
        if value is not None and isinstance(value, str):
            setattr(task, field, value.strip())
        else:
            setattr(task, field, value)

    db.commit()
    db.refresh(task)
    return task

def toggle_task_completion(db: Session, task_id: int) -> Optional[Task]:
    task = get_task_by_id(db, task_id)
    if not task:
        return None
    task.is_completed = not task.is_completed
    db.commit()
    db.refresh(task)
    return task

def delete_task(db: Session, task_id: int) -> bool:
    task = get_task_by_id(db, task_id)
    if not task:
        return False
    db.delete(task)
    db.commit()
    return True
