"""
Narrative generation for NIROGI lab reports.

Public entry point:
    generate_narrative(biomarker_dict: dict) -> str

This module will call the Claude API to generate a layperson explanation
of the biomarker values. For now it exposes a minimal stub so the backend
can integrate without waiting for the full implementation.
"""

from __future__ import annotations

from typing import Dict, Any, List

import os
import requests  # type: ignore


def generate_narrative(biomarker_dict: Dict[str, Any]) -> str:
    """
    Given the structured biomarker dictionary produced by ocr_pipeline.process_report,
    return a short plain-language explanation string.

    This is a stub implementation; in production it should call the Claude API
    using a prompt that respects NIROGI's safety and tone guidelines.
    """
    if not biomarker_dict:
        return "No biomarker values were detected in this report."

    # Prepare a compact, model-friendly summary of biomarkers.
    summary_items: List[str] = []
    for name, payload in sorted(biomarker_dict.items()):
        value = payload.get("value")
        unit = payload.get("unit") or ""
        loinc = payload.get("loinc") or ""
        part = f"{name}: {value}{unit and ' ' + unit}"
        if loinc:
            part += f" (LOINC {loinc})"
        summary_items.append(part)
    summary = "; ".join(summary_items)

    api_key = os.getenv("OPENROUTER_API_KEY")
    model = os.getenv("OPENROUTER_MODEL", "anthropic/claude-3-haiku")
    base_url = os.getenv("OPENROUTER_BASE_URL", "https://openrouter.ai/api/v1")

    if api_key:
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
                        {
                            "role": "system",
                            "content": (
                                "You are NIROGI, an assistant that explains lab "
                                "results to families in clear, simple language. "
                                "Be concise, avoid jargon, and highlight what the "
                                "doctor should know."
                            ),
                        },
                        {
                            "role": "user",
                            "content": (
                                "Here are the patient's current lab biomarkers:\n"
                                f"{summary}\n\n"
                                "Explain what this means for the patient's diabetes "
                                "and blood pressure control, and what the doctor may "
                                "want to focus on in the next visit."
                            ),
                        },
                    ],
                    "temperature": 0.2,
                    "max_tokens": 400,
                },
                timeout=20,
            )
            data = resp.json()
            choice = data.get("choices", [{}])[0]
            content = choice.get("message", {}).get("content", "")
            result = ""
            if isinstance(content, str):
                result = content
            elif isinstance(content, list):
                result = "".join(part.get("text", "") for part in content)
            if result and result.strip():
                return result.strip()
        except Exception:
            pass

    # Always return a non-empty fallback
    return (
        "Based on the extracted biomarkers: "
        f"{summary}. Share these results with your doctor at your next visit."
    )


__all__ = ["generate_narrative"]

