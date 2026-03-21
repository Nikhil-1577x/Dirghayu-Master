import sqlite3
conn = sqlite3.connect('medication.db')
cur = conn.execute("SELECT id, timestamp, status FROM dose_events WHERE patient_id=1 AND status='MISSED' ORDER BY timestamp DESC")
rows = cur.fetchall()
for r in rows[:5]:
    print(r)
print(f"Total MISSED: {len(rows)}")
conn.close()
