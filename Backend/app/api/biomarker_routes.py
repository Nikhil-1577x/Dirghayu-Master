"""
biomarker_routes.py – Biomarker endpoints.
"""
from fastapi import APIRouter, UploadFile, File, HTTPException
import shutil, tempfile, os

from app.models.biomarker import BiomarkerCreate, BiomarkerOut
from app.services.biomarker_service import add_biomarker, get_biomarkers, ingest_from_image, get_narrative

router = APIRouter(prefix="/patient", tags=["Biomarkers"])


@router.get("/{id}/biomarkers")
def get_patient_biomarkers(id: int):
    """Return all biomarker readings for a patient."""
    return get_biomarkers(id)


@router.post("/{id}/biomarkers", status_code=201)
def add_patient_biomarker(id: int, data: BiomarkerCreate):
    return add_biomarker(id, data.biomarker_type, data.value, data.timestamp)


@router.post("/{id}/biomarkers/ocr", status_code=201)
async def ocr_biomarker_upload(id: int, file: UploadFile = File(...)):
    """
    Upload an image file; OCR pipeline extracts biomarker values.
    Replaces existing biomarkers for this patient so each upload shows clean results.
    """
    from app.utils.db_utils import execute
    execute("DELETE FROM biomarker_readings WHERE patient_id = ?", (id,))
    with tempfile.NamedTemporaryFile(delete=False, suffix=os.path.splitext(file.filename)[-1]) as tmp:
        shutil.copyfileobj(file.file, tmp)
        tmp_path = tmp.name
    try:
        records = ingest_from_image(id, tmp_path)
    finally:
        os.unlink(tmp_path)
    return {"added": len(records), "records": records}


@router.post("/demo/biomarkers/ocr", status_code=201)
async def demo_ocr_upload(file: UploadFile = File(...)):
    """
    Temporary demo endpoint: upload a lab report image WITHOUT selecting a patient.

    Uses or creates patient with id=1 under the hood. Replaces existing biomarkers
    so each upload shows a clean result (no leftover wrong extractions).
    """
    from app.utils.db_utils import fetchone, execute

    demo_patient_id = 1
    row = fetchone("SELECT id FROM patients WHERE id = ?", (demo_patient_id,))
    if row is None:
        execute(
            "INSERT INTO patients (id, name, age, gender, phone) VALUES (?, ?, ?, ?, ?)",
            (demo_patient_id, "Demo Patient", 50, "male", "+910000000000"),
        )
    else:
        execute("DELETE FROM biomarker_readings WHERE patient_id = ?", (demo_patient_id,))

    with tempfile.NamedTemporaryFile(delete=False, suffix=os.path.splitext(file.filename)[-1]) as tmp:
        shutil.copyfileobj(file.file, tmp)
        tmp_path = tmp.name
    try:
        records = ingest_from_image(demo_patient_id, tmp_path)
    finally:
        os.unlink(tmp_path)
    return {"patient_id": demo_patient_id, "added": len(records), "records": records}


@router.get("/{id}/biomarkers/narrative")
def patient_narrative(id: int):
    """Return AI-generated narrative from biomarkers."""
    try:
        payload = get_narrative(id)
        return {"patient_id": id, **payload}
    except Exception as exc:
        raise HTTPException(status_code=502, detail=f"AI narrative generation failed: {exc}")

@router.get("/{id}/debug_env")
def debug_env(id: int):
    import os
    return {"api_key": os.getenv("OPENROUTER_API_KEY"), "model": os.getenv("OPENROUTER_MODEL")}
