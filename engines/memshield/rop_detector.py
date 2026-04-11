"""
MemShield Engine — ROP Chain Detector
=======================================

Scans raw bytes or hex-encoded shellcode for Return-Oriented Programming (ROP)
gadgets — short instruction sequences that end with a control-flow transfer
(RET, JMP *reg, CALL *reg).  A high density of such gadgets in a contiguous
buffer is a strong indicator of a crafted ROP chain.

Detection strategy
------------------
1. Slide a 1-byte window over the input and identify bytes matching known
   x86/x86-64 RET/JMP/CALL encodings.
2. Cluster nearby gadgets into candidate chains (gap tolerance: 32 bytes).
3. Score each chain by length and density; emit a risk verdict.

This module intentionally avoids disassembly libraries (capstone, pwntools) to
keep the dependency footprint to stdlib + numpy only.

Usage
-----
    from engines.memshield.rop_detector import ROPChainDetector
    from engines.memshield.config import MemShieldConfig

    det = ROPChainDetector(MemShieldConfig())
    result = det.scan_hex_string("4831c04831db4831c94831d2b03bcd80c3")
    print(result["is_rop"], result["chain_score"])
"""

from __future__ import annotations

import struct
from dataclasses import dataclass, field
from typing import List

import numpy as np

from engines.memshield.config import MemShieldConfig


# ---------------------------------------------------------------------------
# Gadget byte signatures (x86 / x86-64)
# ---------------------------------------------------------------------------

# Each entry: (mask, match, mnemonic, type, instruction_length)
# mask/match applied to single or two-byte windows
_GADGET_SIGS: list[tuple[int, int, str, str, int]] = [
    # Near RET
    (0xFF, 0xC3, "RET",       "ret",  1),
    # RET imm16
    (0xFF, 0xC2, "RETN imm",  "ret",  3),
    # JMP r/m64  (FF /4)
    (0xFF, 0xFF, "JMP r/m",   "jmp",  2),
    # CALL r/m64 (FF /2)
    (0xFF, 0xFF, "CALL r/m",  "call", 2),
    # RETF (far return)
    (0xFF, 0xCB, "RETF",      "ret",  1),
    # IRET / IRETD
    (0xFF, 0xCF, "IRET",      "ret",  1),
]

# Two-byte opcode prefixes that further qualify FF-family gadgets
_FF_MODRM_JMP  = {0xE0, 0xE1, 0xE2, 0xE3, 0xE4, 0xE5, 0xE6, 0xE7}  # JMP r/m
_FF_MODRM_CALL = {0xD0, 0xD1, 0xD2, 0xD3, 0xD4, 0xD5, 0xD6, 0xD7}  # CALL r/m

# Maximum byte gap between two gadgets to consider them part of the same chain
_CHAIN_GAP = 32


# ---------------------------------------------------------------------------
# Data types
# ---------------------------------------------------------------------------

@dataclass
class ROPGadget:
    """
    A single ROP gadget found in a binary buffer.

    Attributes
    ----------
    address:
        Byte offset within the scanned buffer.
    bytes:
        Raw bytes of the gadget instruction.
    mnemonic:
        Human-readable instruction name (e.g., ``"RET"``, ``"JMP r/m"``).
    type:
        Broad category: ``"ret"``, ``"jmp"``, or ``"call"``.
    """
    address: int
    bytes: bytes
    mnemonic: str
    type: str


# ---------------------------------------------------------------------------
# Detector
# ---------------------------------------------------------------------------

