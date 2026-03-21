"""
pdf_service.py - Doctor-focused 1-2 page clinical summary PDF generation.
"""
from __future__ import annotations

from datetime import datetime, timedelta
from pathlib import Path
from typing import Any

from reportlab.lib import colors
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import ParagraphStyle, getSampleStyleSheet
from reportlab.lib.units import cm
from reportlab.platypus import HRFlowable, Paragraph, SimpleDocTemplate, Spacer, Table, TableStyle

from app.services.adherence_engine import get_daily_adherence, get_weekly_adherence
from app.services.biomarker_service import get_biomarkers, get_latest_biomarkers
from app.services.signals_service import generate_deterioration_signals
from app.services.risk_service import get_latest_risk
from app.ai_modules.narrative import generate_summary
from app.utils.db_utils import fetchall, fetchone, rows_to_dicts


def _safe_tmp_path(patient_id: int) -> Path:
    out_dir = Path("/tmp")
    out_dir.mkdir(parents=True, exist_ok=True)
    return out_dir / f"patient_{patient_id}_report.pdf"


def _table(rows: list[list[str]], col_widths: list[float] | None = None, header: bool = True) -> Table:
    table = Table(rows, colWidths=col_widths)
    style = [
        ("GRID", (0, 0), (-1, -1), 0.4, colors.HexColor("#CBD5E1")),
        ("FONTSIZE", (0, 0), (-1, -1), 8.5),
        ("LEFTPADDING", (0, 0), (-1, -1), 4),
        ("RIGHTPADDING", (0, 0), (-1, -1), 4),
        ("TOPPADDING", (0, 0), (-1, -1), 3),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 3),
    ]
    if header and rows:
        style += [
            ("BACKGROUND", (0, 0), (-1, 0), colors.HexColor("#1F2937")),
            ("TEXTCOLOR", (0, 0), (-1, 0), colors.white),
            ("FONTNAME", (0, 0), (-1, 0), "Helvetica-Bold"),
        ]
    table.setStyle(TableStyle(style))
    return table


def _health_summary(patient_id: int, latest_biomarkers: dict, weekly: dict, risk: dict | None) -> str:
    flat = {k: float(v["value"]) for k, v in latest_biomarkers.items() if isinstance(v, dict) and v.get("value") is not None}
    ai_text = ""
    try:
        ai_text = generate_summary(flat)
    except Exception:
        ai_text = ""

    glucose_val = next((flat[k] for k in flat if "glucose" in k.lower()), None)
    bp_val = flat.get("systolic_bp")
    findings: list[str] = []
    if glucose_val is not None and glucose_val > 180:
        findings.append("Patient shows poor glycemic control with elevated glucose.")
    if bp_val is not None and bp_val > 140:
        findings.append("Blood pressure trend indicates elevated cardiovascular strain.")
    if float(weekly.get("weekly_score", 0) or 0) >= 80:
        findings.append("Medication compliance is stable over the week.")
    elif float(weekly.get("weekly_score", 0) or 0) < 60:
        findings.append("Medication adherence is low and requires reinforcement.")
    if risk and float(risk.get("score", 0) or 0) >= 70:
        findings.append("Overall risk remains high and clinical review is advised.")

    concise = " ".join(findings[:4]).strip()
    if ai_text and concise:
        return f"{concise} {ai_text}"
    return ai_text or concise or "Limited recent data; continue monitoring and schedule follow-up."


def _biomarker_trends_30d(patient_id: int) -> list[list[str]]:
    # Use latest available biomarker as anchor:
    # - if history span > 30 days, keep only latest 30 days
    # - if history span <= 30 days, keep all available data
    latest_row = fetchone(
        """
        SELECT timestamp
        FROM biomarker_readings
        WHERE patient_id = ?
        ORDER BY timestamp DESC
        LIMIT 1
        """,
        (patient_id,),
    )
    if not latest_row or not latest_row.get("timestamp"):
        return [["Biomarker", "Latest", "30d Avg", "Direction"], ["No data", "-", "-", "-"]]

    latest_ts = datetime.fromisoformat(str(latest_row["timestamp"]))
    cutoff = (latest_ts - timedelta(days=30)).isoformat()
    rows_window = fetchall(
        """
        SELECT biomarker_type, value, timestamp
        FROM biomarker_readings
        WHERE patient_id = ? AND timestamp >= ?
        ORDER BY timestamp DESC
        """,
        (patient_id, cutoff),
    )
    data = rows_to_dicts(rows_window)
    if not data:
        all_rows = fetchall(
            """
            SELECT biomarker_type, value, timestamp
            FROM biomarker_readings
            WHERE patient_id = ?
            ORDER BY timestamp DESC
            """,
            (patient_id,),
        )
        data = rows_to_dicts(all_rows)
    if not data:
        return [["Biomarker", "Latest", "30d Avg", "Direction"], ["No data", "-", "-", "-"]]

    by_type: dict[str, list[float]] = {}
    for r in data:
        by_type.setdefault(str(r["biomarker_type"]), []).append(float(r["value"]))

    out = [["Biomarker", "Latest", "30d Avg", "Direction"]]
    for biomarker, vals in list(by_type.items())[:8]:
        latest = vals[0]
        avg = sum(vals) / len(vals)
        direction = "Rising" if latest > avg else ("Falling" if latest < avg else "Stable")
        out.append([biomarker, f"{latest:.2f}", f"{avg:.2f}", direction])
    return out


