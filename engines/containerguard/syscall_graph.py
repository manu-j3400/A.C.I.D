"""
Engine 14: ContainerGuard — Syscall Dependency Graph Builder
=============================================================

SyscallGraphBuilder converts a sliding window of raw syscall events into a
dependency graph suitable for GNN inference.

Graph construction
------------------
  Nodes   — unique (pid, syscall_name) pairs observed in the window.
  Edges   — directed A → B if syscall A immediately precedes syscall B
             within the same PID in the ordered event list.
  Features — 5-dimensional per-node vector:
               [0] syscall_index / 256      — identity (vocabulary embedding proxy)
               [1] pid / 65536              — process origin
               [2] freq / window_size       — how often this (pid, syscall) fired
               [3] is_high_risk (0/1)       — in ContainerGuardConfig.high_risk_syscalls
               [4] return_neg (0/1)         — any call returned a negative value (error)
"""

from __future__ import annotations

from collections import defaultdict, deque
from dataclasses import dataclass, field
from typing import Deque, Dict, List, Optional, Tuple

import numpy as np


# ---------------------------------------------------------------------------
# Syscall vocabulary (~60 common syscall names → integer indices)
# ---------------------------------------------------------------------------

SYSCALL_VOCAB: Dict[str, int] = {
    "read": 0,
    "write": 1,
    "open": 2,
    "close": 3,
    "mmap": 4,
    "mprotect": 5,
    "brk": 6,
    "ptrace": 7,
    "clone": 8,
    "fork": 9,
    "execve": 10,
    "exit": 11,
    "wait": 12,
    "kill": 13,
    "signal": 14,
    "socket": 15,
    "connect": 16,
    "bind": 17,
    "listen": 18,
    "accept": 19,
    "send": 20,
    "recv": 21,
    "ioctl": 22,
    "fcntl": 23,
    "stat": 24,
    "fstat": 25,
    "lstat": 26,
    "access": 27,
    "getcwd": 28,
    "chdir": 29,
    "mkdir": 30,
    "rmdir": 31,
    "unlink": 32,
    "rename": 33,
    "link": 34,
    "symlink": 35,
    "mount": 36,
    "umount": 37,
    "chroot": 38,
    "pivot_root": 39,
    "unshare": 40,
    "setns": 41,
    "mknod": 42,
    "bpf": 43,
    "perf_event_open": 44,
    "init_module": 45,
    "kexec_load": 46,
    "keyctl": 47,
    "prctl": 48,
    "seccomp": 49,
    "capset": 50,
    "setuid": 51,
    "setgid": 52,
    "sethostname": 53,
    "userfaultfd": 54,
    "delete_module": 55,
    "openat": 56,
    "pipe": 57,
    "dup": 58,
    "poll": 59,
    "select": 60,
    "epoll_wait": 61,
    "futex": 62,
    "nanosleep": 63,
}

_UNKNOWN_IDX: int = len(SYSCALL_VOCAB)  # 64 — used for any syscall not in vocab


# ---------------------------------------------------------------------------
# SyscallEvent
# ---------------------------------------------------------------------------

@dataclass
class SyscallEvent:
    """
    A single syscall observation captured by the eBPF tracepoint.

    Parameters
    ----------
    syscall_name : str    e.g. "clone", "ptrace"
    pid          : int    Process ID of the calling thread's process group
    tid          : int    Thread ID (may differ from pid in multi-threaded processes)
    timestamp    : float  Unix epoch seconds with sub-second precision
    args         : list   Raw syscall argument values (up to 6)
    return_val   : int    Return value; negative indicates an error (errno)
    """

    syscall_name: str
    pid: int
    tid: int
    timestamp: float
    args: List = field(default_factory=list)
    return_val: int = 0


# ---------------------------------------------------------------------------
# SyscallGraphBuilder
# ---------------------------------------------------------------------------

# High-risk set is kept as a module-level default; ContainerMonitor injects
# the config-specific set at runtime via the _high_risk parameter.
_DEFAULT_HIGH_RISK = frozenset([
    "ptrace", "mount", "unshare", "clone", "setns", "pivot_root",
    "chroot", "mknod", "kexec_load", "init_module", "delete_module",
    "perf_event_open", "bpf", "userfaultfd", "keyctl",
])


