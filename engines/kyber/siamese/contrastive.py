"""
Siamese GCN — Training Loop & Inference
=========================================

Pairs for contrastive training:
  Positive (Y=0, similar):   same function's AST-CFG and bytecode-CFG
  Negative (Y=1, dissimilar): AST-CFG of function A with bytecode-CFG of function B

Training procedure:
  1. Build (source_graph, bytecode_graph, label) triplets from a corpus.
  2. Forward pass through SiameseGCN → distances D_W.
  3. Compute ContrastiveLoss, backprop, AdamW step.
  4. Repeat until validation loss converges.

At inference time, call verify() with a new source string to get a
semantic similarity score proving (or disproving) source-bytecode equivalence.
"""

from __future__ import annotations

import random
import time
from dataclasses import dataclass, field
from typing import Iterator, List, Optional, Tuple

import torch
import torch.optim as optim
from torch import Tensor
from torch.utils.data import DataLoader, Dataset
from torch_geometric.data import Batch, Data

from .cfg_builder import ASTCFGBuilder, BytecodeCFGBuilder, ControlFlowGraph
from .network import ContrastiveLoss, IRVerificationResult, SiameseGCN


# ---------------------------------------------------------------------------
# Dataset
# ---------------------------------------------------------------------------

@dataclass
class GraphPair:
    """A (source_graph, bytecode_graph, label) training triplet."""
    src_data:  Data
    byte_data: Data
    label:     float   # 0.0 = equivalent, 1.0 = injected/mismatched
    source_id: str     # opaque identifier for logging


class GraphPairDataset(Dataset):
    """
    Dataset of (source CFG, bytecode CFG, label) pairs for contrastive training.

    Positive pairs  (label=0): a source string paired with its own bytecode.
    Negative pairs  (label=1): a source string paired with a different function's bytecode.

    The negative pairs are constructed by randomly shuffling the bytecode graphs
    within a batch (in-batch negatives), which is efficient for large corpora.
    """

    def __init__(self, pairs: List[GraphPair]) -> None:
        self.pairs = pairs

    def __len__(self) -> int:
        return len(self.pairs)

    def __getitem__(self, idx: int) -> GraphPair:
        return self.pairs[idx]

    @classmethod
    def from_source_list(
        cls,
        sources:        List[str],
        negative_ratio: float = 0.5,
        seed:           int   = 42,
    ) -> "GraphPairDataset":
        """
        Build positive and negative pairs from a list of source strings.

        For each source, one positive pair is created (source ↔ its bytecode).
        Additional negative pairs are created by pairing source_i with bytecode_j (i≠j).

        Parameters
        ----------
        sources        List of Python source strings.
        negative_ratio Fraction of total pairs that are negatives.
        """
        ast_builder  = ASTCFGBuilder()
        byte_builder = BytecodeCFGBuilder()

        src_graphs:  List[Optional[Data]] = []
        byte_graphs: List[Optional[Data]] = []

        for src in sources:
            try:
                src_graphs.append(ast_builder.build(src).to_pyg_data())
                byte_graphs.append(byte_builder.build(src).to_pyg_data())
            except Exception:
                src_graphs.append(None)
                byte_graphs.append(None)

        valid_indices = [
            i for i in range(len(sources))
            if src_graphs[i] is not None and byte_graphs[i] is not None
        ]

        pairs: List[GraphPair] = []

        # Positive pairs
        for i in valid_indices:
            pairs.append(GraphPair(
                src_data  = src_graphs[i],    # type: ignore[arg-type]
                byte_data = byte_graphs[i],   # type: ignore[arg-type]
                label     = 0.0,
                source_id = f"pos_{i}",
            ))

        # Negative pairs (random mismatches)
        rng = random.Random(seed)
        n_neg = int(len(valid_indices) * negative_ratio / (1 - negative_ratio + 1e-9))
        n_neg = min(n_neg, len(valid_indices) * 3)   # cap at 3× positives

        for _ in range(n_neg):
            i = rng.choice(valid_indices)
            j = rng.choice(valid_indices)
            if i != j:
                pairs.append(GraphPair(
                    src_data  = src_graphs[i],    # type: ignore[arg-type]
                    byte_data = byte_graphs[j],   # type: ignore[arg-type]
                    label     = 1.0,
                    source_id = f"neg_{i}_{j}",
                ))

        return cls(pairs)


def _collate_pairs(batch: List[GraphPair]) -> Tuple[Batch, Batch, Tensor]:
    """Custom collate function for DataLoader."""
    src_batch  = Batch.from_data_list([p.src_data  for p in batch])
    byte_batch = Batch.from_data_list([p.byte_data for p in batch])
    labels     = torch.tensor([p.label for p in batch], dtype=torch.float32)
    return src_batch, byte_batch, labels


# ---------------------------------------------------------------------------
# Trainer
# ---------------------------------------------------------------------------

@dataclass
class TrainingConfig:
    epochs:       int   = 50
    batch_size:   int   = 32
    lr:           float = 1e-3
    weight_decay: float = 1e-4
    margin:       float = 1.0
    device:       str   = "cuda" if torch.cuda.is_available() else "cpu"
    patience:     int   = 10   # early stopping patience (epochs without improvement)
    checkpoint_path: Optional[str] = None