def _medication_adherence_per_med(patient_id: int) -> list[list[str]]:
    rows = fetchall(
        """
        SELECT m.name AS med_name, d.status
        FROM medications m
        LEFT JOIN dose_events d ON d.medication_id = m.id
        WHERE m.patient_id = ?
        ORDER BY m.name
        """,
        (patient_id,),
    )
    data = rows_to_dicts(rows)
    by_med: dict[str, dict[str, int]] = {}
    for r in data:
        med = str(r["med_name"])
        by_med.setdefault(med, {"taken": 0, "total": 0})
        status = str(r.get("status") or "").upper()
        if status:
            by_med[med]["total"] += 1
            if status == "TAKEN":
                by_med[med]["taken"] += 1

    out = [["Medication", "Adherence %"]]
    if not by_med:
        out.append(["No medications", "-"])
        return out
    for med, d in list(by_med.items())[:8]:
        score = (d["taken"] / d["total"] * 100.0) if d["total"] else 0.0
        out.append([med, f"{score:.1f}%"])
    return out


def _behavioral_anomalies(patient_id: int) -> list[str]:
    anomalies: list[str] = []
    missed = rows_to_dicts(
        fetchall(
            "SELECT timestamp FROM dose_events WHERE patient_id = ? AND status = 'MISSED' ORDER BY timestamp DESC LIMIT 5",
            (patient_id,),
        )
    )
    for m in missed:
        anomalies.append(f"{m['timestamp']}: Missed medication dose")

    spikes = rows_to_dicts(
        fetchall(
            """
            SELECT timestamp, value
            FROM biomarker_readings
            WHERE patient_id = ? AND biomarker_type IN ('glucose_postprandial','blood_glucose','glucose_random') AND value > 200
            ORDER BY timestamp DESC
            LIMIT 5
            """,
            (patient_id,),
        )
    )
    for s in spikes:
        anomalies.append(f"{s['timestamp']}: Glucose spike {float(s['value']):.1f}")

    return anomalies[:8] or ["No significant anomalies detected in current window."]


def generate_patient_summary_pdf(patient_id: int) -> str:
    patient = fetchone("SELECT * FROM patients WHERE id = ?", (patient_id,))
    if patient is None:
        raise ValueError(f"Patient {patient_id} not found")
    patient = dict(patient)

    weekly = get_weekly_adherence(patient_id)
    daily = get_daily_adherence(patient_id)
    risk = get_latest_risk(patient_id)
    latest = get_latest_biomarkers(patient_id)
    signals = generate_deterioration_signals(patient_id)

    health_summary = _health_summary(patient_id, latest, weekly, risk)
    trend_rows = _biomarker_trends_30d(patient_id)
    adherence_rows = _medication_adherence_per_med(patient_id)
    anomalies = _behavioral_anomalies(patient_id)

    out_path = _safe_tmp_path(patient_id)
    doc = SimpleDocTemplate(
        str(out_path),
        pagesize=A4,
        leftMargin=1.4 * cm,
        rightMargin=1.4 * cm,
        topMargin=1.3 * cm,
        bottomMargin=1.3 * cm,
    )

    styles = getSampleStyleSheet()
    title = ParagraphStyle("title", parent=styles["Heading1"], fontSize=16, spaceAfter=6)
    sec = ParagraphStyle("sec", parent=styles["Heading2"], fontSize=11, spaceBefore=8, spaceAfter=4, textColor=colors.HexColor("#0F172A"))
    body = ParagraphStyle("body", parent=styles["BodyText"], fontSize=8.8, leading=11)

    story: list[Any] = []
    story.append(Paragraph("Patient Health Summary Report", title))
    story.append(Paragraph(f"Patient: {patient.get('name','-')} | Age: {patient.get('age','-')} | Gender: {patient.get('gender','-')}", body))
    story.append(Paragraph(f"Generated: {datetime.utcnow().strftime('%Y-%m-%d %H:%M')} UTC", body))
    story.append(HRFlowable(width="100%", thickness=0.7, color=colors.HexColor("#94A3B8")))

    story.append(Paragraph("1) Health Summary", sec))
    story.append(Paragraph(health_summary, body))

    story.append(Paragraph("2) 1-Month Biomarker Trends", sec))
    story.append(_table(trend_rows, header=True))

    story.append(Paragraph("3) Medication Adherence (Per Medication)", sec))
    story.append(Paragraph(f"Daily adherence: {daily.get('daily_score', 0):.1f}% | Weekly adherence: {weekly.get('weekly_score', 0):.1f}%", body))
    story.append(_table(adherence_rows, header=True))

    story.append(Paragraph("4) Behavioral Anomalies", sec))
    for a in anomalies[:6]:
        story.append(Paragraph(f"- {a}", body))

    story.append(Paragraph("5) Deterioration Signals", sec))
    if signals:
        for s in signals[:6]:
            sev = str(s.get("severity", "good")).upper()
            story.append(Paragraph(f"- [{sev}] {s.get('title','Signal')}: {s.get('description','')}", body))
    else:
        story.append(Paragraph("- No deterioration signals available.", body))

    # Constrain content to practical 1-2 page output by trimming heavy sections above.
    doc.build(story)
    return str(out_path)

