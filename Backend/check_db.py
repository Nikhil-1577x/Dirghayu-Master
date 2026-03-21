import sqlite3
import os

db_path = "c:/Users/Lqg/Desktop/doc/Backend/medication.db"
conn = sqlite3.connect(db_path)
conn.row_factory = sqlite3.Row

print("Checking medications for patient 1:")
meds = conn.execute("SELECT * FROM medications WHERE patient_id = 1").fetchall()
for m in meds:
    print(dict(m))

print("\nChecking dose events for patient 1 (first 5):")
doses = conn.execute("SELECT * FROM dose_events WHERE patient_id = 1 LIMIT 5").fetchall()
for d in doses:
    print(dict(d))

conn.close()
