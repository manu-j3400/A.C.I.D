"""
HoneypotEnv — Gym-compatible RL environment for honeypot orchestration.

Wraps HypergameModel and BeliefStateParticleFilter into a standard
reset/step interface. The observation space is a 9-dimensional continuous
vector produced by HypergameModel.state_vector(). The action space is
discrete over the 6 DefenderAction values.

Episode termination:
  - Max 200 steps reached, OR
  - real_compromises >= 3 (network is effectively breached)

Reward shaping:
  +2.0  per honeypot engagement this tick
  -5.0  per real node compromise this tick
  -0.1  per alert raised (noise penalty)
  +0.5  per successful real-node patch
  -0.01 per step (encourages efficient decisions)
"""

from __future__ import annotations

from typing import Dict, List, Optional, Tuple

import numpy as np

from .hypergame import (
    AttackerType,
    DefenderAction,
    HypergameModel,
    HypergameState,
    NetworkNode,
)
from .particle_filter import BeliefStateParticleFilter

_ACTIONS: List[DefenderAction] = list(DefenderAction)
_MAX_STEPS: int = 200
_MAX_COMPROMISES: int = 3

# Reward constants
_R_ENGAGEMENT  =  2.0
_R_COMPROMISE  = -5.0
_R_ALERT       = -0.1
_R_PATCH       =  0.5
_R_STEP        = -0.01


