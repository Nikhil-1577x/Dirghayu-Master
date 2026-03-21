"""
Stable integer IDs for chat participants: patient context + role.
Format: CHAT_ID_BASE * role_code + patient_id
"""
from __future__ import annotations

CHAT_ID_BASE = 100_000_000

ROLE_TO_CODE: dict[str, int] = {"doctor": 1, "caretaker": 2, "cho": 3}
CODE_TO_ROLE: dict[int, str] = {1: "doctor", 2: "caretaker", 3: "cho"}


def chat_user_id(patient_id: int, role: str) -> int:
    key = role.lower().strip()
    code = ROLE_TO_CODE.get(key)
    if not code:
        raise ValueError(f"Invalid chat role: {role}")
    if patient_id < 0 or patient_id >= CHAT_ID_BASE:
        raise ValueError(f"patient_id out of range: {patient_id}")
    return CHAT_ID_BASE * code + patient_id


def decode_chat_user_id(uid: int) -> tuple[int, str]:
    if uid < 0:
        raise ValueError("Invalid user id")
    code = uid // CHAT_ID_BASE
    patient_id = uid % CHAT_ID_BASE
    role = CODE_TO_ROLE.get(code, "unknown")
    return patient_id, role
