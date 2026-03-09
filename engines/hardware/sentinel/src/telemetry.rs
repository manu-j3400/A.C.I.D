// telemetry.rs — NVML-backed GPU telemetry sampler.
//
// Polls power draw, memory clock, and SM utilization at sub-millisecond
// resolution to build a high-frequency time-series for FFT analysis.
// All NVML handles are held for the lifetime of GpuPoller to avoid the
// per-call overhead of device re-enumeration.

use anyhow::{Context, Result};
use nvml_wrapper::{
    enum_wrappers::device::Clock,
    Nvml,
};

/// A single instantaneous telemetry snapshot from the GPU.
#[derive(Debug, Clone)]
pub struct GpuSample {
    /// Monotonic timestamp in microseconds (from std::time::Instant epoch).
    pub timestamp_us:        u64,
    /// GPU board power draw in milliwatts.
    pub power_mw:            u32,
    /// Memory bus clock in MHz.
    pub mem_clock_mhz:       u32,
    /// Streaming Multiprocessor utilization (0–100).
    pub sm_utilization_pct:  u32,
    /// Memory controller utilization (0–100).
    pub mem_utilization_pct: u32,
    /// GPU core temperature in degrees Celsius.
    pub temperature_c:       u32,
}

/// Long-lived GPU polling handle.
///
/// Initializing NVML is expensive (~50 ms on first call); create one
/// GpuPoller per GPU and re-use it for the entire daemon lifetime.
pub struct GpuPoller {
    nvml:         Nvml,
    device_index: u32,
    /// Monotonic clock reference captured at construction time.
    /// All sample timestamps are expressed relative to this instant.
    epoch:        std::time::Instant,
}

impl GpuPoller {
    /// Initialize NVML and validate that `device_index` is accessible.
    pub fn new(device_index: u32) -> Result<Self> {
        let nvml = Nvml::init().context("NVML initialization failed. \
            Ensure NVIDIA drivers are installed and the process has sufficient permissions.")?;

        // Eagerly probe the device so we fail fast on bad index.
        let count = nvml.device_count()
            .context("Failed to enumerate NVML devices")?;
        if device_index >= count {
            anyhow::bail!(
                "GPU device index {device_index} is out of range. \
                 NVML reports {count} device(s)."
            );
        }

        let device = nvml.device_by_index(device_index)
            .with_context(|| format!("Cannot open GPU device {device_index}"))?;
        let name = device.name().unwrap_or_else(|_| "<unknown>".into());
        tracing::info!(device = device_index, name = %name, "NVML device opened");

        Ok(Self {
            nvml,
            device_index,
            epoch: std::time::Instant::now(),
        })
    }

    /// Take a single telemetry snapshot.
    ///
    /// This call is designed for tight-loop polling at sub-millisecond rates.
    /// NVML read latency is typically 30–100 µs per metric on modern drivers.
    pub fn sample(&self) -> Result<GpuSample> {
        let device = self.nvml.device_by_index(self.device_index)
            .context("NVML device handle invalidated")?;

        let power_mw            = device.power_usage()
            .context("power_usage() failed")?;
        let mem_clock_mhz       = device.clock_info(Clock::Memory)
            .context("clock_info(Memory) failed")?;
        let utilization         = device.utilization_rates()
            .context("utilization_rates() failed")?;
        let temperature_c       = device.temperature(
                nvml_wrapper::enum_wrappers::device::TemperatureSensor::Gpu,
            ).context("temperature() failed")?;

        let timestamp_us = self.epoch.elapsed().as_micros() as u64;

        Ok(GpuSample {
            timestamp_us,
            power_mw,
            mem_clock_mhz,
            sm_utilization_pct:  utilization.gpu,
            mem_utilization_pct: utilization.memory,
            temperature_c,
        })
    }

    /// Poll the NVML performance state (P0 = max performance, P12 = idle).
    /// Useful for correlating anomalies with power-state transitions.
    pub fn perf_state(&self) -> Result<u32> {
        let device = self.nvml.device_by_index(self.device_index)?;
        let state  = device.performance_state()?;
        Ok(state as u32)
    }
}
