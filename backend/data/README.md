# Data Directory Structure

This folder contains training data for the ACID vulnerability detection model.

## Folders

### `clean/`
Contains Python files with **safe, non-malicious code** samples. These are labeled `0` during training.
- Manually curated examples
- Complex algorithms (sorting, graphs, decorators)

### `corrupted/`
Contains Python files with **vulnerable/malicious code** patterns. These are labeled `1` during training.
- Manually curated security vulnerabilities
- Backdoors, obfuscation, credential theft examples

### `external/`
Contains **downloaded datasets** from external sources (e.g., Hugging Face).
- `huggingface_raw.csv`: Data from `CyberNative/Code_Vulnerability_Security_DPO`
- Automatically processed by `dataPipeline_AST.py`

## Data Flow

1. **Manual samples**: `clean/` and `corrupted/` folders
2. **External data**: `external/huggingface_raw.csv`
3. **Pipeline**: All sources → `CSV_master/finalData.csv` → `numericFeatures.csv` → Model
