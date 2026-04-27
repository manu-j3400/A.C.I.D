"""
backend/ingest_multi.py

Multi-source HuggingFace ingestion for GCN data expansion.

Sources:
  A. code_search_net (python split) — function-level benign code (label=0)
  B. CyberNative/Code_Vulnerability_Security_DPO — security DPO pairs (label 0/1)
  C. s1ck3r/CVEfixes-Python — CVE-patched Python functions (vuln=1, fixed=0)
  D. s1ck3r/DiverseVul — diverse vulnerability dataset Python subset (vuln=1)

Output: backend/data/external/huggingface_raw.csv
Schema: rawCode, label, source  (same as pipeline expects)

Usage:
  python3 backend/ingest_multi.py
  python3 backend/ingest_multi.py --csn 5000 --dpo 10000 --cvefixes 5000 --diversevul 3000
"""

from __future__ import annotations

import argparse
from pathlib import Path

import pandas as pd
from datasets import load_dataset

HF_CSV = Path(__file__).parent / "data" / "external" / "huggingface_raw.csv"

def _is_python(code: str) -> bool:
    """Require Python-specific keywords unlikely to appear in C/C++/Java."""
    return "def " in code or "import " in code or "if __name__" in code


def ingest_codesearchnet(n: int = 5000) -> list[dict]:
    """Download Python benign functions from code_search_net (label=0)."""
    print(f"[ingest_multi] Loading code_search_net python split (n={n})...")
    ds = load_dataset("code_search_net", "python", split="train")
    rows = []
    for i, example in enumerate(ds):
        if len(rows) >= n:
            break
        code = str(example.get("func_code_string", "")).strip()
        if not code:
            continue
        rows.append({"rawCode": code, "label": 0, "source": f"codesearchnet_{i}"})
    print(f"[ingest_multi] code_search_net: {len(rows)} rows extracted")
    return rows


def ingest_cybernative(n: int = 10000) -> list[dict]:
    """Download security DPO pairs: chosen=label 0, rejected=label 1."""
    print(f"[ingest_multi] Loading CyberNative DPO dataset (n={n} pairs)...")
    ds = load_dataset("CyberNative/Code_Vulnerability_Security_DPO", split="train")
    rows = []
    count = 0
    for example in ds:
        if count >= n:
            break
        chosen   = str(example.get("chosen",   "")).strip()
        rejected = str(example.get("rejected", "")).strip()
        if not _is_python(chosen):
            continue
        rows.append({"rawCode": chosen,   "label": 0, "source": f"cybernative_{count}_clean"})
        rows.append({"rawCode": rejected, "label": 1, "source": f"cybernative_{count}_corrupted"})
        count += 1
    print(f"[ingest_multi] CyberNative DPO: {count} pairs → {len(rows)} rows extracted")
    return rows


def ingest_cvefixes(n: int = 5000) -> list[dict]:
    """
    CVEfixes: real CVE-patched Python functions.
    code_before = vulnerable (label=1), code_after = fixed (label=0).

    Tries multiple known HuggingFace paths for the dataset.
    """
    # (repo, config_or_None, splits_to_try)
    _CANDIDATES = [
        ("s1ck3r/CVEfixes-Python",     None,     ["train", "test"]),
        ("s1ck3r/CVEfixes",            "python",  ["train", "test"]),
        ("CVEfixes/CVEfixes",          None,      ["train", "test"]),
        ("michaelw/CVEfixes",          None,      ["train", "test"]),
        ("neuralsentry/cvefixes",      None,      ["train", "test"]),
        ("Sygil-Dev/CVEfixes",         None,      ["train", "test"]),
        ("s1ck3r/CVEfixes_Python",     None,      ["train", "test"]),
        ("bstee615/cvefixes-python",   None,      ["train", "test"]),
    ]
    ds = None
    for repo, cfg, splits in _CANDIDATES:
        for split in splits:
            try:
                print(f"[ingest_multi] Trying CVEfixes at {repo!r} config={cfg!r} split={split!r}...")
                ds = load_dataset(repo, cfg, split=split) if cfg else load_dataset(repo, split=split)
                print(f"[ingest_multi] CVEfixes loaded from {repo!r}. Columns: {ds.column_names}")
                break
            except Exception as e:
                print(f"[ingest_multi]   ✗ {e}")
        if ds is not None:
            break

    if ds is None:
        print("[ingest_multi] CVEfixes: all candidates failed, skipping.")
        return []

    cols = ds.column_names

    # Detect column layout
    before_col = next((c for c in cols if "before" in c.lower() or "vuln" in c.lower()), None)
    after_col  = next((c for c in cols if "after" in c.lower() or "fix"  in c.lower()), None)
    lang_col   = next((c for c in cols if "lang"  in c.lower()), None)

    if not before_col:
        print(f"[ingest_multi] CVEfixes: cannot find vulnerable code column. Columns: {cols}")
        return []

    rows = []
    count = 0
    for example in ds:
        if lang_col:
            lang = str(example.get(lang_col, "")).lower()
            if "python" not in lang and "py" not in lang:
                continue

        vuln_code  = str(example.get(before_col, "")).strip()
        fixed_code = str(example.get(after_col,  "")).strip() if after_col else ""

        if vuln_code and _is_python(vuln_code):
            rows.append({"rawCode": vuln_code,  "label": 1, "source": f"cvefixes_{count}_vuln"})
            count += 1
        if fixed_code and _is_python(fixed_code):
            rows.append({"rawCode": fixed_code, "label": 0, "source": f"cvefixes_{count}_fixed"})

        if count >= n:
            break

    print(f"[ingest_multi] CVEfixes: {count} vuln functions → {len(rows)} rows extracted")
    return rows


