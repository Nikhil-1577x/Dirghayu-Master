import requests
import json

base_url = "http://localhost:8000/ws/test_broadcast/1"

params_risk = {
    "type": "risk_update",
    "patient_id": 1,
    "score": 42.5,
    "risk_level": "MODERATE",
    "timestamp": "2026-03-20T12:00:00Z"
}

params_dose = {
    "type": "dose_event",
    "patient_id": 1,
    "medication_id": 1,
    "status": "TAKEN",
    "timestamp": "2026-03-20T12:00:05Z"
}

print("Broadcasting risk_update...")
r1 = requests.post(base_url, json=params_risk)
print(r1.status_code, r1.text)

print("Broadcasting dose_event...")
r2 = requests.post(base_url, json=params_dose)
print(r2.status_code, r2.text)
