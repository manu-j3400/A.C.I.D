import React from 'react';
import { motion } from 'framer-motion';
import {
    Rocket,
    Zap,
    GitCommit,
    Terminal,
    Brain,
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
        version: 'v1.2.0',
        date: 'March 2, 2026',
        title: 'Full UI Overhaul & User Isolation',
        icon: Zap,
        iconColor: 'text-yellow-400',
        iconBg: 'bg-yellow-400/10',
        badge: 'New',
        badgeColor: 'bg-yellow-400/10 text-yellow-400 border-yellow-400/20',
        description: 'Complete UI overhaul inspired by Neo-Brutalism and PostHog, plus critical fixes for user data isolation before our Product Hunt launch.',
        features: [
            'Redesigned the landing page.',
            'Upgraded the Hero Section with a live, interactive Monaco Editor demo that dynamically scores code snippets in real-time.',
            'Fixed a major backend data leakage issue: Scans are now correctly isolated per user_id using strictly enforced pyJWT verification middleware.',
            'Removed some features to streamline the core gamified learning UI.',
            'Resolved deployment errors by migrating to standard dependencies and removing Next.js shims.'
        ]
    },
    {
        version: 'v1.1.0',
        date: 'February 28, 2026',
        title: 'Generative AI Pipeline & API Hardening',
        icon: Brain,
        iconColor: 'text-blue-400',
        iconBg: 'bg-blue-400/10',
        badge: 'Latest',
        badgeColor: 'bg-blue-400/10 text-blue-400 border-blue-400/20',
        description: 'Completed a major architectural overhaul by migrating the secondary AI Explainer engine from a local LLM environment to Google Gemini 2.5 Pro, accompanied by comprehensive backend security hardening at the network level.',
        features: [
            'Migrated AI Analysis pipeline to Gemini 2.5 Pro REST API for significantly deeper structural code understanding and reduced OOM pressure.',
            'Implemented custom Server-Sent Events (SSE) streaming parser to handle continuous JSON chunks for zero-latency AI vulnerability explanations.',
            'Engineered strict sliding-window rate limiters utilizing an in-memory thread-safe dictionary (20 req/min/IP for analysis, 5 req/min/IP for auth).',
            'Injected Helmet-equivalent HTTP Security Headers (X-Frame-Options, HSTS, X-Content-Type-Options) via a Flask after_request proxy.',
            'Conducted SQL Injection (SQLi) audit: verified all SQLite3 database queries utilize parameterized ? bindings to prevent malicious payload execution.'
        ]
    },
    {
        version: 'v1.0.0',
        date: 'Initial Release',
        title: 'Core Architecture Deployment',
        icon: Rocket,
        iconColor: 'text-purple-400',
        iconBg: 'bg-purple-400/10',
        badge: 'Stable',
        badgeColor: 'bg-purple-400/10 text-purple-400 border-purple-400/20',
        description: 'Initial deployment of the Soteria hybrid classification architecture. Integrates a custom machine-learning model with syntax analysis to detect vulnerabilities in Abstract Syntax Trees (ASTs) before runtime.',
        features: [
            'Trained and deployed a custom Random Forest ML Model (acidModel.pkl) on extensive datasets of Python/JS malicious syntax for sub-millisecond threat detection.',
            'Established the primary feature extraction pipeline to parse Raw Code into ASTs, calculating cyclomatic complexity, entropy, and dangerous function frequencies.',
            'Engineered a scalable SQLite3 schema with thread-safe check_same_thread=False locking to handle asynchronous batch scan insertions from GitHub webhooks.',
            'Implemented secure, stateless authentication using Bcrypt and PyJWT, utilizing HS256 signatures to separate Standard and Administrator privileges.'
        ]
    }
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
