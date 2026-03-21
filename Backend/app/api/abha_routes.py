"""
abha_routes.py - In-memory ABHA registry APIs.
"""
from __future__ import annotations

from fastapi import APIRouter, HTTPException

from app.abha_registry import ABHA_REGISTRY, _registered_abha_ids, register_db_patient
from app.utils.db_utils import fetchall

router = APIRouter(prefix="/abha", tags=["ABHA"])


def _profile(abha_id: str) -> dict:
    record = ABHA_REGISTRY.get(abha_id.upper())
    if record is None:
        raise HTTPException(status_code=404, detail=f"ABHA ID {abha_id} not found")
    return {"abha_id": abha_id.upper(), **record}


@router.get("/lookup/{abha_id}")
def lookup_patient(abha_id: str):
    return _profile(abha_id)


@router.post("/patients/{abha_id}")
def add_patient_to_panel(abha_id: str):
    pid = abha_id.upper()
    if pid not in ABHA_REGISTRY:
        raise HTTPException(status_code=404, detail=f"ABHA ID {abha_id} not found")
    _registered_abha_ids.add(pid)
    return {"message": "Patient added to panel", "abha_id": pid}


@router.delete("/patients/{abha_id}")
def remove_patient_from_panel(abha_id: str):
    pid = abha_id.upper()
    if pid not in ABHA_REGISTRY:
        raise HTTPException(status_code=404, detail=f"ABHA ID {abha_id} not found")
    _registered_abha_ids.discard(pid)
    return {"message": "Patient removed from panel", "abha_id": pid}


@router.get("/patients")
def list_panel_patients():
    # Keep ABHA panel aligned with currently available DB patients.
    try:
        db_rows = fetchall("SELECT * FROM patients ORDER BY id")
        for row in db_rows:
            register_db_patient(row)
    except Exception:
        pass
    patients = [{"abha_id": pid, **ABHA_REGISTRY[pid]} for pid in sorted(_registered_abha_ids)]
    return {"patients": patients, "count": len(patients)}

