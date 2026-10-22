from typing import List, Optional, Any, Dict
from pydantic import BaseModel, Field

class ChatMessageRequest(BaseModel):
    message: str = Field(..., min_length=1, max_length=2000)
    conversation_history: Optional[List[Dict[str, str]]] = Field(
        default=None,
        description="Recent conversation turns as [{role: 'user'|'assistant', content: '...'}]"
    )
    session_id: Optional[str] = Field(
        default=None,
        description="Optional session ID for multi-turn conversation continuity"
    )

class AssistantAction(BaseModel):
    label: str
    action_type: str  # "navigate", "create_task", "save_plan", "chat_query", "info"
    payload: Optional[Dict[str, Any]] = None

class ChatMessageResponse(BaseModel):
    reply: str
    card_type: Optional[str] = None  # "plan_preview", "task_list", "metric_card", "recommendation", "task_preview", "info"
    card_data: Optional[Dict[str, Any]] = None
    suggested_actions: Optional[List[AssistantAction]] = None
    generation_mode: str = "mock"  # "mock", "gemini", "openai", "anthropic"
    intent: Optional[str] = None   # Detected intent for debugging/analytics
