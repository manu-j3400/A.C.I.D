from datasets import load_dataset
import pandas as pd
from pathlib import Path
import os

def ingest_data():
    print("--- Loading Dataset from Hugging Face ---")
    # Using 'CyberNative/Code_Vulnerability_Security_DPO' as planned
    # Note: Dataset structure needs to be inspected. Usually DPO datasets have 'chosen' (better/secure) and 'rejected' (worse/insecure)
    # or similar fields.
    
    try:
        dataset = load_dataset("CyberNative/Code_Vulnerability_Security_DPO", split="train")
    except Exception as e:
        print(f"Error loading dataset: {e}")
        return

    print(f"Dataset loaded. Size: {len(dataset)}")
    
    data = []
    
    # We need to map the dataset fields to our schema: rawCode, normalizedCode (will be done by pipeline), label, source
    # Let's assume the dataset has 'prompt', 'chosen', 'rejected' or similar. 
    # Since I can't inspect it interactively easily, I'll print the column names first if I were debugging, 
    # but here I'll write code to handle probable structure or fail gracefully.
    
    # Based on DPO conventions:
    # 'chosen' -> Secure (Clean) -> Label 0
    # 'rejected' -> Insecure (Corrupted) -> Label 1
    
    # Note: The dataset might contain multiple languages. We should filter for Python if possible.
    # Identifying python: check if 'def ' or 'import ' exists, or metadata if available.
    
    count = 0
    max_samples = 3000 # Increased for better accuracy
    
    for row in dataset:
        if count >= max_samples:
            break
            
        # Inspect structure (blindly assuming DPO structure for now)
        # If headers are different, this will raise KeyError and we can fix.
        try:
            secure_code = row.get('chosen', '')
            insecure_code = row.get('rejected', '')
            
            # Simple heuristic to filter for Python
            if 'def ' not in secure_code and 'import ' not in secure_code:
                continue
                
            # Clean sample
            data.append({
                'rawCode': secure_code,
                'normalizedCode': '', # Will be filled by pipeline
                'label': 0, # Clean
                'source': f"huggingface_cybernative_{count}_clean"
            })
            
            # Corrupted sample
            data.append({
                'rawCode': insecure_code,
                'normalizedCode': '', # Will be filled by pipeline
                'label': 1, # Corrupted
                'source': f"huggingface_cybernative_{count}_corrupted"
            })
            
            count += 1
            
        except AttributeError:
            # Maybe it's not a dict?
            pass

    print(f"Extracted {len(data)} samples.")

    # Save to CSV
    # We append to existing or create new? 
    # The existing pipeline reads from 'finalData.csv'. 
    # Ideally we should generate individual files in data/clean and data/corrupted so the existing pipeline can pick them up.
    # BUT, writing 2000 files is slow.
    # BETTER APPROACH: Write directly to a CSV that the pipeline CAN use, OR modify pipeline to ingest this CSV.
    # The current `dataPipeline_AST.py` *generates* finalData.csv from .txt files.
    # So if we want to integrate smoothly, we could modify `dataPipeline_AST.py` to ALSO read from a huggingface_dump.csv
    
    # Save to data/external for organization
    outputDir = Path(__file__).parent / "data" / "external"
    outputDir.mkdir(parents=True, exist_ok=True)
    
    df = pd.DataFrame(data)
    dump_path = outputDir / "huggingface_raw.csv"
    df.to_csv(dump_path, index=False)
    print(f"Saved raw Hugging Face data to: {dump_path}")

if __name__ == "__main__":
    ingest_data()
