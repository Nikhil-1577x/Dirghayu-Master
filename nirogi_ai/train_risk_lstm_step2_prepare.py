from __future__ import annotations

"""
Step 2: Prepare per-patient sequences for NIROGI LSTM risk model.

This script:
- Loads Diabetes 130-US Hospitals dataset from data/diabetic_data.csv
- Defines a binary label per encounter using the `readmitted` column
  (`<30` -> 1, `NO` or `>30` -> 0)
- Engineers a small set of numeric features that NIROGI can later mirror
  (age, sex, race flags, encounter statistics, simple lab proxies)
- Groups rows by patient_nbr into ordered sequences
- Saves the result to data/processed/sequences.pkl for later training

Run with:
    python nirogi_ai/train_risk_lstm_step2_prepare.py
"""

from dataclasses import dataclass
from pathlib import Path
from typing import Any, Dict, List

import numpy as np  # type: ignore
import pandas as pd  # type: ignore


from .paths import get_data_dir
DATA_DIR = get_data_dir()
PROCESSED_DIR = DATA_DIR / "processed"
PROCESSED_DIR.mkdir(parents=True, exist_ok=True)


FEATURE_NAMES = [
    "num_medications",
    "num_medications_delta",
    "num_lab_procedures",
    "num_procedures",
    "time_in_hospital",
    "age",
    "sex_female",
    "sex_male",
    "race_african_american",
    "race_asian",
    "race_hispanic",
    "race_other",
    "a1c_value",
    "a1c_delta",
    "glu_value",
    "glu_delta",
    "gap_since_prev",
]


@dataclass
class PatientSequence:
    patient_id: Any
    features: List[List[float]]
    labels: List[int]


def _age_bucket_midpoint(age_bucket: str) -> float:
    """
    Convert age bucket like '[70-80)' to numeric midpoint (e.g., 75.0).
    """
    if not isinstance(age_bucket, str) or "-" not in age_bucket:
        return 0.0
    cleaned = age_bucket.strip("[]()")
    try:
        lo, hi = cleaned.split("-")
        return (float(lo) + float(hi)) / 2.0
    except Exception:
        return 0.0


def _map_a1c(value: str) -> float:
    """
    Map categorical A1Cresult to an approximate numeric value.
    """
    mapping = {
        "Norm": 5.5,
        ">7": 8.0,
        ">8": 9.0,
        "8-10": 9.0,
        "7-8": 7.5,
    }
    if not isinstance(value, str) or value == "None":
        return np.nan
    return mapping.get(value, np.nan)


def _map_glucose(value: str) -> float:
    """
    Map categorical max_glu_serum to an approximate numeric value.
    """
    mapping = {
        "Norm": 110.0,
        ">200": 250.0,
        ">300": 325.0,
    }
    if not isinstance(value, str) or value == "None":
        return np.nan
    return mapping.get(value, np.nan)


def _race_flags(race: str) -> Dict[str, float]:
    r = (race or "").strip()
    flags = {
        "race_african_american": 0.0,
        "race_asian": 0.0,
        "race_hispanic": 0.0,
        "race_other": 0.0,
    }
    if r == "AfricanAmerican":
        flags["race_african_american"] = 1.0
    elif r == "Asian":
        flags["race_asian"] = 1.0
    elif r == "Hispanic":
        flags["race_hispanic"] = 1.0
    elif r and r != "Caucasian":
        flags["race_other"] = 1.0
    return flags


def _sex_flags(gender: str) -> Dict[str, float]:
    g = (gender or "").strip().upper()
    sex_female = 1.0 if g == "F" or g == "FEMALE" else 0.0
    sex_male = 1.0 if g == "M" or g == "MALE" else 0.0
    return {"sex_female": sex_female, "sex_male": sex_male}


