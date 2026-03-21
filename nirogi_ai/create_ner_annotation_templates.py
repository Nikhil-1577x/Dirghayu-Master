from __future__ import annotations

"""
Create initial NER annotation templates from OCR'd lab reports.

This script:
- Reads all OCR text files from data/ocr_reports/*.txt
- For each file, creates a JSONL entry with:
    - "text": full report text
    - "spans": []  (to be filled with BIOMARKER_NAME / VALUE / UNIT)
- Writes them to data/ner/annotations_raw.jsonl

You (or a labeling tool) will then add spans with fields:
    {"start": int, "end": int, "label": "BIOMARKER_NAME" | "VALUE" | "UNIT"}

After annotation, train the spaCy model using train_spacy_ner.py.

Run with:
    python -m nirogi_ai.create_ner_annotation_templates
"""

import json
from pathlib import Path
from typing import List, Dict, Any


from .paths import get_data_dir
DATA_ROOT = get_data_dir()
OCR_DIR = DATA_ROOT / "ocr_reports"
NER_DIR = DATA_ROOT / "ner"
NER_DIR.mkdir(parents=True, exist_ok=True)


def _list_ocr_files() -> List[Path]:
    if not OCR_DIR.is_dir():
        return []
    return sorted(p for p in OCR_DIR.glob("*.txt") if p.is_file())


def main() -> None:
    files = _list_ocr_files()
    if not files:
        print(f"No OCR text files found in {OCR_DIR}")
        return

    out_path = NER_DIR / "annotations_raw.jsonl"

    with out_path.open("w", encoding="utf-8") as out_f:
        for path in files:
            text = path.read_text(encoding="utf-8")
            record: Dict[str, Any] = {
                "id": path.stem,
                "text": text,
                "spans": [],  # to be filled with {start, end, label}
            }
            out_f.write(json.dumps(record, ensure_ascii=False) + "\n")

    print(f"Wrote {len(files)} annotation templates to {out_path}")
    print("Fill in 'spans' with BIOMARKER_NAME / VALUE / UNIT before training.")


if __name__ == "__main__":
    main()

