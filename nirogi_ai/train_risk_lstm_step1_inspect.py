from __future__ import annotations

"""
Step 1: Inspect Kaggle diabetes datasets for NIROGI risk model.

This script:
- Loads the Pima Indians Diabetes dataset and Diabetes 130-US hospitals dataset
  from the local data directory.
- Prints basic information (shape, columns, and sample rows) so we can
  confirm paths and understand available features.

CSV paths are assumed to be:
    data/diabetes.csv        (Pima Indians)
    data/diabetic_data.csv   (Diabetes 130-US)

Run with:
    python -m nirogi_ai.train_risk_lstm_step1_inspect
or:
    python nirogi_ai/train_risk_lstm_step1_inspect.py
"""

from pathlib import Path

import pandas as pd  # type: ignore


from .paths import get_data_dir
DATA_DIR = get_data_dir()


def main() -> None:
    pima_path = DATA_DIR / "diabetes.csv"
    d130_path = DATA_DIR / "diabetic_data.csv"

    print(f"Pima path: {pima_path}")
    print(f"Diabetes 130-US path: {d130_path}")

    if not pima_path.is_file():
        print("ERROR: Pima dataset not found at", pima_path)
    else:
        pima = pd.read_csv(pima_path)
        print("\n=== Pima Indians Diabetes Dataset ===")
        print("Shape:", pima.shape)
        print("Columns:", list(pima.columns))
        print("\nHead:")
        print(pima.head())

    if not d130_path.is_file():
        print("\nERROR: Diabetes 130-US dataset not found at", d130_path)
    else:
        d130 = pd.read_csv(d130_path)
        print("\n=== Diabetes 130-US Hospitals Dataset ===")
        print("Shape:", d130.shape)
        print("Columns:", list(d130.columns))
        print("\nHead:")
        print(d130.head())

        # Also show value counts for the key outcome column.
        if "readmitted" in d130.columns:
            print("\nreadmitted value counts:")
            print(d130["readmitted"].value_counts())


if __name__ == "__main__":
    main()

