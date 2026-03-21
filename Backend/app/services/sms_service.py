"""
sms_service.py – Twilio SMS alerts for missed doses (IoT hardware).

Sends SMS (not WhatsApp) to assigned family contact when a dose is missed.
Credentials from environment: TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, TWILIO_PHONE_NUMBER.
"""
from __future__ import annotations

import logging
import re
from typing import Optional

from twilio.rest import Client

from app.config import settings

logger = logging.getLogger(__name__)


def _normalize_phone(phone: Optional[str]) -> Optional[str]:
    """
    Normalize to E.164 for Twilio.
    Accepts +91XXXXXXXXXX, 91XXXXXXXXXX, or 10-digit Indian numbers.
    """
    if not phone or not isinstance(phone, str):
        return None
    digits = re.sub(r"\D", "", phone)
    if len(digits) == 10 and digits.startswith(("6", "7", "8", "9")):
        return f"+91{digits}"
    if len(digits) == 12 and digits.startswith("91"):
        return f"+{digits}"
    if phone.strip().startswith("+"):
        return phone.strip()
    if digits:
        return f"+{digits}"
    return None


def send_sms(to_number: str, message: str) -> bool:
    """
    Send an SMS via Twilio.

    Args:
        to_number: Recipient phone (will be normalized to E.164).
        message: SMS body.

    Returns:
        True on success, False on failure or if Twilio is not configured.
    """
    if not settings.TWILIO_ACCOUNT_SID or settings.TWILIO_ACCOUNT_SID.startswith("ACxx"):
        logger.warning("Twilio not configured – skipping SMS send to %s", to_number)
        return False
    if not settings.TWILIO_PHONE_NUMBER:
        logger.warning("TWILIO_PHONE_NUMBER not set – skipping SMS send")
        return False

    normalized = _normalize_phone(to_number)
    if not normalized:
        logger.error("Invalid phone number for SMS: %s", to_number)
        return False

    try:
        client = Client(settings.TWILIO_ACCOUNT_SID, settings.TWILIO_AUTH_TOKEN)
        client.messages.create(
            from_=settings.TWILIO_PHONE_NUMBER,
            to=normalized,
            body=message,
        )
        logger.info("SMS sent to %s", normalized)
        return True
    except Exception as exc:
        logger.error("Twilio SMS error: %s", exc)
        return False
