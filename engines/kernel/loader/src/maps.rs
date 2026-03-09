// maps.rs — BPF map population and runtime policy management.
//
// The policy model is default-deny: only PIDs explicitly present in the map
// with the required capability bit set are permitted to connect or execve.
// The Rust loader owns the authoritative copy; the kernel-space probe is
// stateless and only reads from the map.

use anyhow::{Context, Result};
use libbpf_rs::MapMut;
use serde::Deserialize;

// Must mirror the constants in probe.bpf.c
pub const AUTH_NET_CONNECT: u64 = 1 << 0;
pub const AUTH_EXEC_SPAWN:  u64 = 1 << 1;

/// A single policy entry from the JSON configuration file.
///
/// Example policy.json:
/// ```json
/// [
///   { "pid": 12345, "allow_connect": true,  "allow_exec": false },
///   { "pid": 99001, "allow_connect": true,  "allow_exec": true  }
/// ]
/// ```
#[derive(Debug, Deserialize)]
pub struct PolicyEntry {
    pub pid:             u32,
    pub allow_connect:   bool,
    pub allow_exec:      bool,
    /// Human-readable label for logging purposes only.
    #[serde(default)]
    pub label:           Option<String>,
}

pub type PolicyFile = Vec<PolicyEntry>;

/// Load and parse a JSON policy file from disk.
pub fn load_policy_file(path: &str) -> Result<PolicyFile> {
    let raw = std::fs::read_to_string(path)
        .with_context(|| format!("Cannot read policy file: {path}"))?;
    let policy: PolicyFile = serde_json::from_str(&raw)
        .with_context(|| format!("Invalid JSON in policy file: {path}"))?;
    Ok(policy)
}

/// Write the policy into the `pid_policy_map` BPF hash map.
///
/// Key layout:   u32 TGID (little-endian, native byte order)
/// Value layout: u64 bitmask (native byte order)
///
/// Any PID absent from this map is denied by the default-deny probe logic.
pub fn populate_pid_policy_map(map: &mut MapMut, policy: &PolicyFile) -> Result<()> {
    for entry in policy {
        let mut mask: u64 = 0;
        if entry.allow_connect { mask |= AUTH_NET_CONNECT; }
        if entry.allow_exec    { mask |= AUTH_EXEC_SPAWN;  }

        let key   = entry.pid.to_ne_bytes();
        let value = mask.to_ne_bytes();

        map.update(&key, &value, libbpf_rs::MapFlags::ANY)
            .with_context(|| format!("Failed to write PID {} to BPF map", entry.pid))?;

        tracing::debug!(
            pid   = entry.pid,
            mask  = format!("{mask:#018x}"),
            label = entry.label.as_deref().unwrap_or("<unlabeled>"),
            "Policy entry loaded"
        );
    }
    Ok(())
}

/// Remove a PID from the policy map (instant revocation, atomic from the
/// kernel's perspective — the next syscall from that PID will be denied).
pub fn revoke_pid(map: &mut MapMut, pid: u32) -> Result<()> {
    let key = pid.to_ne_bytes();
    map.delete(&key)
        .with_context(|| format!("Failed to revoke PID {pid} from BPF map"))
}
