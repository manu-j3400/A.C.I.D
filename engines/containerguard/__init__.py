"""
Engine 14: ContainerGuard — Container Escape Detection System
=============================================================

ContainerGuard combines eBPF syscall tracing with a Graph Neural Network (GNN)
over syscall dependency graphs to detect container breakout attempts in
real-time.  It is designed to run as a sidecar or host-level daemon alongside
a container runtime (Docker, containerd, CRI-O) with a companion eBPF loader
feeding raw tracepoint events into ContainerMonitor.ingest_event().

Quick start
-----------
    from engines.containerguard import (
        ContainerGuardConfig,
        SyscallGraphBuilder,
        EscapeDetector,
        ContainerMonitor,
    )

    cfg     = ContainerGuardConfig()
    builder = SyscallGraphBuilder(window_size=cfg.syscall_window)
    det     = EscapeDetector(cfg)
    det.train_on_synthetic()          # or det.load() if checkpoint exists
    monitor = ContainerMonitor(cfg, det)

    # Feed events from eBPF (or mock stream for testing)
    alerts = monitor.start_mock_stream(duration_s=5.0, inject_escape=True)
    for alert in alerts:
        print(f"[ALERT] prob={alert['escape_prob']:.2f}  "
              f"action={alert['recommended_action']}")

Architecture
------------
  config.py         — ContainerGuardConfig dataclass
  syscall_graph.py  — SyscallEvent + SyscallGraphBuilder (sliding-window graph)
  escape_detector.py — EscapeDetector (GCN primary / MLP fallback)
  monitor.py        — ContainerMonitor (runtime ingestion + alert routing)

Dependencies
------------
  Required  : numpy, torch
  Optional  : torch_geometric  (enables GCN; falls back to MLP if absent)
"""

from .config import ContainerGuardConfig
from .syscall_graph import SyscallGraphBuilder, SyscallEvent, SYSCALL_VOCAB
from .escape_detector import EscapeDetector
from .monitor import ContainerMonitor

__all__ = [
    "ContainerGuardConfig",
    "SyscallGraphBuilder",
    "SyscallEvent",
    "SYSCALL_VOCAB",
    "EscapeDetector",
    "ContainerMonitor",
]
