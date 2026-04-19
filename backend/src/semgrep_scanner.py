"""
Semgrep integration for Soteria vulnerability scanner.

Wraps the `semgrep` CLI to provide AST-level, semantics-aware static
analysis as a fourth detection layer alongside:
  1. Pattern-based scanner (vulnerability_db.py)
  2. ML/GCN model
  3. SNN temporal profiler
  4. **THIS** — Semgrep community rules

Usage
-----
    from semgrep_scanner import scan, is_available

    if is_available():
        findings = scan(code, detected_language, timeout=30)

The caller is responsible for deduplication and merging with other findings.
"""

from __future__ import annotations

import json
import os
import subprocess
import tempfile
from typing import Dict, List

# ─── Language mapping ────────────────────────────────────────────────────────
# Maps Soteria language codes → (semgrep lang id, temp-file extension)

_LANG_META: Dict[str, tuple] = {
    'python':     ('python',     '.py'),
    'javascript': ('javascript', '.js'),
    'typescript': ('typescript', '.ts'),
    'java':       ('java',       '.java'),
    'c':          ('c',          '.c'),
    'cpp':        ('cpp',        '.cpp'),
    'c_sharp':    ('csharp',     '.cs'),
    'go':         ('go',         '.go'),
    'ruby':       ('ruby',       '.rb'),
    'php':        ('php',        '.php'),
    'rust':       ('rust',       '.rs'),
    'kotlin':     ('kotlin',     '.kt'),
    'swift':      ('swift',      '.swift'),
}

# Semgrep severity → Soteria severity
_SEV_MAP: Dict[str, str] = {
    'ERROR':   'HIGH',
    'WARNING': 'MEDIUM',
    'INFO':    'LOW',
}


# ─── Helpers ─────────────────────────────────────────────────────────────────

def _parse_cwe(meta: dict) -> str:
    """Extract the first CWE identifier from semgrep rule metadata."""
    raw = meta.get('cwe', meta.get('cwe-id', ''))
    if isinstance(raw, list):
        raw = raw[0] if raw else ''
    if isinstance(raw, str) and raw:
        # Semgrep format: "CWE-89: SQL Injection" → keep only "CWE-89"
        return raw.split(':')[0].strip()
    return ''


def _semgrep_severity(extra: dict) -> str:
    """
    Map semgrep severity + confidence to Soteria severity.
    Upgrades ERROR+HIGH_CONFIDENCE findings to CRITICAL.
    """
    sev_raw  = extra.get('severity', 'WARNING')
    meta     = extra.get('metadata', {})
    base_sev = _SEV_MAP.get(sev_raw, 'MEDIUM')

    if sev_raw == 'ERROR' and meta.get('confidence', '').upper() == 'HIGH':
        return 'CRITICAL'
    return base_sev


# ─── Public API ──────────────────────────────────────────────────────────────

def is_available() -> bool:
    """Return True if the semgrep binary is reachable on PATH."""
    try:
        subprocess.run(
            ['semgrep', '--version'],
            capture_output=True,
            timeout=5,
        )
        return True
    except (FileNotFoundError, subprocess.TimeoutExpired):
        return False


def scan(code: str, language: str, timeout: int = 30) -> List[Dict]:
    """
    Run semgrep on *code* (written to a temp file with the right extension)
    using ``--config auto`` so the community rule-set for the detected
    language is applied automatically.

    Parameters
    ----------
    code        Source code string to analyse.
    language    Soteria language code (e.g. 'python', 'go', 'rust').
    timeout     Wall-clock seconds before giving up (default 30).

    Returns
    -------
    List of vulnerability dicts in Soteria's standard format:
        line, pattern, severity, description, cwe, category,
        fix_hint, snippet, source='semgrep', rule_id
    Returns an empty list on any error (binary missing, timeout, etc.)
    """
    lang_meta = _LANG_META.get(language)
    if not lang_meta:
        return []

    _sg_lang, ext = lang_meta
    tmp_path: str | None = None

    try:
        # Write snippet to a temp file so semgrep can infer language from extension
        with tempfile.NamedTemporaryFile(
            suffix=ext, mode='w', delete=False, encoding='utf-8'
        ) as fh:
            fh.write(code)
            tmp_path = fh.name

        proc = subprocess.run(
            [
                'semgrep',
                '--config', 'auto',   # auto-selects community rules by language
                '--json',
                '--quiet',
                '--metrics=off',      # no telemetry
                '--no-git-ignore',    # don't skip temp files
                tmp_path,
            ],
            capture_output=True,
            text=True,
            timeout=timeout,
        )

        # exit 0 = no findings, exit 1 = findings present, exit 2+ = error
        if proc.returncode > 1:
            return []

        data = json.loads(proc.stdout or '{}')
        findings: List[Dict] = []

        for r in data.get('results', []):
            extra    = r.get('extra', {})
            meta     = extra.get('metadata', {})
            rule_id  = r.get('check_id', '')
            short_id = rule_id.split('.')[-1] if '.' in rule_id else rule_id

            findings.append({
                'line':        r.get('start', {}).get('line', 0),
                'pattern':     short_id,
                'severity':    _semgrep_severity(extra),
                'description': extra.get('message', short_id).strip(),
                'cwe':         _parse_cwe(meta),
                'category':    meta.get('category', 'security'),
                'fix_hint':    meta.get('fix', meta.get('fix-it', '')),
                'snippet':     extra.get('lines', '')[:100].strip(),
                'source':      'semgrep',
                'rule_id':     rule_id,
            })

        return findings

    except FileNotFoundError:
        # semgrep binary not installed — silent failure
        return []
    except subprocess.TimeoutExpired:
        return []
    except (json.JSONDecodeError, Exception):
        return []
    finally:
        if tmp_path and os.path.exists(tmp_path):
            try:
                os.unlink(tmp_path)
            except OSError:
                pass
