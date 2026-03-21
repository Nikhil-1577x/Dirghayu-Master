"""
table_parser.py – Row-based parsing of lab result tables.

This module does NOT interpret biomarker semantics. It simply converts lines
from the results section into generic "rows" with:
    - raw_name   (str)
    - value      (float | None)
    - unit       (str | None)

Higher-level biomarker mapping lives in `biomarker_extractor.py`.
"""

from __future__ import annotations

from dataclasses import dataclass
from typing import List, Optional

import re


NUMERIC_RE = re.compile(r"(\d+(?:\.\d+)?)")
UNIT_RE = re.compile(
    r"\b(mg/?dL|mg/dl|g/?dL|mmol/?L|mmol/l|%)\b", re.IGNORECASE
)


@dataclass
class ResultRow:
    raw_name: str
    value: Optional[float]
    unit: Optional[str]
    raw_line: str


def parse_rows(lines: List[str]) -> List[ResultRow]:
    """
    Convert result-section text lines into ResultRow objects.

    Strategy:
      - Ignore lines with no digits at all.
      - Treat the substring before the first number as "test name".
      - The first numeric match after that is the result.
      - The token that looks like a unit after the result is captured as unit.
    """
    rows: List[ResultRow] = []

    for line in lines:
        if not any(ch.isdigit() for ch in line):
            continue

        m = NUMERIC_RE.search(line)
        if not m:
            continue

        name_part = line[: m.start()].strip(" :-\t")
        tail = line[m.start() :]

        # Extract first numeric value
        value: Optional[float]
        try:
            value = float(m.group(1))
        except ValueError:
            value = None

        # Extract unit from tail, if available
        unit_match = UNIT_RE.search(tail)
        unit = unit_match.group(1) if unit_match else None

        rows.append(
            ResultRow(
                raw_name=name_part or "",
                value=value,
                unit=unit,
                raw_line=line,
            )
        )

    return rows


__all__ = ["ResultRow", "parse_rows", "NUMERIC_RE", "UNIT_RE"]

