from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from app.database import get_db
from app.schemas.assistant import ChatMessageRequest, ChatMessageResponse
from app.services import assistant_service

router = APIRouter(prefix="/assistant", tags=["Assistant"])

@router.post("/chat", response_model=ChatMessageResponse)
async def assistant_chat(request: ChatMessageRequest, db: Session = Depends(get_db)):
    """
    Send a message to the StudyPilot Alexa+ AI assistant.
    Supports intent-based responses, Gemini LLM fallback, and rich card data.
    """
    response = await assistant_service.process_assistant_message(db, request)
    return response
