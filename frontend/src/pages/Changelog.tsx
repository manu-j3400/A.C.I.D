import React from 'react';
import { motion } from 'framer-motion';
import {
    Rocket,
    Zap,
    GitCommit,
    Terminal,
    Brain,
    Sparkles,
} from 'lucide-react';
import PublicNavbar from '@/components/PublicNavbar';
import { Link } from 'react-router-dom';

interface Release {
    version: string;
    date: string;
    title: string;
    icon: React.ElementType;
    iconColor: string;
    iconBg: string;
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
        iconColor: 'text-violet-400',
        iconBg: 'bg-violet-400/10',
        badge: 'Latest',
        badgeColor: 'bg-violet-400/10 text-violet-400 border-violet-400/20',
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
        ]
    },
    {
        version: 'v2.4.0',
        date: 'March 9, 2026',
        title: 'Kyber ML Engine Suite & Auth Overhaul',
        icon: Brain,
        iconColor: 'text-cyan-400',
        iconBg: 'bg-cyan-400/10',
        badge: 'Stable',
        badgeColor: 'bg-cyan-400/10 text-cyan-400 border-cyan-400/20',
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
        ]
    },
    {
        version: 'v2.3.0',
        date: 'March 2, 2026',
        title: 'Supply Chain Patterns, GCN Pipeline & Drift Detection',
        icon: Zap,
        iconColor: 'text-yellow-400',
        iconBg: 'bg-yellow-400/10',
        badge: 'Stable',
        badgeColor: 'bg-yellow-400/10 text-yellow-400 border-yellow-400/20',
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
        ]
    },
    {
        version: 'v1.2.0',
        date: 'February 28, 2026',
        title: 'Full UI Overhaul & User Isolation',
        icon: Rocket,
        iconColor: 'text-purple-400',
        iconBg: 'bg-purple-400/10',
        badge: 'Stable',
        badgeColor: 'bg-purple-400/10 text-purple-400 border-purple-400/20',
        description: 'Complete UI overhaul inspired by Neo-Brutalism and PostHog, plus critical fixes for user data isolation, Google Sign-In, GitHub OAuth, and structured request logging.',
        features: [
            'Redesigned landing page and hero section with a live Monaco Editor demo that dynamically scores code snippets in real-time.',
            'Fixed a major backend data leakage issue: scans are now correctly isolated per user_id using strictly enforced pyJWT verification middleware.',
            'Added Google Sign-In and GitHub OAuth PKCE (state param + code_challenge/verifier per RFC 7636).',
            'Added structured JSON logging with request IDs on every request for production observability.',
            'Fixed SQLite race condition with WAL mode, busy timeout, and write lock.',
            'Resolved deployment errors by migrating to standard dependencies and removing Next.js shims.',
        ]
    },
    {
        version: 'v1.1.0',
        date: 'February 20, 2026',
        title: 'Generative AI Pipeline & API Hardening',
        icon: Brain,
        iconColor: 'text-blue-400',
        iconBg: 'bg-blue-400/10',
        badge: 'Stable',
        badgeColor: 'bg-blue-400/10 text-blue-400 border-blue-400/20',
        description: 'Migrated the AI explainer engine to Gemini 2.5 Pro and hardened the API layer with rate limiting, security headers, and a full SQL injection audit.',
        features: [
            'Migrated AI analysis pipeline to Gemini 2.5 Pro REST API for deeper structural code understanding and reduced OOM pressure.',
            'Implemented custom Server-Sent Events (SSE) streaming parser for zero-latency AI vulnerability explanations.',
            'Engineered sliding-window rate limiters: 20 req/min/IP for analysis, 5 req/min/IP for auth.',
            'Injected Helmet-equivalent HTTP security headers (X-Frame-Options, HSTS, X-Content-Type-Options) via Flask after_request.',
            'SQL injection audit: verified all SQLite3 queries use parameterized ? bindings.',
        ]
    },
    {
        version: 'v1.0.0',
        date: 'Initial Release',
        title: 'Core Architecture Deployment',
        icon: Rocket,
        iconColor: 'text-neutral-400',
        iconBg: 'bg-neutral-400/10',
        badge: 'Foundation',
        badgeColor: 'bg-neutral-400/10 text-neutral-400 border-neutral-400/20',
        description: 'Initial deployment of the Soteria hybrid classification architecture — custom ML model over AST features with stateless JWT auth and a batch scan pipeline.',
        features: [
            'Trained and deployed a custom Random Forest ensemble (acidModel.pkl) on Python/JS malicious syntax datasets for sub-millisecond threat detection.',
            'Built the primary feature extraction pipeline: raw code → AST → cyclomatic complexity, entropy, dangerous function frequencies (52 features).',
            'Engineered a scalable SQLite3 schema with thread-safe WAL mode for asynchronous batch scan insertions.',
            'Implemented stateless authentication using Bcrypt + PyJWT HS256 signatures.',
        ]
    },
];

