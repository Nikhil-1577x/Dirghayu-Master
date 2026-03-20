"""
narrative.py – Bridge to NIROGI narrative generation.

Wraps `nirogi_ai.generate_narrative(biomarker_struct)` while keeping the
existing simple `generate_summary(biomarker_dict)` interface used by the
backend services.
"""

import logging
from typing import Dict, Any

from nirogi_ai import generate_narrative  # type: ignore


logger = logging.getLogger(__name__)


def generate_summary(biomarker_dict: Dict[str, float]) -> str:
    """
    Generate a natural language clinical summary from biomarkers.

    Args:
        biomarker_dict: e.g. {"HbA1c": 6.4, "Fasting Glucose": 123.0}

    Returns:
        str: Human-readable clinical narrative.
    """
    logger.debug("generate_summary called with %d biomarkers", len(biomarker_dict))

    if not biomarker_dict:
        return "No biomarker data is currently available for this patient."

    structured: Dict[str, Dict[str, Any]] = {}
    for name, value in biomarker_dict.items():
        structured[name] = {
            "name": name,
            "value": value,
            "unit": "",
            "loinc": None,
            "raw_names": [name],
            "confidence": 0.8,
        }

    try:
        return generate_narrative(structured)
    except Exception as exc:
        logger.exception("NIROGI narrative generation failed: %s", exc)
        parts = [f"{k}: {v}" for k, v in sorted(biomarker_dict.items())]
        return (
            "Based on the available biomarkers, here is a preliminary summary: "
            + "; ".join(parts)
            + "."
        )
