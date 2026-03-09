"""
Siamese GCN — Dual CFG Builder
================================

Builds two parallel Control Flow Graphs from the same Python source:

  Source CFG  — derived from the Python AST (compile-time structure)
  Bytecode CFG — derived from dis.get_instructions() (runtime structure)

Both CFGs are converted to torch_geometric Data objects with a fixed
64-dimensional node feature vector so they can pass through the same
shared GCN encoder.

Node feature schema (64 dims, both graph types)
------------------------------------------------
  dims  0–49   one-hot over semantic node category  (50 categories)
  dims 50–55   structural scalars                   (6 values)
  dims 56–63   padding / reserved                   (8 zeros)

AST node categories (50 groups):
  Statement, Expression, Assignment, FunctionDef, ClassDef, Import,
  Return, If, For, While, Try, With, Call, Attribute, Subscript,
  BinOp, UnaryOp, Compare, BoolOp, Constant, Name, List, Dict, Set,
  Tuple, Comprehension, Lambda, Yield, Await, AsyncDef, Raise, Assert,
  Delete, Global, Nonlocal, Pass, Break, Continue, Module, ...

Bytecode opcode categories (50 groups — mapped from ~160 opcodes):
  LOAD, STORE, DELETE, BINARY, INPLACE, UNARY, COMPARE, BUILD,
  CALL, RETURN, JUMP_FORWARD, JUMP_BACK, POP_JUMP_TRUE, POP_JUMP_FALSE,
  FOR_ITER, EXCEPT, IMPORT, MAKE_FUNCTION, LOAD_CLOSURE, FORMAT, ...
"""

from __future__ import annotations

import ast
import dis
import hashlib
from dataclasses import dataclass, field
from typing import Dict, List, Optional, Tuple

import networkx as nx
import numpy as np
import torch
from torch_geometric.data import Data
from torch_geometric.utils import from_networkx


# ---------------------------------------------------------------------------
# Constants
# ---------------------------------------------------------------------------

NODE_FEATURE_DIM = 64
N_CATEGORY_DIMS  = 50    # one-hot
N_SCALAR_DIMS    = 6     # structural scalars

# ---------------------------------------------------------------------------
# AST node type → category index  (50 categories, index 0–49)
# ---------------------------------------------------------------------------

_AST_CATEGORY: Dict[type, int] = {
    ast.Module: 0,       ast.FunctionDef: 1,   ast.AsyncFunctionDef: 2,
    ast.ClassDef: 3,     ast.Return: 4,        ast.Delete: 5,
    ast.Assign: 6,       ast.AugAssign: 7,     ast.AnnAssign: 8,
    ast.For: 9,          ast.AsyncFor: 10,     ast.While: 11,
    ast.If: 12,          ast.With: 13,         ast.AsyncWith: 14,
    ast.Raise: 15,       ast.Try: 16,          ast.TryStar: 17,
    ast.Assert: 18,      ast.Import: 19,       ast.ImportFrom: 20,
    ast.Global: 21,      ast.Nonlocal: 22,     ast.Expr: 23,
    ast.Pass: 24,        ast.Break: 25,        ast.Continue: 26,
    ast.BoolOp: 27,      ast.NamedExpr: 28,    ast.BinOp: 29,
    ast.UnaryOp: 30,     ast.Lambda: 31,       ast.IfExp: 32,
    ast.Dict: 33,        ast.Set: 34,          ast.ListComp: 35,
    ast.SetComp: 36,     ast.DictComp: 37,     ast.GeneratorExp: 38,
    ast.Await: 39,       ast.Yield: 40,        ast.YieldFrom: 41,
    ast.Compare: 42,     ast.Call: 43,         ast.FormattedValue: 44,
    ast.JoinedStr: 45,   ast.Constant: 46,     ast.Attribute: 47,
    ast.Subscript: 48,   ast.Name: 49,
    # Overflow → 49 (Name catches all unrecognized nodes)
}

# ---------------------------------------------------------------------------
# Bytecode opcode → category index  (50 categories, index 0–49)
# ---------------------------------------------------------------------------

_OPCODE_TO_CATEGORY: Dict[str, int] = {}