def build_sequences(df: pd.DataFrame) -> List[PatientSequence]:
    sequences: List[PatientSequence] = []

    grouped = df.sort_values(["patient_nbr", "encounter_id"]).groupby("patient_nbr")

    for patient_id, group in grouped:
        feats_seq: List[List[float]] = []
        labels_seq: List[int] = []

        prev_num_meds = 0.0
        prev_a1c = np.nan
        prev_glu = np.nan
        prev_index = None

        for idx, row in enumerate(group.itertuples(index=False), start=1):
            # Basic columns via attribute access
            num_medications = float(getattr(row, "num_medications"))
            num_lab_procedures = float(getattr(row, "num_lab_procedures"))
            num_procedures = float(getattr(row, "num_procedures"))
            time_in_hospital = float(getattr(row, "time_in_hospital"))

            age = _age_bucket_midpoint(getattr(row, "age"))
            sex = _sex_flags(getattr(row, "gender"))
            race = _race_flags(getattr(row, "race"))

            a1c_raw = getattr(row, "A1Cresult")
            glu_raw = getattr(row, "max_glu_serum")
            a1c_val = _map_a1c(a1c_raw)
            glu_val = _map_glucose(glu_raw)

            if np.isnan(a1c_val) and not np.isnan(prev_a1c):
                a1c_val = prev_a1c
            if np.isnan(glu_val) and not np.isnan(prev_glu):
                glu_val = prev_glu

            a1c_delta = 0.0 if np.isnan(prev_a1c) or np.isnan(a1c_val) else float(a1c_val - prev_a1c)
            glu_delta = 0.0 if np.isnan(prev_glu) or np.isnan(glu_val) else float(glu_val - prev_glu)

            num_meds_delta = float(num_medications - prev_num_meds)

            encounter_index = idx
            gap_since_prev = 0.0 if prev_index is None else float(encounter_index - prev_index)

            feature_vector: Dict[str, float] = {
                "num_medications": num_medications,
                "num_medications_delta": num_meds_delta,
                "num_lab_procedures": num_lab_procedures,
                "num_procedures": num_procedures,
                "time_in_hospital": time_in_hospital,
                "age": age,
                "a1c_value": float(a1c_val) if not np.isnan(a1c_val) else 0.0,
                "a1c_delta": a1c_delta,
                "glu_value": float(glu_val) if not np.isnan(glu_val) else 0.0,
                "glu_delta": glu_delta,
                "gap_since_prev": gap_since_prev,
            }
            feature_vector.update(sex)
            feature_vector.update(race)

            feats_seq.append([feature_vector[name] for name in FEATURE_NAMES])

            readmitted = getattr(row, "readmitted")
            label = 1 if readmitted == "<30" else 0
            labels_seq.append(label)

            prev_num_meds = num_medications
            prev_a1c = a1c_val
            prev_glu = glu_val
            prev_index = encounter_index

        if len(feats_seq) >= 2:
            sequences.append(PatientSequence(patient_id=patient_id, features=feats_seq, labels=labels_seq))

    return sequences


def main() -> None:
    d130_path = DATA_DIR / "diabetic_data.csv"
    if not d130_path.is_file():
        raise FileNotFoundError(f"Diabetes 130-US dataset not found at {d130_path}")

    df = pd.read_csv(d130_path)

    # Keep only encounters that have a known readmission status
    df = df[df["readmitted"].isin(["NO", ">30", "<30"])].copy()

    sequences = build_sequences(df)

    out_path = PROCESSED_DIR / "sequences.pkl"
    import pickle

    with out_path.open("wb") as f:
        pickle.dump(
            {
                "feature_names": FEATURE_NAMES,
                "sequences": [s.__dict__ for s in sequences],
            },
            f,
        )

    # Print summary
    num_patients = len(sequences)
    lengths = [len(s.features) for s in sequences]
    all_labels = [lab for s in sequences for lab in s.labels]

    print(f"Saved {num_patients} patient sequences to {out_path}")
    print(f"Avg sequence length: {np.mean(lengths):.2f}, max: {max(lengths)}, min: {min(lengths)}")
    print("Label distribution (0=no early readmission, 1=<30 readmission):")
    unique, counts = np.unique(all_labels, return_counts=True)
    for u, c in zip(unique, counts):
        print(f"  {u}: {c}")


if __name__ == "__main__":
    main()

