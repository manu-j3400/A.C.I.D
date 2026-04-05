#!/usr/bin/env python3
"""
Soteria PR Security Reviewer
=============================
Fetches changed files from a GitHub PR, passes them to the Soteria
security agent, and prints a structured security review report.

Usage
-----
    python3 review.py <PR_URL>
    python3 review.py <owner/repo> <PR_NUMBER>
    python3 review.py --repo <owner/repo> --pr <N> [--token <JWT>]

Examples
--------
    python3 review.py https://github.com/acme/myapp/pull/42
    python3 review.py acme/myapp 42
    SOTERIA_TOKEN=... python3 review.py acme/myapp 42

Requirements
------------
    - `gh` CLI authenticated (github.com/cli/cli)
    - `claude` CLI (claude.ai/claude-code)
    - Node.js (to run the Soteria MCP server)
    - SOTERIA_TOKEN env var (optional, enables scan history)
"""

from __future__ import annotations

import argparse
import json
import os
import re
import subprocess
import sys
from pathlib import Path
from typing import Dict, List, Optional, Tuple


# ---------------------------------------------------------------------------
# Constants
# ---------------------------------------------------------------------------

SCRIPT_DIR  = Path(__file__).parent.resolve()
MCP_SERVER  = SCRIPT_DIR / ".." / ".." / "soteria-mcp"
CLAUDE_MD   = SCRIPT_DIR / "CLAUDE.md"

# File extensions worth scanning (mirrors CLAUDE.md triage rules)
SCANNABLE_EXTS = {
    ".py", ".js", ".ts", ".jsx", ".tsx",
    ".go", ".rs", ".rb", ".sh", ".php",
    ".java", ".cs", ".cpp", ".c", ".h",
}

# Files to always skip
SKIP_PATTERNS = {
    "package-lock.json", "yarn.lock", "poetry.lock",
    "Cargo.lock", "go.sum", "Gemfile.lock",
}

# Max file size to scan (bytes) — avoids feeding enormous generated files
MAX_FILE_BYTES = 200_000


# ---------------------------------------------------------------------------
# GitHub helpers (via `gh` CLI)
# ---------------------------------------------------------------------------

def _gh(*args: str) -> str:
    """Run a `gh` command and return stdout. Raises on non-zero exit."""
    result = subprocess.run(
        ["gh", *args],
        capture_output=True, text=True, check=True,
    )
    return result.stdout.strip()


def parse_pr_ref(url_or_repo: str, pr_number: Optional[str] = None) -> Tuple[str, int]:
    """
    Accept either:
      - A GitHub PR URL  (https://github.com/owner/repo/pull/42)
      - A repo slug + PR number  (owner/repo, 42)
    Returns (repo_slug, pr_number).
    """
    url_match = re.match(
        r"https?://github\.com/([^/]+/[^/]+)/pull/(\d+)",
        url_or_repo,
    )
    if url_match:
        return url_match.group(1), int(url_match.group(2))
    if pr_number is not None:
        return url_or_repo, int(pr_number)
    raise ValueError(
        "Provide a GitHub PR URL or a repo slug + PR number.\n"
        "  python3 review.py https://github.com/owner/repo/pull/42\n"
        "  python3 review.py owner/repo 42"
    )


def get_pr_metadata(repo: str, pr: int) -> Dict:
    """Return PR title, author, branch names."""
    raw = _gh("pr", "view", str(pr), "--repo", repo, "--json",
              "title,author,headRefName,baseRefName,additions,deletions,changedFiles")
    return json.loads(raw)


def get_changed_files(repo: str, pr: int) -> List[Dict]:
    """
    Return list of changed files in the PR.
    Each item: { path, status, additions, deletions }
    """
    raw = _gh("pr", "view", str(pr), "--repo", repo, "--json", "files")
    data = json.loads(raw)
    return data.get("files", [])


def get_file_content(repo: str, ref: str, path: str) -> Optional[str]:
    """Fetch the HEAD content of a file at a given ref."""
    try:
        content = _gh("api", f"repos/{repo}/contents/{path}?ref={ref}",
                      "--jq", ".content")
        # GitHub returns base64-encoded content
        import base64
        return base64.b64decode(content.replace("\\n", "\n")).decode("utf-8", errors="replace")
    except subprocess.CalledProcessError:
        return None


def should_scan(filepath: str) -> bool:
    """Return True if this file is worth scanning."""
    p = Path(filepath)
    if p.name in SKIP_PATTERNS:
        return False
    return p.suffix.lower() in SCANNABLE_EXTS


# ---------------------------------------------------------------------------
# MCP server build
# ---------------------------------------------------------------------------

def ensure_mcp_built() -> None:
    dist = MCP_SERVER / "dist" / "index.js"
    if dist.exists():
        return
    print("[review] Building Soteria MCP server...", flush=True)
    subprocess.run(
        ["npm", "install", "--silent"],
        cwd=MCP_SERVER, check=True,
    )
    subprocess.run(
        ["npm", "run", "build"],
        cwd=MCP_SERVER, check=True,
    )
    print("[review] MCP server built.", flush=True)


# ---------------------------------------------------------------------------
# Agent invocation
# ---------------------------------------------------------------------------

