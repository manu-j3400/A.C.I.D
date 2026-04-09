"""
SymbAPT — Neurosymbolic APT Hunter
====================================
Differentiable MITRE ATT&CK rules + Kafka event consumer for
real-time Advanced Persistent Threat detection.

Quickstart::

    from engines.symbapt import APTHunter, MitreRuleEngine, SymbAPTConfig

    config  = SymbAPTConfig()
    engine  = MitreRuleEngine(config)
    hunter  = APTHunter(rule_engine=engine, config=config)

    result = hunter.ingest_event({
        "event_type": "process_create",
        "process_name": "powershell.exe",
        "command_line": "powershell -enc <base64>",
        "user_privileged": True,
    })
    print(result)   # {"technique_matches": {...}, "apt_score": 0.82, "is_apt": True, ...}
"""

from .mitre_rules import MitreRuleEngine
from .apt_hunter import APTHunter
from .kafka_consumer import KafkaEventConsumer
from .config import SymbAPTConfig

__all__ = [
    "MitreRuleEngine",
    "APTHunter",
    "KafkaEventConsumer",
    "SymbAPTConfig",
]
