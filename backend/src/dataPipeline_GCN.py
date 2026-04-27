"""
backend/src/dataPipeline_GCN.py

Phase 3a: GCN Training Data Pipeline
======================================
Builds a .pt file of PyG Data graphs from labeled source files.
Replaces CSV-based feature extraction for the GNN track.

Output: GCN_master/gcn_dataset.pt
  {
    'graphs':    list[Data],          # all graphs (train + val + test)
    'train_idx': list[int],
    'val_idx':   list[int],
    'test_idx':  list[int],
  }
"""

from __future__ import annotations

import hashlib
import random
import warnings
from pathlib import Path
from typing import NamedTuple

GCN_MASTER_DIR = Path(__file__).parent.parent / "GCN_master"
DATA_DIR       = Path(__file__).parent.parent / "data"
HF_CSV         = DATA_DIR / "external" / "huggingface_raw.csv"


class DatasetSplit(NamedTuple):
    train: list
    val:   list
    test:  list


def _hash_graph(data) -> str:
    """SHA-256 of x + edge_index + y tensor bytes — used for deduplication."""
    parts = [
        data.x.numpy().tobytes(),
        data.edge_index.numpy().tobytes(),
        (data.y.numpy().tobytes() if data.y is not None else b""),
    ]
    return hashlib.sha256(b"".join(parts)).hexdigest()


