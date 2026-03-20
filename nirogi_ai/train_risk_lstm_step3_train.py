from __future__ import annotations

"""
Step 3: Train LSTM risk model for NIROGI.

This script:
- Loads per-patient sequences from data/processed/sequences.pkl
- Splits patients into train/val/test
- Standardizes features using train set
- Trains a 2-layer LSTM to predict risk of <30-day readmission
- Evaluates AUC-ROC on val and test sets
- Saves:
    models/risk_lstm.pt          (PyTorch state dict)
    models/feature_config.json   (feature names, mean, std)
    models/metrics.json          (AUC scores)

Run with:
    python nirogi_ai/train_risk_lstm_step3_train.py
"""

from dataclasses import dataclass
from pathlib import Path
from typing import Any, Dict, List, Tuple

import numpy as np  # type: ignore
import torch  # type: ignore
import torch.nn as nn  # type: ignore
from sklearn.metrics import roc_auc_score  # type: ignore
from torch.nn.utils.rnn import pack_padded_sequence  # type: ignore
from torch.utils.data import DataLoader, Dataset  # type: ignore


PROJECT_ROOT = Path(__file__).resolve().parents[1]
DATA_DIR = PROJECT_ROOT / "data"
PROCESSED_PATH = DATA_DIR / "processed" / "sequences.pkl"
MODELS_DIR = PROJECT_ROOT / "models"
MODELS_DIR.mkdir(parents=True, exist_ok=True)


@dataclass
class PatientSequence:
    patient_id: Any
    features: List[List[float]]
    labels: List[int]


class SequenceDataset(Dataset):
    def __init__(
        self,
        sequences: List[PatientSequence],
        feature_names: List[str],
        mean: np.ndarray,
        std: np.ndarray,
        max_len: int,
    ) -> None:
        self.sequences = sequences
        self.feature_names = feature_names
        self.mean = mean
        self.std = std
        self.max_len = max_len

    def __len__(self) -> int:
        return len(self.sequences)

    def __getitem__(self, idx: int) -> Tuple[torch.Tensor, int, float]:
        seq = self.sequences[idx]
        x = np.array(seq.features, dtype=np.float32)
        # Standardize
        x = (x - self.mean) / (self.std + 1e-6)

        length = min(len(x), self.max_len)
        x = x[-self.max_len :]  # keep most recent max_len steps
        length = min(length, self.max_len)

        # Pad if needed (at the beginning)
        if len(x) < self.max_len:
            pad_len = self.max_len - len(x)
            pad = np.zeros((pad_len, x.shape[1]), dtype=np.float32)
            x = np.vstack([pad, x])

        y = float(seq.labels[-1] > 0)  # label from last encounter

        return torch.from_numpy(x), length, y


class RiskLSTM(nn.Module):
    def __init__(self, input_dim: int, hidden_dim: int = 128, num_layers: int = 2, dropout: float = 0.3) -> None:
        super().__init__()
        self.lstm = nn.LSTM(
            input_dim,
            hidden_dim,
            num_layers=num_layers,
            batch_first=True,
            bidirectional=False,
            dropout=dropout,
        )
        self.fc = nn.Linear(hidden_dim, 1)

    def forward(self, x: torch.Tensor, lengths: torch.Tensor) -> torch.Tensor:
        # x: (batch, seq_len, input_dim)
        # lengths: (batch,)
        packed = pack_padded_sequence(
            x, lengths.cpu(), batch_first=True, enforce_sorted=False
        )
        packed_out, (h_n, _) = self.lstm(packed)
        last_hidden = h_n[-1]  # (batch, hidden_dim)
        logits = self.fc(last_hidden).squeeze(-1)  # (batch,)
        return logits


def load_sequences() -> Tuple[List[PatientSequence], List[str]]:
    import pickle

    if not PROCESSED_PATH.is_file():
        raise FileNotFoundError(f"Processed sequences not found at {PROCESSED_PATH}")

    with PROCESSED_PATH.open("rb") as f:
        obj = pickle.load(f)

    feature_names: List[str] = obj["feature_names"]
    raw_seqs = obj["sequences"]

    sequences: List[PatientSequence] = []
    for s in raw_seqs:
        sequences.append(
            PatientSequence(
                patient_id=s["patient_id"],
                features=s["features"],
                labels=s["labels"],
            )
        )

    return sequences, feature_names


def split_sequences(
    sequences: List[PatientSequence], seed: int = 42
) -> Tuple[List[PatientSequence], List[PatientSequence], List[PatientSequence]]:
    rng = np.random.default_rng(seed)
    indices = np.arange(len(sequences))
    rng.shuffle(indices)

    n = len(indices)
    n_train = int(0.7 * n)
    n_val = int(0.15 * n)

    train_idx = indices[:n_train]
    val_idx = indices[n_train : n_train + n_val]
    test_idx = indices[n_train + n_val :]

    def _select(idx_arr: np.ndarray) -> List[PatientSequence]:
        return [sequences[i] for i in idx_arr]

    return _select(train_idx), _select(val_idx), _select(test_idx)


def compute_mean_std(
    sequences: List[PatientSequence], feature_dim: int
) -> Tuple[np.ndarray, np.ndarray]:
    all_feats = np.concatenate(
        [np.array(seq.features, dtype=np.float32) for seq in sequences], axis=0
    )
    mean = all_feats.mean(axis=0)
    std = all_feats.std(axis=0)
    std[std == 0] = 1.0
    return mean, std


