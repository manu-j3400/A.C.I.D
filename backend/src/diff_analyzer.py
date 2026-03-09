"""
backend/src/diff_analyzer.py

Phase 4: Differential Taint Engine for CI/CD PR Gatekeeping
=============================================================
Compares old vs new Python source, finds delta functions (changed or new),
BFS-traces new source→sink paths, and blocks PRs if new taint paths exist.

torch-free: operates directly on (list[GraphNode], list[GraphEdge]) from
CFGExtractor.extract() — never calls graph_to_pyg() or any torch function.
Because cfg_extractor defers its torch imports, this module works without
PyTorch installed (suitable for lightweight CI environments).

CLI usage:
    python diff_analyzer.py --old old_file.py --new new_file.py [--json]
    # exits with code 1 if blocked, 0 if safe
"""

from __future__ import annotations

import argparse
import ast
import difflib
import json
import sys
from collections import deque
from dataclasses import dataclass, field
from pathlib import Path
from typing import Optional

# Deferred torch is handled inside cfg_extractor; these imports are torch-free.
from cfg_extractor import CFGExtractor, GraphNode, GraphEdge, _SyntheticAST  # type: ignore[import]

# ---------------------------------------------------------------------------
# Source / Sink catalogs
# ---------------------------------------------------------------------------

SOURCE_PATTERNS: set[str] = {
    "request.args",
    "request.form",
    "request.json",
    "request.data",
    "os.environ",
    "os.getenv",
    "sys.argv",
    "input(",
}

SINK_PATTERNS: dict[str, str] = {
    "subprocess.Popen":  "CMD_EXEC",
    "subprocess.call":   "CMD_EXEC",
    "subprocess.run":    "CMD_EXEC",
    "os.system":         "CMD_EXEC",
    "exec(":             "CODE_EXEC",
    "eval(":             "CODE_EXEC",
    "cursor.execute":    "SQL_EXEC",
    "db.execute":        "SQL_EXEC",
}

# Edge types that carry taint (CFG_SEQUENTIAL, CFG_BRANCH_TRUE,
# CFG_BRANCH_FALSE, DATA_DEF_USE)
TAINT_EDGE_TYPES: set[int] = {0, 1, 2, 5}

BLOCKING_SINKS: set[str] = {"CMD_EXEC", "CODE_EXEC", "SQL_EXEC"}


# ---------------------------------------------------------------------------
# Data structures
# ---------------------------------------------------------------------------

@dataclass
class TaintNode:
    node_id:     int
    sem_type:    str
    line_no:     int
    is_source:   bool
    is_sink:     bool
    source_kind: str = ""   # e.g. "request.args"
    sink_kind:   str = ""   # e.g. "CMD_EXEC"


@dataclass
class TaintPath:
    source:              TaintNode
    sink:                TaintNode
    path:                list[TaintNode]
    introduced_in_delta: bool = True


@dataclass
class DiffReport:
    changed_functions: list[str]
    new_taint_paths:   list[TaintPath]
    blocked:           bool
    summary:           str


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _node_text(node: GraphNode) -> str:
    """
    Return a string representation of a graph node's AST for pattern matching.
    Returns empty string for synthetic (ENTRY/EXIT) nodes.
    """
    if isinstance(node.ast_ref, _SyntheticAST):
        return ""
    try:
        return ast.unparse(node.ast_ref)  # type: ignore[arg-type]
    except Exception:
        return ""


def _line_no(node: GraphNode) -> int:
    if isinstance(node.ast_ref, _SyntheticAST):
        return 0
    return getattr(node.ast_ref, "lineno", 0)


# ---------------------------------------------------------------------------
# Parse changed functions
# ---------------------------------------------------------------------------

def parse_changed_functions(
    old_src: str,
    new_src: str,
) -> tuple[dict[str, ast.FunctionDef], dict[str, ast.FunctionDef], list[str]]:
    """
    Compare old and new source at the function level.

    Returns:
        old_funcs : {name: FunctionDef} from old_src
        new_funcs : {name: FunctionDef} from new_src
        delta     : list of function names that are new or changed
    """
    def _parse_funcs(src: str) -> dict[str, ast.FunctionDef]:
        try:
            tree = ast.parse(src)
        except SyntaxError:
            return {}
        return {
            node.name: node
            for node in ast.walk(tree)
            if isinstance(node, (ast.FunctionDef, ast.AsyncFunctionDef))
        }

    old_funcs = _parse_funcs(old_src)
    new_funcs = _parse_funcs(new_src)

    delta: list[str] = []
    for name, new_node in new_funcs.items():
        if name not in old_funcs:
            delta.append(name)  # New function
        else:
            # Changed if unparsed text differs
            old_text = ast.unparse(old_funcs[name])
            new_text = ast.unparse(new_node)
            if old_text != new_text:
                delta.append(name)

    return old_funcs, new_funcs, delta