class SiameseTrainer:
    """
    Training loop for the SiameseGCN IR equivalence verifier.

    Implements early stopping and optional checkpoint saving.
    """

    def __init__(self, config: TrainingConfig) -> None:
        self.config  = config
        self.device  = torch.device(config.device)
        self.model   = SiameseGCN().to(self.device)
        self.loss_fn = ContrastiveLoss(margin=config.margin)
        self.optimizer = optim.AdamW(
            self.model.parameters(),
            lr           = config.lr,
            weight_decay = config.weight_decay,
        )
        self.scheduler = optim.lr_scheduler.CosineAnnealingLR(
            self.optimizer, T_max=config.epochs, eta_min=1e-6
        )
        self.train_losses: List[float] = []
        self.val_losses:   List[float] = []

    def train(
        self,
        train_dataset: GraphPairDataset,
        val_dataset:   Optional[GraphPairDataset] = None,
    ) -> SiameseGCN:
        """
        Run the full training loop.

        Returns the best model (by validation loss or training loss if no val set).
        """
        train_loader = DataLoader(
            train_dataset,
            batch_size  = self.config.batch_size,
            shuffle     = True,
            collate_fn  = _collate_pairs,
            num_workers = 0,
        )
        best_loss   = float("inf")
        no_improve  = 0
        best_state  = None

        for epoch in range(1, self.config.epochs + 1):
            t0 = time.perf_counter()

            train_loss = self._train_epoch(train_loader)
            self.train_losses.append(train_loss)

            val_loss = self._eval_epoch(val_dataset) if val_dataset else train_loss
            if val_dataset:
                self.val_losses.append(val_loss)

            self.scheduler.step()

            monitor_loss = val_loss if val_dataset else train_loss
            if monitor_loss < best_loss - 1e-5:
                best_loss  = monitor_loss
                no_improve = 0
                best_state = {k: v.clone() for k, v in self.model.state_dict().items()}
            else:
                no_improve += 1

            elapsed = (time.perf_counter() - t0) * 1000
            print(
                f"Epoch {epoch:03d}/{self.config.epochs} | "
                f"train={train_loss:.4f} | val={val_loss:.4f} | "
                f"lr={self.optimizer.param_groups[0]['lr']:.2e} | "
                f"{elapsed:.0f} ms"
            )

            if no_improve >= self.config.patience:
                print(f"Early stopping at epoch {epoch} (no improvement for {self.config.patience} epochs)")
                break

        if best_state is not None:
            self.model.load_state_dict(best_state)

        if self.config.checkpoint_path:
            torch.save(self.model.state_dict(), self.config.checkpoint_path)
            print(f"Checkpoint saved to {self.config.checkpoint_path}")

        return self.model

    def _train_epoch(self, loader: DataLoader) -> float:
        self.model.train()
        total_loss = 0.0
        for src_batch, byte_batch, labels in loader:
            src_batch  = src_batch.to(self.device)
            byte_batch = byte_batch.to(self.device)
            labels     = labels.to(self.device)

            self.optimizer.zero_grad()
            _, _, distances = self.model(src_batch, byte_batch)
            loss = self.loss_fn(distances, labels)
            loss.backward()
            torch.nn.utils.clip_grad_norm_(self.model.parameters(), max_norm=1.0)
            self.optimizer.step()
            total_loss += loss.item()

        return total_loss / max(len(loader), 1)

    def _eval_epoch(self, dataset: GraphPairDataset) -> float:
        loader = DataLoader(
            dataset, batch_size=self.config.batch_size,
            shuffle=False, collate_fn=_collate_pairs
        )
        self.model.eval()
        total_loss = 0.0
        with torch.no_grad():
            for src_batch, byte_batch, labels in loader:
                src_batch  = src_batch.to(self.device)
                byte_batch = byte_batch.to(self.device)
                labels     = labels.to(self.device)
                _, _, distances = self.model(src_batch, byte_batch)
                total_loss += self.loss_fn(distances, labels).item()
        return total_loss / max(len(loader), 1)


# ---------------------------------------------------------------------------
# Inference helper
# ---------------------------------------------------------------------------

def verify_source_bytecode(
    source:    str,
    model:     SiameseGCN,
    threshold: float = 0.85,
    device:    str   = "cpu",
) -> IRVerificationResult:
    """
    Verify that a source string's bytecode matches its AST structure.

    A low similarity score indicates the compiled bytecode contains
    transformations not present in the source — a possible compiler-level
    injection attack.

    Parameters
    ----------
    source     Python source string to verify.
    model      Trained SiameseGCN (in eval mode).
    threshold  Similarity score below which a mismatch is flagged.
    device     Torch device string.

    Returns
    -------
    IRVerificationResult with similarity_score, distance, is_equivalent.
    """
    dev = torch.device(device)
    model.eval()

    try:
        src_cfg  = ASTCFGBuilder().build(source)
        byte_cfg = BytecodeCFGBuilder().build(source)
    except ValueError as e:
        return IRVerificationResult(
            similarity_score = 0.0,
            distance         = 2.0,
            is_equivalent    = False,
            threshold        = threshold,
        )

    src_data  = src_cfg.to_pyg_data().to(dev)
    byte_data = byte_cfg.to_pyg_data().to(dev)

    with torch.no_grad():
        score = model.similarity_score(src_data, byte_data)
        _, _, dist = model(src_data, byte_data)

    sim = float(score.item())
    return IRVerificationResult(
        similarity_score = sim,
        distance         = float(dist.item()),
        is_equivalent    = sim >= threshold,
        threshold        = threshold,
    )
