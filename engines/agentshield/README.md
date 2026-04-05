# AgentShield — DOM Merkle-Hash TOCTOU Mitigation

**Part of the Kyber Engine 3 security suite.**

AgentShield protects browser-use AI agents against Time-Of-Check-to-Time-Of-Use
(TOCTOU) DOM manipulation attacks by computing SHA-256 Merkle hashes over
observed DOM subtrees and detecting mutations before an action is executed.

---

## Threat model

Modern browser-use agents operate in two phases per action:

```
┌────────────────────┐          ┌─────────────────────┐
│   READ PHASE       │   Δt     │   ACTION PHASE       │
│                    │ ──────►  │                      │
│  Agent observes    │          │  Agent acts on       │
│  DOM subtree       │          │  observed state      │
└────────────────────┘          └─────────────────────┘
           ↑
    ATTACK WINDOW: malicious JS can mutate the DOM here
```

During Δt — even a few milliseconds — a malicious or compromised page can:

| Attack vector | Example |
|---|---|
| **Href swap** | Change `<a href="https://trusted.example/">` to attacker-controlled URL |
| **Form injection** | Insert hidden `<input name="redirect" value="attacker.example">` |
| **Button relabelling** | Change "Pay $10" to "Pay $9999" after the agent reads the price |
| **Action-target redirect** | Mutate `<form action="/checkout">` to `/attacker/exfiltrate` |
| **Clickjacking overlay** | Inject a transparent element over the intended click target |

These attacks exploit the fact that the agent's world-model (what it *read*)
diverges from the actual DOM state (what it *acts on*).

---

## How AgentShield mitigates this

1. At **read phase**, capture a `DomSnapshot` of the target subtree.
   The snapshot contains a Merkle hash computed bottom-up over the entire
   subtree (tags, attributes, text content, children).

2. Immediately before executing the action, capture a second snapshot.

3. Compare hashes.  If they differ, emit a `ToctouAlert` containing:
   - The read-phase hash and action-phase hash
   - CSS-like paths to each mutated subtree node
   - Timestamp and pending action label

4. The calling agent aborts (or escalates) the action.

The Merkle construction ensures that **any mutation anywhere in the protected
subtree** — no matter how deep — changes the root hash.

---

## Architecture

```
engines/agentshield/
├── src/
│   ├── dom_merkle.rs   — DomNode, DomSnapshot, merkle_hash(), detect_toctou(), diff_nodes()
│   └── main.rs         — CLI daemon (--mode watch | check)
└── Cargo.toml
```

### `dom_merkle.rs` core types

| Type | Purpose |
|---|---|
| `DomNode` | Normalised DOM node (BTreeMap attrs → deterministic hash) |
| `DomSnapshot` | Node tree + URL + timestamp + root Merkle hash |
| `ToctouAlert` | Structured alert: read/action hashes, mutated paths |

### `merkle_hash()` construction

```
H(node) = SHA-256(
    tag                   ||
    attr_count_le32        ||
    ∀ (k,v) ∈ sorted(attrs): len(k) ‖ k ‖ len(v) ‖ v  ||
    text                   ||
    H(child₀) ‖ H(child₁) ‖ … ‖ H(childₙ)
)
```

Length-prefixed fields prevent length-extension collisions.  Attribute keys
are iterated in `BTreeMap` order (lexicographic) regardless of browser
emission order.

---

## Building

```bash
# From the engines/ workspace root
cargo build -p agentshield --release

# Run tests
cargo test -p agentshield
```

---

## Usage

### Single-shot check (CI / agent pipeline integration)

```bash
agentshield \
  --url "https://shop.example/checkout" \
  --selector "#checkout-form" \
  --interval-ms 300 \
  --action "click #submit-btn" \
  --mode check \
  --json
```

Exit code **0** = DOM stable, safe to proceed.
Exit code **1** = mutation detected, action aborted.

### Continuous watch loop

```bash
agentshield \
  --url "https://target.example" \
  --selector "body" \
  --interval-ms 500 \
  --mode watch \
  --max-alerts 10
```

### Webhook integration

```bash
agentshield \
  --url "https://target.example" \
  --mode check \
  --webhook "https://soteria.internal/api/alerts/agentshield"
```

The webhook receives a POST with the `ToctouAlert` JSON body.

---

## Integrating with browser-agent frameworks

The current implementation uses `reqwest` (plain HTTP) to fetch HTML snapshots.
For production use in a browser-agent pipeline, replace `fetch_html()` with a
Chrome DevTools Protocol (CDP) snapshot:

```rust
// Pseudocode — wire to your CDP client (chromiumoxide, fantoccini, etc.)
async fn fetch_html_cdp(session: &CdpSession, frame_id: &str) -> Result<String> {
    let result = session
        .call(cdp::dom::GetOuterHTML { node_id: None, backend_node_id: None, object_id: None })
        .await?;
    Ok(result.outer_html)
}
```

This gives you the *live* DOM post-JS-execution rather than the initial HTTP
response, which is essential for SPA frameworks (React, Vue, Angular).

For Python-based browser-use frameworks (e.g. `browser-use`, Playwright), call
AgentShield as a subprocess and check the exit code:

```python
import subprocess, sys

result = subprocess.run(
    ["agentshield", "--url", page.url, "--selector", selector,
     "--action", action_label, "--mode", "check", "--json"],
    capture_output=True, text=True
)
if result.returncode != 0:
    alert = json.loads(result.stdout)
    raise ToctouError(f"DOM mutated before action: {alert['mutated_paths']}")
```

---

## Alert format

```json
{
  "alert_type": "TOCTOU_MUTATION",
  "url": "https://shop.example/checkout",
  "pending_action": "click #submit-btn",
  "read_hash": "a3f8c2...",
  "action_hash": "9b1d44...",
  "mutated_paths": [
    "form[id=checkout-form] > input[id=amount]",
    "form[id=checkout-form] > a[id=terms-link][INSERTED]"
  ],
  "detected_at": "2026-04-04T12:34:56.789Z"
}
```

---

## Environment variables

| Variable | Default | Description |
|---|---|---|
| `AGENTSHIELD_LOG` | `agentshield=info` | `tracing` log filter (e.g. `agentshield=debug`) |

---

## Limitations and future work

- **HTML-only**: The current snapshot engine uses static HTML. Dynamic DOM
  mutations driven by JS timers or WebSockets are only caught if the HTML
  response changes — replace `fetch_html()` with CDP for full coverage.
- **Selector scope**: Only the subtree matching `--selector` is protected.
  Narrow selectors are faster but leave sibling mutations undetected.
- **No visual verification**: Overlapping transparent elements (clickjacking)
  are not caught by hash comparison alone — combine with viewport screenshot
  diffing for full coverage.
- **Stateless**: Each `--mode check` run is independent. Persistent session
  state (cookies, auth tokens) is not carried between snapshots — use a
  shared CDP session in production.

---

## References

- [TOCTOU vulnerabilities in browser automation](https://owasp.org/www-community/attacks/TOCTOU)
- [Chrome DevTools Protocol — DOM domain](https://chromedevtools.github.io/devtools-protocol/tot/DOM/)
- [fantoccini — async WebDriver client for Rust](https://github.com/jonhoo/fantoccini)
- [browser-use Python framework](https://github.com/browser-use/browser-use)
