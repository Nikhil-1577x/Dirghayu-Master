"""
predict.py – Bridge to NIROGI LSTM risk prediction.

Wraps `nirogi_ai.get_risk_score(features)` and adapts its 0–1 probability
to the backend's 0–100 risk score convention.
"""

import logging
from typing import Dict, Any

from nirogi_ai import get_risk_score  # type: ignore


logger = logging.getLogger(__name__)


def predict_risk(patient_features: Dict[str, Any]) -> float:
    """
    Predict the risk score for a patient.

    Args:
        patient_features: dict containing (at minimum):
            - patient_id (int)
            - age (int)
            - gender (str)
            - weekly_adherence (float): percentage 0-100
            - total_missed (int)
            - avg_blood_glucose (float, optional)

    Returns:
        float: risk score in range 0.0 – 100.0
    """
    logger.debug("predict_risk called for patient %s", patient_features.get("patient_id"))

    age = float(patient_features.get("age", 60))
    gender = str(patient_features.get("gender", "")).lower()
    weekly_adherence = float(patient_features.get("weekly_adherence", 100.0))
    total_missed = float(patient_features.get("total_missed", 0))
    avg_glucose = float(patient_features.get("avg_blood_glucose", 110.0))

    features = {
        "age": age,
        "sex_female": 1.0 if gender.startswith("f") else 0.0,
        "sex_male": 1.0 if gender.startswith("m") else 0.0,
        "adherence_7d": weekly_adherence / 100.0,
        "adherence_30d": weekly_adherence / 100.0,
        "missed_doses_7d": total_missed,
        "refill_gap_days": 0.0,
        "glu_value": avg_glucose,
    }

    try:
        prob = get_risk_score(features)  # 0–1
    except Exception as exc:
        logger.exception("NIROGI risk prediction failed: %s", exc)
        return 0.0

    score = round(max(0.0, min(100.0, prob * 100.0)), 2)
    logger.info("NIROGI risk score computed: %.2f for patient %s", score, patient_features.get("patient_id"))
    return score
