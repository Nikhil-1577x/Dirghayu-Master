"""
diet_service.py - AI-assisted daily diet summary from real patient data.
"""
from __future__ import annotations

from typing import Any

from app.ai_modules.narrative import generate_summary
from app.utils.db_utils import fetchall, fetchone


def _latest_numeric(readings: list[dict], key: str) -> float | None:
    vals = [float(r["value"]) for r in readings if str(r.get("biomarker_type", "")).lower() == key and r.get("value") is not None]
    return vals[0] if vals else None


def generate_diet_summary(patient_id: int, *, include_ai: bool = True) -> dict[str, Any]:
    risk = fetchone(
        "SELECT score, risk_level FROM risk_scores WHERE patient_id = ? ORDER BY timestamp DESC LIMIT 1",
        (patient_id,),
    ) or {"score": 0.0, "risk_level": "LOW"}

    readings = fetchall(
        """
        SELECT biomarker_type, value, timestamp
        FROM biomarker_readings
        WHERE patient_id = ?
        ORDER BY timestamp DESC
        LIMIT 120
        """,
        (patient_id,),
    )

    fasting = _latest_numeric(readings, "fasting_glucose")
    blood = _latest_numeric(readings, "blood_glucose")
    postprandial = _latest_numeric(readings, "glucose_postprandial")
    systolic = _latest_numeric(readings, "systolic_bp")
    diastolic = _latest_numeric(readings, "diastolic_bp")

    glucose = next((v for v in [postprandial, blood, fasting] if v is not None), None)

    calories = 1800
    sodium = 2.0
    carbs = 220
    protein = 65
    suggestions: list[str] = []

    if float(risk.get("score", 0) or 0) >= 70:
        calories = 1600
        suggestions.append("Risk is elevated; keep meals lighter and distributed across the day.")

    if glucose is not None and glucose > 180:
        carbs = 150
        suggestions.append("Recent glucose is high; reduce refined carbs and prefer low-GI meals.")
    elif glucose is not None and glucose > 140:
        carbs = 180
        suggestions.append("Glucose trend is above optimal; moderate carb portions at dinner.")

    if systolic is not None and systolic > 130:
        sodium = 1.5
        suggestions.append("Blood pressure is elevated; reduce sodium and avoid packaged foods.")
    if diastolic is not None and diastolic > 90:
        sodium = min(sodium, 1.5)
        suggestions.append("Diastolic pressure is high; use low-sodium meals and hydration focus.")

    protein_vals = [float(r["value"]) for r in readings if "protein" in str(r.get("biomarker_type", "")).lower()]
    if len(protein_vals) >= 2 and protein_vals[0] < protein_vals[-1]:
        protein = 80
        suggestions.append("Protein trend is declining; increase lean protein intake.")

    # Keep dashboard path fast: use local narrative AI only (no remote network calls).
    ai_summary = ""
    narrative = ""
    if include_ai:
        try:
            latest_for_narrative = {}
            if glucose is not None:
                latest_for_narrative["Glucose"] = float(glucose)
            if systolic is not None:
                latest_for_narrative["Systolic BP"] = float(systolic)
            if diastolic is not None:
                latest_for_narrative["Diastolic BP"] = float(diastolic)
            if latest_for_narrative:
                narrative = generate_summary(latest_for_narrative)
                ai_summary = narrative
        except Exception:
            narrative = ""

    return {
        "calories": calories,
        "sodium": sodium,
        "carbs": carbs,
        "protein": protein,
        "suggestions": suggestions,
        "ai_summary": ai_summary,
        "narrative": narrative,
    }

