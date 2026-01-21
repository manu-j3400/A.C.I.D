from pathlib import Path
import ast
import pandas as pd
from normalizer_AST import codeNormalizer
from hashlib import sha256

#Dataset Pipeline

def get_Code_Hash(codeText):
    """
    Detects duplicate functions in sample dataset
    """
    # Unique fingerprint of code to detect duplicates
    return sha256(codeText.encode('utf-8')).hexdigest()


def hardened_Dataset_with_Normalization(data_dir=str(Path(__file__).parent.parent / "data")):
    """
    Builds dataset after normalizing given data (clean and corrupted)

    """
    data = []
    seen_hashes = set()
    basePath = Path(data_dir)
    normalizer = codeNormalizer() # the brain of this operation

    dataState = {
        "clean": 0,
        "corrupted": 1
    }


    for filename, label in dataState.items():
        folderPath = basePath / filename

        # DEBUG: folder existence check
        if not folderPath.exists():
            print(f"Folder not found: {folderPath}")
            continue

        files = [f for f in folderPath.iterdir() if f.is_file() and not f.name.startswith('.')]
        print(f"Searching in {folderPath}....found {len(files)} .txt files")

        for filePath in files:
            rawCode = filePath.read_text()


            try:

                # parse the ENTIRE file
                tree = ast.parse(rawCode)

                for node in tree.body:
                    if isinstance(node, ast.FunctionDef):
                        funcRaw = ast.unparse(node)

                        # Hash function to detect duplicates
                        funcHash = get_Code_Hash(funcRaw)
                        
                        if funcHash in seen_hashes:
                            print(f"Skipping {filePath.name}_{node.name}: duplicate detected")
                            continue
                        else:
                            seen_hashes.add(funcHash)

                        funcTree = ast.Module(body=[node],type_ignores=[]) # takes the specific node function and puts it inside a new module ("file") and normalizes each function individually

                        # run the parsed code into the normalizer
                        normalizedTree = normalizer.visit(funcTree)
                        # covert back to string 
                        normalizedCode = ast.unparse(normalizedTree)

                        data.append({
                            'rawCode': ast.unparse(node),
                            'normalizedCode': normalizedCode,
                            'label': label,
                            'source': f"{filePath.name}_{node.name}"
                        })
            
            except SyntaxError:
                print("Retry")
    
    
                print("Retry")
    
    outputDir = Path(Path(__file__).parent.parent / "CSV_master")
    outputDir.mkdir(parents=True, exist_ok=True)

    # --- NEW: Ingest from Hugging Face CSV (stored in data/external) ---
    hf_csv_path = basePath / "external" / "huggingface_raw.csv"
    if hf_csv_path.exists():
        print(f"Loading Hugging Face dataset from {hf_csv_path}...")
        try:
            hf_df = pd.read_csv(hf_csv_path)
            for _, row in hf_df.iterrows():
                raw_code = row.get('rawCode', '')
                label = row.get('label', 0)
                source = row.get('source', 'hf_unknown')
                
                if not isinstance(raw_code, str) or not raw_code.strip():
                    continue

                # Strip markdown code blocks if present
                if raw_code.strip().startswith("```"):
                    lines = raw_code.strip().splitlines()
                    if lines[0].startswith("```"):
                        lines = lines[1:]
                    if lines and lines[-1].startswith("```"):
                        lines = lines[:-1]
                    raw_code = "\n".join(lines)

                try:
                     # Calculate hash for duplicate detection
                    code_hash = get_Code_Hash(raw_code)
                    if code_hash in seen_hashes:
                         continue
                    seen_hashes.add(code_hash)

                    # Parse AST
                    tree = ast.parse(raw_code)
                    
                    # Normalize entire tree (HF snippets are usually small)
                    normalizedTree = normalizer.visit(tree)
                    normalizedCode = ast.unparse(normalizedTree)
                    
                    data.append({
                        'rawCode': raw_code,
                        'normalizedCode': normalizedCode,
                        'label': label,
                        'source': source
                    })
                except Exception as e:
                    # HF data might have syntax errors or be incomplete
                    # print(f"Error parsing HF sample: {e}") 
                    continue
            print(f"Processed Hugging Face CSV. Total data size: {len(data)}")
        except Exception as e:
            print(f"Error processing Hugging Face CSV: {e}")

    
    dataPath = outputDir / "finalData.csv"

    pd.DataFrame(data).to_csv(dataPath, index=False)

    print(f"CSV successfully saved to: {dataPath}")
    