import sqlite3
conn = sqlite3.connect('medication.db')
# Get 40 Metformin AM (med_id=1) IDs
cur = conn.execute("SELECT id FROM dose_events WHERE patient_id=1 AND medication_id=1 LIMIT 40")
ids = [r[0] for r in cur.fetchall()]
print(f"Updating {len(ids)} IDs to MISSED")
if ids:
    placeholder = ",".join(["?"] * len(ids))
    conn.execute(f"UPDATE dose_events SET status='MISSED' WHERE id IN ({placeholder})", ids)
    conn.commit()
cur = conn.execute("SELECT COUNT(*) FROM dose_events WHERE patient_id=1 AND medication_id=1 AND status='MISSED'")
print(f"New MISSED count: {cur.fetchone()[0]}")
conn.close()
