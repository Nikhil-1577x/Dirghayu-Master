"""
iot_routes.py - IoT dispenser APIs for frontend integration.
"""
from __future__ import annotations

from typing import Optional

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy.orm import Session

from app.database import get_db
from app.iot.iot_service import (
    get_dispenser_status,
    get_hardware_alerts,
    get_hardware_history,
    ingest_hardware_event,
)
from app.utils.db_utils import fetchone
from app.api.websocket_routes import broadcast

router = APIRouter(prefix="/iot", tags=["IoT"])

# In-memory: currently selected patient for hardware bridge (Arduino events go here)
_hardware_active_patient_id: Optional[int] = None


class ActivePatientBody(BaseModel):
    patient_id: int


@router.get("/active-patient")
def get_active_patient():
    """Return the patient ID that Arduino events should be logged to (set by frontend on patient select)."""
    return {"patient_id": _hardware_active_patient_id}


@router.post("/active-patient")
def set_active_patient(body: ActivePatientBody, db: Session = Depends(get_db)):
    """Set the active patient for hardware events. Called by frontend when user selects a patient."""
    patient = fetchone("SELECT id FROM patients WHERE id = ?", (body.patient_id,), db=db)
    if not patient:
        raise HTTPException(status_code=404, detail="Patient not found")
    global _hardware_active_patient_id
    _hardware_active_patient_id = body.patient_id
    return {"patient_id": _hardware_active_patient_id}


@router.get("/dispenser/{patient_id}")
def live_dispenser_status(patient_id: int, db: Session = Depends(get_db)):
    patient = fetchone("SELECT id FROM patients WHERE id = ?", (patient_id,), db=db)
    if not patient:
        raise HTTPException(status_code=404, detail="Patient not found")
    return get_dispenser_status(patient_id)


@router.get("/alerts/{patient_id}")
def hardware_alerts(patient_id: int, limit: int = 20, db: Session = Depends(get_db)):
    patient = fetchone("SELECT id FROM patients WHERE id = ?", (patient_id,), db=db)
    if not patient:
        raise HTTPException(status_code=404, detail="Patient not found")
    alerts = get_hardware_alerts(patient_id, limit=limit)
    return {"patient_id": patient_id, "alerts": alerts}


@router.get("/history/{patient_id}")
def hardware_history(patient_id: int, limit: int = 30, db: Session = Depends(get_db)):
    patient = fetchone("SELECT id FROM patients WHERE id = ?", (patient_id,), db=db)
    if not patient:
        raise HTTPException(status_code=404, detail="Patient not found")
    history = get_hardware_history(patient_id, limit=limit)
    return {"patient_id": patient_id, "history": history}


# Legacy-compatible event ingest for existing arduino-server/server.js
@router.post("/event/{patient_id}/slot/{slot}")
def ingest_event(patient_id: int, slot: int, body: dict, db: Session = Depends(get_db)):
    patient = fetchone("SELECT id FROM patients WHERE id = ?", (patient_id,), db=db)
    if not patient:
        raise HTTPException(status_code=404, detail="Patient not found")
    status = str(body.get("status") or "")
    if not status:
        raise HTTPException(status_code=400, detail="status is required")
    event = ingest_hardware_event(patient_id=patient_id, slot=slot, status=status)

    alert_row = event.get("alert")
    log_entry = {k: v for k, v in event.items() if k != "alert"}
    log_entry["source"] = "hardware"

    payload = {
        "type": "iot_event",
        "patient_id": patient_id,
        "log": log_entry,
        "alert": alert_row,
        "dispenser": get_dispenser_status(patient_id),
        "timestamp": event.get("timestamp"),
    }

    import asyncio
    import threading
    try:
        def _push():
            asyncio.run(broadcast(patient_id, payload))
        threading.Thread(target=_push, daemon=True).start()
    except Exception:
        pass

    return event


legacy_router = APIRouter(tags=["IoT"])


# Drop-in compatibility with old sqlite bridge path used by arduino-server/server.js
@legacy_router.post("/patient/{patient_id}/medication/{slot}/log-event")
def ingest_legacy_path(patient_id: int, slot: int, body: dict, db: Session = Depends(get_db)):
    return ingest_event(patient_id, slot, body, db)

