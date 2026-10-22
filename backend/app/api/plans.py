import json
from typing import List, Dict, Any
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.database import get_db
from app.schemas.plan import (
    PlanGenerateRequest,
    PlanGenerateResponse,
    StudyPlanSaveRequest,
    StudyPlanResponse
)
from app.schemas.task import TaskResponse
from app.services import ai_service, plan_service

router = APIRouter(prefix="/plans", tags=["Study Plans"])

@router.post("/generate", response_model=PlanGenerateResponse)
async def generate_plan(request: PlanGenerateRequest):
    try:
        response = await ai_service.generate_study_plan_service(request)
        return response
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Study plan generation failed: {str(e)}"
        )

@router.post("", response_model=StudyPlanResponse, status_code=status.HTTP_201_CREATED)
def save_plan(plan_in: StudyPlanSaveRequest, db: Session = Depends(get_db)):
    plan = plan_service.save_study_plan(db, plan_in)
    return plan

@router.get("", response_model=List[StudyPlanResponse])
def get_plans(db: Session = Depends(get_db)):
    plans = plan_service.get_study_plans(db)
    return plans

@router.get("/{plan_id}")
def get_plan(plan_id: int, db: Session = Depends(get_db)):
    plan = plan_service.get_study_plan_by_id(db, plan_id)
    if not plan:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Study plan {plan_id} not found."
        )
    return {
        "id": plan.id,
        "title": plan.title,
        "student_name": plan.student_name,
        "exam_date": plan.exam_date,
        "daily_hours": plan.daily_hours,
        "total_tasks": plan.total_tasks,
        "preferred_days": json.loads(plan.preferred_days) if plan.preferred_days else [],
        "created_at": plan.created_at,
        "tasks": [TaskResponse.model_validate(t) for t in plan.tasks]
    }

@router.get("/{plan_id}/export/ical")
def export_plan_ical(plan_id: int, db: Session = Depends(get_db)):
    from fastapi.responses import Response
    from datetime import datetime, timedelta, timezone

    plan = plan_service.get_study_plan_by_id(db, plan_id)
    if not plan:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Study plan {plan_id} not found."
        )

    lines = [
        "BEGIN:VCALENDAR",
        "VERSION:2.0",
        "PRODID:-//StudyPilot AI//Study Planner//EN",
        "CALSCALE:GREGORIAN",
        "METHOD:PUBLISH",
        f"X-WR-CALNAME:{plan.title or 'Study Schedule'}",
    ]

    for task in plan.tasks:
        try:
            date_clean = task.date.replace("-", "")
            start_time_clean = (task.start_time or "10:00").replace(":", "")
            dt_start_str = f"{date_clean}T{start_time_clean}00"
            start_dt = datetime.strptime(f"{task.date} {task.start_time or '10:00'}", "%Y-%m-%d %H:%M")
            end_dt = start_dt + timedelta(minutes=task.duration or 60)
            dt_end_str = end_dt.strftime("%Y%m%dT%H%M00")
        except Exception:
            dt_start_str = f"{task.date.replace('-', '')}T100000"
            dt_end_str = f"{task.date.replace('-', '')}T110000"

        lines.extend([
            "BEGIN:VEVENT",
            f"UID:studypilot-task-{task.id}@studypilot.ai",
            f"DTSTAMP:{datetime.now(timezone.utc).strftime('%Y%m%dT%H%M%SZ')}",
            f"DTSTART:{dt_start_str}",
            f"DTEND:{dt_end_str}",
            f"SUMMARY:{task.title}",
            f"DESCRIPTION:Subject: {task.subject}\\nTopic: {task.topic}\\n{task.description or ''}",
            "STATUS:CONFIRMED",
            "END:VEVENT",
        ])

    lines.append("END:VCALENDAR")
    ical_content = "\r\n".join(lines) + "\r\n"

    filename = f"studypilot_plan_{plan_id}.ics"
    return Response(
        content=ical_content,
        media_type="text/calendar",
        headers={"Content-Disposition": f'attachment; filename="{filename}"'}
    )

