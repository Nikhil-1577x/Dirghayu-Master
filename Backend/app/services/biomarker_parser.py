"""
biomarker_parser.py – Rule-based biomarker extraction from OCR text.

This module intentionally uses simple, transparent regex heuristics on the OCR
output so it can work on unseen reports without hardcoded values.
"""

from __future__ import annotations

import json
import logging
import re
import os
from typing import Any, Dict, Optional

import requests  # type: ignore

from app.ai_modules.narrative import generate_summary

logger = logging.getLogger(__name__)


_NUM_RE = re.compile(r"(?<!\d)(\d{1,3}(?:[.,]\d{1,3})?)(?!\d)")
_UNIT_RE = re.compile(r"\b(mg/dl|mg/dL|mmol/l|mmol/L|%|g/dl|g/dL)\b")


def _to_float(num: str) -> Optional[float]:
    try:
        return float(num.replace(",", "."))
    except Exception:
        return None


def _unit_from_line(line: str) -> Optional[str]:
    m = _UNIT_RE.search(line)
    if not m:
        return None
    u = m.group(1)
    # normalize common casing
    if u.lower() == "mg/dl":
        return "mg/dL"
    if u.lower() == "mmol/l":
        return "mmol/L"
    if u.lower() == "g/dl":
        return "g/dL"
    return u


def _normalise_ocr_unit(unit: Optional[str]) -> Optional[str]:
    if not unit:
        return None
    u = unit.strip()
    lower = u.lower()
    # Common OCR glitches
    if lower in {"mgldl", "mg/di", "mg/d1", "mg/dl"}:
        return "mg/dL"
    if lower in {"mmoll", "mmol/l"}:
        return "mmol/L"
    if lower in {"gdl", "g/dl"}:
        return "g/dL"
    if lower in {"percent", "%"}:
        return "%"
    return u


def _normalise_name(name: str) -> str:
    """
    Normalise OCR biomarker names for matching.
    """
    s = (name or "").strip().lower()
    s = re.sub(r"\s+", " ", s)
    # Common OCR confusions
    s = s.replace("alc", "a1c")  # hemoglobin alc -> a1c
    s = s.replace("aic", "a1c")  # hbaic -> hba1c
    s = s.replace("hb a1c", "hba1c")
    s = s.replace("h b a1c", "hba1c")
    return s


BIOMARKERS: dict[str, list[str]] = {
    "glucose_fasting": ["glucose, fasting", "fasting glucose", "glucose fasting", "fbs", "fasting (plasma)"],
    "glucose_postprandial": [
        "postprandial glucose",
        "glucose postprandial",
        "pp glucose",
        "2 hour glucose",
        "2-hour glucose",
        "glucose 2 hour",
        "glucose 2-hour",
        "2hr glucose",
        "2 hrs glucose",
    ],
    "hba1c": ["hba1c", "hb a1c", "a1c", "glycated hemoglobin"],
}

BIOMARKER_ALIASES: dict[str, list[str]] = {
    "glucose_fasting": ["glucose fasting", "fasting glucose", "fbs", "gf"],
    "glucose_postprandial": ["postprandial glucose", "ppbs", "2-hour glucose", "2 hour glucose", "pp glucose"],
    "hba1c": ["hba1c", "hb a1c", "glycated hemoglobin", "alc", "a1c"],
}


def normalize_biomarker(name: str) -> str | None:
    """
    Map a raw biomarker name (or key) to a canonical biomarker key.
    """
    n = _normalise_name(name)
    for standard, aliases in BIOMARKER_ALIASES.items():
        if any(alias in n for alias in aliases):
            return standard
    return None


