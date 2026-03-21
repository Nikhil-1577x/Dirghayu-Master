"""
WebSocket chat: /ws/chat/{user_id}

In-memory map user_id -> WebSocket for instant delivery.
Messages are persisted to PostgreSQL; offline users receive history via REST.
"""
from __future__ import annotations

import json
import logging
from datetime import datetime, timezone
from typing import Dict

from fastapi import APIRouter, WebSocket, WebSocketDisconnect

from app.services.chat_service import (
    insert_chat_message,
    mark_chat_message_read,
    patient_id_from_participants,
)
from app.utils.chat_ids import decode_chat_user_id

logger = logging.getLogger(__name__)

router = APIRouter()


def _valid_role_pair(a: str, b: str) -> bool:
    if a == "unknown" or b == "unknown":
        return False
    pair = {a, b}
    return pair == {"doctor", "caretaker"} or pair == {"doctor", "cho"}


class ChatConnectionManager:
    """One active socket per logical chat user id (last connect wins)."""

    def __init__(self) -> None:
        self._connections: Dict[int, WebSocket] = {}

    async def connect(self, user_id: int, websocket: WebSocket) -> None:
        await websocket.accept()
        prev = self._connections.get(user_id)
        if prev is not None and prev is not websocket:
            try:
                await prev.close(code=1000)
            except Exception:
                pass
        self._connections[user_id] = websocket
        logger.info("Chat WS connected user_id=%s", user_id)

    def disconnect(self, user_id: int, websocket: WebSocket) -> None:
        if self._connections.get(user_id) is websocket:
            self._connections.pop(user_id, None)
            logger.info("Chat WS disconnected user_id=%s", user_id)

    async def send_personal_message(self, user_id: int, message: str) -> bool:
        ws = self._connections.get(user_id)
        if ws is None:
            return False
        try:
            await ws.send_text(message)
            return True
        except Exception as exc:
            logger.warning("Chat send failed user_id=%s: %s", user_id, exc)
            self.disconnect(user_id, ws)
            return False


chat_manager = ChatConnectionManager()


@router.websocket("/ws/chat/{user_id}")
async def chat_websocket(websocket: WebSocket, user_id: int):
    await chat_manager.connect(user_id, websocket)
    try:
        while True:
            raw = await websocket.receive_text()
            try:
                payload = json.loads(raw)
            except json.JSONDecodeError:
                await websocket.send_text(
                    json.dumps({"type": "error", "message": "invalid json"})
                )
                continue

            receiver_id = int(payload.get("receiver_id") or 0)
            message = str(payload.get("message") or "").strip()
            if not receiver_id or not message:
                await websocket.send_text(
                    json.dumps(
                        {
                            "type": "error",
                            "message": "receiver_id and non-empty message required",
                        }
                    )
                )
                continue

            try:
                p_sender, sender_role = decode_chat_user_id(user_id)
                p_recv, receiver_role = decode_chat_user_id(receiver_id)
            except ValueError as exc:
                await websocket.send_text(
                    json.dumps({"type": "error", "message": str(exc)})
                )
                continue

            if p_sender != p_recv:
                await websocket.send_text(
                    json.dumps(
                        {
                            "type": "error",
                            "message": "sender and receiver must refer to the same patient context",
                        }
                    )
                )
                continue

            if not _valid_role_pair(sender_role, receiver_role):
                await websocket.send_text(
                    json.dumps(
                        {
                            "type": "error",
                            "message": "chat is only allowed between doctor↔caretaker or doctor↔cho",
                        }
                    )
                )
                continue

            pid = patient_id_from_participants(user_id, receiver_id)
            msg_id = insert_chat_message(
                sender_id=user_id,
                receiver_id=receiver_id,
                sender_role=sender_role,
                receiver_role=receiver_role,
                message=message,
                patient_id=pid,
            )

            ts = datetime.now(timezone.utc).isoformat()
            out = {
                "type": "chat_message",
                "id": msg_id,
                "sender_id": user_id,
                "receiver_id": receiver_id,
                "sender_role": sender_role,
                "receiver_role": receiver_role,
                "message": message,
                "timestamp": ts,
            }
            text = json.dumps(out)
            await websocket.send_text(text)

            delivered = await chat_manager.send_personal_message(receiver_id, text)
            if delivered and msg_id:
                mark_chat_message_read(msg_id)

    except WebSocketDisconnect:
        chat_manager.disconnect(user_id, websocket)
    except Exception as exc:
        logger.exception("Chat WS error user_id=%s: %s", user_id, exc)
        chat_manager.disconnect(user_id, websocket)
