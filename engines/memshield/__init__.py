"""
MemShield — Memory-Exploit Detection Engine (#13)
==================================================

MemShield uses dynamic taint tracking and multi-signal heuristic analysis to
detect memory-exploitation techniques at the binary and source-code level:

  - **Heap spray** detection via entropy, NOP-sled, and block-repetition signals
  - **ROP chain** detection via gadget density and chain-length scoring
  - **Taint tracking** from untrusted sources (network, file, env) to dangerous
    sinks (exec, eval, system, deserialize) in Python/C source strings

The engine is intentionally dependency-light (stdlib + numpy) and is safe to
import in the middleware without spawning sub-processes or touching real memory.

Quick start
-----------
    from engines.memshield import MemShieldAnalyzer, MemShieldConfig

    cfg = MemShieldAnalyzer()
    report = cfg.analyze({"hex_data": "90" * 1024 + "c3c3c3c3c3"})
    print(report["verdict"])

Exported symbols
----------------
``MemShieldConfig``
    Dataclass holding all tunable thresholds for the three sub-systems.

``TaintTracker``
    Symbolic taint-propagation engine (source → sink graph walk).

``ROPChainDetector``
    ROP gadget scanner for raw binary / hex-encoded payloads.

``HeapSprayDetector``
    Multi-signal heap-spray and JIT-spray detector.

``MemShieldAnalyzer``
    Top-level orchestrator — routes payloads through all sub-detectors and
    returns a unified risk report.
"""

from engines.memshield.analyzer import MemShieldAnalyzer
from engines.memshield.config import MemShieldConfig
from engines.memshield.heap_spray import HeapSprayDetector
from engines.memshield.rop_detector import ROPChainDetector
from engines.memshield.taint_tracker import TaintTracker

__all__ = [
    "MemShieldConfig",
    "TaintTracker",
    "ROPChainDetector",
    "HeapSprayDetector",
    "MemShieldAnalyzer",
]