def extract_biomarkers_from_text(raw_text: str) -> Dict[str, Dict[str, Any]]:
    """
    Sliding-window biomarker extraction for multi-line OCR output.

    This intentionally does NOT assume a fixed table structure; it scans forward
    from a candidate biomarker name line to find a numeric value and unit.
    Returns ONLY detected biomarkers (no nulls).
    """
    lines = [l.strip().lower() for l in (raw_text or "").split("\n") if l.strip()]

    results: Dict[str, Dict[str, Any]] = {}

    for i in range(len(lines)):
        name = lines[i]

        # skip short/noisy lines
        if len(name) < 4:
            continue

        value: Optional[float] = None
        unit: Optional[str] = None

        # scan next few lines to find numeric value
        for j in range(1, 6):
            if i + j >= len(lines):
                break

            candidate = lines[i + j]

            # detect numeric value
            if re.match(r"^\d+(\.\d+)?$", candidate):
                try:
                    value = float(candidate)
                except Exception:
                    value = None

                # detect unit
                if i + j + 1 < len(lines):
                    next_line = lines[i + j + 1]
                    if re.search(r"(mg|g|%|mmol)", next_line):
                        unit = _normalise_ocr_unit(next_line.replace("mgldl", "mg/dl"))
                break

        if value is None:
            continue

        # normalize biomarker names
        key: Optional[str] = None

        if "fasting" in name:
            key = "glucose_fasting"
        elif "post" in name or "2-hour" in name or "2hour" in name or "2 hour" in name or "pp" in name:
            key = "glucose_postprandial"
        elif "hba" in name or "a1c" in name or "alc" in name:
            key = "hba1c"

        if key:
            norm = normalize_biomarker(key) or key
            results[norm] = {"value": value, "unit": unit}

    print("FINAL BIOMARKERS:", results, flush=True)
    logger.info("Extracted biomarkers (sliding-window): %s", json.dumps(results, ensure_ascii=False))
    return results


def build_row_blocks(raw_text: str) -> list[dict]:
    """
    Convert multi-line OCR into table-like rows:
      [Name]
      [Value]
      [Unit]
      [Reference...]
    """
    lines = [l.strip() for l in (raw_text or "").split("\n") if l.strip()]
    rows: list[dict] = []
    i = 0
    while i < len(lines):
        name = lines[i]
        # detect numeric value in next line
        if i + 1 < len(lines) and re.match(r"^\d+\.?\d*$", lines[i + 1]):
            value = lines[i + 1]
            unit = None
            if i + 2 < len(lines) and re.search(r"(mg|g|%|mmol)", lines[i + 2].lower()):
                unit = lines[i + 2]
            rows.append(
                {
                    "name": _normalise_name(name),
                    "value": value,
                    "unit": _normalise_ocr_unit(unit),
                    "raw_name": name,
                }
            )
            i += 3
        else:
            i += 1
    return rows


def parse_biomarkers_row_based(raw_text: str) -> Dict[str, Dict[str, Any]]:
    """
    Primary extractor: build row blocks then map to canonical biomarkers.
    Returns ONLY detected biomarkers (no nulls).
    """
    rows = build_row_blocks(raw_text)
    print("PARSED ROWS:", rows, flush=True)

    results: Dict[str, Dict[str, Any]] = {}
    for row in rows:
        nm = row.get("name", "")
        for key, aliases in BIOMARKERS.items():
            if any(alias in nm for alias in aliases):
                try:
                    value_f = float(str(row.get("value", "")).replace(",", "."))
                except Exception:
                    continue
                unit = row.get("unit") or ("%" if key == "hba1c" else "mg/dL")
                results[key] = {"value": value_f, "unit": _normalise_ocr_unit(str(unit)) if unit else unit}
    print("FINAL BIOMARKERS:", results, flush=True)
    logger.info("Extracted biomarkers (row-based): %s", json.dumps(results, ensure_ascii=False))
    return results


def _first_number_after_keywords(line: str, keywords: list[str]) -> Optional[float]:
    lower = line.lower()
    if not all(k in lower for k in keywords):
        return None
    # Find the first numeric token after the last keyword occurrence.
    last_idx = max(lower.rfind(k) for k in keywords)
    tail = line[last_idx:]
    m = _NUM_RE.search(tail)
    if not m:
        return None
    return _to_float(m.group(1))


