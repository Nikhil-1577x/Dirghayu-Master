"""REST helpers for chat history."""
from __future__ import annotations

from fastapi import APIRouter, Query

from app.services.chat_service import get_chat_history

# Under /api/chat so production SPA catch-all /{path} never shadows this route.
router = APIRouter(prefix="/api/chat", tags=["chat"])


@router.get("/history/{user1}/{user2}")
def chat_history(
    user1: int,
    user2: int,
    limit: int = Query(500, ge=1, le=2000),
):
    messages = get_chat_history(user1, user2, limit=limit)
    return {"messages": messages}
