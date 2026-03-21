"""
biomarker_trends.py – Persistent biomarker history + trend-based AI summary.

This module stores biomarkers per report upload and generates a concise trend
summary using the latest report + previous 10 reports (total 11).
"""

from __future__ import annotations

import json
import os
import time
import uuid
from collections import defaultdict
from typing import Any, Dict, Tuple, Iterable, Optional

import requests  # type: ignore

import logging

from app.utils.db_utils import executemany, fetchall, fetchone, execute, rows_to_dicts

logger = logging.getLogger(__name__)


def ensure_patient_exists(patient_id: int) -> None:
    row = fetchone("SELECT id FROM patients WHERE id = ?", (patient_id,))
    if row is not None:
        return
    raise ValueError(f"Patient {patient_id} not found")


def create_report_id() -> str:
    return str(uuid.uuid4())


def store_biomarkers_for_report(
    patient_id: int,
    report_id: str,
    biomarkers: Dict[str, Dict[str, Any]],
) -> int:
    """
    Persist a biomarker dict (canonical keys) for a given report_id.
    Returns number of records inserted.
    """
    if not biomarkers:
        return 0
    params: list[tuple] = []
    for name, payload in biomarkers.items():
        if not isinstance(payload, dict):
            continue
        value = payload.get("value")
        unit = payload.get("unit")
        if value is None:
            continue
        try:
            value_f = float(value)
        except Exception:
            continue
        params.append((patient_id, report_id, str(name), value_f, str(unit) if unit is not None else None))

    if not params:
        return 0

    executemany(
        "INSERT INTO biomarker_records (patient_id, report_id, biomarker_name, value, unit) VALUES (?, ?, ?, ?, ?)",
        params,
    )
    return len(params)


def fetch_recent_history(patient_id: int, max_rows: int = 200) -> Dict[str, list[float]]:
    rows = fetchall(
        """
        SELECT biomarker_name, value, created_at
        FROM biomarker_records
        WHERE patient_id = ?
        ORDER BY created_at DESC
        LIMIT ?
        """,
        (patient_id, max_rows),
    )
    data = rows_to_dicts(rows)
    history: dict[str, list[float]] = defaultdict(list)
    for r in data:
        history[str(r["biomarker_name"])].append(float(r["value"]))
    return history


def fetch_last_report_ids(patient_id: int, limit_reports: int = 11) -> list[str]:
    """
    Return last N distinct report_ids (most recent first) for a patient.
    """
    rows = fetchall(
        """
        SELECT report_id, MAX(datetime(created_at)) AS last_ts
        FROM biomarker_records
        WHERE patient_id = ?
        GROUP BY report_id
        ORDER BY last_ts DESC
        LIMIT ?
        """,
        (patient_id, limit_reports),
    )
    return [str(r["report_id"]) for r in rows]


def fetch_history_for_reports(patient_id: int, report_ids: list[str]) -> tuple[dict[str, list[float]], dict[str, dict[str, Any]]]:
    """
    Fetch biomarker values for a set of report_ids and return:
      - history: biomarker -> [values newest->oldest across those reports]
      - latest_values: biomarker -> {"value": float, "unit": str|None} from the most recent report in report_ids[0]
    """
    if not report_ids:
        return {}, {}
    placeholders = ",".join(["?"] * len(report_ids))
    rows = fetchall(
        f"""
        SELECT report_id, biomarker_name, value, unit, created_at
        FROM biomarker_records
        WHERE patient_id = ? AND report_id IN ({placeholders})
        ORDER BY created_at DESC
        """,
        (patient_id, *report_ids),
    )
    data = rows_to_dicts(rows)
    history: dict[str, list[float]] = defaultdict(list)
    latest_report = report_ids[0]
    latest_values: dict[str, dict[str, Any]] = {}
    for r in data:
        name = str(r["biomarker_name"])
        history[name].append(float(r["value"]))
        if str(r["report_id"]) == latest_report and name not in latest_values:
            latest_values[name] = {"value": float(r["value"]), "unit": r.get("unit")}
    return history, latest_values


def build_trend_input(history: Dict[str, list[float]], last_n: int = 11) -> str:
    lines: list[str] = []
    for name, values in sorted(history.items()):
        lines.append(f"{name}: {values[:last_n]}")
    return "\n".join(lines)


