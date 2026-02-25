import requests
import json
import time

url = "http://localhost:5001/generate-report"
payload = {
    "code": "import os\nos.system('rm -rf /')",
    "verdict": "MALICIOUS",
    "confidence": 98,
    "risk_level": "CRITICAL",
    "reason": "Shell Command Injection",
    "language": "python",
    "deep_scan": "This is a profound vulnerability.",
    "nodes_scanned": 15
}

r = requests.post(url, json=payload)
if r.status_code == 200:
    with open('test_report.pdf', 'wb') as f:
        f.write(r.content)
    print("Success! Downloaded test_report.pdf")
else:
    print(f"Failed: {r.status_code}\n{r.text}")
