"""
Engine 3: SNN Micro-Temporal Profiler — Execution Telemetry
============================================================

Instruments Python code execution at AST-node granularity and converts
the resulting event stream into a discrete binary spike train.

Instrumentation mechanism
--------------------------
  sys.settrace() installs a per-thread execution hook that receives one
  callback for every:
    - 'call'      — function entry
    - 'line'      — before each new line executes
    - 'return'    — function exit
    - 'exception' — exception raised

The hook records (monotonic_timestamp_us, event_type) pairs. After
execution, the timestamp stream is binned into a binary spike train:

  spike_train[t] = 1  if ≥1 event occurred in time bin t
  spike_train[t] = 0  otherwise

Each bin represents bin_size_us microseconds. A 100ms execution window
at 10µs resolution gives a 10,000-sample spike train.

Security intuition
------------------
  - Clean dependency: regular, periodic firing pattern
  - Obfuscated payload: bursts of activity separated by long silences
    (decryption, unpacking, network probing)
  - Timing anomaly: spikes at unusual intervals that deviate from the
    LIF neuron's trained baseline firing rate
"""

from __future__ import annotations

import sys
import time
import threading
from dataclasses import dataclass, field
from typing import Callable, List, Optional, Tuple

import numpy as np


# ---------------------------------------------------------------------------
# Telemetry data
# ---------------------------------------------------------------------------

@dataclass
class ExecutionEvent:
    """A single trace event from the Python interpreter."""
    timestamp_us: float    # microseconds from execution start
    event_type:   str      # 'call', 'line', 'return', 'exception'
    filename:     str      # source file (may be '<string>')
    lineno:       int      # line number


@dataclass
class SpikeTrain:
    """
    Binary spike train derived from execution telemetry.

    bins         (T,) float32 array. 1.0 if ≥1 event in that bin, else 0.0.
    bin_size_us  Width of each bin in microseconds.
    n_events     Total number of raw execution events captured.
    duration_us  Total recording duration in microseconds.
    firing_rate  Mean spikes per second.
    """
    bins:        np.ndarray      # (T,) float32
    bin_size_us: float
    n_events:    int
    duration_us: float

    @property
    def n_bins(self) -> int:
        return len(self.bins)

    @property
    def firing_rate_hz(self) -> float:
        """Mean firing rate in Hz (spikes per second)."""
        duration_s = self.duration_us / 1_000_000.0
        if duration_s < 1e-9:
            return 0.0
        return float(self.bins.sum()) / duration_s

    @property
    def inter_spike_intervals(self) -> np.ndarray:
        """
        Compute inter-spike intervals (ISI) in bins.

        Returns the array of gaps between consecutive spike bins.
        ISI variance is a key discriminator: low variance = regular firing
        (clean code), high variance = bursty firing (obfuscated payload).
        """
        spike_positions = np.where(self.bins > 0)[0]
        if len(spike_positions) < 2:
            return np.array([], dtype=np.float32)
        return np.diff(spike_positions).astype(np.float32)

    def isi_cv(self) -> float:
        """
        Coefficient of Variation of the ISI distribution.

        CV = std(ISI) / mean(ISI)

        CV ≈ 0 → perfectly regular firing (clock-like, clean code).
        CV ≈ 1 → Poisson-like firing (random events, possible payload).
        CV > 1 → bursty firing (strong temporal clustering, high risk).
        """
        isi = self.inter_spike_intervals
        if len(isi) < 2:
            return 0.0
        mu = float(isi.mean())
        return float(isi.std()) / (mu + 1e-9)

    def to_rate_encoded(self, window_bins: int = 10) -> np.ndarray:
        """
        Convert binary spikes to a rate-encoded signal by sliding window mean.

        Returns a (T,) float32 array of local firing rates in [0, 1].
        Used as the input to the LIF network.
        """
        kernel = np.ones(window_bins, dtype=np.float32) / window_bins
        return np.convolve(self.bins.astype(np.float32), kernel, mode="same")


# ---------------------------------------------------------------------------
# Execution hook
# ---------------------------------------------------------------------------

