# Soteria × Ruflo Integration

Exposes Soteria's security scanning API as MCP tools so Ruflo/Claude agents can
orchestrate security analysis, PR reviews, and batch scanning workflows.

## Setup

```bash
cd engines/ruflo/soteria-mcp
npm install
npm run build
```

## Register with Claude Code (one-time)

Add to your `~/.claude/claude_code_config.json` or run:

```bash
claude mcp add soteria \
  --env SOTERIA_API_URL=https://a-c-i-d-1.onrender.com \
  --env SOTERIA_TOKEN=<your-jwt> \
  node /path/to/engines/ruflo/soteria-mcp/dist/index.js
```

## Available Tools

| Tool | What it does |
|------|-------------|
| `soteria_scan` | Scan a single code snippet — returns risk level, vulnerabilities[], CWEs |
| `soteria_batch_scan` | Scan multiple files in parallel — returns sorted results + summary |
| `soteria_security_score` | Aggregate score, grade, clean rate, 30-day trend |
| `soteria_scan_history` | Paginated history with filters |

## PR Reviewer Agent

```bash
cd engines/ruflo/agents/pr-reviewer
SOTERIA_TOKEN=<jwt> ./run.sh "Scan these files from PR #42: [paste code]"
```

The agent follows a triage → scan → analyze → remediate → report workflow
and outputs a structured verdict (PASS ✅ / WARN ⚠️ / BLOCK 🚫).
