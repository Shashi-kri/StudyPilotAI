import asyncio
import json
import logging
from datetime import datetime, date, timedelta, timezone
from typing import List, Dict, Any, Optional
import httpx

from app.config import settings
from app.schemas.plan import PlanGenerateRequest, PlanGenerateResponse, PlannedTaskItem

logger = logging.getLogger(__name__)

# ---------------------------------------------------------------------------
# Runtime AI Verification & Mode Tracking
# ---------------------------------------------------------------------------
_live_generation_verified: bool = False
_latest_generation_mode: Optional[str] = None  # "llm", "gemini", "openai", "deterministic_fallback", "mock"
_latest_generation_timestamp: Optional[str] = None

def get_ai_status() -> Dict[str, Any]:
    """Returns runtime AI status distinguishing configuration from verified live generation."""
    return {
        "live_generation_verified": _live_generation_verified,
        "latest_generation_mode": _latest_generation_mode,
        "latest_generation_timestamp": _latest_generation_timestamp,
    }

def record_generation_result(mode: str) -> None:
    """Records whether a generation succeeded via live LLM or fell back to deterministic mock."""
    global _live_generation_verified, _latest_generation_mode, _latest_generation_timestamp
    _latest_generation_mode = mode
    _latest_generation_timestamp = datetime.now(timezone.utc).isoformat()
    if mode in ("llm", "gemini", "openai"):
        _live_generation_verified = True

WEEKDAY_NAMES = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"]

def get_available_dates(start_date: date, end_date: date, preferred_days: List[str]) -> List[date]:
    """Return all dates between start_date and end_date matching preferred weekdays."""
    dates = []
    curr = start_date
    pref_set = set(preferred_days)
    while curr < end_date:
        weekday_name = WEEKDAY_NAMES[curr.weekday()]
        if weekday_name in pref_set:
            dates.append(curr)
        curr += timedelta(days=1)
    return dates