# ---------------------------------------------------------------------------
# Node classification
# ---------------------------------------------------------------------------

def _classify_nodes(
    nodes: list[GraphNode],
) -> tuple[list[TaintNode], list[TaintNode]]:
    """
    Classify graph nodes into sources and sinks using pattern matching.
    Skips synthetic ENTRY/EXIT nodes.
    """
    sources: list[TaintNode] = []
    sinks:   list[TaintNode] = []

    for gn in nodes:
        text = _node_text(gn)
        if not text:
            continue

        source_kind = next((p for p in SOURCE_PATTERNS if p in text), "")
        sink_kind   = ""
        for pat, kind in SINK_PATTERNS.items():
            if pat in text:
                sink_kind = kind
                break

        if source_kind or sink_kind:
            tn = TaintNode(
                node_id=gn.node_id,
                sem_type=gn.sem_type,
                line_no=_line_no(gn),
                is_source=bool(source_kind),
                is_sink=bool(sink_kind),
                source_kind=source_kind,
                sink_kind=sink_kind,
            )
            if source_kind:
                sources.append(tn)
            if sink_kind:
                sinks.append(tn)

    return sources, sinks


# ---------------------------------------------------------------------------
# BFS taint propagation
# ---------------------------------------------------------------------------

def find_taint_paths(
    nodes: list[GraphNode],
    edges: list[GraphEdge],
    sources: list[TaintNode],
    sinks: list[TaintNode],
) -> list[TaintPath]:
    """
    BFS from each source node over TAINT_EDGE_TYPES edges.
    Returns all source→sink paths found.

    Complexity: O(|V| + |E|) per source — fast for typical function graphs.
    Torch-free: operates entirely on GraphNode/GraphEdge primitives.
    """
    sink_ids: dict[int, TaintNode] = {s.node_id: s for s in sinks}
    source_by_id: dict[int, TaintNode] = {s.node_id: s for s in sources}
    node_by_id: dict[int, GraphNode]   = {n.node_id: n for n in nodes}

    # Build adjacency from taint edges only
    adj: dict[int, list[int]] = {n.node_id: [] for n in nodes}
    for e in edges:
        if e.edge_type in TAINT_EDGE_TYPES:
            adj[e.src].append(e.dst)

    paths: list[TaintPath] = []

    for src_tn in sources:
        # BFS — track path as list of node IDs
        queue: deque[tuple[int, list[int]]] = deque()
        queue.append((src_tn.node_id, [src_tn.node_id]))
        visited: set[int] = {src_tn.node_id}

        while queue:
            cur_id, cur_path = queue.popleft()

            if cur_id in sink_ids and cur_id != src_tn.node_id:
                # Reconstruct TaintNode path
                tn_path = []
                for nid in cur_path:
                    gn = node_by_id.get(nid)
                    if gn is None:
                        continue
                    tn_path.append(TaintNode(
                        node_id=nid,
                        sem_type=gn.sem_type,
                        line_no=_line_no(gn),
                        is_source=(nid in source_by_id),
                        is_sink=(nid in sink_ids),
                        source_kind=source_by_id.get(nid, TaintNode(0, "", 0, False, False)).source_kind,
                        sink_kind=sink_ids.get(nid, TaintNode(0, "", 0, False, False)).sink_kind,
                    ))
                paths.append(TaintPath(
                    source=src_tn,
                    sink=sink_ids[cur_id],
                    path=tn_path,
                    introduced_in_delta=True,
                ))
                continue  # Don't explore beyond the sink

            for nbr in adj.get(cur_id, []):
                if nbr not in visited:
                    visited.add(nbr)
                    queue.append((nbr, cur_path + [nbr]))

    return paths


# ---------------------------------------------------------------------------
# Delta computation
# ---------------------------------------------------------------------------

def compute_delta_paths(
    old_paths: list[TaintPath],
    new_paths: list[TaintPath],
) -> list[TaintPath]:
    """
    Identify taint paths that exist in new_paths but not in old_paths.
    Equivalence by (source_kind, sink_kind) — node IDs are not stable
    across versions.
    """
    old_keys: set[tuple[str, str]] = {
        (p.source.source_kind, p.sink.sink_kind) for p in old_paths
    }
    delta: list[TaintPath] = []
    for p in new_paths:
        key = (p.source.source_kind, p.sink.sink_kind)
        if key not in old_keys:
            p.introduced_in_delta = True
            delta.append(p)
        else:
            p.introduced_in_delta = False
    return delta


