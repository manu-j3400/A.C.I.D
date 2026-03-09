// main.rs — GPU Side-Channel Sentinel daemon.
//
// Polls GPU power telemetry via NVML at sub-millisecond resolution,
// converts the power time-series to the frequency domain with a windowed FFT,
// and fires structured alerts when a repetitive power signature consistent
// with a cache-thrashing side-channel attack is detected.

mod anomaly;
mod fft;
mod telemetry;

use anomaly::{AnomalyAlert, AnomalyConfig, SideChannelDetector};
use anyhow::Result;
use clap::Parser;
use telemetry::GpuPoller;
use tracing::{error, info};

// ---------------------------------------------------------------------------
// CLI
// ---------------------------------------------------------------------------

#[derive(Parser)]
#[command(
    name    = "gpu-sentinel",
    about   = "GPU side-channel attack detector via NVML power telemetry + FFT",
    version,
)]
struct Cli {
    /// NVML device index to monitor (0 = first GPU).
    #[arg(short = 'd', long, default_value_t = 0)]
    device: u32,

    /// Telemetry poll interval in microseconds.
    /// Default: 500 µs → 2 kHz sample rate.
    /// Minimum practical value is ~100 µs on most NVML driver versions.
    #[arg(long, default_value_t = 500)]
    poll_us: u64,

    /// FFT analysis window size (number of samples). Must be a power of 2.
    #[arg(long, default_value_t = 4096)]
    window: usize,

    /// PSD anomaly power threshold (W²/Hz).
    /// Increase if idle power noise causes false positives on your hardware.
    #[arg(long, default_value_t = 1e-4)]
    threshold: f32,

    /// Spectral flatness threshold (0–1). Signals below this are considered tonal.
    #[arg(long, default_value_t = 0.15)]
    flatness: f32,

    /// Number of consecutive anomalous windows required before firing an alert.
    #[arg(long, default_value_t = 3)]
    consecutive: u32,

    /// Minimum frequency (Hz) to monitor. Below this is thermal noise.
    #[arg(long, default_value_t = 10.0)]
    min_freq: f32,

    /// Optional webhook URL to POST JSON alerts to.
    #[cfg(feature = "webhook")]
    #[arg(long)]
    webhook: Option<String>,

    /// Log level: trace | debug | info | warn | error
    #[arg(long, default_value = "info")]
    log_level: String,
}

// ---------------------------------------------------------------------------
// Entry point
// ---------------------------------------------------------------------------

#[tokio::main]
async fn main() -> Result<()> {
    let cli = Cli::parse();

    tracing_subscriber::fmt()
        .json()
        .with_env_filter(
            tracing_subscriber::EnvFilter::try_new(&cli.log_level)
                .unwrap_or_else(|_| tracing_subscriber::EnvFilter::new("info")),
        )
        .init();

    let sample_rate_hz = 1_000_000.0 / cli.poll_us as f32;

    // Validate window is a power of 2 (not strictly required by rustfft but
    // gives the fastest Cooley-Tukey factorization).
    if !cli.window.is_power_of_two() {
        tracing::warn!(
            window = cli.window,
            "Window size is not a power of 2; FFT will use a slower algorithm."
        );
    }

    let poller = GpuPoller::new(cli.device)?;

    let config = AnomalyConfig {
        window_size:                  cli.window,
        sample_rate_hz,
        psd_threshold:                cli.threshold,
        flatness_threshold:           cli.flatness,
        consecutive_windows_to_alert: cli.consecutive,
        min_suspicious_freq_hz:       cli.min_freq,
        ..Default::default()
    };
    let mut detector = SideChannelDetector::new(config);

    info!(
        device         = cli.device,
        poll_us        = cli.poll_us,
        sample_rate_hz = sample_rate_hz,
        window         = cli.window,
        threshold      = cli.threshold,
        "GPU sentinel active"
    );

    // Nyquist limit: highest detectable frequency.
    info!(
        nyquist_hz = sample_rate_hz / 2.0,
        freq_resolution_hz = sample_rate_hz / cli.window as f32,
        "FFT parameters"
    );

    loop {
        let t_poll_start = std::time::Instant::now();

        match poller.sample() {
            Ok(sample) => {
                if let Some(alert) = detector.push(sample) {
                    dispatch_alert(alert, &cli).await;
                }
            }
            Err(e) => {
                error!(error = %e, "NVML sample failed");
            }
        }

        // Precise sub-millisecond sleep: account for NVML latency so the
        // effective sample rate stays close to the configured poll_us.
        let elapsed = t_poll_start.elapsed();
        let target  = std::time::Duration::from_micros(cli.poll_us);
        if elapsed < target {
            // std::thread::sleep has ~50–100 µs granularity on Linux;
            // for tighter timing a spinwait or HRTIMER could be used.
            tokio::time::sleep(target - elapsed).await;
        }
    }
}

// ---------------------------------------------------------------------------
// Alert dispatch
// ---------------------------------------------------------------------------

async fn dispatch_alert(alert: AnomalyAlert, cli: &Cli) {
    // Always write to stderr as structured JSON.
    match serde_json::to_string_pretty(&alert) {
        Ok(json) => eprintln!("\n[GPU-SENTINEL ALERT]\n{json}\n"),
        Err(e)   => error!(error = %e, "Failed to serialize alert"),
    }

    // Optionally POST to a webhook (e.g. PagerDuty, Slack, internal SIEM).
    #[cfg(feature = "webhook")]
    if let Some(url) = &cli.webhook {
        let url     = url.clone();
        let payload = serde_json::to_string(&alert).unwrap_or_default();
        tokio::spawn(async move {
            let client = reqwest::Client::new();
            match client
                .post(&url)
                .header("Content-Type", "application/json")
                .body(payload)
                .timeout(std::time::Duration::from_secs(5))
                .send()
                .await
            {
                Ok(resp) => tracing::info!(
                    status = resp.status().as_u16(),
                    "Alert webhook delivered"
                ),
                Err(e) => error!(error = %e, "Alert webhook delivery failed"),
            }
        });
    }
}
