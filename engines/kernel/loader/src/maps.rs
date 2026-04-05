// maps.rs — BPF map population and runtime policy management.
//
// The policy model is default-deny: only PIDs explicitly present in the map
// with the required capability bit set are permitted to connect or execve.
// The Rust loader owns the authoritative copy; the kernel-space probe is
// stateless and only reads from the map.

use anyhow::{Context, Result};
use libbpf_rs::MapMut;
use serde::Deserialize;
use std::net::Ipv4Addr;

// Must mirror the constants in probe.bpf.c
pub const AUTH_NET_CONNECT: u64 = 1 << 0;
pub const AUTH_EXEC_SPAWN:  u64 = 1 << 1;

/// A single policy entry from the JSON configuration file.
///
/// Example policy.json:
/// ```json
/// [
///   {
///     "pid": 12345,
///     "allow_connect": true,
///     "allow_exec": false,
///     "label": "my-app",
///     "allowed_destinations": [
///       { "ip": "93.184.216.34", "port": 443 },
///       { "ip": "0.0.0.0",       "port": 53  }
///     ]
///   }
/// ]
/// ```
/// `allowed_destinations` is optional; omitting it means the PID is subject
/// only to the capability-bitmask gate (legacy behaviour preserved).
#[derive(Debug, Deserialize)]
pub struct PolicyEntry {
    pub pid:                    u32,
    pub allow_connect:          bool,
    pub allow_exec:             bool,
    /// Human-readable label for logging purposes only.
    #[serde(default)]
    pub label:                  Option<String>,
    /// Per-PID IP/port allowlist. If empty, global allowlist applies.
    #[serde(default)]
    pub allowed_destinations:   Vec<IpPortRule>,
}

/// One IP+port rule in a policy entry's allowed_destinations list.
///
/// `ip`    : dotted-decimal IPv4 (or "0.0.0.0" / "" for any).
/// `port`  : destination port (0 = any).
/// `proto` : "tcp" | "udp" | "" (default = any).
#[derive(Debug, Deserialize)]
pub struct IpPortRule {
    #[serde(default)]
    pub ip:    String,
    #[serde(default)]
    pub port:  u16,
    #[serde(default)]
    pub proto: String,
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

/// Remove a PID from the policy map (instant revocation).
pub fn revoke_pid(map: &mut MapMut, pid: u32) -> Result<()> {
    let key = pid.to_ne_bytes();
    map.delete(&key)
        .with_context(|| format!("Failed to revoke PID {pid} from BPF map"))
}

// ---------------------------------------------------------------------------
// IP/port allowlist helpers
// ---------------------------------------------------------------------------

/// Wire layout of `struct ip_port_key` from probe.bpf.c (8 bytes, packed).
#[repr(C, packed)]
struct IpPortKey {
    ip4:   u32,
    port:  u16,
    proto: u8,
    _pad:  u8,
}

fn proto_byte(s: &str) -> u8 {
    match s.to_ascii_lowercase().as_str() {
        "tcp"  => 6,
        "udp"  => 17,
        _      => 0,
    }
}

fn parse_ip4(s: &str) -> u32 {
    if s.is_empty() || s == "0.0.0.0" {
        return 0;
    }
    s.parse::<Ipv4Addr>()
        .map(|a| u32::from(a).to_be())
        .unwrap_or(0)
}

/// Populate the ip_port_allowlist BPF map from all `allowed_destinations`
/// entries in the policy file. Also updates the ip_port_count counter.
pub fn populate_ip_port_allowlist(
    allowlist_map: &mut MapMut,
    count_map:     &mut MapMut,
    policy:        &PolicyFile,
) -> Result<()> {
    let mut total: u32 = 0;

    for entry in policy {
        for rule in &entry.allowed_destinations {
            let key = IpPortKey {
                ip4:   parse_ip4(&rule.ip),
                port:  rule.port,
                proto: proto_byte(&rule.proto),
                _pad:  0,
            };

            let key_bytes = unsafe {
                std::slice::from_raw_parts(
                    &key as *const IpPortKey as *const u8,
                    std::mem::size_of::<IpPortKey>(),
                )
            };
            let value: [u8; 1] = [1u8];

            allowlist_map
                .update(key_bytes, &value, libbpf_rs::MapFlags::ANY)
                .with_context(|| {
                    format!("Failed to insert IP/port rule ip={} port={}", rule.ip, rule.port)
                })?;

            tracing::debug!(
                pid   = entry.pid,
                ip    = %rule.ip,
                port  = rule.port,
                proto = %rule.proto,
                "IP/port allowlist entry loaded"
            );
            total += 1;
        }
    }

    let idx: [u8; 4] = 0u32.to_ne_bytes();
    count_map
        .update(&idx, &total.to_ne_bytes(), libbpf_rs::MapFlags::ANY)
        .context("Failed to update ip_port_count")?;

    tracing::info!(entries = total, "IP/port allowlist populated");
    Ok(())
}

/// Clear the ip_port_allowlist map and reset the counter to 0 (bypass mode).
pub fn clear_ip_port_allowlist(
    allowlist_map: &mut MapMut,
    count_map:     &mut MapMut,
) -> Result<()> {
    let keys: Vec<Vec<u8>> = allowlist_map.keys().collect();
    for key in keys {
        let _ = allowlist_map.delete(&key);
    }
    let idx: [u8; 4]  = 0u32.to_ne_bytes();
    let zero: [u8; 4] = 0u32.to_ne_bytes();
    count_map
        .update(&idx, &zero, libbpf_rs::MapFlags::ANY)
        .context("Failed to reset ip_port_count")?;
    Ok(())
}
