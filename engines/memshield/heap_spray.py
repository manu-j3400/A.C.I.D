"""
MemShield Engine — Heap Spray Detector
========================================

Identifies heap-spray and JIT-spraying payloads by looking for the statistical
fingerprints that distinguish crafted exploit buffers from legitimate heap
allocations:

1. **Low Shannon entropy** — spray payloads consist of a repeated "spray
   unit" (NOP sled + shellcode) which dramatically reduces per-buffer entropy
   compared to compiled code or encrypted data.

2. **NOP sled** — the classic x86 NOP (0x90) and Unicode NOP (0x00 0x0C) are
   counted; a ratio above ~10 % is suspicious.

3. **Sliding-window entropy** — even if the overall entropy is acceptable, a
   buffer whose entropy stays uniformly low throughout (no high-entropy
   sub-region) is characteristic of a spray.

4. **Block repetition** — computing how often a fixed-length block (default
   8 bytes) appears more than once; a high repetition ratio signals a copy-loop
   spray primitive.

5. **Size check** — buffers smaller than ``heap_spray_size_threshold`` cannot
   receive a HIGH/CRITICAL rating; small test vectors are down-scored.

Usage
-----
    from engines.memshield.heap_spray import HeapSprayDetector
    from engines.memshield.config import MemShieldConfig

    det = HeapSprayDetector(MemShieldConfig())
    result = det.analyze_buffer(b"\\x90" * 4096 + b"\\xcc" * 12)
    print(result["is_spray"], result["risk"])
"""

from __future__ import annotations

import math
from collections import Counter

import numpy as np

from engines.memshield.config import MemShieldConfig


# ---------------------------------------------------------------------------
# Constants
# ---------------------------------------------------------------------------

# x86 NOP
_X86_NOP = 0x90
# Unicode NOP sled marker (common in browser heap sprays)
_UNICODE_NOP = b"\x00\x0c"
# Default block size for repetition analysis
_DEFAULT_BLOCK = 8


# ---------------------------------------------------------------------------
# HeapSprayDetector
# ---------------------------------------------------------------------------

