"""
biomarker_extractor.py – End-to-end OCR + biomarker extraction pipeline.

This module wires together:
  - preprocess.load_and_preprocess
  - extract_text.ocr_images
  - section_detector.extract_results_section
  - table_parser.parse_rows
  - regex_patterns.normalise_label

and returns structured JSON that the FastAPI backend and frontend can consume.
"""

from __future__ import annotations

from dataclasses import asdict, dataclass
from typing import Any, Dict, List

import logging

from .preprocess import load_pages, preprocess_for_paddle, preprocess_for_tesseract
from .extract_text import ocr_images
from .paddle_ocr import paddle_ocr_images
from .section_detector import extract_results_section
from .table_parser import parse_rows, ResultRow
from .regex_patterns import normalise_label
from app.services.biomarker_parser import (
    extract_biomarkers_from_text,
)


logger = logging.getLogger(__name__)


@dataclass
class BiomarkerOut:
    name: str
    value: float
    unit: str | None


def _extract_biomarkers_from_rows(rows: List[ResultRow]) -> List[BiomarkerOut]:
    """
    Map generic result rows to canonical biomarkers, de-duplicating by name.
    """
    by_name: Dict[str, BiomarkerOut] = {}

    for row in rows:
        if row.value is None:
            continue
        canonical = normalise_label(row.raw_name)
        if not canonical:
            continue

        # Deduplicate by taking the first occurrence per canonical biomarker.
        if canonical in by_name:
            continue

        by_name[canonical] = BiomarkerOut(
            name=canonical,
            value=float(row.value),
            unit=row.unit,
        )

    return list(by_name.values())


def analyze_report_file(path: str) -> Dict[str, Any]:
    """
    High-level entry point for OCR + biomarker extraction.

    All values are derived dynamically from OCR text for this specific file.
    No caching or hardcoded biomarker values are used.
    """
    logger.info("Processing file for OCR: %s", path)
    print("OCR FUNCTION STARTED", flush=True)
    print("Processing file:", path, flush=True)

    pages_bgr = load_pages(path)

    # First try PaddleOCR for stronger recognition on noisy reports.
    try:
        logger.info("Using PaddleOCR for OCR")
        print("Initializing PaddleOCR / running OCR", flush=True)
        paddle_imgs = preprocess_for_paddle(pages_bgr)
        text = paddle_ocr_images(paddle_imgs, lang="en")
        if not (text or "").strip():
            raise RuntimeError("PaddleOCR returned empty text")
    except Exception as exc:
        logger.exception("PaddleOCR failed; falling back to Tesseract. Error: %s", exc)
        print(f"Falling back to Tesseract due to: {exc!r}", flush=True)
        tess_imgs = preprocess_for_tesseract(pages_bgr)
        text = ocr_images(tess_imgs)

    # Debug: show a short snippet so we can confirm different reports
    snippet = (text or "")[:400]
    logger.debug("OCR TEXT SNIPPET (%s): %r", path, snippet)
    print("OCR TEXT (first 400 chars):", flush=True)
    print(snippet, flush=True)

    # Sliding-window extraction (AI disabled temporarily)
    structured = extract_biomarkers_from_text(text or "")
    ai_summary = ""

    section_lines = extract_results_section(text)
    rows = parse_rows(section_lines)
    biomarkers = _extract_biomarkers_from_rows(rows)

    # Do not fail early: always return success for /analyze-report.
    status = "success"
    message = "Analysis completed."

    return {
        "status": status,
        "message": message,
        # Backward-compatible list format (table-parsed)
        "biomarkers": [asdict(b) for b in biomarkers],
        # New structured format requested by frontend
        "structured_biomarkers": structured,
        "ai_summary": ai_summary,
        "raw_text": text or "",
        "debug": {
            "lines_in_section": len(section_lines),
            "rows_parsed": len(rows),
        },
    }


__all__ = ["analyze_report_file", "BiomarkerOut"]

