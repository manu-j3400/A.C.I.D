"""
backend/src/trainerModel_GCN.py

Phase 3b: GATConv GNN Malware Classifier
==========================================
Replaces the flat sklearn pipeline for structural code analysis.
Uses Graph Attention Networks to exploit both node features and typed
edge attributes (7 CFG/DDG edge types from cfg_extractor).

Architecture:
    GATConv(52 → 128, edge_dim=7, heads=4, concat=True)   → 512 per node
    GATConv(512 → 64,  edge_dim=7, heads=4, concat=True)  → 256 per node
    GATConv(256 → 32,  edge_dim=7, heads=1, concat=False) →  32 per node
    global_mean_pool(32) ‖ global_max_pool(32)             →  64 graph emb
    Linear(64 → 32) → ReLU → Dropout(0.3)
    Linear(32 → 1)  → Sigmoid                             →  P(malicious)
"""

from __future__ import annotations

from pathlib import Path
from typing import Optional

import torch
import torch.nn as nn
from torch_geometric.nn import GATConv, global_mean_pool, global_max_pool
from torch_geometric.loader import DataLoader as PyGDataLoader
from torch.optim.lr_scheduler import ReduceLROnPlateau
from sklearn.metrics import precision_score, recall_score, f1_score

from cfg_extractor import FEATURE_DIM  # type: ignore[import]

ML_MASTER_DIR  = Path(__file__).parent.parent / "ML_master"
GCN_MASTER_DIR = Path(__file__).parent.parent / "GCN_master"

EDGE_DIM = 7


class MalwareGCN(nn.Module):
    """
    Graph Attention Network for binary malware classification.
    Operates on CFG+DDG graphs produced by cfg_extractor.
    """

    def __init__(
        self,
        in_channels: int = FEATURE_DIM,
        hidden: tuple[int, int, int] = (128, 64, 32),
        heads: int = 4,
        edge_dim: int = EDGE_DIM,
        dropout: float = 0.3,
        batch_norm: bool = True,
    ) -> None:
        super().__init__()
        h1, h2, h3 = hidden
        self.batch_norm = batch_norm

        self.conv1 = GATConv(
            in_channels, h1, heads=heads, concat=True, edge_dim=edge_dim
        )
        self.bn1 = nn.BatchNorm1d(h1 * heads) if batch_norm else nn.Identity()
        self.conv2 = GATConv(
            h1 * heads, h2, heads=heads, concat=True, edge_dim=edge_dim
        )
        self.bn2 = nn.BatchNorm1d(h2 * heads) if batch_norm else nn.Identity()
        self.conv3 = GATConv(
            h2 * heads, h3, heads=1, concat=False, edge_dim=edge_dim
        )
        self.bn3 = nn.BatchNorm1d(h3) if batch_norm else nn.Identity()

        # After mean+max pooling concatenation: h3 * 2
        self.lin1    = nn.Linear(h3 * 2, 32)
        self.lin2    = nn.Linear(32, 1)
        self.relu    = nn.ReLU()
        self.dropout = nn.Dropout(dropout)

    def forward(
        self,
        x: torch.Tensor,
        edge_index: torch.Tensor,
        edge_attr: torch.Tensor,
        batch: torch.Tensor,
    ) -> torch.Tensor:
        """
        Returns shape [batch_size] — probability of malicious (0–1).
        """
        x = self.relu(self.bn1(self.conv1(x, edge_index, edge_attr=edge_attr)))
        x = self.relu(self.bn2(self.conv2(x, edge_index, edge_attr=edge_attr)))
        x = self.relu(self.bn3(self.conv3(x, edge_index, edge_attr=edge_attr)))

        mean_pool = global_mean_pool(x, batch)
        max_pool  = global_max_pool(x, batch)
        x = torch.cat([mean_pool, max_pool], dim=1)

        x = self.dropout(self.relu(self.lin1(x)))
        return torch.sigmoid(self.lin2(x)).squeeze(-1)


