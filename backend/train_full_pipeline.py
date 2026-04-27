import argparse
import subprocess
import sys
from pathlib import Path

# Add src to path so we can import modules
src_path = Path(__file__).parent / "src"
sys.path.append(str(src_path))

from dataPipeline_AST import hardened_Dataset_with_Normalization
from trainerModel_AST import modelTrainer
import extractor_AST


def run_gcn_pipeline() -> None:
    """Phase 3: Build GCN dataset and train the GATConv model."""
    try:
        from dataPipeline_GCN import build_gcn_dataset
        from trainerModel_GCN import train_gcn
    except ImportError as exc:
        print(f"\n[train_full_pipeline] Skipping GCN track — PyTorch Geometric not installed: {exc}")
        return

    print("\n--- 3b. Building GCN Dataset ---")
    build_gcn_dataset()

    print("\n--- 3c. Training GATConv GCN Model ---")
    metrics = train_gcn(epochs=100)
    print(f"[train_full_pipeline] GCN test metrics: {metrics}")
    if metrics.get("f1", 0.0) < 0.60:
        print(
            "[train_full_pipeline] Warning: GCN test F1 < 0.60. "
            "GCN blending in /analyze will be disabled until model improves."
        )


def main() -> None:
    parser = argparse.ArgumentParser(description="ACID full training pipeline")
    grp = parser.add_mutually_exclusive_group()
    grp.add_argument(
        "--skip-gcn",
        action="store_true",
        help="Run only the AST/sklearn track (Phases 1–3a); skip GCN training.",
    )
    grp.add_argument(
        "--gcn-only",
        action="store_true",
        help="Run only the GCN track (Phases 3b–3c); skip AST/sklearn steps.",
    )
    args = parser.parse_args()

    if not args.gcn_only:
        print("--- 1. Running Data Pipeline ---")
        hardened_Dataset_with_Normalization()

        print("\n--- 2. Running Feature Extractor ---")
        # extractor_AST runs on import; use subprocess to guarantee fresh execution
        # after step 1 produces updated CSV data.
        subprocess.run([sys.executable, str(src_path / "extractor_AST.py")], check=True)

        print("\n--- 3a. Training AST Ensemble Model ---")
        modelTrainer()

    if not args.skip_gcn:
        run_gcn_pipeline()

    print("\n✅ Full pipeline completed successfully!")


if __name__ == "__main__":
    main()
