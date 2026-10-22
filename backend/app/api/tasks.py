from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlalchemy.orm import Session

from app.database import get_db
from app.schemas.task import TaskCreate, TaskUpdate, TaskResponse
from app.services import task_service

router = APIRouter(prefix="/tasks", tags=["Tasks"])

@router.get("", response_model=List[TaskResponse])
def list_tasks(
    filter_type: Optional[str] = Query("all", pattern=r"^(all|today|upcoming|completed|pending)$"),
    subject: Optional[str] = None,
    db: Session = Depends(get_db)
):
    tasks = task_service.get_tasks(db, filter_type=filter_type, subject=subject)
    return tasks

@router.post("", response_model=TaskResponse, status_code=status.HTTP_201_CREATED)
def create_task(task_in: TaskCreate, db: Session = Depends(get_db)):
    task = task_service.create_task(db, task_in)
    return task

@router.get("/{task_id}", response_model=TaskResponse)
def get_task(task_id: int, db: Session = Depends(get_db)):
    task = task_service.get_task_by_id(db, task_id)
    if not task:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Study task with id {task_id} not found."
        )
    return task

@router.patch("/{task_id}", response_model=TaskResponse)
def update_task(task_id: int, task_in: TaskUpdate, db: Session = Depends(get_db)):
    task = task_service.update_task(db, task_id, task_in)
    if not task:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Study task with id {task_id} not found."
        )
    return task

@router.post("/{task_id}/toggle", response_model=TaskResponse)
def toggle_task(task_id: int, db: Session = Depends(get_db)):
    task = task_service.toggle_task_completion(db, task_id)
    if not task:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Study task with id {task_id} not found."
        )
    return task

@router.delete("/{task_id}", status_code=status.HTTP_200_OK)
def delete_task(task_id: int, db: Session = Depends(get_db)):
    success = task_service.delete_task(db, task_id)
    if not success:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Study task with id {task_id} not found."
        )
    return {"message": f"Task {task_id} successfully deleted", "id": task_id}
