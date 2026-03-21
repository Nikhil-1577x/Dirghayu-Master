"""
biomarker_service.py – Biomarker CRUD + OCR ingestion + slope/trend analysis.

GAP 1: Each biomarker type now carries:
  - slope  (float)  : numpy polyfit degree-1 slope across all readings
  - trend  (str)    : "IMPROVING" | "STABLE" | "WORSENING"

Thresholds per reading (positive slope = worsening for all):
  HbA1c          : |slope| > 0.5  → WORSENING/IMPROVING
  systolic_bp    : |slope| > 1.0
  fasting_glucose: |slope| > 2.0
  (all others)   : |slope| > 1.0  (default)
"""
import logging
from typing import Optional

import numpy as np

from app.utils.time_utils import utcnow_str
from app.utils.db_utils import execute, fetchall, fetchone, rows_to_dicts
from app.ocr import analyze_report_file
from app.services.biomarker_trends import (
    create_report_id,
    ensure_patient_exists,
    store_biomarkers_for_report,
    build_history_latest_11_reports,
    generate_trend_ai_summary,
)
from app.services.biomarker_parser import normalize_biomarker

logger = logging.getLogger(__name__)

# ── Worsening thresholds (slope per reading, positive = worsening) ──────────
_WORSENING_THRESHOLDS: dict[str, float] = {
    "HbA1c":           0.5,
    "systolic_bp":     1.0,
    "fasting_glucose": 2.0,
}
_DEFAULT_THRESHOLD = 1.0


def _classify_trend(biomarker_type: str, slope: float) -> str:
    """
    Classify the trend direction based on the linear regression slope.
    For all tracked biomarkers, a higher value means worsening health.
    """
    threshold = _WORSENING_THRESHOLDS.get(biomarker_type, _DEFAULT_THRESHOLD)
    if slope > threshold:
        return "WORSENING"
    elif slope < -threshold:
        return "IMPROVING"
    else:
        return "STABLE"


def _compute_slope(values: list[float]) -> float:
    """
    Compute linear regression slope (degree 1) using numpy.polyfit.
    Works with as few as 2 readings. Returns 0.0 for single point.
    """
    if len(values) < 2:
        return 0.0
    x = np.arange(len(values), dtype=float)
    y = np.array(values, dtype=float)
    coeffs = np.polyfit(x, y, 1)   # coeffs[0] = slope, coeffs[1] = intercept
    return float(coeffs[0])


def add_biomarker(
    patient_id: int,
    biomarker_type: str,
    value: float,
    timestamp: Optional[str] = None,
) -> dict:
    ts = timestamp or utcnow_str()
    row_id = execute(
        """INSERT INTO biomarker_readings (patient_id, biomarker_type, value, timestamp)
           VALUES (?, ?, ?, ?) RETURNING id""",
        (patient_id, biomarker_type, value, ts),
    )
    logger.info("Biomarker added: patient=%d type=%s value=%s", patient_id, biomarker_type, value)
    return {"id": row_id, "patient_id": patient_id, "biomarker_type": biomarker_type, "value": value, "timestamp": ts}


def get_biomarkers(patient_id: int) -> list[dict]:
    """
    Return all biomarker readings with slope + trend enrichment per type.
    """
    rows = fetchall(
        "SELECT * FROM biomarker_readings WHERE patient_id = ? ORDER BY timestamp ASC",
        (patient_id,),
    )
    raw = rows_to_dicts(rows)

    # Group all readings by type (ordered chronologically for correct slope)
    type_values: dict[str, list[float]] = {}
    for row in raw:
        type_values.setdefault(row["biomarker_type"], []).append(row["value"])

    # Precompute slope + trend per type
    type_meta: dict[str, dict] = {}
    for btype, values in type_values.items():
        slope = _compute_slope(values)
        type_meta[btype] = {
            "slope": round(slope, 4),
            "trend": _classify_trend(btype, slope),
        }

    # Enrich every reading with its type-level slope + trend
    enriched = []
    for row in raw:
        btype = row["biomarker_type"]
        enriched.append({
            **row,
            "slope": type_meta[btype]["slope"],
            "trend": type_meta[btype]["trend"],
        })

    # Return newest-first for API consumers (slope was computed on ASC order above)
    enriched.sort(key=lambda r: r["timestamp"], reverse=True)
    return enriched