class ExecutionHook:
    """
    sys.settrace-based execution monitor.

    Thread-safe: installs per-thread trace function so concurrent executions
    don't contaminate each other's telemetry.

    Usage
    -----
        hook = ExecutionHook(max_events=100_000)
        hook.start()
        exec(user_code, {})   # or any Python execution
        hook.stop()
        train = hook.to_spike_train(bin_size_us=10.0)
    """

    def __init__(
        self,
        max_events:    int   = 200_000,    # hard cap to prevent memory explosion
        tracked_files: Optional[List[str]] = None,  # None = track all
    ) -> None:
        self.max_events    = max_events
        self.tracked_files = set(tracked_files) if tracked_files else None
        self._events:      List[ExecutionEvent] = []
        self._start_us:    float = 0.0
        self._lock = threading.Lock()

    # ------------------------------------------------------------------
    # Lifecycle
    # ------------------------------------------------------------------

    def start(self) -> None:
        """Install the trace hook and begin recording."""
        self._events.clear()
        self._start_us = time.perf_counter() * 1_000_000
        sys.settrace(self._trace_dispatch)
        threading.settrace(self._trace_dispatch)

    def stop(self) -> None:
        """Remove the trace hook."""
        sys.settrace(None)
        threading.settrace(None)

    # ------------------------------------------------------------------
    # Trace callback
    # ------------------------------------------------------------------

    def _trace_dispatch(
        self,
        frame,
        event: str,
        arg,
    ) -> Optional[Callable]:
        """Called by the Python interpreter for each trace event."""
        with self._lock:
            if len(self._events) >= self.max_events:
                return None   # detach when cap is reached

            filename = frame.f_code.co_filename
            if self.tracked_files and filename not in self.tracked_files:
                return self._trace_dispatch   # keep tracing but skip this frame

            ts = time.perf_counter() * 1_000_000 - self._start_us
            self._events.append(ExecutionEvent(
                timestamp_us = ts,
                event_type   = event,
                filename     = filename,
                lineno       = frame.f_lineno,
            ))

        return self._trace_dispatch   # return self to continue tracing inner calls

    # ------------------------------------------------------------------
    # Spike train construction
    # ------------------------------------------------------------------

    def to_spike_train(
        self,
        bin_size_us: float          = 10.0,    # 10 µs bins → 100 kHz resolution
        duration_us: Optional[float] = None,   # None = use last event timestamp
    ) -> SpikeTrain:
        """
        Convert the captured event stream into a binary spike train.

        Parameters
        ----------
        bin_size_us   Width of each time bin in microseconds.
        duration_us   Total duration of the recording. If None, uses the
                      timestamp of the last event.

        Returns
        -------
        SpikeTrain with shape (T,) where T = ceil(duration_us / bin_size_us).
        """
        with self._lock:
            events = list(self._events)

        if not events:
            return SpikeTrain(
                bins        = np.zeros(1, dtype=np.float32),
                bin_size_us = bin_size_us,
                n_events    = 0,
                duration_us = 0.0,
            )

        total_dur = duration_us or (events[-1].timestamp_us + bin_size_us)
        n_bins    = max(1, int(np.ceil(total_dur / bin_size_us)))
        bins      = np.zeros(n_bins, dtype=np.float32)

        for ev in events:
            idx = int(ev.timestamp_us / bin_size_us)
            if idx < n_bins:
                bins[idx] = 1.0

        return SpikeTrain(
            bins        = bins,
            bin_size_us = bin_size_us,
            n_events    = len(events),
            duration_us = total_dur,
        )


# ---------------------------------------------------------------------------
# Spike encoding utilities for neural input
# ---------------------------------------------------------------------------

def encode_rate(
    spike_train: SpikeTrain,
    n_timesteps: int,
    n_features:  int = 8,
) -> np.ndarray:
    """
    Encode a spike train as a (T, N) rate-coded input tensor for the LIF network.

    The spike train is resampled to n_timesteps bins and replicated / tiled
    across n_features channels (each channel receives independent Poisson noise
    added to the rate, providing input diversity to the SNN).

    Returns
    -------
    (n_timesteps, n_features) float32 array in [0, 1].
    """
    # Resample to n_timesteps
    rate = spike_train.to_rate_encoded(window_bins=max(1, len(spike_train.bins) // n_timesteps))
    resampled = np.interp(
        np.linspace(0, len(rate) - 1, n_timesteps),
        np.arange(len(rate)),
        rate,
    ).astype(np.float32)

    # Replicate across N feature channels with independent Poisson jitter
    rng = np.random.default_rng(seed=42)
    out = np.stack([
        np.clip(resampled + rng.poisson(0.02, size=n_timesteps).astype(np.float32), 0, 1)
        for _ in range(n_features)
    ], axis=1)   # (T, N)

    return out
