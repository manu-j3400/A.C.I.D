#!/usr/bin/env python3
"""
sync_semgrep_rules.py — Extend vulnerability_db.py with Semgrep community rules.

Downloads the semgrep-rules YAML files from GitHub (security subtrees only),
parses them to extract string-matchable patterns, descriptions, CWEs, and severity,
then merges the results into vulnerability_db.py using sentinel comments for
idempotency.

Usage:
    python3 scripts/sync_semgrep_rules.py              # live run
    python3 scripts/sync_semgrep_rules.py --dry-run    # show diff, no writes
    python3 scripts/sync_semgrep_rules.py --stats      # show current DB stats only
"""

from __future__ import annotations

import argparse
import ast
import os
import re
import sys
import tempfile
import textwrap
from pathlib import Path
from typing import Dict, FrozenSet, List, Optional, Set, Tuple

try:
    import yaml
except ImportError:
    sys.exit("pyyaml is required: pip install pyyaml")

try:
    import requests
except ImportError:
    sys.exit("requests is required: pip install requests")

# ──────────────────────────────────────────────────────────────────────────────
# Constants
# ──────────────────────────────────────────────────────────────────────────────

REPO_API_BASE = "https://api.github.com/repos/semgrep/semgrep-rules"
RAW_BASE      = "https://raw.githubusercontent.com/semgrep/semgrep-rules/main"

# Only fetch rules under these top-level language directories
TARGET_LANGS = [
    "python", "javascript", "typescript", "java", "go",
    "ruby", "php", "rust", "c", "cpp", "csharp", "kotlin", "swift",
]

# Semgrep lang dir → Soteria language code
LANG_DIR_TO_CODE: Dict[str, str] = {
    "python":     "python",
    "javascript": "javascript",
    "typescript": "typescript",
    "java":       "java",
    "go":         "go",
    "ruby":       "ruby",
    "php":        "php",
    "rust":       "rust",
    "c":          "c",
    "cpp":        "cpp",
    "csharp":     "c_sharp",
    "kotlin":     "kotlin",
    "swift":      "swift",
}

# Semgrep severity → Soteria severity
SEV_MAP: Dict[str, str] = {
    "ERROR":   "HIGH",
    "WARNING": "MEDIUM",
    "INFO":    "LOW",
}

# Only rules under these categories are included
SECURITY_CATEGORIES = {"security", "correctness", "best-practice"}

# Sentinels in vulnerability_db.py
SYNC_START = "# [SEMGREP-SYNC-START]"
SYNC_END   = "# [SEMGREP-SYNC-END]"
FILTER_START = "# [SEMGREP-FILTER-START]"
FILTER_END   = "# [SEMGREP-FILTER-END]"

DB_PATH = Path(__file__).parent.parent / "backend" / "src" / "vulnerability_db.py"

# ──────────────────────────────────────────────────────────────────────────────
# Pattern extraction helpers
# ──────────────────────────────────────────────────────────────────────────────

# Regex to find leading function/method calls or identifier tokens in semgrep patterns.
# We extract the longest prefix that is a plain string (no metavariables).
_METAVAR_RE = re.compile(r'\$\w+')
_CLEAN_RE   = re.compile(r'[^\w\s\.\(\)\[\]\{\}\,\:\;\=\!\<\>\+\-\*\/\%\@\#\&\|\^]')


def _extract_string_key(pattern: str) -> Optional[str]:
    """
    Try to extract a string token from a semgrep pattern that will reliably
    match in a plain substring scan.

    Strategy:
      1. Strip metavariables ($VAR → ...) and ellipsis (...)
      2. Extract the longest contiguous run of non-metavar chars at the start
      3. Keep only if it has ≥4 meaningful characters and no remaining metavars

    Returns None if no reliable key can be found.
    """
    if not isinstance(pattern, str):
        return None

    # Collapse whitespace
    p = ' '.join(pattern.split())

    # Remove ellipsis
    p = p.replace('...', '')

    # If it still contains metavariables, try to use the non-metavar prefix
    # e.g. "os.system($CMD)" → "os.system("
    # e.g. "exec($X, $Y)" → "exec("
    # e.g. "$VAR.execute(...)" → None (starts with metavar)

    if p.startswith('$'):
        return None  # Starts with metavar — not a useful literal key

    # Strip trailing metavar portions: take everything up to the first $
    dollar_pos = p.find('$')
    if dollar_pos != -1:
        p = p[:dollar_pos]

    # Strip trailing non-word chars (open parens, spaces, commas etc. are ok to keep)
    p = p.rstrip(' ,')

    # Must be at least 4 chars to be meaningful
    if len(p) < 4:
        return None

    # Must not still contain metavars
    if '$' in p:
        return None

    return p


