// main.rs — AgentShield CLI daemon.
//
// Watches a target URL for DOM mutations between an agent's read phase and
// action phase.  Operates in two modes:
//
//   --mode watch   Continuous polling: snapshot → wait → snapshot → compare.
//                  Use this to baseline a page's mutation rate in the wild.
//
//   --mode check   Single-shot: take two snapshots separated by --interval-ms,
//                  print a TOCTOU alert (or "CLEAN") and exit.  Designed for
//                  integration into CI / browser-agent pipelines.

mod dom_merkle;

use anyhow::Result;
use clap::{Parser, ValueEnum};
use dom_merkle::{ToctouAlert, detect_toctou, snapshot_from_html};
use std::time::Duration;
use tracing::{error, info, warn};

// ---------------------------------------------------------------------------
// CLI
// ---------------------------------------------------------------------------

#[derive(Debug, Clone, ValueEnum)]
enum Mode {
    /// Continuous watch loop — prints alerts as they occur.
    Watch,
    /// Single two-snapshot check — exits 0 (clean) or 1 (mutation detected).
    Check,
}

#[derive(Parser)]
#[command(
    name    = "agentshield",
    about   = "DOM Merkle-hash TOCTOU detector for browser-use agents",
    version,
)]
struct Cli {
    /// Target URL to monitor.
    #[arg(short, long)]
    url: String,

    /// CSS selector for the DOM subtree to protect.
    /// Defaults to the entire <body>.
    #[arg(short, long, default_value = "body")]
    selector: String,

    /// Time between read-phase and action-phase snapshots, in milliseconds.
    /// Models the window of vulnerability for a browser agent.
    #[arg(short = 'i', long, default_value_t = 500)]
    interval_ms: u64,

    /// Operating mode.
    #[arg(short, long, value_enum, default_value_t = Mode::Watch)]
    mode: Mode,

    /// Human-readable label for the action being guarded (used in alerts).
    #[arg(short, long, default_value = "unspecified-action")]
    action: String,

    /// Maximum number of mutation events before exiting (0 = unlimited).
    #[arg(long, default_value_t = 0)]
    max_alerts: u64,

    /// Emit machine-readable JSON alerts instead of human-readable text.
    #[arg(long)]
    json: bool,

    /// Optional webhook URL to POST alerts to (requires `webhook` feature).
    #[cfg(feature = "webhook")]
    #[arg(long)]
    webhook: Option<String>,
}

// ---------------------------------------------------------------------------
// HTTP fetch helper
// ---------------------------------------------------------------------------

/// Fetch the raw HTML for `url` using a blocking reqwest client.
///
/// In a production browser-agent integration this would be replaced by a
/// Chrome DevTools Protocol (CDP) snapshot — see the README for details.
fn fetch_html(url: &str) -> Result<String> {
    let client = reqwest::blocking::Client::builder()
        .timeout(Duration::from_secs(10))
        .user_agent("AgentShield/0.1 (+https://github.com/soteria/agentshield)")
        .build()?;

    let resp = client.get(url).send()?.error_for_status()?;
    Ok(resp.text()?)
}

// ---------------------------------------------------------------------------
// Alert emission
// ---------------------------------------------------------------------------

fn emit_alert(alert: &ToctouAlert, json: bool) {
    if json {
        match serde_json::to_string(alert) {
            Ok(s)  => println!("{}", s),
            Err(e) => error!("Failed to serialise alert: {}", e),
        }
    } else {
        warn!(
            alert_type   = %alert.alert_type,
            url          = %alert.url,
            action       = %alert.pending_action,
            read_hash    = %&alert.read_hash[..12],
            action_hash  = %&alert.action_hash[..12],
            mutations    = ?alert.mutated_paths,
            "TOCTOU mutation detected — aborting action"
        );
    }
}

