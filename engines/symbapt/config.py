"""
Engine 11: SymbAPT — Neurosymbolic APT Hunter
==============================================

Configuration dataclass for SymbAPT. All tunable hyper-parameters and
infrastructure coordinates live here so nothing is hard-coded elsewhere.
"""

from __future__ import annotations

from dataclasses import dataclass, field
from typing import List


@dataclass
class SymbAPTConfig:
    """
    Central configuration for the SymbAPT neurosymbolic APT detection engine.

    Parameters
    ----------
    event_feature_dim : int
        Dimensionality of the encoded event feature vector fed into each
        MITRE rule MLP.  Must match APTHunter.encode_event() output width (32).

    apt_score_threshold : float
        Kill-chain composite score above which an ingested event (or event
        window) is classified as an active APT campaign.  Analogous to the
        0.65 prob floor used by the SNN engine.

    rule_lr : float
        Adam learning rate applied when fine-tuning rule MLPs via
        APTHunter.train_episode().

    device : str
        PyTorch device string ("cpu", "cuda", "mps").  Engine defaults to
        "cpu" so it runs anywhere without GPU provisioning.

    checkpoint_path : str
        File path for saving / loading the MitreRuleEngine state dict.
        Relative paths are resolved from the repo root.

    kafka_bootstrap : List[str]
        Kafka broker addresses used by KafkaEventConsumer.

    kafka_topic : str
        Kafka topic that carries raw SOC event JSON messages.

    kafka_group_id : str
        Consumer-group ID.  Changing this causes Kafka to replay all
        unacknowledged messages — useful for back-testing.

    rule_hidden_dim : int
        Width of the hidden layer inside each technique MLP.  Increasing
        this adds capacity at the cost of more parameters per rule.

    chain_temperature : float
        Softmax temperature applied when computing the kill-chain composite
        score.  Lower values make the score sharper / more winner-take-all.
    """

    event_feature_dim: int = 35
    apt_score_threshold: float = 0.65
    rule_lr: float = 1e-3
    device: str = "cpu"
    checkpoint_path: str = "engines/symbapt/symbapt_rules.pt"
    kafka_bootstrap: List[str] = field(default_factory=lambda: ["localhost:9092"])
    kafka_topic: str = "soc-events"
    kafka_group_id: str = "symbapt"
    rule_hidden_dim: int = 16
    chain_temperature: float = 1.0

    # ------------------------------------------------------------------ #
    # Convenience helpers                                                  #
    # ------------------------------------------------------------------ #

    def to_dict(self) -> dict:
        """Serialise config to a plain dict (for logging / checkpoints)."""
        import dataclasses
        return dataclasses.asdict(self)

    @classmethod
    def from_dict(cls, d: dict) -> "SymbAPTConfig":
        """Deserialise config from a plain dict."""
        return cls(**{k: v for k, v in d.items() if k in cls.__dataclass_fields__})