def train_gcn(
    dataset_path: "str | Path | None" = None,
    epochs: int = 100,
    lr: float = 1e-3,
    batch_size: int = 32,
    device: "torch.device | str | None" = None,
    hidden: "tuple[int, int, int]" = (128, 64, 32),
    heads: int = 4,
    dropout: float = 0.3,
) -> dict[str, float]:
    """
    Train MalwareGCN on the pre-built dataset.

    Returns a dict of test metrics: {precision, recall, f1, accuracy}.
    Saves best checkpoint to ML_master/acidModel_gcn.pt.
    """
    from dataPipeline_GCN import load_gcn_dataset  # type: ignore[import]

    if device is None:
        device = torch.device("cuda" if torch.cuda.is_available() else "cpu")
    else:
        device = torch.device(device)

    # Fix seeds for reproducibility on small datasets
    torch.manual_seed(42)
    if torch.cuda.is_available():
        torch.cuda.manual_seed_all(42)

    print(f"[trainerModel_GCN] Training on device: {device}")

    # --- Load dataset ---
    split = load_gcn_dataset(dataset_path)
    if not split.train:
        raise RuntimeError("Training set is empty. Run dataPipeline_GCN.py first.")

    val_loader   = PyGDataLoader(split.val,   batch_size=batch_size, shuffle=False) if split.val   else None
    test_loader  = PyGDataLoader(split.test,  batch_size=batch_size, shuffle=False) if split.test  else None

    # --- Model, loss, optimizer ---
    model = MalwareGCN(hidden=hidden, heads=heads, dropout=dropout).to(device)

    # Compute class imbalance weight for BCELoss
    all_labels = [int(d.y.item()) for d in split.train if d.y is not None]
    n_pos = sum(all_labels)
    n_neg = len(all_labels) - n_pos
    pos_weight = torch.tensor([n_neg / max(n_pos, 1)], dtype=torch.float, device=device)

    print(f"[trainerModel_GCN] Class dist — benign={n_neg} malicious={n_pos} pos_weight={pos_weight.item():.2f}")

    train_loader = PyGDataLoader(split.train, batch_size=batch_size, shuffle=True)

    criterion = nn.BCELoss(reduction="mean")
    optimizer = torch.optim.Adam(model.parameters(), lr=lr, weight_decay=1e-4)
    scheduler = ReduceLROnPlateau(optimizer, mode="max", patience=10, factor=0.5)

    best_val_f1     = 0.0
    best_state      = None
    early_stop_patience = 25
    epochs_no_improve   = 0
    _LABEL_SMOOTH = 0.05  # label smoothing: prevents overconfident BCE on scarce positives

    def _run_epoch(loader, train: bool) -> tuple[float, list, list]:
        if train:
            model.train()
        else:
            model.eval()
        total_loss = 0.0
        preds_all, labels_all = [], []
        ctx = torch.enable_grad() if train else torch.no_grad()
        with ctx:
            for batch in loader:
                batch = batch.to(device)
                out   = model(batch.x, batch.edge_index, batch.edge_attr, batch.batch)
                y     = batch.y.float()
                # Label smoothing: y=1 → 1-ε, y=0 → ε
                y_smooth = y * (1 - _LABEL_SMOOTH) + (1 - y) * _LABEL_SMOOTH
                # Weighted BCE: scale positive samples by pos_weight
                w = torch.where(y > 0, pos_weight.expand_as(y), torch.ones_like(y))
                loss = (w * nn.functional.binary_cross_entropy(out, y_smooth, reduction="none")).mean()
                if train:
                    optimizer.zero_grad()
                    loss.backward()
                    optimizer.step()
                total_loss += loss.item() * batch.num_graphs
                preds_all.extend((out >= 0.5).long().cpu().tolist())
                labels_all.extend(y.long().cpu().tolist())
        return total_loss / max(len(loader.dataset), 1), preds_all, labels_all

    print(f"[trainerModel_GCN] Starting training for {epochs} epoch(s)...")

    for epoch in range(1, epochs + 1):
        tr_loss, tr_preds, tr_labels = _run_epoch(train_loader, train=True)
        tr_acc = sum(p == l for p, l in zip(tr_preds, tr_labels)) / max(len(tr_labels), 1)

        val_f1 = 0.0
        if val_loader:
            _, vp, vl = _run_epoch(val_loader, train=False)
            val_f1 = f1_score(vl, vp, zero_division=0)
            scheduler.step(val_f1)
            if val_f1 > best_val_f1:
                best_val_f1     = val_f1
                best_state      = {k: v.cpu().clone() for k, v in model.state_dict().items()}
                epochs_no_improve = 0
            else:
                epochs_no_improve += 1

        if epoch % 10 == 0 or epoch == 1:
            print(
                f"  Epoch {epoch:3d}/{epochs} | "
                f"train_loss={tr_loss:.4f} train_acc={tr_acc:.3f} "
                f"val_f1={val_f1:.3f}"
            )

        if val_loader and epochs_no_improve >= early_stop_patience:
            print(f"[trainerModel_GCN] Early stopping at epoch {epoch} (no improvement for {early_stop_patience} epochs)")
            break

    # --- Tune decision threshold on val set ---
    optimal_threshold = 0.5
    if val_loader and best_state is not None:
        model.load_state_dict(best_state)
        model.eval()
        _probs, _labels = [], []
        with torch.no_grad():
            for batch in val_loader:
                batch = batch.to(device)
                out = model(batch.x, batch.edge_index, batch.edge_attr, batch.batch)
                _probs.extend(out.cpu().tolist())
                _labels.extend(batch.y.long().cpu().tolist())
        best_t, best_f1 = 0.5, 0.0
        for t in [i / 20 for i in range(2, 18)]:  # 0.10 to 0.85
            preds = [1 if p >= t else 0 for p in _probs]
            f = f1_score(_labels, preds, zero_division=0)
            if f > best_f1:
                best_f1, best_t = f, t
        optimal_threshold = best_t
        print(f"[trainerModel_GCN] Tuned threshold={optimal_threshold:.2f} (val_f1={best_f1:.3f})")

    # --- Test metrics ---
    test_metrics: dict[str, float] = {}
    if test_loader and best_state is not None:
        model.load_state_dict(best_state)
        # Collect raw probs for test set using tuned threshold
        model.eval()
        _tprobs, tl = [], []
        with torch.no_grad():
            for batch in test_loader:
                batch = batch.to(device)
                out = model(batch.x, batch.edge_index, batch.edge_attr, batch.batch)
                _tprobs.extend(out.cpu().tolist())
                tl.extend(batch.y.long().cpu().tolist())
        tp = [1 if p >= optimal_threshold else 0 for p in _tprobs]
        if len(set(tl)) > 1:
            test_metrics = {
                "precision": precision_score(tl, tp, zero_division=0),
                "recall":    recall_score(tl, tp, zero_division=0),
                "f1":        f1_score(tl, tp, zero_division=0),
                "accuracy":  sum(p == l for p, l in zip(tp, tl)) / len(tl),
            }
        else:
            acc = sum(p == l for p, l in zip(tp, tl)) / len(tl)
            test_metrics = {"precision": 0.0, "recall": 0.0, "f1": 0.0, "accuracy": acc}
        print(f"[trainerModel_GCN] Test metrics: {test_metrics}")

    # --- Save checkpoint ---
    ML_MASTER_DIR.mkdir(parents=True, exist_ok=True)
    save_path = ML_MASTER_DIR / "acidModel_gcn.pt"
    torch.save(
        {
            "model_state_dict":  best_state if best_state is not None else model.state_dict(),
            "in_channels":       FEATURE_DIM,
            "hidden":            hidden,
            "heads":             heads,
            "edge_dim":          EDGE_DIM,
            "dropout":           dropout,
            "batch_norm":        True,
            "best_val_f1":       best_val_f1,
            "optimal_threshold": optimal_threshold,
            "test_metrics":      test_metrics,
        },
        save_path,
    )
    print(f"[trainerModel_GCN] Checkpoint saved to {save_path}")

    return test_metrics


