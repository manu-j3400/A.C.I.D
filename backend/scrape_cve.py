"""
CVE Scraper — GitHub API + NVD → Python vulnerable/patched function pairs
=========================================================================

Queries NVD for recent Python CVEs, searches GitHub for fix commits,
extracts changed functions (before=vulnerable, after=patched), and
appends them to backend/data/external/huggingface_raw.csv.

Usage
-----
    python3 backend/scrape_cve.py [--max-cves 200] [--dry-run]

Environment variables
---------------------
    GITHUB_TOKEN  — GitHub personal access token (5000 req/hr vs 60 unauthenticated)
    NVD_API_KEY   — NVD API key (optional, raises rate limit)

Output
------
Appends new rows to backend/data/external/huggingface_raw.csv
Schema: rawCode, label, source
  label 1 = vulnerable (before patch)
  label 0 = patched (after patch)
"""

from __future__ import annotations

import argparse
import ast
import csv
import hashlib
import os
import re
import sys
import time
from pathlib import Path
from typing import Generator

import requests

# ---------------------------------------------------------------------------
# Paths
# ---------------------------------------------------------------------------
ROOT = Path(__file__).parent.parent
HF_CSV = ROOT / "backend" / "data" / "external" / "huggingface_raw.csv"

# ---------------------------------------------------------------------------
# API config
# ---------------------------------------------------------------------------
GITHUB_TOKEN = os.environ.get("GITHUB_TOKEN", "")
NVD_API_KEY = os.environ.get("NVD_API_KEY", "")

GITHUB_HEADERS: dict[str, str] = {
    "Accept": "application/vnd.github+json",
    "X-GitHub-Api-Version": "2022-11-28",
}
if GITHUB_TOKEN:
    GITHUB_HEADERS["Authorization"] = f"Bearer {GITHUB_TOKEN}"

NVD_HEADERS: dict[str, str] = {}
if NVD_API_KEY:
    NVD_HEADERS["apiKey"] = NVD_API_KEY

# ---------------------------------------------------------------------------
# Rate-limit helpers
# ---------------------------------------------------------------------------
_GITHUB_DELAY = 0.8 if not GITHUB_TOKEN else 0.1   # seconds between requests


def _get(url: str, params: dict | None = None, headers: dict | None = None,
         retries: int = 3, backoff: float = 2.0) -> requests.Response | None:
    """GET with retry + exponential backoff. Returns None on failure."""
    h = headers or {}
    for attempt in range(retries):
        try:
            resp = requests.get(url, params=params, headers=h, timeout=15)
            if resp.status_code == 429:
                wait = backoff * (2 ** attempt)
                print(f"  [rate-limit] 429 — sleeping {wait:.0f}s")
                time.sleep(wait)
                continue
            if resp.status_code == 403 and "rate limit" in resp.text.lower():
                wait = 60
                print(f"  [rate-limit] 403 GitHub rate limit — sleeping {wait}s")
                time.sleep(wait)
                continue
            return resp
        except requests.RequestException as exc:
            print(f"  [error] {url}: {exc}")
            time.sleep(backoff)
    return None


# ---------------------------------------------------------------------------
# NVD: query recent Python CVEs
# ---------------------------------------------------------------------------
NVD_API = "https://services.nvd.nist.gov/rest/json/cves/2.0"


def query_nvd_cves(max_results: int = 500) -> list[dict]:
    """
    Fetch CVEs from NVD that mention Python in their descriptions.
    Returns list of {id, description}.
    """
    results = []
    page_size = 100
    start = 0

    while len(results) < max_results:
        params: dict = {
            "keywordSearch": "python",
            "keywordExactMatch": "",
            "resultsPerPage": min(page_size, max_results - len(results)),
            "startIndex": start,
        }
        print(f"  [NVD] Fetching CVEs {start}–{start + page_size} ...")
        resp = _get(NVD_API, params=params, headers=NVD_HEADERS)
        if resp is None or resp.status_code != 200:
            print(f"  [NVD] Error: {resp.status_code if resp else 'no response'}")
            break

        data = resp.json()
        vulns = data.get("vulnerabilities", [])
        if not vulns:
            break

        for v in vulns:
            cve = v.get("cve", {})
            cve_id = cve.get("id", "")
            descriptions = cve.get("descriptions", [])
            desc = next(
                (d["value"] for d in descriptions if d.get("lang") == "en"), ""
            )
            if cve_id:
                results.append({"id": cve_id, "description": desc})

        start += page_size
        total = data.get("totalResults", 0)
        if start >= total:
            break

        time.sleep(0.6 if not NVD_API_KEY else 0.1)

    print(f"  [NVD] Got {len(results)} CVEs.")
    return results


