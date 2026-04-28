"""
backend/src/entropy_profiler.py

Phase 2: Shannon Entropy Annotation Pass
=========================================
Fast, torch-free pass that flags high-entropy string/bytes literals in
Python source code.  Runs on every /analyze request before ML models.

AST pass order in the full pipeline:
    normalizer_AST → EntropyProfiler → CFGExtractor

NOTE: Do NOT normalize before profiling — normalization destroys the
literal values whose entropy we measure.
"""

from __future__ import annotations

import ast
from dataclasses import dataclass

# shannon_entropy lives in cfg_extractor and has no torch dependency.
# cfg_extractor defers its torch imports to graph_to_pyg(), so this
# import succeeds without PyTorch being installed.
from cfg_extractor import shannon_entropy  # type: ignore[import]

STR_ENTROPY_THRESHOLD: float = 5.0    # bits/byte for str constants
BYTES_ENTROPY_THRESHOLD: float = 6.5  # bits/byte for bytes literals


@dataclass(frozen=True)
class EntropyAnnotation:
    node_type: str        # "Constant_str" | "Constant_bytes" | "Assign" | "JoinedStr"
    entropy: float
    line_no: int
    col_offset: int
    is_anomalous: bool
    literal_preview: str  # repr(value[:40])


class EntropyProfiler(ast.NodeTransformer):
    """
    AST NodeTransformer that annotates nodes with Shannon entropy.

    Attaches ._entropy (float) to each visited node.
    Populates self.annotations with EntropyAnnotation records.

    Usage:
        profiler = EntropyProfiler()
        profiler.visit(ast.parse(source))
        flags = [a for a in profiler.annotations if a.is_anomalous]
    """

    def __init__(self) -> None:
        self.annotations: list[EntropyAnnotation] = []

    def visit_Constant(self, node: ast.Constant) -> ast.Constant:
        self.generic_visit(node)
        v = node.value

        if isinstance(v, str) and len(v) >= 8:
            ent = shannon_entropy(v)
            threshold = STR_ENTROPY_THRESHOLD
            node_type = "Constant_str"
            preview = repr(v[:40])
        elif isinstance(v, bytes) and len(v) >= 4:
            ent = shannon_entropy(v)
            threshold = BYTES_ENTROPY_THRESHOLD
            node_type = "Constant_bytes"
            preview = repr(v[:40])
        else:
            node._entropy = 0.0  # type: ignore[attr-defined]
            return node

        node._entropy = ent  # type: ignore[attr-defined]
        is_anomalous = ent >= threshold
        self.annotations.append(EntropyAnnotation(
            node_type=node_type,
            entropy=ent,
            line_no=getattr(node, "lineno", 0),
            col_offset=getattr(node, "col_offset", 0),
            is_anomalous=is_anomalous,
            literal_preview=preview,
        ))
        return node

    def visit_Assign(self, node: ast.Assign) -> ast.Assign:
        # Visit children first so _entropy attributes are populated
        self.generic_visit(node)

        max_ent = max(
            (getattr(child, "_entropy", 0.0) for child in ast.walk(node)),
            default=0.0,
        )
        node._entropy = max_ent  # type: ignore[attr-defined]

        if max_ent > 0.0:
            is_anomalous = max_ent >= STR_ENTROPY_THRESHOLD
            try:
                preview = repr(ast.unparse(node))[:40]
            except Exception:
                preview = ""
            self.annotations.append(EntropyAnnotation(
                node_type="Assign",
                entropy=max_ent,
                line_no=getattr(node, "lineno", 0),
                col_offset=getattr(node, "col_offset", 0),
                is_anomalous=is_anomalous,
                literal_preview=preview,
            ))
        return node

    def visit_JoinedStr(self, node: ast.JoinedStr) -> ast.JoinedStr:
        # Visit children first
        self.generic_visit(node)

        # Concatenate all constant string parts of the f-string
        parts: list[str] = []
        for child in ast.walk(node):
            if isinstance(child, ast.Constant) and isinstance(child.value, str):
                parts.append(child.value)

        combined = "".join(parts)
        if combined:
            ent = shannon_entropy(combined)
            node._entropy = ent  # type: ignore[attr-defined]
            is_anomalous = ent >= STR_ENTROPY_THRESHOLD
            self.annotations.append(EntropyAnnotation(
                node_type="JoinedStr",
                entropy=ent,
                line_no=getattr(node, "lineno", 0),
                col_offset=getattr(node, "col_offset", 0),
                is_anomalous=is_anomalous,
                literal_preview=repr(combined[:40]),
            ))
        else:
            node._entropy = 0.0  # type: ignore[attr-defined]

        return node


def profile_source(
    source: str,
    tree: "ast.Module | None" = None,
) -> list[EntropyAnnotation]:
    """
    Parse source and run the entropy profiler over the full AST.

    Parameters
    ----------
    source  Raw source string (always required for SyntaxError reporting).
    tree    Optional pre-parsed AST. If supplied, ast.parse() is skipped.
            MUST be parsed from un-normalized source (normalization destroys
            literal values whose entropy we measure).

    Returns all EntropyAnnotation records (both normal and anomalous).
    Safe: returns [] on SyntaxError.
    """
    if tree is None:
        try:
            tree = ast.parse(source)
        except SyntaxError:
            return []
    profiler = EntropyProfiler()
    profiler.visit(tree)
    return profiler.annotations


def get_anomalous_annotations(
    source: str,
    tree: "ast.Module | None" = None,
) -> list[EntropyAnnotation]:
    """
    Convenience wrapper: only annotations above the entropy threshold.
    Returns [] on SyntaxError or clean code.
    """
    return [a for a in profile_source(source, tree=tree) if a.is_anomalous]


# ============================================================================
# Self-test (run as script)
# ============================================================================

if __name__ == "__main__":
    _TEST = '''
def exfiltrate():
    import base64
    # High-entropy base64 payload — should be flagged
    payload = base64.b64decode(
        "aW1wb3J0IHNvY2tldDtzPXNvY2tldC5zb2NrZXQoKTtzLmNvbm5lY3QoKCIxMC4wLjAuMSIsNDQ0NCkp"
    )
    # Normal string — should not be flagged
    greeting = "hello world"
    # High-entropy bytes
    packed = bytes([i for i in range(256)])
    # F-string with low entropy parts
    msg = f"user={greeting} result=ok"
'''

    print("=== Entropy Profiler Self-Test ===\n")
    all_anns = profile_source(_TEST)
    for ann in all_anns:
        marker = "  *** ANOMALOUS ***" if ann.is_anomalous else ""
        print(f"  [{ann.node_type:15s}] line={ann.line_no:3d}  H={ann.entropy:.3f} bits{marker}")
        print(f"    preview: {ann.literal_preview}")

    anomalous = [a for a in all_anns if a.is_anomalous]
    print(f"\nTotal annotations : {len(all_anns)}")
    print(f"Anomalous         : {len(anomalous)}")
    assert len(anomalous) > 0, "Expected at least one anomalous annotation"
    print("\nSelf-test PASSED")