export default function Changelog() {
    return (
        <div className="min-h-screen bg-black text-white overflow-x-hidden selection:bg-blue-600 selection:text-white">

            {/* ─── SHARED PUBLIC NAVBAR ─── */}
            <PublicNavbar />

            {/* ─── BACKGROUND GLOW ─── */}
            <div className="fixed inset-0 overflow-hidden pointer-events-none z-0">
                <div className="absolute top-[-20%] left-[-10%] w-[50%] h-[50%] bg-blue-900/10 blur-[120px] rounded-full mix-blend-screen" />
                <div className="absolute top-[40%] right-[-10%] w-[40%] h-[60%] bg-blue-800/5 blur-[120px] rounded-full mix-blend-screen" />
            </div>

            <div className="relative z-10 max-w-4xl mx-auto px-6 pt-32 pb-24">

                {/* Header */}
                <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.5 }}
                    className="mb-16"
                >
                    <p className="font-mono text-sm font-bold text-blue-400 uppercase tracking-[0.2em] mb-4 
                                  brutalist-border inline-block px-4 py-2 bg-black brutalist-shadow-cyan">
                        <GitCommit className="w-3.5 h-3.5 inline mr-2" />
                        Developer Logs
                    </p>
                    <h1 className="text-4xl md:text-5xl font-black mb-4 tracking-tight uppercase">System Lifecycle</h1>
                    <p className="text-neutral-400 text-lg max-w-2xl leading-relaxed font-mono">
                        Every architectural upgrade, security patch, and feature release mapped across the Soteria lifecycle.
                    </p>
                </motion.div>

                {/* Timeline */}
                <div className="relative before:absolute before:top-0 before:bottom-0 before:left-8 md:before:left-[120px] before:w-px before:bg-blue-500/30">
                    {RELEASES.map((release, index) => (
                        <motion.div
                            key={release.version}
                            initial={{ opacity: 0, y: 30 }}
                            whileInView={{ opacity: 1, y: 0 }}
                            viewport={{ once: true }}
                            transition={{ duration: 0.6, delay: index * 0.1, ease: [0.16, 1, 0.3, 1] }}
                            className="relative flex mb-16 last:mb-0"
                        >
                            {/* Left Date (Desktop) */}
                            <div className="hidden md:block w-[120px] flex-shrink-0 pt-1.5 pr-8 text-right">
                                <span className="text-sm font-mono text-neutral-500">{release.date}</span>
                                <div className="text-xs font-bold text-neutral-300 mt-1 font-mono">{release.version}</div>
                            </div>

                            {/* Timeline Node */}
                            <div className="absolute left-8 md:left-[120px] top-1.5 w-6 h-6 -ml-3 bg-black border-2 border-cyan-500/40 flex items-center justify-center shadow-[0_0_15px_rgba(34,211,238,0.2)]">
                                <div className="w-2 h-2 bg-cyan-400" />
                            </div>

                            {/* Content Card */}
                            <div className="ml-16 md:ml-10 flex-1">
                                {/* Mobile Date */}
                                <div className="md:hidden flex items-center gap-3 mb-2">
                                    <span className="text-sm font-bold text-neutral-300 font-mono">{release.version}</span>
                                    <span className="text-xs font-mono text-neutral-500">{release.date}</span>
                                </div>

                                <div className="bg-neutral-900 border-2 border-neutral-800 p-6 md:p-8 transition-all duration-300 hover:border-neutral-700 hover:-translate-y-1 group">
                                    <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4 mb-6">
                                        <div className="flex items-center gap-4">
                                            <div className={`p-3 ${release.iconBg} border border-neutral-800 flex-shrink-0 ${release.iconColor}`}>
                                                <release.icon className="w-6 h-6" />
                                            </div>
                                            <div>
                                                <h2 className="text-xl md:text-2xl font-black uppercase tracking-tight">{release.title}</h2>
                                            </div>
                                        </div>
                                        {release.badge && (
                                            <span className={`px-3 py-1 ${release.badgeColor} border text-xs font-bold font-mono uppercase whitespace-nowrap self-start`}>
                                                {release.badge}
                                            </span>
                                        )}
                                    </div>

                                    <p className="text-neutral-400 text-sm leading-relaxed mb-6 font-mono">
                                        {release.description}
                                    </p>

                                    <ul className="space-y-3">
                                        {release.features.map((feature, i) => (
                                            <li key={i} className="flex items-start gap-3 text-sm text-neutral-300 group/item">
                                                <Terminal className="w-4 h-4 text-cyan-500/50 mt-0.5 flex-shrink-0 group-hover/item:text-blue-400 transition-colors" />
                                                <span className="leading-relaxed font-mono">{feature}</span>
                                            </li>
                                        ))}
                                    </ul>
                                </div>
                            </div>
                        </motion.div>
                    ))}
                </div>

                {/* Footer Prompt */}
                <motion.div
                    initial={{ opacity: 0 }}
                    whileInView={{ opacity: 1 }}
                    viewport={{ once: true }}
                    transition={{ delay: 0.3 }}
                    className="mt-24 text-center pb-8"
                >
                    <div className="inline-flex items-center justify-center p-1 px-4 bg-neutral-900 border border-neutral-800">
                        <span className="text-xs text-neutral-500 font-mono flex items-center gap-2">
                            <Zap className="w-3 h-3 text-yellow-500/70" /> Updates automatically synchronized
                        </span>
                    </div>
                </motion.div>
            </div>

            {/* ─── FOOTER ─── */}
            <footer className="border-t-2 border-neutral-800 bg-black text-neutral-400 py-16 text-sm font-mono relative">
                <div className="max-w-6xl mx-auto px-6 flex flex-col md:flex-row justify-between items-center gap-6">
                    <Link to="/" className="flex items-center gap-3 group">
                        <img src="/soteria-logo.png" alt="Soteria" className="h-8 w-8 rounded-none object-cover transition-transform group-hover:-translate-y-[2px]" />
                        <span className="text-xl font-mono font-bold tracking-[0.15em] uppercase text-white">SOTERIA</span>
                    </Link>
                    <div className="text-neutral-500 text-[10px] tracking-widest uppercase">
                        © {new Date().getFullYear()} Soteria. Built for builders.
                    </div>
                </div>
            </footer>
        </div>
    );
}
