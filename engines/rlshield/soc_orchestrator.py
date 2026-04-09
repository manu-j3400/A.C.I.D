"""
engines/rlshield/soc_orchestrator.py

High-level SOC automation orchestrator that ties MAPPOAgent + WazuhConnector
together into a single interface for processing security alerts.

Typical usage
-------------
    from engines.rlshield import SOCOrchestrator, RLShieldConfig

    cfg = RLShieldConfig()
    orch = SOCOrchestrator(cfg)
    response = orch.process_alert(alert_dict)
    # {"triage": "escalate", "investigation": "run_scan", ...}
"""

from __future__ import annotations

import logging
import math
from typing import TYPE_CHECKING, Dict, List, Optional

import numpy as np
import torch

from .config import RLShieldConfig
from .mappo_agent import MAPPOAgent

if TYPE_CHECKING:
    from .wazuh_connector import WazuhConnector

logger = logging.getLogger(__name__)

# ---------------------------------------------------------------------------
# Event-type vocabulary (8 slots for one-hot encoding)
# ---------------------------------------------------------------------------
_EVENT_TYPES = [
    "process_create", "network_connect", "file_create",
    "registry_modify", "login", "privilege_escalation",
    "lateral_movement", "data_exfil",
]

# MITRE technique flags used in the feature vector (12 flags)
_MITRE_KEYWORDS: Dict[str, List[str]] = {
    "T1059": ["powershell", "cmd", "bash", "script", "interpreter"],
    "T1078": ["valid_account", "credential", "oauth", "sso"],
    "T1003": ["lsass", "mimikatz", "credential_dump", "ntds"],
    "T1021": ["rdp", "ssh", "smb", "remote_service", "winrm"],
    "T1055": ["injection", "hollowing", "dll", "process_inject"],
    "T1070": ["log_clear", "indicator_removal", "timestomp"],
    "T1036": ["masquerade", "rename", "spoof", "disguise"],
    "T1082": ["systeminfo", "uname", "sysinfo", "discovery"],
    "T1083": ["dir", "ls", "find", "file_discovery"],
    "T1105": ["wget", "curl", "bitsadmin", "certutil", "ingress"],
    "T1071": ["http", "dns", "c2_protocol", "app_layer"],
    "T1041": ["exfil", "upload", "ftp", "exfiltrate"],
}
_MITRE_TECHNIQUES = list(_MITRE_KEYWORDS.keys())  # ordered for consistent indexing

_SEVERITY_MAP = {"low": 0.1, "medium": 0.4, "high": 0.7, "critical": 1.0}


