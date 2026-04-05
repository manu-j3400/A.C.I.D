// calibration.rs — Adaptive per-GPU noise-floor calibration for the sentinel.
//
// Collects `observation_secs` of idle GPU power samples, computes empirical
// PSD statistics, then sets:
//
//   psd_threshold      = noise_mean + k_sigma * noise_std
//   flatness_threshold = max(idle_flatness_mean * 0.5, 0.05)
//
// This adapts automatically to each GPU model (A100, RTX 3090, H100, etc.)
// without requiring hardware-specific config.

use crate::anomaly::AnomalyConfig;
use crate::fft::power_spectral_density;
use crate::telemetry::GpuPoller;
use anyhow::Result;
use serde::Serialize;
use std::time::{Duration, Instant};
use tracing::{info, warn};

// ---------------------------------------------------------------------------
// Calibration parameters
// ---------------------------------------------------------------------------

#[derive(Debug, Clone)]
pub struct CalibrationConfig {
    /// Observation window in seconds (30 s covers a full GPU boost/settle cycle).
    pub observation_secs: u64,
    /// Sigma multiplier: mean + k_sigma * std → P(false positive) ≈ 2.9e-7 at 5σ.
    pub k_sigma:          f32,
    /// Floor to prevent pathologically low thresholds in lab environments.
    pub min_threshold:    f32,
    /// Cap to prevent masking real attacks on unusually noisy power delivery.
    pub max_threshold:    f32,
    /// Optional JSON report output path for auditability.
    pub report_path:      Option<String>,
}

impl Default for CalibrationConfig {
    fn default() -> Self {
        Self {
            observation_secs: 30,
            k_sigma:          5.0,
            min_threshold:    1e-6,
            max_threshold:    1e-1,
            report_path:      None,
        }
    }
}

// ---------------------------------------------------------------------------
// Calibration report
// ---------------------------------------------------------------------------

#[derive(Debug, Clone, Serialize)]
pub struct CalibrationReport {
    pub gpu_device_index:             u32,
    pub observation_secs:             u64,
    pub samples_collected:            usize,
    pub windows_analysed:             usize,
    pub noise_mean:                   f32,
    pub noise_std:                    f32,
    pub k_sigma:                      f32,
    pub raw_threshold:                f32,
    pub calibrated_threshold:         f32,
    pub idle_flatness_mean:           f32,
    pub calibrated_flatness_threshold: f32,
    pub description:                  String,
}

// ---------------------------------------------------------------------------
// Calibration routine
// ---------------------------------------------------------------------------

