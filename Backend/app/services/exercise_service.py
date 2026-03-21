"""
exercise_service.py - AI-assisted exercise summary from adherence/risk/environment.
"""
from __future__ import annotations

from typing import Any

from app.ai_modules.predict import predict_risk
from app.services.adherence_engine import get_weekly_adherence
from app.services.risk_service import get_latest_risk
from app.utils.db_utils import fetchall, fetchone


def generate_exercise_summary(patient_id: int, *, include_ai: bool = True) -> dict[str, Any]:
    adherence = get_weekly_adherence(patient_id)
    risk = get_latest_risk(patient_id) or {"score": 0, "risk_level": "LOW"}
    env = fetchone(
        """
        SELECT temperature_c, humidity_pct
        FROM environment_readings
        WHERE patient_id = ?
        ORDER BY timestamp DESC
        LIMIT 1
        """,
        (patient_id,),
    )

    weekly_score = float(adherence.get("weekly_score", 0.0) or 0.0)
    risk_score = float(risk.get("score", 0.0) or 0.0)
    latest_bio = fetchall(
        """
        SELECT biomarker_type, value
        FROM biomarker_readings
        WHERE patient_id = ?
        ORDER BY timestamp DESC
        LIMIT 20
        """,
        (patient_id,),
    )
    glucose_vals = [float(r["value"]) for r in latest_bio if str(r.get("biomarker_type", "")).lower() in {"blood_glucose", "fasting_glucose", "glucose_postprandial"}]
    avg_glucose = (sum(glucose_vals) / len(glucose_vals)) if glucose_vals else 110.0

    # Deterministic defaults driven from real data.
    if risk_score >= 70:
        steps = 3500
        active_minutes = 20
        goal_message = "Risk is high; prefer low-intensity walking and supervised activity."
    elif risk_score >= 40:
        steps = 5500
        active_minutes = 30
        goal_message = "Moderate risk; maintain consistent daily movement and hydration."
    else:
        steps = 7000
        active_minutes = 45
        goal_message = "Risk is stable; aim for brisk walks and regular strength work."

    if weekly_score >= 85:
        steps += 500
        active_minutes += 5
        goal_message = "Great adherence this week; continue progressive activity goals."
    elif weekly_score < 60:
        steps -= 500
        active_minutes = max(15, active_minutes - 5)
        goal_message = "Medication adherence dropped; prioritize routine before intensity."

    if env and float(env.get("temperature_c", 0) or 0) > 32:
        goal_message += " It's hot currently; exercise indoors or during cooler hours."
    if avg_glucose >= 180:
        active_minutes = max(20, active_minutes - 5)
        goal_message += " Glucose is high; prioritize post-meal light walks and avoid overexertion."

    # AI adjustment layer using existing risk predictor features.
    if include_ai:
        try:
            ai_risk = predict_risk(
                {
                    "patient_id": patient_id,
                    "age": 55,
                    "gender": "unknown",
                    "weekly_adherence": weekly_score,
                    "total_missed": float(adherence.get("missed", 0)),
                    "avg_blood_glucose": avg_glucose,
                }
            )
            if ai_risk >= 75:
                steps = min(steps, 4000)
                active_minutes = min(active_minutes, 25)
                goal_message = "AI risk indicates caution today; keep exercise gentle and regular."
        except Exception:
            pass

    calories_burned = int((steps * 0.04) + (active_minutes * 5))

    return {
        "steps": int(max(1500, steps)),
        "active_minutes": int(max(10, active_minutes)),
        "calories_burned": int(max(80, calories_burned)),
        "goal_message": goal_message,
    }

