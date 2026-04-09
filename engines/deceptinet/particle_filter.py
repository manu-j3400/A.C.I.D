"""
BeliefStateParticleFilter — SIR particle filter over AttackerType.

Maintains a belief distribution over the 4 attacker archetypes using
Sequential Importance Resampling (SIR). The likelihood model is delegated
to HypergameModel.observation_likelihood so the filter stays decoupled
from the observation semantics.

References:
  Arulampalam et al., "A Tutorial on Particle Filters for Online
  Nonlinear/Non-Gaussian Bayesian Tracking," IEEE Trans. Signal
  Processing 50(2), 2002.
"""

from __future__ import annotations

from typing import TYPE_CHECKING, Dict

import numpy as np

from .hypergame import AttackerType

if TYPE_CHECKING:
    from .hypergame import HypergameModel

# Ordered list of attacker types — index matches particle encoding
_TYPES: list[AttackerType] = list(AttackerType)
_N_TYPES: int = len(_TYPES)


class BeliefStateParticleFilter:
    """
    SIR particle filter that tracks a belief distribution over AttackerType.

    Each particle stores a single AttackerType hypothesis. Importance weights
    are updated via the observation likelihood from HypergameModel, then
    normalised. Systematic resampling is applied whenever the effective
    sample size drops below n_particles / 2.
    """

    def __init__(self, n_particles: int = 500) -> None:
        self._n = n_particles
        self._rng = np.random.default_rng()

        # Particles: integer indices into _TYPES
        self._particles: np.ndarray = self._rng.integers(
            0, _N_TYPES, size=n_particles
        )
        # Uniform initial weights
        self._weights: np.ndarray = np.full(n_particles, 1.0 / n_particles, dtype=np.float64)

    # ------------------------------------------------------------------
    # Public API
    # ------------------------------------------------------------------

    def update(self, observation: Dict, model: "HypergameModel") -> np.ndarray:
        """
        Weight particles by P(observation | attacker_type), normalise, and
        resample if needed.

        Args:
            observation: dict with keys scan_rate, lateral_move_count, exfil_kb
            model:       HypergameModel that provides observation_likelihood()

        Returns:
            belief: np.ndarray of shape (4,) — probability mass per AttackerType
        """
        # --- Importance weighting ---
        for i in range(self._n):
            atype = _TYPES[self._particles[i]]
            self._weights[i] *= model.observation_likelihood(observation, atype)

        # Normalise; guard against all-zero degenerate case
        total = self._weights.sum()
        if total < 1e-300:
            # Complete degeneracy: reset to uniform
            self._weights[:] = 1.0 / self._n
        else:
            self._weights /= total

        # --- Resample if effective sample size is low ---
        ess = 1.0 / (self._weights ** 2).sum()
        if ess < self._n / 2.0:
            self._resample()

        return self.belief()

    def belief(self) -> np.ndarray:
        """
        Aggregate particle weights into a (4,) belief vector.

        Each element is the total weight assigned to that AttackerType index.
        Returns a normalised probability distribution.
        """
        b = np.zeros(_N_TYPES, dtype=np.float64)
        for i in range(self._n):
            b[self._particles[i]] += self._weights[i]
        # Renormalise (should already sum to 1 after update, but guard fp drift)
        total = b.sum()
        if total > 0:
            b /= total
        else:
            b[:] = 1.0 / _N_TYPES
        return b.astype(np.float32)

    # ------------------------------------------------------------------
    # Internal helpers
    # ------------------------------------------------------------------

    def _resample(self) -> None:
        """
        Systematic resampling.

        Draws n new particle indices proportional to weight using a single
        uniform draw — O(n) and lower variance than multinomial resampling.
        """
        cumsum = np.cumsum(self._weights)
        # Single uniform offset for systematic resampling
        u0 = self._rng.uniform(0.0, 1.0 / self._n)
        positions = u0 + np.arange(self._n) / self._n

        new_particles = np.empty(self._n, dtype=self._particles.dtype)
        j = 0
        for i in range(self._n):
            while j < self._n - 1 and cumsum[j] < positions[i]:
                j += 1
            new_particles[i] = self._particles[j]

        self._particles = new_particles
        self._weights[:] = 1.0 / self._n
