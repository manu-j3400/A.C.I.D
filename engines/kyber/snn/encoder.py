"""
Engine 3: SNN Micro-Temporal Profiler — Semantic Multi-Channel Encoder
=======================================================================

Replaces the naive encode_rate() single-channel replication with a
SemanticEncoder that assigns each of the 8 LIF input channels a distinct,
interpretable meaning derived from the raw ExecutionEvent stream.

Channel map
-----------
  0  call      event firing rate   — high → deeply recursive / DLL-loader style
  1  line      event firing rate   — high → tight computation / eval loop
  2  return    event firing rate   — asymmetric call/return → exception-driven flow
  3  exception event firing rate   — high → try/except obfuscation trick
  4  rate derivative (Δtotal/Δt)   — acceleration → payload startup burst signature
  5  rolling burst indicator       — σ²_local > τ → silence/explosion pattern
  6  silence fraction              — fraction of zero-activity bins in local window
  7  normalized execution phase    — t/T → payloads often fire late

Design notes
------------
  - All channels are normalized to [0, 1] independently so the LIF neurons
    operate in a consistent input range regardless of code length.
  - Channels 0-3 are computed by binning each event type separately then
    applying the same sliding-window smoothing as the original encode_rate().
  - Channel 4 (derivative) uses a central difference on the total rate signal.
  - Channel 5 (burst) computes local variance of the total-rate signal over a
    configurable window (default = 20 bins); values > τ=0.1 are clipped to 1.
  - Channel 6 (silence) is the fraction of bins in a local window that are
    exactly 0 in the total-rate signal.
  - Channel 7 (phase) is a deterministic linspace; it carries no noise and
    gives the LIF layer positional context.
"""

from __future__ import annotations

from typing import List, Optional

import numpy as np

from .telemetry import ExecutionEvent, SpikeTrain


# ---------------------------------------------------------------------------
# SemanticEncoder
# ---------------------------------------------------------------------------

_EVENT_TYPES = ("call", "line", "return", "exception")
N_CHANNELS = 8


