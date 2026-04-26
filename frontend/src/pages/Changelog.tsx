import React from 'react';
import {
    Rocket,
    Zap,
    GitCommit,
    Terminal,
    Brain,
    Sparkles,
} from 'lucide-react';
import { Link } from 'react-router-dom';
import PublicNavbar from '../components/PublicNavbar';
import { COLORS } from '../theme/colors';

const C = {
    bg:      COLORS.bg,
    accent:  COLORS.acid,
    danger:  COLORS.red,
    amber:   COLORS.orange,
    text:    COLORS.text,
    subdued: COLORS.sub,
    muted:   COLORS.muted,
    border:  COLORS.border,
    font:    "'JetBrains Mono', monospace",
};

const cellStyle: React.CSSProperties = {
    borderRight: `1px solid ${C.border}`,
    padding: '0 16px',
    display: 'flex',
    alignItems: 'center',
    height: '36px',
    fontFamily: C.font,
    fontSize: '11px',
    color: C.subdued,
    whiteSpace: 'nowrap',
};

interface Release {
    version: string;
    date: string;
    title: string;
    icon: React.ElementType;
    badge: string;
    badgeColor: string;
    description: string;
    features: string[];
}

const RELEASES: Release[] = [
    {
        version: 'v2.5.0',
        date: 'March 22, 2026',
        title: 'Dashboard Redesign, UX Polish & Ruflo MCP Integration',
        icon: Sparkles,
        badge: 'Latest',
        badgeColor: C.accent,
        description: 'Complete visual overhaul of the authenticated experience — new immersive card-grid dashboard, unified design system across all pages, multi-language code editor, and the Ruflo MCP server for AI agent orchestration of security workflows.',
        features: [
            'Rebuilt the dashboard from a 3-column radar layout into a full-screen immersive card grid: ScoreArc SVG, IBM Plex Mono data values, animated progress bars, sparklines, and a live scan feed with compare/export.',
            'Replaced the sidebar navigation with a top nav bar; consistent font, active-state pill, and inline Overview/Scanner/Batch/Model Lab links across all authenticated pages.',
            'Unified Scanner, Batch Scanner, and Model Lab pages to the new design system (bg-white/[0.03] cards, bg-[#08080c] backgrounds, clean white action buttons).',
            'Added file upload + drag-and-drop to the Code Reviewer — 30+ extensions accepted (.py, .go, .rs, .ts, .java, .c, .cpp, .cs, .sh, .kt, .swift, .scala, .lua, .pl, .r, and more).',
            'Fixed multi-language syntax highlighting in the Monaco editor: full EXT_TO_MONACO map (30+ extensions), BACKEND_TO_MONACO normalization (c_sharp→csharp, golang→go, c++→cpp), and 12 regex code-pattern heuristics for language detection without a filename.',
            'Built the Ruflo MCP server (engines/ruflo/soteria-mcp): TypeScript MCP exposing soteria_scan, soteria_batch_scan, soteria_security_score, soteria_scan_history as agent tools for Claude/Ruflo orchestration.',
            'Added PR Reviewer agent (engines/ruflo/agents/pr-reviewer): triage → scan → analyze → remediate → report workflow with PASS/WARN/BLOCK verdicts.',
            'Fixed Supabase JWT compatibility: decode_token() now falls back to no-verify decode extracting sub as user_id, so scans are correctly attributed to Supabase-authenticated users.',
            'Fixed dashboard not refreshing after scans: added location.key to the useEffect dependency array so data re-fetches on every navigation.',
            'Fixed GitHub and Google OAuth redirecting to localhost in production: OAuth flows now use VITE_SITE_URL env var with window.location.origin fallback.',
            'Added card-shaped loading skeletons across the dashboard (Score arc, stat bars, clean rate fill, language pills) replacing raw — dashes.',
            'Improved mobile layout: stats column stacks to 3-col grid on sm screens, quick-nav cards are 2-col on sm, main padding and live feed height are responsive.',
            'Security audit: removed frontend/.env.vercel (contained live OIDC token + Supabase anon key) and scan_history.db (real user data) from git tracking; both added to .gitignore.',
        ],
    },
    {
        version: 'v2.4.0',
        date: 'March 9, 2026',
        title: 'Kyber ML Engine Suite & Auth Overhaul',
        icon: Brain,
        badge: 'Stable',
        badgeColor: C.text,
        description: 'Launched four independent detection engines under the Kyber architecture, each analysing a different dimension of code behaviour. Simultaneously overhauled the auth flow, removed admin-only barriers, and redesigned the Model Lab to surface live engine status.',
        features: [
            'Added Kyber Engine 3 (SNN Micro-Temporal Profiler): 8-channel semantic LIF spike encoder, F1-maximising threshold calibrator, online adapter with background retrain, and CSV bootstrapper against the 19k-row malware corpus.',
            'SNN import is now lazy (deferred to first Python scan) to eliminate Render worker boot timeout (exit code 3) caused by torch/snntorch loading at startup.',
            'Added Kyber Engine 1 scaffold: eBPF kernel probe (C/LSM hooks) + Rust loader via libbpf-rs for syscall-level behavioural telemetry.',
            'Added Kyber Engine 2 scaffold: Multi-Krum Byzantine-fault-tolerant aggregator (PyTorch) with gRPC server for federated model updates.',
            'Added Kyber siamese GCN (contrastive CFG pairs) and TDA void detector (persistent homology) scaffolds.',
            'Replaced admin-gated Model Lab with an open Detection Engines dashboard showing LIVE/OFFLINE status for all four engines, active engine count, and plain-English descriptions.',
            'Removed admin login/dashboard and AdminProvider entirely; Model Lab and all workspace tools are now accessible to all authenticated users.',
            'Added ForgotPassword page using Supabase resetPasswordForEmail with redirect-to flow.',
            'Signup now detects duplicate accounts and surfaces "Sign in instead" + "reset your password" links inline rather than a generic error.',
            'Removed 15-minute login lockout; added Google Sign-In to both Login and Signup.',
            'Added file-type validation in the code editor — non-code files (PDFs, images, etc.) are rejected on drop with an inline error message.',
            'Toned down Run Scan / Deep Scan / Apply Fix button brightness and brightened sidebar inactive nav text for improved readability.',
            'Added GH Actions kyber-pr-check workflow for automated CI taint analysis on pull requests.',
        ],
    },
    {
        version: 'v2.3.0',
        date: 'March 2, 2026',
        title: 'Supply Chain Patterns, GCN Pipeline & Drift Detection',
        icon: Zap,
        badge: 'Stable',
        badgeColor: C.text,
        description: 'Expanded the vulnerability pattern library with 100+ supply chain attack signatures, wired the GCN graph model and entropy pre-scanner into the live analysis pipeline, and added model drift monitoring with KL-divergence alerting.',
        features: [
            'Extended vulnerability_db.py from 450 to 509+ patterns: dependency confusion, typosquatting, exfiltration hooks, backdoor indicators; Go patterns 8→58, Rust 5→68.',
            'Wired Phase 2 entropy pre-scanner (torch-free Shannon entropy annotation) into /analyze as Step 1.5 — flags high-entropy string/bytes literals before the ML stage.',
            'Wired Phase 3b GCN (GATConv over control-flow graphs) into /analyze as Step 5.5 — blends graph probability into the ensemble score when test F1 ≥ 0.70.',
            'Added /api/model/drift endpoint: KL divergence between historical and recent GCN score distributions, alerts when KL > 0.5.',
            'Added scan result caching (24 h, keyed by SHA-256 code hash) to avoid redundant inference on identical submissions.',
            'Added per-user JWT rate limiting with IP fallback (20 req/min analysis, 5 req/min auth).',
            'Added webhook notifications: user_settings table, GET/POST /api/settings/webhook, fires on malicious scan result.',
            'Added CSV export for scan history (GET /api/scan-history/export, JWT-protected).',
            'Added OpenAPI/Swagger docs via flasgger — Swagger UI available at /apidocs.',
            'Added dark mode persistence via ThemeContext stored in localStorage.',
        ],
    },
    {
        version: 'v1.2.0',
        date: 'February 28, 2026',
        title: 'Full UI Overhaul & User Isolation',
        icon: Rocket,
        badge: 'Stable',
        badgeColor: C.text,
        description: 'Complete UI overhaul inspired by Neo-Brutalism and PostHog, plus critical fixes for user data isolation, Google Sign-In, GitHub OAuth, and structured request logging.',
        features: [
            'Redesigned landing page and hero section with a live Monaco Editor demo that dynamically scores code snippets in real-time.',
            'Fixed a major backend data leakage issue: scans are now correctly isolated per user_id using strictly enforced pyJWT verification middleware.',
            'Added Google Sign-In and GitHub OAuth PKCE (state param + code_challenge/verifier per RFC 7636).',
            'Added structured JSON logging with request IDs on every request for production observability.',
            'Fixed SQLite race condition with WAL mode, busy timeout, and write lock.',
            'Resolved deployment errors by migrating to standard dependencies and removing Next.js shims.',
        ],
    },
    {
        version: 'v1.1.0',
        date: 'February 20, 2026',
        title: 'Generative AI Pipeline & API Hardening',
        icon: Brain,
        badge: 'Stable',
        badgeColor: C.text,
        description: 'Migrated the AI explainer engine to Gemini 2.5 Pro and hardened the API layer with rate limiting, security headers, and a full SQL injection audit.',
        features: [
            'Migrated AI analysis pipeline to Gemini 2.5 Pro REST API for deeper structural code understanding and reduced OOM pressure.',
            'Implemented custom Server-Sent Events (SSE) streaming parser for zero-latency AI vulnerability explanations.',
            'Engineered sliding-window rate limiters: 20 req/min/IP for analysis, 5 req/min/IP for auth.',
            'Injected Helmet-equivalent HTTP security headers (X-Frame-Options, HSTS, X-Content-Type-Options) via Flask after_request.',
            'SQL injection audit: verified all SQLite3 queries use parameterized ? bindings.',
        ],
    },
    {
        version: 'v1.0.0',
        date: 'Initial Release',
        title: 'Core Architecture Deployment',
        icon: Rocket,
        badge: 'Foundation',
        badgeColor: C.subdued,
        description: 'Initial deployment of the Soteria hybrid classification architecture — custom ML model over AST features with stateless JWT auth and a batch scan pipeline.',
        features: [
            'Trained and deployed a custom Random Forest ensemble (acidModel.pkl) on Python/JS malicious syntax datasets for sub-millisecond threat detection.',
            'Built the primary feature extraction pipeline: raw code → AST → cyclomatic complexity, entropy, dangerous function frequencies (52 features).',
            'Engineered a scalable SQLite3 schema with thread-safe WAL mode for asynchronous batch scan insertions.',
            'Implemented stateless authentication using Bcrypt + PyJWT HS256 signatures.',
        ],
    },
];

