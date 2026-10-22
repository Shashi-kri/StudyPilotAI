from fastapi import APIRouter
from app.api.health import router as health_router
from app.api.dashboard import router as dashboard_router
from app.api.tasks import router as tasks_router
from app.api.plans import router as plans_router
from app.api.assistant import router as assistant_router

api_router = APIRouter(prefix="/api")
api_router.include_router(health_router)
api_router.include_router(dashboard_router)
api_router.include_router(tasks_router)
api_router.include_router(plans_router)
api_router.include_router(assistant_router)