def build_prompt(
    repo: str,
    pr: int,
    meta: Dict,
    files: List[Dict[str, str]],
) -> str:
    """Build the user prompt that describes what to review."""
    lines = [
        f"Review PR #{pr} on {repo}",
        f'Title: {meta.get("title", "—")}',
        f'Author: {meta.get("author", {}).get("login", "—")}',
        f'Branch: {meta.get("headRefName", "?")} → {meta.get("baseRefName", "?")}',
        f'Changed files loaded: {len(files)}',
        "",
        "Scan ALL files listed below with `soteria_batch_scan`, then produce",
        "the full Soteria Security Review report as specified in your instructions.",
        "",
    ]

    for f in files:
        lines.append(f'### File: {f["filename"]}')
        lines.append("```")
        lines.append(f["code"][:MAX_FILE_BYTES])
        lines.append("```")
        lines.append("")

    return "\n".join(lines)


def run_agent(prompt: str) -> None:
    """Invoke the claude CLI agent with the Soteria MCP server."""
    mcp_cmd = f"node {MCP_SERVER / 'dist' / 'index.js'}"

    env = os.environ.copy()
    # Forward Soteria token if set
    if "SOTERIA_TOKEN" not in env:
        print("[review] ⚠️  SOTERIA_TOKEN not set — scans run unauthenticated.", flush=True)

    cmd = [
        "claude",
        "--mcp-server", f"soteria:{mcp_cmd}",
        "--system-prompt", str(CLAUDE_MD),
        "--print",
        prompt,
    ]

    print("\n[review] Invoking Soteria PR reviewer agent...\n", flush=True)
    print("─" * 70, flush=True)

    result = subprocess.run(cmd, env=env)
    sys.exit(result.returncode)


# ---------------------------------------------------------------------------
# Entry point
# ---------------------------------------------------------------------------

def main() -> None:
    parser = argparse.ArgumentParser(
        description="Soteria PR Security Reviewer — automated security review for GitHub PRs",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog=__doc__,
    )
    parser.add_argument(
        "target",
        help="GitHub PR URL (https://github.com/owner/repo/pull/N) or repo slug (owner/repo)",
    )
    parser.add_argument(
        "pr_number",
        nargs="?",
        help="PR number (required when target is a repo slug)",
    )
    parser.add_argument(
        "--repo", "-r",
        help="Repository slug (owner/repo) — alternative to positional target",
    )
    parser.add_argument(
        "--pr", "-n",
        type=int,
        help="PR number — alternative to positional pr_number",
    )
    parser.add_argument(
        "--max-files",
        type=int,
        default=30,
        help="Max files to scan (default 30; largest by change count are prioritized)",
    )
    parser.add_argument(
        "--dry-run",
        action="store_true",
        help="Print the prompt that would be sent to the agent, then exit",
    )

    args = parser.parse_args()

    # Resolve repo + PR number
    target     = args.repo or args.target
    pr_num_str = str(args.pr) if args.pr else args.pr_number

    try:
        repo, pr = parse_pr_ref(target, pr_num_str)
    except ValueError as e:
        parser.error(str(e))

    print(f"[review] Fetching PR #{pr} from {repo}...", flush=True)

    # Fetch metadata + file list
    try:
        meta     = get_pr_metadata(repo, pr)
        changed  = get_changed_files(repo, pr)
    except subprocess.CalledProcessError as e:
        print(f"[review] ✗ gh CLI error: {e.stderr.strip()}", file=sys.stderr)
        print("         Make sure you are authenticated: gh auth login", file=sys.stderr)
        sys.exit(1)

    head_ref = meta.get("headRefName", "HEAD")

    # Filter to scannable files
    scannable = [f for f in changed if should_scan(f["path"])]

    # If more than max_files, prioritise by total lines changed
    if len(scannable) > args.max_files:
        scannable.sort(key=lambda f: f.get("additions", 0) + f.get("deletions", 0), reverse=True)
        skipped = len(scannable) - args.max_files
        scannable = scannable[:args.max_files]
        print(f"[review] Limiting to {args.max_files} highest-churn files "
              f"({skipped} skipped; use --max-files to increase)", flush=True)

    print(f"[review] Fetching content for {len(scannable)} scannable files...", flush=True)

    files_with_content: List[Dict[str, str]] = []
    for f in scannable:
        path    = f["path"]
        content = get_file_content(repo, head_ref, path)
        if content is None:
            print(f"         ⚠ Could not fetch {path} (deleted or binary) — skipping")
            continue
        if len(content) > MAX_FILE_BYTES:
            print(f"         ⚠ {path} truncated to {MAX_FILE_BYTES // 1000}KB")
        files_with_content.append({"filename": path, "code": content})

    if not files_with_content:
        print("[review] No scannable files found in this PR. Exiting.")
        sys.exit(0)

    print(f"[review] {len(files_with_content)} files ready for scanning.", flush=True)

    # Ensure MCP server is built
    ensure_mcp_built()

    # Build agent prompt
    prompt = build_prompt(repo, pr, meta, files_with_content)

    if args.dry_run:
        print("\n[review] DRY RUN — prompt that would be sent:\n")
        print(prompt[:3000], "..." if len(prompt) > 3000 else "")
        sys.exit(0)

    run_agent(prompt)


if __name__ == "__main__":
    main()
