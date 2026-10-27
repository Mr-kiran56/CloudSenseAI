from fastapi import APIRouter, Body
from typing import Dict, Any
from ...agents.assistant import assistant_agent

router = APIRouter(prefix="/chat", tags=["Conversational FinOps Assistant"])

@router.post("")
@router.post("/query")
def chat_query(payload: Dict[str, Any] = Body(...)):
    message = payload.get("message", "")
    context = payload.get("context", {})
    response_data = assistant_agent.process_query(message, context)
    return response_data