def parse_biomarkers_from_text(ocr_text: str) -> Dict[str, Dict[str, Any]]:
    """
    Extract a small set of key biomarkers from OCR text.

    Returns a stable JSON-friendly dict:
      {
        "glucose_fasting": {"value": 108, "unit": "mg/dL"},
        "hba1c": {"value": 6.5, "unit": "%"}
      }
    """
    lines = [ln.strip() for ln in (ocr_text or "").splitlines() if ln.strip()]

    out: Dict[str, Dict[str, Any]] = {}

    # Fasting glucose: look for a line that has both "glucose" and "fast"
    for ln in lines:
        val = _first_number_after_keywords(ln, ["glucose", "fast"])
        if val is None:
            continue
        out["glucose_fasting"] = {
            "value": val,
            "unit": _unit_from_line(ln) or "mg/dL",
        }
        break

    # HbA1c: tolerate OCR variants like HBA1C / Hb A1c / Glycated Hemoglobin
    for ln in lines:
        lower = ln.lower()
        if "a1c" in lower or "hba1c" in lower or ("glycat" in lower and "hemoglobin" in lower):
            m = _NUM_RE.search(ln)
            if not m:
                continue
            val = _to_float(m.group(1))
            if val is None:
                continue
            out["hba1c"] = {"value": val, "unit": _unit_from_line(ln) or "%"}
            break

    # Random glucose (optional)
    for ln in lines:
        val = _first_number_after_keywords(ln, ["glucose", "random"])
        if val is None:
            continue
        out["glucose_random"] = {"value": val, "unit": _unit_from_line(ln) or "mg/dL"}
        break

    logger.info("Extracted biomarkers (rule-based): %s", json.dumps(out, ensure_ascii=False))
    return out


def summarize_report(ocr_text: str, structured_data: Dict[str, Dict[str, Any]]) -> str:
    """
    Generate a short medical summary using the existing LLM/narrative integration.

    We pass a flat dict of biomarker -> value into the narrative generator so the
    rest of the system stays consistent.
    """
    flat: Dict[str, float] = {}
    for k, v in (structured_data or {}).items():
        try:
            flat[k] = float(v.get("value"))  # type: ignore[arg-type]
        except Exception:
            continue

    summary = generate_summary(flat)
    logger.info("AI summary generated (len=%d)", len(summary or ""))
    return summary or ""


def _extract_json_object(text: str) -> Optional[dict]:
    """
    Best-effort extraction of the first JSON object from free-form model output.
    """
    if not text:
        return None
    start = text.find("{")
    end = text.rfind("}")
    if start < 0 or end < 0 or end <= start:
        return None
    snippet = text[start : end + 1]
    try:
        return json.loads(snippet)
    except Exception:
        return None


def _prefill_from_multiline_regex(ocr_text: str) -> Dict[str, Dict[str, Any] | None]:
    """
    Quick best-effort extraction across messy multi-line OCR text using DOTALL regex.
    This is used to prefill values before calling AI.
    """
    txt = (ocr_text or "").lower()
    prefill: Dict[str, Dict[str, Any] | None] = {
        "glucose_fasting": None,
        "glucose_postprandial": None,
        "hba1c": None,
    }

    def _num(m: re.Match) -> Optional[float]:
        return _to_float(m.group(1)) if m else None

    # Glucose fasting: allow intervening newlines/columns
    m = re.search(r"glucose[\s\S]{0,80}fast[\s\S]{0,80}?(\d{1,3}(?:[.,]\d{1,2})?)", txt, re.IGNORECASE)
    v = _num(m)
    if v is not None:
        prefill["glucose_fasting"] = {"value": v, "unit": "mg/dL"}

    # Postprandial / PP / 2 hour variants
    m = re.search(r"(post[\s\S]{0,30}prand|pp\b|2[\s\-]*hour)[\s\S]{0,120}?(\d{1,3}(?:[.,]\d{1,2})?)", txt, re.IGNORECASE)
    v = _num(m)
    if v is not None:
        prefill["glucose_postprandial"] = {"value": v, "unit": "mg/dL"}

    # HbA1c
    m = re.search(r"(hba1c|hb[\s\-]*a1c|a1c)[\s\S]{0,80}?(\d{1,2}(?:[.,]\d{1,2})?)", txt, re.IGNORECASE)
    v = _num(m)
    if v is not None:
        prefill["hba1c"] = {"value": v, "unit": "%"}

    return prefill


