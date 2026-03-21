"""
adherence_routes.py – Adherence endpoints.
"""
from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from app.database import get_db

from app.services.adherence_engine import (
    get_daily_adherence,
    get_weekly_adherence,
    get_missed_doses,
    get_adherence_history,
)

router = APIRouter(prefix="/patient", tags=["Adherence"])


@router.get("/{id}/adherence")
def get_adherence(id: int, db: Session = Depends(get_db)):
    """
    Returns daily adherence, weekly score, and missed doses list.
    """
    daily = get_daily_adherence(id)
    weekly = get_weekly_adherence(id)
    missed = get_missed_doses(id)
    return {
        "patient_id": id,
        "daily_adherence": daily,
        "weekly_score": weekly["weekly_score"],
        "weekly_adherence": weekly,
        "missed_doses": missed,
    }


@router.get("/{id}/adherence/history")
def get_adherence_history_route(id: int, days: int = 365, db: Session = Depends(get_db)):
    """
    Returns day-wise adherence history for the heatmap.
    """
    return {
        "patient_id": id,
        "days": max(1, min(int(days), 365)),
        "history": get_adherence_history(id, days=days),
    }