class ROPChainDetector:
    """
    Detects ROP gadget chains in raw binary data.

    Parameters
    ----------
    config:
        ``MemShieldConfig`` instance controlling detection thresholds.
    """

    def __init__(self, config: MemShieldConfig) -> None:
        self.config = config

    # ------------------------------------------------------------------
    # Public API
    # ------------------------------------------------------------------

    def scan_bytes(self, data: bytes) -> dict:
        """
        Scan *data* for ROP gadgets and assess chain risk.

        Returns
        -------
        dict with keys:
          - ``gadgets``: list of gadget dicts (address, mnemonic, type)
          - ``chain_score``: float in [0, 1] — higher = more suspicious
          - ``is_rop``: bool verdict
          - ``chain_length``: length of the longest detected chain
          - ``gadget_count``: total gadgets found
          - ``density``: gadgets per 100 bytes
          - ``risk``: ``"LOW"`` / ``"MEDIUM"`` / ``"HIGH"`` / ``"CRITICAL"``
        """
        if not data:
            return self._empty_result()

        gadgets = self._extract_gadgets(data)
        density = self.gadget_density(data)
        chain_len = self._longest_chain(gadgets)
        chain_score = self._compute_chain_score(chain_len, density)
        is_rop = chain_len >= self.config.rop_gadget_threshold
        risk = self.classify_risk(chain_len, density)

        return {
            "gadgets": [
                {"address": g.address, "mnemonic": g.mnemonic, "type": g.type,
                 "bytes": g.bytes.hex()}
                for g in gadgets
            ],
            "chain_score": round(chain_score, 4),
            "is_rop": is_rop,
            "chain_length": chain_len,
            "gadget_count": len(gadgets),
            "density": round(density, 4),
            "risk": risk,
        }

    def scan_hex_string(self, hex_str: str) -> dict:
        """Convenience wrapper: decode *hex_str* then call :meth:`scan_bytes`."""
        try:
            data = bytes.fromhex(hex_str.replace(" ", "").replace("\n", ""))
        except ValueError as exc:
            return {"error": f"Invalid hex string: {exc}", **self._empty_result()}
        return self.scan_bytes(data)

    def gadget_density(self, data: bytes) -> float:
        """
        Return the number of ROP gadgets per 100 bytes of *data*.

        Higher density correlates with crafted shellcode rather than
        legitimate compiled binaries.
        """
        if not data:
            return 0.0
        gadgets = self._extract_gadgets(data)
        return len(gadgets) / max(len(data), 1) * 100

    def classify_risk(self, chain_length: int, density: float) -> str:
        """
        Map (chain_length, density) to a qualitative risk label.

        Thresholds
        ----------
        - CRITICAL : chain >= 10 **or** density >= 5.0
        - HIGH     : chain >= 5  **or** density >= 2.0
        - MEDIUM   : chain >= 2  **or** density >= 0.5
        - LOW      : otherwise
        """
        if chain_length >= 10 or density >= 5.0:
            return "CRITICAL"
        if chain_length >= self.config.rop_gadget_threshold or density >= 2.0:
            return "HIGH"
        if chain_length >= 2 or density >= 0.5:
            return "MEDIUM"
        return "LOW"

    # ------------------------------------------------------------------
    # Internal helpers
    # ------------------------------------------------------------------

    def _extract_gadgets(self, data: bytes) -> list[ROPGadget]:
        """
        Slide over *data* and collect all bytes matching gadget signatures.

        The FF-family opcodes (JMP/CALL r/m) are disambiguated by checking
        the ModR/M byte that follows.
        """
        gadgets: list[ROPGadget] = []
        arr = np.frombuffer(data, dtype=np.uint8)
        n = len(arr)

        for i in range(n):
            b = int(arr[i])

            # Single-byte RET variants
            if b in (0xC3, 0xC2, 0xCB, 0xCF):
                mnemonics = {0xC3: "RET", 0xC2: "RETN imm", 0xCB: "RETF", 0xCF: "IRET"}
                end = min(i + (3 if b == 0xC2 else 1), n)
                gadgets.append(ROPGadget(
                    address=i,
                    bytes=bytes(arr[i:end]),
                    mnemonic=mnemonics[b],
                    type="ret",
                ))

            # FF /4 (JMP r/m) and FF /2 (CALL r/m)
            elif b == 0xFF and i + 1 < n:
                modrm = int(arr[i + 1])
                reg_field = (modrm >> 3) & 0x7
                if reg_field == 4:  # JMP r/m
                    gadgets.append(ROPGadget(
                        address=i,
                        bytes=bytes(arr[i:i+2]),
                        mnemonic="JMP r/m64",
                        type="jmp",
                    ))
                elif reg_field == 2:  # CALL r/m
                    gadgets.append(ROPGadget(
                        address=i,
                        bytes=bytes(arr[i:i+2]),
                        mnemonic="CALL r/m64",
                        type="call",
                    ))

        return gadgets

    def _longest_chain(self, gadgets: list[ROPGadget]) -> int:
        """
        Find the longest contiguous gadget chain (gap <= ``_CHAIN_GAP`` bytes).
        """
        if not gadgets:
            return 0
        addrs = sorted(g.address for g in gadgets)
        best = current = 1
        for i in range(1, len(addrs)):
            if addrs[i] - addrs[i - 1] <= _CHAIN_GAP:
                current += 1
                best = max(best, current)
            else:
                current = 1
        return best

    def _compute_chain_score(self, chain_length: int, density: float) -> float:
        """
        Normalise chain_length and density into a [0, 1] suspicion score.
        Uses a sigmoid-like curve so extreme values saturate at 1.0.
        """
        # Normalise independently and combine
        len_score   = min(chain_length / 20.0, 1.0)
        dens_score  = min(density / 10.0, 1.0)
        return 0.6 * len_score + 0.4 * dens_score

    @staticmethod
    def _empty_result() -> dict:
        return {
            "gadgets": [],
            "chain_score": 0.0,
            "is_rop": False,
            "chain_length": 0,
            "gadget_count": 0,
            "density": 0.0,
            "risk": "LOW",
        }
