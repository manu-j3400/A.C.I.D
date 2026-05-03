"""
Engine 11: SymbAPT — APTHunter
================================

Main detection class.  Converts raw SOC event dicts into 32-dimensional
feature vectors, runs the MitreRuleEngine, and returns structured detection
results.  Also supports supervised fine-tuning via train_episode() so the
rule weights can be updated from analyst-labeled incidents without retraining
from scratch.

Event dict schema (all fields optional — missing ones default to 0):
    event_type       : str  — one of LOGIN, EXEC, NETWORK, FILE, REG, WMI, SCHED, OTHER
    process_privilege: bool — True if event originates from an elevated process
    network_external : bool — True if network destination is non-RFC1918
    file_sensitive   : bool — True if path touches /etc, SAM, NTDS, lsass, etc.
    lateral_move     : bool — True if source/dest host differ
    timestamp        : float  — Unix epoch seconds
    command          : str  — raw command string for entropy + keyword scan
"""

from __future__ import annotations

import math
import os
from typing import Dict, List, Optional

import torch
import torch.nn as nn
import torch.optim as optim

from .config import SymbAPTConfig
from .mitre_rules import MitreRuleEngine, TECHNIQUE_IDS

# ------------------------------------------------------------------ #
# Event-type one-hot registry                                          #
# ------------------------------------------------------------------ #

EVENT_TYPES = ["LOGIN", "EXEC", "NETWORK", "FILE", "REG", "WMI", "SCHED", "OTHER"]
EVENT_TYPE_INDEX: dict[str, int] = {et: i for i, et in enumerate(EVENT_TYPES)}

# Keyword presence flags — 20 features, indices 12–31 in the feature vector.
KEYWORDS: list[str] = [
    "powershell", "mimikatz", "netcat", "wget", "curl",
    "base64",     "schtasks", "reg",   "wmic",  "psexec",
    "lsass",      "vssadmin", "certutil", "rundll32", "mshta",
    "regsvr32",   "cscript",  "wscript",  "msiexec",  "bitsadmin",
]


def _shannon_entropy(text: str) -> float:
    """Compute Shannon entropy (bits) of character distribution in *text*."""
    if not text:
        return 0.0
    freq: dict[str, int] = {}
    for ch in text:
        freq[ch] = freq.get(ch, 0) + 1
    n = len(text)
    return -sum((c / n) * math.log2(c / n) for c in freq.values())