export default function Changelog() {
    return (
        <div style={{ minHeight: '100vh', background: C.bg, color: C.text, fontFamily: C.font, overflowX: 'hidden', paddingTop: 76 }}>
            <PublicNavbar />

            {/* PAGE TITLE STRIP */}
            <div style={{ borderBottom: `1px solid ${C.border}`, display: 'flex', alignItems: 'stretch', height: '36px' }}>
                <div style={{ ...cellStyle, borderLeft: `1px solid ${C.border}`, color: C.text, fontWeight: 700, letterSpacing: '0.1em', fontSize: '11px' }}>
                    SYSTEM LIFECYCLE
                </div>
                <div style={{ ...cellStyle, color: C.accent }}>[ LIVE ]</div>
                <div style={{ ...cellStyle }}>{RELEASES.length} RELEASES</div>
                <div style={{ ...cellStyle }}>LATEST: {RELEASES[0].version}</div>
                <div style={{ flex: 1, borderRight: `1px solid ${C.border}` }} />
                <div style={{ ...cellStyle, borderRight: 'none' }}>UTC {new Date().toISOString().slice(11, 19)}</div>
            </div>

            {/* HEADER */}
            <section style={{ padding: '64px 48px 48px', borderBottom: `1px solid ${C.border}` }}>
                <div style={{ maxWidth: '800px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '24px' }}>
                        <GitCommit size={14} style={{ color: C.accent }} />
                        <span style={{ fontSize: '10px', color: C.subdued, letterSpacing: '0.15em' }}>EVERY RELEASE. EVERY CHANGE.</span>
                    </div>
                    <h1 style={{ fontSize: 'clamp(32px, 5vw, 56px)', fontWeight: 900, letterSpacing: '-0.02em', lineHeight: 1, margin: '0 0 16px', textTransform: 'uppercase', fontFamily: C.font }}>
                        SYSTEM LIFECYCLE
                    </h1>
                    <p style={{ fontSize: '13px', color: C.subdued, lineHeight: 1.8, margin: 0 }}>
                        Every architectural upgrade, security patch, and feature release mapped across the Soteria lifecycle.
                    </p>
                </div>
            </section>

            {/* TIMELINE */}
            <div style={{ padding: '0 48px 80px', maxWidth: '1200px' }}>
                {RELEASES.map((release, index) => (
                    <div
                        key={release.version}
                        style={{ borderBottom: `1px solid ${C.border}` }}
                    >
                        {/* Release header row */}
                        <div style={{ display: 'flex', alignItems: 'stretch', borderBottom: `1px solid ${C.border}`, height: '36px' }}>
                            <div style={{ ...cellStyle, borderRight: `1px solid ${C.border}`, color: index === 0 ? C.accent : C.text, fontWeight: 700, minWidth: '90px' }}>
                                {release.version}
                            </div>
                            <div style={{ ...cellStyle, borderRight: `1px solid ${C.border}`, color: C.subdued, minWidth: '160px' }}>
                                {release.date}
                            </div>
                            <div style={{ ...cellStyle, flex: 1, color: C.text, fontWeight: 600 }}>
                                {release.title}
                            </div>
                            <div style={{
                                ...cellStyle,
                                borderLeft: `1px solid ${C.border}`,
                                borderRight: 'none',
                                color: release.badgeColor,
                                fontWeight: 700,
                                minWidth: '90px',
                                justifyContent: 'center',
                            }}>
                                [ {release.badge.toUpperCase()} ]
                            </div>
                        </div>

                        {/* Release body */}
                        <div style={{ display: 'grid', gridTemplateColumns: '250px 1fr' }}>
                            <div style={{ borderRight: `1px solid ${C.border}`, padding: '24px 20px' }}>
                                <div style={{ color: index === 0 ? C.accent : C.subdued, marginBottom: '12px' }}>
                                    <release.icon size={20} />
                                </div>
                                <p style={{ fontSize: '11px', color: C.subdued, lineHeight: 1.8 }}>
                                    {release.description}
                                </p>
                            </div>

                            <div style={{ padding: '24px 28px' }}>
                                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: '0' }}>
                                    {release.features.map((feature, i) => (
                                        <div
                                            key={i}
                                            style={{
                                                display: 'flex',
                                                alignItems: 'flex-start',
                                                gap: '10px',
                                                padding: '8px 0',
                                                borderBottom: i < release.features.length - 1 ? `1px solid ${C.border}` : 'none',
                                            }}
                                        >
                                            <Terminal size={10} style={{ color: C.muted, marginTop: '3px', flexShrink: 0 }} />
                                            <span style={{ fontSize: '11px', color: C.subdued, lineHeight: 1.7 }}>{feature}</span>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        </div>
                    </div>
                ))}

                <div style={{ paddingTop: '24px', display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <Zap size={12} style={{ color: C.accent }} />
                    <span style={{ fontSize: '10px', color: C.subdued, letterSpacing: '0.12em' }}>
                        LAST SYNC: {new Date().toISOString().slice(0, 10)}
                    </span>
                </div>
            </div>

            {/* FOOTER */}
            <footer style={{ borderTop: `1px solid ${C.border}`, padding: '0', display: 'flex', alignItems: 'stretch', height: '36px' }}>
                <div style={{ ...cellStyle, borderLeft: `1px solid ${C.border}` }}>
                    <Link to="/" style={{ color: C.text, textDecoration: 'none', fontWeight: 700, letterSpacing: '0.15em', fontSize: '11px' }}>SOTERIA</Link>
                </div>
                <div style={{ ...cellStyle }}>
                    <span style={{ color: C.muted }}>© {new Date().getFullYear()} SOTERIA. BUILT FOR BUILDERS.</span>
                </div>
                <div style={{ flex: 1 }} />
                <div style={{ ...cellStyle, borderLeft: `1px solid ${C.border}`, borderRight: 'none' }}>
                    <Link to="/about" style={{ color: C.subdued, textDecoration: 'none', fontSize: '11px' }}>ABOUT</Link>
                </div>
                <div style={{ ...cellStyle, borderLeft: `1px solid ${C.border}`, borderRight: 'none' }}>
                    <a href="https://github.com/manujawahar/ACID" target="_blank" rel="noopener noreferrer" style={{ color: C.subdued, textDecoration: 'none', fontSize: '11px' }}>OPEN SOURCE</a>
                </div>
            </footer>
        </div>
    );
}
