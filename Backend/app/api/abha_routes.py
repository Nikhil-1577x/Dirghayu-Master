"""
abha_routes.py – REST API for ABHA patient lookup, registration, and removal.
"""
from fastapi import APIRouter, HTTPException

from app.abha_registry import (
    lookup_abha,
    get_registered_patients,
    register_patient,
    unregister_patient,
    is_registered,
)

router = APIRouter(prefix="/abha", tags=["ABHA Registry"])


@router.get("/lookup/{abha_id}")
async def abha_lookup(abha_id: str):
    """Lookup a patient by ABHA ID from the simulated government registry."""
    patient = lookup_abha(abha_id)
    if not patient:
        raise HTTPException(status_code=404, detail=f"ABHA ID '{abha_id}' not found in the national registry")
    return {**patient, "is_registered": is_registered(abha_id)}


@router.get("/patients")
async def list_registered_patients():
    """List all patients currently registered in the local panel."""
    patients = get_registered_patients()
    return {"patients": patients, "count": len(patients)}


@router.post("/patients/{abha_id}")
async def add_patient(abha_id: str):
    """Register a patient from the ABHA registry to the local panel."""
    if is_registered(abha_id):
        raise HTTPException(status_code=409, detail="Patient is already registered")
    patient = register_patient(abha_id)
    if not patient:
        raise HTTPException(status_code=404, detail=f"ABHA ID '{abha_id}' not found in the national registry")
    return {"message": f"Patient '{patient['name']}' added successfully", "patient": patient}


@router.delete("/patients/{abha_id}")
async def remove_patient(abha_id: str):
    """Remove a patient from the local panel."""
    removed = unregister_patient(abha_id)
    if not removed:
        raise HTTPException(status_code=404, detail="Patient not found in local panel")
    return {"message": "Patient removed successfully", "abha_id": abha_id.upper()}
