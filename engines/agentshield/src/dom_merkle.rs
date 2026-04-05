// dom_merkle.rs — DOM Merkle-hash engine for TOCTOU detection.
//
// # Threat model
//
// A browser-use agent operates in two logically distinct phases per action:
//
//   1. **Read phase**  – The agent observes the DOM to decide what to do
//                        (e.g. "find the Submit button").
//   2. **Action phase** – The agent executes the action (e.g. clicks the button).
//
// Between these two phases, a malicious or compromised page can mutate the DOM —
// swapping the button's href, replacing form field values, or redirecting the
// action target — so the agent acts on state it never observed.  This is a
// classic Time-Of-Check-to-Time-Of-Use (TOCTOU) race.
//
// # Mitigation
//
// Before acting, re-snapshot the same DOM subtree and compare its Merkle hash
// against the hash captured during the read phase.  If the hashes differ,
// emit a `ToctouAlert` and abort (or escalate) the action.  The Merkle
// construction lets us pinpoint *which* subtrees changed, giving the agent
// an audit trail for forensic analysis.

use chrono::{DateTime, Utc};
use scraper::{ElementRef, Html, Selector};
use serde::{Deserialize, Serialize};
use sha2::{Digest, Sha256};
use std::collections::BTreeMap;

// ---------------------------------------------------------------------------
// DOM representation
// ---------------------------------------------------------------------------

/// A normalised, serialisable DOM node.
///
/// Attributes are stored in a `BTreeMap` so iteration order is deterministic
/// regardless of how the browser emitted them — essential for stable hashes.
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct DomNode {
    /// HTML tag name in lowercase (e.g. `"button"`, `"input"`).
    pub tag: String,
    /// Element attributes, sorted by key.
    pub attrs: BTreeMap<String, String>,
    /// Trimmed, collapsed inner text content (direct text nodes only).
    pub text: String,
    /// Ordered child elements (recursively normalised).
    pub children: Vec<DomNode>,
}

/// A complete DOM snapshot bound to a URL and a point in time.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DomSnapshot {
    /// The page URL this snapshot was taken from.
    pub url: String,
    /// Wall-clock timestamp of the capture.
    pub captured_at: DateTime<Utc>,
    /// Root node of the captured subtree (may be the document body or a
    /// narrower selector match).
    pub root: DomNode,
    /// Hex-encoded SHA-256 Merkle hash of `root` at capture time.
    pub hash: String,
}

// ---------------------------------------------------------------------------
// Merkle hashing
// ---------------------------------------------------------------------------

/// Compute the SHA-256 Merkle hash of a single `DomNode`.
///
/// The hash is constructed bottom-up:
/// ```text
/// H(node) = SHA-256(
///     tag_bytes       ||
///     attr_count_le32 ||
///     for (k, v) in sorted(attrs): len(k) || k || len(v) || v ||
///     text_bytes      ||
///     for child in children: H(child)
/// )
/// ```
/// Using length-prefixed fields prevents collisions between nodes whose
/// concatenated attribute bytes happen to be identical.
pub fn merkle_hash(node: &DomNode) -> [u8; 32] {
    let mut hasher = Sha256::new();

    // Tag
    hasher.update(node.tag.as_bytes());

    // Attribute count (little-endian u32) then each k/v pair
    let attr_count = node.attrs.len() as u32;
    hasher.update(attr_count.to_le_bytes());
    for (k, v) in &node.attrs {
        hasher.update((k.len() as u32).to_le_bytes());
        hasher.update(k.as_bytes());
        hasher.update((v.len() as u32).to_le_bytes());
        hasher.update(v.as_bytes());
    }

    // Direct text content
    hasher.update((node.text.len() as u32).to_le_bytes());
    hasher.update(node.text.as_bytes());

    // Children — order is significant (DOM is ordered)
    for child in &node.children {
        hasher.update(merkle_hash(child));
    }

    hasher.finalize().into()
}

/// Convenience wrapper: compute the Merkle hash and return it as a hex string.
pub fn merkle_hash_hex(node: &DomNode) -> String {
    hex::encode(merkle_hash(node))
}

// ---------------------------------------------------------------------------
// DOM parsing
// ---------------------------------------------------------------------------

