"""
engines/rlshield/config.py

RLShield configuration dataclass.  All hyper-parameters and integration
settings live here so every other module can import a single, typed
source of truth.
"""

from dataclasses import dataclass, field


@dataclass
class RLShieldConfig:
    # ------------------------------------------------------------------ #
    # Multi-agent topology
    # ------------------------------------------------------------------ #
    n_agents: int = 4
    """Number of SOC analyst roles (TRIAGE / INVESTIGATE / CONTAIN / REMEDIATE)."""

    obs_dim: int = 24
    """Per-agent observation dimension (see SOCOrchestrator.encode_alert for layout)."""

    # ------------------------------------------------------------------ #
    # PPO / GAE hyper-parameters
    # ------------------------------------------------------------------ #
    gamma: float = 0.99
    """Discount factor for future rewards."""

    gae_lambda: float = 0.95
    """GAE-λ smoothing factor; trades off bias vs variance in advantage estimates."""

    clip_eps: float = 0.2
    """PPO surrogate clipping epsilon."""

    lr: float = 3e-4
    """Adam learning rate shared across all actor/critic networks."""

    entropy_coef: float = 0.01
    """Entropy bonus coefficient — encourages exploration across action spaces."""

    value_coef: float = 0.5
    """Coefficient for the centralized value-function loss term."""

    ppo_epochs: int = 4
    """Number of mini-batch gradient steps per rollout update."""

    mini_batch_size: int = 32
    """Samples per mini-batch during PPO update."""

    # ------------------------------------------------------------------ #
    # Runtime
    # ------------------------------------------------------------------ #
    device: str = "cpu"
    """Torch device string ('cpu', 'cuda', 'mps')."""

    checkpoint_path: str = "engines/rlshield/rlshield.pt"
    """Default path for save/load checkpoints."""

    # ------------------------------------------------------------------ #
    # Orchestrator thresholds
    # ------------------------------------------------------------------ #
    auto_execute_threshold: float = 0.85
    """Minimum mean confidence before the orchestrator auto-executes a response."""

    # ------------------------------------------------------------------ #
    # Wazuh SIEM integration
    # ------------------------------------------------------------------ #
    wazuh_host: str = "localhost"
    wazuh_port: int = 55000
    wazuh_username: str = "wazuh"
    wazuh_password: str = "wazuh"
    wazuh_verify_ssl: bool = False

    # ------------------------------------------------------------------ #
    # Agent role metadata (order matters — index == role id)
    # ------------------------------------------------------------------ #
    role_names: list = field(default_factory=lambda: [
        "TRIAGE",
        "INVESTIGATE",
        "CONTAIN",
        "REMEDIATE",
    ])

    action_names: dict = field(default_factory=lambda: {
        "TRIAGE":      ["dismiss", "escalate", "assign_investigate", "assign_contain"],
        "INVESTIGATE": ["collect_logs", "run_scan", "request_memory_dump", "close"],
        "CONTAIN":     ["block_ip", "isolate_host", "kill_process", "no_op"],
        "REMEDIATE":   ["patch", "restore_backup", "rebuild", "no_op"],
    })

    def n_actions(self, role: str) -> int:
        """Return the action-space size for a given role name."""
        return len(self.action_names[role])
