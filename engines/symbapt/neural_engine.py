"""
neural_engine — GNN encoder for entity-event graphs.

Uses a simple message-passing architecture (pure torch, no torch_geometric
dependency) to produce per-node embeddings from a security event graph.
A TechniqueClassifier head maps the pooled graph embedding to soft MITRE
technique scores.
"""

from __future__ import annotations

import enum
from dataclasses import dataclass, field
from typing import Dict, List, Optional, Tuple

import numpy as np

try:
    import torch
    import torch.nn as nn
    import torch.nn.functional as F
    _TORCH = True
except ImportError:
    _TORCH = False


# ---------------------------------------------------------------------------
# Graph primitives
# ---------------------------------------------------------------------------

class NodeType(enum.IntEnum):
    HOST          = 0
    PROCESS       = 1
    FILE          = 2
    NETWORK_CONN  = 3
    USER          = 4
    REGISTRY_KEY  = 5


class EdgeType(enum.IntEnum):
    CREATED      = 0
    MODIFIED     = 1
    CONNECTED_TO = 2
    EXECUTED     = 3
    AUTHENTICATED= 4
    READ         = 5
    WROTE        = 6


@dataclass
class GraphEvent:
    """A directed edge in the entity-event graph."""
    timestamp:   float
    src_node_id: str
    dst_node_id: str
    edge_type:   EdgeType
    features:    Dict = field(default_factory=dict)


class EventGraph:
    """
    Maintains a set of entities (nodes) and directed events (edges).

    Node features are a fixed-length vector:
      [node_type_onehot(6), event_count_norm, is_external, degree_norm]
    Total = 6 + 3 = 9 features per node.
    """

    NODE_FEATURE_DIM = 9
    N_NODE_TYPES     = len(NodeType)

    def __init__(self) -> None:
        self._nodes: Dict[str, NodeType] = {}
        self._edges: List[GraphEvent]    = []
        self._edge_count: Dict[str, int] = {}  # node_id → in-degree
        self._external: Dict[str, bool]  = {}

    def add_event(self, event: GraphEvent) -> None:
        """Register an event, auto-creating nodes if they do not exist."""
        for nid, ntype in [
            (event.src_node_id, self._infer_type(event.src_node_id, True)),
            (event.dst_node_id, self._infer_type(event.dst_node_id, False)),
        ]:
            if nid not in self._nodes:
                self._nodes[nid] = ntype
        self._edge_count[event.dst_node_id] = (
            self._edge_count.get(event.dst_node_id, 0) + 1
        )
        self._edges.append(event)

    def _infer_type(self, node_id: str, is_src: bool) -> NodeType:
        """Heuristic type inference from node ID prefix."""
        prefix = node_id.split("_")[0].lower()
        mapping = {
            "host": NodeType.HOST,
            "proc": NodeType.PROCESS,
            "file": NodeType.FILE,
            "net":  NodeType.NETWORK_CONN,
            "user": NodeType.USER,
            "reg":  NodeType.REGISTRY_KEY,
        }
        return mapping.get(prefix, NodeType.PROCESS)

    def node_ids(self) -> List[str]:
        return list(self._nodes.keys())

    def node_feature_matrix(self) -> np.ndarray:
        """Returns (N, NODE_FEATURE_DIM) float32 feature matrix."""
        ids = self.node_ids()
        n   = len(ids)
        if n == 0:
            return np.zeros((0, self.NODE_FEATURE_DIM), dtype=np.float32)

        max_degree = max(self._edge_count.values(), default=1) or 1
        feats = np.zeros((n, self.NODE_FEATURE_DIM), dtype=np.float32)
        for i, nid in enumerate(ids):
            ntype = self._nodes[nid]
            feats[i, ntype] = 1.0                                    # one-hot
            feats[i, 6] = self._edge_count.get(nid, 0) / max_degree  # degree_norm
            feats[i, 7] = 1.0 if self._external.get(nid, False) else 0.0
            feats[i, 8] = min(
                sum(1 for e in self._edges
                    if e.src_node_id == nid or e.dst_node_id == nid) / 50.0,
                1.0
            )
        return feats

    def to_adjacency(self) -> np.ndarray:
        """Returns normalised adjacency matrix (N, N) with self-loops."""
        ids    = self.node_ids()
        n      = len(ids)
        idx    = {nid: i for i, nid in enumerate(ids)}
        adj    = np.eye(n, dtype=np.float32)
        for e in self._edges:
            i = idx.get(e.src_node_id)
            j = idx.get(e.dst_node_id)
            if i is not None and j is not None:
                adj[i, j] = 1.0

        # Symmetric normalisation: D^{-1/2} A D^{-1/2}
        degree = adj.sum(axis=1)
        d_inv_sqrt = np.where(degree > 0, 1.0 / np.sqrt(degree), 0.0)
        return d_inv_sqrt[:, None] * adj * d_inv_sqrt[None, :]

    def __len__(self) -> int:
        return len(self._nodes)

    def clear(self) -> None:
        self._nodes.clear()
        self._edges.clear()
        self._edge_count.clear()
        self._external.clear()


