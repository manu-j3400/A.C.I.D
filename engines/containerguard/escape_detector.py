"""
Engine 14: ContainerGuard — GNN-based Container Escape Detector
================================================================

EscapeDetector wraps a lightweight GNN (3-layer GCN) that scores a syscall
dependency graph with an escape probability in [0, 1].

Architecture selection
----------------------
  Primary path   — GCN with torch_geometric (GCNConv → ReLU, 3 layers → sigmoid)
                   Node features are mean-pooled to a graph-level embedding before
                   the final classification head.
  Fallback path  — MLP operating on mean-pooled node features directly, used when
                   torch_geometric is not installed.  Functionally equivalent for
                   the graph-level binary classification task.

Both paths produce identical output shapes and the same predict() interface.

Synthetic training data
-----------------------
  _generate_benign_graph()   — random sequences of ordinary filesystem/network
                               syscalls with no high-risk members.
  _generate_escape_graph()   — injects ptrace → mount → unshare (or similar) into
                               the sequence to mimic a namespace-escape pattern.
  train_on_synthetic()       — 500+500 default; suitable for smoke-testing only.
                               Replace with real eBPF traces before production use.
"""

from __future__ import annotations

import random
from typing import Dict, List, Optional

import numpy as np

from .config import ContainerGuardConfig
from .syscall_graph import SyscallGraphBuilder, SyscallEvent, SYSCALL_VOCAB

# ---------------------------------------------------------------------------
# Feature dimension — must match SyscallGraphBuilder node feature vector
# ---------------------------------------------------------------------------
_NODE_FEATURE_DIM = 5


# ---------------------------------------------------------------------------
# Model definitions (PyTorch)
# ---------------------------------------------------------------------------

