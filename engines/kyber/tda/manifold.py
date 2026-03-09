"""
Engine 1: Topological Data Analysis — Zero-Day Manifold
========================================================

Pipeline
--------
  High-dim AST feature vectors (R^D, D ≈ 500–2000)
       │
       ▼  UMAP  (prevents O(n³) Vietoris-Rips memory explosion)
  Low-dim projection (R^50)
       │
       ▼  Vietoris-Rips filtration via ripser (C++ backend)
  Filtered simplicial complex at each spatial resolution ε
       │
       ▼  Persistent homology
  Persistence diagram: birth/death pairs per H_k
       │
       ├─ β₀  Connected components (H₀)
       ├─ β₁  Loops / 1-cycles  (H₁) ← most sensitive to code structure anomalies
       └─ β₂  Voids / 2-cavities (H₂) ← zero-days hide here

Theoretical basis
-----------------
  - Vietoris-Rips complex: Rips_ε(X) = {σ ⊆ X : diam(σ) ≤ ε}
  - Persistent homology tracks topological features born/dying across ε ∈ [0, ∞)
  - Betti numbers β_k = dim(H_k): rank of the k-th homology group
  - Long bars in the barcode = topologically persistent features (not noise)
  - New code falling far from any training persistence diagram → potential zero-day
"""

from __future__ import annotations

import numpy as np
from dataclasses import dataclass, field
from typing import Optional, Tuple, List

import umap
from ripser import ripser


# ---------------------------------------------------------------------------
# Data types
# ---------------------------------------------------------------------------

@dataclass(frozen=True)
class BettiNumbers:
    """
    Betti numbers extracted from a persistence diagram.

    β₀: number of connected components (H₀)
    β₁: number of independent loops / 1-cycles (H₁)
    β₂: number of enclosed voids / 2-cavities (H₂)

    Only bars with persistence (death − birth) above `min_persistence` are
    counted. The infinite bar in H₀ (the global component) is included.
    """
    beta_0: int
    beta_1: int
    beta_2: int

    def as_vector(self) -> np.ndarray:
        return np.array([self.beta_0, self.beta_1, self.beta_2], dtype=np.int32)

    def __repr__(self) -> str:
        return f"BettiNumbers(β₀={self.beta_0}, β₁={self.beta_1}, β₂={self.beta_2})"


@dataclass
class PersistenceDiagram:
    """
    Stores birth/death pairs for each homology dimension.

    dgms[k] is an (n_k × 2) float32 array of [birth, death] pairs for H_k.
    Infinite death values are represented as np.inf (the single surviving H₀ bar).
    """
    dgms: List[np.ndarray]   # length ≥ 3: [H₀_pairs, H₁_pairs, H₂_pairs]

    @property
    def h0(self) -> np.ndarray:
        return self.dgms[0] if len(self.dgms) > 0 else np.empty((0, 2))

    @property
    def h1(self) -> np.ndarray:
        return self.dgms[1] if len(self.dgms) > 1 else np.empty((0, 2))

    @property
    def h2(self) -> np.ndarray:
        return self.dgms[2] if len(self.dgms) > 2 else np.empty((0, 2))

    def betti_numbers(self, min_persistence: float = 0.0) -> BettiNumbers:
        """
        Count persistent homology classes above min_persistence threshold.

        Only bars with (death − birth) > min_persistence are counted.
        The infinite bar in H₀ has death = np.inf and is always included.

        Args:
            min_persistence: Minimum bar length to count. Use 0 to count all,
                             use a positive value to filter noise.
        """
        def _count(dgm: np.ndarray) -> int:
            if len(dgm) == 0:
                return 0
            # Infinite bars always count; finite bars must exceed threshold.
            finite_mask = np.isfinite(dgm[:, 1])
            inf_count   = int(np.sum(~finite_mask))
            fin_count   = int(np.sum(
                (dgm[finite_mask, 1] - dgm[finite_mask, 0]) > min_persistence
            ))
            return inf_count + fin_count

        return BettiNumbers(
            beta_0=_count(self.h0),
            beta_1=_count(self.h1),
            beta_2=_count(self.h2),
        )

    def persistence_entropy(self, dim: int = 1) -> float:
        """
        Compute the persistent entropy of H_dim.

        H = -∑ (lᵢ / L) log(lᵢ / L)   where lᵢ = death_i − birth_i, L = ∑lᵢ

        A high entropy means many equally-persistent features (complex topology).
        A low entropy means one dominating feature (simple topology).
        Zero-day code often shows anomalously high H₁ entropy.
        """
        dgm = self.dgms[dim] if dim < len(self.dgms) else np.empty((0, 2))
        if len(dgm) == 0:
            return 0.0
        finite = dgm[np.isfinite(dgm[:, 1])]
        if len(finite) == 0:
            return 0.0
        lengths = finite[:, 1] - finite[:, 0]
        lengths = lengths[lengths > 0]
        if len(lengths) == 0:
            return 0.0
        total = lengths.sum()
        probs = lengths / total
        return float(-np.sum(probs * np.log(probs + 1e-12)))


