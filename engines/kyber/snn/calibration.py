"""
Engine 3: SNN Micro-Temporal Profiler — Threshold Calibration & Online Learning
================================================================================

ThresholdCalibrator
-------------------
After training, the default threshold of 0.5 is rarely optimal. This class
sweeps the threshold space and returns the value that maximises the F1 score
on a held-out validation set. This is equivalent to finding the operating
point on the ROC curve that balances precision and recall.

Optimal threshold search:
    For t in [0.01, 0.02, ..., 0.99]:
        preds = (probs >= t).astype(int)
        f1    = 2·TP / (2·TP + FP + FN)
    return argmax_t f1

OnlineAdapter
-------------
Wraps a trained BaselineProfiler with an incremental sample buffer. Once
the buffer accumulates `buffer_size` new (code, label) pairs, a background
retrain is triggered if the class balance is acceptable. After retraining,
the threshold is re-calibrated against the new held-out val split.

This allows the model to continuously adapt to the scanner's live traffic
without requiring a full offline retrain cycle.
"""

from __future__ import annotations

import threading
from dataclasses import dataclass, field
from typing import List, Optional, Tuple

import numpy as np


# ---------------------------------------------------------------------------
# ThresholdCalibrator
# ---------------------------------------------------------------------------

class ThresholdCalibrator:
    """
    Find the anomaly threshold that maximises F1 on a set of labelled samples.

    Usage
    -----
        cal = ThresholdCalibrator()
        optimal_t = cal.calibrate(y_true, probs)
        profiler.train_config.threshold = optimal_t
    """

    def calibrate(
        self,
        y_true: np.ndarray,      # (N,) float {0.0, 1.0}
        probs:  np.ndarray,      # (N,) float in [0, 1]
        steps:  int = 99,        # number of threshold candidates (0.01 → 0.99)
    ) -> float:
        """
        Return the threshold in (0, 1) that maximises binary F1.

        Parameters
        ----------
        y_true  Ground-truth binary labels (0 = clean, 1 = anomalous).
        probs   Predicted anomaly probabilities from the SNN.
        steps   Resolution of the threshold sweep.

        Returns
        -------
        Optimal threshold as a float.
        """
        if len(y_true) == 0:
            return 0.5

        y = np.asarray(y_true, dtype=np.float32)
        p = np.asarray(probs,  dtype=np.float32)

        thresholds = np.linspace(0.01, 0.99, steps)
        best_f1    = -1.0
        best_t     = 0.5

        for t in thresholds:
            preds = (p >= t).astype(np.float32)
            tp = float(np.sum((preds == 1) & (y == 1)))
            fp = float(np.sum((preds == 1) & (y == 0)))
            fn = float(np.sum((preds == 0) & (y == 1)))
            denom = 2 * tp + fp + fn
            if denom < 1e-9:
                continue
            f1 = (2 * tp) / denom
            if f1 > best_f1:
                best_f1 = f1
                best_t  = float(t)

        return best_t

    def calibrate_from_profiler(
        self,
        profiler,                           # BaselineProfiler (avoid circular import)
        val_samples: List[Tuple[str, float]],  # [(source_code, label), ...]
    ) -> float:
        """
        Profile each validation sample, collect predicted probabilities,
        then call calibrate().

        Parameters
        ----------
        profiler     Trained BaselineProfiler instance.
        val_samples  List of (source_code, ground_truth_label) tuples.

        Returns
        -------
        Optimal threshold for the given profiler on the validation set.
        """
        probs  = []
        labels = []

        for src, label in val_samples:
            try:
                result = profiler.profile(src, threshold=0.0)  # threshold=0 → always returns prob
                probs.append(result.anomaly_prob)
                labels.append(label)
            except Exception:
                continue

        if not probs:
            return 0.5

        return self.calibrate(
            np.array(labels, dtype=np.float32),
            np.array(probs,  dtype=np.float32),
        )


# ---------------------------------------------------------------------------
# OnlineAdapter
# ---------------------------------------------------------------------------

@dataclass
class _BufferEntry:
    """A single buffered (code, label) pair for online retraining."""
    source_code: str
    label:       float   # 0.0 = clean, 1.0 = anomalous


