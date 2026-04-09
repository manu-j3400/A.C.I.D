"""
RLShield — Multi-Agent MAPPO SOC Orchestrator
===============================================
Automated incident response via CTDE (Centralized Training,
Decentralized Execution) MAPPO with optional Wazuh SIEM integration.

Quickstart::

    from engines.rlshield import SOCOrchestrator, RLShieldConfig

    cfg   = RLShieldConfig()
    orch  = SOCOrchestrator(cfg)

    response = orch.process_alert({
        "severity": "critical",
        "event_type": "lateral_movement",
        "user_privileged": True,
        "lateral_movement": True,
        "source_ip": "10.0.1.42",
    })
    print(response)
    # {"triage": "assign_contain", "investigation": "run_scan",
    #  "containment": "block_ip", "remediation": "patch",
    #  "confidence": 0.73, "severity": "critical", "auto_execute": False}

With Wazuh::

    from engines.rlshield import WazuhConnector
    wazuh = WazuhConnector(host="wazuh.internal")
    wazuh.connect()
    orch  = SOCOrchestrator(cfg, wazuh=wazuh)
"""

from .config import RLShieldConfig
from .mappo_agent import MAPPOAgent
from .soc_orchestrator import SOCOrchestrator
from .wazuh_connector import WazuhConnector

__all__ = [
    "RLShieldConfig",
    "MAPPOAgent",
    "SOCOrchestrator",
    "WazuhConnector",
]
