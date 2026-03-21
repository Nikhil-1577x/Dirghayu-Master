import sqlite3
conn = sqlite3.connect('medication.db')
med_id = 6 # Amlodipine
cur = conn.execute("SELECT id FROM dose_events WHERE patient_id=1 AND medication_id=? LIMIT 20", (med_id,))
ids = [r[0] for r in cur.fetchall()]
if ids:
    placeholder = ",".join(["?"] * len(ids))
    conn.execute(f"UPDATE dose_events SET status='MISSED' WHERE id IN ({placeholder})", ids)
    conn.commit()
    print(f"Updated {len(ids)} ID 6 doses to MISSED")
conn.close()
