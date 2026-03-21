import sqlite3
from datetime import datetime, timedelta
conn = sqlite3.connect('medication.db')
cutoff = (datetime.utcnow() - timedelta(days=30)).isoformat()
c = conn.execute("""
    SELECT COUNT(1) 
    FROM dose_events d
    JOIN medications m ON d.medication_id = m.id
    WHERE d.patient_id=1 AND d.timestamp >= ?
    AND m.schedule_time BETWEEN '05:00' AND '12:00'
    AND d.status = 'MISSED'
""", (cutoff,))
count = c.fetchone()[0]
print(f"MISSED morning doses in last 30 days: {count}")
conn.close()
