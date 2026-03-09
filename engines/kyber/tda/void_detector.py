"""
TDA Void Detector — PR Zero-Day Flagging
=========================================

A "topological void" is a region of the code-structure manifold that has no
training data coverage. Code whose topology falls in such a void is structurally
unlike anything the system has seen — a strong signal for zero-day behavior.

Detection uses two orthogonal signals:

  1. Geometric void  — k-NN distance to training corpus in UMAP space.
     If the nearest training sample is far away, the new code occupies an
     unpopulated region of the embedding.

  2. Topological void — Wasserstein distance between the new code's persistence
     diagram and the training corpus diagram. High distance means novel loop (H₁)
     or cavity (H₂) structure — topological features the model has never seen.

Both signals are required to fire for a confirmed void alert, reducing false
positives from isolated outlier samples.
"""

from __future__ import annotations

import numpy as np
from dataclasses import dataclass
from typing import Optional, Tuple

import persim
from sklearn.neighbors import BallTree

from .manifold import PersistenceDiagram, BettiNumbers


# ---------------------------------------------------------------------------
# Output types
# ---------------------------------------------------------------------------

@dataclass(frozen=True)
class VoidAlert:
    """
    Result of topological void detection for a single code submission.

    is_novel          True if the submission occupies a topological void.
    novelty_score     Composite score in [0, ∞). Values > 1.0 indicate a void.
    wasserstein_h1    Wasserstein-1 distance on H₁ diagrams (loop structure).
    wasserstein_h2    Wasserstein-1 distance on H₂ diagrams (cavity structure).
    knn_distance      Mean distance to the k nearest training samples.
    knn_threshold     The threshold beyond which k-NN distance is anomalous.
    betti_delta       (Δβ₀, Δβ₁, Δβ₂) versus the training corpus baseline.
    entropy_h1        Persistent entropy of H₁ for the new sample.
    """
    is_novel:         bool
    novelty_score:    float
    wasserstein_h1:   float
    wasserstein_h2:   float
    knn_distance:     float
    knn_threshold:    float
    betti_delta:      Tuple[int, int, int]
    entropy_h1:       float

    def __repr__(self) -> str:
        flag = "VOID [FLAGGED]" if self.is_novel else "known"
        return (
            f"VoidAlert({flag} | score={self.novelty_score:.3f} | "
            f"W₁(H₁)={self.wasserstein_h1:.3f} | "
            f"W₁(H₂)={self.wasserstein_h2:.3f} | "
            f"knn={self.knn_distance:.3f}/{self.knn_threshold:.3f} | "
            f"Δβ={self.betti_delta})"
        )


# ---------------------------------------------------------------------------
# Void Detector
# ---------------------------------------------------------------------------

