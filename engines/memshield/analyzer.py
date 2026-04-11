"""
MemShield Engine — Top-Level Orchestrator
===========================================

``MemShieldAnalyzer`` is the single entry point for all MemShield analysis.
It accepts a *payload* dict describing a suspicious artifact (code string,
hex-encoded shellcode, or raw bytes) and routes it through the three
sub-detectors:

  1. :class:`~engines.memshield.taint_tracker.TaintTracker`
     — traces untrusted data flow to dangerous sinks in source code.

  2. :class:`~engines.memshield.rop_detector.ROPChainDetector`
     — identifies ROP gadget chains in binary/shellcode buffers.

  3. :class:`~engines.memshield.heap_spray.HeapSprayDetector`
     — flags heap-spray and JIT-spray exploit buffers.

The unified report includes each sub-report plus an aggregate
``overall_risk`` label and human-readable ``verdict``.

Usage
-----
    from engines.memshield.analyzer import MemShieldAnalyzer
    from engines.memshield.config import MemShieldConfig

    analyzer = MemShieldAnalyzer()

    # Analyse a Python code string for taint flow
    report = analyzer.analyze({"code": "x = input(); eval(x)"})

    # Analyse raw shellcode for ROP + heap-spray
    report = analyzer.analyze({"hex_data": "90909090c3c3c3c3"})

    # Save / restore config
    analyzer.save("engines/memshield/memshield.pt")
    analyzer2 = MemShieldAnalyzer.load("engines/memshield/memshield.pt")
"""

from __future__ import annotations

import time
from typing import Optional

from engines.memshield.config import MemShieldConfig
from engines.memshield.heap_spray import HeapSprayDetector
from engines.memshield.rop_detector import ROPChainDetector
from engines.memshield.taint_tracker import TaintTracker

# Risk level ordering — used for aggregation
_RISK_ORDER: dict[str, int] = {
    "LOW": 0,
    "MEDIUM": 1,
    "HIGH": 2,
    "CRITICAL": 3,
}
_ORDER_RISK: dict[int, str] = {v: k for k, v in _RISK_ORDER.items()}


