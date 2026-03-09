// anomaly.rs — Sliding-window frequency-domain anomaly detector.
//
// Detection model
// ---------------
// A side-channel attacker on a shared GPU (multi-tenant cloud) deliberately
// loops a cache-thrash pattern to induce a measurable power fluctuation.
// The attacker's goal: correlate the fluctuation with their own memory
// access timing to reconstruct the victim's AES key schedule or model weights.
//
// The attack signature in the frequency domain:
//   • One or a few narrow spectral peaks at the thrash frequency (10–500 Hz)
//   • Spectral flatness drops sharply (signal becomes tonal)
//   • The peak persists across multiple analysis windows (it's intentional, not transient)
//
// We detect this by:
//   1. Buffer `window_size` power samples in a circular sliding window.
//   2. Run FFT → PSD on each full window.
//   3. Flag windows where any bin in [min_freq, Nyquist] exceeds `psd_threshold`.
//   4. Require `consecutive_windows_to_alert` consecutive flagged windows to
//      fire an alert (reduces false positives from thermal transients).

use crate::fft::{power_spectral_density, spectral_flatness, top_power_bins, PsdBin};
use crate::telemetry::GpuSample;
use serde::Serialize;

/// Detector configuration. All fields have production-tuned defaults.
#[derive(Debug, Clone)]
pub struct AnomalyConfig {
    /// FFT window: number of power samples per analysis frame.
    /// Must be a power of 2 for the most efficient Cooley-Tukey FFT.
    pub window_size: usize,

    /// Actual poll rate passed to `power_spectral_density`.
    /// Must match the `--poll-us` rate used by main.rs.
    pub sample_rate_hz: f32,

    /// PSD power threshold (W²/Hz). Bins exceeding this are suspicious.
    /// Tune based on your GPU's idle power noise floor:
    ///   - A100 idle: ~50 W  → power variance ≈ 1–5 W²  → threshold ≈ 1e-4
    ///   - RTX 3090  idle: ~30 W → threshold ≈ 5e-5
    pub psd_threshold: f32,

    /// Spectral flatness below this value is considered anomalously tonal.
    /// Complement to psd_threshold; catches attacks with distributed-frequency
    /// patterns that individually stay below the power threshold.
    pub flatness_threshold: f32,

    /// Number of consecutive analysis windows that must be anomalous before
    /// an alert fires. Prevents single-window thermal spikes from alerting.
    pub consecutive_windows_to_alert: u32,

    /// Frequency (Hz) below which spectral bins are ignored.
    /// Eliminates slow thermal cycles and GPU boost oscillations (< 5 Hz).
    pub min_suspicious_freq_hz: f32,

    /// How many top-power bins to include in the alert payload.
    pub top_bins_reported: usize,
}

impl Default for AnomalyConfig {
    fn default() -> Self {
        Self {
            window_size:                  4096,
            sample_rate_hz:               2000.0,   // 2 kHz (500 µs poll)
            psd_threshold:                1e-4,
            flatness_threshold:           0.15,
            consecutive_windows_to_alert: 3,
            min_suspicious_freq_hz:       10.0,
            top_bins_reported:            5,
        }
    }
}

/// Serializable alert emitted when an anomaly is confirmed.
#[derive(Debug, Clone, Serialize)]
pub struct AnomalyAlert {
    /// Timestamp of the last sample in the triggering window (µs from epoch).
    pub timestamp_us:        u64,
    /// Dominant suspicious frequency in Hz.
    pub dominant_freq_hz:    f32,
    /// PSD power of the dominant bin.
    pub dominant_power:      f32,
    /// Spectral flatness of the window (0 = tonal, 1 = white noise).
    pub spectral_flatness:   f32,
    /// How many consecutive anomalous windows triggered this alert.
    pub consecutive_windows: u32,
    /// Top spectral bins included for forensic analysis.
    pub top_bins:            Vec<BinInfo>,
    /// Human-readable description.
    pub description:         String,
}

/// One (frequency, power) entry in the alert payload.
#[derive(Debug, Clone, Serialize)]
pub struct BinInfo {
    pub freq_hz: f32,
    pub power:   f32,
}

