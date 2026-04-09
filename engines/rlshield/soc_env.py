"""
soc_env — Multi-agent SOC environment for RLShield.

Models a Security Operations Centre with N concurrent analyst agents
responding to a stream of threats. Each agent observes a local view of
active threats and chooses one SOCAction per timestep.  Rewards are
shaped to incentivise fast, accurate triage and team coordination.
"""

from __future__ import annotations

import enum
import math
import random
import time
import uuid
from dataclasses import dataclass, field
from typing import Dict, List, Optional, Tuple

import numpy as np


# ---------------------------------------------------------------------------
# Enumerations
# ---------------------------------------------------------------------------

class ThreatLevel(enum.IntEnum):
    NONE     = 0
    LOW      = 1
    MEDIUM   = 2
    HIGH     = 3
    CRITICAL = 4


class ThreatType(enum.Enum):
    MALWARE           = "malware"
    RANSOMWARE        = "ransomware"
    APT               = "apt"
    INSIDER           = "insider"
    PHISHING          = "phishing"
    DDOS              = "ddos"
    DATA_EXFIL        = "data_exfil"
    LATERAL_MOVEMENT  = "lateral_movement"


class SOCAction(enum.IntEnum):
    MONITOR       = 0
    ISOLATE_HOST  = 1
    BLOCK_IP      = 2
    ESCALATE      = 3
    INVESTIGATE   = 4
    PATCH         = 5
    RESTORE       = 6
    ALERT_TEAM    = 7


# ---------------------------------------------------------------------------
# Data structures
# ---------------------------------------------------------------------------

@dataclass
class ThreatEvent:
    """A single threat incident requiring SOC attention."""
    event_id:     str
    timestamp:    float
    source_ip:    str
    dest_ip:      str
    threat_type:  ThreatType
    threat_level: ThreatLevel
    confidence:   float           # 0-1 detection confidence
    resolved:     bool            = False
    assigned_to:  Optional[int]   = None   # agent id
    ttl:          int             = 30     # time steps before auto-escalate
    raw_alert:    Dict            = field(default_factory=dict)


@dataclass
class SOCState:
    """Global SOC state visible to the centralised critic."""
    active_threats:       List[ThreatEvent]
    agent_assignments:    Dict[int, Optional[str]]   # agent_id → event_id or None
    resource_budget:      int
    time_step:            int
    mean_time_to_respond: float
    false_positive_rate:  float


# ---------------------------------------------------------------------------
# Environment
# ---------------------------------------------------------------------------

_THREAT_TYPE_LIST = list(ThreatType)
_THREAT_LEVEL_LIST = list(ThreatLevel)


