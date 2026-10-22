from datetime import datetime, timezone
from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from sqlalchemy import text
from app.database import get_db
from app.config import settings

router = APIRouter(tags=["Health"])

@router.get("/health")
def health_check(db: Session = Depends(get_db)):
    db_status = "healthy"
    try:
        db.execute(text("SELECT 1"))
    except Exception as e:
        db_status = f"unhealthy: {str(e)}"

    return {
        "status": "healthy" if db_status == "healthy" else "degraded",
        "timestamp": datetime.now(timezone.utc).isoformat(),
        "database": db_status,
        "service": settings.PROJECT_NAME,
        "environment": settings.ENVIRONMENT,
        "ai_provider": settings.AI_PROVIDER,
        "mock_mode": settings.AI_PROVIDER == "mock" or (not settings.GEMINI_API_KEY and not settings.OPENAI_API_KEY)
    }