def generate_deterministic_plan(req: PlanGenerateRequest, fallback_reason: Optional[str] = None) -> PlanGenerateResponse:
    today = date.today()
    try:
        exam_d = datetime.strptime(req.exam_date, "%Y-%m-%d").date()
    except ValueError:
        exam_d = today + timedelta(days=14)

    if exam_d <= today:
        exam_d = today + timedelta(days=7)

    available_dates = get_available_dates(today, exam_d, req.preferred_days)
    if not available_dates:
        # Fallback to all dates if preferred days filter was empty
        curr = today
        while curr < exam_d:
            available_dates.append(curr)
            curr += timedelta(days=1)

    total_study_days = len(available_dates)
    total_capacity_hours = total_study_days * req.daily_hours

    # Compile topics with weights
    weighted_items = []
    diff_multipliers = {"easy": 45, "medium": 60, "hard": 90}
    prio_multipliers = {"low": 0.8, "medium": 1.0, "high": 1.25}

    for sub in req.subjects:
        base_dur = diff_multipliers.get(sub.difficulty.lower(), 60)
        for topic in sub.topics:
            prio = req.topic_priority.get(topic, "medium").lower()
            p_mult = prio_multipliers.get(prio, 1.0)
            target_dur = int(round(base_dur * p_mult / 15.0) * 15)  # Round to nearest 15 mins
            target_dur = max(30, min(180, target_dur))
            
            weighted_items.append({
                "subject": sub.name,
                "topic": topic,
                "difficulty": sub.difficulty,
                "priority": prio,
                "duration": target_dur,
                "is_revision": False
            })

    # Sort topics: hard & high priority first for deep focus
    priority_order = {"high": 3, "medium": 2, "low": 1}
    diff_order = {"hard": 3, "medium": 2, "easy": 1}
    weighted_items.sort(
        key=lambda x: (priority_order.get(x["priority"], 2), diff_order.get(x["difficulty"], 2)),
        reverse=True
    )

    # Estimate required hours
    total_needed_minutes = sum(item["duration"] for item in weighted_items)
    revision_reserve_minutes = 120 if req.is_revision_prioritized and total_study_days >= 3 else 0
    total_required_hours = (total_needed_minutes + revision_reserve_minutes) / 60.0

    is_feasible = total_required_hours <= total_capacity_hours
    feasibility_notes = None
    if not is_feasible:
        shortfall = round(total_required_hours - total_capacity_hours, 1)
        feasibility_notes = (
            f"Note: Total required study time ({round(total_required_hours, 1)} hrs) exceeds "
            f"your schedule capacity ({round(total_capacity_hours, 1)} hrs) across {total_study_days} days by {shortfall} hrs. "
            "High priority topics have been scheduled first. Consider increasing daily hours or extending your prep window."
        )

    # Distribute topics onto available days
    daily_capacity_mins = int(req.daily_hours * 60)
    day_allocations: Dict[date, List[Dict[str, Any]]] = {d: [] for d in available_dates}
    day_used_mins: Dict[date, int] = {d: 0 for d in available_dates}

    # Reserve the final study day for comprehensive revision if requested
    active_dates = list(available_dates)
    revision_date = None
    if req.is_revision_prioritized and len(active_dates) >= 2:
        revision_date = active_dates.pop()  # Keep last day before exam for revision

    date_idx = 0
    for item in weighted_items:
        if not active_dates:
            active_dates = list(available_dates)
        
        # Find best date that has capacity
        assigned = False
        start_search = date_idx
        for _ in range(len(active_dates)):
            d = active_dates[date_idx]
            if day_used_mins[d] + item["duration"] <= daily_capacity_mins:
                day_allocations[d].append(item)
                day_used_mins[d] += item["duration"]
                assigned = True
                date_idx = (date_idx + 1) % len(active_dates)
                break
            date_idx = (date_idx + 1) % len(active_dates)

        if not assigned:
            # Overfill the least loaded date
            min_day = min(active_dates, key=lambda d: day_used_mins[d])
            day_allocations[min_day].append(item)
            day_used_mins[min_day] += item["duration"]

    # Add final revision sessions on the reserved day or spread across last days
    if revision_date:
        for sub in req.subjects:
            day_allocations[revision_date].append({
                "subject": sub.name,
                "topic": "Final Exam Practice & Mock Test",
                "difficulty": "medium",
                "priority": "high",
                "duration": min(90, daily_capacity_mins),
                "is_revision": True
            })
            day_used_mins[revision_date] += min(90, daily_capacity_mins)
            if day_used_mins[revision_date] >= daily_capacity_mins:
                break

    # Build PlannedTaskItems with staggered, non-overlapping start times
    planned_tasks: List[PlannedTaskItem] = []
    start_time_options = ["09:00", "11:00", "14:00", "16:00", "18:00", "20:00"]

    for d in sorted(day_allocations.keys()):
        items_for_day = day_allocations[d]
        curr_time_min = 9 * 60 # 09:00 AM in minutes
        for item in items_for_day:
            hh = curr_time_min // 60
            mm = curr_time_min % 60
            start_str = f"{hh:02d}:{mm:02d}"

            if item.get("is_revision"):
                title = f"Comprehensive Revision: {item['subject']}"
                desc = f"Solve practice questions, mock paper drills, and formula summaries for {item['subject']}."
            else:
                title = f"Study {item['topic']}"
                desc = f"Deep dive into {item['topic']} ({item['subject']}). Core concepts, problem patterns, and key proofs."

            planned_tasks.append(PlannedTaskItem(
                date=d.strftime("%Y-%m-%d"),
                start_time=start_str,
                subject=item["subject"],
                topic=item["topic"],
                title=title,
                duration=item["duration"],
                priority=item["priority"],
                description=desc
            ))

            # Stagger next task with 15-min break
            curr_time_min += item["duration"] + 15

    total_hours_planned = round(sum(t.duration for t in planned_tasks) / 60.0, 1)

    student_title = f"{req.student_name}'s " if req.student_name else ""
    first_subject = req.subjects[0].name if req.subjects else "Exam"
    plan_title = f"{student_title}{first_subject} Mastery Study Plan"

    return PlanGenerateResponse(
        plan_title=plan_title,
        student_name=req.student_name,
        exam_date=req.exam_date,
        daily_hours=req.daily_hours,
        total_study_days=total_study_days,
        total_hours_planned=total_hours_planned,
        total_tasks_count=len(planned_tasks),
        is_workload_feasible=is_feasible,
        feasibility_notes=f"[Engine Notice: {fallback_reason}] " + (feasibility_notes or "") if fallback_reason else feasibility_notes,
        tasks=planned_tasks,
        generation_mode="mock"
    )

async def generate_study_plan_service(req: PlanGenerateRequest) -> PlanGenerateResponse:
    """Entry point for study plan generation. Uses LLM if configured; otherwise uses deterministic generator."""
    if settings.AI_PROVIDER == "gemini" and settings.GEMINI_API_KEY:
        logger.info(f"Initiating study plan generation with Gemini (model={settings.AI_MODEL_NAME})")
        try:
            res = await _generate_with_gemini(req)
            record_generation_result("llm")
            return res
        except Exception as e:
            fallback_msg = f"Gemini generation error ({type(e).__name__}). Operating in deterministic fallback mode."
            logger.warning(f"{fallback_msg} Details: {e}")
            record_generation_result("deterministic_fallback")
            return generate_deterministic_plan(req, fallback_reason=fallback_msg)
    elif settings.AI_PROVIDER == "openai" and settings.OPENAI_API_KEY:
        logger.info("Initiating study plan generation with OpenAI")
        try:
            res = await _generate_with_openai(req)
            record_generation_result("llm")
            return res
        except Exception as e:
            fallback_msg = f"OpenAI generation error ({type(e).__name__}). Operating in deterministic fallback mode."
            logger.warning(f"{fallback_msg} Details: {e}")
            record_generation_result("deterministic_fallback")
            return generate_deterministic_plan(req, fallback_reason=fallback_msg)

    # Deterministic mock mode
    logger.info("Generating plan using deterministic mock engine (AI_PROVIDER=mock or API keys unset)")
    record_generation_result("mock")
    return generate_deterministic_plan(req)

