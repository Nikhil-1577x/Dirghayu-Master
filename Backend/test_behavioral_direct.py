import sys
import os
sys.path.append("c:/Users/Lqg/Desktop/doc/Backend")
sys.path.append("c:/Users/Lqg/Desktop/doc")

from app.utils.db_utils import fetchall, rows_to_dicts
from nirogi_ai.behavioral import detect_patterns
import sqlite3

def test():
    conn = sqlite3.connect('c:/Users/Lqg/Desktop/doc/Backend/medication.db')
    # Mocking rows_to_dicts since it might depend on local context
    cursor = conn.execute("""
        SELECT d.*, m.schedule_time AS scheduled_time
        FROM dose_events d
        JOIN medications m ON d.medication_id = m.id
        WHERE d.patient_id = 1
        ORDER BY d.timestamp DESC
    """)
    columns = [column[0] for column in cursor.description]
    dose_history = [dict(zip(columns, row)) for row in cursor.fetchall()]
    
    print(f"Sample dose: {dose_history[0] if dose_history else 'NONE'}")
    patterns = detect_patterns(dose_history)
    print(f"Patterns found: {patterns}")
    
test()