def get_biomarker_reports(patient_id: int) -> list[dict]:
    """
    Return persistent OCR report records (one row per biomarker per report_id).
    Used by Doctor/CHO report table so all scanned reports remain visible.
    """
    rows = fetchall(
        """
        SELECT report_id, biomarker_name, value, unit, created_at
        FROM biomarker_records
        WHERE patient_id = ?
        ORDER BY created_at DESC
        """,
        (patient_id,),
    )
    return rows_to_dicts(rows)


def get_latest_biomarkers(patient_id: int) -> dict:
    """
    Return latest reading per biomarker type with slope + trend enrichment.
    """
    rows = fetchall(
        """SELECT biomarker_type, value, timestamp
           FROM biomarker_readings
           WHERE patient_id = ?
           ORDER BY timestamp ASC""",
        (patient_id,),
    )

    # Group by type (ascending for slope, latest for display)
    type_all: dict[str, list] = {}
    for row in rows:
        type_all.setdefault(row["biomarker_type"], []).append(row)

    result: dict = {}
    for btype, readings in type_all.items():
        values = [r["value"] for r in readings]
        slope = _compute_slope(values)
        latest = readings[-1]
        result[btype] = {
            "value":     latest["value"],
            "timestamp": latest["timestamp"],
            "slope":     round(slope, 4),
            "trend":     _classify_trend(btype, slope),
        }
    return result


def ingest_from_image(patient_id: int, image_path: str) -> list[dict]:
    """
    Run OCR on an image, parse biomarker results, persist them.
    """
    # 1) OCR + structured extraction (with units)
    result = analyze_report_file(image_path)
    structured = result.get("structured_biomarkers") or {}
    if not isinstance(structured, dict):
        structured = {}

    # normalize keys before persistence
    normalised: dict[str, dict] = {}
    for k, v in structured.items():
        nk = normalize_biomarker(str(k)) or str(k)
        if isinstance(v, dict):
            normalised[nk] = v

    # 2) Persist historical biomarker_records (do NOT delete history)
    ensure_patient_exists(patient_id)
    report_id = create_report_id()
    stored = store_biomarkers_for_report(patient_id, report_id, normalised)
    logger.info("Stored %d biomarker_records for patient=%d report_id=%s", stored, patient_id, report_id)

    # 3) Persist current snapshot in biomarker_readings (existing UI behavior)
    added = []
    ts = utcnow_str()
    for btype, payload in normalised.items():
        try:
            value = float(payload.get("value"))
        except Exception:
            continue
        record = add_biomarker(patient_id, btype, value, ts)
        added.append(record)
    logger.info("OCR ingestion for patient %d: %d records added", patient_id, len(added))
    return added


def build_biomarker_dict(patient_id: int) -> dict:
    """Build a flat dict of latest biomarkers for narrative generation."""
    latest = get_latest_biomarkers(patient_id)
    return {btype: data["value"] for btype, data in latest.items()}


def get_narrative(patient_id: int) -> dict:
    """
    Generate an AI narrative summary based on biomarker history:
      - Uses the latest report values primarily
      - Uses up to previous 10 reports for trends
    """
    history, latest_values, report_ids = build_history_latest_11_reports(patient_id, max_rows=500)
    if not report_ids:
        return {
            "narrative": "",
            "ai_error": None,
        }

    summary, ai_error = generate_trend_ai_summary(history, latest_values=latest_values, return_error=True)
    if not isinstance(summary, str) or not summary.strip():
        raise RuntimeError(ai_error.get("message") if isinstance(ai_error, dict) else "OpenRouter failed with empty response.")
    return {"narrative": summary.strip(), "ai_error": ai_error}