def load_gcn_model(
    model_path: "str | Path | None" = None,
    device: "torch.device | str | None" = None,
) -> Optional[MalwareGCN]:
    """
    Load a saved MalwareGCN checkpoint.

    Returns None (no crash) if the checkpoint file does not exist.
    Uses weights_only=True to guard against arbitrary pickle execution.
    """
    path = Path(model_path) if model_path else ML_MASTER_DIR / "acidModel_gcn.pt"
    if not path.exists():
        return None

    if device is None:
        device = torch.device("cuda" if torch.cuda.is_available() else "cpu")
    else:
        device = torch.device(device)

    try:
        ckpt = torch.load(path, map_location=device, weights_only=True)
    except Exception:
        # weights_only may fail on older checkpoints; fall back gracefully
        ckpt = torch.load(path, map_location=device, weights_only=False)  # nosec B614 - fallback for legacy checkpoints only; primary path uses weights_only=True

    model = MalwareGCN(
        in_channels=ckpt.get("in_channels", FEATURE_DIM),
        hidden=ckpt.get("hidden", (128, 64, 32)),
        heads=ckpt.get("heads", 4),
        edge_dim=ckpt.get("edge_dim", EDGE_DIM),
        dropout=ckpt.get("dropout", 0.3),
        batch_norm=ckpt.get("batch_norm", False),  # False for old checkpoints
    ).to(device)
    model.load_state_dict(ckpt["model_state_dict"])
    model.eval()
    model.optimal_threshold = float(ckpt.get("optimal_threshold", 0.5))  # type: ignore[attr-defined]
    return model


def predict_gcn(
    model: MalwareGCN,
    data,
    device: "torch.device | str | None" = None,
    threshold: "float | None" = None,
) -> tuple[bool, float]:
    """
    Run inference on a single PyG Data object.

    CRITICAL: sets data.batch to zeros for single-graph inference
    (no batch tensor exists on a standalone Data object).

    Returns (is_malicious: bool, probability: float).
    """
    if threshold is None:
        threshold = getattr(model, "optimal_threshold", 0.5)
    if device is None:
        device = next(model.parameters()).device
    else:
        device = torch.device(device)

    data = data.to(device)

    # Single-graph inference requires an explicit batch tensor
    if data.batch is None or data.batch.shape[0] != data.num_nodes:
        data.batch = torch.zeros(data.num_nodes, dtype=torch.long, device=device)

    model.eval()
    with torch.no_grad():
        prob = model(data.x, data.edge_index, data.edge_attr, data.batch)
        prob_val = float(prob.item() if prob.dim() == 0 else prob[0].item())

    return prob_val >= threshold, prob_val


# ============================================================================
# Self-test (run as script)
# ============================================================================

if __name__ == "__main__":
    metrics = train_gcn(epochs=100)
    print(f"\n=== GCN Training Complete ===")
    for k, v in metrics.items():
        print(f"  {k:10s}: {v:.4f}")
