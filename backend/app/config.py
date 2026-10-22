import os
from typing import List
from pydantic_settings import BaseSettings, SettingsConfigDict

class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    PROJECT_NAME: str = "StudyPilot AI"
    ENVIRONMENT: str = "development"
    DEBUG: bool = True
    PORT: int = 8000
    HOST: str = "127.0.0.1"
    DATABASE_URL: str = "sqlite:///./studypilot.db"
    
    # LLM Settings
    AI_PROVIDER: str = "mock"  # "mock", "gemini", "openai", "anthropic"
    GEMINI_API_KEY: str = ""
    OPENAI_API_KEY: str = ""
    ANTHROPIC_API_KEY: str = ""
    AI_MODEL_NAME: str = "gemini-1.5-flash"

    # Alexa Skills Kit
    ALEXA_SKILL_ID: str = ""  # Set this from Alexa Developer Console
    ALEXA_VERIFY_REQUESTS: bool = True  # Disable only for local testing
    
    # CORS
    ALLOWED_ORIGINS: str = "http://localhost:5173,http://127.0.0.1:5173,http://localhost:3000"

    @property
    def cors_origins(self) -> List[str]:
        return [origin.strip() for origin in self.ALLOWED_ORIGINS.split(",") if origin.strip()]

settings = Settings()
