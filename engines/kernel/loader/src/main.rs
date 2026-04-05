// main.rs — Supply-Chain Sentinel user-space loader.
//
// Lifecycle:
//   1. Validate privileges (CAP_BPF / root required)
//   2. Open + load + attach the compiled BPF skeleton
//   3. Populate the pid_policy_map from a JSON policy file
//   4. Drain the audit ring buffer in a tight poll loop
//   5. Emit structured JSON log lines for each audit event
//   6. On SIGINT/SIGTERM: cleanly detach all probes and exit

mod maps;
mod hotreload;

// The typed skeleton is generated at build time by libbpf-cargo.
// It lives at src/bpf/probe.skel.rs and is included verbatim.
mod bpf {
    include!(concat!(env!("CARGO_MANIFEST_DIR"), "/src/bpf/probe.skel.rs"));
}

use anyhow::{Context, Result};
use clap::Parser;
use libbpf_rs::RingBufferBuilder;
use std::sync::{
    atomic::{AtomicBool, Ordering},
    Arc,
};
use tracing::{error, info, warn};

// ---------------------------------------------------------------------------
// CLI
// ---------------------------------------------------------------------------

#[derive(Parser)]
#[command(name = "supply-chain-sentinel", about = "eBPF-based supply-chain attack blocker")]
struct Cli {
    /// Path to the JSON policy file (PID → authorization bitmask).
    #[arg(short, long, default_value = "/etc/sentinel/policy.json")]
    policy: String,

    /// Ring buffer poll interval in milliseconds.
    #[arg(long, default_value_t = 5)]
    poll_ms: u64,

    /// Log level: trace | debug | info | warn | error
    #[arg(long, default_value = "info")]
    log_level: String,
}

// ---------------------------------------------------------------------------
// Audit event wire layout — must exactly match struct audit_event in probe.bpf.c
// ---------------------------------------------------------------------------

#[repr(C, packed)]
struct AuditEvent {
    timestamp_ns: u64,
    pid:          u32,
    uid:          u32,
    required_cap: u64,
    blocked:      u8,
    _pad:         [u8; 7],
    comm:         [u8; 16],
}

// ---------------------------------------------------------------------------
// Entry point
// ---------------------------------------------------------------------------

fn main() -> Result<()> {
    let cli = Cli::parse();

    // Structured JSON logging (plays well with log aggregators).
    tracing_subscriber::fmt()
        .json()
        .with_env_filter(
            tracing_subscriber::EnvFilter::try_new(&cli.log_level)
                .unwrap_or_else(|_| tracing_subscriber::EnvFilter::new("info")),
        )
        .init();

    // Enforce privilege requirement before touching the kernel.
    if unsafe { libc::geteuid() } != 0 {
        anyhow::bail!(
            "supply-chain-sentinel requires root privileges or CAP_BPF + CAP_SYS_ADMIN. \
             Re-run with sudo or grant the binary the appropriate capabilities."
        );
    }

    info!("Loading BPF skeleton into kernel...");

    let mut builder = bpf::ProbeSkelBuilder::default();
    builder.obj_builder.debug(false);

    let open_skel = builder.open().context("Failed to open BPF object")?;
    let mut skel  = open_skel.load().context("Failed to load BPF object into kernel")?;
    skel.attach().context("Failed to attach BPF programs to LSM + tracepoint hooks")?;

    info!("BPF programs attached. LSM hooks active.");

    // Populate the policy map before any process can be denied incorrectly.
    let policy = maps::load_policy_file(&cli.policy)?;
    {
        let mut bpf_maps = skel.maps_mut();
        maps::populate_pid_policy_map(bpf_maps.pid_policy_map(), &policy)?;
    }
    info!(entries = policy.len(), "Policy loaded. Default-deny posture active.");

    // Populate IP/port allowlist (if rules are defined in policy).
    {
        let mut bpf_maps = skel.maps_mut();
        maps::populate_ip_port_allowlist(
            bpf_maps.ip_port_allowlist(),
            bpf_maps.ip_port_count(),
            &policy,
        )?;
    }

    // Graceful shutdown on SIGINT / SIGTERM.
    let running = Arc::new(AtomicBool::new(true));
    let r = running.clone();
    ctrlc::set_handler(move || {
        warn!("Shutdown signal received — detaching probes...");
        r.store(false, Ordering::SeqCst);
    })
    .context("Failed to register signal handler")?;

    // Spawn inotify hot-reload watcher.
    let reload_rx = hotreload::spawn_policy_watcher(cli.policy.clone(), running.clone())
        .context("Failed to start policy hot-reload watcher")?;

    // Build the ring buffer consumer.
    let mut rb_builder = RingBufferBuilder::new();
    rb_builder
        .add(skel.maps().audit_ringbuf(), handle_audit_event)
        .context("Failed to register ring buffer callback")?;
    let ring = rb_builder.build().context("Failed to build ring buffer")?;

    info!("Sentinel active. Monitoring kernel syscall gate...");

    while running.load(Ordering::SeqCst) {
        ring.poll(std::time::Duration::from_millis(cli.poll_ms))
            .context("Ring buffer poll failed")?;

        // Drain any pending hot-reload events.
        while let Ok(event) = reload_rx.try_recv() {
            let mut bpf_maps = skel.maps_mut();
            if let Err(e) = hotreload::apply_policy_reload(bpf_maps.pid_policy_map(), &event.new_policy) {
                warn!(error = %e, "Failed to apply hot-reloaded PID policy");
            }
            if let Err(e) = maps::clear_ip_port_allowlist(bpf_maps.ip_port_allowlist(), bpf_maps.ip_port_count()) {
                warn!(error = %e, "Failed to clear old IP/port allowlist");
            } else if let Err(e) = maps::populate_ip_port_allowlist(bpf_maps.ip_port_allowlist(), bpf_maps.ip_port_count(), &event.new_policy) {
                warn!(error = %e, "Failed to reload IP/port allowlist");
            }
        }
    }

    info!("Sentinel shut down. All BPF programs detached.");
    Ok(())
}

// ---------------------------------------------------------------------------
// Audit event handler (called from the libbpf ring buffer poll thread)
// ---------------------------------------------------------------------------

fn handle_audit_event(data: &[u8]) -> i32 {
    if data.len() < std::mem::size_of::<AuditEvent>() {
        error!("Received truncated audit event ({} bytes)", data.len());
        return 0;
    }

    // SAFETY: We just verified the buffer is large enough and the struct is
    // repr(C, packed) with the same field layout as the kernel-space definition.
    let ev = unsafe { &*(data.as_ptr() as *const AuditEvent) };

    let comm = core::str::from_utf8(&ev.comm)
        .unwrap_or("<invalid>")
        .trim_end_matches('\0');

    let capability = match ev.required_cap {
        maps::AUTH_NET_CONNECT => "net_connect",
        maps::AUTH_EXEC_SPAWN  => "exec_spawn",
        _                      => "unknown",
    };

    if ev.blocked == 1 {
        warn!(
            ts_ns      = ev.timestamp_ns,
            pid        = ev.pid,
            uid        = ev.uid,
            comm       = %comm,
            capability = %capability,
            verdict    = "BLOCKED",
            "Supply-chain syscall intercepted and denied"
        );
    } else {
        tracing::debug!(
            pid        = ev.pid,
            comm       = %comm,
            capability = %capability,
            verdict    = "ALLOWED",
        );
    }

    0   // return 0 to continue polling
}
