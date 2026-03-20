"""
ocr_pipeline.py – Bridge from backend services to the new open‑source OCR
pipeline in `app.ocr`.

This adapts the generic JSON returned by `analyze_report_file(image_path)` to
the shape expected by the biomarker service:

    list of {"type": str, "value": float, "timestamp": str (ISO)}
"""

from __future__ import annotations

import logging
from typing import Dict, List

from app.utils.time_utils import utcnow_str
from app.ocr import analyze_report_file


logger = logging.getLogger(__name__)


def run_ocr(image_path: str) -> list[dict]:
    """
    Run OCR on a lab report image and extract biomarker readings using the
    new open‑source pipeline.

    Args:
        image_path: Absolute path to the image or PDF file.

    Returns:
        List of dicts: [{"type": "fasting_glucose", "value": 123.0, "timestamp": "ISO"}, ...]
    """
    logger.info("OCR pipeline invoked for image: %s", image_path)

    try:
        result: Dict[str, object] = analyze_report_file(image_path)
    except Exception as exc:  # pragma: no cover – defensive
        logger.exception("OCR pipeline failed for %s: %s", image_path, exc)
        return []

    biomarker_list = result.get("biomarkers") or []
    if not isinstance(biomarker_list, list):
        logger.warning("Unexpected biomarker payload from analyzer for %s", image_path)
        return []

    ts = utcnow_str()
    records: List[Dict] = []
    seen_types: set[str] = set()

    for entry in biomarker_list:
        if not isinstance(entry, dict):
            continue
        btype = str(entry.get("name") or "").strip()
        if not btype:
            continue
        if btype in seen_types:
            continue  # de‑duplicate
        value = entry.get("value")
        try:
            v = float(value)  # type: ignore[arg-type]
        except (TypeError, ValueError):
            continue
        seen_types.add(btype)
        records.append({"type": btype, "value": v, "timestamp": ts})

    logger.info("OCR extracted %d biomarkers from %s", len(records), image_path)
    return records
