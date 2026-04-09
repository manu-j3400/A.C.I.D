"""
HypergameModel — Hypergame-theoretic formulation of the attacker-defender interaction.

A hypergame G = (G_D, G_A) where:
  G_D = defender's perceived game (full information)
  G_A = attacker's perceived game (incomplete — attacker does not know which
        nodes are real vs honeypot)

References:
  Bennett (1977), Wang et al. "Using Hypergame Theory to Achieve Deception in
  Cyber Defense" (2019).
"""

from __future__ import annotations

import enum
import math
from dataclasses import dataclass, field
from typing import Dict, List, Optional, Tuple

import numpy as np


class AttackerType(enum.Enum):
    """Attacker threat-model taxonomy."""
    NOISE       = "noise"        # random probing, no real intent
    OPPORTUNIST = "opportunist"  # automated exploit kit
    TARGETED    = "targeted"     # APT-level, mission-driven
    INSIDER     = "insider"      # privileged credentials, lateral movement


class DefenderAction(enum.Enum):
    """Discrete actions available to the defender agent."""
    DEPLOY_HONEYPOT   = "deploy_honeypot"    # add a new honeypot node
    REMOVE_HONEYPOT   = "remove_honeypot"    # retire an existing honeypot
    PATCH_REAL_NODE   = "patch_real_node"    # harden a real production node
    ALERT_SOC         = "alert_soc"          # escalate to human analysts
    TARPIT            = "tarpit"             # slow attacker connection (rate-limit)
    NO_OP             = "noop"               # do nothing this tick


@dataclass
class NetworkNode:
    """Represents a node in the defended network."""
    node_id:      str
    is_honeypot:  bool        = False
    is_patched:   bool        = False
    value:        float       = 1.0          # reward to attacker if compromised
    exposure:     float       = 0.5          # probability attacker discovers node
    interactions: int         = 0            # total connection attempts logged
    compromised:  bool        = False


@dataclass
class HypergameState:
    """Full game state from defender's perspective."""
    nodes:               Dict[str, NetworkNode]
    attacker_type_dist:  np.ndarray           # belief over AttackerType (4-dim)
    time_step:           int                  = 0
    total_alerts:        int                  = 0
    honeypot_engagements: int                 = 0
    real_compromises:    int                  = 0


