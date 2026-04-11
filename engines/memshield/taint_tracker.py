"""
MemShield Engine — Taint Tracker
==================================

Implements a lightweight, graph-based taint-propagation engine that tracks
untrusted data from well-known *sources* (user input, network sockets, files,
environment variables, shared memory) through assignment chains to dangerous
*sinks* (exec, eval, write, send, system, deserialize).

The tracker operates on a symbolic register file (a plain dict of named
variables) rather than actual memory, making it safe to run inside the
middleware without spawning sub-processes or touching real memory.

For code-string analysis the module uses Python's ``ast`` module to walk the
AST of submitted snippets and infer taint flow from the structure alone —
no execution is required.

Usage
-----
    from engines.memshield.taint_tracker import TaintTracker, TaintSource

    tt = TaintTracker(max_depth=10)
    tt.mark_tainted("user_buf", TaintSource.NETWORK_RECV)
    tt.propagate("decoded", "user_buf", operation="decode")
    result = tt.reaches_sink("decoded", "exec")
    # {"reaches": True, "path": ["user_buf", "decoded"], "source": <TaintSource.NETWORK_RECV>}
"""

from __future__ import annotations

import ast
import re
from dataclasses import dataclass, field
from enum import Enum, auto
from typing import Any, Optional


# ---------------------------------------------------------------------------
# Public enumerations / data types
# ---------------------------------------------------------------------------

class TaintSource(Enum):
    """Known origins of untrusted data."""
    USER_INPUT   = auto()
    FILE_READ    = auto()
    NETWORK_RECV = auto()
    ENV_VAR      = auto()
    SHARED_MEM   = auto()


@dataclass
class TaintedValue:
    """
    Represents a value that carries taint from one or more sources.

    Attributes
    ----------
    value:
        Symbolic placeholder (usually the variable name as a string).
    sources:
        Set of ``TaintSource`` origins that contributed to this value.
    depth:
        Number of propagation hops from the original source.
    path:
        Ordered list of variable names traversed to reach this value.
    """
    value: Any
    sources: set = field(default_factory=set)
    depth: int = 0
    path: list = field(default_factory=list)


# ---------------------------------------------------------------------------
# Known sinks
# ---------------------------------------------------------------------------

_SINKS: dict[str, list[str]] = {
    "exec":        ["exec", "execve", "execvp", "popen", "system"],
    "system":      ["system", "os.system", "subprocess.call", "subprocess.run"],
    "write":       ["write", "fwrite", "os.write", "file.write"],
    "send":        ["send", "sendto", "socket.send", "requests.post"],
    "eval":        ["eval", "compile", "exec"],
    "deserialize": ["pickle.loads", "marshal.loads", "yaml.load", "json.loads",
                    "deserialize", "fromstring"],
}

# Heuristic: API call patterns that indicate a named source type
_SOURCE_PATTERNS: list[tuple[str, TaintSource]] = [
    (r"\binput\s*\(",             TaintSource.USER_INPUT),
    (r"\bsys\.argv\b",            TaintSource.USER_INPUT),
    (r"\bargparse\b",             TaintSource.USER_INPUT),
    (r"\bopen\s*\(",              TaintSource.FILE_READ),
    (r"\brecv\s*\(",              TaintSource.NETWORK_RECV),
    (r"\brecvfrom\s*\(",          TaintSource.NETWORK_RECV),
    (r"\bsocket\b",               TaintSource.NETWORK_RECV),
    (r"\bos\.environ\b",          TaintSource.ENV_VAR),
    (r"\bgetenv\s*\(",            TaintSource.ENV_VAR),
    (r"\bshared_memory\b",        TaintSource.SHARED_MEM),
    (r"\bmmap\s*\(",              TaintSource.SHARED_MEM),
]


# ---------------------------------------------------------------------------
# TaintTracker
# ---------------------------------------------------------------------------

