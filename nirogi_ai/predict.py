"""
Risk prediction for NIROGI.

Public entry point:
    get_risk_score(features: dict) -> float

This wraps a trained PyTorch LSTM model and applies the South Asian
QRISK3-style adjustment (1.4x multiplier on baseline risk).
"""

from __future__ import annotations

from pathlib import Path
from typing import Any, Dict, Optional, Tuple

import json

import numpy as np  # type: ignore

try:
    import torch  # type: ignore
except ImportError:  # pragma: no cover - torch may not be installed in all envs
    torch = None


_MODEL = None  # Lazy-loaded model instance.
_FEATURE_CONFIG: Optional[Dict[str, Any]] = None


def get_risk_score(features: Dict[str, Any]) -> float:
    """
    Return a 0–1 risk score given a feature dictionary.

    Expected input example (can contain more keys):
        {
            "adherence_7d": 0.86,
            "adherence_30d": 0.78,
            "hba1c_slope_90d": 0.15,
            "sbp_slope_30d": 4.0,
            "missed_doses_7d": 2,
            "refill_gap_days": 3,
            "age": 64,
            "sex_female": 1,
            ...
        }

    Internally we map this dict onto the feature vector used during training
    (feature_config.json). Any missing features fall back to the training set
    mean so that inference remains stable even if the backend omits some
    optional inputs.
    """
    model, cfg = _load_model_and_config()
    if model is None or cfg is None:
        base_risk = 0.1
        return float(min(base_risk * 1.4, 1.0))

    feature_names = cfg["feature_names"]
    mean = np.array(cfg["mean"], dtype=np.float32)
    std = np.array(cfg["std"], dtype=np.float32)
    max_len = int(cfg.get("max_len", 10))

    # Build ordered feature vector using training feature names.
    vec = np.zeros(len(feature_names), dtype=np.float32)
    for i, name in enumerate(feature_names):
        if name in features:
            try:
                vec[i] = float(features[name])
            except (TypeError, ValueError):
                vec[i] = mean[i]
        else:
            vec[i] = mean[i]

    vec = (vec - mean) / (std + 1e-6)

    # Create a sequence of length 1 at the end of a padded sequence.
    seq = np.zeros((max_len, len(feature_names)), dtype=np.float32)
    seq[-1, :] = vec
    length = 1

    if torch is None:
        base_risk = 0.1
        return float(min(base_risk * 1.4, 1.0))

    x_tensor = torch.from_numpy(seq).unsqueeze(0)
    lengths_tensor = torch.tensor([length], dtype=torch.long)

    model.eval()
    with torch.no_grad():
        logits = model(x_tensor, lengths_tensor)
        prob = torch.sigmoid(logits).item()

    adjusted = min(prob * 1.4, 1.0)
    return float(adjusted)


def _load_model_and_config() -> Tuple[Optional[Any], Optional[Dict[str, Any]]]:
    """
    Lazy-load the trained LSTM model and feature configuration.
    """
    global _MODEL, _FEATURE_CONFIG

    if _MODEL is not None and _FEATURE_CONFIG is not None:
        return _MODEL, _FEATURE_CONFIG

    if torch is None:
        return None, None

    models_dir = Path(__file__).resolve().parents[1] / "models"
    model_path = models_dir / "risk_lstm.pt"
    cfg_path = models_dir / "feature_config.json"

    if not model_path.is_file() or not cfg_path.is_file():
        return None, None

    from .train_risk_lstm_step3_train import RiskLSTM  # type: ignore

    with cfg_path.open("r", encoding="utf-8") as f:
        cfg = json.load(f)

    feature_names = cfg["feature_names"]
    input_dim = len(feature_names)

    model = RiskLSTM(input_dim=input_dim, hidden_dim=64, num_layers=2)
    model.load_state_dict(torch.load(model_path, map_location="cpu"))

    _MODEL = model
    _FEATURE_CONFIG = cfg
    return _MODEL, _FEATURE_CONFIG


__all__ = ["get_risk_score"]

