"""
Engine 14: ContainerGuard — Runtime Container Monitor
======================================================

ContainerMonitor provides the operational interface between the eBPF syscall
stream (or a simulated event feed) and the EscapeDetector inference pipeline.

Event lifecycle
---------------
  1. Raw syscall event dicts arrive via ingest_event().
  2. Each event is parsed into a SyscallEvent and pushed to SyscallGraphBuilder.
  3. When the sliding window reaches capacity (or on every call if the window
     is already full), build_graph() + EscapeDetector.predict() are invoked.
  4. If escape_prob >= escape_threshold, an alert dict is returned; otherwise
     None is returned (no alert).

Alert dict schema
-----------------
  {
    "alert": True,
    "escape_prob": float,           — GNN output in [0, 1]
    "container_pid": int,           — PID that triggered the window flush
    "risk_syscalls": list[str],     — high-risk syscalls observed in window
    "recommended_action": str,      — one of: monitor / alert_soc /
                                              isolate_container / kill_container
    "timestamp": float,             — Unix epoch of the triggering event
  }

Mock stream
-----------
  start_mock_stream() generates a realistic benign event sequence and,
  optionally, injects a timed escape attempt mid-stream.  Used for integration
  testing and demo purposes without requiring a live eBPF loader.
"""

from __future__ import annotations

import random
import time
from typing import Dict, List, Optional

from .config import ContainerGuardConfig
from .escape_detector import EscapeDetector
from .syscall_graph import SyscallGraphBuilder, SyscallEvent


class ContainerMonitor:
    """
    Runtime monitoring interface for ContainerGuard.

    Parameters
    ----------
    config   : ContainerGuardConfig
    detector : EscapeDetector
        Pre-initialized (and optionally pre-trained) escape detector.
    """

    def __init__(
        self,
        config: ContainerGuardConfig,
        detector: EscapeDetector,
    ) -> None:
        self.config = config
        self.detector = detector
        self._builder = SyscallGraphBuilder(
            window_size=config.syscall_window,
            high_risk=frozenset(config.high_risk_syscalls),
        )
        self._event_count: int = 0
        self._alert_count: int = 0

    # ------------------------------------------------------------------
    # Core ingestion
    # ------------------------------------------------------------------

    def ingest_event(self, event: Dict) -> Optional[Dict]:
        """
        Ingest a single raw syscall event dict and return an alert if an
        escape attempt is detected.

        Parameters
        ----------
        event : dict
            Required keys: "syscall" (str), "pid" (int), "tid" (int),
                           "timestamp" (float), "args" (list), "return" (int).
            Missing keys default to safe zero-values.

        Returns
        -------
        Alert dict (see module docstring) or None.
        """
        sc_event = SyscallEvent(
            syscall_name=str(event.get("syscall", "unknown")),
            pid=int(event.get("pid", 0)),
            tid=int(event.get("tid", 0)),
            timestamp=float(event.get("timestamp", 0.0)),
            args=list(event.get("args", [])),
            return_val=int(event.get("return", 0)),
        )
        self._builder.add_event(sc_event)
        self._event_count += 1

        # Score every time the window is full (subsequent events trigger on
        # every insertion once the deque is at capacity and evicts old events).
        if not self._builder.window_full:
            return None

        graph = self._builder.build_graph()
        result = self.detector.predict(graph)

        if not result["is_escape"]:
            return None

        self._alert_count += 1
        action = self.recommended_action(result["escape_prob"])
        alert: Dict = {
            "alert": True,
            "escape_prob": result["escape_prob"],
            "container_pid": sc_event.pid,
            "risk_syscalls": result["risk_syscalls"],
            "recommended_action": action,
            "timestamp": sc_event.timestamp,
        }
        return alert

    # ------------------------------------------------------------------
    # Mock event stream
    # ------------------------------------------------------------------

    def start_mock_stream(
        self,
        duration_s: float = 10.0,
        inject_escape: bool = False,
    ) -> List[Dict]:
        """
        Generate and process a stream of mock syscall events.

        Parameters
        ----------
        duration_s    : float
            Simulated wall-clock duration of the mock stream (not real sleep;
            timestamps are synthetic).
        inject_escape : bool
            When True, a realistic escape sequence (ptrace → mount → unshare)
            is injected at the 60% mark of the stream.

        Returns
        -------
        List of alert dicts triggered during the stream (may be empty).
        """
        alerts: List[Dict] = []
        benign_pool = [
            "read", "write", "open", "close", "openat", "mmap", "stat",
            "fstat", "socket", "connect", "send", "recv", "poll",
            "epoll_wait", "futex", "nanosleep", "getcwd", "fcntl",
        ]
        escape_sequence = ["ptrace", "mount", "unshare", "setns"]

        pid = random.randint(2000, 9999)
        tid = pid
        t = time.time()
        step = duration_s / max(self.config.syscall_window * 3, 300)
        n_events = int(duration_s / step)
        inject_at = int(n_events * 0.6) if inject_escape else -1

        # Reset builder to a clean state for this mock run
        self._builder.reset()

        escape_idx = 0
        for i in range(n_events):
            if inject_escape and i == inject_at + escape_idx and escape_idx < len(escape_sequence):
                syscall = escape_sequence[escape_idx]
                escape_idx += 1
                ret = 0
            else:
                syscall = random.choice(benign_pool)
                ret = random.randint(0, 255)

            raw_event: Dict = {
                "syscall": syscall,
                "pid": pid,
                "tid": tid,
                "timestamp": t,
                "args": [random.randint(0, 0xFFFF)],
                "return": ret,
            }
            alert = self.ingest_event(raw_event)
            if alert is not None:
                alerts.append(alert)
            t += step

        return alerts

    # ------------------------------------------------------------------
    # Action recommendation
    # ------------------------------------------------------------------

    @staticmethod
    def recommended_action(escape_prob: float) -> str:
        """
        Map an escape probability to a recommended SOC response action.

        Thresholds
        ----------
          < 0.40   — "monitor"            (normal background noise)
          0.40-0.70 — "alert_soc"         (suspicious; investigate)
          0.70-0.90 — "isolate_container" (high confidence; quarantine)
          > 0.90   — "kill_container"     (critical; terminate immediately)
        """
        if escape_prob < 0.40:
            return "monitor"
        if escape_prob < 0.70:
            return "alert_soc"
        if escape_prob < 0.90:
            return "isolate_container"
        return "kill_container"

    # ------------------------------------------------------------------
    # Diagnostics
    # ------------------------------------------------------------------

    @property
    def stats(self) -> Dict:
        """Return basic monitoring statistics."""
        return {
            "events_processed": self._event_count,
            "alerts_raised": self._alert_count,
            "window_fill": len(self._builder),
            "window_capacity": self.config.syscall_window,
        }
