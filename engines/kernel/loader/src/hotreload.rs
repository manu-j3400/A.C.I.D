// hotreload.rs — inotify-based policy hot-reload for the eBPF sentinel.
//
// Watches the policy JSON file for IN_CLOSE_WRITE and IN_MOVED_TO events
// (both occur when an editor or `cp --atomic` atomically replaces the file).
// When a change is detected the policy is re-parsed and the BPF map is
// updated: all existing PIDs are revoked then the new entries are written.
//
// The watcher runs in a dedicated background thread and communicates with
// the main loop through a `PolicyEvent` channel.

use crate::maps::{load_policy_file, populate_pid_policy_map, PolicyFile};
use anyhow::{Context, Result};
use inotify::{EventMask, Inotify, WatchMask};
use libbpf_rs::MapMut;
use std::{
    path::Path,
    sync::{
        atomic::{AtomicBool, Ordering},
        mpsc, Arc,
    },
    thread,
    time::Duration,
};
use tracing::{error, info, warn};

/// Sent from the watcher thread to the main loop when the policy file changes.
pub struct PolicyReloadEvent {
    pub new_policy: PolicyFile,
}

/// Spawn a background thread that watches `policy_path` for writes.
/// Returns an `mpsc::Receiver` that yields `PolicyReloadEvent` on each change.
/// The thread terminates automatically when `running` is set to false.
pub fn spawn_policy_watcher(
    policy_path: String,
    running: Arc<AtomicBool>,
) -> Result<mpsc::Receiver<PolicyReloadEvent>> {
    let (tx, rx) = mpsc::channel::<PolicyReloadEvent>();

    let path     = policy_path.clone();
    let dir      = Path::new(&path)
        .parent()
        .map(|p| p.to_path_buf())
        .unwrap_or_else(|| std::path::PathBuf::from("."));
    let filename = Path::new(&path)
        .file_name()
        .map(|f| f.to_os_string())
        .context("Policy path has no filename component")?;

    thread::Builder::new()
        .name("policy-hotreload".into())
        .spawn(move || {
            info!(path = %policy_path, "Policy hot-reload watcher started");

            let mut inotify = match Inotify::init() {
                Ok(i) => i,
                Err(e) => {
                    error!(error = %e, "Failed to initialise inotify");
                    return;
                }
            };

            // Watch the *directory* so we catch atomic renames (IN_MOVED_TO).
            if let Err(e) = inotify.watches().add(
                &dir,
                WatchMask::CLOSE_WRITE | WatchMask::MOVED_TO,
            ) {
                error!(error = %e, "Failed to add inotify watch");
                return;
            }

            let mut buffer = [0u8; 4096];

            while running.load(Ordering::SeqCst) {
                match inotify.read_events(&mut buffer) {
                    Ok(events) => {
                        for event in events {
                            let affected = event.name.map(|n| n == filename).unwrap_or(false);
                            if !affected {
                                continue;
                            }
                            if event.mask.contains(EventMask::CLOSE_WRITE)
                                || event.mask.contains(EventMask::MOVED_TO)
                            {
                                // Small debounce: editors often fire multiple events.
                                thread::sleep(Duration::from_millis(50));

                                match load_policy_file(&policy_path) {
                                    Ok(new_policy) => {
                                        info!(
                                            entries = new_policy.len(),
                                            path    = %policy_path,
                                            "Policy file changed — hot-reloading"
                                        );
                                        let _ = tx.send(PolicyReloadEvent { new_policy });
                                    }
                                    Err(e) => {
                                        warn!(
                                            error = %e,
                                            path  = %policy_path,
                                            "Policy hot-reload: parse failed, keeping old policy"
                                        );
                                    }
                                }
                            }
                        }
                    }
                    Err(ref e) if e.kind() == std::io::ErrorKind::WouldBlock => {
                        thread::sleep(Duration::from_millis(100));
                    }
                    Err(e) => {
                        error!(error = %e, "inotify read_events error");
                        thread::sleep(Duration::from_millis(250));
                    }
                }
            }

            info!("Policy hot-reload watcher stopped");
        })
        .context("Failed to spawn policy-hotreload thread")?;

    Ok(rx)
}

/// Apply a new policy to the live BPF map.
/// Clears existing entries first (default-deny during the brief update window),
/// then writes the fresh policy in one pass.
pub fn apply_policy_reload(map: &mut MapMut, new_policy: &PolicyFile) -> Result<()> {
    let existing_keys: Vec<[u8; 4]> = map
        .keys()
        .filter_map(|k| k.try_into().ok())
        .collect();

    let n_removed = existing_keys.len();
    for key in existing_keys {
        if let Err(e) = map.delete(&key) {
            warn!(error = %e, "Failed to remove stale PID from policy map");
        }
    }

    populate_pid_policy_map(map, new_policy)?;

    info!(
        removed  = n_removed,
        inserted = new_policy.len(),
        "Policy hot-reload applied to BPF map"
    );
    Ok(())
}
