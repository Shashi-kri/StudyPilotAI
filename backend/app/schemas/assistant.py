from typing import List, Optional, Any, Dict
from pydantic import BaseModel

class ChatMessageRequest(BaseModel):
    message: str
    conversation_history: Optional[List[Dict[str, str]]] = None

class AssistantAction(BaseModel):
    label: str
    action_type: str # "navigate", "create_task", "view_plan", "refresh"
    payload: Optional[Dict[str, Any]] = None

class ChatMessageResponse(BaseModel):
    reply: str
    card_type: Optional[str] = None  # "plan_preview", "task_list", "metric_card", "recommendation", "info"
    card_data: Optional[Dict[str, Any]] = None
    suggested_actions: Optional[List[AssistantAction]] = None
    generation_mode: str = "mock"
