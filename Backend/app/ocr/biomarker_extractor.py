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
import cv2  # type: ignore
import numpy as np  # type: ignore

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


def _rotation_variants(images: List[np.ndarray]) -> list[tuple[str, List[np.ndarray]]]:
    """
    Generate orientation variants so OCR can handle rotated reports.
    """
    return [
        ("0", images),
        ("90", [cv2.rotate(img, cv2.ROTATE_90_CLOCKWISE) for img in images]),
        ("180", [cv2.rotate(img, cv2.ROTATE_180) for img in images]),
        ("270", [cv2.rotate(img, cv2.ROTATE_90_COUNTERCLOCKWISE) for img in images]),
    ]


def _score_text(text: str) -> int:
    """
    Prefer OCR outputs that contain known biomarker keywords.
    """
    t = (text or "").lower()
    if not t.strip():
        return 0
    keywords = [
        "glucose",
        "fasting",
        "postprandial",
        "hba1c",
        "a1c",
        "blood sugar random",
        "random blood sugar",
    ]
    keyword_hits = sum(1 for k in keywords if k in t)
    # Weighted by useful keywords first, then by text length.
    return (keyword_hits * 10000) + min(len(t), 9999)


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
    # Evaluate multiple rotations and pick best OCR text by keyword-aware score.
    try:
        logger.info("Using PaddleOCR for OCR")
        print("Initializing PaddleOCR / running OCR", flush=True)
        paddle_imgs = preprocess_for_paddle(pages_bgr)
        best_text = ""
        best_score = -1
        best_rot = "0"
        for rot, imgs in _rotation_variants(paddle_imgs):
            candidate = paddle_ocr_images(imgs, lang="en")
            sc = _score_text(candidate)
            if sc > best_score:
                best_score = sc
                best_text = candidate
                best_rot = rot
        text = best_text
        logger.info("PaddleOCR best rotation=%s score=%d", best_rot, best_score)
        if not (text or "").strip():
            raise RuntimeError("PaddleOCR returned empty text")
    except Exception as exc:
        logger.exception("PaddleOCR failed; falling back to Tesseract. Error: %s", exc)
        print(f"Falling back to Tesseract due to: {exc!r}", flush=True)
        tess_imgs = preprocess_for_tesseract(pages_bgr)
        best_text = ""
        best_score = -1
        best_rot = "0"
        for rot, imgs in _rotation_variants(tess_imgs):
            candidate = ocr_images(imgs)
            sc = _score_text(candidate)
            if sc > best_score:
                best_score = sc
                best_text = candidate
                best_rot = rot
        text = best_text
        logger.info("Tesseract best rotation=%s score=%d", best_rot, best_score)

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

