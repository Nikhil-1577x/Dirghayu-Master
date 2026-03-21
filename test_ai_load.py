import sys
import os
from pathlib import Path

# Add nirogi_ai to path
sys.path.append(str(Path(__file__).resolve().parent))

try:
    from nirogi_ai import get_risk_score
    print("Import successful")
    
    features = {"age": 50, "sex_female": 1, "adherence_7d": 0.9}
    score = get_risk_score(features)
    print(f"Risk Score: {score}")
except Exception as e:
    print(f"Caught Error: {e}")
    import traceback
    traceback.print_exc()
