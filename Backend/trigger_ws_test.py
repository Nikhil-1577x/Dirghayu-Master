import asyncio
import json
import sys
import os

# Ensure app is discoverable
sys.path.append(os.getcwd())

from app.api.websocket_routes import broadcast

async def main():
    patient_id = 1
    
    print("Testing Dose Event...")
    dose_event = {
        "type": "dose_event",
        "patient_id": patient_id,
        "medication_id": 4,  # Metformin AM
        "status": "TAKEN",
        "timestamp": "2026-03-20T11:45:00Z"
    }
    await broadcast(patient_id, dose_event)
    await asyncio.sleep(1)
    
    print("Testing Risk Update...")
    risk_event = {
        "type": "risk_update",
        "patient_id": patient_id,
        "score": 15.5,
        "risk_level": "LOW",
        "timestamp": "2026-03-20T11:45:05Z"
    }
    await broadcast(patient_id, risk_event)
    await asyncio.sleep(1)
    
    print("Testing Alert...")
    alert_event = {
        "type": "alert_triggered",
        "patient_id": patient_id,
        "alert_type": "MISSED_DOSE",
        "timestamp": "2026-03-20T11:45:10Z"
    }
    await broadcast(patient_id, alert_event)
    
    print("Done.")

if __name__ == "__main__":
    asyncio.run(main())
