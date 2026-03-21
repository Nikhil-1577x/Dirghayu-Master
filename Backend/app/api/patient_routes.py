"""
patient_routes.py – Patient CRUD + dashboard endpoint.
"""
from fastapi import APIRouter, HTTPException, Response
from app.models.patient import PatientCreate, PatientOut
from app.utils.db_utils import execute, fetchone, fetchall, rows_to_dicts, row_to_dict

router = APIRouter(prefix="/patient", tags=["Patients"])


@router.post("/", response_model=PatientOut, status_code=201)
def create_patient(data: PatientCreate):
    row_id = execute(
        "INSERT INTO patients (name, age, gender, phone, family_phone, doctor_phone) VALUES (?,?,?,?,?,?)",
        (data.name, data.age, data.gender, data.phone, data.family_phone, data.doctor_phone),
    )
    row = fetchone("SELECT * FROM patients WHERE id = ?", (row_id,))
    return dict(row)


@router.get("/", response_model=list[PatientOut])
def list_patients():
    return rows_to_dicts(fetchall("SELECT * FROM patients ORDER BY id"))


@router.get("/{id}", response_model=PatientOut)
def get_patient(id: int):
    row = fetchone("SELECT * FROM patients WHERE id = ?", (id,))
    if not row:
        raise HTTPException(status_code=404, detail="Patient not found")
    return dict(row)


@router.delete("/{id}", status_code=204)
def delete_patient(id: int):
    """
    Delete a patient and all related data (biomarkers, risk scores, alerts,
    appointments, reports, environment readings). This relies on the
    ON DELETE CASCADE constraints defined in `database.py`.
    """
    row = fetchone("SELECT id FROM patients WHERE id = ?", (id,))
    if not row:
        raise HTTPException(status_code=404, detail="Patient not found")
    execute("DELETE FROM patients WHERE id = ?", (id,))
    return Response(status_code=204)


@router.get("/{id}/dashboard")
def patient_dashboard(id: int):
    """
    Returns: patient info, latest biomarkers, risk score, adherence %, recent alerts.
    """
    from app.services.adherence_engine import get_weekly_adherence, get_daily_adherence
    from app.services.biomarker_service import get_latest_biomarkers
    from app.services.risk_service import get_latest_risk
    from app.services.alert_service import get_alert_history

    patient = fetchone("SELECT * FROM patients WHERE id = ?", (id,))
    if not patient:
        raise HTTPException(status_code=404, detail="Patient not found")

    # Behavioral patterns (last 30 days)
    behavioral_patterns = []
    try:
        from nirogi_ai import detect_patterns
        from app.utils.time_utils import utcnow
        from datetime import timedelta
        cutoff = (utcnow() - timedelta(days=30)).isoformat()
        dose_history = rows_to_dicts(fetchall(
            """SELECT d.*, m.schedule_time AS scheduled_time
               FROM dose_events d
               JOIN medications m ON d.medication_id = m.id
               WHERE d.patient_id = ? AND d.timestamp >= ?
               ORDER BY d.timestamp DESC""",
            (id, cutoff),
        ))
        behavioral_patterns = detect_patterns(dose_history)
    except Exception as e:
        import logging
        logging.getLogger(__name__).error(f"BEHAVIORAL ERROR: {e}")

    import logging
    logging.getLogger(__name__).info(f"DASHBOARD: id={id} doses={len(dose_history)} patterns={len(behavioral_patterns)}")

    return {
        "patient": dict(patient),
        "latest_biomarkers": get_latest_biomarkers(id),
        "risk_score": get_latest_risk(id),
        "weekly_adherence": get_weekly_adherence(id),
        "daily_adherence": get_daily_adherence(id),
        "recent_alerts": get_alert_history(id)[:10],
        "behavioral_patterns": behavioral_patterns,
    }


@router.post("/{id}/medication", status_code=201)
def add_medication(id: int, data: dict):
    from app.models.medication import MedicationCreate
    med = MedicationCreate(patient_id=id, **data)
    row_id = execute(
        "INSERT INTO medications (patient_id, name, dose, schedule_time) VALUES (?,?,?,?)",
        (id, med.name, med.dose, med.schedule_time),
    )
    return {"id": row_id, "patient_id": id, "name": med.name, "dose": med.dose, "schedule_time": med.schedule_time}


@router.get("/{id}/medications")
def get_medications(id: int):
    return rows_to_dicts(fetchall("SELECT * FROM medications WHERE patient_id = ?", (id,)))


@router.post("/{id}/appointment", status_code=201)
def add_appointment(id: int, data: dict):
    from app.models.appointment import AppointmentCreate
    appt = AppointmentCreate(patient_id=id, **data)
    row_id = execute(
        "INSERT INTO appointments (patient_id, appointment_time, doctor_name, notes) VALUES (?,?,?,?)",
        (id, appt.appointment_time, appt.doctor_name, appt.notes),
    )
    return {"id": row_id, **appt.dict()}


@router.get("/{id}/appointments")
def get_appointments(id: int):
    return rows_to_dicts(fetchall("SELECT * FROM appointments WHERE patient_id = ? ORDER BY appointment_time", (id,)))
