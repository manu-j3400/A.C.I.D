"""
particle_filter — Particle filter for threat belief tracking in RLShield.

Maintains a weighted particle set over ThreatParticle hypotheses, tracking
the joint distribution of threat type, severity, lateral spread, and
persistence across the SOC environment.
"""

from __future__ import annotations

import math
from dataclasses import dataclass, field
from typing import Callable, Dict, List, Optional, Tuple

import numpy as np

from .soc_env import ThreatType, ThreatLevel

_THREAT_TYPES = list(ThreatType)
_N_TYPES      = len(ThreatType)


@dataclass
class ThreatParticle:
    """One particle representing a joint threat-state hypothesis."""
    threat_type:    ThreatType
    severity:       float          # 0-1
    lateral_spread: float          # 0-1 probability of spreading to new hosts
    persistence:    float          # 0-1 probability of re-appearing after mitigation
    weight:         float = 1.0


class ThreatBeliefTracker:
    """
    Sequential importance resampling (SIR) particle filter tracking
    the threat landscape visible to the SOC.

    Parameters
    ----------
    n_particles        : number of particles (default 500)
    transition_noise   : Gaussian noise std for continuous attributes per step
    resample_threshold : N_eff / N below which resampling is triggered
    """

    def __init__(
        self,
        n_particles:        int   = 500,
        transition_noise:   float = 0.05,
        resample_threshold: float = 0.5,
        seed:               Optional[int] = None,
    ) -> None:
        self._n       = n_particles
        self._noise   = transition_noise
        self._thresh  = resample_threshold
        self._rng     = np.random.default_rng(seed)
        self._particles: List[ThreatParticle] = []
        self._initialized = False

    # ------------------------------------------------------------------
    # Initialisation
    # ------------------------------------------------------------------

    def initialize(self, initial_alert: Dict) -> None:
        """
        Seed the particle set from a first alert.

        Parameters
        ----------
        initial_alert : dict with optional keys: threat_type, severity, confidence
        """
        ttype_str  = initial_alert.get("threat_type", None)
        severity   = float(initial_alert.get("severity", 0.5))
        confidence = float(initial_alert.get("confidence", 0.5))

        self._particles = []
        for _ in range(self._n):
            if ttype_str and self._rng.random() < confidence:
                try:
                    ttype = ThreatType(ttype_str)
                except ValueError:
                    ttype = self._rng.choice(_THREAT_TYPES)
            else:
                ttype = self._rng.choice(_THREAT_TYPES)

            self._particles.append(ThreatParticle(
                threat_type    = ttype,
                severity       = float(np.clip(severity + self._rng.normal(0, 0.1), 0, 1)),
                lateral_spread = float(self._rng.beta(2, 5)),
                persistence    = float(self._rng.beta(2, 5)),
                weight         = 1.0 / self._n,
            ))
        self._initialized = True

    def _ensure_initialized(self) -> None:
        if not self._initialized:
            self.initialize({})

    # ------------------------------------------------------------------
    # Predict — threat evolution model
    # ------------------------------------------------------------------

    def predict(self) -> None:
        """
        Propagate particles through the threat evolution model:
        - Severity can escalate or de-escalate with noise.
        - Lateral spread and persistence drift slowly.
        - Threat type may transition (low probability).
        """
        self._ensure_initialized()
        for p in self._particles:
            # Severity drift: threats tend to escalate slowly
            p.severity = float(np.clip(
                p.severity + 0.01 + self._rng.normal(0, self._noise),
                0.0, 1.0
            ))
            p.lateral_spread = float(np.clip(
                p.lateral_spread + self._rng.normal(0, self._noise * 0.5),
                0.0, 1.0
            ))
            p.persistence = float(np.clip(
                p.persistence + self._rng.normal(0, self._noise * 0.5),
                0.0, 1.0
            ))
            # Rare type transition
            if self._rng.random() < 0.01:
                p.threat_type = self._rng.choice(_THREAT_TYPES)

    # ------------------------------------------------------------------
    # Update — observation likelihood reweighting
    # ------------------------------------------------------------------

    def update(self, observation: Dict) -> None:
        """
        Reweight particles by P(observation | particle).

        Observation keys (all optional):
          threat_type (str), threat_level (int 0-4), confidence (float),
          n_lateral_moves (int), n_endpoints_affected (int)
        """
        self._ensure_initialized()
        obs_type   = observation.get("threat_type", None)
        obs_level  = observation.get("threat_level", None)
        obs_conf   = float(observation.get("confidence", 0.5))
        obs_lat    = int(observation.get("n_lateral_moves", 0))

        for p in self._particles:
            likelihood = 1.0

            # Type likelihood
            if obs_type is not None:
                try:
                    ot = ThreatType(obs_type)
                    likelihood *= (0.9 if p.threat_type == ot else 0.1 / (_N_TYPES - 1))
                except ValueError:
                    pass

            # Severity likelihood vs threat level
            if obs_level is not None:
                expected_sev = float(obs_level) / 4.0
                likelihood *= self._gaussian_pdf(p.severity, expected_sev, 0.15)

            # Lateral spread likelihood
            if obs_lat > 0:
                expected_lat = p.lateral_spread
                obs_lat_norm = min(obs_lat / 10.0, 1.0)
                likelihood *= self._gaussian_pdf(obs_lat_norm, expected_lat, 0.2)

            p.weight *= max(likelihood, 1e-15)

        self._normalise()
        if self.effective_sample_size() / self._n < self._thresh:
            self._systematic_resample()

    # ------------------------------------------------------------------
    # Queries
    # ------------------------------------------------------------------

    def expected_severity(self) -> float:
        """Weighted mean severity across particles."""
        self._ensure_initialized()
        return float(sum(p.weight * p.severity for p in self._particles))

    def dominant_threat_type(self) -> ThreatType:
        """MAP estimate of threat type."""
        self._ensure_initialized()
        counts: Dict[ThreatType, float] = {t: 0.0 for t in ThreatType}
        for p in self._particles:
            counts[p.threat_type] += p.weight
        return max(counts, key=lambda t: counts[t])

    def uncertainty(self) -> float:
        """Normalised entropy of the threat-type distribution [0, 1]."""
        self._ensure_initialized()
        counts: Dict[ThreatType, float] = {t: 0.0 for t in ThreatType}
        for p in self._particles:
            counts[p.threat_type] += p.weight
        ent = 0.0
        for w in counts.values():
            if w > 1e-12:
                ent -= w * math.log2(w)
        max_ent = math.log2(_N_TYPES) if _N_TYPES > 1 else 1.0
        return ent / max_ent if max_ent > 0 else 0.0

    def effective_sample_size(self) -> float:
        """N_eff = 1 / sum(w^2)."""
        sq = sum(p.weight ** 2 for p in self._particles)
        return 1.0 / sq if sq > 1e-300 else float(self._n)

    def to_state_vector(self) -> np.ndarray:
        """
        Compact feature vector for MAPPO global state input.
        Shape: (N_TYPES + 4,) = type_dist + [severity, spread, persist, uncertainty]
        """
        self._ensure_initialized()
        type_dist = np.zeros(_N_TYPES, dtype=np.float32)
        sev_sum   = 0.0
        lat_sum   = 0.0
        per_sum   = 0.0

        for p in self._particles:
            type_dist[_THREAT_TYPES.index(p.threat_type)] += p.weight
            sev_sum += p.weight * p.severity
            lat_sum += p.weight * p.lateral_spread
            per_sum += p.weight * p.persistence

        return np.concatenate([
            type_dist.astype(np.float32),
            np.array([sev_sum, lat_sum, per_sum, self.uncertainty()], dtype=np.float32),
        ])

    # ------------------------------------------------------------------
    # Internal
    # ------------------------------------------------------------------

    def _normalise(self) -> None:
        total = sum(p.weight for p in self._particles)
        if total < 1e-300:
            for p in self._particles:
                p.weight = 1.0 / self._n
        else:
            for p in self._particles:
                p.weight /= total

    def _systematic_resample(self) -> None:
        weights = np.array([p.weight for p in self._particles], dtype=np.float64)
        cumsum  = np.cumsum(weights)
        cumsum[-1] = 1.0
        positions = (self._rng.random() + np.arange(self._n)) / self._n
        indices   = np.clip(np.searchsorted(cumsum, positions), 0, self._n - 1)
        self._particles = [
            ThreatParticle(
                threat_type    = self._particles[i].threat_type,
                severity       = self._particles[i].severity,
                lateral_spread = self._particles[i].lateral_spread,
                persistence    = self._particles[i].persistence,
                weight         = 1.0 / self._n,
            )
            for i in indices
        ]

    @staticmethod
    def _gaussian_pdf(x: float, mean: float, std: float) -> float:
        return math.exp(-0.5 * ((x - mean) / std) ** 2) / (std * math.sqrt(2 * math.pi))

    def summary(self) -> Dict:
        """Human-readable tracker summary."""
        self._ensure_initialized()
        return {
            "dominant_type":    self.dominant_threat_type().value,
            "expected_severity": round(self.expected_severity(), 4),
            "uncertainty":       round(self.uncertainty(), 4),
            "n_eff":             round(self.effective_sample_size(), 1),
        }