class HeapSprayDetector:
    """
    Multi-signal heap-spray and JIT-spray detector.

    Parameters
    ----------
    config:
        ``MemShieldConfig`` instance.  The relevant fields are:
        ``heap_spray_entropy_threshold`` and ``heap_spray_size_threshold``.
    """

    def __init__(self, config: MemShieldConfig) -> None:
        self.config = config

    # ------------------------------------------------------------------
    # Public API
    # ------------------------------------------------------------------

    def analyze_buffer(self, data: bytes) -> dict:
        """
        Run all spray heuristics against *data*.

        Returns
        -------
        dict with keys:
          - ``is_spray``: bool verdict
          - ``entropy``: Shannon entropy of the full buffer (bits/byte)
          - ``nop_ratio``: fraction of x86 NOP bytes (0x90)
          - ``unicode_nop_ratio``: fraction of Unicode NOP pairs
          - ``pattern_score``: block-repetition ratio in [0, 1]
          - ``window_entropy_min``: minimum entropy across sliding windows
          - ``size_bytes``: length of the analysed buffer
          - ``risk``: ``"LOW"`` / ``"MEDIUM"`` / ``"HIGH"`` / ``"CRITICAL"``
          - ``signals``: list of triggered heuristic names
        """
        if not data:
            return self._empty_result()

        size = len(data)
        entropy     = self._shannon_entropy(data)
        nop_ratio   = self._detect_nop_sled(data)
        uni_ratio   = self._detect_unicode_nop(data)
        pat_score   = self._detect_repeated_blocks(data, _DEFAULT_BLOCK)
        win_min     = self._sliding_window_entropy(data)

        signals: list[str] = []
        if entropy < self.config.heap_spray_entropy_threshold:
            signals.append("low_entropy")
        if nop_ratio > 0.10:
            signals.append("nop_sled")
        if uni_ratio > 0.05:
            signals.append("unicode_nop_sled")
        if pat_score > 0.40:
            signals.append("block_repetition")
        if win_min < self.config.heap_spray_entropy_threshold:
            signals.append("low_window_entropy")

        risk = self._classify_risk(signals, size)
        is_spray = risk in ("HIGH", "CRITICAL") or len(signals) >= 2

        return {
            "is_spray": is_spray,
            "entropy": round(entropy, 4),
            "nop_ratio": round(nop_ratio, 4),
            "unicode_nop_ratio": round(uni_ratio, 4),
            "pattern_score": round(pat_score, 4),
            "window_entropy_min": round(win_min, 4),
            "size_bytes": size,
            "risk": risk,
            "signals": signals,
        }

    def analyze_hex_string(self, hex_str: str) -> dict:
        """Decode *hex_str* and call :meth:`analyze_buffer`."""
        try:
            data = bytes.fromhex(hex_str.replace(" ", "").replace("\n", ""))
        except ValueError as exc:
            return {"error": f"Invalid hex string: {exc}", **self._empty_result()}
        return self.analyze_buffer(data)

    # ------------------------------------------------------------------
    # Signal extractors
    # ------------------------------------------------------------------

    def _sliding_window_entropy(self, data: bytes, window: int = 256) -> float:
        """
        Compute Shannon entropy over each *window*-byte slice and return the
        minimum observed value.

        A uniformly low minimum across all windows is a reliable spray marker,
        even when the full-buffer entropy might appear borderline.
        """
        if len(data) <= window:
            return self._shannon_entropy(data)

        arr = np.frombuffer(data, dtype=np.uint8)
        n = len(arr)
        step = max(window // 4, 1)  # 75 % overlap
        min_entropy = float("inf")

        for start in range(0, n - window + 1, step):
            chunk = arr[start: start + window]
            e = self._shannon_entropy(bytes(chunk))
            if e < min_entropy:
                min_entropy = e

        return min_entropy if min_entropy != float("inf") else 0.0

    def _detect_nop_sled(self, data: bytes) -> float:
        """
        Return the fraction of bytes equal to the x86 NOP opcode (0x90).

        Legitimate binaries rarely exceed 1–2 %; spray buffers routinely
        exceed 50 %.
        """
        if not data:
            return 0.0
        arr = np.frombuffer(data, dtype=np.uint8)
        return float(np.sum(arr == _X86_NOP)) / len(arr)

    def _detect_unicode_nop(self, data: bytes) -> float:
        """
        Return the fraction of two-byte windows matching the Unicode NOP
        pattern (0x00 0x0C), used in browser/JIT heap sprays.
        """
        if len(data) < 2:
            return 0.0
        count = 0
        for i in range(0, len(data) - 1, 2):
            if data[i: i + 2] == _UNICODE_NOP:
                count += 1
        return count / max(len(data) // 2, 1)

    def _detect_repeated_blocks(self, data: bytes, block_size: int = 8) -> float:
        """
        Measure block-level repetition as a proxy for copy-loop spray
        primitives.

        Splits *data* into non-overlapping *block_size*-byte blocks, counts
        how many appear more than once, and returns the ratio of duplicated
        blocks to total blocks.

        A ratio close to 1.0 means almost the entire buffer is a repeated
        pattern — a strong spray indicator.
        """
        if len(data) < block_size * 2:
            return 0.0

        blocks = [
            data[i: i + block_size]
            for i in range(0, len(data) - block_size + 1, block_size)
        ]
        if not blocks:
            return 0.0

        counts = Counter(blocks)
        duplicated = sum(1 for b, c in counts.items() if c > 1)
        return duplicated / len(counts)

    # ------------------------------------------------------------------
    # Risk classification
    # ------------------------------------------------------------------

    def _classify_risk(self, signals: list[str], size: int) -> str:
        """
        Derive a qualitative risk label from the active signals and buffer size.

        Size cap: buffers below ``heap_spray_size_threshold`` are capped at
        MEDIUM even with multiple signals, because tiny buffers are unlikely to
        constitute an actual heap spray attempt.
        """
        count = len(signals)
        size_ok = size >= self.config.heap_spray_size_threshold

        if count >= 3 and size_ok:
            return "CRITICAL"
        if count >= 2 and size_ok:
            return "HIGH"
        if count >= 2:
            return "MEDIUM"
        if count == 1:
            return "LOW"
        return "LOW"

    # ------------------------------------------------------------------
    # Utilities
    # ------------------------------------------------------------------

    @staticmethod
    def _shannon_entropy(data: bytes) -> float:
        """
        Compute the Shannon entropy of *data* in bits per byte.

        Returns a value in [0.0, 8.0]:
        - 0.0 → all bytes identical (e.g., pure NOP sled)
        - 8.0 → perfectly uniform distribution (e.g., encrypted data)
        """
        if not data:
            return 0.0
        arr = np.frombuffer(data, dtype=np.uint8)
        counts = np.bincount(arr, minlength=256).astype(np.float64)
        probs = counts / counts.sum()
        probs = probs[probs > 0]
        return float(-np.sum(probs * np.log2(probs)))

    @staticmethod
    def _empty_result() -> dict:
        return {
            "is_spray": False,
            "entropy": 0.0,
            "nop_ratio": 0.0,
            "unicode_nop_ratio": 0.0,
            "pattern_score": 0.0,
            "window_entropy_min": 0.0,
            "size_bytes": 0,
            "risk": "LOW",
            "signals": [],
        }