class HoneypotEnv:
    """
    Gym-style environment (no gym dependency) for the DeceptiNet PPO agent.

    Observation space: Box(0, 1, shape=(9,))
      — 4-dim belief distribution + 5 scalar network features
    Action space:      Discrete(6)
      — index into DefenderAction enum
    """

    obs_dim:    int = 9   # == HypergameModel.state_dim()
    n_actions:  int = 6   # == len(DefenderAction)

    def __init__(
        self,
        n_nodes: int = 20,
        honeypot_ratio: float = 0.3,
        n_particles: int = 500,
        seed: Optional[int] = None,
    ) -> None:
        self._model  = HypergameModel(n_nodes=n_nodes, honeypot_ratio=honeypot_ratio)
        self._pf     = BeliefStateParticleFilter(n_particles=n_particles)
        self._rng    = np.random.default_rng(seed)
        self._state: Optional[HypergameState] = None

    # ------------------------------------------------------------------
    # Core interface
    # ------------------------------------------------------------------

    def reset(self) -> np.ndarray:
        """
        Initialise a new episode with a fresh network topology and a
        uniform belief distribution over attacker types.

        Returns:
            obs: initial observation vector of shape (9,)
        """
        nodes = self._build_nodes()
        self._state = HypergameState(
            nodes=nodes,
            attacker_type_dist=np.full(4, 0.25, dtype=np.float32),
        )
        # Reset particle filter to uniform
        self._pf = BeliefStateParticleFilter(self._pf._n)
        return self._model.state_vector(self._state)

    def step(self, action: int) -> Tuple[np.ndarray, float, bool, Dict]:
        """
        Apply a defender action, simulate attacker behaviour, update belief,
        and return the transition tuple.

        Args:
            action: integer index into DefenderAction

        Returns:
            obs:     new observation vector (9,)
            reward:  shaped reward for this step
            done:    True if episode has ended
            info:    dict with diagnostics
        """
        assert self._state is not None, "Call reset() before step()"

        defender_action = _ACTIONS[action]
        prev_engagements  = self._state.honeypot_engagements
        prev_compromises  = self._state.real_compromises
        prev_alerts       = self._state.total_alerts
        prev_patched      = sum(1 for n in self._state.nodes.values() if n.is_patched)

        # --- Apply defender action ---
        self._apply_action(defender_action)

        # --- Simulate attacker interaction ---
        observation = self._simulate_attacker_tick()

        # --- Update particle filter belief ---
        belief = self._pf.update(observation, self._model)
        self._state.attacker_type_dist = belief
        self._state.time_step += 1

        # --- Compute shaped reward ---
        new_engagements = self._state.honeypot_engagements - prev_engagements
        new_compromises = self._state.real_compromises    - prev_compromises
        new_alerts      = self._state.total_alerts        - prev_alerts
        new_patched     = sum(1 for n in self._state.nodes.values() if n.is_patched) - prev_patched

        reward = (
            _R_ENGAGEMENT * new_engagements
            + _R_COMPROMISE * new_compromises
            + _R_ALERT      * new_alerts
            + _R_PATCH      * new_patched
            + _R_STEP
        )

        done = (
            self._state.time_step >= _MAX_STEPS
            or self._state.real_compromises >= _MAX_COMPROMISES
        )

        obs = self._model.state_vector(self._state)
        info = {
            "honeypot_engagements": self._state.honeypot_engagements,
            "real_compromises":     self._state.real_compromises,
            "total_alerts":         self._state.total_alerts,
            "belief":               belief.tolist(),
            "observation":          observation,
        }
        return obs, reward, done, info

    # ------------------------------------------------------------------
    # Internal simulation helpers
    # ------------------------------------------------------------------

    def _build_nodes(self) -> Dict[str, NetworkNode]:
        """Create the initial network topology."""
        n = self._model.n_nodes
        n_honeypots = max(1, int(n * self._model.honeypot_ratio))
        nodes: Dict[str, NetworkNode] = {}
        for i in range(n):
            nodes[f"node_{i}"] = NetworkNode(
                node_id=f"node_{i}",
                is_honeypot=(i < n_honeypots),
                value=self._rng.uniform(0.5, 2.0),
                exposure=self._rng.uniform(0.1, 0.9),
            )
        return nodes

    def _apply_action(self, action: DefenderAction) -> None:
        """Mutate network state according to the defender's chosen action."""
        real_nodes    = [n for n in self._state.nodes.values() if not n.is_honeypot]
        honeypot_nodes = [n for n in self._state.nodes.values() if n.is_honeypot]

        if action == DefenderAction.DEPLOY_HONEYPOT and real_nodes:
            # Convert a random exposed real node into a honeypot
            target = self._rng.choice(real_nodes)
            self._state.nodes[target.node_id].is_honeypot = True

        elif action == DefenderAction.REMOVE_HONEYPOT and honeypot_nodes:
            # Retire a random honeypot (convert back to real)
            target = self._rng.choice(honeypot_nodes)
            self._state.nodes[target.node_id].is_honeypot = False

        elif action == DefenderAction.PATCH_REAL_NODE and real_nodes:
            unpatched = [n for n in real_nodes if not n.is_patched]
            if unpatched:
                target = self._rng.choice(unpatched)
                self._state.nodes[target.node_id].is_patched = True

        elif action == DefenderAction.ALERT_SOC:
            self._state.total_alerts += 1

        elif action == DefenderAction.TARPIT:
            # Tarpitting reduces exposure of all honeypots temporarily
            for node in honeypot_nodes:
                node.exposure = max(0.05, node.exposure * 0.8)

        # NO_OP: nothing

    def _simulate_attacker_tick(self) -> Dict:
        """
        Produce synthetic attacker observations and update compromise state.

        Returns an observation dict compatible with HypergameModel.observation_likelihood.
        """
        nodes = list(self._state.nodes.values())
        # Attacker probes nodes proportional to their exposure
        scan_rate       = float(self._rng.poisson(lam=10.0))
        lateral_moves   = 0
        exfil_kb        = 0.0

        for node in nodes:
            if self._rng.random() > node.exposure:
                continue
            node.interactions += 1

            if node.is_honeypot:
                self._state.honeypot_engagements += 1
            else:
                # Real node interaction: probabilistic compromise
                compromise_prob = 0.15 if node.is_patched else 0.40
                if not node.compromised and self._rng.random() < compromise_prob:
                    node.compromised = True
                    self._state.real_compromises += 1
                if node.compromised:
                    lateral_moves += 1
                    exfil_kb      += float(self._rng.exponential(scale=200.0))

        return {
            "scan_rate":           scan_rate,
            "lateral_move_count":  lateral_moves,
            "exfil_kb":            exfil_kb,
        }
