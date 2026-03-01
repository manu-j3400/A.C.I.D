import React from 'react';
import { motion } from 'framer-motion';
import {
    Rocket,
    ShieldCheck,
    Zap,
    GitCommit,
    Database,
    Terminal,
    Brain,
    ArrowRight
} from 'lucide-react';
import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';

interface Release {
    version: string;
    date: string;
    title: string;
    icon: React.ElementType;
    iconColor: string;
    badge: string;
    description: string;
    features: string[];
}

const RELEASES: Release[] = [
    {
        version: 'v1.1.0',
        date: 'February 28, 2026',
        title: 'Gemini 2.5 Pro & Enterprise Security',
        icon: Brain,
        iconColor: 'text-blue-400',
        badge: 'Latest',
        description: 'A massive architectural shift moving the AI Explainer engine from local models to Google Gemini 2.5 Pro, accompanied by comprehensive backend security hardening.',
        features: [
            'Migrated AI Analysis from Llama 3.1 to Gemini 2.5 Pro for significantly deeper structural code understanding.',
            'Implemented real-time Server-Sent Events (SSE) streaming for instantaneous AI vulnerability explanations.',
            'Added strict sliding-window rate limiters to prevent API credit spam (20 req/min for analysis, 5 req/min for auth).',
            'Injected Helmet-equivalent HTTP Security Headers (X-Frame-Options, HSTS, X-Content-Type-Options) to protect against XSS and sniffing.',
            'Comprehensive codebase cleanup: wiped Next.js legacy shims and unused training logs from the root repository.'
        ]
    },
    {
        version: 'v1.0.0',
        date: 'Initial Launch',
        title: 'Soteria Platform Premiere',
        icon: Rocket,
        iconColor: 'text-purple-400',
        badge: 'Stable',
        description: 'The global premiere of Soteria. A hybrid machine-learning and generative AI platform designed to catch Zero-Day vulnerabilities in enterprise codebases.',
        features: [
            'Deployed Custom Random Forest ML Model (`acidModel`) trained on Python/JS malware datasets for sub-millisecond AST detection.',
            'Launched the Real-Time Developer Dashboard featuring interactive vulnerability metrics and historical scan trends.',
            'Released the Batch Repository Scanner with integrated GitHub OAuth to analyze entire repositories symmetrically.',
            'Rolled out the Neural Engine Admin Lab for direct dataset and model retraining.',
            'Established secure JWT role-based authentication separating Developer and Admin environments.'
        ]
    }
];

const containerVariants = {
    hidden: { opacity: 0 },
    visible: {
        opacity: 1,
        transition: { staggerChildren: 0.2 }
    }
};

const itemVariants = {
    hidden: { opacity: 0, x: -20 },
    visible: { opacity: 1, x: 0, transition: { type: "spring", stiffness: 100 } }
};