fn emit_clean(url: &str, hash: &str, json: bool) {
    if json {
        let msg = serde_json::json!({
            "status": "CLEAN",
            "url": url,
            "hash": hash,
        });
        println!("{}", msg);
    } else {
        info!(url = %url, hash = %&hash[..12], "DOM stable — action safe to proceed");
    }
}

// ---------------------------------------------------------------------------
// Webhook dispatch
// ---------------------------------------------------------------------------

#[cfg(feature = "webhook")]
fn post_webhook(webhook_url: &str, alert: &ToctouAlert) {
    let client = match reqwest::blocking::Client::builder()
        .timeout(Duration::from_secs(5))
        .build()
    {
        Ok(c)  => c,
        Err(e) => { error!("Webhook client build failed: {}", e); return; }
    };

    match client.post(webhook_url).json(alert).send() {
        Ok(resp) => info!(status = %resp.status(), "Webhook delivered"),
        Err(e)   => error!("Webhook delivery failed: {}", e),
    }
}

// ---------------------------------------------------------------------------
// Core watch loop
// ---------------------------------------------------------------------------

fn run_check(cli: &Cli) -> Result<bool> {
    info!(url = %cli.url, selector = %cli.selector, "Taking read-phase snapshot");
    let html_read = fetch_html(&cli.url)?;
    let snap_read = snapshot_from_html(&html_read, &cli.url, &cli.selector)?;
    info!(hash = %&snap_read.hash[..12], "Read-phase hash captured");

    std::thread::sleep(Duration::from_millis(cli.interval_ms));

    info!("Taking action-phase snapshot");
    let html_action = fetch_html(&cli.url)?;
    let snap_action = snapshot_from_html(&html_action, &cli.url, &cli.selector)?;
    info!(hash = %&snap_action.hash[..12], "Action-phase hash captured");

    match detect_toctou(&snap_read, &snap_action, &cli.action) {
        Some(alert) => {
            emit_alert(&alert, cli.json);

            #[cfg(feature = "webhook")]
            if let Some(ref wh) = cli.webhook {
                post_webhook(wh, &alert);
            }

            Ok(true) // mutation detected
        }
        None => {
            emit_clean(&cli.url, &snap_action.hash, cli.json);
            Ok(false)
        }
    }
}

fn run_watch(cli: &Cli) -> Result<()> {
    let mut alert_count: u64 = 0;

    info!(
        url      = %cli.url,
        selector = %cli.selector,
        interval = cli.interval_ms,
        "AgentShield watch loop started — Ctrl-C to stop"
    );

    loop {
        let mutation_detected = match run_check(cli) {
            Ok(d)  => d,
            Err(e) => {
                error!("Snapshot error: {:#}", e);
                std::thread::sleep(Duration::from_secs(2));
                continue;
            }
        };

        if mutation_detected {
            alert_count += 1;
            if cli.max_alerts > 0 && alert_count >= cli.max_alerts {
                warn!(count = alert_count, "Max alert threshold reached — stopping");
                break;
            }
        }

        // Small cooldown between full watch cycles to avoid hammering the server.
        std::thread::sleep(Duration::from_millis(200));
    }

    Ok(())
}

// ---------------------------------------------------------------------------
// Entry point
// ---------------------------------------------------------------------------

fn main() -> Result<()> {
    let cli = Cli::parse();

    // Initialise structured logging.  AGENTSHIELD_LOG overrides the default.
    let log_env = std::env::var("AGENTSHIELD_LOG").unwrap_or_else(|_| "agentshield=info".to_owned());
    tracing_subscriber::fmt()
        .with_env_filter(tracing_subscriber::EnvFilter::new(log_env))
        .with_target(false)
        .init();

    match cli.mode {
        Mode::Watch => run_watch(&cli),
        Mode::Check => {
            let mutated = run_check(&cli)?;
            // Exit code 1 signals mutation to calling process/agent framework.
            if mutated {
                std::process::exit(1);
            }
            Ok(())
        }
    }
}
