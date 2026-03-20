from __future__ import annotations

"""
Auto-label NER spans for lab reports using simple heuristics.

This script:
- Reads data/ner/annotations_raw.jsonl
- Uses known biomarker synonyms and value/unit regexes to propose spans
  for BIOMARKER_NAME, VALUE, and UNIT
- Writes the result to data/ner/annotations_labeled.jsonl
  (backing up any existing file to annotations_labeled.jsonl.bak)

You should still review and correct the output, but this gives a strong
starting point for spaCy training.

Run with:
    python -m nirogi_ai.auto_label_ner
"""

import json
import re
from pathlib import Path
from typing import Any, Dict, List, Tuple


PROJECT_ROOT = Path(__file__).resolve().parents[1]
NER_DIR = PROJECT_ROOT / "data" / "ner"
RAW_PATH = NER_DIR / "annotations_raw.jsonl"
LABELED_PATH = NER_DIR / "annotations_labeled.jsonl"
LOINC_PATH = PROJECT_ROOT / "nirogi_ai" / "loinc_table.json"


def load_loinc_synonyms() -> List[str]:
    if not LOINC_PATH.is_file():
        return []
    obj = json.loads(LOINC_PATH.read_text(encoding="utf-8"))
    syns: List[str] = []
    for key, entry in obj.items():
        if key.startswith("_"):
            continue
        if isinstance(entry, dict):
            syns.extend(entry.get("synonyms", []))
    # Deduplicate, keep longer first to avoid shadowing
    syns = sorted(set(syns), key=len, reverse=True)
    return syns


def add_name_spans(text: str, spans: List[Dict[str, Any]], synonyms: List[str]) -> None:
    lower_text = text.lower()
    existing_ranges = {(s["start"], s["end"]) for s in spans if s["label"] == "BIOMARKER_NAME"}
    for syn in synonyms:
        syn_clean = syn.strip()
        if not syn_clean:
            continue
        pattern = re.escape(syn_clean)
        for m in re.finditer(pattern, text, flags=re.IGNORECASE):
            start, end = m.start(), m.end()
            if (start, end) in existing_ranges:
                continue
            spans.append({"start": start, "end": end, "label": "BIOMARKER_NAME"})
            existing_ranges.add((start, end))


VALUE_UNIT_RE = re.compile(
    r"(?P<value>\d+(\.\d+)?)\s*(?P<unit>%|mg/dl|mg/dL|MMOL/L|mmol/l|mmol/L)",
    flags=re.IGNORECASE,
)


def add_value_unit_spans(text: str, spans: List[Dict[str, Any]]) -> None:
    existing_ranges = {(s["start"], s["end"]) for s in spans}
    for m in VALUE_UNIT_RE.finditer(text):
        v_start, v_end = m.start("value"), m.end("value")
        u_start, u_end = m.start("unit"), m.end("unit")
        if (v_start, v_end) not in existing_ranges:
            spans.append({"start": v_start, "end": v_end, "label": "VALUE"})
            existing_ranges.add((v_start, v_end))
        if (u_start, u_end) not in existing_ranges:
            spans.append({"start": u_start, "end": u_end, "label": "UNIT"})
            existing_ranges.add((u_start, u_end))


def auto_label() -> None:
    if not RAW_PATH.is_file():
        raise FileNotFoundError(f"Raw annotations not found at {RAW_PATH}")

    synonyms = load_loinc_synonyms()
    print(f"Loaded {len(synonyms)} biomarker synonyms from {LOINC_PATH.name}")

    # Backup existing labeled file if present
    if LABELED_PATH.is_file():
        backup = LABELED_PATH.with_suffix(".jsonl.bak")
        LABELED_PATH.rename(backup)
        print(f"Existing labeled file backed up to {backup}")

    total = 0
    with RAW_PATH.open("r", encoding="utf-8") as in_f, LABELED_PATH.open(
        "w", encoding="utf-8"
    ) as out_f:
        for line in in_f:
            line = line.strip()
            if not line:
                continue
            obj = json.loads(line)
            text = obj.get("text", "")
            spans: List[Dict[str, Any]] = obj.get("spans", []) or []

            add_name_spans(text, spans, synonyms)
            add_value_unit_spans(text, spans)

            obj["spans"] = spans
            out_f.write(json.dumps(obj, ensure_ascii=False) + "\n")
            total += 1

    print(f"Auto-labeled {total} documents into {LABELED_PATH}")
    print("Please review and correct spans before training spaCy.")


if __name__ == "__main__":
    auto_label()