# ---------------------------------------------------------------------------
# GNN model
# ---------------------------------------------------------------------------

@dataclass
class GNNConfig:
    input_dim:  int   = EventGraph.NODE_FEATURE_DIM
    hidden_dim: int   = 64
    output_dim: int   = 32
    n_layers:   int   = 2
    dropout:    float = 0.1


if _TORCH:
    class APTGraphEncoder(nn.Module):
        """
        Simple spectral GCN encoder:
          H^{l+1} = ReLU(Â H^l W^l)
        where Â is the normalised adjacency with self-loops.
        """

        def __init__(self, config: GNNConfig) -> None:
            super().__init__()
            self.config  = config
            dims = [config.input_dim] + [config.hidden_dim] * (config.n_layers - 1) + [config.output_dim]
            self.layers  = nn.ModuleList([
                nn.Linear(dims[i], dims[i + 1]) for i in range(config.n_layers)
            ])
            self.dropout = nn.Dropout(config.dropout)

        def forward(self, node_features: "torch.Tensor", adj: "torch.Tensor") -> "torch.Tensor":
            """
            Parameters
            ----------
            node_features : (N, input_dim) float tensor
            adj           : (N, N) normalised adjacency tensor

            Returns
            -------
            (N, output_dim) per-node embeddings
            """
            h = node_features
            for i, layer in enumerate(self.layers):
                h = torch.mm(adj, h)    # graph aggregation
                h = layer(h)
                if i < len(self.layers) - 1:
                    h = F.relu(h)
                    h = self.dropout(h)
            return h

        def encode_graph(self, graph: EventGraph) -> Dict[str, np.ndarray]:
            """
            Encode an EventGraph → dict[node_id → embedding vector].
            """
            if len(graph) == 0:
                return {}
            feats = torch.tensor(graph.node_feature_matrix(), dtype=torch.float32)
            adj   = torch.tensor(graph.to_adjacency(),        dtype=torch.float32)
            self.eval()
            with torch.no_grad():
                embs = self.forward(feats, adj).numpy()
            return {nid: embs[i] for i, nid in enumerate(graph.node_ids())}

    # -----------------------------------------------------------------------
    # Technique classifier
    # -----------------------------------------------------------------------

    # All technique IDs from the canonical catalogue (imported lazily)
    _TECHNIQUE_IDS: Optional[List[str]] = None

    def _get_technique_ids() -> List[str]:
        global _TECHNIQUE_IDS
        if _TECHNIQUE_IDS is None:
            from .mitre_rules import TECHNIQUE_CATALOGUE
            _TECHNIQUE_IDS = sorted(TECHNIQUE_CATALOGUE.keys())
        return _TECHNIQUE_IDS

    class TechniqueClassifier(nn.Module):
        """
        Takes the mean-pooled graph embedding and outputs technique scores.
        """

        def __init__(self, gnn_config: GNNConfig) -> None:
            super().__init__()
            n_techniques = len(_get_technique_ids())
            self.encoder = APTGraphEncoder(gnn_config)
            self.head    = nn.Sequential(
                nn.Linear(gnn_config.output_dim, gnn_config.hidden_dim),
                nn.ReLU(),
                nn.Linear(gnn_config.hidden_dim, n_techniques),
                nn.Sigmoid(),
            )

        def forward(self, feats: "torch.Tensor", adj: "torch.Tensor") -> "torch.Tensor":
            node_embs  = self.encoder(feats, adj)                # (N, out_dim)
            graph_emb  = node_embs.mean(dim=0, keepdim=True)    # (1, out_dim)
            return self.head(graph_emb).squeeze(0)               # (n_techniques,)

        def score_techniques(self, graph: EventGraph) -> Dict[str, float]:
            """
            Returns a dict technique_id → score in [0, 1].
            Returns zeros if the graph is empty.
            """
            if len(graph) == 0:
                return {tid: 0.0 for tid in _get_technique_ids()}

            feats = torch.tensor(graph.node_feature_matrix(), dtype=torch.float32)
            adj   = torch.tensor(graph.to_adjacency(),        dtype=torch.float32)
            self.eval()
            with torch.no_grad():
                scores = self.forward(feats, adj).numpy()

            return {
                tid: float(scores[i])
                for i, tid in enumerate(_get_technique_ids())
            }

else:
    # Fallback stub when torch is not available
    class APTGraphEncoder:  # type: ignore[no-redef]
        def __init__(self, config: GNNConfig) -> None:
            self.config = config
        def encode_graph(self, graph: EventGraph) -> Dict[str, np.ndarray]:
            return {nid: np.zeros(self.config.output_dim) for nid in graph.node_ids()}

    class TechniqueClassifier:  # type: ignore[no-redef]
        def __init__(self, gnn_config: GNNConfig) -> None:
            self.gnn_config = gnn_config
        def score_techniques(self, graph: EventGraph) -> Dict[str, float]:
            from .mitre_rules import TECHNIQUE_CATALOGUE
            return {tid: 0.0 for tid in TECHNIQUE_CATALOGUE}
