"""
PostgreSQL persistence for role-based chat (doctor / caretaker / CHO).
"""
from __future__ import annotations

import logging
import threading

from app.utils.db_utils import execute, fetchall, rows_to_dicts
from app.utils.chat_ids import decode_chat_user_id

logger = logging.getLogger(__name__)

_chat_tables_ready = False
_chat_lock = threading.Lock()


def ensure_chat_tables() -> None:
    global _chat_tables_ready
    if _chat_tables_ready:
        return
    with _chat_lock:
        if _chat_tables_ready:
            return
        execute(
            """
            CREATE TABLE IF NOT EXISTS chat_messages (
                id SERIAL PRIMARY KEY,
                sender_id BIGINT NOT NULL,
                receiver_id BIGINT NOT NULL,
                sender_role VARCHAR(32) NOT NULL,
                receiver_role VARCHAR(32) NOT NULL,
                message TEXT NOT NULL,
                timestamp TIMESTAMPTZ NOT NULL DEFAULT NOW(),
                is_read BOOLEAN NOT NULL DEFAULT FALSE,
                patient_id INTEGER
            )
            """
        )
        execute(
            "CREATE INDEX IF NOT EXISTS idx_chat_messages_pair ON chat_messages (sender_id, receiver_id, timestamp)"
        )
        execute(
            "CREATE INDEX IF NOT EXISTS idx_chat_messages_pair_rev ON chat_messages (receiver_id, sender_id, timestamp)"
        )
        _chat_tables_ready = True
        logger.info("chat_messages table ensured")


def insert_chat_message(
    sender_id: int,
    receiver_id: int,
    sender_role: str,
    receiver_role: str,
    message: str,
    patient_id: int | None = None,
) -> int:
    ensure_chat_tables()
    return execute(
        """
        INSERT INTO chat_messages
        (sender_id, receiver_id, sender_role, receiver_role, message, patient_id)
        VALUES (?, ?, ?, ?, ?, ?)
        RETURNING id
        """,
        (sender_id, receiver_id, sender_role, receiver_role, message, patient_id),
    )


def get_chat_history(user1: int, user2: int, limit: int = 500) -> list[dict]:
    ensure_chat_tables()
    rows = fetchall(
        """
        SELECT id, sender_id, receiver_id, sender_role, receiver_role, message,
               timestamp, is_read, patient_id
        FROM chat_messages
        WHERE (sender_id = ? AND receiver_id = ?)
           OR (sender_id = ? AND receiver_id = ?)
        ORDER BY timestamp ASC
        LIMIT ?
        """,
        (user1, user2, user2, user1, int(limit)),
    )
    return rows_to_dicts(rows)


def patient_id_from_participants(sender_id: int, receiver_id: int) -> int | None:
    try:
        p1, _ = decode_chat_user_id(sender_id)
        p2, _ = decode_chat_user_id(receiver_id)
        if p1 == p2:
            return p1
    except Exception:
        pass
    return None


def mark_chat_message_read(message_id: int) -> None:
    if message_id <= 0:
        return
    ensure_chat_tables()
    execute("UPDATE chat_messages SET is_read = TRUE WHERE id = ?", (message_id,))
