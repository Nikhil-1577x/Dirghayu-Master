"""
regex_patterns.py – Shared regexes and biomarker name normalisation.

This module contains NO hardcoded values – only mappings from textual labels
to canonical biomarker identifiers.
"""

from __future__ import annotations

from typing import Dict, Optional


# Map various textual labels found in lab reports to canonical biomarker names.
BIOMARKER_NAME_MAP: Dict[str, str] = {
    # Fasting glucose
    "glucose, fasting": "fasting_glucose",
    "fasting glucose": "fasting_glucose",
    "glucose fasting": "fasting_glucose",
    "fbs": "fasting_glucose",
    "fasting blood sugar": "fasting_glucose",
    # Random blood sugar
    "blood sugar random": "glucose_random",
    "random blood sugar": "glucose_random",
    "glucose random": "glucose_random",
    "random glucose": "glucose_random",
    "rbs": "glucose_random",
    # HbA1c
    "hba1c": "hba1c",
    "hb a1c": "hba1c",
    "glycated hemoglobin": "hba1c",
    "glycosylated hemoglobin": "hba1c",
    # Estimated average glucose
    "estimated average glucose": "estimated_avg_glucose",
    "average blood glucose (abg)": "estimated_avg_glucose",
    "average blood glucose": "estimated_avg_glucose",
    "eag": "estimated_avg_glucose",
}


def normalise_label(label: str) -> Optional[str]:
    """
    Normalise a raw test name to a canonical biomarker identifier.

    The mapping is intentionally conservative and substring-based, so that
    labels like "Glucose, Fasting (Plasma)" still map to `fasting_glucose`.
    """
    key = " ".join(label.lower().replace("\t", " ").split())
    if not key:
        return None

    # Direct exact match first
    if key in BIOMARKER_NAME_MAP:
        return BIOMARKER_NAME_MAP[key]

    # Substring match as a fallback (e.g. "glucose, fasting plasma")
    for pattern, canonical in BIOMARKER_NAME_MAP.items():
        if pattern in key:
            return canonical

    return None


__all__ = ["BIOMARKER_NAME_MAP", "normalise_label"]

