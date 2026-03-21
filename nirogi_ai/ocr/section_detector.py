"""
section_detector.py – Find the results / test table section in OCR text.

The goal is to restrict numeric extraction to the lines that are most likely to
be part of the lab results table, and avoid interpretation / comments.
"""

from __future__ import annotations

from typing import List


START_KEYWORDS = ("test report", "investigation", "result", "results")
STOP_KEYWORDS = ("interpretation", "comments", "comment", "notes", "impression")


def extract_results_section(text: str) -> List[str]:
    """
    Given full OCR text, return the subset of lines between the first
    "results table" keyword and the first "interpretation / comments" keyword.
    If no keywords are found, fall back to all lines.
    """
    all_lines = [ln.rstrip() for ln in text.splitlines()]
    if not all_lines:
        return []

    start_idx = 0
    for i, line in enumerate(all_lines):
        low = line.lower()
        if any(k in low for k in START_KEYWORDS):
            start_idx = i + 1
            break

    end_idx = len(all_lines)
    for i in range(start_idx, len(all_lines)):
        low = all_lines[i].lower()
        if any(k in low for k in STOP_KEYWORDS):
            end_idx = i
            break

    section = [ln.strip() for ln in all_lines[start_idx:end_idx] if ln.strip()]
    return section


__all__ = ["extract_results_section"]