class VoidDetector:
    """
    Detects topological voids in code structure manifolds.

    Train once on a corpus of labeled code samples; query once per PR.

    Parameters
    ----------
    knn_k : int
        Number of nearest neighbors for geometric void detection.
    knn_void_percentile : float
        k-NN distance percentile above which a point is in a geometric void.
        Default 99.0 → top 1% of training k-NN distances triggers void.
    wasserstein_threshold : float
        Wasserstein-1 distance threshold for topological novelty.
        Tune empirically: start at 2.0, lower for stricter detection.
    min_persistence : float
        Minimum bar length for Betti number computation (noise filter).
    require_both_signals : bool
        If True (default), both geometric AND topological void must fire.
        If False, either signal alone triggers the alert.
    """

    def __init__(
        self,
        knn_k:                  int   = 5,
        knn_void_percentile:    float = 99.0,
        wasserstein_threshold:  float = 2.0,
        min_persistence:        float = 0.05,
        require_both_signals:   bool  = True,
    ) -> None:
        self.knn_k                 = knn_k
        self.knn_void_percentile   = knn_void_percentile
        self.wasserstein_threshold = wasserstein_threshold
        self.min_persistence       = min_persistence
        self.require_both_signals  = require_both_signals

        self._ball_tree:     Optional[BallTree]           = None
        self._knn_threshold: float                        = float("inf")
        self._baseline_diag: Optional[PersistenceDiagram] = None
        self._baseline_betti: Optional[BettiNumbers]     = None
        self._fitted:        bool                        = False

    # ------------------------------------------------------------------
    # Training
    # ------------------------------------------------------------------

    def fit(
        self,
        projected_corpus: np.ndarray,
        corpus_diagram:   PersistenceDiagram,
    ) -> "VoidDetector":
        """
        Fit the void detector on the training corpus.

        Parameters
        ----------
        projected_corpus : (n_train, n_components) float32
            Training samples in UMAP embedding space.
        corpus_diagram : PersistenceDiagram
            Persistence diagram of the full training corpus point cloud.
        """
        if projected_corpus.ndim != 2:
            raise ValueError("projected_corpus must be 2-D.")

        # BallTree for O(n log n) k-NN queries (much faster than BruteForce for n > 1000)
        self._ball_tree = BallTree(projected_corpus, metric="euclidean")

        # Compute k-NN distances within the training set to calibrate the threshold.
        dists, _ = self._ball_tree.query(projected_corpus, k=self.knn_k + 1)
        # Column 0 is the point itself (distance 0); use columns 1..k
        mean_knn = dists[:, 1:].mean(axis=1)
        self._knn_threshold = float(np.percentile(mean_knn, self.knn_void_percentile))

        self._baseline_diag  = corpus_diagram
        self._baseline_betti = corpus_diagram.betti_numbers(self.min_persistence)
        self._fitted = True
        return self

    # ------------------------------------------------------------------
    # Inference
    # ------------------------------------------------------------------

    def detect(
        self,
        projected_new: np.ndarray,
        new_diagram:   PersistenceDiagram,
    ) -> VoidAlert:
        """
        Determine whether a new code submission occupies a topological void.

        Parameters
        ----------
        projected_new : (1, n_components) or (n_components,) float32
            The new sample's UMAP coordinates.
        new_diagram : PersistenceDiagram
            Persistence diagram computed from the new sample's code.

        Returns
        -------
        VoidAlert with is_novel=True if the code is in an unexplored void.
        """
        if not self._fitted:
            raise RuntimeError("Call fit() before detect().")

        query = projected_new.reshape(1, -1)

        # --- Signal 1: Geometric void (k-NN distance) --------------------
        dists, _ = self._ball_tree.query(query, k=self.knn_k)   # type: ignore[union-attr]
        knn_dist = float(dists[0].mean())
        geometric_void = knn_dist > self._knn_threshold

        # --- Signal 2: Topological void (Wasserstein distance) -----------
        baseline = self._baseline_diag   # type: ignore[union-attr]

        w1_h1 = _safe_wasserstein(baseline.h1, new_diagram.h1)
        w1_h2 = _safe_wasserstein(baseline.h2, new_diagram.h2)
        w1_total = w1_h1 + w1_h2
        topological_void = w1_total > self.wasserstein_threshold

        # --- Composite novelty score -------------------------------------
        # Normalized: 1.0 = exactly at the threshold, > 1.0 = beyond threshold.
        geo_norm   = knn_dist   / max(self._knn_threshold,        1e-9)
        topo_norm  = w1_total   / max(self.wasserstein_threshold, 1e-9)
        novelty_score = 0.45 * geo_norm + 0.35 * (w1_h1 / max(self.wasserstein_threshold, 1e-9)) \
                      + 0.20 * (w1_h2 / max(self.wasserstein_threshold, 1e-9))

        # --- Betti delta -------------------------------------------------
        new_betti  = new_diagram.betti_numbers(self.min_persistence)
        base_betti = self._baseline_betti   # type: ignore[union-attr]
        betti_delta = (
            new_betti.beta_0 - base_betti.beta_0,
            new_betti.beta_1 - base_betti.beta_1,
            new_betti.beta_2 - base_betti.beta_2,
        )

        # --- H₁ entropy --------------------------------------------------
        entropy_h1 = new_diagram.persistence_entropy(dim=1)

        # --- Final verdict -----------------------------------------------
        if self.require_both_signals:
            is_novel = geometric_void and topological_void
        else:
            is_novel = geometric_void or topological_void

        return VoidAlert(
            is_novel        = is_novel,
            novelty_score   = novelty_score,
            wasserstein_h1  = w1_h1,
            wasserstein_h2  = w1_h2,
            knn_distance    = knn_dist,
            knn_threshold   = self._knn_threshold,
            betti_delta     = betti_delta,
            entropy_h1      = entropy_h1,
        )

    # ------------------------------------------------------------------
    # Utilities
    # ------------------------------------------------------------------

    def calibrate_threshold(
        self,
        known_clean_projected:    np.ndarray,
        known_clean_diagrams:     list,
        target_false_positive_rate: float = 0.01,
    ) -> float:
        """
        Auto-calibrate the Wasserstein threshold to achieve a target false-positive
        rate on a held-out clean validation set.

        Returns the calibrated threshold and sets self.wasserstein_threshold.
        """
        if not self._fitted:
            raise RuntimeError("Call fit() before calibrate_threshold().")

        scores = []
        for proj, diag in zip(known_clean_projected, known_clean_diagrams):
            alert = self.detect(proj, diag)
            scores.append(alert.novelty_score)

        # Set threshold so that (1 - target_fpr) percentile of clean scores pass.
        percentile = (1.0 - target_false_positive_rate) * 100.0
        threshold = float(np.percentile(scores, percentile))
        self.wasserstein_threshold = threshold
        return threshold


# ---------------------------------------------------------------------------
# Internal helpers
# ---------------------------------------------------------------------------

def _safe_wasserstein(dgm_a: np.ndarray, dgm_b: np.ndarray) -> float:
    """
    Compute Wasserstein-1 distance between two persistence diagrams.

    Returns 0.0 if either diagram is empty (no novel topology to measure).
    """
    if len(dgm_a) == 0 and len(dgm_b) == 0:
        return 0.0
    # persim.wasserstein handles empty diagrams gracefully.
    try:
        return float(persim.wasserstein(dgm_a, dgm_b, matching=False))
    except Exception:
        # Fallback: use bottleneck distance (more robust to degenerate inputs)
        try:
            return float(persim.bottleneck(dgm_a, dgm_b))
        except Exception:
            return 0.0