def ingest_hitoshura_cvefixes(n: int = 5000) -> list[dict]:
    """
    hitoshura25/cvefixes — 12,987 CVE fix records with before/after code diffs.
    before_code = vulnerable (label=1), after_code = fixed (label=0).
    Function-level diffs from real GitHub CVE patches.
    """
    try:
        print(f"[ingest_multi] Loading hitoshura25/cvefixes (n={n})...")
        ds = load_dataset("hitoshura25/cvefixes", split="train")
        print(f"[ingest_multi] hitoshura25/cvefixes loaded. Columns: {ds.column_names}")
    except Exception as e:
        try:
            ds = load_dataset("hitoshura25/cvefixes", split="test")
            print(f"[ingest_multi] hitoshura25/cvefixes loaded (test). Columns: {ds.column_names}")
        except Exception as e2:
            print(f"[ingest_multi] hitoshura25/cvefixes failed: {e} / {e2}")
            return []

    cols = ds.column_names
    before_col = next((c for c in cols if "before" in c.lower() or "vuln" in c.lower() or "old" in c.lower()), None)
    after_col  = next((c for c in cols if "after" in c.lower()  or "fix"  in c.lower() or "new" in c.lower()), None)
    lang_col   = next((c for c in cols if "lang" in c.lower()), None)

    print(f"[ingest_multi] hitoshura25/cvefixes columns: before={before_col!r} after={after_col!r} lang={lang_col!r}")

    if not before_col:
        # Fallback: dump all columns for manual inspection
        print(f"[ingest_multi]   All columns: {cols}")
        return []

    rows = []
    count = 0
    for example in ds:
        if count >= n:
            break
        if lang_col:
            lang = str(example.get(lang_col, "")).lower()
            if "python" not in lang and "py" not in lang:
                continue

        vuln_code  = str(example.get(before_col, "")).strip()
        fixed_code = str(example.get(after_col, "")).strip() if after_col else ""

        added = False
        if vuln_code and _is_python(vuln_code):
            rows.append({"rawCode": vuln_code,  "label": 1, "source": f"hitoshura_cvefixes_{count}_vuln"})
            added = True
        if fixed_code and _is_python(fixed_code):
            rows.append({"rawCode": fixed_code, "label": 0, "source": f"hitoshura_cvefixes_{count}_fixed"})
            added = True

        if added:
            count += 1

    print(f"[ingest_multi] hitoshura25/cvefixes: {count} records → {len(rows)} rows")
    return rows


def main() -> None:
    parser = argparse.ArgumentParser(description="Multi-source HuggingFace ingestion")
    parser.add_argument("--csn",        type=int, default=5000,  help="CodeSearchNet sample count")
    parser.add_argument("--dpo",        type=int, default=10000, help="CyberNative DPO pair count")
    parser.add_argument("--cvefixes",        type=int, default=5000, help="CVEfixes (original) vuln fn count")
    parser.add_argument("--hitoshura",       type=int, default=5000, help="hitoshura25/cvefixes record count")
    args = parser.parse_args()

    rows: list[dict] = []
    rows.extend(ingest_codesearchnet(args.csn))
    rows.extend(ingest_cybernative(args.dpo))
    rows.extend(ingest_cvefixes(args.cvefixes))
    rows.extend(ingest_hitoshura_cvefixes(args.hitoshura))

    df = pd.DataFrame(rows)
    HF_CSV.parent.mkdir(parents=True, exist_ok=True)
    df.to_csv(HF_CSV, index=False)

    n_mal = (df["label"] == 1).sum()
    n_ben = (df["label"] == 0).sum()
    print(f"\n[ingest_multi] Saved {len(df)} rows to {HF_CSV}")
    print(f"[ingest_multi] Label dist — benign={n_ben} malicious={n_mal} ratio={n_ben/max(n_mal,1):.1f}:1")


if __name__ == "__main__":
    main()
