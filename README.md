## A.C.I.D (Adversarial Code Injection Detector) 🛡️

**ACID** is a machine learning-powered security pipeline designed to detect malicious code injections and backdoors by analyzing the "Structural DNA" of Python functions. Instead of relying on easily bypassable keyword searches, ACID uses **Abstract Syntax Trees (AST)** to identify dangerous behavioral patterns.

## 🚀 Key Features

* **Structural Normalization:** Uses a custom `AST.NodeTransformer` to anonymize variable names and constants, making the detector resistant to simple renaming obfuscation.
* **Function-Level Granularity:** Automatically splits large source files into individual functions for precise, needle-in-a-haystack detection.
* **Hardened Pipeline:** Integrated SHA-256 hashing to ensure dataset purity and prevent duplicate bias during training.
* **Vectorization Engine:** Transforms raw Python logic into a numerical feature matrix based on AST node distribution (e.g., `Call`, `Expr`, `BinOp`, `Attribute`).

---

## 🏗️ Architecture

The project is divided into four distinct phases:

1. **Ingestion:** Scans directories, deduplicates files, and handles structural parsing.
2. **Normalization:** Rewrites code into a generic format to focus on logic rather than naming conventions.
3. **Featurization:** Extracts node counts to create a high-dimensional representation of the code.
4. **Classification:** Utilizes a **Random Forest Classifier** to distinguish between benign logic and malicious injections.

---

## 📊 Data Visualization

The pipeline converts Python functions into a numerical matrix. Below is an example of the "Structural DNA" extracted by the system:

| Function | `Assign` | `Call` | `BinOp` | `Attribute` | **Label** |
| --- | --- | --- | --- | --- | --- |
| `calculate_total` | 2.0 | 1.0 | 3.0 | 0.0 | **0 (Clean)** |
| `backdoor_shell` | 1.0 | 4.0 | 0.0 | 2.0 | **1 (Malicious)** |

---

## 🛠️ Tech Stack

* **Language:** Python 3.13+
* **Analysis:** `ast` (Standard Library)
* **Data Science:** `pandas`, `scikit-learn`
* **Serialization:** `joblib`
* **Security:** `hashlib` (SHA-256)