class SOCOrchestrator:
    """
    Wraps MAPPOAgent with alert encoding and response formatting.

    Parameters
    ----------
    config  : RLShieldConfig controlling network topology and thresholds.
    wazuh   : Optional WazuhConnector.  If provided, auto_execute responses
              can call execute_active_response on the live SIEM.
    """

    def __init__(
        self,
        config: Optional[RLShieldConfig] = None,
        wazuh: Optional["WazuhConnector"] = None,
    ) -> None:
        self.config = config or RLShieldConfig()
        self.wazuh  = wazuh
        self.agent  = MAPPOAgent(self.config)
        logger.info("SOCOrchestrator ready (auto_exec_threshold=%.2f)",
                    self.config.auto_execute_threshold)

    # ---------------------------------------------------------------------- #
    # Public API
    # ---------------------------------------------------------------------- #

    def process_alert(self, alert: dict) -> dict:
        """
        Run all four MAPPO analyst roles on an incoming alert.

        Parameters
        ----------
        alert : raw alert dict.  Recognised keys (all optional):
            event_type, severity, source_ip, dest_port, process_name,
            command_line, user_privileged, repeated_count, lateral_movement,
            data_exfil_indicator, timestamp_hour, rule_description

        Returns
        -------
        dict with keys:
            triage, investigation, containment, remediation  — action name strings
            confidence    — mean softmax confidence across roles (float 0-1)
            severity      — normalised severity label from the alert
            auto_execute  — bool, True only when confidence > threshold AND
                            severity is high/critical
        """
        observations = self.encode_alert(alert)
        raw_actions  = self.agent.select_actions(observations)

        # Resolve action indices to human-readable names
        response: dict = {}
        confidences: list = []
        role_key_map = {
            "TRIAGE":      "triage",
            "INVESTIGATE": "investigation",
            "CONTAIN":     "containment",
            "REMEDIATE":   "remediation",
        }
        for role, key in role_key_map.items():
            action_idx, log_prob = raw_actions[role]
            action_name = self.config.action_names[role][action_idx]
            response[key] = action_name
            # Convert log_prob -> rough confidence (sigmoid of log_prob)
            confidences.append(float(torch.sigmoid(torch.tensor(log_prob)).item()))

        confidence = float(np.mean(confidences))
        severity   = alert.get("severity", "medium").lower()

        response["confidence"]   = round(confidence, 4)
        response["severity"]     = severity
        response["auto_execute"] = (
            confidence >= self.config.auto_execute_threshold
            and severity in ("high", "critical")
        )

        if response["auto_execute"] and self.wazuh is not None:
            self._execute_via_wazuh(alert, response)

        return response

    def encode_alert(self, alert: dict) -> Dict[str, np.ndarray]:
        """
        Encode a raw alert dict into per-role observation vectors.

        Each vector is 24-dimensional:
          [0]     severity (0-1 normalised)
          [1-8]   event_type one-hot (8 classes)
          [9]     source_ip entropy proxy (0-1)
          [10]    dest_port risk score (0-1)
          [11]    repeated_alert_count (log-scaled, clipped to 0-1)
          [12]    time_of_day_sin
          [13]    time_of_day_cos
          [14]    process_suspicious (0/1)
          [15]    user_privileged (0/1)
          [16]    lateral_movement (0/1)
          [17]    data_exfil_indicator (0/1)
          [18-23] 6 sampled MITRE technique flags (rotating subset)

        All four roles receive the same base vector; this design can be
        extended to give roles different observation windows.
        """
        vec = np.zeros(self.config.obs_dim, dtype=np.float32)

        # [0] severity
        sev_str = alert.get("severity", "medium").lower()
        vec[0] = _SEVERITY_MAP.get(sev_str, 0.4)

        # [1-8] event_type one-hot
        evt = alert.get("event_type", "").lower()
        for i, et in enumerate(_EVENT_TYPES):
            if et in evt:
                vec[1 + i] = 1.0
                break

        # [9] source_ip entropy proxy: count unique octets (normalised)
        src_ip = alert.get("source_ip", "")
        octets  = src_ip.split(".") if src_ip else []
        vec[9] = min(len(set(octets)) / 4.0, 1.0) if octets else 0.0

        # [10] dest_port risk (well-known dangerous ports score higher)
        port = int(alert.get("dest_port", 0))
        _HIGH_RISK_PORTS = {22, 23, 445, 3389, 4444, 5900, 8080}
        vec[10] = 1.0 if port in _HIGH_RISK_PORTS else (
            0.5 if port < 1024 else 0.1
        )

        # [11] repeated_alert_count log-normalised
        repeat = int(alert.get("repeated_count", 0))
        vec[11] = min(math.log1p(repeat) / math.log1p(1000), 1.0)

        # [12-13] time_of_day sin/cos
        hour = float(alert.get("timestamp_hour", 12))
        angle = 2 * math.pi * hour / 24.0
        vec[12] = math.sin(angle)
        vec[13] = math.cos(angle)

        # [14-17] binary flags
        vec[14] = 1.0 if alert.get("process_suspicious", False) else 0.0
        vec[15] = 1.0 if alert.get("user_privileged", False) else 0.0
        vec[16] = 1.0 if alert.get("lateral_movement", False) else 0.0
        vec[17] = 1.0 if alert.get("data_exfil_indicator", False) else 0.0

        # [18-23] MITRE technique flags (first 6 techniques)
        haystack = " ".join([
            str(alert.get("rule_description", "")),
            str(alert.get("command_line", "")),
            str(alert.get("process_name", "")),
        ]).lower()

        for i, tech_id in enumerate(_MITRE_TECHNIQUES[:6]):
            keywords = _MITRE_KEYWORDS[tech_id]
            vec[18 + i] = 1.0 if any(kw in haystack for kw in keywords) else 0.0

        # All roles see the same observation (can be specialised later)
        return {role: vec.copy() for role in self.config.role_names}

    # ---------------------------------------------------------------------- #
    # Training
    # ---------------------------------------------------------------------- #

    def train(self, n_episodes: int = 500, log_interval: int = 50) -> dict:
        """
        Self-play training loop using a simple simulated environment.

        Generates synthetic alerts, runs the MAPPO agents, assigns shaped
        rewards, and calls agent.update() every episode.

        Returns
        -------
        dict with final episode loss info.
        """
        rng       = np.random.default_rng(42)
        severities = list(_SEVERITY_MAP.keys())
        info: dict = {}

        for ep in range(1, n_episodes + 1):
            rollout: list = []
            ep_reward = 0.0

            for _ in range(20):  # 20 steps per episode
                # Synthesise a random alert
                alert = {
                    "severity":           rng.choice(severities),
                    "event_type":         rng.choice(_EVENT_TYPES),
                    "user_privileged":    bool(rng.integers(0, 2)),
                    "lateral_movement":   bool(rng.integers(0, 2)),
                    "data_exfil_indicator": bool(rng.integers(0, 2)),
                    "repeated_count":     int(rng.integers(0, 50)),
                    "timestamp_hour":     int(rng.integers(0, 24)),
                }
                obs  = self.encode_alert(alert)
                acts = self.agent.select_actions(obs)

                # Shaped reward: correct triage of critical alerts gets +1
                sev     = _SEVERITY_MAP.get(alert["severity"], 0.4)
                triage_act, _ = acts["TRIAGE"]
                reward_t = sev if triage_act in (1, 2, 3) else -sev  # escalate/assign = good

                rewards  = {r: reward_t for r in self.config.role_names}

                # Compute joint value
                joint_obs = np.concatenate([obs[r] for r in self.config.role_names])
                joint_t   = torch.FloatTensor(joint_obs).unsqueeze(0).to(self.agent.device)
                with torch.no_grad():
                    value = float(self.agent.critic(joint_t).item())

                rollout.append({
                    "observations": obs,
                    "actions":      {r: acts[r][0] for r in self.config.role_names},
                    "log_probs":    {r: acts[r][1] for r in self.config.role_names},
                    "rewards":      rewards,
                    "dones":        False,
                    "value":        value,
                    "next_value":   0.0,
                })
                ep_reward += reward_t

            info = self.agent.update(rollout)

            if ep % log_interval == 0:
                logger.info("Episode %d/%d  ep_reward=%.3f", ep, n_episodes, ep_reward)

        logger.info("Training complete. Final info: %s", info)
        return info

    # ---------------------------------------------------------------------- #
    # Persistence
    # ---------------------------------------------------------------------- #

    def save(self, path: Optional[str] = None) -> None:
        self.agent.save(path or self.config.checkpoint_path)

    def load(self, path: Optional[str] = None) -> None:
        self.agent.load(path or self.config.checkpoint_path)

    # ---------------------------------------------------------------------- #
    # Internal helpers
    # ---------------------------------------------------------------------- #

    def _execute_via_wazuh(self, alert: dict, response: dict) -> None:
        """Fire Wazuh active response for auto-executed containment actions."""
        action = response.get("containment", "no_op")
        if action == "no_op":
            return
        agent_id = alert.get("wazuh_agent_id", "")
        if not agent_id:
            logger.warning("auto_execute=True but no wazuh_agent_id in alert — skipping")
            return
        try:
            result = self.wazuh.execute_active_response(
                agent_id=agent_id,
                command=action,
                arguments=[alert.get("source_ip", "")],
            )
            logger.info("Wazuh active response fired: %s → %s", action, result)
        except Exception as exc:  # noqa: BLE001
            logger.error("Wazuh active response failed: %s", exc)