def _register_opcodes() -> None:
    """Map all ~160 CPython opcodes to 50 semantic categories."""
    mapping = [
        (0,  ["LOAD_FAST", "LOAD_NAME", "LOAD_GLOBAL", "LOAD_DEREF",
               "LOAD_CLASSDEREF", "LOAD_SUPER_ATTR", "COPY_FREE_VARS"]),
        (1,  ["STORE_FAST", "STORE_NAME", "STORE_GLOBAL", "STORE_DEREF",
               "STORE_ATTR", "STORE_SUBSCR"]),
        (2,  ["DELETE_FAST", "DELETE_NAME", "DELETE_GLOBAL", "DELETE_DEREF",
               "DELETE_ATTR", "DELETE_SUBSCR"]),
        (3,  ["BINARY_OP", "BINARY_SUBSCR"]),
        (4,  ["INPLACE_OP"]),
        (5,  ["UNARY_NEGATIVE", "UNARY_POSITIVE", "UNARY_INVERT", "UNARY_NOT",
               "GET_ITER", "GET_YIELD_FROM_ITER"]),
        (6,  ["COMPARE_OP", "IS_OP", "CONTAINS_OP"]),
        (7,  ["BUILD_TUPLE", "BUILD_LIST", "BUILD_SET", "BUILD_MAP",
               "BUILD_CONST_KEY_MAP", "BUILD_SLICE", "BUILD_STRING"]),
        (8,  ["CALL", "CALL_FUNCTION_EX", "PRECALL", "PUSH_NULL",
               "CALL_INTRINSIC_1", "CALL_INTRINSIC_2"]),
        (9,  ["RETURN_VALUE", "RETURN_CONST"]),
        (10, ["JUMP_FORWARD", "JUMP_BACKWARD", "JUMP_BACKWARD_NO_INTERRUPT",
               "JUMP_IF_NOT_EXC_MATCH"]),
        (11, ["POP_JUMP_IF_TRUE", "POP_JUMP_IF_NONE", "POP_JUMP_IF_NOT_NONE"]),
        (12, ["POP_JUMP_IF_FALSE"]),
        (13, ["FOR_ITER", "END_FOR"]),
        (14, ["SETUP_WITH", "BEFORE_WITH"]),
        (15, ["PUSH_EXC_INFO", "POP_EXCEPT", "RAISE_VARARGS", "RERAISE",
               "CHECK_EXC_MATCH"]),
        (16, ["IMPORT_NAME", "IMPORT_FROM", "IMPORT_STAR"]),
        (17, ["MAKE_FUNCTION", "SET_FUNCTION_ATTRIBUTE"]),
        (18, ["MAKE_CELL", "COPY_FREE_VARS", "LOAD_CLOSURE"]),
        (19, ["FORMAT_VALUE", "CONVERT_VALUE"]),
        (20, ["POP_TOP", "ROT_TWO", "ROT_THREE", "ROT_FOUR", "ROT_N",
               "DUP_TOP", "DUP_TOP_TWO", "COPY", "SWAP"]),
        (21, ["LOAD_ATTR", "LOAD_METHOD"]),
        (22, ["NOP", "RESUME", "CACHE"]),
        (23, ["YIELD_VALUE", "GET_AWAITABLE", "GET_AITER", "GET_ANEXT",
               "END_ASYNC_FOR"]),
        (24, ["SEND", "ASYNC_GEN_WRAP"]),
        (25, ["LIST_TO_TUPLE", "LIST_EXTEND", "SET_UPDATE", "DICT_UPDATE",
               "DICT_MERGE"]),
        (26, ["GET_LEN", "MATCH_MAPPING", "MATCH_SEQUENCE", "MATCH_KEYS",
               "MATCH_CLASS"]),
        (27, ["SETUP_CLEANUP", "CLEANUP_THROW", "POP_BLOCK"]),
        (28, ["LOAD_FAST_CHECK", "LOAD_FAST_AND_CLEAR"]),
        (29, ["INSTRUMENTED_RESUME", "INSTRUMENTED_RETURN_VALUE",
               "INSTRUMENTED_CALL", "INSTRUMENTED_LINE",
               "INSTRUMENTED_JUMP_FORWARD", "INSTRUMENTED_JUMP_BACKWARD"]),
    ]
    for cat_idx, opcodes in mapping:
        for op in opcodes:
            _OPCODE_TO_CATEGORY[op] = cat_idx
    # Unknown opcodes → category 49
_register_opcodes()


# ---------------------------------------------------------------------------
# Data type
# ---------------------------------------------------------------------------

