from datetime import datetime, timezone
from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from sqlalchemy import text
from app.database import get_db
from app.config import settings
from app.services.ai_service import get_ai_status

router = APIRouter(tags=["Health"])

@router.get("/health")
def health_check(db: Session = Depends(get_db)):
    db_status = "healthy"
    try:
        db.execute(text("SELECT 1"))
    except Exception as e:
        db_status = f"unhealthy: {str(e)}"

    ai_status = get_ai_status()

    return {
        "status": "healthy" if db_status == "healthy" else "degraded",
        "timestamp": datetime.now(timezone.utc).isoformat(),
        "database": db_status,
        "service": settings.PROJECT_NAME,
        "environment": settings.ENVIRONMENT,
        "ai_provider": settings.AI_PROVIDER,
        "ai_model_name": settings.AI_MODEL_NAME,
        "configured_provider": settings.AI_PROVIDER,
        "configured_model": settings.AI_MODEL_NAME,
        "live_generation_verified": ai_status["live_generation_verified"],
        "latest_generation_mode": ai_status["latest_generation_mode"],
        "latest_generation_timestamp": ai_status["latest_generation_timestamp"],
        "has_api_key": bool(settings.GEMINI_API_KEY or settings.OPENAI_API_KEY),
        "mock_mode": settings.AI_PROVIDER == "mock" or (not settings.GEMINI_API_KEY and not settings.OPENAI_API_KEY)
    }