def collate_batch(
    batch: List[Tuple[torch.Tensor, int, float]]
) -> Tuple[torch.Tensor, torch.Tensor, torch.Tensor]:
    xs, lengths, ys = zip(*batch)
    x = torch.stack(xs, dim=0)  # (batch, seq_len, input_dim)
    lengths_tensor = torch.tensor(lengths, dtype=torch.long)
    y = torch.tensor(ys, dtype=torch.float32)
    return x, lengths_tensor, y


def train() -> None:
    sequences, feature_names = load_sequences()
    input_dim = len(feature_names)

    train_seqs, val_seqs, test_seqs = split_sequences(sequences)

    mean, std = compute_mean_std(train_seqs, input_dim)

    max_len = 10
    batch_size = 64
    num_epochs = 20
    device = torch.device("cuda" if torch.cuda.is_available() else "cpu")

    train_ds = SequenceDataset(train_seqs, feature_names, mean, std, max_len)
    val_ds = SequenceDataset(val_seqs, feature_names, mean, std, max_len)
    test_ds = SequenceDataset(test_seqs, feature_names, mean, std, max_len)

    train_loader = DataLoader(
        train_ds, batch_size=batch_size, shuffle=True, collate_fn=collate_batch
    )
    val_loader = DataLoader(
        val_ds, batch_size=batch_size, shuffle=False, collate_fn=collate_batch
    )
    test_loader = DataLoader(
        test_ds, batch_size=batch_size, shuffle=False, collate_fn=collate_batch
    )

    model = RiskLSTM(input_dim=input_dim, hidden_dim=128, num_layers=2, dropout=0.3).to(device)

    # Compute class weights to handle imbalance (<30 vs others)
    all_labels = [lab for s in train_seqs for lab in s.labels]
    pos = sum(1 for y in all_labels if y > 0)
    neg = len(all_labels) - pos
    if pos > 0 and neg > 0:
        pos_weight = torch.tensor(neg / pos, dtype=torch.float32, device=device)
        criterion = nn.BCEWithLogitsLoss(pos_weight=pos_weight)
    else:
        criterion = nn.BCEWithLogitsLoss()
    optimizer = torch.optim.Adam(model.parameters(), lr=1e-3)

    best_val_auc = 0.0

    for epoch in range(1, num_epochs + 1):
        model.train()
        total_loss = 0.0
        for x, lengths, y in train_loader:
            x = x.to(device)
            lengths = lengths.to(device)
            y = y.to(device)

            optimizer.zero_grad()
            logits = model(x, lengths)
            loss = criterion(logits, y)
            loss.backward()
            optimizer.step()
            total_loss += loss.item() * x.size(0)

        avg_loss = total_loss / len(train_ds)

        def eval_loader(loader: DataLoader) -> float:
            model.eval()
            all_probs: List[float] = []
            all_labels: List[float] = []
            with torch.no_grad():
                for x, lengths, y in loader:
                    x = x.to(device)
                    lengths = lengths.to(device)
                    logits = model(x, lengths)
                    probs = torch.sigmoid(logits)
                    all_probs.extend(probs.cpu().numpy().tolist())
                    all_labels.extend(y.numpy().tolist())
            try:
                return float(roc_auc_score(all_labels, all_probs))
            except ValueError:
                return float("nan")

        val_auc = eval_loader(val_loader)
        test_auc = eval_loader(test_loader)

        print(
            f"Epoch {epoch}/{num_epochs} - "
            f"train_loss={avg_loss:.4f}, val_auc={val_auc:.4f}, test_auc={test_auc:.4f}"
        )

        if val_auc > best_val_auc:
            best_val_auc = val_auc
            # Save best model
            torch.save(model.state_dict(), MODELS_DIR / "risk_lstm.pt")
            print(f"  Saved new best model with val_auc={val_auc:.4f}")

    # Save feature config and final metrics
    import json

    feature_config = {
        "feature_names": feature_names,
        "mean": mean.tolist(),
        "std": std.tolist(),
        "max_len": max_len,
    }
    with (MODELS_DIR / "feature_config.json").open("w", encoding="utf-8") as f:
        json.dump(feature_config, f, indent=2)

    # Evaluate final best model on test set
    best_model = RiskLSTM(input_dim=input_dim, hidden_dim=128, num_layers=2, dropout=0.3).to(device)
    best_model.load_state_dict(torch.load(MODELS_DIR / "risk_lstm.pt", map_location=device))

    def eval_model(m: RiskLSTM, loader: DataLoader) -> float:
        m.eval()
        all_probs: List[float] = []
        all_labels: List[float] = []
        with torch.no_grad():
            for x, lengths, y in loader:
                x = x.to(device)
                lengths = lengths.to(device)
                logits = m(x, lengths)
                probs = torch.sigmoid(logits)
                all_probs.extend(probs.cpu().numpy().tolist())
                all_labels.extend(y.numpy().tolist())
        try:
            return float(roc_auc_score(all_labels, all_probs))
        except ValueError:
            return float("nan")

    final_val_auc = eval_model(best_model, val_loader)
    final_test_auc = eval_model(best_model, test_loader)

    metrics = {
        "val_auc": final_val_auc,
        "test_auc": final_test_auc,
        "best_val_auc": best_val_auc,
    }
    with (MODELS_DIR / "metrics.json").open("w", encoding="utf-8") as f:
        json.dump(metrics, f, indent=2)

    print("Training complete.")
    print(f"Best val AUC: {best_val_auc:.4f}")
    print(f"Final val AUC: {final_val_auc:.4f}, test AUC: {final_test_auc:.4f}")


if __name__ == "__main__":
    train()

