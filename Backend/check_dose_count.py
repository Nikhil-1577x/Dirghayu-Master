import sqlite3
conn = sqlite3.connect('medication.db')
c = conn.execute("SELECT COUNT(1) FROM dose_events WHERE patient_id=1 AND medication_id=4")
print(f"Total doses (med_id=4): {c.fetchone()[0]}")
c = conn.execute("SELECT COUNT(1) FROM dose_events WHERE patient_id=1 AND medication_id=4 AND status='MISSED'")
print(f"MISSED doses (med_id=4): {c.fetchone()[0]}")
conn.close()