# ---------------------------------------------------------------------------
# PR blocking decision
# ---------------------------------------------------------------------------

def should_block_pr(delta_paths: list[TaintPath]) -> bool:
    """Block if any new taint path reaches a high-risk sink."""
    return any(p.sink.sink_kind in BLOCKING_SINKS for p in delta_paths)


# ---------------------------------------------------------------------------
# Main programmatic API
# ---------------------------------------------------------------------------

def _analyze_function(
    func_node: ast.FunctionDef,
) -> list[TaintPath]:
    """Extract CFG+DDG for one function and find taint paths."""
    extractor = CFGExtractor()
    nodes, edges = extractor.extract(func_node)
    sources, sinks = _classify_nodes(nodes)
    if not sources or not sinks:
        return []
    return find_taint_paths(nodes, edges, sources, sinks)


def analyze_diff(old_src: str, new_src: str) -> DiffReport:
    """
    Main programmatic API.

    Compares two Python source strings, finds delta functions,
    traces taint paths in both versions, returns a DiffReport.
    """
    old_funcs, new_funcs, delta_names = parse_changed_functions(old_src, new_src)

    all_new_paths:   list[TaintPath] = []
    all_old_paths:   list[TaintPath] = []

    for name in delta_names:
        new_node = new_funcs.get(name)
        old_node = old_funcs.get(name)

        if new_node:
            all_new_paths.extend(_analyze_function(new_node))
        if old_node:
            all_old_paths.extend(_analyze_function(old_node))

    delta_paths = compute_delta_paths(all_old_paths, all_new_paths)
    blocked     = should_block_pr(delta_paths)

    if not delta_names:
        summary = "No changed or new functions detected."
    elif not delta_paths:
        summary = (
            f"Changed functions: {delta_names}. "
            "No new source→sink taint paths introduced."
        )
    else:
        blocking_paths = [p for p in delta_paths if p.sink.sink_kind in BLOCKING_SINKS]
        safe_paths     = [p for p in delta_paths if p.sink.sink_kind not in BLOCKING_SINKS]
        summary = (
            f"BLOCKED — {len(blocking_paths)} new high-risk taint path(s) detected "
            f"in [{', '.join(delta_names)}]. "
            f"Sink(s): {sorted({p.sink.sink_kind for p in blocking_paths})}. "
            f"Review data flow from user-controlled sources to dangerous sinks."
        )
        if safe_paths:
            summary += f" ({len(safe_paths)} lower-risk path(s) also found.)"

    return DiffReport(
        changed_functions=delta_names,
        new_taint_paths=delta_paths,
        blocked=blocked,
        summary=summary,
    )


# ---------------------------------------------------------------------------
# CLI entry point
# ---------------------------------------------------------------------------

def main() -> None:
    parser = argparse.ArgumentParser(
        description="Differential taint analysis for Python PR review."
    )
    parser.add_argument("--old",  required=True, help="Path to old version of the file")
    parser.add_argument("--new",  required=True, help="Path to new version of the file")
    parser.add_argument("--json", action="store_true", help="Output JSON report to stdout")
    args = parser.parse_args()

    old_src = Path(args.old).read_text(encoding="utf-8", errors="replace")
    new_src = Path(args.new).read_text(encoding="utf-8", errors="replace")

    report = analyze_diff(old_src, new_src)

    if args.json:
        output = {
            "blocked":            report.blocked,
            "summary":            report.summary,
            "changed_functions":  report.changed_functions,
            "new_taint_paths": [
                {
                    "source_kind": p.source.source_kind,
                    "sink_kind":   p.sink.sink_kind,
                    "source_line": p.source.line_no,
                    "sink_line":   p.sink.line_no,
                    "path_length": len(p.path),
                }
                for p in report.new_taint_paths
            ],
        }
        print(json.dumps(output, indent=2))
    else:
        print(f"\n[diff_analyzer] {report.summary}")
        if report.new_taint_paths:
            print(f"\nNew taint paths ({len(report.new_taint_paths)}):")
            for i, p in enumerate(report.new_taint_paths, 1):
                flag = " *** BLOCKED ***" if p.sink.sink_kind in BLOCKING_SINKS else ""
                print(
                    f"  {i}. {p.source.source_kind} (line {p.source.line_no}) "
                    f"→ {p.sink.sink_kind} (line {p.sink.line_no}){flag}"
                )

    sys.exit(1 if report.blocked else 0)


if __name__ == "__main__":
    main()
