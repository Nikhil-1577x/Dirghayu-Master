"""
Behavioral pattern detection for NIROGI.

Public entry point:
    detect_patterns(dose_history: list[dict]) -> list[dict]

This module analyses dose history (and later, optionally, vital signs and
meal timing) to flag patterns such as:
    - consistently skipped dose slots
    - rationing behavior before refill
    - dietary correlation with blood pressure readings
"""

from __future__ import annotations

from collections import defaultdict
from datetime import datetime
from typing import Any, Dict, List


def detect_patterns(dose_history: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
    """
    Inspect dose history and return a list of pattern dicts.

    This is a conservative, threshold-based implementation that can be
    enriched over time without changing the external interface.
    """
    if not dose_history:
        return []

    patterns: List[Dict[str, Any]] = []

    patterns.extend(_detect_consistently_skipped_slots(dose_history))
    patterns.extend(_detect_rationing_before_refill(dose_history))

    # Dietary correlation with BP readings will be added later when the
    # backend passes additional context; we keep the function signature
    # stable so integration does not break.

    return patterns


def _slot_from_time(iso_or_time: str) -> str:
    if ":" in iso_or_time and "T" not in iso_or_time and len(iso_or_time) <= 5:
        # Handle HH:MM format
        hour = int(iso_or_time.split(":")[0])
    else:
        # Handle ISO format
        dt = datetime.fromisoformat(iso_or_time)
        hour = dt.hour
    if 5 <= hour < 12:
        return "morning"
    if 12 <= hour < 17:
        return "afternoon"
    if 17 <= hour < 22:
        return "evening"
    return "night"


def _detect_consistently_skipped_slots(
    dose_history: List[Dict[str, Any]],
) -> List[Dict[str, Any]]:
    by_slot = defaultdict(lambda: {"total": 0, "missed": 0})

    for dose in dose_history:
        scheduled = dose.get("scheduled_time")
        st = (dose.get("status") or "").lower().replace("taken", "on_time")
        if not scheduled or st not in {"on_time", "late", "missed"}:
            continue

        slot = _slot_from_time(scheduled)
        by_slot[slot]["total"] += 1
        if st == "missed":
            by_slot[slot]["missed"] += 1

    results: List[Dict[str, Any]] = []
    for slot, stats in by_slot.items():
        total = stats["total"]
        missed = stats["missed"]
        if total < 10:
            continue  # need enough data
        missed_rate = missed / total
        if missed_rate >= 0.4:
            results.append(
                {
                    "type": "consistently_skipped_slot",
                    "slot": slot,
                    "supporting_doses": total,
                    "adherence_rate": 1.0 - missed_rate,
                    "description": (
                        f"{slot.capitalize()} slot shows {missed_rate:.0%} missed doses "
                        f"over {total} scheduled doses."
                    ),
                }
            )

    return results


def _detect_rationing_before_refill(
    dose_history: List[Dict[str, Any]],
) -> List[Dict[str, Any]]:
    """
    Detect drop in adherence in the last few days of the refill cycle.

    Expects an optional 'refill_cycle_day' key in each dose entry, counting
    days since last refill starting at 1.
    """
    # Group by refill_cycle_day buckets.
    early_total = 0
    early_taken = 0
    late_total = 0
    late_taken = 0

    for dose in dose_history:
        day = dose.get("refill_cycle_day")
        st = (dose.get("status") or "").lower().replace("taken", "on_time")
        if not isinstance(day, int) or day <= 0:
            continue
        if st not in {"on_time", "late", "missed"}:
            continue

        # Consider early window as days 1–20, late window as day >= 21.
        taken = st in {"on_time", "late"}

        if day <= 20:
            early_total += 1
            if taken:
                early_taken += 1
        elif day >= 21:
            late_total += 1
            if taken:
                late_taken += 1

    if early_total < 10 or late_total < 5:
        return []

    early_rate = early_taken / early_total
    late_rate = late_taken / late_total
    drop = early_rate - late_rate

    if drop < 0.2:
        return []

    return [
        {
            "type": "rationing_before_refill",
            "window_days": 5,
            "adherence_before_window": round(early_rate, 3),
            "adherence_in_window": round(late_rate, 3),
            "description": (
                "Adherence drops significantly near the end of the refill cycle "
                f"(from {early_rate:.0%} to {late_rate:.0%}), suggesting rationing."
            ),
        }
    ]


__all__ = ["detect_patterns"]