def _parse_rule_patterns(rule: dict) -> List[str]:
    """
    Recursively collect all 'pattern' / 'patterns' / 'pattern-either' strings
    from a semgrep rule dict.
    """
    keys: List[str] = []

    def _walk(obj):
        if isinstance(obj, dict):
            for k, v in obj.items():
                if k == 'pattern' and isinstance(v, str):
                    keys.append(v)
                elif k in ('patterns', 'pattern-either', 'pattern-inside',
                           'pattern-not', 'pattern-not-inside'):
                    _walk(v)
                else:
                    _walk(v)
        elif isinstance(obj, list):
            for item in obj:
                _walk(item)

    _walk(rule.get('pattern'))
    _walk(rule.get('patterns'))
    _walk(rule.get('pattern-either'))
    return keys


def _parse_cwe(meta: dict) -> str:
    raw = meta.get('cwe', meta.get('cwe-id', ''))
    if isinstance(raw, list):
        raw = raw[0] if raw else ''
    if isinstance(raw, str) and raw:
        return raw.split(':')[0].strip()
    return ''


def _semgrep_sev(sev_raw: str, meta: dict) -> str:
    base = SEV_MAP.get(sev_raw.upper(), 'MEDIUM')
    if sev_raw.upper() == 'ERROR' and meta.get('confidence', '').upper() == 'HIGH':
        return 'CRITICAL'
    return base

# ──────────────────────────────────────────────────────────────────────────────
# GitHub file listing
# ──────────────────────────────────────────────────────────────────────────────

def _github_list_yaml_files(lang_dir: str, session: requests.Session) -> List[str]:
    """
    Recursively list all .yaml/.yml paths inside a language directory of
    semgrep-rules/. Uses the GitHub Trees API (recursive=1) to avoid
    N+1 requests.

    Returns a list of raw-content URLs.
    """
    url = f"{REPO_API_BASE}/git/trees/main?recursive=1"
    resp = session.get(url, timeout=30)
    resp.raise_for_status()
    tree = resp.json().get('tree', [])

    prefix = f"{lang_dir}/"
    urls = []
    for item in tree:
        path = item.get('path', '')
        if (
            path.startswith(prefix)
            and item.get('type') == 'blob'
            and (path.endswith('.yaml') or path.endswith('.yml'))
        ):
            urls.append(f"{RAW_BASE}/{path}")
    return urls


def _fetch_yaml(url: str, session: requests.Session) -> Optional[dict]:
    try:
        resp = session.get(url, timeout=15)
        if resp.status_code != 200:
            return None
        return yaml.safe_load(resp.text)
    except Exception:
        return None

# ──────────────────────────────────────────────────────────────────────────────
# Rule processing
# ──────────────────────────────────────────────────────────────────────────────

Entry = Tuple[str, str, str]  # (description, severity, cwe)


def _process_yaml(data: dict, lang_code: str) -> List[Tuple[str, Entry]]:
    """
    Parse one YAML file and return [(pattern_key, (description, severity, cwe)), ...].
    """
    results = []
    if not isinstance(data, dict):
        return results

    for rule in data.get('rules', []):
        meta     = rule.get('metadata', {})
        category = meta.get('category', 'security')

        # category can be a list in some rules — treat any match as included
        if isinstance(category, list):
            if not any(c in SECURITY_CATEGORIES for c in category):
                continue
        elif category not in SECURITY_CATEGORIES:
            continue

        sev_raw = rule.get('severity', 'WARNING')
        sev     = _semgrep_sev(sev_raw, meta)
        cwe     = _parse_cwe(meta)
        msg     = rule.get('message', rule.get('id', '')).strip()
        # Truncate long messages
        if len(msg) > 120:
            msg = msg[:117] + '...'

        # Collect candidate patterns
        raw_patterns = _parse_rule_patterns(rule)

        seen_keys: Set[str] = set()
        for rp in raw_patterns:
            key = _extract_string_key(rp)
            if key and key not in seen_keys and len(key) >= 4:
                seen_keys.add(key)
                results.append((key, (msg or key, sev, cwe)))

    return results