def build_gcn_dataset(
    data_dir: "str | Path | None" = None,
    val_ratio: float = 0.15,
    test_ratio: float = 0.15,
    min_nodes: int = 3,
    save: bool = True,
) -> DatasetSplit:
    """
    Build a deduplicated, shuffled, split dataset of PyG graphs.

    Steps:
      1. Walk data/clean/ (label=0) and data/corrupted/ (label=1).
      2. Ingest data/external/huggingface_raw.csv if present.
      3. Call extract_all_functions(source, label, normalize=True) per file.
      4. Deduplicate by SHA-256 of (x, edge_index, y).
      5. Filter graphs with num_nodes < min_nodes.
      6. Shuffle with random.seed(42), split sequentially.
      7. Optionally save to GCN_master/gcn_dataset.pt.

    Prints a warning if total graphs < 100.
    """
    import torch  # deferred — not needed by torch-free consumers
    # cfg_extractor defers its own torch import to graph_to_pyg()
    from cfg_extractor import extract_all_functions  # type: ignore[import]

    root   = Path(data_dir) if data_dir else DATA_DIR
    graphs: list = []
    seen:   set[str] = set()

    def _ingest(source: str, label: int) -> None:
        for data in extract_all_functions(source, label=label, normalize=True):
            if data is None or data.num_nodes < min_nodes:
                continue
            h = _hash_graph(data)
            if h not in seen:
                seen.add(h)
                graphs.append(data)

    # --- Local files ---
    for label, subdir in [(0, "clean"), (1, "corrupted")]:
        folder = root / subdir
        if not folder.exists():
            print(f"[dataPipeline_GCN] Warning: {folder} does not exist, skipping.")
            continue
        before = len(graphs)
        file_count = 0
        for path in folder.rglob("*.py"):
            try:
                source = path.read_text(encoding="utf-8", errors="replace")
                _ingest(source, label)
                file_count += 1
            except Exception as exc:
                print(f"[dataPipeline_GCN] Skipping {path}: {exc}")
        after = len(graphs)
        print(
            f"[dataPipeline_GCN] local/{subdir}: {file_count} files → "
            f"{after - before} graphs"
        )

    # --- HuggingFace CSV ---
    if HF_CSV.exists():
        try:
            import pandas as pd
            df = pd.read_csv(HF_CSV)
            code_col  = next(
                (c for c in df.columns if "code" in c.lower() or "content" in c.lower()), None
            )
            label_col = next(
                (c for c in df.columns if "label" in c.lower() or "malicious" in c.lower()), None
            )
            if code_col and label_col:
                row_count = len(df)
                before = len(graphs)
                for _, row in df.iterrows():
                    try:
                        raw = str(row[code_col]).strip()
                        # Strip markdown code fences
                        if raw.startswith("```"):
                            raw = raw.lstrip("`").lstrip("python").lstrip("\n")
                        if raw.endswith("```"):
                            raw = raw[: raw.rfind("```")]
                        lbl = int(row[label_col])
                        _ingest(raw, lbl)
                    except Exception:
                        pass
                after = len(graphs)
                yield_pct = (after - before) / row_count * 100 if row_count else 0
                print(
                    f"[dataPipeline_GCN] HuggingFace CSV: {row_count} rows → "
                    f"{after - before} graphs ({yield_pct:.1f}% yield)"
                )
            else:
                print(
                    f"[dataPipeline_GCN] Could not identify code/label columns in {HF_CSV}. "
                    f"Columns found: {list(df.columns)}"
                )
        except Exception as exc:
            print(f"[dataPipeline_GCN] HuggingFace CSV load failed: {exc}")

    total = len(graphs)
    n_mal = sum(1 for g in graphs if g.y is not None and int(g.y.item()) == 1)
    n_ben = total - n_mal
    print(f"[dataPipeline_GCN] Total graphs after dedup: {total} (benign={n_ben} malicious={n_mal} ratio={n_ben/max(n_mal,1):.1f}:1)")

    if total < 100:
        warnings.warn(
            f"[dataPipeline_GCN] Dataset has only {total} graphs (< 100). "
            "GCN training may overfit. Consider adding more labeled samples "
            "or augmenting with data/external/huggingface_raw.csv.",
            UserWarning,
            stacklevel=2,
        )

    # --- Shuffle and split ---
    random.seed(42)
    random.shuffle(graphs)

    n_val   = max(1, int(total * val_ratio))
    n_test  = max(1, int(total * test_ratio))
    n_train = total - n_val - n_test

    if n_train <= 0:
        # Tiny dataset: put everything in train
        train, val, test = graphs, [], []
        print("[dataPipeline_GCN] Warning: dataset too small for val/test splits; using all for train.")
    else:
        train = graphs[:n_train]
        val   = graphs[n_train : n_train + n_val]
        test  = graphs[n_train + n_val :]

    # --- Augment malicious graphs in train only (no leakage into val/test) ---
    import torch as _torch
    from torch_geometric.data import Data as _Data

    train_mal = [g for g in train if g.y is not None and int(g.y.item()) == 1]
    train_ben = [g for g in train if g.y is None or int(g.y.item()) == 0]
    ratio = len(train_ben) / max(len(train_mal), 1)

    if ratio > 5 and len(train_mal) > 0:
        # Augment until ratio ≤ 5:1 or max 8 augments per graph
        target_mal = len(train_ben) // 5
        need       = target_mal - len(train_mal)
        augments_per = min(8, max(1, -(-need // max(len(train_mal), 1))))  # ceil div

        augmented: list = []
        _aug_seed = 0
        for g in train_mal:
            for _ in range(augments_per):
                _torch.manual_seed(_aug_seed); _aug_seed += 1
                # Edge dropout: randomly remove 15% of edges
                ei, ea = g.edge_index, g.edge_attr
                if ei.size(1) > 2:
                    keep = _torch.rand(ei.size(1)) >= 0.15
                    # Always keep at least 2 edges to preserve graph structure
                    if keep.sum() < 2:
                        keep[:2] = True
                    ei = ei[:, keep]
                    ea = ea[keep] if ea is not None else None
                aug = _Data(x=g.x.clone(), edge_index=ei, edge_attr=ea, y=g.y.clone())
                h = _hash_graph(aug)
                if h not in seen:
                    seen.add(h)
                    augmented.append(aug)
                if len(train_mal) + len(augmented) >= target_mal:
                    break
            if len(train_mal) + len(augmented) >= target_mal:
                break

        train = train_ben + train_mal + augmented
        random.seed(43)
        random.shuffle(train)
        n_aug_mal = len(train_mal) + len(augmented)
        print(
            f"[dataPipeline_GCN] Augmented malicious: {len(train_mal)} → {n_aug_mal} "
            f"(+{len(augmented)} synthetic). New train ratio={len(train_ben)/max(n_aug_mal,1):.1f}:1"
        )

    print(f"[dataPipeline_GCN] Split → train={len(train)} val={len(val)} test={len(test)}")

    if save:
        GCN_MASTER_DIR.mkdir(parents=True, exist_ok=True)
        all_graphs = train + val + test
        train_idx  = list(range(len(train)))
        val_idx    = list(range(len(train), len(train) + len(val)))
        test_idx   = list(range(len(train) + len(val), len(all_graphs)))
        save_path  = GCN_MASTER_DIR / "gcn_dataset.pt"
        torch.save(
            {
                "graphs":    all_graphs,
                "train_idx": train_idx,
                "val_idx":   val_idx,
                "test_idx":  test_idx,
            },
            save_path,
        )
        print(f"[dataPipeline_GCN] Saved dataset to {save_path}")

    return DatasetSplit(train=train, val=val, test=test)


def load_gcn_dataset(dataset_path: "str | Path | None" = None) -> DatasetSplit:
    """Load a previously saved GCN dataset from disk."""
    import torch
    path = Path(dataset_path) if dataset_path else GCN_MASTER_DIR / "gcn_dataset.pt"
    if not path.exists():
        raise FileNotFoundError(
            f"GCN dataset not found at {path}. Run build_gcn_dataset() first."
        )
    ckpt      = torch.load(path, weights_only=False)
    graphs    = ckpt["graphs"]
    train_idx = ckpt["train_idx"]
    val_idx   = ckpt["val_idx"]
    test_idx  = ckpt["test_idx"]
    return DatasetSplit(
        train=[graphs[i] for i in train_idx],
        val=[graphs[i] for i in val_idx],
        test=[graphs[i] for i in test_idx],
    )


# ============================================================================
# Self-test (run as script)
# ============================================================================

if __name__ == "__main__":
    split = build_gcn_dataset()
    print(f"\n=== Dataset Stats ===")
    print(f"  Train : {len(split.train)} graphs")
    print(f"  Val   : {len(split.val)} graphs")
    print(f"  Test  : {len(split.test)} graphs")
    total = len(split.train) + len(split.val) + len(split.test)
    print(f"  Total : {total} graphs")
    if total > 0:
        sample = split.train[0] if split.train else split.val[0]
        print(f"\n  Sample graph x shape     : {sample.x.shape}")
        print(f"  Sample graph edge_index  : {sample.edge_index.shape}")
        print(f"  Sample graph edge_attr   : {sample.edge_attr.shape}")
        print(f"  Sample graph label       : {sample.y}")