/// Parse raw HTML into a `DomSnapshot`.
///
/// `selector` is a CSS selector string (e.g. `"body"`, `"#checkout-form"`).
/// If the selector matches nothing, the entire `<body>` is used as a fallback.
///
/// # Errors
/// Returns an error if `selector` is syntactically invalid.
pub fn snapshot_from_html(
    html: &str,
    url: &str,
    selector: &str,
) -> anyhow::Result<DomSnapshot> {
    let document = Html::parse_document(html);

    let sel = Selector::parse(selector)
        .map_err(|e| anyhow::anyhow!("Invalid CSS selector {:?}: {}", selector, e))?;

    // Use the first matching element, or fall back to <body>.
    let root_el: ElementRef = document
        .select(&sel)
        .next()
        .or_else(|| {
            let body_sel = Selector::parse("body").ok()?;
            document.select(&body_sel).next()
        })
        .ok_or_else(|| anyhow::anyhow!("No element matched selector {:?} and no <body> found", selector))?;

    let root = element_to_node(root_el);
    let hash = merkle_hash_hex(&root);

    Ok(DomSnapshot {
        url: url.to_owned(),
        captured_at: Utc::now(),
        root,
        hash,
    })
}

/// Recursively convert a `scraper::ElementRef` into our `DomNode` tree.
fn element_to_node(el: ElementRef<'_>) -> DomNode {
    let tag = el.value().name().to_lowercase();

    // Collect and sort attributes for deterministic ordering.
    let attrs: BTreeMap<String, String> = el
        .value()
        .attrs()
        .map(|(k, v)| (k.to_owned(), v.to_owned()))
        .collect();

    // Gather only direct text nodes (not descendant text) and collapse whitespace.
    let text: String = el
        .text()
        .filter(|t| !t.trim().is_empty())
        .map(|t| t.split_whitespace().collect::<Vec<_>>().join(" "))
        .collect::<Vec<_>>()
        .join(" ")
        .trim()
        .to_owned();

    let children: Vec<DomNode> = el
        .children()
        .filter_map(|child| ElementRef::wrap(child))
        .map(element_to_node)
        .collect();

    DomNode { tag, attrs, text, children }
}

// ---------------------------------------------------------------------------
// TOCTOU detection
// ---------------------------------------------------------------------------

/// A structured alert emitted when a DOM mutation is detected between the
/// read phase and the action phase.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ToctouAlert {
    /// Severity tag — always `"TOCTOU_MUTATION"` for hash mismatches.
    pub alert_type: String,
    /// The page URL being monitored.
    pub url: String,
    /// Human-readable label for the action the agent was about to take.
    pub pending_action: String,
    /// Merkle hash at read phase.
    pub read_hash: String,
    /// Merkle hash at action phase.
    pub action_hash: String,
    /// CSS-like paths to each subtree whose hash changed.
    pub mutated_paths: Vec<String>,
    /// Timestamp of detection.
    pub detected_at: DateTime<Utc>,
}

/// Compare two DOM snapshots (read-phase vs action-phase) and return a
/// `ToctouAlert` if they differ, or `None` if they are identical.
///
/// `pending_action` is a human-readable description of what the agent was
/// about to do (e.g. `"click #submit-btn"`).
pub fn detect_toctou(
    read: &DomSnapshot,
    action: &DomSnapshot,
    pending_action: &str,
) -> Option<ToctouAlert> {
    if read.hash == action.hash {
        return None;
    }

    let mutated_paths = diff_nodes(&read.root, &action.root, &read.root.tag);

    Some(ToctouAlert {
        alert_type: "TOCTOU_MUTATION".to_owned(),
        url: read.url.clone(),
        pending_action: pending_action.to_owned(),
        read_hash: read.hash.clone(),
        action_hash: action.hash.clone(),
        mutated_paths,
        detected_at: Utc::now(),
    })
}

/// Recursively diff two `DomNode` trees.
///
/// Returns a list of CSS-like path strings (e.g. `"body > div[id=app] > button"`)
/// for each subtree whose Merkle hash has changed.
///
/// The comparison is structural: nodes are matched by position, not by id/class,
/// to catch mutations that rename or reorder elements.
pub fn diff_nodes(before: &DomNode, after: &DomNode, path: &str) -> Vec<String> {
    let mut mutations: Vec<String> = Vec::new();

    // Quick-exit: identical subtrees.
    if merkle_hash(before) == merkle_hash(after) {
        return mutations;
    }

    // The node itself changed (tag, attrs, or direct text).
    let self_changed = before.tag != after.tag
        || before.attrs != after.attrs
        || before.text != after.text;

    if self_changed {
        mutations.push(path.to_owned());
    }

    // Recurse into children (zip — unmatched trailing children are flagged).
    let max_len = before.children.len().max(after.children.len());
    for i in 0..max_len {
        let child_path = match (before.children.get(i), after.children.get(i)) {
            (Some(b), Some(a)) => {
                let label = child_label(a, i);
                let child_path = format!("{} > {}", path, label);
                let child_mutations = diff_nodes(b, a, &child_path);
                mutations.extend(child_mutations);
                continue;
            }
            (None, Some(a)) => {
                // Child was inserted.
                format!("{} > {}[INSERTED]", path, child_label(a, i))
            }
            (Some(b), None) => {
                // Child was removed.
                format!("{} > {}[REMOVED]", path, child_label(b, i))
            }
            (None, None) => unreachable!(),
        };
        mutations.push(child_path);
    }

    mutations
}