class SOCEnvironment:
    """
    Discrete-time multi-agent SOC environment.

    Parameters
    ----------
    n_agents              : number of SOC analyst agents
    max_concurrent_threats: max queue depth before overflow penalty
    resource_budget       : initial resource units (depleted by actions)
    max_steps             : episode length
    threat_arrival_lambda : Poisson parameter for threat arrival rate
    """

    # Observation vector layout per agent:
    #   [threat_features(8), agent_state(4), shared_context(4)] = 16 dims
    OBS_DIM       = 16
    N_ACTIONS     = len(SOCAction)

    # Per-action resource costs
    _ACTION_COST: Dict[SOCAction, int] = {
        SOCAction.MONITOR:      0,
        SOCAction.ISOLATE_HOST: 3,
        SOCAction.BLOCK_IP:     2,
        SOCAction.ESCALATE:     1,
        SOCAction.INVESTIGATE:  2,
        SOCAction.PATCH:        4,
        SOCAction.RESTORE:      5,
        SOCAction.ALERT_TEAM:   1,
    }

    # Correct response mapping: threat_type → ideal action set
    _CORRECT_RESPONSES: Dict[ThreatType, List[SOCAction]] = {
        ThreatType.MALWARE:          [SOCAction.ISOLATE_HOST, SOCAction.PATCH],
        ThreatType.RANSOMWARE:       [SOCAction.ISOLATE_HOST, SOCAction.RESTORE],
        ThreatType.APT:              [SOCAction.ESCALATE, SOCAction.INVESTIGATE],
        ThreatType.INSIDER:          [SOCAction.ESCALATE, SOCAction.ALERT_TEAM],
        ThreatType.PHISHING:         [SOCAction.BLOCK_IP, SOCAction.ALERT_TEAM],
        ThreatType.DDOS:             [SOCAction.BLOCK_IP],
        ThreatType.DATA_EXFIL:       [SOCAction.ISOLATE_HOST, SOCAction.ESCALATE],
        ThreatType.LATERAL_MOVEMENT: [SOCAction.ISOLATE_HOST, SOCAction.INVESTIGATE],
    }

    def __init__(
        self,
        n_agents:               int   = 4,
        max_concurrent_threats: int   = 10,
        resource_budget:        int   = 100,
        max_steps:              int   = 200,
        threat_arrival_lambda:  float = 0.3,
        seed:                   Optional[int] = None,
    ) -> None:
        self.n_agents               = n_agents
        self.max_concurrent_threats = max_concurrent_threats
        self.initial_budget         = resource_budget
        self.max_steps              = max_steps
        self.threat_arrival_lambda  = threat_arrival_lambda
        self._rng                   = np.random.default_rng(seed)

        self._threats:     List[ThreatEvent]              = []
        self._assignments: Dict[int, Optional[str]]       = {}
        self._budget       = resource_budget
        self._step         = 0
        self._n_responded  = 0
        self._n_fp         = 0
        self._response_times: List[float]                 = []

    # ------------------------------------------------------------------
    # Gym-style interface
    # ------------------------------------------------------------------

    def reset(self, seed: Optional[int] = None) -> Tuple[List[np.ndarray], Dict]:
        """Reset to a fresh episode."""
        if seed is not None:
            self._rng = np.random.default_rng(seed)
        self._threats.clear()
        self._assignments  = {i: None for i in range(self.n_agents)}
        self._budget       = self.initial_budget
        self._step         = 0
        self._n_responded  = 0
        self._n_fp         = 0
        self._response_times.clear()
        return self._observations(), {}

    def step(
        self, actions: List[int]
    ) -> Tuple[List[np.ndarray], List[float], bool, Dict]:
        """
        Apply joint action, simulate arrivals/TTL, compute rewards.

        Returns
        -------
        obs      : per-agent observation list
        rewards  : per-agent reward list
        done     : True when episode terminates
        info     : diagnostic dict
        """
        assert len(actions) == self.n_agents

        # Decrement TTL on all active threats
        expired = []
        for t in self._threats:
            t.ttl -= 1
            if t.ttl <= 0 and not t.resolved:
                expired.append(t.event_id)

        rewards = [0.0] * self.n_agents

        # Apply each agent's action
        for agent_id, action in enumerate(actions):
            soc_action = SOCAction(action)
            assigned_tid = self._assignments.get(agent_id)
            threat = self._get_threat(assigned_tid) if assigned_tid else None

            if threat is None:
                # Pick the highest-priority unassigned threat
                threat = self._assign_next(agent_id)

            if threat is not None:
                r = self._compute_reward(agent_id, soc_action, threat)
                rewards[agent_id] = r
                self._apply_action(agent_id, soc_action, threat)
                cost = self._ACTION_COST[soc_action]
                self._budget = max(0, self._budget - cost)
            else:
                # Idle penalty
                rewards[agent_id] = -0.1

        # Penalty for expired threats
        for eid in expired:
            self._threats = [t for t in self._threats if t.event_id != eid]
            rewards = [r - 2.0 for r in rewards]  # shared penalty

        # Arrival of new threats (Poisson)
        n_new = int(self._rng.poisson(self.threat_arrival_lambda))
        for _ in range(n_new):
            t = self._generate_threat()
            if len(self._threats) < self.max_concurrent_threats:
                self._threats.append(t)

        self._step += 1
        done = (
            self._step >= self.max_steps
            or self._budget <= 0
            or len(self._threats) >= self.max_concurrent_threats
        )

        mttr = float(np.mean(self._response_times)) if self._response_times else 0.0
        fpr  = self._n_fp / max(self._n_responded, 1)

        info = {
            "step":            self._step,
            "n_threats":       len(self._threats),
            "budget":          self._budget,
            "mttr":            round(mttr, 2),
            "false_positive_rate": round(fpr, 4),
        }
        return self._observations(), rewards, done, info

    # ------------------------------------------------------------------
    # Observation
    # ------------------------------------------------------------------

    def _observations(self) -> List[np.ndarray]:
        return [self._observe(i) for i in range(self.n_agents)]

    def _observe(self, agent_id: int) -> np.ndarray:
        """
        16-dim observation vector for agent_id.

        [0:4]  assigned threat features (level, type_norm, confidence, ttl_norm)
        [4:8]  team state (n_threats_norm, budget_norm, n_agents_busy_norm, step_norm)
        [8:12] top-priority unassigned threat features
        [12:16] coordination context (n_resolved_norm, fp_rate, mttr_norm, threat_queue_fill)
        """
        obs = np.zeros(self.OBS_DIM, dtype=np.float32)

        # Own assigned threat
        tid = self._assignments.get(agent_id)
        t = self._get_threat(tid)
        if t is not None:
            obs[0] = t.threat_level.value / 4.0
            obs[1] = _THREAT_TYPE_LIST.index(t.threat_type) / len(_THREAT_TYPE_LIST)
            obs[2] = t.confidence
            obs[3] = max(0.0, t.ttl / 30.0)

        # Team / global state
        obs[4] = min(len(self._threats) / self.max_concurrent_threats, 1.0)
        obs[5] = self._budget / self.initial_budget
        obs[6] = sum(1 for v in self._assignments.values() if v is not None) / self.n_agents
        obs[7] = self._step / self.max_steps

        # Top-priority unassigned threat
        unassigned = [t for t in self._threats
                      if t.event_id not in self._assignments.values() and not t.resolved]
        if unassigned:
            top = max(unassigned, key=lambda x: x.threat_level.value)
            obs[8]  = top.threat_level.value / 4.0
            obs[9]  = _THREAT_TYPE_LIST.index(top.threat_type) / len(_THREAT_TYPE_LIST)
            obs[10] = top.confidence
            obs[11] = max(0.0, top.ttl / 30.0)

        # Coordination context
        obs[12] = min(self._n_responded / 100.0, 1.0)
        obs[13] = self._n_fp / max(self._n_responded, 1)
        obs[14] = min((np.mean(self._response_times) if self._response_times else 0) / 30.0, 1.0)
        obs[15] = len(self._threats) / self.max_concurrent_threats

        return obs

    # ------------------------------------------------------------------
    # Reward shaping
    # ------------------------------------------------------------------

    def _compute_reward(
        self, agent_id: int, action: SOCAction, threat: ThreatEvent
    ) -> float:
        correct = self._CORRECT_RESPONSES.get(threat.threat_type, [])
        is_correct = action in correct

        base = 0.0
        if is_correct:
            # Reward scales with severity
            base += 2.0 + threat.threat_level.value
            if threat.threat_level == ThreatLevel.CRITICAL:
                base += 3.0
        else:
            base -= 1.0

        # False positive penalty: ISOLATE on low-confidence benign-ish threat
        if action == SOCAction.ISOLATE_HOST and threat.confidence < 0.3:
            base -= 3.0
            self._n_fp += 1

        # Team coordination bonus: multiple agents agreed on same threat type
        team_actions = sum(
            1 for i in range(self.n_agents)
            if i != agent_id
            and self._assignments.get(i) is not None
            and self._get_threat(self._assignments[i]) is not None
            and self._get_threat(self._assignments[i]).threat_type == threat.threat_type
        )
        base += 0.5 * team_actions

        # Missed critical penalty
        if threat.threat_level == ThreatLevel.CRITICAL and not is_correct:
            base -= 5.0

        return float(base)

    # ------------------------------------------------------------------
    # Action application
    # ------------------------------------------------------------------

    def _apply_action(
        self, agent_id: int, action: SOCAction, threat: ThreatEvent
    ) -> None:
        if action in (SOCAction.ISOLATE_HOST, SOCAction.BLOCK_IP, SOCAction.PATCH,
                      SOCAction.RESTORE):
            threat.resolved = True
            self._n_responded += 1
            self._response_times.append(self._step - 0)  # simplified
            self._threats = [t for t in self._threats if t.event_id != threat.event_id]
            self._assignments[agent_id] = None
        elif action == SOCAction.ESCALATE:
            threat.threat_level = ThreatLevel(
                min(threat.threat_level.value + 1, ThreatLevel.CRITICAL.value)
            )
        elif action == SOCAction.INVESTIGATE:
            threat.confidence = min(1.0, threat.confidence + 0.2)
        elif action == SOCAction.ALERT_TEAM:
            # Broadcasts — no direct state change, reward handled above
            pass

    # ------------------------------------------------------------------
    # Helpers
    # ------------------------------------------------------------------

    def _assign_next(self, agent_id: int) -> Optional[ThreatEvent]:
        """Assign the highest-priority unassigned threat to agent_id."""
        assigned_ids = set(v for v in self._assignments.values() if v is not None)
        unassigned = [t for t in self._threats
                      if t.event_id not in assigned_ids and not t.resolved]
        if not unassigned:
            return None
        best = max(unassigned, key=lambda t: (t.threat_level.value, t.confidence))
        self._assignments[agent_id] = best.event_id
        return best

    def _get_threat(self, event_id: Optional[str]) -> Optional[ThreatEvent]:
        if event_id is None:
            return None
        for t in self._threats:
            if t.event_id == event_id:
                return t
        return None

    def _generate_threat(self) -> ThreatEvent:
        """Sample a new threat event from the arrival distribution."""
        ttype = self._rng.choice(_THREAT_TYPE_LIST)
        level = ThreatLevel(
            int(self._rng.choice([1, 2, 3, 4], p=[0.3, 0.35, 0.25, 0.10]))
        )
        return ThreatEvent(
            event_id     = uuid.uuid4().hex[:8],
            timestamp    = time.time(),
            source_ip    = f"10.{self._rng.integers(0,255)}.{self._rng.integers(0,255)}.{self._rng.integers(1,254)}",
            dest_ip      = f"192.168.{self._rng.integers(0,10)}.{self._rng.integers(1,254)}",
            threat_type  = ttype,
            threat_level = level,
            confidence   = float(self._rng.beta(2, 2)),
            ttl          = int(self._rng.integers(15, 45)),
        )

    def render(self) -> Dict:
        """Human-readable state summary."""
        return {
            "step":           self._step,
            "n_threats":      len(self._threats),
            "budget":         self._budget,
            "assignments":    {
                str(k): v for k, v in self._assignments.items()
            },
            "threats": [
                {
                    "id":         t.event_id,
                    "type":       t.threat_type.value,
                    "level":      t.threat_level.name,
                    "confidence": round(t.confidence, 3),
                    "ttl":        t.ttl,
                }
                for t in self._threats
            ],
        }
