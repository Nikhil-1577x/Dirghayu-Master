"""
analyze_report.py – Public API endpoint for ad‑hoc report analysis.

Route:
    POST /analyze-report

Body:
    multipart/form-data with a single `file` field (PDF or image).

Response:
    {
      "status": "success" | "failed",
      "message": "...",
      "raw_text": "...",
      "biomarkers": {...},
      "ai_summary": "..."
    }
"""

from __future__ import annotations

import os
import shutil
import tempfile
from typing import Any, Dict
from pathlib import Path

from fastapi import APIRouter, File, UploadFile, HTTPException, Query, Depends
from sqlalchemy.orm import Session

from app.database import get_db
from app.ocr import analyze_report_file
from app.services.biomarker_trends import (
    build_history_latest_11_reports,
    generate_trend_ai_summary,
)
from app.services.biomarker_parser import normalize_biomarker
from app.utils.db_utils import fetchone


router = APIRouter(tags=["OCR"], include_in_schema=True)


@router.post("/analyze-report")
async def analyze_report(
    file: UploadFile = File(...),
    patient_id: int | None = Query(None, description="Patient ID to store biomarker history under"),
    patient: int | None = Query(None, description="Backward-compat alias for patient_id"),
    db: Session = Depends(get_db),
) -> Dict[str, Any]:
    resolved_patient_id = patient_id if patient_id is not None else patient
    if resolved_patient_id is None:
        raise HTTPException(status_code=400, detail="patient_id is required")

    print("[/analyze-report] hit", flush=True)
    patient_row = fetchone("SELECT id FROM patients WHERE id = ?", (resolved_patient_id,), db=db)
    if patient_row is None:
        raise HTTPException(status_code=404, detail=f"Patient {resolved_patient_id} not found")

    if not file.filename:
        raise HTTPException(status_code=400, detail="No file uploaded")

    suffix = os.path.splitext(file.filename)[-1].lower()
    if suffix not in {".pdf", ".png", ".jpg", ".jpeg"}:
        raise HTTPException(status_code=400, detail="Unsupported file type")

    with tempfile.NamedTemporaryFile(delete=False, suffix=suffix) as tmp:
        shutil.copyfileobj(file.file, tmp)
        tmp_path = tmp.name
    try:
        size = Path(tmp_path).stat().st_size
    except OSError:
        size = -1
    print(f"[/analyze-report] received file={file.filename!r} tmp={tmp_path} size_bytes={size}", flush=True)
    if size == 0:
        raise HTTPException(status_code=400, detail="Uploaded file is empty")

    try:
        print(f"[/analyze-report] calling OCR pipeline for {tmp_path}", flush=True)
        result = analyze_report_file(tmp_path)
        print(f"[/analyze-report] OCR pipeline completed for {tmp_path}", flush=True)
    finally:
        try:
            os.unlink(tmp_path)
        except OSError:
            pass

    # Ensure a stable top-level contract for the frontend.
    status = result.get("status", "failed")
    structured = result.get("structured_biomarkers", {})
    raw_text = result.get("raw_text", "")
    message = result.get("message", "")

    # Normalise status for callers: only "success" or "failed".
    if status != "success":
        status = "failed"

    # Preview-only endpoint: do NOT persist anything here.
    # IMPORTANT: persistence happens in /patient/{id}/biomarkers/ocr only.
    # This avoids duplicate report entries when frontend calls preview + save.
    trend_summary = ""
    ai_error = None
    try:
        normalised: Dict[str, Dict[str, Any]] = {}
        if isinstance(structured, dict):
            for k, v in structured.items():
                nk = normalize_biomarker(str(k)) or str(k)
                if isinstance(v, dict):
                    normalised[nk] = v
        history, latest_values, report_ids = build_history_latest_11_reports(resolved_patient_id, max_rows=500)
        trend_summary, ai_error = generate_trend_ai_summary(history, latest_values=latest_values, return_error=True)
        print(f"[/analyze-report] preview-only for patient_id={resolved_patient_id}", flush=True)
    except Exception as exc:
        print(f"[/analyze-report] storage/trend summary failed: {exc!r}", flush=True)
        # Don't fail the entire OCR response; surface the AI failure in-band.
        ai_error = {"source": "backend", "status": None, "message": f"{exc!r}"[:500]}

    return {
        "status": status,
        "message": message,
        "raw_text": raw_text,
        "biomarkers": structured,
        "ai_summary": trend_summary,
        "ai_error": ai_error,
    }