/// Build a CSS-like label for a child node for diagnostic paths.
fn child_label(node: &DomNode, index: usize) -> String {
    let mut label = node.tag.clone();
    if let Some(id) = node.attrs.get("id") {
        label.push_str(&format!("[id={}]", id));
    } else if let Some(cls) = node.attrs.get("class") {
        // Use first class token only to keep paths readable.
        if let Some(first) = cls.split_whitespace().next() {
            label.push_str(&format!(".{}", first));
        }
    } else {
        label.push_str(&format!(":nth-child({})", index));
    }
    label
}

// ---------------------------------------------------------------------------
// Unit tests
// ---------------------------------------------------------------------------

#[cfg(test)]
mod tests {
    use super::*;

    fn leaf(tag: &str, text: &str) -> DomNode {
        DomNode {
            tag: tag.to_owned(),
            attrs: BTreeMap::new(),
            text: text.to_owned(),
            children: vec![],
        }
    }

    #[test]
    fn identical_nodes_have_equal_hashes() {
        let a = leaf("button", "Submit");
        let b = leaf("button", "Submit");
        assert_eq!(merkle_hash(&a), merkle_hash(&b));
    }

    #[test]
    fn text_mutation_changes_hash() {
        let a = leaf("button", "Submit");
        let b = leaf("button", "Confirm Transfer");
        assert_ne!(merkle_hash(&a), merkle_hash(&b));
    }

    #[test]
    fn attribute_mutation_changes_hash() {
        let mut a = leaf("a", "Click here");
        a.attrs.insert("href".to_owned(), "https://trusted.example/".to_owned());

        let mut b = a.clone();
        b.attrs.insert("href".to_owned(), "https://attacker.example/".to_owned());

        assert_ne!(merkle_hash(&a), merkle_hash(&b));
    }

    #[test]
    fn child_insertion_changes_parent_hash() {
        let mut parent = leaf("form", "");
        parent.children.push(leaf("input", ""));

        let mut mutated = parent.clone();
        // Inject a hidden field after the read phase.
        mutated.children.push(DomNode {
            tag: "input".to_owned(),
            attrs: {
                let mut m = BTreeMap::new();
                m.insert("type".to_owned(), "hidden".to_owned());
                m.insert("name".to_owned(), "redirect".to_owned());
                m.insert("value".to_owned(), "https://attacker.example/".to_owned());
                m
            },
            text: String::new(),
            children: vec![],
        });

        assert_ne!(merkle_hash(&parent), merkle_hash(&mutated));
    }

    #[test]
    fn diff_reports_mutated_path() {
        let before = leaf("button", "Pay $10");
        let after  = leaf("button", "Pay $9999");
        let paths  = diff_nodes(&before, &after, "button");
        assert!(paths.contains(&"button".to_owned()));
    }

    #[test]
    fn no_diff_on_identical_trees() {
        let before = leaf("span", "hello");
        let after  = before.clone();
        assert!(diff_nodes(&before, &after, "span").is_empty());
    }

    #[test]
    fn snapshot_from_html_parses_correctly() {
        let html = r#"<html><body><button id="pay">Pay</button></body></html>"#;
        let snap = snapshot_from_html(html, "https://example.com", "button").unwrap();
        assert_eq!(snap.root.tag, "button");
        assert_eq!(snap.root.attrs.get("id").map(|s| s.as_str()), Some("pay"));
    }

    #[test]
    fn toctou_alert_fires_on_mutation() {
        let html_before = r#"<html><body><a href="https://trusted.example/">Pay</a></body></html>"#;
        let html_after  = r#"<html><body><a href="https://attacker.example/">Pay</a></body></html>"#;

        let snap_read   = snapshot_from_html(html_before, "https://shop.example/checkout", "a").unwrap();
        let snap_action = snapshot_from_html(html_after,  "https://shop.example/checkout", "a").unwrap();

        let alert = detect_toctou(&snap_read, &snap_action, "click #pay-link");
        assert!(alert.is_some());
        let alert = alert.unwrap();
        assert_eq!(alert.alert_type, "TOCTOU_MUTATION");
        assert!(!alert.mutated_paths.is_empty());
    }

    #[test]
    fn no_alert_on_stable_dom() {
        let html = r#"<html><body><button id="ok">OK</button></body></html>"#;
        let snap_read   = snapshot_from_html(html, "https://example.com", "button").unwrap();
        let snap_action = snapshot_from_html(html, "https://example.com", "button").unwrap();
        assert!(detect_toctou(&snap_read, &snap_action, "click #ok").is_none());
    }
}
