"""
Engine 11: SymbAPT — Differentiable MITRE ATT&CK Rule Engine
=============================================================

Each of the 12 core ATT&CK techniques is represented as a small MLP whose
weights are learnable via back-propagation.  This makes the rule engine
*differentiable*: labeled incident data can push gradient through the rules
and automatically sharpen detection boundaries — the neurosymbolic idea
described in the SymbAPT paper.

Technique coverage
------------------
  T1059  Command and Scripting Interpreter
  T1078  Valid Accounts
  T1003  OS Credential Dumping
  T1021  Remote Services
  T1055  Process Injection
  T1070  Indicator Removal on Host
  T1036  Masquerading
  T1082  System Information Discovery
  T1083  File and Directory Discovery
  T1105  Ingress Tool Transfer
  T1071  Application Layer Protocol
  T1041  Exfiltration Over C2 Channel
"""

from __future__ import annotations

from typing import Dict

import torch
import torch.nn as nn
import torch.nn.functional as F


# Ordered list of technique IDs — index used as MLP register index.
TECHNIQUE_IDS: list[str] = [
    "T1059",  # Command / Script
    "T1078",  # Valid Accounts
    "T1003",  # Credential Dumping
    "T1021",  # Remote Services
    "T1055",  # Process Injection
    "T1070",  # Indicator Removal
    "T1036",  # Masquerading
    "T1082",  # System Discovery
    "T1083",  # File/Dir Discovery
    "T1105",  # Ingress Tool Transfer
    "T1071",  # App Layer Protocol
    "T1041",  # Exfil over C2
]

# Human-readable names keyed by technique ID.
TECHNIQUE_NAMES: dict[str, str] = {
    "T1059": "Command and Scripting Interpreter",
    "T1078": "Valid Accounts",
    "T1003": "OS Credential Dumping",
    "T1021": "Remote Services",
    "T1055": "Process Injection",
    "T1070": "Indicator Removal on Host",
    "T1036": "Masquerading",
    "T1082": "System Information Discovery",
    "T1083": "File and Directory Discovery",
    "T1105": "Ingress Tool Transfer",
    "T1071": "Application Layer Protocol",
    "T1041": "Exfiltration Over C2 Channel",
}


class TechniqueRule(nn.Module):
    """
    Tiny MLP that maps an event feature vector to a scalar confidence
    (0–1) that the event matches a specific ATT&CK technique.

    Architecture: Linear(in→hidden) → ReLU → Linear(hidden→1) → Sigmoid
    """

    def __init__(self, feature_dim: int = 32, hidden_dim: int = 16) -> None:
        super().__init__()
        self.fc1 = nn.Linear(feature_dim, hidden_dim)
        self.fc2 = nn.Linear(hidden_dim, 1)

    def forward(self, x: torch.Tensor) -> torch.Tensor:
        """
        Parameters
        ----------
        x : torch.Tensor shape (batch, feature_dim)

        Returns
        -------
        torch.Tensor shape (batch,) — confidence in [0, 1]
        """
        h = F.relu(self.fc1(x))
        return torch.sigmoid(self.fc2(h)).squeeze(-1)


class MitreRuleEngine(nn.Module):
    """
    Differentiable MITRE ATT&CK rule engine.

    Holds one TechniqueRule MLP per technique.  All MLPs share the same
    input dimensionality but have independent weights, so each technique
    learns its own decision boundary from labeled incidents.

    Usage
    -----
    >>> engine = MitreRuleEngine(feature_dim=32, hidden_dim=16)
    >>> events = torch.randn(8, 32)          # batch of 8 events
    >>> confidences = engine(events)         # dict[technique_id -> tensor(8,)]
    >>> score = engine.attack_chain_score(confidences)  # tensor(8,)
    """

    def __init__(
        self,
        feature_dim: int = 32,
        hidden_dim: int = 16,
        device: str = "cpu",
    ) -> None:
        super().__init__()
        self.feature_dim = feature_dim
        self.device = device

        # Register each rule as a named sub-module so state_dict() captures it.
        self.rules = nn.ModuleDict(
            {tid: TechniqueRule(feature_dim, hidden_dim) for tid in TECHNIQUE_IDS}
        )
        self.to(device)

    # ------------------------------------------------------------------ #
    # Forward pass                                                         #
    # ------------------------------------------------------------------ #

    def forward(self, events: torch.Tensor) -> Dict[str, torch.Tensor]:
        """
        Run all technique rules over a batch of event feature vectors.

        Parameters
        ----------
        events : torch.Tensor shape (batch, feature_dim)
            Encoded event batch produced by APTHunter.encode_event().

        Returns
        -------
        dict mapping technique_id -> torch.Tensor shape (batch,)
            Each value is the per-event confidence that the event matches
            the corresponding ATT&CK technique.
        """
        events = events.to(self.device)
        return {tid: rule(events) for tid, rule in self.rules.items()}

    # ------------------------------------------------------------------ #
    # Kill-chain composite score                                           #
    # ------------------------------------------------------------------ #

    def attack_chain_score(
        self,
        technique_confidences: Dict[str, torch.Tensor],
        temperature: float = 1.0,
    ) -> torch.Tensor:
        """
        Compute a single APT kill-chain composite score from per-technique
        confidences.

        The score is a *softmax-weighted sum* of technique confidences —
        techniques that fire more strongly contribute proportionally more to
        the final score, while temperature controls how sharply peaked the
        weighting is.

        Parameters
        ----------
        technique_confidences : dict[str, Tensor shape (batch,)]
            Output of forward().
        temperature : float
            Softmax temperature (< 1 → sharper, > 1 → smoother).

        Returns
        -------
        torch.Tensor shape (batch,) — composite score in [0, 1].
        """
        # Stack confidences → (n_techniques, batch)
        stacked = torch.stack(
            [technique_confidences[tid] for tid in TECHNIQUE_IDS], dim=0
        )
        # Softmax weights over techniques axis (dim=0) for each event.
        weights = F.softmax(stacked / max(temperature, 1e-6), dim=0)
        # Weighted sum → (batch,)
        return (weights * stacked).sum(dim=0)
