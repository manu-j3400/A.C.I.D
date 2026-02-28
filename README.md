# Soteria

A machine learning-powered security pipeline designed to detect malicious code injections and backdoors by analyzing the "Structural DNA" of Python functions. Instead of relying on easily bypassable keyword searches, Soteria uses **Abstract Syntax Trees (AST)** to identify dangerous behavioral patterns.

## Key Features

* **Structural Normalization:** Utilizes a custom `AST.NodeTransformer` to anonymize variable names and constants, rendering the detector resistant to simple renaming obfuscation.
* **Function-Level Granularity:** Automatically divides large source files into individual functions for precise, targeted detection.
* **Hardened Pipeline:** Integrates SHA-256 hashing to ensure dataset purity and prevent duplicate bias during training.
* **Vectorization Engine:** Transforms raw Python logic into a numerical feature matrix based on AST node distribution (e.g., `Call`, `Expr`, `BinOp`, `Attribute`).

---

## Data Visualization

The pipeline converts Python functions into a numerical matrix. Below is an example of the "Structural DNA" extracted by the system:

| Function | `Assign` | `Call` | `BinOp` | `Attribute` | **Label** |
| --- | --- | --- | --- | --- | --- |
| `calculate_total` | 2.0 | 1.0 | 3.0 | 0.0 | **0 (Clean)** |
| `backdoor_shell` | 1.0 | 4.0 | 0.0 | 2.0 | **1 (Malicious)** |

---

## Architecture

This project utilizes a split-deployment architecture for maximum performance and stability:

* **Frontend:** React, Vite, and Tailwind CSS (Hosted on Vercel)
* **Intelligence Engine:** Flask, Scikit-Learn, and Watchdog (Hosted on Render via Docker)
* **Model:** Random Forest Classifier analyzing Abstract Syntax Trees (AST)

---

## Tech Stack

* **Language:** Python 3.13+
* **Analysis:** `ast` (Standard Library)
* **Data Science & ML Logic:** `pandas`, `scikit-learn`, `joblib`
* **Backend:** Flask, FPDF2 (Reporting)
* **Frontend:** TypeScript, React, Vite, Tailwind CSS, Framer Motion, Lucide Icons
* **Security:** `hashlib` (SHA-256)
* **DevOps:** Docker, GitHub Actions, Render, Vercel

---

## Project Structure

* `/middleware`: Contains `app.py` (The API server).
* `/backend`: Contains `requirements.txt`, training data, and the serialized ML model.
* `/frontend`: The Cyber Sentinel dashboard.
* `watch_data.py`: Background process for automated model retraining.

---

## Deployment Instructions

1. **Backend (Render):** https://a-c-i-d-1.onrender.com
2. **Frontend (Vercel):** https://codebasesentinel.vercel.app/