class SyscallGraphBuilder:
    """
    Maintains a bounded sliding window of SyscallEvent objects and constructs
    a dependency graph on demand for GNN inference.

    Parameters
    ----------
    window_size : int
        Maximum number of events held in the internal deque.  Older events
        are evicted when the window is full.
    high_risk : frozenset[str] | None
        Set of syscall names treated as high-risk node features.  Defaults to
        _DEFAULT_HIGH_RISK when None.
    """

    def __init__(
        self,
        window_size: int = 100,
        high_risk: Optional[frozenset] = None,
    ) -> None:
        self.window_size = window_size
        self._high_risk = high_risk if high_risk is not None else _DEFAULT_HIGH_RISK
        self._window: Deque[SyscallEvent] = deque(maxlen=window_size)

    # ------------------------------------------------------------------
    # Public API
    # ------------------------------------------------------------------

    def add_event(self, event: SyscallEvent) -> None:
        """Append one syscall event to the sliding window."""
        self._window.append(event)

    def reset(self) -> None:
        """Clear the sliding window (e.g. between container restarts)."""
        self._window.clear()

    def build_graph(self) -> Dict:
        """
        Build a syscall dependency graph from the current window contents.

        Returns
        -------
        dict with keys:
          "nodes"    : list[dict]    — {id, pid, syscall, freq, is_high_risk}
          "edges"    : list[dict]    — {src, dst} by node id
          "features" : np.ndarray    — shape (n_nodes, 5), float32
          "adj"      : np.ndarray    — shape (n_nodes, n_nodes), float32 adjacency
        """
        events = list(self._window)
        if not events:
            return {
                "nodes": [],
                "edges": [],
                "features": np.zeros((1, 5), dtype=np.float32),
                "adj": np.zeros((1, 1), dtype=np.float32),
            }

        # --- Build node index: (pid, syscall_name) → node_id ---
        node_key_to_id: Dict[Tuple[int, str], int] = {}
        freq_counter: Dict[Tuple[int, str], int] = defaultdict(int)
        return_neg: Dict[Tuple[int, str], bool] = defaultdict(bool)

        for ev in events:
            key = (ev.pid, ev.syscall_name)
            if key not in node_key_to_id:
                node_key_to_id[key] = len(node_key_to_id)
            freq_counter[key] += 1
            if ev.return_val < 0:
                return_neg[key] = True

        n_nodes = len(node_key_to_id)

        # --- Build node metadata list ---
        nodes: List[Dict] = []
        for (pid, syscall), nid in sorted(node_key_to_id.items(), key=lambda x: x[1]):
            nodes.append({
                "id": nid,
                "pid": pid,
                "syscall": syscall,
                "freq": freq_counter[(pid, syscall)],
                "is_high_risk": syscall in self._high_risk,
            })

        # --- Build feature matrix (n_nodes, 5) ---
        features = np.zeros((n_nodes, 5), dtype=np.float32)
        for node in nodes:
            nid = node["id"]
            syscall_idx = SYSCALL_VOCAB.get(node["syscall"], _UNKNOWN_IDX)
            features[nid, 0] = syscall_idx / 256.0
            features[nid, 1] = node["pid"] / 65536.0
            features[nid, 2] = node["freq"] / max(self.window_size, 1)
            features[nid, 3] = 1.0 if node["is_high_risk"] else 0.0
            features[nid, 4] = 1.0 if return_neg[(node["pid"], node["syscall"])] else 0.0

        # --- Build edge list: A → B if A immediately precedes B (same pid) ---
        adj = np.zeros((n_nodes, n_nodes), dtype=np.float32)
        edges: List[Dict] = []
        seen_edges: set = set()

        # Group events by PID, preserving temporal order
        pid_sequences: Dict[int, List[SyscallEvent]] = defaultdict(list)
        for ev in events:
            pid_sequences[ev.pid].append(ev)

        for pid, seq in pid_sequences.items():
            for i in range(len(seq) - 1):
                src_key = (seq[i].pid, seq[i].syscall_name)
                dst_key = (seq[i + 1].pid, seq[i + 1].syscall_name)
                src_id = node_key_to_id[src_key]
                dst_id = node_key_to_id[dst_key]
                if (src_id, dst_id) not in seen_edges:
                    seen_edges.add((src_id, dst_id))
                    adj[src_id, dst_id] = 1.0
                    edges.append({"src": src_id, "dst": dst_id})

        return {
            "nodes": nodes,
            "edges": edges,
            "features": features,
            "adj": adj,
        }

    def to_pyg_data(self):
        """
        Convert the current window into a torch_geometric Data object.

        Returns a torch_geometric.data.Data if torch_geometric is available,
        otherwise returns the raw dict from build_graph().
        """
        graph = self.build_graph()
        try:
            import torch
            from torch_geometric.data import Data

            features = torch.tensor(graph["features"], dtype=torch.float32)
            if graph["edges"]:
                edge_index = torch.tensor(
                    [[e["src"] for e in graph["edges"]],
                     [e["dst"] for e in graph["edges"]]],
                    dtype=torch.long,
                )
            else:
                edge_index = torch.zeros((2, 0), dtype=torch.long)

            return Data(x=features, edge_index=edge_index)
        except ImportError:
            return graph

    @property
    def window_full(self) -> bool:
        """True when the sliding window has reached capacity."""
        return len(self._window) >= self.window_size

    def __len__(self) -> int:
        return len(self._window)