def build_history_latest_11_reports(patient_id: int, max_rows: int = 400) -> tuple[dict[str, list[float]], dict[str, dict[str, Any]], list[str]]:
    """
    Fetch rows, group by report_id, and return history for:
      - latest report + previous 10 reports (total 11)

    Ensures index 0 in each list is always the latest report value.

    Returns: (history, latest_values, report_ids_used)
    """
    rows = fetchall(
        """
        SELECT report_id, biomarker_name, value, unit, created_at
        FROM biomarker_records
        WHERE patient_id = ?
        ORDER BY created_at DESC
        LIMIT ?
        """,
        (patient_id, max_rows),
    )
    data = rows_to_dicts(rows)
    if not data:
        return {}, {}, []

    # Preserve report order by first appearance in DESC rows (newest first)
    report_ids: list[str] = []
    seen: set[str] = set()
    for r in data:
        rid = str(r["report_id"])
        if rid in seen:
            continue
        seen.add(rid)
        report_ids.append(rid)
        if len(report_ids) >= 11:
            break

    if not report_ids:
        return {}, {}, []

    # Group rows by report_id, but keep only selected report_ids
    by_report: dict[str, list[dict]] = {rid: [] for rid in report_ids}
    for r in data:
        rid = str(r["report_id"])
        if rid in by_report:
            by_report[rid].append(r)

    latest_report = report_ids[0]
    latest_values: dict[str, dict[str, Any]] = {}
    history: dict[str, list[float]] = defaultdict(list)

    # Build per-biomarker sequences in report order (latest->older)
    for rid in report_ids:
        for r in by_report.get(rid, []):
            name = str(r["biomarker_name"])
            val = float(r["value"])
            history[name].append(val)
            if rid == latest_report and name not in latest_values:
                latest_values[name] = {"value": val, "unit": r.get("unit")}

    return history, latest_values, report_ids


def generate_trend_ai_summary(
    history: Dict[str, list[float]],
    latest_values: dict[str, dict[str, Any]] | None = None,
    *,
    return_error: bool = False,
) -> str | tuple[str, Optional[dict]]:
    api_key = os.getenv("OPENROUTER_API_KEY")
    model = os.getenv("OPENROUTER_MODEL", "anthropic/claude-3-haiku")
    base_url = os.getenv("OPENROUTER_BASE_URL", "https://openrouter.ai/api/v1")
    summary_input = build_trend_input(history, last_n=11)
    latest_block = ""
    if latest_values:
        latest_block = "Latest extracted values (most recent report):\n" + json.dumps(latest_values, ensure_ascii=False) + "\n\n"

    if not summary_input.strip():
        raise RuntimeError("No historical biomarker data available yet (history empty).")

    prompt = f"""
You are a medical assistant.

Analyze patient biomarker trends over the most recent 11 reports (latest + previous 10). Prioritize the latest extracted values first.

{latest_block}Trends (last 11 values, newest first):

{summary_input}

Instructions:
- Identify improving or worsening trends
- Mention abnormalities
- Suggest if doctor consultation is needed
- Keep it concise (5-6 lines)

Return only plain text summary.
""".strip()

    if not api_key:
        raise RuntimeError("OPENROUTER_API_KEY is missing (backend .env not loaded).")

    try:
        payload = {
            "model": model,
            "messages": [
                {"role": "system", "content": "You write concise medical trend summaries."},
                {"role": "user", "content": prompt},
            ],
            "temperature": 0.2,
            "max_tokens": 250,
        }

        # Log request details (never log the API key).
        logger.info("OpenRouter request model=%s base_url=%s", model, base_url)
        logger.debug("OpenRouter request payload=%s", json.dumps(payload, ensure_ascii=False)[:2000])

        resp = requests.post(
            f"{base_url}/chat/completions",
            headers={"Authorization": f"Bearer {api_key}", "Content-Type": "application/json"},
            json=payload,
            timeout=30,
        )
        if getattr(resp, "status_code", 0) != 200:
            body = getattr(resp, "text", "")
            logger.error("OpenRouter error status=%s body=%r", getattr(resp, "status_code", None), body[:2000])
            raise RuntimeError(f"OpenRouter status {getattr(resp, 'status_code', None)}: {body[:2000]}")
        data = resp.json()
        choice = (data.get("choices") or [{}])[0]
        content = choice.get("message", {}).get("content", "")
        if isinstance(content, list):
            content = "".join(part.get("text", "") for part in content)
        if isinstance(content, str) and content.strip():
            out = content.strip()
            return (out, None) if return_error else out
        raise RuntimeError("OpenRouter returned empty content")
    except Exception as exc:
        logger.exception("Trend AI summary failed: %s", exc)
        reason = str(exc)
        err_obj: Optional[dict] = None
        if "OpenRouter status" in reason:
            status_code: Optional[int] = None
            try:
                after = reason.split("OpenRouter status", 1)[1].strip()
                status_str = after.split(":", 1)[0].strip()
                status_code = int(status_str) if status_str.isdigit() else None
            except Exception:
                status_code = None
            err_obj = {"source": "openrouter", "status": status_code, "message": reason[:2000]}
        if return_error:
            return ("", err_obj)
        raise


__all__ = [
    "ensure_patient_exists",
    "create_report_id",
    "store_biomarkers_for_report",
    "fetch_recent_history",
    "fetch_last_report_ids",
    "fetch_history_for_reports",
    "generate_trend_ai_summary",
]