# ---------------------------------------------------------------------------
# GitHub: search for fix commits
# ---------------------------------------------------------------------------
GITHUB_SEARCH = "https://api.github.com/search/commits"
GITHUB_COMMIT_API = "https://api.github.com/repos/{repo}/commits/{sha}"
GITHUB_COMPARE_API = "https://api.github.com/repos/{repo}/commits/{sha}"


def search_github_commits(cve_id: str) -> list[dict]:
    """
    Search GitHub for commits that reference this CVE and touch .py files.
    Returns list of {repo, sha}.
    """
    query = f'"{cve_id}" language:Python'
    params = {"q": query, "per_page": 5, "sort": "indexed"}
    time.sleep(_GITHUB_DELAY)
    resp = _get(GITHUB_SEARCH, params=params, headers=GITHUB_HEADERS)
    if resp is None or resp.status_code != 200:
        return []

    data = resp.json()
    results = []
    for item in data.get("items", []):
        repo = item.get("repository", {}).get("full_name", "")
        sha = item.get("sha", "")
        if repo and sha:
            results.append({"repo": repo, "sha": sha})
    return results


# ---------------------------------------------------------------------------
# GitHub: get file content at a specific commit
# ---------------------------------------------------------------------------
def _get_file_at_commit(repo: str, path: str, sha: str) -> str | None:
    """Fetch raw file content at a given commit SHA."""
    url = f"https://raw.githubusercontent.com/{repo}/{sha}/{path}"
    time.sleep(_GITHUB_DELAY)
    resp = _get(url, headers=GITHUB_HEADERS)
    if resp is None or resp.status_code != 200:
        return None
    return resp.text


# ---------------------------------------------------------------------------
# GitHub: get changed .py files in a commit
# ---------------------------------------------------------------------------
def get_changed_files(repo: str, sha: str) -> list[dict]:
    """
    Returns list of {filename, patch, status} for .py files changed in this commit.
    """
    url = GITHUB_COMMIT_API.format(repo=repo, sha=sha)
    time.sleep(_GITHUB_DELAY)
    resp = _get(url, headers=GITHUB_HEADERS)
    if resp is None or resp.status_code != 200:
        return []

    data = resp.json()
    files = []
    for f in data.get("files", []):
        fname = f.get("filename", "")
        if fname.endswith(".py"):
            files.append({
                "filename": fname,
                "status": f.get("status", ""),
                "patch": f.get("patch", ""),
            })

    # Also get parent SHA for fetching "before" content
    parents = data.get("parents", [])
    parent_sha = parents[0]["sha"] if parents else None
    return files, parent_sha


# ---------------------------------------------------------------------------
# AST: extract top-level and class-method functions from source
# ---------------------------------------------------------------------------
def _extract_functions(source: str) -> dict[str, str]:
    """
    Parse source, return {qualified_name: source_code} for all functions.
    Handles both top-level defs and class methods.
    Returns empty dict on parse error.
    """
    try:
        tree = ast.parse(source)
    except SyntaxError:
        return {}

    lines = source.splitlines(keepends=True)
    result: dict[str, str] = {}

    def _get_src(node: ast.AST) -> str:
        start = node.lineno - 1
        end = node.end_lineno
        return "".join(lines[start:end])

    for node in ast.walk(tree):
        if isinstance(node, ast.ClassDef):
            for item in node.body:
                if isinstance(item, (ast.FunctionDef, ast.AsyncFunctionDef)):
                    key = f"{node.name}.{item.name}"
                    result[key] = _get_src(item)
        elif isinstance(node, (ast.FunctionDef, ast.AsyncFunctionDef)):
            # Only top-level (parent is Module)
            pass

    # Top-level functions
    for node in tree.body:
        if isinstance(node, (ast.FunctionDef, ast.AsyncFunctionDef)):
            result[node.name] = _get_src(node)

    return result


# ---------------------------------------------------------------------------
# Diff: identify which functions changed between before/after
# ---------------------------------------------------------------------------
def get_changed_python_functions(
    repo: str, sha: str, parent_sha: str, filename: str
) -> list[tuple[str, str, int]]:
    """
    Download before (parent) and after (sha) versions of filename.
    Extract functions that changed.
    Returns list of (before_code, after_code, label_before) — label_before=1 (vulnerable).
    """
    before_src = _get_file_at_commit(repo, filename, parent_sha)
    after_src = _get_file_at_commit(repo, filename, sha)

    if not before_src or not after_src:
        return []

    before_fns = _extract_functions(before_src)
    after_fns = _extract_functions(after_src)

    pairs = []
    for name, before_code in before_fns.items():
        after_code = after_fns.get(name)
        if after_code and after_code != before_code:
            # Function changed in this security patch
            pairs.append((before_code, after_code, 1))  # before=vulnerable

    return pairs