impl From<PsdBin> for BinInfo {
    fn from(b: PsdBin) -> Self {
        Self { freq_hz: b.freq_hz, power: b.power }
    }
}

/// Sliding-window side-channel anomaly detector.
pub struct SideChannelDetector {
    config:      AnomalyConfig,
    /// Circular sample buffer. We push samples in and slide by half a window
    /// (50% overlap) to avoid missing anomalies that straddle window boundaries.
    buffer:      Vec<GpuSample>,
    /// Number of consecutive analysis windows that have been anomalous.
    consec_hits: u32,
}

impl SideChannelDetector {
    pub fn new(config: AnomalyConfig) -> Self {
        let cap = config.window_size * 2;
        Self {
            buffer: Vec::with_capacity(cap),
            config,
            consec_hits: 0,
        }
    }

    /// Ingest one telemetry sample.
    ///
    /// Returns `Some(alert)` exactly when an anomaly crosses the consecutive-
    /// window threshold. Returns `None` otherwise (most calls).
    pub fn push(&mut self, sample: GpuSample) -> Option<AnomalyAlert> {
        self.buffer.push(sample);

        if self.buffer.len() < self.config.window_size {
            return None;
        }

        let result = self.analyze_window();

        // Slide window forward by 50% (overlap = 50%).
        let slide = self.config.window_size / 2;
        self.buffer.drain(..slide);

        result
    }

    // ------------------------------------------------------------------
    // Private analysis
    // ------------------------------------------------------------------

    fn analyze_window(&mut self) -> Option<AnomalyAlert> {
        let window_len = self.config.window_size.min(self.buffer.len());
        let signal: Vec<f32> = self.buffer[..window_len]
            .iter()
            .map(|s| s.power_mw as f32)
            .collect();

        let psd      = power_spectral_density(&signal, self.config.sample_rate_hz);
        let flatness = spectral_flatness(&psd);

        // Filter to the suspicious frequency band.
        let suspicious: Vec<PsdBin> = psd
            .into_iter()
            .filter(|b| {
                b.freq_hz >= self.config.min_suspicious_freq_hz
                    && b.power > self.config.psd_threshold
            })
            .collect();

        let is_tonal    = flatness < self.config.flatness_threshold;
        let has_spikes  = !suspicious.is_empty();

        if has_spikes || is_tonal {
            self.consec_hits += 1;
        } else {
            // Reset streak on a clean window.
            self.consec_hits = 0;
            return None;
        }

        if self.consec_hits < self.config.consecutive_windows_to_alert {
            return None;    // not yet confirmed
        }

        // --- Anomaly confirmed -------------------------------------------
        let top = top_power_bins(&suspicious, self.config.top_bins_reported);
        let dominant = top.first().copied().unwrap_or(PsdBin { freq_hz: 0.0, power: 0.0 });
        let ts = self.buffer.last().map(|s| s.timestamp_us).unwrap_or(0);

        let description = format!(
            "Repetitive GPU power signature detected at {:.1} Hz (PSD={:.2e}). \
             Spectral flatness={:.3} (threshold={:.3}). \
             Sustained over {} consecutive analysis windows. \
             Possible cache-thrashing side-channel attack (Flush+Reload / Prime+Probe).",
            dominant.freq_hz,
            dominant.power,
            flatness,
            self.config.flatness_threshold,
            self.consec_hits,
        );

        tracing::warn!(
            freq_hz     = dominant.freq_hz,
            power       = dominant.power,
            flatness    = flatness,
            consec      = self.consec_hits,
            ts_us       = ts,
            "SIDE-CHANNEL ANOMALY CONFIRMED"
        );

        Some(AnomalyAlert {
            timestamp_us:        ts,
            dominant_freq_hz:    dominant.freq_hz,
            dominant_power:      dominant.power,
            spectral_flatness:   flatness,
            consecutive_windows: self.consec_hits,
            top_bins:            top.into_iter().map(BinInfo::from).collect(),
            description,
        })
    }
}
