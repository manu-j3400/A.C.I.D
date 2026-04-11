# Soteria Roadmap

Prioritized improvement tasks for the autonomous agent.
Tasks marked `[ ]` are available. `[~]` means in progress. `[x]` means done.

## P0 — Critical

- [x] Add comprehensive test suite for middleware API endpoints (analyze, batch-scan, github-scan)
- [x] Add input validation and sanitization for all user-facing API endpoints
- [x] Fix potential race condition in scan history SQLite writes under concurrent batch scans

## P1 — High

- [x] Optimize AST parsing logic for large files (>10k lines) to reduce scan latency
- [x] Add new vulnerability detection patterns for supply chain attacks (dependency confusion, typosquatting)
- [x] Implement structured error logging with request IDs for production debugging
- [x] Add model performance metrics tracking (precision, recall, F1) after each retrain
- [x] Harden GitHub OAuth flow with PKCE and state parameter validation

## P2 — Medium

- [x] Add rate limiting per authenticated user (not just IP-based)
- [x] Implement scan result caching to avoid re-scanning identical code within 24h
- [x] Add support for scanning Go and Rust codebases via tree-sitter
- [x] Create automated model drift detection (alert when prediction distribution shifts)
- [x] Add webhook notifications for completed scans (Slack/Discord integration)

## P3 — Low

- [x] Add dark mode persistence across sessions in frontend
- [x] Improve PDF report layout and add executive summary section
- [x] Add bulk export of scan history as CSV
- [x] Create API documentation with OpenAPI/Swagger spec

## Engines — Production

- [x] Module 1 scaffold: eBPF kernel probe (C/LSM hooks) + Rust loader (libbpf-rs)
- [x] Module 1 production: eBPF policy hot-reload via inotify + per-IP/port allowlist filtering
- [x] Module 2 scaffold: Multi-Krum PyTorch aggregator + gRPC server
- [x] Module 3 scaffold: GPU sentinel (nvml-wrapper + rustfft + FFT anomaly detection)
- [x] Module 3 production: Adaptive noise-floor calibration per GPU model (5σ threshold)
- [x] SNN baseline bootstrap: sandboxed execution (chdir + stdin redirect + 5s timeout per sample)
- [x] AgentShield (Project #9): Real-time TOCTOU mitigation engine for browser-use agents (DOM Merkle-hash + plan-validate-act cycle)
- [x] DeceptiNet (Project #10): Adaptive honeypot orchestrator using hypergame-theoretic DRL (PPO + belief-state particle filter)
- [x] SymbAPT (Project #11): Neurosymbolic APT hunter with differentiable MITRE ATT&CK logic rules + Kafka streaming pipeline
- [x] RLShield (Project #12): Multi-agent RL SOC response orchestrator (MAPPO + particle-filter belief tracker + Wazuh integration)
- [x] PhishGraph (Project #4): DOM-structural phishing detector integrated into middleware
- [x] DualSentinel / PromptCFI (Project #8): Prompt CFI + entropy lull detection in middleware
- [x] TrustBoundary (Project #3): Zero-trust multi-agent orchestration (engines/ruflo/trust-boundary/)
- [x] RAGGuard (Project #2): Multimodal RAG knowledge-base poisoning scanner (engines/ragguard/)
- [x] PR Reviewer Agent: Soteria-powered automated PR security review (engines/ruflo/agents/pr-reviewer/)
- [x] MemShield (Engine #13): Memory-exploit detection — taint tracking + ROP chain detection + heap spray analysis
- [x] ContainerGuard (Engine #14): Container escape detection via eBPF syscall GNN (CTDE + escape classifier)
- [x] Vulnerability DB expansion: 509 → 739 patterns; Java (+70), JS/TS (+60), C/C++ (+50), PHP (+30), secrets/cloud (+20)
- [x] /api/engines/status endpoint: live status of all 10 detection engines + vulnerability pattern count
