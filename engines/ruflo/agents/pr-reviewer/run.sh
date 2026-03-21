#!/usr/bin/env bash
# Run the Soteria PR Reviewer agent via ruflo
# Usage: ./run.sh "Review PR #42 — files: src/auth.py, middleware/app.py"

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
AGENT_DIR="$SCRIPT_DIR"
MCP_SERVER="$(cd "$SCRIPT_DIR/../../soteria-mcp" && pwd)"

if [[ -z "${SOTERIA_TOKEN:-}" ]]; then
  echo "⚠️  SOTERIA_TOKEN not set. Scans will run unauthenticated (no history saved)."
fi

# Build MCP server if needed
if [[ ! -f "$MCP_SERVER/dist/index.js" ]]; then
  echo "Building Soteria MCP server..."
  (cd "$MCP_SERVER" && npm install --silent && npm run build)
fi

# Run agent with ruflo, pointing at this directory's CLAUDE.md
exec claude \
  --mcp-server "soteria:node $MCP_SERVER/dist/index.js" \
  --system-prompt "$AGENT_DIR/CLAUDE.md" \
  --print \
  "$@"