# ──────────────────────────────────────────────────────────────────────────────
# vulnerability_db.py update
# ──────────────────────────────────────────────────────────────────────────────

def _load_existing_patterns(db_text: str) -> Set[str]:
    """
    Load pattern keys from the HAND-WRITTEN section of vulnerability_db.py only
    (i.e. everything OUTSIDE the SEMGREP-SYNC sentinels).

    We always fully rebuild the sync block on each run, so we only need to know
    what's in the original hand-written entries to avoid duplication.
    """
    # Strip the sync block so its (previously-written) keys don't count as "existing"
    # and cause the block to shrink on subsequent runs.
    s_idx = db_text.find(SYNC_START)
    e_idx = db_text.find(SYNC_END)
    if s_idx != -1 and e_idx != -1:
        outside = db_text[:s_idx] + db_text[e_idx + len(SYNC_END):]
    else:
        outside = db_text

    keys: Set[str] = set()
    # Simple heuristic: lines of the form    'key': (  or  "key": (
    for m in re.finditer(r"^\s+'([^'\\]{2,100})':\s*\(", outside, re.MULTILINE):
        keys.add(m.group(1))
    for m in re.finditer(r'^\s+"([^"\\]{2,100})":\s*\(', outside, re.MULTILINE):
        keys.add(m.group(1))
    return keys


def _build_patterns_block(
    new_entries: Dict[str, Entry],
    lang_map: Dict[str, Set[str]],
) -> str:
    """
    Render the SEMGREP-SYNC block for VULNERABILITY_PATTERNS.
    """
    lines = [SYNC_START]
    lines.append("    # Auto-synced from semgrep-rules — do not edit manually")
    for key, (desc, sev, cwe) in sorted(new_entries.items()):
        # Use json.dumps for safe string literal generation — prevents escape injection
        safe_key  = json.dumps(key)
        safe_desc = json.dumps(desc)
        safe_sev  = json.dumps(sev)
        safe_cwe  = json.dumps(cwe)
        entry = f"    {safe_key}: ({safe_desc}, {safe_sev}, {safe_cwe}),"
        lines.append(entry)
    lines.append(SYNC_END)
    return '\n'.join(lines)


def _build_filter_block(
    new_entries: Dict[str, Entry],
    lang_map: Dict[str, Set[str]],
) -> str:
    """
    Render the SEMGREP-FILTER block for LANGUAGE_FILTER additions.
    Each key that appeared in only a subset of languages gets a filter entry.
    """
    lines = [FILTER_START]
    lines.append("    # Auto-synced from semgrep-rules — do not edit manually")

    # Group by frozenset of languages
    all_codes = set(LANG_DIR_TO_CODE.values())
    for key in sorted(lang_map.keys()):
        langs = lang_map[key]
        if langs and langs != all_codes:
            safe_key = json.dumps(key)
            lang_list = ', '.join(json.dumps(l) for l in sorted(langs))
            lines.append(f"    {safe_key}: frozenset({{{lang_list}}}),")

    lines.append(FILTER_END)
    return '\n'.join(lines)


def _splice_block(text: str, start_sentinel: str, end_sentinel: str, new_block: str) -> str:
    """
    Replace everything between (and including) the sentinels with new_block.
    If sentinels are absent, append new_block before the closing `}` of the
    nearest enclosing dict.
    """
    s_idx = text.find(start_sentinel)
    e_idx = text.find(end_sentinel)

    if s_idx != -1 and e_idx != -1:
        # Replace existing block
        return text[:s_idx] + new_block + text[e_idx + len(end_sentinel):]
    else:
        # Insert before the sentinel's intended parent dict closing brace.
        # Heuristic: find VULNERABILITY_PATTERNS = { ... }
        # and insert before the final `}`
        marker = 'VULNERABILITY_PATTERNS' if 'SYNC' in start_sentinel else 'LANGUAGE_FILTER'
        dict_start = text.find(f'{marker}')
        if dict_start == -1:
            return text + '\n' + new_block + '\n'

        # Find the matching closing brace for the dict
        brace_depth = 0
        in_dict = False
        for i, ch in enumerate(text[dict_start:], dict_start):
            if ch == '{':
                brace_depth += 1
                in_dict = True
            elif ch == '}' and in_dict:
                brace_depth -= 1
                if brace_depth == 0:
                    # Insert the block just before this closing brace
                    return (
                        text[:i] +
                        '\n' + new_block + '\n' +
                        text[i:]
                    )
        return text + '\n' + new_block + '\n'

