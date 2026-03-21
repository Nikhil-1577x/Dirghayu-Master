"""
abha_registry.py – Simulated Government ABHA (Ayushman Bharat Health Account) Database.

This is a hardcoded in-memory dictionary that mimics the national ABHA registry.
In production, this would be an API call to the ABDM (Ayushman Bharat Digital Mission) gateway.
"""

ABHA_REGISTRY: dict[str, dict] = {
    "ABHA-1001": {
        "abha_id": "ABHA-1001",
        "name": "Ramesh Kumar",
        "age": 67,
        "gender": "Male",
        "blood_group": "B+",
        "address": "142, MG Road, Aurangabad, Maharashtra 431001",
        "phone": "+91-9876543210",
        "conditions": ["Type 2 Diabetes", "Hypertension"],
        "allergies": ["Sulfa drugs"],
        "history": [
            {"date": "2024-06-15", "event": "Diagnosed with Type 2 Diabetes", "facility": "Civil Hospital, Aurangabad"},
            {"date": "2024-09-10", "event": "Started Metformin 500mg", "facility": "PHC Waluj"},
            {"date": "2025-01-20", "event": "Hypertension diagnosed, Amlodipine 5mg prescribed", "facility": "Civil Hospital, Aurangabad"},
            {"date": "2025-08-05", "event": "HbA1c: 7.8% — dose adjustment recommended", "facility": "District Hospital"},
        ],
    },
    "ABHA-1002": {
        "abha_id": "ABHA-1002",
        "name": "Sunita Devi",
        "age": 58,
        "gender": "Female",
        "blood_group": "O+",
        "address": "78, Nehru Nagar, Pune, Maharashtra 411001",
        "phone": "+91-9123456780",
        "conditions": ["Hypertension"],
        "allergies": [],
        "history": [
            {"date": "2025-03-12", "event": "Hypertension diagnosed (BP 150/98)", "facility": "PHC Hadapsar"},
            {"date": "2025-04-01", "event": "Losartan 50mg initiated", "facility": "PHC Hadapsar"},
        ],
    },
    "ABHA-1003": {
        "abha_id": "ABHA-1003",
        "name": "Kamla Bai",
        "age": 63,
        "gender": "Female",
        "blood_group": "A+",
        "address": "23, Gandhi Chowk, Paithan, Maharashtra 431107",
        "phone": "+91-9988776655",
        "conditions": ["Type 2 Diabetes", "Chronic Kidney Disease (Stage 3)"],
        "allergies": ["Penicillin", "Ibuprofen"],
        "history": [
            {"date": "2023-11-22", "event": "Diabetes diagnosed, Glimepiride 1mg started", "facility": "CHC Paithan"},
            {"date": "2024-04-10", "event": "CKD Stage 3 detected (eGFR 42)", "facility": "Civil Hospital, Aurangabad"},
            {"date": "2024-07-15", "event": "Referred to Nephrologist", "facility": "District Hospital"},
            {"date": "2025-01-08", "event": "eGFR declined to 38, ACE inhibitor added", "facility": "District Hospital"},
            {"date": "2025-09-20", "event": "Dialysis evaluation initiated", "facility": "Govt Medical College"},
        ],
    },
    "ABHA-1004": {
        "abha_id": "ABHA-1004",
        "name": "Arun Sharma",
        "age": 72,
        "gender": "Male",
        "blood_group": "AB+",
        "address": "55, Station Road, Waluj, Maharashtra 431136",
        "phone": "+91-9012345678",
        "conditions": ["Type 2 Diabetes"],
        "allergies": [],
        "history": [
            {"date": "2022-08-30", "event": "Diabetes diagnosed (FBS 186 mg/dL)", "facility": "PHC Waluj"},
            {"date": "2022-09-15", "event": "Metformin 500mg BD started", "facility": "PHC Waluj"},
            {"date": "2024-12-01", "event": "HbA1c 6.9%, stable control", "facility": "Civil Hospital, Aurangabad"},
        ],
    },
    "ABHA-1005": {
        "abha_id": "ABHA-1005",
        "name": "Mahesh Yadav",
        "age": 55,
        "gender": "Male",
        "blood_group": "O-",
        "address": "12, Laxmi Colony, Nashik, Maharashtra 422001",
        "phone": "+91-9876512340",
        "conditions": ["Hypertension"],
        "allergies": ["Aspirin"],
        "history": [
            {"date": "2025-06-20", "event": "Routine BP check: 142/90", "facility": "PHC Nashik"},
            {"date": "2025-07-01", "event": "Telmisartan 40mg started", "facility": "PHC Nashik"},
        ],
    },
    "ABHA-2001": {
        "abha_id": "ABHA-2001",
        "name": "Priya Patil",
        "age": 45,
        "gender": "Female",
        "blood_group": "B-",
        "address": "89, Shivaji Nagar, Nagpur, Maharashtra 440001",
        "phone": "+91-9567890123",
        "conditions": ["Type 1 Diabetes", "Hypothyroidism"],
        "allergies": ["Metformin"],
        "history": [
            {"date": "2018-03-14", "event": "Type 1 Diabetes diagnosed", "facility": "Govt Medical College, Nagpur"},
            {"date": "2018-03-20", "event": "Insulin Glargine initiated", "facility": "Govt Medical College, Nagpur"},
            {"date": "2021-09-05", "event": "Hypothyroidism detected, Levothyroxine 50mcg", "facility": "District Hospital, Nagpur"},
            {"date": "2025-02-18", "event": "HbA1c 7.2%, insulin dose titrated", "facility": "Govt Medical College, Nagpur"},
        ],
    },
    "ABHA-2002": {
        "abha_id": "ABHA-2002",
        "name": "Rajendra Singh",
        "age": 60,
        "gender": "Male",
        "blood_group": "A-",
        "address": "34, Cantonment Area, Solapur, Maharashtra 413001",
        "phone": "+91-9345678901",
        "conditions": ["COPD", "Hypertension", "Type 2 Diabetes"],
        "allergies": [],
        "history": [
            {"date": "2020-11-10", "event": "COPD diagnosed (Gold Stage II)", "facility": "Civil Hospital, Solapur"},
            {"date": "2021-01-05", "event": "Tiotropium inhaler prescribed", "facility": "Civil Hospital, Solapur"},
            {"date": "2023-06-22", "event": "Diabetes diagnosed (FBS 210 mg/dL)", "facility": "PHC Solapur"},
            {"date": "2024-03-15", "event": "Hypertension detected, triple therapy started", "facility": "District Hospital"},
        ],
    },
    "ABHA-2003": {
        "abha_id": "ABHA-2003",
        "name": "Geeta Deshmukh",
        "age": 50,
        "gender": "Female",
        "blood_group": "O+",
        "address": "67, Vidya Nagar, Latur, Maharashtra 413512",
        "phone": "+91-9234567890",
        "conditions": ["Rheumatoid Arthritis", "Hypertension"],
        "allergies": ["NSAIDs"],
        "history": [
            {"date": "2019-07-01", "event": "RA diagnosed, Methotrexate started", "facility": "Govt Medical College, Latur"},
            {"date": "2022-10-15", "event": "Hypertension diagnosed", "facility": "PHC Latur"},
            {"date": "2025-05-20", "event": "Joint replacement evaluation for right knee", "facility": "District Hospital, Latur"},
        ],
    },
}