async def _generate_with_gemini(req: PlanGenerateRequest) -> PlanGenerateResponse:
    url = f"https://generativelanguage.googleapis.com/v1beta/models/{settings.AI_MODEL_NAME}:generateContent?key={settings.GEMINI_API_KEY}"
    prompt = f"""
You are an expert academic study planner for StudyPilot AI.
Generate a structured study plan as a strictly valid JSON object matching this schema:
{{
  "plan_title": "string",
  "total_study_days": integer,
  "total_hours_planned": float,
  "is_workload_feasible": boolean,
  "feasibility_notes": "string or null",
  "tasks": [
    {{
      "date": "YYYY-MM-DD",
      "start_time": "HH:MM",
      "subject": "string",
      "topic": "string",
      "title": "string",
      "duration": integer (minutes),
      "priority": "low"|"medium"|"high",
      "description": "string"
    }}
  ]
}}

Inputs:
- Today: {date.today().strftime('%Y-%m-%d')}
- Exam Date: {req.exam_date}
- Daily Available Hours: {req.daily_hours}
- Preferred Study Days: {req.preferred_days}
- Subjects & Topics: {req.model_dump()['subjects']}
- Topic Priorities: {req.topic_priority}
- Break Preference: {req.break_preferences}

Rules:
1. Do not schedule sessions before today.
2. No overlapping start times on the same date.
3. Reserve final 1-2 days before the exam date for revision.
4. Output raw JSON only.
"""
    payload = {
        "contents": [{"parts": [{"text": prompt}]}],
        "generationConfig": {"temperature": 0.2, "response_mime_type": "application/json"}
    }
    for attempt in range(2):
        async with httpx.AsyncClient(timeout=60.0) as client:
            resp = await client.post(url, json=payload)
            if resp.status_code == 503 and attempt == 0:
                logger.info("Gemini 503 high-demand spike. Retrying in 1.5s...")
                await asyncio.sleep(1.5)
                continue
            resp.raise_for_status()
            data = resp.json()
            parts = data.get("candidates", [{}])[0].get("content", {}).get("parts", [])
            raw_text = "".join(p.get("text", "") for p in parts if "text" in p)
            parsed = json.loads(raw_text)
        
        tasks = [PlannedTaskItem(**t) for t in parsed["tasks"]]
        return PlanGenerateResponse(
            plan_title=parsed.get("plan_title", "Custom Study Plan"),
            student_name=req.student_name,
            exam_date=req.exam_date,
            daily_hours=req.daily_hours,
            total_study_days=parsed.get("total_study_days", len(tasks)),
            total_hours_planned=parsed.get("total_hours_planned", round(sum(t.duration for t in tasks)/60.0, 1)),
            total_tasks_count=len(tasks),
            is_workload_feasible=parsed.get("is_workload_feasible", True),
            feasibility_notes=parsed.get("feasibility_notes"),
            tasks=tasks,
            generation_mode="llm",
            model_name=settings.AI_MODEL_NAME
        )

async def _generate_with_openai(req: PlanGenerateRequest) -> PlanGenerateResponse:
    url = "https://api.openai.com/v1/chat/completions"
    headers = {"Authorization": f"Bearer {settings.OPENAI_API_KEY}"}
    prompt = f"Generate study plan in JSON. Today is {date.today().strftime('%Y-%m-%d')}, Exam is {req.exam_date}, Daily hours: {req.daily_hours}. Subjects: {req.model_dump()['subjects']}."
    payload = {
        "model": "gpt-4o-mini",
        "messages": [
            {"role": "system", "content": "You are StudyPilot AI study planner. Output JSON only."},
            {"role": "user", "content": prompt}
        ],
        "response_format": {"type": "json_object"}
    }
    async with httpx.AsyncClient(timeout=30.0) as client:
        resp = await client.post(url, json=payload, headers=headers)
        resp.raise_for_status()
        parsed = resp.json()
        content = json.loads(parsed["choices"][0]["message"]["content"])
        tasks = [PlannedTaskItem(**t) for t in content["tasks"]]
        return PlanGenerateResponse(
            plan_title=content.get("plan_title", "Personalized Plan"),
            student_name=req.student_name,
            exam_date=req.exam_date,
            daily_hours=req.daily_hours,
            total_study_days=content.get("total_study_days", len(tasks)),
            total_hours_planned=round(sum(t.duration for t in tasks)/60.0, 1),
            total_tasks_count=len(tasks),
            is_workload_feasible=content.get("is_workload_feasible", True),
            feasibility_notes=content.get("feasibility_notes"),
            tasks=tasks,
            generation_mode="llm",
            model_name="gpt-4o-mini"
        )