# ---------------------------------------------------------------------------
# Core pipeline
# ---------------------------------------------------------------------------

class ZeroDayManifold:
    """
    Full TDA pipeline: UMAP projection → Vietoris-Rips filtration → Persistent homology.

    Memory analysis
    ---------------
    Direct Vietoris-Rips on D-dimensional data costs O(n² · D) to build the
    distance matrix and O(n³) worst-case for the boundary matrix reduction.
    UMAP to R^50 first reduces this to O(n² · 50) = O(n²), making the
    approach tractable for n ≤ 10,000 samples.

    Usage
    -----
        manifold = ZeroDayManifold()
        projected, train_diagram = manifold.fit_transform_persist(X_train)

        # For each new PR:
        proj_new, pr_diagram = manifold.infer(X_pr)
    """

    def __init__(
        self,
        umap_n_components: int  = 50,
        umap_n_neighbors:  int  = 15,
        umap_min_dist:     float = 0.1,
        max_homology_dim:  int  = 2,       # compute H₀, H₁, H₂
        max_vr_diameter:   Optional[float] = None,   # filtration cutoff (None = auto)
        n_jobs:            int  = -1,      # UMAP parallelism (-1 = all cores)
    ) -> None:
        self._umap = umap.UMAP(
            n_components = umap_n_components,
            n_neighbors  = umap_n_neighbors,
            min_dist     = umap_min_dist,
            metric       = "euclidean",
            random_state = 42,
            low_memory   = True,
            n_jobs       = n_jobs,
        )
        self._max_dim    = max_homology_dim
        self._max_diam   = max_vr_diameter
        self._fitted     = False

    # ------------------------------------------------------------------
    # Fit
    # ------------------------------------------------------------------

    def fit(self, X: np.ndarray) -> "ZeroDayManifold":
        """
        Fit UMAP on the training corpus without computing persistent homology.
        Use when you want to call transform() + compute_persistence() separately.
        """
        if X.ndim != 2:
            raise ValueError(f"X must be 2-D (n_samples × n_features). Got shape {X.shape}.")
        self._umap.fit(X)
        self._fitted = True
        return self

    def transform(self, X: np.ndarray) -> np.ndarray:
        """Project new samples into the trained UMAP embedding space."""
        if not self._fitted:
            raise RuntimeError("Call fit() or fit_transform_persist() before transform().")
        return self._umap.transform(X)

    # ------------------------------------------------------------------
    # Persistent homology computation
    # ------------------------------------------------------------------

    def compute_persistence(self, X_projected: np.ndarray) -> PersistenceDiagram:
        """
        Run the Vietoris-Rips filtration and compute persistent homology on
        an already-projected point cloud.

        Parameters
        ----------
        X_projected : (n_samples, n_components) float32 array
            Point cloud in the UMAP embedding space.

        Returns
        -------
        PersistenceDiagram with H₀, H₁, H₂ birth/death pairs.

        Complexity
        ----------
        Time:   O(n² α(n)) for filtration construction (α = inverse Ackermann)
        Memory: O(n²) for the distance matrix in R^50
        """
        result = ripser(
            X_projected,
            maxdim  = self._max_dim,
            thresh  = self._max_diam,
            coeff   = 2,          # Z/2Z coefficients (standard)
            do_cocycles = False,  # skip cocycle computation for speed
        )
        dgms = list(result["dgms"])

        # Pad to 3 dimensions if maxdim < 2 (ripser omits empty higher dims)
        while len(dgms) < 3:
            dgms.append(np.empty((0, 2), dtype=np.float32))

        return PersistenceDiagram(dgms=dgms)

    # ------------------------------------------------------------------
    # Combined pipelines
    # ------------------------------------------------------------------

    def fit_transform_persist(
        self, X: np.ndarray
    ) -> Tuple[np.ndarray, PersistenceDiagram]:
        """
        Full training pipeline in one call.

        1. Fit UMAP on X and project.
        2. Compute persistent homology on the projected point cloud.

        Returns (projected_X, persistence_diagram).
        """
        if X.ndim != 2:
            raise ValueError(f"X must be 2-D. Got {X.shape}.")
        projected = self._umap.fit_transform(X)
        self._fitted = True
        diagram = self.compute_persistence(projected)
        return projected, diagram

    def infer(
        self, X_new: np.ndarray
    ) -> Tuple[np.ndarray, PersistenceDiagram]:
        """
        Project new sample(s) and compute their persistence diagram.

        Called once per PR / code submission at analysis time.
        """
        projected = self.transform(X_new)
        diagram   = self.compute_persistence(projected)
        return projected, diagram
