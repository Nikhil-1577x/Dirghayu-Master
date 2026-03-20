"""
OCR and biomarker extraction package.

This module provides a pure-open-source pipeline for:
  - Converting PDFs/images into cleaned images
  - Running Tesseract OCR
  - Detecting the results section
  - Parsing table-like rows
  - Normalising biomarker names and returning structured JSON

Entry point for other code:

    from app.ocr.biomarker_extractor import analyze_report_file

The pipeline is fully dynamic – it never hardcodes any biomarker values and
relies only on OCR text + parsing logic so that it generalises to new reports.
"""

from .biomarker_extractor import analyze_report_file  # noqa: F401

