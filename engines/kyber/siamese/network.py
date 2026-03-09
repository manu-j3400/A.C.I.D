"""
Engine 2: Siamese GCN — IR Equivalence Verifier
================================================

Architecture
------------
  Source code  ──[ASTCFGBuilder]──►  G_src  ─┐
                                              ├──[Shared GCN Encoder]──►  z_src, z_byte
  Bytecode     ──[BytecodeCFGBuilder]► G_byte ─┘
                                              │
                                     ┌────────▼──────────┐
                                     │   Contrastive     │
                                     │   Loss  L(W,Y,..) │
                                     └───────────────────┘
                                              │
                                     similarity ∈ [0, 1]

The shared GCN encoder maps both graph types to the same R^latent_dim latent
space. Semantically equivalent source/bytecode pairs are pulled together;
injected pairs (where a compiler silently transforms code) are pushed apart.

Contrastive loss (Hadsell et al. 2006, as specified):
  L(W, Y, X₁, X₂) = (1−Y)·½·D_W² + Y·½·max(0, m − D_W)²

  Y=0 → similar  (source and bytecode match semantically)
  Y=1 → dissimilar (compiler injection / mismatch)
  m   → margin (minimum distance for dissimilar pairs, default 2.0)

GCN Encoder layers:
  GCNConv(64 → 256) → BatchNorm → ReLU → Dropout(0.2)
  GCNConv(256 → 256) → BatchNorm → ReLU → Dropout(0.2)
  GCNConv(256 → 128) → BatchNorm → ReLU
  Global mean pool → R^128
  L2 normalize (unit-sphere embedding)
"""

from __future__ import annotations

from dataclasses import dataclass
from typing import Optional

import torch
import torch.nn as nn
import torch.nn.functional as F
from torch import Tensor
from torch_geometric.data import Data, Batch
from torch_geometric.nn import GCNConv, global_mean_pool, BatchNorm


NODE_FEATURE_DIM = 64     # must match cfg_builder.NODE_FEATURE_DIM
LATENT_DIM       = 128    # embedding dimension


# ---------------------------------------------------------------------------
# GCN Encoder (shared weights for source and bytecode graphs)
# ---------------------------------------------------------------------------

class GCNEncoder(nn.Module):
    """
    3-layer GCN encoder with global mean pooling.

    Both the AST-derived CFG and the bytecode-derived CFG pass through
    the *same* instance of this module (weight sharing enforces the
    constraint that both representations must map to a common space).

    Parameters
    ----------
    in_channels   Input node feature dimension (64).
    hidden_dim    Width of the two middle layers (256).
    out_dim       Embedding dimension (128).
    dropout       Dropout rate applied after each activation.
    """

    def __init__(
        self,
        in_channels: int = NODE_FEATURE_DIM,
        hidden_dim:  int = 256,
        out_dim:     int = LATENT_DIM,
        dropout:     float = 0.2,
    ) -> None:
        super().__init__()
        self.conv1 = GCNConv(in_channels, hidden_dim, add_self_loops=True)
        self.bn1   = BatchNorm(hidden_dim)
        self.conv2 = GCNConv(hidden_dim, hidden_dim, add_self_loops=True)
        self.bn2   = BatchNorm(hidden_dim)
        self.conv3 = GCNConv(hidden_dim, out_dim, add_self_loops=True)
        self.bn3   = BatchNorm(out_dim)
        self.drop  = nn.Dropout(p=dropout)

    def forward(self, x: Tensor, edge_index: Tensor, batch: Tensor) -> Tensor:
        """
        Parameters
        ----------
        x           (N, in_channels) node feature matrix
        edge_index  (2, E) edge index tensor
        batch       (N,) batch vector assigning each node to a graph

        Returns
        -------
        (B, out_dim) graph-level embedding tensor, L2-normalized.
        """
        # Layer 1
        x = self.conv1(x, edge_index)
        x = self.bn1(x)
        x = F.relu(x)
        x = self.drop(x)

        # Layer 2
        x = self.conv2(x, edge_index)
        x = self.bn2(x)
        x = F.relu(x)
        x = self.drop(x)

        # Layer 3
        x = self.conv3(x, edge_index)
        x = self.bn3(x)
        x = F.relu(x)

        # Graph-level readout: mean over all nodes in each graph
        x = global_mean_pool(x, batch)   # (B, out_dim)

        # L2 normalize onto the unit sphere — stabilizes contrastive training
        x = F.normalize(x, p=2, dim=1)
        return x


# ---------------------------------------------------------------------------
# Siamese GCN
# ---------------------------------------------------------------------------