class TaintTracker:
    """
    Symbolic taint-propagation engine.

    Parameters
    ----------
    max_depth:
        Maximum propagation hops before a value is treated as clean.
    """

    def __init__(self, max_depth: int = 10) -> None:
        self.max_depth = max_depth
        # Register file: variable name -> TaintedValue
        self._registers: dict[str, TaintedValue] = {}

    # ------------------------------------------------------------------
    # Core API
    # ------------------------------------------------------------------

    def mark_tainted(self, name: str, source: TaintSource) -> TaintedValue:
        """
        Declare *name* as tainted with the given *source*.

        If *name* already exists its source set is extended; otherwise a new
        entry is created at depth 0.
        """
        if name in self._registers:
            self._registers[name].sources.add(source)
            return self._registers[name]
        tv = TaintedValue(value=name, sources={source}, depth=0, path=[name])
        self._registers[name] = tv
        return tv

    def propagate(self, dst: str, src: str,
                  operation: str = "assign") -> Optional[TaintedValue]:
        """
        Propagate taint from *src* to *dst* via *operation*.

        Returns the new ``TaintedValue`` for *dst* if *src* is tainted and
        the depth limit has not been reached, otherwise ``None``.
        """
        if src not in self._registers:
            return None
        parent = self._registers[src]
        if parent.depth >= self.max_depth:
            return None
        tv = TaintedValue(
            value=dst,
            sources=set(parent.sources),
            depth=parent.depth + 1,
            path=parent.path + [dst],
        )
        self._registers[dst] = tv
        return tv

    def is_tainted(self, name: str) -> bool:
        """Return ``True`` if *name* is currently tracked as tainted."""
        return name in self._registers

    def reaches_sink(self, name: str, sink_type: str) -> dict:
        """
        Check whether *name* flows into the named *sink_type*.

        Parameters
        ----------
        name:
            Variable or expression name to check.
        sink_type:
            One of: ``"exec"``, ``"system"``, ``"write"``, ``"send"``,
            ``"eval"``, ``"deserialize"``.

        Returns
        -------
        dict with keys ``reaches`` (bool), ``path`` (list[str]),
        ``source`` (TaintSource | None).
        """
        if name not in self._registers:
            return {"reaches": False, "path": [], "source": None}
        tv = self._registers[name]
        sink_apis = _SINKS.get(sink_type, [])
        # If the variable itself is named after a sink API, treat as reaching
        reaches = any(s in name for s in sink_apis) or bool(sink_apis)
        src = next(iter(tv.sources)) if tv.sources else None
        return {"reaches": reaches, "path": tv.path, "source": src}

    def reset(self) -> None:
        """Clear all taint state."""
        self._registers.clear()

    # ------------------------------------------------------------------
    # Code-string analysis
    # ------------------------------------------------------------------

    def analyze_code_string(self, code: str) -> dict:
        """
        Parse *code* as Python source and infer taint flow from its AST.

        Returns
        -------
        dict with keys:
          - ``tainted_vars``: list of variable names inferred as tainted
          - ``sink_hits``: list of ``{var, sink, path, source}`` dicts
          - ``sources_detected``: list of ``TaintSource`` names found
          - ``risk``: ``"LOW"`` / ``"MEDIUM"`` / ``"HIGH"``
        """
        self.reset()

        # ---- Phase 1: regex-based source detection on raw text ----
        detected_sources: list[TaintSource] = []
        for pattern, src in _SOURCE_PATTERNS:
            if re.search(pattern, code):
                detected_sources.append(src)

        # Assign synthetic taint markers for each detected source
        for i, src in enumerate(detected_sources):
            self.mark_tainted(f"__src_{i}__", src)

        # ---- Phase 2: AST walk to propagate assignments ----
        try:
            tree = ast.parse(code)
        except SyntaxError:
            # Non-Python payload — skip AST phase, report raw regex findings
            return self._build_report(detected_sources, [])

        assignment_map: dict[str, str] = {}
        sink_hits: list[dict] = []

        for node in ast.walk(tree):
            # Track simple assignments: x = <call or name>
            if isinstance(node, ast.Assign):
                for target in node.targets:
                    if isinstance(target, ast.Name):
                        if isinstance(node.value, (ast.Call, ast.Name)):
                            src_name = self._node_to_name(node.value)
                            if src_name:
                                assignment_map[target.id] = src_name

            # Detect calls to known sinks with tainted arguments
            if isinstance(node, ast.Call):
                call_name = self._call_to_name(node)
                for sink_type, sink_apis in _SINKS.items():
                    if any(s in call_name for s in sink_apis):
                        for arg in node.args:
                            arg_name = self._node_to_name(arg)
                            if arg_name and self.is_tainted(arg_name):
                                tv = self._registers[arg_name]
                                src = next(iter(tv.sources), None)
                                sink_hits.append({
                                    "var": arg_name,
                                    "sink": sink_type,
                                    "path": tv.path,
                                    "source": src.name if src else None,
                                })

        # Propagate assignments that stem from tainted roots
        changed = True
        while changed:
            changed = False
            for dst, src in assignment_map.items():
                if not self.is_tainted(dst) and self.is_tainted(src):
                    self.propagate(dst, src, "assign")
                    changed = True

        return self._build_report(detected_sources, sink_hits)

    # ------------------------------------------------------------------
    # Internal helpers
    # ------------------------------------------------------------------

    def _build_report(self, detected_sources: list, sink_hits: list) -> dict:
        tainted_vars = list(self._registers.keys())
        risk = "LOW"
        if sink_hits:
            risk = "HIGH"
        elif tainted_vars:
            risk = "MEDIUM"
        return {
            "tainted_vars": tainted_vars,
            "sink_hits": sink_hits,
            "sources_detected": [s.name for s in set(detected_sources)],
            "risk": risk,
        }

    @staticmethod
    def _node_to_name(node: ast.expr) -> Optional[str]:
        if isinstance(node, ast.Name):
            return node.id
        if isinstance(node, ast.Call):
            return TaintTracker._call_to_name(node)
        return None

    @staticmethod
    def _call_to_name(node: ast.Call) -> str:
        if isinstance(node.func, ast.Name):
            return node.func.id
        if isinstance(node.func, ast.Attribute):
            parts = []
            cur = node.func
            while isinstance(cur, ast.Attribute):
                parts.append(cur.attr)
                cur = cur.value
            if isinstance(cur, ast.Name):
                parts.append(cur.id)
            return ".".join(reversed(parts))
        return ""
