"""
iot_service.py - PostgreSQL-backed IoT dispenser integration helpers.
"""
from __future__ import annotations

import logging
import os
import threading
from datetime import datetime
from typing import Any

import requests

from app.utils.db_utils import execute, fetchall, fetchone, rows_to_dicts

logger = logging.getLogger(__name__)

_iot_tables_ready = False
_iot_tables_lock = threading.Lock()


def ensure_iot_tables() -> None:
    global _iot_tables_ready
    if _iot_tables_ready:
        return
    with _iot_tables_lock:
        if _iot_tables_ready:
            return
        execute(
            """
            CREATE TABLE IF NOT EXISTS hardware_dose_logs (
                id SERIAL PRIMARY KEY,
                patient_id INTEGER NOT NULL,
                timestamp TIMESTAMPTZ NOT NULL DEFAULT NOW(),
                medication_name TEXT NOT NULL,
                status TEXT NOT NULL,
                source TEXT NOT NULL DEFAULT 'hardware',
                sms_sent BOOLEAN NOT NULL DEFAULT FALSE
            )
            """
        )
        try:
            execute(
                "ALTER TABLE hardware_dose_logs ADD COLUMN sms_sent BOOLEAN NOT NULL DEFAULT FALSE"
            )
        except Exception as e:
            if "already exists" not in str(e).lower() and "duplicate" not in str(e).lower():
                logger.warning("Could not add sms_sent column (may already exist): %s", e)
        execute(
            """
            CREATE TABLE IF NOT EXISTS hardware_alerts (
                id SERIAL PRIMARY KEY,
                patient_id INTEGER NOT NULL,
                timestamp TIMESTAMPTZ NOT NULL DEFAULT NOW(),
                alert_type TEXT NOT NULL,
                message TEXT NOT NULL,
                severity TEXT NOT NULL
            )
            """
        )
        _iot_tables_ready = True


def _pick_medication_name_by_slot(patient_id: int, slot: int) -> str:
    meds = rows_to_dicts(
        fetchall(
            "SELECT name FROM medications WHERE patient_id = ? ORDER BY id ASC",
            (patient_id,),
        )
    )
    if not meds:
        return f"Hardware Dose {slot}"
    idx = max(0, min(len(meds) - 1, slot - 1))
    return str(meds[idx]["name"])


def _send_missed_dose_sms(log_id: int, patient_id: int, medication_name: str) -> None:
    """
    Background helper: send SMS to family_phone when dose is missed.
    Marks sms_sent=True on success. Does not block or crash on failure.
    """
    try:
        from app.services.sms_service import send_sms
        from app.config import settings

        patient = fetchone("SELECT name, family_phone FROM patients WHERE id = ?", (patient_id,))
        # Use SMS_DEFAULT_RECIPIENT when set (overrides patient family_phone)
        to_number = settings.SMS_DEFAULT_RECIPIENT.strip() if settings.SMS_DEFAULT_RECIPIENT else None
        if not to_number and patient:
            to_number = patient.get("family_phone")
        if not to_number:
            logger.debug("No family_phone or SMS_DEFAULT_RECIPIENT for patient %d – skipping SMS", patient_id)
            return

        patient_name = (patient or {}).get("name") or "Patient"
        from app.utils.time_utils import utcnow
        time_str = utcnow().strftime("%Y-%m-%d %H:%M UTC")
        message = (
            f"Alert: Dose missed for {patient_name} at {time_str}. "
            f"Please take necessary action."
        )
        sent = send_sms(to_number, message)
        if sent:
            execute(
                "UPDATE hardware_dose_logs SET sms_sent = TRUE WHERE id = ?",
                (log_id,),
            )
    except Exception as exc:
        logger.error("SMS send failed for log %d: %s", log_id, exc)


def ingest_hardware_event(patient_id: int, slot: int, status: str) -> dict[str, Any]:
    ensure_iot_tables()
    normalized = str(status or "").strip().lower()
    mapped = "error"
    if normalized in {"taken", "dispensed"}:
        mapped = "dispensed"
    elif normalized in {"missed"}:
        mapped = "missed"

    med_name = _pick_medication_name_by_slot(patient_id, slot)
    row_id = execute(
        """
        INSERT INTO hardware_dose_logs (patient_id, medication_name, status, source)
        VALUES (?, ?, ?, 'hardware')
        RETURNING id
        """,
        (patient_id, med_name, mapped),
    )

    # Non-blocking: trigger SMS for missed dose (only once per log via sms_sent)
    if mapped == "missed" and row_id:
        t = threading.Thread(
            target=_send_missed_dose_sms,
            args=(row_id, patient_id, med_name),
            daemon=True,
        )
        t.start()

    alert_row: dict[str, Any] | None = None
    if mapped in {"missed", "error"}:
        severity = "critical" if mapped == "missed" else "warning"
        alert_id = execute(
            """
            INSERT INTO hardware_alerts (patient_id, alert_type, message, severity, timestamp)
            VALUES (?, ?, ?, ?, NOW())
            RETURNING id
            """,
            (
                patient_id,
                f"HARDWARE_{mapped.upper()}",
                f"{med_name}: hardware reported {mapped}.",
                severity,
            ),
        )
        alert_row = {
            "id": alert_id,
            "patient_id": patient_id,
            "timestamp": datetime.utcnow().isoformat(),
            "alert_type": f"HARDWARE_{mapped.upper()}",
            "message": f"{med_name}: hardware reported {mapped}.",
            "severity": severity,
        }

    return {
        "id": row_id,
        "patient_id": patient_id,
        "slot": slot,
        "medication_name": med_name,
        "status": mapped,
        "timestamp": datetime.utcnow().isoformat(),
        "alert": alert_row,
    }


