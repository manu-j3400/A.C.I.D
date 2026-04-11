"""
MemShield Engine — Configuration
=================================

MemShieldConfig centralises every tunable knob for the three detection
sub-systems (taint tracking, ROP-chain detection, heap-spray detection).
All fields carry production-validated defaults but can be overridden at
construction time or deserialised from a JSON checkpoint.

Usage
-----
    from engines.memshield.config import MemShieldConfig

    cfg = MemShieldConfig(rop_gadget_threshold=3, device="cpu")
"""

from __future__ import annotations

import json
from dataclasses import asdict, dataclass


@dataclass
class MemShieldConfig:
    """
    Top-level configuration for the MemShield memory-exploit detection engine.

    Attributes
    ----------
    taint_propagation_depth:
        Maximum chain length the taint tracker will follow from a source
        through copy/transform operations before treating a value as clean.
        Deeper values improve coverage at the cost of O(depth) graph walks.

    rop_gadget_threshold:
        Minimum number of consecutive ROP gadgets required to raise an
        ``is_rop=True`` verdict.  Short sequences (< 5) commonly appear in
        benign code; raising this reduces false-positives in JIT-heavy runtimes.

    heap_spray_entropy_threshold:
        Shannon entropy (bits/byte) below which a buffer is flagged as a
        potential spray pattern.  Legitimate heap allocations typically
        exhibit entropy > 4.0; crafted NOP sleds and repeated shellcode
        blocks land well below 2.0.

    heap_spray_size_threshold:
        Minimum buffer size (bytes) considered large enough to constitute a
        credible spray attempt.  Buffers smaller than this are still analysed
        but cannot receive a HIGH/CRITICAL rating.

    device:
        Reserved for future neural extensions ("cpu" or "cuda").  All current
        sub-systems are NumPy-only and ignore this field at runtime.

    checkpoint_path:
        File path used by ``MemShieldAnalyzer.save()`` / ``load()`` to
        persist/restore configuration state.

    max_code_size_bytes:
        Hard cap on the length of code strings accepted by the taint tracker.
        Inputs exceeding this limit are rejected before any processing begins
        to prevent resource exhaustion.
    """

    taint_propagation_depth: int = 10
    rop_gadget_threshold: int = 5
    heap_spray_entropy_threshold: float = 0.3
    heap_spray_size_threshold: int = 4096
    device: str = "cpu"
    checkpoint_path: str = "engines/memshield/memshield.pt"
    max_code_size_bytes: int = 1_000_000

    # ------------------------------------------------------------------
    # Serialisation helpers
    # ------------------------------------------------------------------

    def to_dict(self) -> dict:
        """Return a plain dict suitable for JSON serialisation."""
        return asdict(self)

    @classmethod
    def from_dict(cls, data: dict) -> "MemShieldConfig":
        """Reconstruct a config from a previously serialised dict."""
        known = set(cls.__dataclass_fields__.keys())  # type: ignore[attr-defined]
        filtered = {k: v for k, v in data.items() if k in known}
        return cls(**filtered)

    def save(self, path: str) -> None:
        """Persist config to *path* as JSON."""
        with open(path, "w", encoding="utf-8") as fh:
            json.dump(self.to_dict(), fh, indent=2)

    @classmethod
    def load(cls, path: str) -> "MemShieldConfig":
        """Load config from a JSON file produced by :meth:`save`."""
        with open(path, "r", encoding="utf-8") as fh:
            return cls.from_dict(json.load(fh))

    def validate(self) -> None:
        """
        Raise ``ValueError`` for obviously invalid combinations.

        Called automatically by ``MemShieldAnalyzer.__init__``.
        """
        if self.taint_propagation_depth < 1:
            raise ValueError("taint_propagation_depth must be >= 1")
        if self.rop_gadget_threshold < 1:
            raise ValueError("rop_gadget_threshold must be >= 1")
        if not (0.0 <= self.heap_spray_entropy_threshold <= 8.0):
            raise ValueError("heap_spray_entropy_threshold must be in [0.0, 8.0]")
        if self.heap_spray_size_threshold < 0:
            raise ValueError("heap_spray_size_threshold must be non-negative")
        if self.max_code_size_bytes < 1:
            raise ValueError("max_code_size_bytes must be >= 1")
