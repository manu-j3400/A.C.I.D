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


def hardened_Dataset_with_Normalization(data_dir='/Users/manujawahar/workspace/ACID/data/'):
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
    
    
    outputDir = Path("/Users/manujawahar/workspace/ACID/CSV_master")

    # create the directory IF it doesn't already exist
    outputDir.mkdir(parents=True, exist_ok=True)

    dataPath = outputDir / "finalData.csv"

    pd.DataFrame(data).to_csv(dataPath, index=False)

    print(f"CSV successfully saved to: {dataPath}")
    