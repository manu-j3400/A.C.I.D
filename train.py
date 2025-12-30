import os
import ast
import pandas as pd
import sys
from collections import Counter
from joblib import dump
from sklearn.ensemble import RandomForestClassifier
from pathlib import Path

# --- 1. SET UP PATHS ---
ROOT_DIR = Path(__file__).resolve().parent

# Corrected path for YOUR project structure: backend/src/
SRC_PATH = str(ROOT_DIR / "backend" / "src")
if SRC_PATH not in sys.path:
    sys.path.insert(0, SRC_PATH) # Puts this at the very top of the search list

# Data folders (Root of ACID)
DATA_CLEAN = ROOT_DIR / "backend" / "data" / "clean"
DATA_MALICIOUS = ROOT_DIR / "backend" / "data" / "corrupted"

# Destination for the updated model
MODEL_DEST = ROOT_DIR / "backend" / "ML_master" / "acidModel.pkl"

# --- 2. IMPORT NORMALIZER ---
try:
    from normalizer_AST import codeNormalizer
    print("✅ Success: normalizer_AST found in backend/src/")
except ImportError as e:
    print(f"❌ Error: Could not find normalizer_AST.py in {SRC_PATH}")
    print(f"Debug Info: {e}")
    sys.exit(1)

# --- 3. TRAINING LOGIC ---
def get_features(file_path):
    try:
        with open(file_path, 'r') as f:
            code = f.read()
        tree = ast.parse(code)
        # Normalize the code exactly like your scanner does
        normalized_tree = codeNormalizer().visit(tree)
        nodes = [type(node).__name__ for node in ast.walk(normalized_tree)]
        return dict(Counter(nodes))
    except Exception as e:
        print(f"⚠️ Skipping {file_path}: {e}")
        return None

def train():
    data, labels = [], []
    
    print(f"--- Scanning Directories ---")
    for folder, label in [(DATA_CLEAN, 0), (DATA_MALICIOUS, 1)]:
        print(f"Checking folder: {folder}")
        if not os.path.exists(folder):
            print(f"❌ Folder DOES NOT EXIST at this path!")
            continue
            
        files = os.listdir(folder)
        print(f"Raw files found in folder: {files}") # This will show us if they are .txt files
        
        py_files = [f for f in files if f.endswith('.py')]
        
        for filename in py_files:
            print(f"📄 Processing: {filename} (Label: {label})")
            feat = get_features(folder / filename)
            if feat:
                data.append(feat)
                labels.append(label)

    if not data:
        print("\n❌ Final Result: Still no data found.")
        print("Double check: Are your files ending in .py? Are they definitely in the 'data' folder inside 'ACID'?")
        return

    # Train and Save
    print(f"🧠 Training model on {len(data)} samples...")
    df = pd.DataFrame(data).fillna(0)
    
    # Random Forest helps prevent overfitting by using multiple decision trees
    clf = RandomForestClassifier(n_estimators=100, random_state=42)
    clf.fit(df, labels)
    
    dump(clf, MODEL_DEST)
    print(f"✨ SUCCESS! New model saved to: {MODEL_DEST}")

if __name__ == "__main__":
    train()