class MemShieldAnalyzer:
    """
    Top-level MemShield orchestrator.

    Parameters
    ----------
    config:
        Optional ``MemShieldConfig``.  A default config is used when omitted.
    """

    def __init__(self, config: Optional[MemShieldConfig] = None) -> None:
        self.config = config or MemShieldConfig()
        self.config.validate()

        self._taint   = TaintTracker(max_depth=self.config.taint_propagation_depth)
        self._rop     = ROPChainDetector(self.config)
        self._spray   = HeapSprayDetector(self.config)

    # ------------------------------------------------------------------
    # Primary analysis entry point
    # ------------------------------------------------------------------

    def analyze(self, payload: dict) -> dict:
        """
        Analyse *payload* with all applicable sub-detectors.

        Payload keys (all optional, but at least one should be present)
        ---------------------------------------------------------------
        ``code``:
            Python source string.  Passed to the taint tracker.
        ``hex_data``:
            Hex-encoded bytes string.  Passed to both the ROP detector
            and the heap-spray detector.
        ``bytes_data``:
            Raw ``bytes`` object.  Passed to both binary detectors.

        Returns
        -------
        dict with keys:
          - ``taint``      : taint-tracker sub-report (or ``None``)
          - ``rop``        : ROP-detector sub-report (or ``None``)
          - ``heap_spray`` : heap-spray sub-report (or ``None``)
          - ``overall_risk``: aggregated risk label
          - ``verdict``    : human-readable verdict string
          - ``analysis_time_ms``: wall-clock time for this call
        """
        t0 = time.monotonic()

        code: Optional[str] = payload.get("code")
        hex_data: Optional[str] = payload.get("hex_data")
        raw_bytes: Optional[bytes] = payload.get("bytes_data")

        # Resolve binary data: prefer raw_bytes, fall back to hex_data
        binary: Optional[bytes] = raw_bytes
        if binary is None and hex_data:
            try:
                binary = bytes.fromhex(hex_data.replace(" ", "").replace("\n", ""))
            except ValueError:
                binary = None

        # ---- Taint tracking ----
        taint_report: Optional[dict] = None
        if code is not None:
            if len(code) > self.config.max_code_size_bytes:
                taint_report = {
                    "error": f"Code exceeds max_code_size_bytes "
                             f"({self.config.max_code_size_bytes})",
                    "risk": "LOW",
                }
            else:
                taint_report = self._taint.analyze_code_string(code)

        # ---- ROP detection ----
        rop_report: Optional[dict] = None
        if binary is not None:
            rop_report = self._rop.scan_bytes(binary)
        elif hex_data is not None and binary is None:
            rop_report = {"error": "Invalid hex_data", **ROPChainDetector._empty_result()}

        # ---- Heap-spray detection ----
        spray_report: Optional[dict] = None
        if binary is not None:
            spray_report = self._spray.analyze_buffer(binary)
        elif hex_data is not None and binary is None:
            spray_report = {"error": "Invalid hex_data", **HeapSprayDetector._empty_result()}

        # ---- Aggregate ----
        risk = self.overall_risk({
            "taint":      taint_report,
            "rop":        rop_report,
            "heap_spray": spray_report,
        })
        verdict = self._build_verdict(risk, taint_report, rop_report, spray_report)
        elapsed_ms = round((time.monotonic() - t0) * 1000, 2)

        return {
            "taint":            taint_report,
            "rop":              rop_report,
            "heap_spray":       spray_report,
            "overall_risk":     risk,
            "verdict":          verdict,
            "analysis_time_ms": elapsed_ms,
        }

    # ------------------------------------------------------------------
    # Risk aggregation
    # ------------------------------------------------------------------

    def overall_risk(self, reports: dict) -> str:
        """
        Return the highest risk level found across all non-None sub-reports.

        Parameters
        ----------
        reports:
            Dict mapping sub-detector name to its report dict.  Each report
            must have a ``"risk"`` key (absent reports are skipped).

        Returns
        -------
        ``"LOW"``, ``"MEDIUM"``, ``"HIGH"``, or ``"CRITICAL"``.
        """
        max_level = 0
        for name, report in reports.items():
            if report is None or "error" in report:
                continue
            level_str = report.get("risk", "LOW")
            max_level = max(max_level, _RISK_ORDER.get(level_str, 0))
        return _ORDER_RISK.get(max_level, "LOW")

    # ------------------------------------------------------------------
    # Persistence (config only — no model weights)
    # ------------------------------------------------------------------

    def save(self, path: Optional[str] = None) -> str:
        """
        Persist the current configuration to *path* (JSON).

        Falls back to ``config.checkpoint_path`` when *path* is ``None``.
        Returns the path written.
        """
        dest = path or self.config.checkpoint_path
        self.config.save(dest)
        return dest

    @classmethod
    def load(cls, path: str) -> "MemShieldAnalyzer":
        """
        Reconstruct a ``MemShieldAnalyzer`` from a config checkpoint.

        Parameters
        ----------
        path:
            Path to a JSON file previously written by :meth:`save`.
        """
        config = MemShieldConfig.load(path)
        return cls(config=config)

    # ------------------------------------------------------------------
    # Internal helpers
    # ------------------------------------------------------------------

    @staticmethod
    def _build_verdict(risk: str, taint: Optional[dict],
                       rop: Optional[dict], spray: Optional[dict]) -> str:
        """
        Build a short human-readable verdict string summarising findings.
        """
        parts: list[str] = []

        if taint and not taint.get("error"):
            hits = taint.get("sink_hits", [])
            if hits:
                sinks = ", ".join({h["sink"] for h in hits})
                parts.append(f"taint flows to sink(s): {sinks}")
            elif taint.get("tainted_vars"):
                parts.append("tainted variables detected")

        if rop and not rop.get("error"):
            if rop.get("is_rop"):
                parts.append(
                    f"ROP chain detected "
                    f"(length={rop['chain_length']}, "
                    f"density={rop['density']:.2f}/100B)"
                )

        if spray and not spray.get("error"):
            if spray.get("is_spray"):
                sigs = ", ".join(spray.get("signals", []))
                parts.append(f"heap spray detected ({sigs})")

        if not parts:
            return f"No exploit indicators found. Risk: {risk}."

        return f"[{risk}] " + "; ".join(parts) + "."
