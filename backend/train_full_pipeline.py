import sys
from pathlib import Path

# Add src to path so we can import modules
src_path = Path(__file__).parent / "src"
sys.path.append(str(src_path))

from dataPipeline_AST import hardened_Dataset_with_Normalization
from trainerModel_AST import modelTrainer
import extractor_AST

def main():
    print("--- 1. Running Data Pipeline ---")
    hardened_Dataset_with_Normalization()
    
    print("\n--- 2. Running Feature Extractor ---")
    # extractor_AST runs on import, but we need to reload it or ensure it runs after step 1
    # Since we just imported it, it might have run with OLD data if we aren't careful.
    # But wait, python imports run once. 
    # To be safe, let's just use subprocess for the extractor to ensure a fresh run
    import subprocess
    subprocess.run([sys.executable, str(src_path / "extractor_AST.py")], check=True)
    
    print("\n--- 3. Running Model Trainer ---")
    modelTrainer()
    
    print("\n✅ Full pipeline completed successfully!")

if __name__ == "__main__":
    main()
