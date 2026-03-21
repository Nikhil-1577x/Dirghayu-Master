"""
biomarker_routes.py – Biomarker endpoints.
"""
from fastapi import APIRouter, UploadFile, File, HTTPException, Depends
from sqlalchemy.orm import Session
import shutil, tempfile, os

from app.database import get_db
from app.models.biomarker import BiomarkerCreate, BiomarkerOut
from app.services.biomarker_service import add_biomarker, get_biomarkers, ingest_from_image, get_narrative

router = APIRouter(prefix="/patient", tags=["Biomarkers"])


@router.get("/{id}/biomarkers")
def get_patient_biomarkers(id: int, db: Session = Depends(get_db)):
    """Return all biomarker readings for a patient."""
    return get_biomarkers(id)


@router.post("/{id}/biomarkers", status_code=201)
def add_patient_biomarker(id: int, data: BiomarkerCreate, db: Session = Depends(get_db)):
    return add_biomarker(id, data.biomarker_type, data.value, data.timestamp)


@router.post("/{id}/biomarkers/ocr", status_code=201)
async def ocr_biomarker_upload(id: int, file: UploadFile = File(...), db: Session = Depends(get_db)):
    """
    Upload an image file; OCR pipeline extracts biomarker values.
    Appends new report data; historical reports are preserved.
    """
    with tempfile.NamedTemporaryFile(delete=False, suffix=os.path.splitext(file.filename)[-1]) as tmp:
        shutil.copyfileobj(file.file, tmp)
        tmp_path = tmp.name
    try:
        records = ingest_from_image(id, tmp_path)
    finally:
        os.unlink(tmp_path)
    return {"added": len(records), "records": records}


@router.post("/demo/biomarkers/ocr", status_code=201)
async def demo_ocr_upload(file: UploadFile = File(...), db: Session = Depends(get_db)):
    """
    Temporary demo endpoint: upload a lab report image WITHOUT selecting a patient.

    Uses existing patient id=1 and runs OCR ingestion.
    """
    from app.utils.db_utils import fetchone

    demo_patient_id = 1
    row = fetchone("SELECT id FROM patients WHERE id = ?", (demo_patient_id,), db=db)
    if row is None:
        raise HTTPException(status_code=404, detail="Patient 1 not found")

    with tempfile.NamedTemporaryFile(delete=False, suffix=os.path.splitext(file.filename)[-1]) as tmp:
        shutil.copyfileobj(file.file, tmp)
        tmp_path = tmp.name
    try:
        records = ingest_from_image(demo_patient_id, tmp_path)
    finally:
        os.unlink(tmp_path)
    return {"patient_id": demo_patient_id, "added": len(records), "records": records}


@router.get("/{id}/biomarker-reports")
def get_patient_biomarker_reports(id: int, db: Session = Depends(get_db)):
    """Return all OCR report records for table rendering (groupable by report_id)."""
    from app.services.biomarker_service import get_biomarker_reports
    return get_biomarker_reports(id)


@router.get("/{id}/biomarkers/narrative")
def patient_narrative(id: int, db: Session = Depends(get_db)):
    """Return AI-generated narrative from biomarkers."""
    try:
        payload = get_narrative(id)
        return {"patient_id": id, **payload}
    except Exception as exc:
        raise HTTPException(status_code=502, detail=f"AI narrative generation failed: {exc}")

@router.get("/{id}/debug_env")
def debug_env(id: int, db: Session = Depends(get_db)):
    import os
    return {"api_key": os.getenv("OPENROUTER_API_KEY"), "model": os.getenv("OPENROUTER_MODEL")}
