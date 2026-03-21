import traceback
import sys
import os

# Add Backend to sys.path
sys.path.append("c:/Users/Lqg/Desktop/doc/Backend")
os.environ["REPORTS_DIR"] = "c:/Users/Lqg/Desktop/doc/reports"

from app.services.report_service import generate_report

try:
    path = generate_report(1)
    print(f"SUCCESS: {path}")
except Exception:
    traceback.print_exc()