class HypergameModel:
    """
    Encodes the hypergame structure and computes payoff matrices for both
    the defender and the attacker (under incomplete information).

    The attacker's perceived payoff matrix A_hat differs from the true
    payoff matrix A because honeypot nodes appear indistinguishable from
    real nodes in the attacker's observation space.
    """

    N_ATTACKER_TYPES = len(AttackerType)
    N_DEFENDER_ACTIONS = len(DefenderAction)

    # Base payoffs: rows = attacker type, cols = defender action
    # Positive = good for attacker, negative = bad (good for defender)
    _BASE_PAYOFF: np.ndarray = np.array([
        #  DEPLOY  REMOVE   PATCH  ALERT  TARPIT  NOOP
        [  -0.1,   0.3,    0.1,   0.0,   0.1,   0.2 ],  # NOISE
        [  -0.4,   0.6,    0.1,   -0.2,  0.0,   0.4 ],  # OPPORTUNIST
        [  -0.8,   0.9,   -0.1,   -0.6, -0.2,   0.6 ],  # TARGETED
        [  -0.5,   0.7,   -0.3,   -0.7, -0.1,   0.5 ],  # INSIDER
    ], dtype=np.float32)

    def __init__(self, n_nodes: int = 20, honeypot_ratio: float = 0.3) -> None:
        self.n_nodes = n_nodes
        self.honeypot_ratio = honeypot_ratio
        self._rng = np.random.default_rng()

    # ------------------------------------------------------------------
    # Payoff computation
    # ------------------------------------------------------------------

    def defender_expected_payoff(
        self,
        action: DefenderAction,
        belief: np.ndarray,
    ) -> float:
        """
        E[payoff for defender] = -E[attacker payoff] weighted by belief over
        attacker types.
        """
        col = list(DefenderAction).index(action)
        attacker_payoffs = self._BASE_PAYOFF[:, col]
        # Defender payoff is negated attacker payoff (zero-sum)
        return float(-np.dot(belief, attacker_payoffs))

    def best_defender_response(self, belief: np.ndarray) -> DefenderAction:
        """Return the defender action that maximises expected payoff."""
        payoffs = [
            self.defender_expected_payoff(a, belief)
            for a in DefenderAction
        ]
        return list(DefenderAction)[int(np.argmax(payoffs))]

    # ------------------------------------------------------------------
    # Attacker perception model (incomplete information)
    # ------------------------------------------------------------------

    def attacker_perceived_payoff(
        self,
        real_nodes: int,
        honeypot_nodes: int,
        attacker_type: AttackerType,
    ) -> float:
        """
        Attacker perceives all nodes as equally valuable because they cannot
        distinguish honeypots. Their expected payoff is diluted by the
        honeypot fraction.
        """
        total = real_nodes + honeypot_nodes
        if total == 0:
            return 0.0
        real_fraction = real_nodes / total
        type_idx = list(AttackerType).index(attacker_type)
        base = self._BASE_PAYOFF[type_idx, list(DefenderAction).index(DefenderAction.DEPLOY_HONEYPOT)]
        return float(base * real_fraction)

    # ------------------------------------------------------------------
    # Observation model
    # ------------------------------------------------------------------

    def observation_likelihood(
        self,
        observation: Dict,
        attacker_type: AttackerType,
    ) -> float:
        """
        P(observation | attacker_type).
        Observations include: scan_rate, lateral_move_count, data_exfil_bytes.
        """
        scan_rate  = observation.get("scan_rate", 0.0)   # probes/min
        lateral    = observation.get("lateral_move_count", 0)
        exfil_kb   = observation.get("exfil_kb", 0.0)

        if attacker_type == AttackerType.NOISE:
            p  = self._gaussian_pdf(scan_rate,  mean=5.0,  std=3.0)
            p *= self._gaussian_pdf(lateral,    mean=0.0,  std=0.5)
            p *= self._gaussian_pdf(exfil_kb,   mean=0.0,  std=1.0)
        elif attacker_type == AttackerType.OPPORTUNIST:
            p  = self._gaussian_pdf(scan_rate,  mean=20.0, std=8.0)
            p *= self._gaussian_pdf(lateral,    mean=1.0,  std=1.0)
            p *= self._gaussian_pdf(exfil_kb,   mean=50.0, std=30.0)
        elif attacker_type == AttackerType.TARGETED:
            p  = self._gaussian_pdf(scan_rate,  mean=2.0,  std=1.0)
            p *= self._gaussian_pdf(lateral,    mean=5.0,  std=2.0)
            p *= self._gaussian_pdf(exfil_kb,   mean=500.0, std=200.0)
        else:  # INSIDER
            p  = self._gaussian_pdf(scan_rate,  mean=0.5,  std=0.3)
            p *= self._gaussian_pdf(lateral,    mean=8.0,  std=3.0)
            p *= self._gaussian_pdf(exfil_kb,   mean=2000.0, std=500.0)

        return max(p, 1e-12)  # avoid zero

    @staticmethod
    def _gaussian_pdf(x: float, mean: float, std: float) -> float:
        return (1.0 / (std * math.sqrt(2 * math.pi))) * math.exp(
            -0.5 * ((x - mean) / std) ** 2
        )

    # ------------------------------------------------------------------
    # State observation vector (for RL agent)
    # ------------------------------------------------------------------

    def state_vector(self, state: HypergameState) -> np.ndarray:
        """
        Returns a fixed-length observation vector for the PPO agent.
        Shape: (4 + 5,) = (belief_dist, scalar_features)
        """
        scalars = np.array([
            state.time_step / 1000.0,
            state.total_alerts / 100.0,
            state.honeypot_engagements / 50.0,
            state.real_compromises / 10.0,
            sum(1 for n in state.nodes.values() if n.is_honeypot) / max(len(state.nodes), 1),
        ], dtype=np.float32)
        return np.concatenate([state.attacker_type_dist.astype(np.float32), scalars])

    def state_dim(self) -> int:
        return self.N_ATTACKER_TYPES + 5
