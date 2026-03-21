"""
pdf_routes.py - Doctor-only patient summary PDF download endpoint.
"""
from __future__ import annotations

import os

from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import FileResponse
from sqlalchemy.orm import Session

from app.database import get_db
from app.services.pdf_service import generate_patient_summary_pdf

router = APIRouter(prefix="/patient", tags=["PDF"])


@router.get("/{id}/report")
def download_patient_summary_report(id: int, db: Session = Depends(get_db)):
    try:
        path = generate_patient_summary_pdf(id)
    except ValueError as exc:
        raise HTTPException(status_code=404, detail=str(exc))
    except Exception as exc:
        raise HTTPException(status_code=500, detail=f"PDF generation failed: {exc}")

    if not os.path.exists(path):
        raise HTTPException(status_code=404, detail="Generated PDF file missing")

    return FileResponse(path, media_type="application/pdf", filename="patient_report.pdf")