# ---------------------------------------------------------------------------
# CSV: deduplicate and append
# ---------------------------------------------------------------------------
def _existing_hashes(csv_path: Path) -> set[str]:
    """Load SHA-256 hashes of all existing rawCode entries."""
    hashes: set[str] = set()
    if not csv_path.exists():
        return hashes
    with open(csv_path, newline="", encoding="utf-8", errors="replace") as fh:
        reader = csv.DictReader(fh)
        for row in reader:
            code = row.get("rawCode", "")
            if code:
                hashes.add(hashlib.sha256(code.encode()).hexdigest())
    return hashes


def append_to_csv(rows: list[dict], csv_path: Path) -> int:
    """
    Append rows to csv_path, skipping duplicates.
    Returns number of new rows written.
    """
    existing = _existing_hashes(csv_path)
    new_rows = []
    for row in rows:
        code = row.get("rawCode", "")
        h = hashlib.sha256(code.encode()).hexdigest()
        if h not in existing:
            new_rows.append(row)
            existing.add(h)

    if not new_rows:
        return 0

    write_header = not csv_path.exists() or csv_path.stat().st_size == 0
    with open(csv_path, "a", newline="", encoding="utf-8") as fh:
        writer = csv.DictWriter(fh, fieldnames=["rawCode", "label", "source"])
        if write_header:
            writer.writeheader()
        writer.writerows(new_rows)

    return len(new_rows)


# ---------------------------------------------------------------------------
# Main pipeline
# ---------------------------------------------------------------------------
def run(max_cves: int = 200, dry_run: bool = False) -> None:
    print(f"[CVE Scraper] Starting. max_cves={max_cves}, dry_run={dry_run}")
    if not GITHUB_TOKEN:
        print("[CVE Scraper] WARNING: GITHUB_TOKEN not set. Rate limit = 60 req/hr.")
    if not NVD_API_KEY:
        print("[CVE Scraper] INFO: NVD_API_KEY not set (5 req/30s limit applies).")

    # 1. Fetch CVEs from NVD
    cves = query_nvd_cves(max_results=max_cves)
    print(f"[CVE Scraper] Processing {len(cves)} CVEs...")

    all_rows: list[dict] = []
    n_commits_checked = 0
    n_files_checked = 0

    for i, cve in enumerate(cves):
        cve_id = cve["id"]
        print(f"  [{i+1}/{len(cves)}] {cve_id}", end=" ", flush=True)

        commits = search_github_commits(cve_id)
        if not commits:
            print("— no commits found")
            continue

        print(f"— {len(commits)} commit(s)")
        for c in commits:
            repo, sha = c["repo"], c["sha"]
            n_commits_checked += 1

            changed_result = get_changed_files(repo, sha)
            if not changed_result or changed_result[1] is None:
                continue
            files, parent_sha = changed_result

            if not parent_sha:
                continue

            for f in files:
                fname = f["filename"]
                n_files_checked += 1
                pairs = get_changed_python_functions(repo, sha, parent_sha, fname)
                for before_code, after_code, _ in pairs:
                    # Skip trivially small functions (< 3 lines)
                    if before_code.count("\n") < 2 or after_code.count("\n") < 2:
                        continue
                    all_rows.append({
                        "rawCode": before_code,
                        "label": 1,
                        "source": f"github_cve:{cve_id}",
                    })
                    all_rows.append({
                        "rawCode": after_code,
                        "label": 0,
                        "source": f"github_cve:{cve_id}:patched",
                    })

    print(f"\n[CVE Scraper] Checked {n_commits_checked} commits, {n_files_checked} Python files.")
    print(f"[CVE Scraper] Extracted {len(all_rows)} function samples ({len(all_rows)//2} pairs).")

    if dry_run:
        print("[CVE Scraper] DRY RUN — not writing to CSV.")
        if all_rows:
            print("  Sample:")
            print("  label=1:", all_rows[0]["rawCode"][:120].replace("\n", " "))
        return

    if not all_rows:
        print("[CVE Scraper] No new samples extracted. Check GITHUB_TOKEN and network.")
        return

    n_written = append_to_csv(all_rows, HF_CSV)
    print(f"[CVE Scraper] Wrote {n_written} new rows to {HF_CSV}.")
    print("[CVE Scraper] Done. Run: python3 backend/train_full_pipeline.py --gcn-only")


# ---------------------------------------------------------------------------
# CLI
# ---------------------------------------------------------------------------
def main() -> None:
    parser = argparse.ArgumentParser(
        description="Scrape CVE fix commits from GitHub to expand GCN training data."
    )
    parser.add_argument("--max-cves", type=int, default=200,
                        help="Max CVEs to query from NVD (default: 200)")
    parser.add_argument("--dry-run", action="store_true",
                        help="Print stats without writing to CSV")
    args = parser.parse_args()
    run(max_cves=args.max_cves, dry_run=args.dry_run)


if __name__ == "__main__":
    main()
