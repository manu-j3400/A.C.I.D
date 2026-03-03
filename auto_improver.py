import os
import sys
import subprocess
import requests
import json
from pathlib import Path

# --- Configuration ---
# You can run this script directly on a cron job or call it via an n8n Webhook
# Set your Anthropic API Key in your environment variables.
ANTHROPIC_API_KEY = os.environ.get("ANTHROPIC_API_KEY")

if not ANTHROPIC_API_KEY:
    print("❌ Critical Error: ANTHROPIC_API_KEY is missing from environment variables.")
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

def call_claude(prompt: str) -> str:
    """Send a request to the Anthropic REST API for Claude 3.5 Sonnet."""
    url = "https://api.anthropic.com/v1/messages"
    headers = {
        "x-api-key": ANTHROPIC_API_KEY,
        "anthropic-version": "2023-06-01",
        "content-type": "application/json"
    }
    
    data = {
        "model": "claude-3-5-sonnet-20241022",
        "max_tokens": 4000,
        "system": SYSTEM_PROMPT,
        "messages": [
            {"role": "user", "content": prompt}
        ]
    }
    
    print("🤖 Prompting Claude...")
    response = requests.post(url, headers=headers, json=data)
    
    if response.status_code == 200:
        return response.json()['content'][0]['text']
    else:
        print(f"❌ API Error {response.status_code}: {response.text}")
        return ""

def gather_context():
    """Run tools to gather the current state of the codebase for Claude."""
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
    2. Prompt Claude
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

    # Send to Claude
    output = call_claude(prompt)
    
    if not output:
        return
        
    print("\n📝 Claude's Proposed Changes:")
    print("-" * 40)
    print(output)
    print("-" * 40)
    
    # In a full setup, you would use a strict AST-parsing script to apply Claude's diff
    # or let an agentic framework like n8n execute the CLI tools to write the file.
    # For now, it logs the suggestion which can be manually approved or piped to 'patch'.

if __name__ == "__main__":
    instruction = sys.argv[1] if len(sys.argv) > 1 else None
    execute_improvement_loop(instruction)
