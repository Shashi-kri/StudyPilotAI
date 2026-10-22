from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.config import settings
from app.database import init_db
from app.api import api_router

@asynccontextmanager
async def lifespan(app: FastAPI):
    # Initialize database tables and initial seed data if empty
    init_db()
    yield

app = FastAPI(
    title=settings.PROJECT_NAME,
    description="Intelligent AI-powered study planning and exam preparation companion.",
    version="1.0.0",
    lifespan=lifespan
)

# Configure CORS
origins = settings.cors_origins
if not origins:
    origins = ["*"]

app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(api_router)

@app.get("/")
def root():
    return {
        "service": settings.PROJECT_NAME,
        "version": "1.0.0",
        "documentation": "/docs",
        "health": "/api/health",
        "dashboard": "/api/dashboard"
    }

if __name__ == "__main__":
    import uvicorn
    uvicorn.run("app.main:app", host=settings.HOST, port=settings.PORT, reload=settings.DEBUG)