class SiameseGCN(nn.Module):
    """
    Siamese network wrapping a single shared GCNEncoder.

    The same encoder processes both the source CFG and the bytecode CFG.
    Weight sharing is enforced at the Python level (both arms reference the
    same nn.Module instance — not copies).

    The similarity score is defined as:
        similarity = 1 − (D_W / max_dist)
    clamped to [0, 1], where D_W is the Euclidean distance between embeddings
    and max_dist is a normalization constant (2.0 for unit-sphere embeddings).
    """

    def __init__(
        self,
        in_channels: int   = NODE_FEATURE_DIM,
        hidden_dim:  int   = 256,
        latent_dim:  int   = LATENT_DIM,
        dropout:     float = 0.2,
    ) -> None:
        super().__init__()
        # Single encoder instance — both arms use the SAME weights
        self.encoder = GCNEncoder(in_channels, hidden_dim, latent_dim, dropout)

    def encode(self, data: Data) -> Tensor:
        """Embed a single graph. data.batch is set automatically by DataLoader."""
        batch = data.batch if data.batch is not None else torch.zeros(
            data.num_nodes, dtype=torch.long, device=data.x.device
        )
        return self.encoder(data.x, data.edge_index, batch)

    def forward(
        self,
        data_src:  Data,
        data_byte: Data,
    ) -> tuple[Tensor, Tensor, Tensor]:
        """
        Forward pass for a batch of (source, bytecode) graph pairs.

        Returns
        -------
        z_src       (B, latent_dim) source embeddings
        z_byte      (B, latent_dim) bytecode embeddings
        distance    (B,) Euclidean distances D_W between paired embeddings
        """
        z_src  = self.encode(data_src)
        z_byte = self.encode(data_byte)
        distance = F.pairwise_distance(z_src, z_byte, p=2)
        return z_src, z_byte, distance

    def similarity_score(self, data_src: Data, data_byte: Data) -> Tensor:
        """
        Compute a normalized similarity score in [0, 1].

          score → 1.0  perfect semantic equivalence (source matches bytecode)
          score → 0.0  compiler injection / structural mismatch

        For unit-sphere L2 embeddings the maximum possible distance is 2.0,
        so we normalize: similarity = 1 − (D_W / 2).
        """
        with torch.no_grad():
            _, _, dist = self.forward(data_src, data_byte)
        return torch.clamp(1.0 - dist / 2.0, min=0.0, max=1.0)


# ---------------------------------------------------------------------------
# Contrastive Loss
# ---------------------------------------------------------------------------

class ContrastiveLoss(nn.Module):
    """
    Hadsell, Chopra & LeCun (2006) contrastive loss.

    L(W, Y, X₁, X₂) = (1−Y)·½·D_W² + Y·½·max(0, m − D_W)²

    Y = 0  →  similar pair  (source matches bytecode semantically)
              drives D_W → 0  (embeddings coincide)
    Y = 1  →  dissimilar pair  (injection or mismatch)
              drives D_W ≥ m  (embeddings separated by at least the margin)

    Parameters
    ----------
    margin : float
        m in the formula. Minimum distance for dissimilar pairs.
        For L2-normalized embeddings on the unit sphere: max_dist = 2,
        so m = 1.0 is a natural default (half the sphere diameter).
    """

    def __init__(self, margin: float = 1.0) -> None:
        super().__init__()
        self.margin = margin

    def forward(self, distance: Tensor, label: Tensor) -> Tensor:
        """
        Parameters
        ----------
        distance  (B,) — Euclidean distances D_W for each pair
        label     (B,) — 0 for similar, 1 for dissimilar (float32)

        Returns
        -------
        Scalar loss averaged over the batch.
        """
        # Similar pairs: ½·D_W²
        loss_similar    = 0.5 * distance.pow(2)
        # Dissimilar pairs: ½·max(0, m − D_W)²
        loss_dissimilar = 0.5 * F.relu(self.margin - distance).pow(2)
        loss = (1.0 - label) * loss_similar + label * loss_dissimilar
        return loss.mean()


# ---------------------------------------------------------------------------
# Verification result
# ---------------------------------------------------------------------------

@dataclass(frozen=True)
class IRVerificationResult:
    """
    Output of a single source ↔ bytecode equivalence check.

    similarity_score  Float in [0, 1]. > 0.85 = semantically equivalent.
    distance          Raw Euclidean distance in embedding space.
    is_equivalent     True if similarity_score ≥ threshold.
    threshold         The decision boundary used.
    """
    similarity_score: float
    distance:         float
    is_equivalent:    bool
    threshold:        float = 0.85

    def __repr__(self) -> str:
        verdict = "EQUIVALENT" if self.is_equivalent else "MISMATCH [INJECTION RISK]"
        return (
            f"IRVerificationResult({verdict} | "
            f"similarity={self.similarity_score:.4f} | "
            f"distance={self.distance:.4f})"
        )
