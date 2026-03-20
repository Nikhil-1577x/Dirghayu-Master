"""
NIROGI AI core intelligence package.

This package exposes high-level, stateless functions used by the backend:

- predict.get_risk_score(features) -> float
- narrative.generate_narrative(biomarker_dict) -> str
- behavioral.detect_patterns(dose_history) -> list
"""

from .predict import get_risk_score  # noqa: F401
from .narrative import generate_narrative  # noqa: F401
from .behavioral import detect_patterns  # noqa: F401

