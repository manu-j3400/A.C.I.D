"""
Engine 3: SNN Micro-Temporal Execution Profiler

Imports are split: telemetry/encoder/calibration are always available
(no GPU dependencies). LIF network and profiler require torch + snntorch
and are imported lazily to keep the module loadable without those deps.
"""
from .telemetry import ExecutionHook, SpikeTrain, ExecutionEvent, encode_rate
from .encoder import SemanticEncoder, encode_semantic
from .calibration import ThresholdCalibrator, OnlineAdapter

# Heavy deps — imported lazily; only fail at use time if unavailable
def _lazy_import_network():
    from .lif_network import LIFNetwork, LIFConfig, TemporalAnomalyLoss
    return LIFNetwork, LIFConfig, TemporalAnomalyLoss

def _lazy_import_profiler():
    from .profiler import BaselineProfiler, TemporalAnomalyResult, ProfilerTrainConfig
    return BaselineProfiler, TemporalAnomalyResult, ProfilerTrainConfig

try:
    from .lif_network import LIFNetwork, LIFConfig, TemporalAnomalyLoss
    from .profiler import BaselineProfiler, TemporalAnomalyResult, ProfilerTrainConfig
except ImportError:
    pass  # snntorch/torch unavailable — encoder+calibration still usable

__all__ = [
    "ExecutionHook",
    "SpikeTrain",
    "ExecutionEvent",
    "encode_rate",
    "SemanticEncoder",
    "encode_semantic",
    "LIFNetwork",
    "LIFConfig",
    "TemporalAnomalyLoss",
    "BaselineProfiler",
    "TemporalAnomalyResult",
    "ProfilerTrainConfig",
    "ThresholdCalibrator",
    "OnlineAdapter",
]