export default function Changelog() {
    return (
        <div className="min-h-screen bg-black text-white selection:bg-blue-500/30">

            {/* ─── PUBLIC NAVBAR ─── */}
            <nav className="fixed top-0 left-0 right-0 z-50 bg-black/60 backdrop-blur-2xl border-b border-blue-500/10">
                <div className="max-w-7xl mx-auto flex items-center justify-between px-6 h-16">
                    <Link to="/home" className="flex items-center gap-3 group">
                        <img src="/soteria-logo.png" alt="Soteria" className="h-9 w-9 rounded-lg object-cover group-hover:scale-105 transition-transform" />
                        <span className="text-lg font-black tracking-tight">SOTERIA</span>
                    </Link>

                    <div className="hidden md:flex items-center gap-8">
                        <Link to="/home#features" className="text-sm text-neutral-500 hover:text-blue-300 transition-colors">Features</Link>
                        <Link to="/home#how-it-works" className="text-sm text-neutral-500 hover:text-blue-300 transition-colors">How It Works</Link>
                        <Link to="/changelog" className="text-sm text-blue-400 font-medium">Dev Changes</Link>
                    </div>

                    <div className="flex items-center gap-3">
                        <Link to="/dashboard">
                            <Button variant="ghost" className="text-sm text-neutral-400 hover:text-white font-medium h-9 px-4 hidden sm:flex">
                                Dashboard
                            </Button>
                        </Link>
                        <Link to="/signup">
                            <Button className="text-sm font-semibold h-9 px-5 bg-gradient-to-r from-blue-600 to-blue-500 text-white hover:from-blue-500 hover:to-blue-400 rounded-lg shadow-lg shadow-blue-600/20">
                                Get Started
                            </Button>
                        </Link>
                    </div>
                </div>
            </nav>

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
                    <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-blue-500/10 border border-blue-500/20 text-blue-400 text-xs font-semibold uppercase tracking-widest mb-6">
                        <GitCommit className="w-3.5 h-3.5" />
                        Developer Logs
                    </div>
                    <h1 className="text-4xl md:text-5xl font-black mb-4 tracking-tight">System Changelog Phase</h1>
                    <p className="text-neutral-400 text-lg max-w-2xl leading-relaxed">
                        Every architectural upgrade, security patch, and feature release mapped across the Soteria lifecycle. Stay updated on the latest AI capability integrations.
                    </p>
                </motion.div>

                {/* Timeline */}
                <motion.div
                    variants={containerVariants}
                    initial="hidden"
                    animate="visible"
                    className="relative before:absolute before:top-0 before:bottom-0 before:left-8 md:before:left-[120px] before:w-px before:bg-gradient-to-b before:from-blue-500/50 before:via-blue-500/10 before:to-transparent"
                >
                    {RELEASES.map((release, index) => (
                        <motion.div key={release.version} variants={itemVariants} className="relative flex mb-16 last:mb-0">

                            {/* Left Date (Desktop) */}
                            <div className="hidden md:block w-[120px] flex-shrink-0 pt-1.5 pr-8 text-right">
                                <span className="text-sm font-mono text-neutral-500">{release.date}</span>
                                <div className="text-xs font-bold text-neutral-300 mt-1">{release.version}</div>
                            </div>

                            {/* Timeline Node */}
                            <div className="absolute left-8 md:left-[120px] top-1.5 w-6 h-6 -ml-3 rounded-full bg-black border-2 border-blue-500/30 flex items-center justify-center shadow-[0_0_15px_rgba(59,130,246,0.2)]">
                                <div className="w-2 h-2 rounded-full bg-blue-400" />
                            </div>

                            {/* Content Card */}
                            <div className="ml-16 md:ml-10 flex-1">
                                {/* Mobile Date */}
                                <div className="md:hidden flex items-center gap-3 mb-2">
                                    <span className="text-sm font-bold text-neutral-300">{release.version}</span>
                                    <span className="text-xs font-mono text-neutral-500">{release.date}</span>
                                </div>

                                <div className="bg-neutral-900/40 backdrop-blur-md border border-white/[0.05] hover:border-white/[0.1] transition-colors rounded-2xl p-6 md:p-8">
                                    <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4 mb-6">
                                        <div className="flex items-center gap-4">
                                            <div className={`p-3 rounded-xl bg-neutral-950 border border-white/[0.05] shadow-inner flex-shrink-0 ${release.iconColor}`}>
                                                <release.icon className="w-6 h-6" />
                                            </div>
                                            <div>
                                                <h2 className="text-xl md:text-2xl font-bold">{release.title}</h2>
                                            </div>
                                        </div>
                                        {release.badge && (
                                            <span className="px-3 py-1 bg-blue-500/10 text-blue-400 border border-blue-500/20 rounded-full text-xs font-semibold whitespace-nowrap self-start">
                                                {release.badge}
                                            </span>
                                        )}
                                    </div>

                                    <p className="text-neutral-400 text-sm leading-relaxed mb-6">
                                        {release.description}
                                    </p>

                                    <ul className="space-y-3">
                                        {release.features.map((feature, i) => (
                                            <li key={i} className="flex flex-col sm:flex-row items-start gap-3 text-sm text-neutral-300 group">
                                                <Terminal className="w-4 h-4 text-blue-500/50 mt-0.5 flex-shrink-0 group-hover:text-blue-400 transition-colors" />
                                                <span className="leading-relaxed"><strong className="text-white font-medium">{feature.split('**')[1] || feature}</strong></span>
                                            </li>
                                        ))}
                                    </ul>

                                </div>
                            </div>

                        </motion.div>
                    ))}
                </motion.div>

                {/* Footer Prompt */}
                <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ delay: 0.8 }}
                    className="mt-24 text-center pb-8"
                >
                    <div className="inline-flex items-center justify-center p-1 px-4 rounded-full bg-neutral-900/50 border border-white/[0.02]">
                        <span className="text-xs text-neutral-500 font-mono flex items-center gap-2">
                            <Zap className="w-3 h-3 text-yellow-500/70" /> Updates automatically synchronized
                        </span>
                    </div>
                </motion.div>

            </div>
        </div>
    );
}