pub fn calibrate(
    device_index:    u32,
    poller:          &GpuPoller,
    detector_config: &mut AnomalyConfig,
    cal_cfg:         &CalibrationConfig,
) -> Result<CalibrationReport> {
    info!(
        device           = device_index,
        observation_secs = cal_cfg.observation_secs,
        "Starting adaptive noise-floor calibration"
    );

    let mut samples: Vec<f32> = Vec::new();
    let deadline = Instant::now() + Duration::from_secs(cal_cfg.observation_secs);

    while Instant::now() < deadline {
        match poller.sample() {
            Ok(s)  => samples.push(s.power_mw as f32),
            Err(e) => warn!(error = %e, "NVML sample failed during calibration"),
        }
        let poll_dur = Duration::from_micros(
            (1_000_000.0 / detector_config.sample_rate_hz) as u64
        );
        std::thread::sleep(poll_dur);
    }

    let n_samples = samples.len();
    if n_samples < detector_config.window_size {
        warn!(n_samples, window_size = detector_config.window_size,
              "Fewer samples than one FFT window — using default threshold");
        return Ok(CalibrationReport {
            gpu_device_index:             device_index,
            observation_secs:             cal_cfg.observation_secs,
            samples_collected:            n_samples,
            windows_analysed:             0,
            noise_mean:                   detector_config.psd_threshold,
            noise_std:                    0.0,
            k_sigma:                      cal_cfg.k_sigma,
            raw_threshold:                detector_config.psd_threshold,
            calibrated_threshold:         detector_config.psd_threshold,
            idle_flatness_mean:           detector_config.flatness_threshold,
            calibrated_flatness_threshold: detector_config.flatness_threshold,
            description: "Insufficient samples — kept default threshold".into(),
        });
    }

    let wsize       = detector_config.window_size;
    let step        = wsize / 2;
    let min_freq    = detector_config.min_suspicious_freq_hz;
    let sample_rate = detector_config.sample_rate_hz;

    let mut bin_powers:    Vec<f32> = Vec::new();
    let mut flatness_vals: Vec<f32> = Vec::new();
    let mut n_windows = 0usize;
    let mut i = 0;

    while i + wsize <= n_samples {
        let window = &samples[i..i + wsize];
        let psd = power_spectral_density(window, sample_rate);

        bin_powers.extend(psd.iter().filter(|b| b.freq_hz >= min_freq).map(|b| b.power));
        flatness_vals.push(crate::fft::spectral_flatness(&psd));

        i += step;
        n_windows += 1;
    }

    if bin_powers.is_empty() {
        warn!("No bins above min_suspicious_freq_hz — using default threshold");
        return Ok(CalibrationReport {
            gpu_device_index:             device_index,
            observation_secs:             cal_cfg.observation_secs,
            samples_collected:            n_samples,
            windows_analysed:             n_windows,
            noise_mean:                   detector_config.psd_threshold,
            noise_std:                    0.0,
            k_sigma:                      cal_cfg.k_sigma,
            raw_threshold:                detector_config.psd_threshold,
            calibrated_threshold:         detector_config.psd_threshold,
            idle_flatness_mean:           detector_config.flatness_threshold,
            calibrated_flatness_threshold: detector_config.flatness_threshold,
            description: "No bins in band — kept default threshold".into(),
        });
    }

    let n_bins     = bin_powers.len() as f32;
    let noise_mean = bin_powers.iter().sum::<f32>() / n_bins;
    let noise_std  = (bin_powers.iter().map(|p| (p - noise_mean).powi(2)).sum::<f32>() / n_bins).sqrt();

    let raw_threshold        = noise_mean + cal_cfg.k_sigma * noise_std;
    let calibrated_threshold = raw_threshold.max(cal_cfg.min_threshold).min(cal_cfg.max_threshold);

    let idle_flatness_mean = if flatness_vals.is_empty() {
        0.5
    } else {
        flatness_vals.iter().sum::<f32>() / flatness_vals.len() as f32
    };
    let calibrated_flatness = (idle_flatness_mean * 0.5_f32).max(0.05);

    detector_config.psd_threshold      = calibrated_threshold;
    detector_config.flatness_threshold = calibrated_flatness;

    let description = format!(
        "Device #{device_index}: noise_mean={noise_mean:.3e}, noise_std={noise_std:.3e}, \
         k={k}σ → psd_threshold={calibrated_threshold:.3e}, flatness_threshold={calibrated_flatness:.3f}",
        k = cal_cfg.k_sigma,
    );

    info!(
        device               = device_index,
        calibrated_threshold,
        calibrated_flatness,
        windows_analysed     = n_windows,
        "Noise-floor calibration complete"
    );

    let report = CalibrationReport {
        gpu_device_index: device_index,
        observation_secs: cal_cfg.observation_secs,
        samples_collected: n_samples,
        windows_analysed:  n_windows,
        noise_mean,
        noise_std,
        k_sigma: cal_cfg.k_sigma,
        raw_threshold,
        calibrated_threshold,
        idle_flatness_mean,
        calibrated_flatness_threshold: calibrated_flatness,
        description,
    };

    if let Some(ref path) = cal_cfg.report_path {
        match serde_json::to_string_pretty(&report) {
            Ok(json) => {
                if let Err(e) = std::fs::write(path, &json) {
                    warn!(error = %e, path = %path, "Failed to write calibration report");
                } else {
                    info!(path = %path, "Calibration report written");
                }
            }
            Err(e) => warn!(error = %e, "Failed to serialise calibration report"),
        }
    }

    Ok(report)
}
