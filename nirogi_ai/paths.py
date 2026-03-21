import os
from pathlib import Path

def get_models_dir() -> Path:
    """
    Find the models directory in various possible locations.
    - Legacy Root: doc/models
    - Restructured: doc/backend/data/models
    - Local: nirogi_ai/../models
    """
    pkg_root = Path(__file__).resolve().parent.parent
    possible_dirs = [
        pkg_root / "models",
        pkg_root / "Backend" / "data" / "models",
        pkg_root / "backend" / "data" / "models",
        Path("models").resolve(),
    ]
    
    for d in possible_dirs:
        if d.is_dir() and (d / "feature_config.json").is_file():
            return d
            
    # Fallback to local if nothing else works
    return pkg_root / "models"

def get_data_dir() -> Path:
    """
    Find the data directory (CSV source) in various possible locations.
    """
    pkg_root = Path(__file__).resolve().parent.parent
    possible_dirs = [
        pkg_root / "data",
        pkg_root / "Backend" / "data",
        pkg_root / "backend" / "data",
        Path("data").resolve(),
    ]
    
    for d in possible_dirs:
        if d.is_dir() and (d / "diabetes.csv").is_file():
            return d
            
    return pkg_root / "data"
