"""
Engine 14: ContainerGuard — Container Escape Detection
=======================================================

ContainerGuardConfig: Central configuration dataclass for the ContainerGuard
engine. Governs the GNN model architecture, detection thresholds, runtime
monitoring parameters, and the curated list of high-risk syscalls that are
strong indicators of container escape attempts.

High-risk syscall rationale
---------------------------
  ptrace        — Process tracing; used to attach to host processes outside cgroup
  mount         — Remounting host filesystems (overlay breakout)
  unshare       — Drop namespace isolation; restores host view of PID/net/mnt
  clone         — Create child with CLONE_NEWNS / CLONE_NEWPID flags stripped
  setns         — Enter a different (host) namespace fd
  pivot_root    — Swap root filesystem to escape container rootfs
  chroot        — Classic chroot-escape pattern
  mknod         — Create device nodes to access host block/char devices
  kexec_load    — Replace the running kernel (requires CAP_SYS_BOOT)
  init_module   — Load unsigned kernel module to gain ring-0 control
  delete_module — Remove a security module (e.g. SELinux/AppArmor module)
  perf_event_open — Side-channel / hardware counter enumeration
  bpf           — Install BPF programs that bypass seccomp filters
  userfaultfd   — Page-fault handler used in Dirty COW and similar exploits
  keyctl        — Steal kernel keyring credentials from host
"""

from __future__ import annotations

from dataclasses import dataclass, field
from typing import List


@dataclass
class ContainerGuardConfig:
    """
    Runtime configuration for the ContainerGuard engine.

    Parameters
    ----------
    syscall_window : int
        Sliding window size (number of syscall events) fed to the GNN at each
        inference step. Larger windows capture longer attack sequences at the
        cost of higher latency.
    gnn_hidden_dim : int
        Width of the hidden layers in the GCN / MLP model.
    gnn_layers : int
        Number of message-passing (GCN) layers, or hidden layers in the MLP
        fallback.
    escape_threshold : float
        Minimum escape probability above which an event is flagged as a
        container escape attempt. Tune conservatively (0.65-0.75 typical).
    device : str
        PyTorch device string ("cpu" or "cuda"). Defaults to "cpu" for
        portability inside container environments.
    checkpoint_path : str
        File path for saving/loading trained model weights.
    monitor_interval_s : float
        How frequently (seconds) the ContainerMonitor flushes and scores the
        current syscall window in continuous-monitoring mode.
    high_risk_syscalls : list[str]
        Curated list of syscall names that are individually high-risk. Used
        as a binary feature in the GNN node embedding and to populate the
        risk_syscalls field of alert dicts.
    """

    syscall_window: int = 100
    gnn_hidden_dim: int = 64
    gnn_layers: int = 3
    escape_threshold: float = 0.70
    device: str = "cpu"
    checkpoint_path: str = "engines/containerguard/containerguard.pt"
    monitor_interval_s: float = 1.0
    high_risk_syscalls: List[str] = field(
        default_factory=lambda: [
            "ptrace",
            "mount",
            "unshare",
            "clone",
            "setns",
            "pivot_root",
            "chroot",
            "mknod",
            "kexec_load",
            "init_module",
            "delete_module",
            "perf_event_open",
            "bpf",
            "userfaultfd",
            "keyctl",
        ]
    )