@dataclass
class CFGNode:
    """A basic block in the control flow graph."""
    node_id:        int
    features:       np.ndarray      # (NODE_FEATURE_DIM,) float32
    label:          str             # human-readable type label (for debugging)
    source_lines:   Tuple[int, int] # (start_line, end_line) — (0,0) for bytecode


@dataclass
class ControlFlowGraph:
    """
    Directed graph of basic blocks.

    Nodes are CFGNode objects; edges represent control flow (with/without conditions).
    Both AST-derived and bytecode-derived CFGs use this type.
    """
    nodes:    Dict[int, CFGNode]        = field(default_factory=dict)
    edges:    List[Tuple[int, int]]     = field(default_factory=list)
    source_hash: str                    = ""

    def to_pyg_data(self) -> Data:
        """Convert to torch_geometric.data.Data for GCN processing."""
        if not self.nodes:
            # Empty graph — return single dummy node
            return Data(
                x             = torch.zeros(1, NODE_FEATURE_DIM, dtype=torch.float32),
                edge_index    = torch.empty(2, 0, dtype=torch.long),
                num_nodes     = 1,
            )

        node_ids  = sorted(self.nodes.keys())
        id_to_idx = {nid: i for i, nid in enumerate(node_ids)}

        x = torch.tensor(
            np.stack([self.nodes[nid].features for nid in node_ids]),
            dtype=torch.float32,
        )   # (num_nodes, NODE_FEATURE_DIM)

        if self.edges:
            src = [id_to_idx[u] for u, v in self.edges if u in id_to_idx and v in id_to_idx]
            dst = [id_to_idx[v] for u, v in self.edges if u in id_to_idx and v in id_to_idx]
            edge_index = torch.tensor([src, dst], dtype=torch.long)
        else:
            edge_index = torch.empty(2, 0, dtype=torch.long)

        return Data(x=x, edge_index=edge_index, num_nodes=len(node_ids))


# ---------------------------------------------------------------------------
# Feature vector construction helpers
# ---------------------------------------------------------------------------

def _make_feature(
    category_idx: int,
    n_children:   int   = 0,
    depth:        int   = 0,
    block_size:   int   = 1,
    stack_effect: int   = 0,
    is_jump:      int   = 0,
) -> np.ndarray:
    """Build the 64-dim node feature vector."""
    vec = np.zeros(NODE_FEATURE_DIM, dtype=np.float32)
    # One-hot category
    idx = min(category_idx, N_CATEGORY_DIMS - 1)
    vec[idx] = 1.0
    # Scalar features (log-scaled to avoid domination)
    vec[N_CATEGORY_DIMS + 0] = float(np.log1p(n_children))
    vec[N_CATEGORY_DIMS + 1] = float(np.log1p(depth))
    vec[N_CATEGORY_DIMS + 2] = float(np.log1p(block_size))
    vec[N_CATEGORY_DIMS + 3] = float(np.clip(stack_effect, -5, 5) / 5.0)
    vec[N_CATEGORY_DIMS + 4] = float(is_jump)
    vec[N_CATEGORY_DIMS + 5] = 0.0   # reserved
    return vec


# ---------------------------------------------------------------------------
# AST → CFG
# ---------------------------------------------------------------------------

class ASTCFGBuilder:
    """
    Builds a Control Flow Graph from a Python source string via the AST.

    Each statement in the function body becomes a node. Control flow
    constructs (if/for/while/try) generate multiple nodes with branching edges.
    """

    def build(self, source: str) -> ControlFlowGraph:
        try:
            tree = ast.parse(source)
        except SyntaxError as e:
            raise ValueError(f"Syntax error in source: {e}") from e

        cfg = ControlFlowGraph(
            source_hash=hashlib.sha256(source.encode()).hexdigest()[:16]
        )
        self._node_counter = 0
        self._cfg = cfg

        # Build a node for every AST node (not just statements)
        self._visit_tree(tree, depth=0, parent_id=None)
        return cfg

    def _next_id(self) -> int:
        nid = self._node_counter
        self._node_counter += 1
        return nid

    def _visit_tree(
        self,
        node:      ast.AST,
        depth:     int,
        parent_id: Optional[int],
    ) -> int:
        """Recursively add AST nodes to the CFG and return this node's ID."""
        node_type = type(node)
        cat_idx   = _AST_CATEGORY.get(node_type, N_CATEGORY_DIMS - 1)
        n_children = len(list(ast.iter_child_nodes(node)))

        # Source line information
        start_line = getattr(node, "lineno", 0)
        end_line   = getattr(node, "end_lineno", start_line)

        features = _make_feature(
            category_idx = cat_idx,
            n_children   = n_children,
            depth        = depth,
        )
        nid = self._next_id()
        self._cfg.nodes[nid] = CFGNode(
            node_id     = nid,
            features    = features,
            label       = node_type.__name__,
            source_lines= (start_line, end_line),
        )

        if parent_id is not None:
            self._cfg.edges.append((parent_id, nid))

        for child in ast.iter_child_nodes(node):
            self._visit_tree(child, depth + 1, nid)

        return nid


