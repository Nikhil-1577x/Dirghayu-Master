import sqlite3
conn = sqlite3.connect('medication.db')
cur = conn.execute("SELECT id, name, schedule_time FROM medications WHERE patient_id=1")
rows = cur.fetchall()
for r in rows:
    print(r)
if rows:
    # Metformin AM is likely the first one
    med_id = rows[0][0]
    print(f"Targeting Med ID: {med_id}")
    cur = conn.execute("SELECT id FROM dose_events WHERE patient_id=1 AND medication_id=? LIMIT 40", (med_id,))
    ids = [r[0] for r in cur.fetchall()]
    if ids:
        placeholder = ",".join(["?"] * len(ids))
        conn.execute(f"UPDATE dose_events SET status='MISSED' WHERE id IN ({placeholder})", ids)
        conn.commit()
        print(f"Updated {len(ids)} doses to MISSED")
cur = conn.execute("SELECT COUNT(*) FROM dose_events WHERE patient_id=1 AND status='MISSED'")
print(f"Total MISSED for Patient 1: {cur.fetchone()[0]}")
conn.close()