class SemanticEncoder:
    """
    Converts a list of ExecutionEvent objects into an (T, 8) float32 tensor
    suitable for feeding into the LIFNetwork.

    Parameters
    ----------
    window_bins     Width of the smoothing window applied to each per-type
                    rate channel (channels 0-3). Wider = smoother signal.
    burst_window    Width of the local variance window for the burst channel (5).
    silence_window  Width of the local silence-fraction window for channel 6.
    burst_threshold Variance level above which the burst indicator saturates to 1.
    """

    def __init__(
        self,
        window_bins:     int   = 16,
        burst_window:    int   = 20,
        silence_window:  int   = 20,
        burst_threshold: float = 0.1,
    ) -> None:
        self.window_bins     = window_bins
        self.burst_window    = burst_window
        self.silence_window  = silence_window
        self.burst_threshold = burst_threshold

    # ------------------------------------------------------------------
    # Public API
    # ------------------------------------------------------------------

    def encode(
        self,
        events:      List[ExecutionEvent],
        n_timesteps: int,
        bin_size_us: float = 10.0,
    ) -> np.ndarray:
        """
        Encode a raw event list into an (n_timesteps, 8) float32 array.

        Parameters
        ----------
        events       Raw events from ExecutionHook._events.
        n_timesteps  Number of output time steps T (matches LIFConfig.n_timesteps).
        bin_size_us  Bin width in microseconds for the initial histogramming step.

        Returns
        -------
        (T, 8) float32 array with values in [0, 1].
        """
        if not events:
            return np.zeros((n_timesteps, N_CHANNELS), dtype=np.float32)

        total_dur = events[-1].timestamp_us + bin_size_us
        n_raw_bins = max(1, int(np.ceil(total_dur / bin_size_us)))

        # --- Channels 0-3: per-event-type binary bins ---
        type_bins: dict[str, np.ndarray] = {}
        for etype in _EVENT_TYPES:
            bins = np.zeros(n_raw_bins, dtype=np.float32)
            for ev in events:
                if ev.event_type == etype:
                    idx = min(int(ev.timestamp_us / bin_size_us), n_raw_bins - 1)
                    bins[idx] = 1.0
            type_bins[etype] = bins

        # Total activity (union of all types)
        total_bins = np.zeros(n_raw_bins, dtype=np.float32)
        for ev in events:
            idx = min(int(ev.timestamp_us / bin_size_us), n_raw_bins - 1)
            total_bins[idx] = 1.0

        # --- Smooth channels 0-3 with sliding-window kernel ---
        kernel   = np.ones(self.window_bins, dtype=np.float32) / self.window_bins
        smoothed = {
            etype: np.convolve(type_bins[etype], kernel, mode="same")
            for etype in _EVENT_TYPES
        }

        # --- Smooth total for derivative, burst, silence channels ---
        total_smooth = np.convolve(total_bins, kernel, mode="same")

        # --- Channel 4: rate derivative (central difference) ---
        deriv = np.gradient(total_smooth.astype(np.float64)).astype(np.float32)

        # --- Channel 5: rolling burst indicator (local variance) ---
        burst = self._rolling_variance(total_smooth, self.burst_window)

        # --- Channel 6: silence fraction (fraction of 0 bins in window) ---
        silence = self._rolling_silence(total_bins, self.silence_window)

        # --- Resample all signals to n_timesteps ---
        src_x = np.arange(n_raw_bins, dtype=np.float64)
        dst_x = np.linspace(0, n_raw_bins - 1, n_timesteps)

        def resample(arr: np.ndarray) -> np.ndarray:
            return np.interp(dst_x, src_x, arr.astype(np.float64)).astype(np.float32)

        ch0 = resample(smoothed["call"])
        ch1 = resample(smoothed["line"])
        ch2 = resample(smoothed["return"])
        ch3 = resample(smoothed["exception"])
        ch4 = resample(deriv)
        ch5 = resample(burst)
        ch6 = resample(silence)

        # --- Channel 7: normalized execution phase (deterministic) ---
        ch7 = np.linspace(0.0, 1.0, n_timesteps, dtype=np.float32)

        # --- Stack and normalize each channel to [0, 1] ---
        out = np.stack([ch0, ch1, ch2, ch3, ch4, ch5, ch6, ch7], axis=1)  # (T, 8)
        out = self._normalize_channels(out)
        return out

    # ------------------------------------------------------------------
    # Private helpers
    # ------------------------------------------------------------------

    @staticmethod
    def _rolling_variance(signal: np.ndarray, window: int) -> np.ndarray:
        """
        Compute local variance of *signal* using a sliding window of width *window*.
        Returns float32 array of same length, normalized to [0, 1] via saturation.
        """
        n     = len(signal)
        out   = np.zeros(n, dtype=np.float32)
        half  = window // 2
        for i in range(n):
            lo = max(0, i - half)
            hi = min(n, i + half + 1)
            out[i] = float(np.var(signal[lo:hi]))
        # Normalize: variance saturates at burst_threshold → 1.0
        # (done externally via _normalize_channels)
        return out

    @staticmethod
    def _rolling_silence(binary_signal: np.ndarray, window: int) -> np.ndarray:
        """
        Fraction of bins in a local window that are zero (silence fraction).
        Returns float32 array in [0, 1].
        """
        n    = len(binary_signal)
        out  = np.zeros(n, dtype=np.float32)
        half = window // 2
        for i in range(n):
            lo = max(0, i - half)
            hi = min(n, i + half + 1)
            w  = hi - lo
            out[i] = float(np.sum(binary_signal[lo:hi] == 0)) / w
        return out

    @staticmethod
    def _normalize_channels(arr: np.ndarray) -> np.ndarray:
        """
        Normalize each channel (column) independently to [0, 1].
        Channels that are all-zero (no activity) remain zero.
        """
        out = arr.copy()
        for c in range(arr.shape[1]):
            col_min = arr[:, c].min()
            col_max = arr[:, c].max()
            span    = col_max - col_min
            if span > 1e-9:
                out[:, c] = (arr[:, c] - col_min) / span
            # else: all-same → leave as-is (already 0 or normalized)
        return np.clip(out, 0.0, 1.0)


# ---------------------------------------------------------------------------
# Convenience function — drop-in replacement for encode_rate()
# ---------------------------------------------------------------------------

_default_encoder = SemanticEncoder()


def encode_semantic(
    spike_train: SpikeTrain,
    events:      List[ExecutionEvent],
    n_timesteps: int,
    n_features:  int = N_CHANNELS,
    encoder:     Optional[SemanticEncoder] = None,
) -> np.ndarray:
    """
    Drop-in replacement for telemetry.encode_rate() that uses the full
    semantic 8-channel encoding.

    Parameters
    ----------
    spike_train  SpikeTrain from ExecutionHook.to_spike_train() (used only
                 for bin_size_us metadata).
    events       Raw event list from ExecutionHook._events.
    n_timesteps  Output time steps T.
    n_features   Must be 8 (or omitted). Kept for API compatibility.
    encoder      Optional pre-configured SemanticEncoder. Uses a module-level
                 default if None.

    Returns
    -------
    (n_timesteps, 8) float32 array in [0, 1].
    """
    if n_features != N_CHANNELS:
        raise ValueError(
            f"encode_semantic produces {N_CHANNELS} channels; got n_features={n_features}. "
            "Update LIFConfig.n_inputs = 8."
        )
    enc = encoder or _default_encoder
    return enc.encode(events, n_timesteps, bin_size_us=spike_train.bin_size_us)