def llm_verify_and_summarize(
    ocr_text: str,
    structured_data: Dict[str, Dict[str, Any]],
) -> tuple[Dict[str, Dict[str, Any]], str]:
    """
    Use OpenRouter (existing LLM setup via env) to:
      1) verify/correct structured biomarkers
      2) produce a short 3–4 line health summary

    Returns: (corrected_structured_data, summary)
    Falls back to rule-based + existing narrative if LLM unavailable/fails.
    """
    api_key = os.getenv("OPENROUTER_API_KEY")
    model = os.getenv("OPENROUTER_MODEL", "anthropic/claude-3-haiku")
    base_url = os.getenv("OPENROUTER_BASE_URL", "https://openrouter.ai/api/v1")

    if not api_key:
        return structured_data, summarize_report(ocr_text, structured_data)

    prompt = (
        "You are a medical assistant. Extract and verify biomarkers from the report and provide "
        "a clean JSON + short health summary.\n\n"
        "OCR TEXT:\n"
        f"{ocr_text}\n\n"
        "RULE-BASED DATA:\n"
        f"{json.dumps(structured_data, ensure_ascii=False)}\n\n"
        "Return ONLY valid JSON in this exact shape:\n"
        "{\n"
        '  "biomarkers": {\n'
        '    "glucose_fasting": {"value": <number>, "unit": "mg/dL"},\n'
        '    "hba1c": {"value": <number>, "unit": "%"},\n'
        '    "glucose_random": {"value": <number>, "unit": "mg/dL"}\n'
        "  },\n"
        '  "summary": "<3-4 lines>"\n'
        "}\n"
        "Only include biomarkers you are confident about."
    )

    try:
        resp = requests.post(
            f"{base_url}/chat/completions",
            headers={
                "Authorization": f"Bearer {api_key}",
                "Content-Type": "application/json",
            },
            json={
                "model": model,
                "messages": [
                    {"role": "system", "content": "You are a careful medical extraction assistant."},
                    {"role": "user", "content": prompt},
                ],
                "temperature": 0.0,
                "max_tokens": 500,
            },
            timeout=30,
        )
        data = resp.json()
        choice = (data.get("choices") or [{}])[0]
        content = choice.get("message", {}).get("content", "")
        if isinstance(content, list):
            content = "".join(part.get("text", "") for part in content)
        if not isinstance(content, str):
            raise RuntimeError("Unexpected LLM response type")

        parsed = _extract_json_object(content)
        if not isinstance(parsed, dict):
            raise RuntimeError("LLM did not return parseable JSON")

        biomarkers = parsed.get("biomarkers")
        summary = parsed.get("summary", "")
        if isinstance(biomarkers, dict):
            corrected: Dict[str, Dict[str, Any]] = {}
            for k, v in biomarkers.items():
                if not isinstance(v, dict):
                    continue
                value = v.get("value")
                unit = v.get("unit")
                try:
                    value_f = float(value)
                except Exception:
                    continue
                corrected[str(k)] = {"value": value_f, "unit": unit}
            if corrected:
                logger.info("LLM corrected biomarkers: %s", json.dumps(corrected, ensure_ascii=False))
                return corrected, (str(summary).strip() if summary else "").strip() or summarize_report(ocr_text, corrected)

        # If no usable correction, fall back.
        return structured_data, (str(summary).strip() if summary else "").strip() or summarize_report(ocr_text, structured_data)
    except Exception as exc:
        logger.exception("LLM verify/summarize failed: %s", exc)
        return structured_data, summarize_report(ocr_text, structured_data)