class APTHunter:
    """
    Neurosymbolic APT hunter.

    Wraps a MitreRuleEngine and exposes three high-level operations:

      ingest_event()   — encode + infer, returns structured detection result
      train_episode()  — supervised fine-tune on a labeled event list
      save() / load()  — persist / restore the rule engine checkpoint
    """

    def __init__(
        self,
        rule_engine: MitreRuleEngine,
        config: SymbAPTConfig,
    ) -> None:
        self.rule_engine = rule_engine
        self.config = config
        self.device = config.device

        # Adam optimiser used for online fine-tuning.
        self._optimizer = optim.Adam(rule_engine.parameters(), lr=config.rule_lr)
        self._loss_fn = nn.BCELoss()

    # ------------------------------------------------------------------ #
    # Inference                                                            #
    # ------------------------------------------------------------------ #

    def encode_event(self, event: dict) -> torch.Tensor:
        """
        Encode a raw SOC event dict to a 32-dimensional float tensor.

        Feature layout (32 dims):
          [0:8]   event_type one-hot (8 types)
          [8]     process_privilege (0/1)
          [9]     network_external (0/1)
          [10]    file_sensitive (0/1)
          [11]    lateral_move (0/1)
          [12]    timestamp_hour_sin
          [13]    timestamp_hour_cos
          [14]    command_entropy (normalised to [0,1] by dividing by log2(96))
          [15:35] keyword presence flags (20 keywords, 0/1 each)

        Missing / unknown fields default to 0 so the encoder is robust to
        partial event schemas from heterogeneous SIEM sources.
        """
        vec = [0.0] * 35

        # --- one-hot event type (dims 0-7) ---
        etype = str(event.get("event_type", "OTHER")).upper()
        idx = EVENT_TYPE_INDEX.get(etype, EVENT_TYPE_INDEX["OTHER"])
        vec[idx] = 1.0

        # --- binary context flags (dims 8-11) ---
        vec[8]  = float(bool(event.get("process_privilege", False)))
        vec[9]  = float(bool(event.get("network_external",  False)))
        vec[10] = float(bool(event.get("file_sensitive",    False)))
        vec[11] = float(bool(event.get("lateral_move",      False)))

        # --- timestamp cyclical encoding (dims 12-13) ---
        ts = float(event.get("timestamp", 0.0))
        hour = (ts % 86400) / 3600  # hour of day in [0, 24)
        vec[12] = math.sin(2 * math.pi * hour / 24)
        vec[13] = math.cos(2 * math.pi * hour / 24)

        # --- command entropy (dim 14) ---
        cmd = str(event.get("command", ""))
        # Normalise: max possible entropy for printable ASCII ≈ log2(96) ≈ 6.58
        vec[14] = min(_shannon_entropy(cmd) / 6.58, 1.0)

        # --- keyword presence flags (dims 15-34 → indices 15:35) ---
        cmd_lower = cmd.lower()
        for i, kw in enumerate(KEYWORDS):
            vec[15 + i] = 1.0 if kw in cmd_lower else 0.0

        return torch.tensor(vec, dtype=torch.float32, device=self.device)

    def ingest_event(self, event: dict) -> dict:
        """
        Full inference pipeline for a single SOC event.

        1. Encode event dict → 32-dim feature tensor.
        2. Run MitreRuleEngine to get per-technique confidences.
        3. Compute kill-chain composite score.
        4. Threshold against config.apt_score_threshold.

        Returns
        -------
        dict with keys:
          technique_matches : dict[str, float]  per-technique confidence scores
          apt_score         : float             kill-chain composite score
          is_apt            : bool              True if score >= threshold
          confidence        : str               "HIGH" / "MEDIUM" / "LOW"
          top_technique     : str               ID of highest-confidence technique
          top_technique_name: str               Human-readable name
        """
        self.rule_engine.eval()
        with torch.no_grad():
            feat = self.encode_event(event).unsqueeze(0)  # (1, 32)
            confidences = self.rule_engine(feat)
            score = self.rule_engine.attack_chain_score(
                confidences,
                temperature=self.config.chain_temperature,
            ).item()

        # Collapse per-technique tensors to scalar floats.
        tech_scores: dict[str, float] = {
            tid: confidences[tid].item() for tid in TECHNIQUE_IDS
        }

        top_tid = max(tech_scores, key=lambda t: tech_scores[t])

        # Three-tier confidence band mirroring Soteria severity levels.
        if score >= 0.80:
            confidence = "HIGH"
        elif score >= self.config.apt_score_threshold:
            confidence = "MEDIUM"
        else:
            confidence = "LOW"

        from .mitre_rules import TECHNIQUE_NAMES
        return {
            "technique_matches":  tech_scores,
            "apt_score":          score,
            "is_apt":             score >= self.config.apt_score_threshold,
            "confidence":         confidence,
            "top_technique":      top_tid,
            "top_technique_name": TECHNIQUE_NAMES.get(top_tid, top_tid),
        }

    # ------------------------------------------------------------------ #
    # Supervised fine-tuning                                               #
    # ------------------------------------------------------------------ #

    def train_episode(self, labeled_events: List[dict]) -> float:
        """
        One gradient-update step on a batch of labeled SOC events.

        Each element of *labeled_events* must contain:
          - all standard event fields understood by encode_event()
          - "label" : int/float  — 1 if malicious (APT), 0 if benign
          - "techniques" : list[str]  — (optional) active technique IDs for
                           per-rule supervision; when absent, all rules receive
                           the global label.

        Returns
        -------
        float — mean BCE loss across the batch after the update.
        """
        if not labeled_events:
            return 0.0

        self.rule_engine.train()
        self._optimizer.zero_grad()

        total_loss = torch.tensor(0.0, device=self.device)

        for ev in labeled_events:
            feat = self.encode_event(ev).unsqueeze(0)  # (1, 32)
            confidences = self.rule_engine(feat)
            global_label = float(ev.get("label", 0))
            active_techniques: list[str] = ev.get("techniques", TECHNIQUE_IDS)

            for tid in TECHNIQUE_IDS:
                # Use per-technique label when provided, else fall back to global.
                tech_label = 1.0 if tid in active_techniques and global_label else global_label
                target = torch.tensor([tech_label], dtype=torch.float32, device=self.device)
                total_loss = total_loss + self._loss_fn(confidences[tid], target)

        mean_loss = total_loss / (len(labeled_events) * len(TECHNIQUE_IDS))
        mean_loss.backward()
        self._optimizer.step()

        return mean_loss.item()

    # ------------------------------------------------------------------ #
    # Checkpoint I/O                                                       #
    # ------------------------------------------------------------------ #

    def save(self, path: Optional[str] = None) -> None:
        """Persist rule engine weights and config to *path* (default: config.checkpoint_path)."""
        dest = path or self.config.checkpoint_path
        os.makedirs(os.path.dirname(os.path.abspath(dest)), exist_ok=True)
        torch.save(
            {
                "rule_engine_state": self.rule_engine.state_dict(),
                "config": self.config.to_dict(),
            },
            dest,
        )

    def load(self, path: Optional[str] = None) -> None:
        """Restore rule engine weights from *path* (default: config.checkpoint_path)."""
        src = path or self.config.checkpoint_path
        checkpoint = torch.load(src, map_location=self.device, weights_only=True)
        self.rule_engine.load_state_dict(checkpoint["rule_engine_state"])
        self.rule_engine.to(self.device)
