import logging
from fastapi import APIRouter, Body, Depends, HTTPException, status
from typing import Dict, Any, Optional
from sqlalchemy.orm import Session
from ...db.session import get_db
from ...agents.llm_agent import llm_agent

logger = logging.getLogger("cloudsense.api.chat")
router = APIRouter(prefix="/chat", tags=["Conversational FinOps Assistant"])

@router.post("")
@router.post("/query")
def chat_query(payload: Dict[str, Any] = Body(...), db: Session = Depends(get_db)):
    """Interactive FinOps query powered by real LLMs (Gemini, OpenAI, Groq, Bedrock)
    with live RAG context injection from AWS telemetry and pre-trained ML models."""
    message = payload.get("message", "")
    if not message.strip():
        raise HTTPException(status_code=400, detail="Query message cannot be empty.")

    account_id = payload.get("account_id") or payload.get("accountId")
    provider = payload.get("provider")
    api_key = payload.get("api_key") or payload.get("apiKey")
    model = payload.get("model")

    response_data = llm_agent.process_query(
        query=message,
        account_id=account_id,
        provider_override=provider,
        api_key_override=api_key,
        model_override=model
    )
    return response_data

@router.get("/config")
def get_llm_config(db: Session = Depends(get_db)):
    """Retrieve current LLM configuration and status (API key is masked for security)."""
    cfg = llm_agent.get_configured_llm(db=db)
    raw_key = cfg.get("api_key", "")
    masked_key = ""
    if raw_key:
        masked_key = f"{raw_key[:4]}...{raw_key[-4:]}" if len(raw_key) > 8 else "****"

    return {
        "provider": cfg.get("provider", "gemini"),
        "model": cfg.get("model", "gemini-1.5-flash"),
        "base_url": cfg.get("base_url", ""),
        "is_configured": cfg.get("is_configured", False),
        "api_key_masked": masked_key
    }

@router.post("/config")
def save_llm_config(payload: Dict[str, Any] = Body(...), db: Session = Depends(get_db)):
    """Save and test LLM provider settings (Google Gemini, OpenAI, Groq, AWS Bedrock)."""
    provider = payload.get("provider", "gemini").lower()
    api_key = payload.get("api_key", "").strip()
    model = payload.get("model", "").strip()
    base_url = payload.get("base_url", "").strip()

    if not model:
        if provider == "gemini":
            model = "gemini-1.5-flash"
        elif provider == "groq":
            model = "llama-3.3-70b-versatile"
        elif provider == "bedrock":
            model = "anthropic.claude-3-sonnet-20240229-v1:0"
        else:
            model = "gpt-4o"

    res = llm_agent.save_configured_llm(
        provider=provider,
        api_key=api_key,
        model=model,
        base_url=base_url
    )

    return {
        "success": True,
        "message": f"Successfully updated LLM provider to {provider.upper()} ({model}).",
        "provider": provider,
        "model": model,
        "is_configured": bool(api_key)
    }