# ---------------------------------------------------------------------------
# Bytecode → CFG
# ---------------------------------------------------------------------------

class BytecodeCFGBuilder:
    """
    Builds a Control Flow Graph from compiled Python bytecode using dis.

    Each basic block (maximal sequence of instructions with no internal
    jumps or jump targets) becomes a node. Jumps create edges.

    Only works on Python source that can be compiled without import errors.
    """

    def build(self, source: str) -> ControlFlowGraph:
        try:
            code_obj = compile(source, "<string>", "exec")
        except SyntaxError as e:
            raise ValueError(f"Compile error: {e}") from e

        cfg = ControlFlowGraph(
            source_hash=hashlib.sha256(source.encode()).hexdigest()[:16]
        )
        self._build_from_code(code_obj, cfg)
        return cfg

    def _build_from_code(self, code_obj, cfg: ControlFlowGraph) -> None:
        """Process a code object and all nested code objects (functions, classes)."""
        instructions = list(dis.get_instructions(code_obj))
        if not instructions:
            return

        # Identify basic block boundaries:
        # A new block starts at: (1) offset 0, (2) any jump target, (3) after a jump
        jump_targets: set[int] = set()
        for instr in instructions:
            if instr.argval is not None and instr.opname.startswith(("JUMP", "POP_JUMP", "FOR_ITER")):
                if isinstance(instr.argval, int):
                    jump_targets.add(instr.argval)

        # Partition instructions into basic blocks
        blocks:    List[List[dis.Instruction]] = []
        current:   List[dis.Instruction] = []
        for instr in instructions:
            if instr.offset in jump_targets and current:
                blocks.append(current)
                current = []
            current.append(instr)
            if instr.opname.startswith(("JUMP", "POP_JUMP", "RETURN", "RAISE")):
                blocks.append(current)
                current = []
        if current:
            blocks.append(current)

        # Create CFG nodes for each block
        offset_to_block_id: Dict[int, int] = {}
        node_id_base = len(cfg.nodes)

        for i, block in enumerate(blocks):
            nid = node_id_base + i
            offset_to_block_id[block[0].offset] = nid

            # Aggregate opcode categories for this block
            categories = [
                _OPCODE_TO_CATEGORY.get(instr.opname, 49)
                for instr in block
            ]
            # Use the most frequent category as the representative
            cat_counts = np.bincount(categories, minlength=N_CATEGORY_DIMS)
            dominant_cat = int(np.argmax(cat_counts))

            # Stack effect of the entire block
            stack_eff = sum(
                dis.stack_effect(instr.opcode, instr.arg)
                for instr in block
                if instr.arg is not None
            )

            has_jump = any(
                instr.opname.startswith(("JUMP", "POP_JUMP", "FOR_ITER"))
                for instr in block
            )

            features = _make_feature(
                category_idx = dominant_cat,
                block_size   = len(block),
                stack_effect = stack_eff,
                is_jump      = int(has_jump),
            )
            cfg.nodes[nid] = CFGNode(
                node_id      = nid,
                features     = features,
                label        = block[0].opname,
                source_lines = (0, 0),
            )

        # Connect blocks via edges
        for i, block in enumerate(blocks):
            nid = node_id_base + i
            last = block[-1]

            # Fallthrough edge (sequential execution)
            if i + 1 < len(blocks) and not last.opname.startswith(("RETURN", "RAISE")):
                cfg.edges.append((nid, node_id_base + i + 1))

            # Jump edges
            if last.opname.startswith(("JUMP", "POP_JUMP", "FOR_ITER")):
                target_offset = last.argval
                if isinstance(target_offset, int) and target_offset in offset_to_block_id:
                    cfg.edges.append((nid, offset_to_block_id[target_offset]))

        # Recurse into nested code objects (inner functions, lambdas, comprehensions)
        for const in code_obj.co_consts:
            if hasattr(const, "co_code"):
                self._build_from_code(const, cfg)
