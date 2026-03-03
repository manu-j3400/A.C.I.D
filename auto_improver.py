import os
import sys
import subprocess
import requests
import json

# --- Configuration ---
# You can run this script directly on a cron job or call it via a Make webhook.
# Prefer a dedicated automation key and fall back to the app-level Gemini key.
GEMINI_API_KEY = os.environ.get("GEMINI_AUTOMATION_KEY") or os.environ.get("GEMINI_API_KEY")
GEMINI_MODEL = os.environ.get("GEMINI_MODEL", "gemini-1.5-flash")

if not GEMINI_API_KEY:
    print("❌ Critical Error: GEMINI_AUTOMATION_KEY or GEMINI_API_KEY is missing.")
    sys.exit(1)

# Prompt instructions designed to instruct Claude to output valid code diffs.
SYSTEM_PROMPT = """
You are an autonomous expert software engineer tasked with iteratively improving the Soteria codebase. 
You will be provided with git status, recent commit logs, test suite output, or a specific user instruction.
Your objective is to:
1. Identify bugs, performance bottlenecks, or clean up dead code.
2. Output your proposed changes ONLY in standard GNU diff or regex patch format.
3. Keep changes isolated per run. Do not attempt massive multi-file refactors in a single pass.
"""

def call_gemini(prompt: str) -> str:
    """Send a request to Gemini Flash and return generated text."""
    url = f"https://generativelanguage.googleapis.com/v1beta/models/{GEMINI_MODEL}:generateContent?key={GEMINI_API_KEY}"
    headers = {"content-type": "application/json"}
    data = {
        "system_instruction": {
            "parts": [{"text": SYSTEM_PROMPT}]
        },
        "contents": [
            {
                "role": "user",
                "parts": [{"text": prompt}]
            }
        ],
        "generationConfig": {
            "temperature": 0.2,
            "maxOutputTokens": 4000
        }
    }

    print(f"🤖 Prompting Gemini ({GEMINI_MODEL})...")
    response = requests.post(url, headers=headers, json=data, timeout=90)

    if response.status_code != 200:
        print(f"❌ API Error {response.status_code}: {response.text}")
        return ""

    payload = response.json()
    candidates = payload.get("candidates", [])
    if not candidates:
        print("❌ API Error: Gemini returned no candidates.")
        return ""

    parts = candidates[0].get("content", {}).get("parts", [])
    text = "".join(part.get("text", "") for part in parts if isinstance(part, dict))
    if not text.strip():
        print("❌ API Error: Gemini candidate had no text content.")
        return ""

    return text

def gather_context():
    """Run tools to gather the current state of the codebase for Gemini."""
    try:
        git_diff = subprocess.check_output(['git', 'diff']).decode('utf-8')
        git_status = subprocess.check_output(['git', 'status', '-s']).decode('utf-8')
        return f"Git Status:\n{git_status}\n\nUncommitted Diff:\n{git_diff}"
    except Exception as e:
        return f"Error gathering git status: {e}"

def execute_improvement_loop(instruction=None):
    """
    The main execution flow:
    1. Gather Context
    2. Prompt Gemini
    3. Apply Patch
    4. Verify Build/Tests
    """
    print("🔄 Starting Continuous Improvement Loop...")
    context = gather_context()
    
    prompt = f"Here is the current repository context:\n{context}\n\n"
    if instruction:
        prompt += f"SPECIFIC INSTRUCTION: {instruction}\n"
    else:
        prompt += "Analyze the codebase state and propose an isolated, structured optimization or bug fix. Return the file path and the raw code to replace."

    # Send to Gemini
    output = call_gemini(prompt)
    
    if not output:
        return False
        
    print("\n📝 Gemini's Proposed Changes:")
    print("-" * 40)
    print(output)
    print("-" * 40)
    
    # In a full setup, you would use a strict AST-parsing script to apply the model diff
    # or let an agentic framework execute CLI tools to write the file.
    # For now, it logs the suggestion which can be manually approved or piped to 'patch'.
    return True

if __name__ == "__main__":
    instruction = sys.argv[1] if len(sys.argv) > 1 else None
    success = execute_improvement_loop(instruction)
    sys.exit(0 if success else 1)
