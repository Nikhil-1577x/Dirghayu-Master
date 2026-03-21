"""
validate_reports.py – batch validation for the OCR biomarker extractor.

Usage (from Backend/ directory):

    python -m ocr.validate_reports

This will iterate over all files in ../reports and print out the biomarkers
extracted from each.
"""

from __future__ import annotations

import sys
from pathlib import Path

from app.ocr import analyze_report_file


def main() -> None:
    root = Path(__file__).resolve().parents[1]
    reports_dir = root.parent / "reports"
    if not reports_dir.is_dir():
        print(f"Reports directory not found: {reports_dir}")
        sys.exit(1)

    exts = {".pdf", ".png", ".jpg", ".jpeg"}
    # Recurse into subfolders so each per-report directory is included.
    files = sorted(
        p for p in reports_dir.rglob("*") if p.is_file() and p.suffix.lower() in exts
    )
    if not files:
        print("No report files found in /reports")
        return

    for path in files:
        print("=" * 60)
        print(f"Report: {path.relative_to(reports_dir)}")
        try:
            result = analyze_report_file(str(path))
        except Exception as exc:  # pragma: no cover - debug helper
            print(f"  ERROR: {exc}")
            continue

        biomarkers = result.get("biomarkers", [])
        if not biomarkers:
            print("  No biomarkers extracted.")
            continue
        for bm in biomarkers:
            name = bm.get("name")
            value = bm.get("value")
            unit = bm.get("unit") or ""
            print(f"  {name}: {value} {unit}")


if __name__ == "__main__":  # pragma: no cover
    main()

