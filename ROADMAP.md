# Soteria Roadmap

Prioritized improvement tasks for the autonomous agent.
Tasks marked `[ ]` are available. `[~]` means in progress. `[x]` means done.

## P0 — Critical

- [ ] Add comprehensive test suite for middleware API endpoints (analyze, batch-scan, github-scan)
- [x] Add input validation and sanitization for all user-facing API endpoints
- [ ] Fix potential race condition in scan history SQLite writes under concurrent batch scans

## P1 — High

- [ ] Optimize AST parsing logic for large files (>10k lines) to reduce scan latency
- [ ] Add new vulnerability detection patterns for supply chain attacks (dependency confusion, typosquatting)
- [ ] Implement structured error logging with request IDs for production debugging
- [ ] Add model performance metrics tracking (precision, recall, F1) after each retrain
- [ ] Harden GitHub OAuth flow with PKCE and state parameter validation

## P2 — Medium

- [ ] Add rate limiting per authenticated user (not just IP-based)
- [ ] Implement scan result caching to avoid re-scanning identical code within 24h
- [ ] Add support for scanning Go and Rust codebases via tree-sitter
- [ ] Create automated model drift detection (alert when prediction distribution shifts)
- [ ] Add webhook notifications for completed scans (Slack/Discord integration)

## P3 — Low

- [ ] Add dark mode persistence across sessions in frontend
- [ ] Improve PDF report layout and add executive summary section
- [ ] Add bulk export of scan history as CSV
- [ ] Create API documentation with OpenAPI/Swagger spec