# ── In-memory local panel (simulates which patients are registered locally) ───
_registered_abha_ids: set[str] = {"ABHA-1001", "ABHA-1002", "ABHA-1003", "ABHA-1004", "ABHA-1005"}


def lookup_abha(abha_id: str) -> dict | None:
    """Lookup a patient from the simulated government ABHA registry."""
    return ABHA_REGISTRY.get(abha_id.upper())


def get_registered_patients() -> list[dict]:
    """Return all patients currently registered in the local panel."""
    return [ABHA_REGISTRY[aid] for aid in sorted(_registered_abha_ids) if aid in ABHA_REGISTRY]


def register_patient(abha_id: str) -> dict | None:
    """Add a patient from ABHA registry to the local panel."""
    abha_id = abha_id.upper()
    patient = ABHA_REGISTRY.get(abha_id)
    if patient:
        _registered_abha_ids.add(abha_id)
    return patient


def unregister_patient(abha_id: str) -> bool:
    """Remove a patient from the local panel."""
    abha_id = abha_id.upper()
    if abha_id in _registered_abha_ids:
        _registered_abha_ids.discard(abha_id)
        return True
    return False


def is_registered(abha_id: str) -> bool:
    """Check if an ABHA ID is registered locally."""
    return abha_id.upper() in _registered_abha_ids
