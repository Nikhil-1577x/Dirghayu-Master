"""
signals_service.py - Generate deterioration signals from real patient data.
"""
from __future__ import annotations

from typing import Any

from app.ai_modules.predict import predict_risk
from app.services.diet_service import generate_diet_summary
from app.services.exercise_service import generate_exercise_summary
from app.services.adherence_engine import get_missed_doses, get_weekly_adherence, get_daily_adherence
from app.services.risk_service import get_latest_risk
from app.utils.db_utils import fetchall, fetchone


def _severity(score: float, warn: float, crit: float) -> str:
    if score >= crit:
        return "critical"
    if score >= warn:
        return "warning"
    return "good"


def generate_deterioration_signals(patient_id: int) -> list[dict[str, Any]]:
    rows = fetchall(
        """
        SELECT biomarker_type, value, timestamp
        FROM biomarker_readings
        WHERE patient_id = ?
        ORDER BY timestamp DESC
        LIMIT 200
        """,
        (patient_id,),
    )
    risk_rows = fetchall(
        """
        SELECT score, timestamp
        FROM risk_scores
        WHERE patient_id = ?
        ORDER BY timestamp DESC
        LIMIT 10
        """,
        (patient_id,),
    )
    missed = get_missed_doses(patient_id)
    weekly = get_weekly_adherence(patient_id)
    daily = get_daily_adherence(patient_id)
    patient = fetchone("SELECT age, gender FROM patients WHERE id = ?", (patient_id,)) or {}

    def vals(names: set[str]) -> list[float]:
        return [float(r["value"]) for r in rows if str(r.get("biomarker_type", "")).lower() in names]

    glucose_vals = vals({"fasting_glucose", "blood_glucose", "glucose_postprandial"})
    systolic_vals = vals({"systolic_bp"})

    latest_glucose = glucose_vals[0] if glucose_vals else 0.0
    latest_sys = systolic_vals[0] if systolic_vals else 0.0
    # Keep signals endpoint fast; avoid nested AI calls.
    diet = generate_diet_summary(patient_id, include_ai=False)
    exercise = generate_exercise_summary(patient_id, include_ai=False)

    signals: list[dict[str, Any]] = []
    has_glucose = latest_glucose is not None and float(latest_glucose) > 0
    has_systolic = latest_sys is not None and float(latest_sys) > 0

    bp_rising = 0.0
    if len(systolic_vals) >= 2:
        bp_rising = systolic_vals[0] - systolic_vals[min(len(systolic_vals) - 1, 4)]
    if has_glucose:
        signals.append(
            {
                "title": "Glucose spike",
                "description": f"Latest glucose reading is {latest_glucose:.1f} mg/dL.",
                "severity": _severity(latest_glucose, 140, 180),
                "duration": "recent",
            }
        )

    if has_systolic:
        signals.append(
            {
                "title": "BP trend",
                "description": f"Systolic BP trend delta is {bp_rising:.1f} mmHg over recent readings.",
                "severity": "critical" if latest_sys >= 150 else ("warning" if latest_sys >= 130 or bp_rising >= 10 else "good"),
                "duration": "7 days",
            }
        )

    missed_recent = len(missed[:3])
    signal_missed = {
        "title": "Missed medication streak",
        "description": (
            f"{len(missed)} missed dose events found; {missed_recent} are recent. "
            f"Daily adherence={daily.get('daily_score', 0)}%, weekly adherence={weekly.get('weekly_score', 0)}%."
        ),
        "severity": "critical" if missed_recent >= 3 else ("warning" if missed_recent >= 1 else "good"),
        "duration": "recent",
    }
    signals.append(signal_missed)

    # Sodium proxy from BP trend/high BP since sodium biomarker may be absent.
    if has_systolic:
        signal_sodium = {
            "title": "High sodium pattern",
            "description": "Inferred from persistent high BP trend and risk context.",
            "severity": "warning" if latest_sys >= 135 else "good",
            "duration": "7 days",
        }
        signals.append(signal_sodium)

    risk_jump = 0.0
    if len(risk_rows) >= 2:
        risk_jump = float(risk_rows[0]["score"]) - float(risk_rows[min(len(risk_rows) - 1, 4)]["score"])
    latest_risk = float(risk_rows[0]["score"]) if risk_rows else float((get_latest_risk(patient_id) or {"score": 0}).get("score", 0))
    has_risk = latest_risk is not None and float(latest_risk) > 0
    if has_risk:
        signal_risk = {
            "title": "Risk score jump",
            "description": f"Current risk score is {latest_risk:.1f}, recent jump {risk_jump:.1f}.",
            "severity": "critical" if latest_risk >= 70 or risk_jump >= 15 else ("warning" if latest_risk >= 40 or risk_jump >= 7 else "good"),
            "duration": "30 days",
        }
        signals.append(signal_risk)
    low_steps = int(exercise.get("steps", 0) or 0) < 5000
    low_activity = int(exercise.get("active_minutes", 0) or 0) < 25
    high_sodium_target = float(diet.get("sodium", 2.0) or 2.0) >= 2.0
    lifestyle_severity = "critical" if (low_steps and high_sodium_target and missed_recent >= 2) else ("warning" if (low_steps or low_activity or high_sodium_target) else "good")
    signal_lifestyle = {
        "title": "Lifestyle deterioration",
        "description": (
            f"Steps={exercise.get('steps', 0)}, active_minutes={exercise.get('active_minutes', 0)}, "
            f"sodium_target={diet.get('sodium', 0)}g, meds taken={weekly.get('taken', 0)}, missed={weekly.get('missed', 0)}."
        ),
        "severity": lifestyle_severity,
        "duration": "7 days",
    }
    signals.append(signal_lifestyle)

    ai_note = ""
    try:
        ai_risk = predict_risk(
            {
                "patient_id": patient_id,
                "age": float(patient.get("age", 55) or 55),
                "gender": str(patient.get("gender", "unknown") or "unknown"),
                "weekly_adherence": float(weekly.get("weekly_score", 0) or 0),
                "total_missed": float(weekly.get("missed", 0) or 0),
                "avg_blood_glucose": float(latest_glucose or 110.0),
            }
        )
        ai_note = f"AI model risk estimate is {ai_risk:.1f}. Combined trend indicates {'high deterioration risk' if ai_risk >= 70 else ('moderate deterioration risk' if ai_risk >= 40 else 'stable risk')}."
    except Exception:
        ai_note = ""

    # Show AI summary only when at least one biomarker/risk value is available.
    if has_glucose or has_systolic or has_risk:
        signal_ai = {
            "title": "AI deterioration summary",
            "description": ai_note or "AI summary unavailable; using rule-based monitoring.",
            "severity": "critical" if latest_risk >= 70 else ("warning" if latest_risk >= 40 else "good"),
            "duration": "current",
        }
        signals.append(signal_ai)

    return signals

