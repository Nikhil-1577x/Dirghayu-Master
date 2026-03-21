"""
In-memory ABHA registry simulation.

Important:
- No SQLite/PostgreSQL persistence for this module.
- Registry and selected panel state are process-memory only.
"""
from __future__ import annotations

from typing import Any

ABHA_REGISTRY: dict[str, dict[str, Any]] = {
    "ABHA-1001": {
        "name": "new test",
        "age": 0,
        "gender": "Male",
        "blood_group": "B+",
        "conditions": ["Diabetes", "Hypertension"],
        "allergies": ["Penicillin"],
        "history": [
            {"date": "2023-01-10", "event": "Diagnosed with Diabetes", "hospital": "AIIMS Delhi"},
            {"date": "2023-06-15", "event": "BP spike hospitalization", "hospital": "Fortis Hospital"},
        ],
        "db_patient_id": 9,
    },
    "ABHA-1002": {
        "name": "new test",
        "age": 0,
        "gender": "Female",
        "blood_group": "O+",
        "conditions": ["Diabetes", "CKD"],
        "allergies": ["Sulfa drugs"],
        "history": [
            {"date": "2022-11-21", "event": "CKD stage-2 diagnosis", "hospital": "Government Medical College Aurangabad"},
            {"date": "2024-02-03", "event": "Emergency glucose correction", "hospital": "District Hospital Paithan"},
        ],
        "db_patient_id": 9,
    },
    "ABHA-1003": {
        "name": "Sunita Devi",
        "age": 54,
        "gender": "Female",
        "blood_group": "A+",
        "conditions": ["Anemia", "Hypothyroidism"],
        "allergies": ["None"],
        "history": [
            {"date": "2021-09-07", "event": "Thyroid medication started", "hospital": "Apollo Clinic Pune"},
            {"date": "2024-01-18", "event": "Anemia follow-up", "hospital": "Ruby Hall Clinic"},
        ],
        "db_patient_id": None,
    },
    "ABHA-1004": {
        "name": "Arun Sharma",
        "age": 72,
        "gender": "Male",
        "blood_group": "AB+",
        "conditions": ["Diabetes"],
        "allergies": ["Aspirin"],
        "history": [
            {"date": "2020-05-14", "event": "Initial insulin counseling", "hospital": "Medanta Gurgaon"},
            {"date": "2023-12-22", "event": "Retinopathy screening", "hospital": "Narayana Health Jaipur"},
        ],
        "db_patient_id": None,
    },
    "ABHA-1005": {
        "name": "Farida Sheikh",
        "age": 47,
        "gender": "Female",
        "blood_group": "B-",
        "conditions": ["Hypertension", "Obesity"],
        "allergies": ["Ibuprofen"],
        "history": [
            {"date": "2022-03-09", "event": "Hypertension detected", "hospital": "KEM Mumbai"},
            {"date": "2024-04-28", "event": "Dietitian referral", "hospital": "Sion Hospital"},
        ],
        "db_patient_id": None,
    },
    "ABHA-1006": {
        "name": "Vikram Joshi",
        "age": 61,
        "gender": "Male",
        "blood_group": "A-",
        "conditions": ["COPD", "Hypertension"],
        "allergies": ["None"],
        "history": [
            {"date": "2021-08-18", "event": "COPD exacerbation treatment", "hospital": "AIIMS Bhopal"},
            {"date": "2023-10-02", "event": "Pulmonary rehab started", "hospital": "Max Saket"},
        ],
        "db_patient_id": None,
    },
    "ABHA-1007": {
        "name": "Meena Patil",
        "age": 50,
        "gender": "Female",
        "blood_group": "O-",
        "conditions": ["Prediabetes"],
        "allergies": ["Seafood"],
        "history": [
            {"date": "2023-02-11", "event": "Prediabetes counseling", "hospital": "Jupiter Thane"},
            {"date": "2024-07-06", "event": "Lifestyle intervention review", "hospital": "Civil Hospital Nashik"},
        ],
        "db_patient_id": None,
    },
    "ABHA-1008": {
        "name": "Harish Chandra",
        "age": 69,
        "gender": "Male",
        "blood_group": "B+",
        "conditions": ["Coronary Artery Disease", "Diabetes"],
        "allergies": ["Clopidogrel"],
        "history": [
            {"date": "2019-11-17", "event": "Angioplasty procedure", "hospital": "Fortis Noida"},
            {"date": "2024-05-13", "event": "Cardiac rehab follow-up", "hospital": "BLK Max Delhi"},
        ],
        "db_patient_id": None,
    },
    "ABHA-1009": {
        "name": "Nazia Khan",
        "age": 42,
        "gender": "Female",
        "blood_group": "AB-",
        "conditions": ["Gestational Diabetes (history)"],
        "allergies": ["Latex"],
        "history": [
            {"date": "2021-06-01", "event": "Gestational diabetes monitoring", "hospital": "Cloudnine Bengaluru"},
            {"date": "2024-08-15", "event": "Annual endocrine checkup", "hospital": "Manipal Hospital"},
        ],
        "db_patient_id": None,
    },
    "ABHA-1010": {
        "name": "Deepak Verma",
        "age": 56,
        "gender": "Male",
        "blood_group": "O+",
        "conditions": ["Fatty Liver", "Hyperlipidemia"],
        "allergies": ["None"],
        "history": [
            {"date": "2022-12-19", "event": "Lipid profile intervention", "hospital": "PGI Chandigarh"},
            {"date": "2024-03-09", "event": "Liver enzymes follow-up", "hospital": "Paras Gurugram"},
        ],
        "db_patient_id": None,
    },
}

# Tracks ABHA IDs selected into Doctor/CHO panel (in-memory only).
# Seed with mapped ABHA IDs so Doctor/CHO dashboards work immediately after startup.
_registered_abha_ids: set[str] = {"ABHA-1001", "ABHA-1002"}


def abha_id_for_db_patient_id(patient_id: int) -> str:
    """Deterministic ABHA ID assignment from DB patient id."""
    return f"ABHA-{1000 + int(patient_id)}"


def register_db_patient(patient_row: dict[str, Any]) -> str:
    """
    Ensure a DB patient is assigned an ABHA ID and visible in the shared panel.
    This is in-memory only and does not alter database schema.
    """
    pid = int(patient_row["id"])
    abha_id = abha_id_for_db_patient_id(pid)
    name = str(patient_row.get("name") or f"Patient {pid}")
    age = int(patient_row.get("age") or 0)
    gender = str(patient_row.get("gender") or "Unknown").capitalize()

    existing = ABHA_REGISTRY.get(abha_id, {})
    ABHA_REGISTRY[abha_id] = {
        "name": name,
        "age": age,
        "gender": gender,
        "blood_group": existing.get("blood_group", "Unknown"),
        "conditions": existing.get("conditions", ["No known chronic condition"]),
        "allergies": existing.get("allergies", ["None"]),
        "history": existing.get(
            "history",
            [
                {
                    "date": str(patient_row.get("created_at") or "N/A").split("T")[0],
                    "event": "Registered in local care platform",
                    "hospital": "Local Clinic",
                }
            ],
        ),
        "db_patient_id": pid,
    }
    _registered_abha_ids.add(abha_id)
    return abha_id

