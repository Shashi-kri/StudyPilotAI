from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from app.database import get_db
from app.schemas.assistant import ChatMessageRequest, ChatMessageResponse
from app.services import assistant_service

router = APIRouter(prefix="/assistant", tags=["Assistant"])

@router.post("/chat", response_model=ChatMessageResponse)
def assistant_chat(request: ChatMessageRequest, db: Session = Depends(get_db)):
    response = assistant_service.process_assistant_message(db, request)
    return response