def _build_gcn_model(hidden_dim: int, n_layers: int):
    """
    Build a GCN classification model using torch_geometric GCNConv layers.
    Returns the model or raises ImportError if torch_geometric is unavailable.
    """
    import torch
    import torch.nn as nn
    from torch_geometric.nn import GCNConv
    from torch_geometric.nn import global_mean_pool

    class _GCNEscapeModel(nn.Module):
        def __init__(self):
            super().__init__()
            dims = [_NODE_FEATURE_DIM] + [hidden_dim] * (n_layers - 1) + [hidden_dim // 2]
            self.convs = nn.ModuleList()
            for i in range(len(dims) - 1):
                self.convs.append(GCNConv(dims[i], dims[i + 1]))
            self.head = nn.Linear(hidden_dim // 2, 1)
            self.relu = nn.ReLU()

        def forward(self, x, edge_index, batch=None):
            for conv in self.convs:
                x = self.relu(conv(x, edge_index))
            if batch is None:
                x = x.mean(dim=0, keepdim=True)  # single graph, no batch dim
            else:
                x = global_mean_pool(x, batch)
            return torch.sigmoid(self.head(x))

    return _GCNEscapeModel()


def _build_mlp_model(hidden_dim: int, n_layers: int):
    """
    Build a fallback MLP that classifies mean-pooled node feature vectors.
    Used when torch_geometric is unavailable.
    """
    import torch.nn as nn

    layers = []
    in_dim = _NODE_FEATURE_DIM
    for _ in range(n_layers - 1):
        layers += [nn.Linear(in_dim, hidden_dim), nn.ReLU()]
        in_dim = hidden_dim
    layers += [nn.Linear(in_dim, hidden_dim // 2), nn.ReLU(),
               nn.Linear(hidden_dim // 2, 1), nn.Sigmoid()]
    return nn.Sequential(*layers)


# ---------------------------------------------------------------------------
# EscapeDetector
# ---------------------------------------------------------------------------

class EscapeDetector:
    """
    GNN-based container escape detector.

    Parameters
    ----------
    config : ContainerGuardConfig
        Engine configuration (hidden dim, layers, threshold, device, paths).
    """

    def __init__(self, config: ContainerGuardConfig) -> None:
        self.config = config
        self._high_risk_set = frozenset(config.high_risk_syscalls)
        self._use_pyg = False
        self._model = None
        self._optimizer = None
        self._device = None
        self._init_model()

    # ------------------------------------------------------------------
    # Initialization
    # ------------------------------------------------------------------

    def _init_model(self) -> None:
        """Attempt to build a GCN model; fall back to MLP on ImportError."""
        try:
            import torch
            self._device = torch.device(self.config.device)
            try:
                model = _build_gcn_model(
                    self.config.gnn_hidden_dim,
                    self.config.gnn_layers,
                )
                self._use_pyg = True
            except ImportError:
                model = _build_mlp_model(
                    self.config.gnn_hidden_dim,
                    self.config.gnn_layers,
                )
                self._use_pyg = False

            self._model = model.to(self._device)
            import torch.optim as optim
            self._optimizer = optim.Adam(self._model.parameters(), lr=1e-3)
        except ImportError:
            # PyTorch itself unavailable — heuristic-only mode
            self._model = None

    # ------------------------------------------------------------------
    # Public API
    # ------------------------------------------------------------------

    def predict(self, graph_data: Dict) -> Dict:
        """
        Score a syscall dependency graph for escape probability.

        Parameters
        ----------
        graph_data : dict
            Output of SyscallGraphBuilder.build_graph().

        Returns
        -------
        dict with keys:
          "escape_prob"   : float          — model output in [0, 1]
          "is_escape"     : bool           — True if prob >= escape_threshold
          "risk_syscalls" : list[str]      — high-risk syscalls seen in window
          "confidence"    : str            — "high" / "medium" / "low"
        """
        risk_syscalls = [
            node["syscall"]
            for node in graph_data.get("nodes", [])
            if node.get("is_high_risk", False)
        ]

        if self._model is None:
            # Heuristic fallback when torch is unavailable
            escape_prob = min(1.0, len(risk_syscalls) * 0.15)
        else:
            features = self._extract_features(graph_data)
            escape_prob = self._forward(graph_data, features)

        is_escape = escape_prob >= self.config.escape_threshold
        confidence = (
            "high" if abs(escape_prob - 0.5) > 0.35
            else "medium" if abs(escape_prob - 0.5) > 0.15
            else "low"
        )

        return {
            "escape_prob": round(float(escape_prob), 4),
            "is_escape": is_escape,
            "risk_syscalls": list(set(risk_syscalls)),
            "confidence": confidence,
        }

    def train_on_synthetic(
        self,
        n_benign: int = 500,
        n_malicious: int = 500,
        epochs: int = 20,
    ) -> Dict:
        """
        Train the model on generated synthetic graphs.

        Suitable for CI smoke-testing and initial checkpoint generation.
        For production accuracy, replace with graphs derived from real eBPF traces.

        Returns
        -------
        dict: {"epochs": int, "final_loss": float, "n_benign": int, "n_malicious": int}
        """
        if self._model is None:
            return {"error": "torch unavailable — cannot train"}

        import torch
        import torch.nn as nn

        criterion = nn.BCELoss()
        graphs: List[tuple] = []
        for _ in range(n_benign):
            graphs.append((self._generate_benign_graph(), 0.0))
        for _ in range(n_malicious):
            graphs.append((self._generate_escape_graph(), 1.0))
        random.shuffle(graphs)

        self._model.train()
        final_loss = 0.0
        for epoch in range(epochs):
            epoch_loss = 0.0
            random.shuffle(graphs)
            for graph_data, label in graphs:
                features = self._extract_features(graph_data)
                prob = self._forward_tensor(graph_data, features)
                target = torch.tensor([[label]], dtype=torch.float32, device=self._device)
                loss = criterion(prob, target)
                self._optimizer.zero_grad()
                loss.backward()
                self._optimizer.step()
                epoch_loss += loss.item()
            final_loss = epoch_loss / len(graphs)

        self._model.eval()
        return {
            "epochs": epochs,
            "final_loss": round(final_loss, 6),
            "n_benign": n_benign,
            "n_malicious": n_malicious,
        }

    def save(self, path: Optional[str] = None) -> None:
        """Persist model weights to disk."""
        if self._model is None:
            return
        import torch
        torch.save(self._model.state_dict(), path or self.config.checkpoint_path)

    def load(self, path: Optional[str] = None) -> None:
        """Load model weights from disk."""
        if self._model is None:
            return
        import torch
        state = torch.load(
            path or self.config.checkpoint_path,
            map_location=self._device,
        )
        self._model.load_state_dict(state)
        self._model.eval()

    # ------------------------------------------------------------------
    # Private helpers
    # ------------------------------------------------------------------

    def _extract_features(self, graph_data: Dict):
        """Return a (n_nodes, 5) float32 torch.Tensor from graph_data."""
        import torch
        features = graph_data.get("features", np.zeros((1, _NODE_FEATURE_DIM), dtype=np.float32))
        return torch.tensor(features, dtype=torch.float32, device=self._device)

    def _forward(self, graph_data: Dict, features) -> float:
        """Run the model and return a scalar escape probability."""
        import torch
        with torch.no_grad():
            prob_tensor = self._forward_tensor(graph_data, features)
        return float(prob_tensor.squeeze())

    def _forward_tensor(self, graph_data: Dict, features):
        """Run the model and return the raw output tensor (for training)."""
        import torch

        if self._use_pyg:
            from torch_geometric.data import Data
            edges = graph_data.get("edges", [])
            if edges:
                edge_index = torch.tensor(
                    [[e["src"] for e in edges],
                     [e["dst"] for e in edges]],
                    dtype=torch.long,
                    device=self._device,
                )
            else:
                edge_index = torch.zeros((2, 0), dtype=torch.long, device=self._device)
            return self._model(features, edge_index)
        else:
            # MLP fallback: mean-pool node features → graph vector
            pooled = features.mean(dim=0, keepdim=True)  # (1, 5)
            return self._model(pooled)

    def _generate_benign_graph(self) -> Dict:
        """
        Produce a synthetic benign syscall graph (no high-risk syscalls).
        Simulates a typical containerized application doing file I/O + networking.
        """
        benign_syscalls = [
            "read", "write", "open", "close", "mmap", "stat", "fstat",
            "socket", "connect", "send", "recv", "poll", "epoll_wait",
            "openat", "getcwd", "futex", "nanosleep",
        ]
        builder = SyscallGraphBuilder(window_size=self.config.syscall_window)
        pid = random.randint(1000, 9999)
        t = 0.0
        for _ in range(random.randint(40, self.config.syscall_window)):
            sc = random.choice(benign_syscalls)
            builder.add_event(SyscallEvent(
                syscall_name=sc, pid=pid, tid=pid,
                timestamp=t, args=[], return_val=random.randint(0, 100),
            ))
            t += random.uniform(0.001, 0.05)
        return builder.build_graph()

    def _generate_escape_graph(self) -> Dict:
        """
        Produce a synthetic escape graph that contains a high-risk syscall
        sequence (ptrace → mount → unshare or similar patterns).
        """
        # Start with benign preamble
        benign_syscalls = ["read", "write", "open", "close", "mmap", "stat"]
        escape_sequence = random.choice([
            ["ptrace", "mount", "unshare"],
            ["clone", "setns", "pivot_root"],
            ["mknod", "chroot", "mount"],
            ["bpf", "perf_event_open", "ptrace"],
            ["init_module", "kexec_load"],
        ])
        builder = SyscallGraphBuilder(window_size=self.config.syscall_window)
        pid = random.randint(1000, 9999)
        t = 0.0
        # Benign preamble
        for _ in range(random.randint(10, 30)):
            sc = random.choice(benign_syscalls)
            builder.add_event(SyscallEvent(
                syscall_name=sc, pid=pid, tid=pid,
                timestamp=t, args=[], return_val=0,
            ))
            t += random.uniform(0.001, 0.02)
        # Inject escape sequence
        for sc in escape_sequence:
            builder.add_event(SyscallEvent(
                syscall_name=sc, pid=pid, tid=pid,
                timestamp=t, args=[], return_val=0,
            ))
            t += random.uniform(0.001, 0.01)
        # Benign tail (attacker covers tracks)
        for _ in range(random.randint(5, 20)):
            sc = random.choice(benign_syscalls)
            builder.add_event(SyscallEvent(
                syscall_name=sc, pid=pid, tid=pid,
                timestamp=t, args=[], return_val=0,
            ))
            t += random.uniform(0.001, 0.02)
        return builder.build_graph()