def llm_extract_biomarkers_from_text(
    ocr_text: str,
) -> tuple[Dict[str, Dict[str, Any] | None], str]:
    """
    AI-first extraction directly from OCR text.

    Returns a dict with fixed keys; missing values MUST be null:
      {
        "glucose_fasting": {"value": 108, "unit": "mg/dL"} | null,
        "glucose_postprandial": {"value": 145, "unit": "mg/dL"} | null,
        "hba1c": {"value": 6.2, "unit": "%"} | null
      }
    plus a short 2–3 line summary.
    """
    api_key = os.getenv("OPENROUTER_API_KEY")
    model = os.getenv("OPENROUTER_MODEL", "anthropic/claude-3-haiku")
    base_url = os.getenv("OPENROUTER_BASE_URL", "https://openrouter.ai/api/v1")

    empty: Dict[str, Dict[str, Any] | None] = {
        "glucose_fasting": None,
        "glucose_postprandial": None,
        "hba1c": None,
    }

    prefill = _prefill_from_multiline_regex(ocr_text)

    if not api_key:
        # No API key: return empty extraction and no summary.
        return prefill, ""

    prompt = (
        "You are a medical data extraction system.\n\n"
        "The OCR text below is from a lab report. The data is messy and values may appear on separate lines.\n\n"
        "You MUST extract biomarkers even if:\n"
        "- Name, value, and unit are on different lines\n"
        "- Text formatting is broken\n\n"
        "Focus on:\n"
        "- Glucose Fasting\n"
        "- Glucose Postprandial (2-hour)\n"
        "- HbA1c\n\n"
        "OCR TEXT:\n"
        f"{ocr_text}\n\n"
        "---\n\n"
        "Return ONLY valid JSON (no explanation):\n\n"
        "{\n"
        '  "glucose_fasting": {"value": number, "unit": "mg/dL"},\n'
        '  "glucose_postprandial": {"value": number, "unit": "mg/dL"},\n'
        '  "hba1c": {"value": number, "unit": "%"},\n'
        '  "summary": "2-3 line summary"\n'
        "}\n\n"
        "Rules:\n"
        "- If value exists → extract it\n"
        "- If not found → set that biomarker object to null\n"
        '- Fix OCR unit errors like "mgldL" → "mg/dL"\n'
        "- DO NOT return an empty object\n"
        "- DO NOT return text outside JSON\n\n"
        "Prefill hints (may be wrong; verify against OCR TEXT):\n"
        f"{json.dumps(prefill, ensure_ascii=False)}"
    )

    logger.info("Sending OCR text to AI (len=%d)", len(ocr_text or ""))

    try:
        resp = requests.post(
            f"{base_url}/chat/completions",
            headers={
                "Authorization": f"Bearer {api_key}",
                "Content-Type": "application/json",
            },
            json={
                "model": model,
                "messages": [
                    {"role": "system", "content": "You extract structured lab biomarkers as JSON."},
                    {"role": "user", "content": prompt},
                ],
                "temperature": 0.0,
                "max_tokens": 450,
            },
            timeout=30,
        )
        data = resp.json()
        choice = (data.get("choices") or [{}])[0]
        content = choice.get("message", {}).get("content", "")
        if isinstance(content, list):
            content = "".join(part.get("text", "") for part in content)
        if not isinstance(content, str):
            raise RuntimeError("Unexpected LLM response type")

        parsed = _extract_json_object(content)
        if not isinstance(parsed, dict):
            raise RuntimeError("LLM did not return parseable JSON")

        summary = str(parsed.get("summary", "") or "").strip()

        result: Dict[str, Dict[str, Any] | None] = dict(empty)
        for key in list(empty.keys()):
            val = parsed.get(key, None)
            if val is None:
                result[key] = None
                continue
            if not isinstance(val, dict):
                result[key] = None
                continue
            try:
                value_f = float(val.get("value"))
            except Exception:
                result[key] = None
                continue
            unit = _normalise_ocr_unit(val.get("unit"))  # type: ignore[arg-type]
            result[key] = {"value": value_f, "unit": unit}

        # Merge: if AI missed a value but regex prefill found it, keep the prefill.
        for key in list(empty.keys()):
            if result.get(key) is None and prefill.get(key) is not None:
                result[key] = prefill[key]

        # If AI returned nothing but we have prefill, keep prefill (never empty).
        if not any(v is not None for v in result.values()) and any(v is not None for v in prefill.values()):
            result = prefill

        logger.info("AI extracted biomarkers: %s", json.dumps(result, ensure_ascii=False))
        return result, summary
    except Exception as exc:
        logger.exception("AI extraction failed: %s", exc)
        # Return prefill if we have anything at all.
        if any(v is not None for v in prefill.values()):
            logger.info("Returning regex prefill biomarkers after AI failure.")
            return prefill, ""
        return empty, ""


__all__ = [
    "parse_biomarkers_row_based",
    "extract_biomarkers_from_text",
    "normalize_biomarker",
    "parse_biomarkers_from_text",
    "summarize_report",
    "llm_verify_and_summarize",
    "llm_extract_biomarkers_from_text",
]