# ──────────────────────────────────────────────────────────────────────────────
# Main
# ──────────────────────────────────────────────────────────────────────────────

def main(dry_run: bool = False, stats_only: bool = False) -> None:
    db_text = DB_PATH.read_text(encoding='utf-8')

    if stats_only:
        existing = _load_existing_patterns(db_text)
        print(f"vulnerability_db.py — current pattern count: {len(existing)}")
        return

    print("Fetching semgrep-rules file list (this may take 20–30 s)…")
    session = requests.Session()
    session.headers['User-Agent'] = 'Soteria-sync/1.0'

    # lang_dir → list of YAML URLs
    yaml_urls: Dict[str, List[str]] = {}
    for lang_dir in TARGET_LANGS:
        print(f"  listing {lang_dir}/…", end=' ', flush=True)
        try:
            urls = _github_list_yaml_files(lang_dir, session)
            yaml_urls[lang_dir] = urls
            print(f"{len(urls)} files")
        except Exception as exc:
            print(f"SKIP ({exc})")
            yaml_urls[lang_dir] = []

    existing_keys = _load_existing_patterns(db_text)
    print(f"\nExisting patterns in DB: {len(existing_keys)}")

    # new_entries: key → Entry
    new_entries: Dict[str, Entry] = {}
    # lang_map: key → set of language codes where this key appeared
    lang_map: Dict[str, Set[str]] = {}

    total_files = sum(len(v) for v in yaml_urls.values())
    processed   = 0

    for lang_dir, urls in yaml_urls.items():
        lang_code = LANG_DIR_TO_CODE[lang_dir]
        for url in urls:
            processed += 1
            if processed % 50 == 0:
                pct = 100 * processed // total_files
                print(f"  {processed}/{total_files} ({pct}%)…")

            data = _fetch_yaml(url, session)
            if not data:
                continue

            for key, entry in _process_yaml(data, lang_code):
                if key in existing_keys:
                    continue  # already in DB
                if key not in new_entries:
                    new_entries[key] = entry
                    lang_map[key]    = {lang_code}
                else:
                    lang_map[key].add(lang_code)

    print(f"\nNew patterns found: {len(new_entries)}")
    if not new_entries:
        print("Nothing to update.")
        return

    # Build replacement blocks
    patterns_block = _build_patterns_block(new_entries, lang_map)
    filter_block   = _build_filter_block(new_entries, lang_map)

    # Splice into db_text
    updated = _splice_block(db_text, SYNC_START, SYNC_END, patterns_block)
    updated = _splice_block(updated, FILTER_START, FILTER_END, filter_block)

    if dry_run:
        print("\n─── DRY RUN: would write to", DB_PATH, "───")
        # Show first 60 lines of the patterns block
        preview = '\n'.join(patterns_block.splitlines()[:60])
        print(preview)
        if len(patterns_block.splitlines()) > 60:
            print(f"  … ({len(patterns_block.splitlines()) - 60} more lines)")
        print("\n─── LANGUAGE_FILTER additions ───")
        preview2 = '\n'.join(filter_block.splitlines()[:30])
        print(preview2)
        return

    tmp = DB_PATH.with_suffix('.py.tmp')
    tmp.write_text(updated, encoding='utf-8')
    os.replace(tmp, DB_PATH)
    print(f"Updated {DB_PATH}")
    print(f"Total patterns now: {len(existing_keys) + len(new_entries)}")


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__,
                                     formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument('--dry-run', action='store_true',
                        help='Show what would be added without modifying files')
    parser.add_argument('--stats', action='store_true',
                        help='Only print current pattern counts, then exit')
    args = parser.parse_args()
    main(dry_run=args.dry_run, stats_only=args.stats)
