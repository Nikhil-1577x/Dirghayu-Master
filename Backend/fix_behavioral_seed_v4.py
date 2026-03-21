import sqlite3
from datetime import datetime, timedelta
conn = sqlite3.connect('medication.db')
cutoff = (datetime.utcnow() - timedelta(days=10)).isoformat()
# Get IDs of morning doses in last 10 days that are currently 'TAKEN'
c = conn.execute("""
    SELECT d.id 
    FROM dose_events d
    JOIN medications m ON d.medication_id = m.id
    WHERE d.patient_id=1 AND d.timestamp >= ?
    AND m.schedule_time BETWEEN '05:00' AND '12:00'
    AND d.status = 'TAKEN'
    LIMIT 10
""", (cutoff,))
ids = [r[0] for r in c.fetchall()]
if ids:
    placeholder = ",".join(["?"] * len(ids))
    conn.execute(f"UPDATE dose_events SET status='MISSED' WHERE id IN ({placeholder})", ids)
    conn.commit()
    print(f"Updated {len(ids)} morning doses to MISSED in last 10 days")
conn.close()
