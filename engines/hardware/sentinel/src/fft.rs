// fft.rs — Power time-series → frequency domain via windowed FFT.
//
// A side-channel attacker deliberately thrashes GPU caches in a repeating
// pattern to leak cryptographic key bits via Flush+Reload or Prime+Probe.
// This pattern appears as a narrow spike at the thrashing frequency in the
// power spectral density (PSD). We detect it by:
//
//   1. Apply a Hann window to reduce spectral leakage.
//   2. Compute a forward FFT on the windowed signal.
//   3. Convert complex amplitudes to a single-sided PSD (W²/Hz).
//   4. Return (frequency, power) pairs for anomaly threshold comparison.
//
// The FFT is computed by `rustfft` which auto-selects Cooley-Tukey or
// Rader's algorithm depending on N. For N = 4096 (a power of 2) this is
// a standard radix-2 FFT: O(N log N).

use rustfft::{num_complex::Complex, FftPlanner};

/// A (frequency_hz, power) pair in the single-sided power spectral density.
#[derive(Debug, Clone, Copy)]
pub struct PsdBin {
    pub freq_hz: f32,
    pub power:   f32,
}

/// Compute the single-sided power spectral density of a real-valued signal.
///
/// # Arguments
/// * `signal`         — slice of N real samples (e.g. GPU power in mW)
/// * `sample_rate_hz` — samples per second (must match actual poll rate)
///
/// # Returns
/// A Vec of N/2+1 `PsdBin` entries covering 0 Hz to the Nyquist frequency.
/// Power is normalized so that `sum(power) ≈ variance(signal)` (Parseval).
pub fn power_spectral_density(signal: &[f32], sample_rate_hz: f32) -> Vec<PsdBin> {
    let n = signal.len();
    if n == 0 {
        return Vec::new();
    }

    // --- Hann window -------------------------------------------------------
    // w(i) = 0.5 · (1 − cos(2π·i / (N−1)))
    // Reduces side-lobe leakage at the cost of a ~1.5-bin frequency resolution
    // penalty. Essential here because cache-thrash signals are narrow-band.
    let window_scale = if n > 1 {
        2.0 * std::f32::consts::PI / (n - 1) as f32
    } else {
        0.0
    };

    let mut buffer: Vec<Complex<f32>> = (0..n)
        .map(|i| {
            let w = 0.5 * (1.0 - (window_scale * i as f32).cos());
            Complex::new(signal[i] * w, 0.0)
        })
        .collect();

    // --- Forward FFT -------------------------------------------------------
    let mut planner = FftPlanner::<f32>::new();
    let fft = planner.plan_fft_forward(n);
    fft.process(&mut buffer);

    // --- Single-sided PSD --------------------------------------------------
    // Normalize by N² so power is independent of window length.
    // Double the non-DC, non-Nyquist bins to account for the folded negative
    // frequencies (conjugate symmetry of a real-valued input's FFT).
    let norm  = (n as f32).powi(2);
    let n_out = n / 2 + 1;
    let freq_res = sample_rate_hz / n as f32;   // Hz per bin

    (0..n_out)
        .map(|k| {
            let raw_power = buffer[k].norm_sqr() / norm;
            let power = if k == 0 || k == n / 2 {
                raw_power           // DC and Nyquist: no doubling
            } else {
                2.0 * raw_power     // fold negative frequencies back in
            };
            PsdBin {
                freq_hz: k as f32 * freq_res,
                power,
            }
        })
        .collect()
}

/// Return the K bins with the highest power, sorted descending by power.
///
/// Used by the anomaly detector to identify dominant frequency components.
pub fn top_power_bins(psd: &[PsdBin], k: usize) -> Vec<PsdBin> {
    let mut bins = psd.to_vec();
    bins.sort_by(|a, b| b.power.partial_cmp(&a.power).unwrap_or(std::cmp::Ordering::Equal));
    bins.truncate(k);
    bins
}

/// Compute the spectral flatness (Wiener entropy) of a PSD.
///
/// A value near 1.0 → white noise (no dominant frequency).
/// A value near 0.0 → tonal signal (one or few strong frequencies).
///
/// Side-channel attacks produce strongly tonal power traces, so spectral
/// flatness is a complementary detection metric to raw power thresholds.
pub fn spectral_flatness(psd: &[PsdBin]) -> f32 {
    if psd.is_empty() {
        return 0.0;
    }

    let powers: Vec<f32> = psd.iter().map(|b| b.power.max(1e-10)).collect();
    let n = powers.len() as f32;

    let log_mean: f32 = powers.iter().map(|p| p.ln()).sum::<f32>() / n;
    let arithmetic_mean: f32 = powers.iter().sum::<f32>() / n;

    if arithmetic_mean == 0.0 {
        return 0.0;
    }

    (log_mean.exp() / arithmetic_mean).clamp(0.0, 1.0)
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::f32::consts::PI;

    #[test]
    fn pure_tone_has_dominant_bin() {
        // A 100 Hz sinusoid sampled at 1 kHz for 1 second.
        let n    = 1024_usize;
        let rate = 1000.0_f32;
        let freq = 100.0_f32;
        let signal: Vec<f32> = (0..n)
            .map(|i| (2.0 * PI * freq * i as f32 / rate).sin())
            .collect();

        let psd     = power_spectral_density(&signal, rate);
        let peaks   = top_power_bins(&psd, 3);
        let flatness = spectral_flatness(&psd);

        // The dominant bin should be very close to 100 Hz.
        let delta = (peaks[0].freq_hz - freq).abs();
        assert!(delta < rate / n as f32 * 2.0,
            "Expected dominant bin near {freq} Hz, got {} Hz", peaks[0].freq_hz);

        // Spectral flatness of a pure tone should be well below 0.5.
        assert!(flatness < 0.5,
            "Expected low spectral flatness for pure tone, got {flatness}");
    }
}
