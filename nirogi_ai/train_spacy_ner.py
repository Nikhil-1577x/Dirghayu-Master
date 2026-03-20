from __future__ import annotations

"""
Train spaCy NER model for NIROGI biomarkers.

This script expects manually annotated data in:
    data/ner/annotations_labeled.jsonl

Each line is a JSON object:
{
  "id": "lab_report_1_page-0001",
  "text": "... full OCR text ...",
  "spans": [
    {"start": 120, "end": 125, "label": "BIOMARKER_NAME"},
    {"start": 126, "end": 129, "label": "VALUE"},
    {"start": 130, "end": 132, "label": "UNIT"}
  ]
}

Run with:
    python -m nirogi_ai.train_spacy_ner

It will save the trained model to:
    models/nirogi_biomarkers
You can then set NIROGI_SPACY_MODEL to that path.
"""

import json
from pathlib import Path
from typing import List, Dict, Any, Tuple

import spacy  # type: ignore
from spacy.training import Example  # type: ignore


PROJECT_ROOT = Path(__file__).resolve().parents[1]
NER_DIR = PROJECT_ROOT / "data" / "ner"
MODELS_DIR = PROJECT_ROOT / "models"
MODELS_DIR.mkdir(parents=True, exist_ok=True)


def load_annotations(path: Path) -> List[Tuple[str, Dict[str, Any]]]:
    data: List[Tuple[str, Dict[str, Any]]] = []
    with path.open("r", encoding="utf-8") as f:
        for line in f:
            line = line.strip()
            if not line:
                continue
            obj = json.loads(line)
            text = obj["text"]
            spans = obj.get("spans", [])
            entities = [(s["start"], s["end"], s["label"]) for s in spans]
            data.append((text, {"entities": entities}))
    return data


def train() -> None:
    labeled_path = NER_DIR / "annotations_labeled.jsonl"
    if not labeled_path.is_file():
        raise FileNotFoundError(
            f"Labeled annotations not found at {labeled_path}. "
            "Copy annotations_raw.jsonl to annotations_labeled.jsonl and fill spans."
        )

    train_data = load_annotations(labeled_path)
    print(f"Loaded {len(train_data)} annotated examples.")

    # Create a blank English model with NER
    nlp = spacy.blank("en")
    ner = nlp.add_pipe("ner")

    labels = {"BIOMARKER_NAME", "VALUE", "UNIT"}
    for label in labels:
        ner.add_label(label)

    # Convert to spaCy Examples
    examples: List[Example] = []
    for text, ann in train_data:
        doc = nlp.make_doc(text)
        examples.append(Example.from_dict(doc, ann))

    optimizer = nlp.begin_training()
    n_epochs = 30

    for epoch in range(1, n_epochs + 1):
        losses: Dict[str, float] = {}
        nlp.update(examples, sgd=optimizer, losses=losses)
        print(f"Epoch {epoch}/{n_epochs} - loss: {losses.get('ner', 0.0):.4f}")

    out_dir = MODELS_DIR / "nirogi_biomarkers"
    nlp.to_disk(out_dir)
    print(f"Saved spaCy NER model to {out_dir}")
    print("Set NIROGI_SPACY_MODEL to this path for ocr_pipeline to use it.")


if __name__ == "__main__":
    train()