def get_dispenser_status(patient_id: int) -> dict[str, Any]:
    ensure_iot_tables()
    feed_url = os.getenv("IOT_FEED_URL", "http://127.0.0.1:3000/data")

    latest_dispensed = fetchone(
        """
        SELECT timestamp, medication_name
        FROM hardware_dose_logs
        WHERE patient_id = ? AND status = 'dispensed'
        ORDER BY timestamp DESC
        LIMIT 1
        """,
        (patient_id,),
    )
    next_med = fetchone(
        """
        SELECT name, schedule_time
        FROM medications
        WHERE patient_id = ?
        ORDER BY schedule_time ASC, id ASC
        LIMIT 1
        """,
        (patient_id,),
    )

    payload: dict[str, Any] = {
        "patient_id": patient_id,
        "status": "offline",
        "last_dispensed_time": latest_dispensed["timestamp"] if latest_dispensed else None,
        "last_medication_name": latest_dispensed["medication_name"] if latest_dispensed else None,
        "next_dose": f"{next_med['name']} @ {next_med['schedule_time']}" if next_med else None,
        "device_status": "offline",
        "slot": None,
        "rtc_time": None,
        "scheduled_time": None,
        "alert": False,
        "last_event": "NONE",
    }
    try:
        r = requests.get(feed_url, timeout=2.5)
        r.raise_for_status()
        data = r.json()
        alert_on = bool(data.get("alert"))
        payload.update(
            {
                "status": "alert" if alert_on else "connected",
                "device_status": "connected",
                "slot": int(data.get("dose")) if data.get("dose") is not None else None,
                "rtc_time": data.get("currentTime"),
                "scheduled_time": data.get("setTime"),
                "alert": alert_on,
                "last_event": str(data.get("lastEvent") or "NONE"),
            }
        )
    except Exception:
        pass
    return payload


def get_hardware_alerts(patient_id: int, limit: int = 20) -> list[dict[str, Any]]:
    ensure_iot_tables()
    rows = fetchall(
        """
        SELECT id, patient_id, timestamp, alert_type, message, severity
        FROM hardware_alerts
        WHERE patient_id = ?
        ORDER BY timestamp DESC
        LIMIT ?
        """,
        (patient_id, int(limit)),
    )
    return rows_to_dicts(rows)


def get_hardware_history(patient_id: int, limit: int = 30) -> list[dict[str, Any]]:
    ensure_iot_tables()
    rows = fetchall(
        """
        SELECT id, patient_id, timestamp, medication_name, status, source, sms_sent
        FROM hardware_dose_logs
        WHERE patient_id = ?
        ORDER BY timestamp DESC
        LIMIT ?
        """,
        (patient_id, int(limit)),
    )
    history = rows_to_dicts(rows)
    if history:
        return history

    # Backward-compatible fallback: map existing dose_events + medications.
    fallback_rows = fetchall(
        """
        SELECT d.id, d.patient_id, d.timestamp, COALESCE(m.name, CONCAT('Slot ', d.medication_id)) AS medication_name, d.status, d.source
        FROM dose_events d
        LEFT JOIN medications m ON m.id = d.medication_id
        WHERE d.patient_id = ?
        ORDER BY d.timestamp DESC
        LIMIT ?
        """,
        (patient_id, int(limit)),
    )
    mapped: list[dict[str, Any]] = []
    for r in fallback_rows:
        status = str(r.get("status") or "").lower()
        mapped.append(
            {
                "id": r["id"],
                "patient_id": r["patient_id"],
                "timestamp": r["timestamp"],
                "medication_name": r["medication_name"],
                "status": "dispensed" if status in {"taken"} else ("missed" if status in {"missed"} else "error"),
                "source": "hardware" if str(r.get("source") or "").lower() == "esp32" else "system",
                "sms_sent": False,
            }
        )
    return mapped