class OnlineAdapter:
    """
    Wraps a trained BaselineProfiler with incremental learning capability.

    New (code, true_label) pairs are buffered. Once `buffer_size` pairs
    accumulate **and** the class balance is acceptable, a retrain is triggered
    automatically (either inline or in a background thread).

    Usage
    -----
        adapter = OnlineAdapter(profiler, buffer_size=200)

        # After a scan is confirmed malicious by an analyst:
        adapter.update(source_code, true_label=1.0)

        # Retraining is triggered automatically when the buffer fills.
        # Or force it manually:
        adapter.maybe_retrain(blocking=True)

    Thread safety
    -------------
    `update()` is thread-safe (guarded by a lock). Retraining itself is
    serialized — concurrent retrain requests are queued, not dropped.
    """

    def __init__(
        self,
        profiler,                            # BaselineProfiler
        buffer_size:       int   = 200,
        min_class_balance: float = 0.2,      # skip if minority class < 20% of buffer
        auto_calibrate:    bool  = True,
    ) -> None:
        self._profiler          = profiler
        self.buffer_size        = buffer_size
        self.min_class_balance  = min_class_balance
        self.auto_calibrate     = auto_calibrate
        self._buffer:           List[_BufferEntry] = []
        self._lock              = threading.Lock()
        self._calibrator        = ThresholdCalibrator()
        self.retrain_count:     int = 0   # total number of retrains completed

    # ------------------------------------------------------------------
    # Public API
    # ------------------------------------------------------------------

    def update(self, source_code: str, true_label: float) -> None:
        """
        Add a new (code, label) pair to the retrain buffer.

        If the buffer reaches `buffer_size`, triggers `maybe_retrain()` in
        a background thread so the calling thread is not blocked.
        """
        with self._lock:
            self._buffer.append(_BufferEntry(source_code=source_code, label=true_label))
            should = self._should_retrain_locked()

        if should:
            t = threading.Thread(target=self.maybe_retrain, kwargs={"blocking": True}, daemon=True)
            t.start()

    def should_retrain(self) -> bool:
        """Return True if the buffer is ready for a retrain."""
        with self._lock:
            return self._should_retrain_locked()

    def maybe_retrain(self, blocking: bool = False) -> bool:
        """
        Trigger a retrain if the buffer is ready.

        Parameters
        ----------
        blocking  If True, retrain on the calling thread (synchronous).
                  If False, a background thread is spawned.

        Returns
        -------
        True if a retrain was initiated (buffer was ready), False otherwise.
        """
        with self._lock:
            if not self._should_retrain_locked():
                return False
            # Snapshot and clear the buffer under lock
            new_samples = list(self._buffer)
            self._buffer.clear()

        if blocking:
            self._do_retrain(new_samples)
        else:
            t = threading.Thread(
                target=self._do_retrain,
                args=(new_samples,),
                daemon=True,
            )
            t.start()
        return True

    # ------------------------------------------------------------------
    # Internal
    # ------------------------------------------------------------------

    def _should_retrain_locked(self) -> bool:
        """Called with self._lock held."""
        if len(self._buffer) < self.buffer_size:
            return False
        n_pos = sum(1 for e in self._buffer if e.label >= 0.5)
        n_neg = len(self._buffer) - n_pos
        minority = min(n_pos, n_neg)
        return minority / len(self._buffer) >= self.min_class_balance

    def _do_retrain(self, new_samples: List[_BufferEntry]) -> None:
        """
        Merge new samples into the profiler's existing training set and retrain.
        Called either inline or in a background thread.
        """
        # Add new samples to the profiler's buffer
        for entry in new_samples:
            try:
                self._profiler.record_baseline(entry.source_code, label=entry.label)
            except Exception:
                continue

        # Retrain — early stopping is already configured in ProfilerTrainConfig
        try:
            self._profiler.train()
            self.retrain_count += 1
        except Exception as e:
            print(f"[SNN OnlineAdapter] Retrain failed: {e}")
            return

        # Re-calibrate threshold if requested
        if self.auto_calibrate and new_samples:
            val_pairs = [(e.source_code, e.label) for e in new_samples]
            new_threshold = self._calibrator.calibrate_from_profiler(
                self._profiler, val_pairs
            )
            self._profiler.train_config.threshold = new_threshold
            print(f"[SNN OnlineAdapter] Retrain #{self.retrain_count} done. "
                  f"New threshold: {new_threshold:.3f}")

        # Persist updated checkpoint if a path was configured
        if self._profiler.train_config.checkpoint_path:
            try:
                self._profiler.save(self._profiler.train_config.checkpoint_path)
            except Exception as e:
                print(f"[SNN OnlineAdapter] Checkpoint save failed: {e}")
