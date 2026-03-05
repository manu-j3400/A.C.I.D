import { motion, AnimatePresence, useMotionValue, useTransform, animate } from 'framer-motion';
import { Link } from 'react-router-dom';
import { Sparkles, Code2, Trophy, BookOpen, ArrowRight, Brain, Eye, GraduationCap, Rocket, Github } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import PublicNavbar from '@/components/PublicNavbar';
import { HeroMiniDemo } from '@/components/HeroMiniDemo';
import { useState, useEffect, useRef, useCallback } from 'react';

/* ─────────────────── ANIMATED GRID BACKGROUND ─────────────────── */
function GridBackground() {
    return (
        <div className="absolute inset-0 overflow-hidden pointer-events-none">
            {/* Dot grid */}
            <div
                className="absolute inset-0 opacity-[0.08]"
                style={{
                    backgroundImage: `radial-gradient(circle, rgba(59,130,246,0.15) 1px, transparent 1px)`,
                    backgroundSize: '40px 40px',
                }}
            />
            {/* Breathing pulse glow */}
            <motion.div
                className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] rounded-full bg-blue-500/[0.04]"
                animate={{ scale: [1, 1.2, 1], opacity: [0.5, 0.8, 0.5] }}
                transition={{ duration: 6, repeat: Infinity, ease: 'easeInOut' }}
            />
            {/* Horizontal scan line */}
            <motion.div
                className="absolute left-0 right-0 h-px bg-blue-500/20"
                animate={{ top: ['0%', '60%', '0%'] }}
                transition={{ duration: 8, repeat: Infinity, ease: 'easeInOut' }}
            />
        </div>
    );
}

/* ─────────────────── ROTATING TEXT ─────────────────── */
const rotatingWords = [
    'SECURITY',
    'EFFICIENCY',
    'TRUST',
    'CONFIDENCE',
    'SPEED',
    'ZERO STRESS'
];

function RotatingText() {
    const [index, setIndex] = useState(0);

    useEffect(() => {
        const interval = setInterval(() => {
            setIndex((prev) => (prev + 1) % rotatingWords.length);
        }, 3000);
        return () => clearInterval(interval);
    }, []);

    return (
        <span className="inline-block relative h-[1.15em] overflow-hidden align-bottom">
            <AnimatePresence mode="wait">
                <motion.span
                    key={rotatingWords[index]}
                    className="inline-block text-blue-400 whitespace-nowrap"
                    initial={{ y: '100%', opacity: 0 }}
                    animate={{ y: '0%', opacity: 1 }}
                    exit={{ y: '-100%', opacity: 0 }}
                    transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
                >
                    {rotatingWords[index]}
                </motion.span>
            </AnimatePresence>
        </span>
    );
}

/* ═══════════════════ MAIN COMPONENT ═══════════════════ */
export default function LandingPage() {

    return (
        <div className="min-h-screen bg-black text-white overflow-x-hidden selection:bg-blue-600 selection:text-white">

            {/* ─── NAVBAR ─── */}
            <PublicNavbar />

            {/* ─── HERO ─── */}
            <section className="relative pt-40 pb-32 px-6">
                <GridBackground />
                <div className="max-w-7xl mx-auto relative">
                    <div className="grid lg:grid-cols-2 gap-16 items-center">
                        {/* Left: Copy */}
                        <motion.div
                            initial={{ opacity: 0, y: 20 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
                        >
                            <Badge
                                variant="outline"
                                className="mb-6 py-1.5 px-4 font-mono text-xs border border-white/20 bg-white/5 text-white flex items-center gap-2 w-fit rounded-none brutalist-shadow-white"
                            >
                                <span className="flex h-2 w-2 rounded-full bg-blue-500 shadow-[0_0_8px_rgba(59,130,246,0.8)] animate-pulse" />
                                Soteria Scan Engine v2.0 Live
                            </Badge>

                            <h1 className="text-5xl md:text-6xl lg:text-7xl font-black mb-2 leading-[1.05] tracking-tight uppercase">
                                <span className="text-white">Deploy Code With</span><br />
                            </h1>
                            <div className="text-[3.5rem] md:text-[5rem] lg:text-[6rem] font-black uppercase mb-6 leading-[1] tracking-tight">
                                <span className="text-blue-400" style={{ WebkitTextStroke: '1px white' }}>
                                    <RotatingText />
                                </span>
                            </div>

                            <p className="text-[17px] md:text-lg text-neutral-300 mb-10 leading-relaxed font-medium max-w-[90%]">
                                Soteria is an AI-powered code security platform that helps developers instantly identify vulnerabilities, understand why they matter, and ship secure code without slowing down.
                            </p>

                            <div className="flex items-center gap-4 flex-wrap">
                                <Link to="/signup">
                                    <Button size="lg" className="font-bold text-base h-12 px-8 bg-blue-600 text-white hover:bg-blue-500 rounded-lg gap-2 transition-all duration-200 shadow-[4px_4px_0px_#1e3a5f] hover:shadow-[2px_2px_0px_#1e3a5f] hover:translate-x-[2px] hover:translate-y-[2px]">
                                        Start Free <ArrowRight className="w-4 h-4 ml-1" />
                                    </Button>
                                </Link>
                                <Link to="/how-it-works">
                                    <Button size="lg" className="font-bold text-base h-12 px-8 bg-slate-800 text-white hover:bg-slate-700 rounded-lg transition-all duration-200 shadow-[4px_4px_0px_#1e293b] hover:shadow-[2px_2px_0px_#1e293b] hover:translate-x-[2px] hover:translate-y-[2px] border-2 border-slate-600">
                                        Learn More
                                    </Button>
                                </Link>
                                <motion.div
                                    initial={{ opacity: 0, x: -10 }}
                                    animate={{ opacity: 1, x: 0 }}
                                    transition={{ delay: 0.4, duration: 0.8 }}
                                    className="flex items-center ml-2"
                                >
                                    <a href="https://www.producthunt.com/products/soteria?embed=true&utm_source=badge-featured&utm_medium=badge&utm_campaign=badge-soteria" target="_blank" rel="noopener noreferrer" className="block rounded-none transition-all duration-300 hover:brutalist-shadow-white border-2 border-transparent hover:border-white">
                                        <img alt="Soteria - Writing meaningful code, in the safest way possible | Product Hunt" src="https://api.producthunt.com/widgets/embed-image/v1/featured.svg?post_id=1088107&theme=dark&t=1772448063610" className="h-12 w-auto transition-transform duration-300" />
                                    </a>
                                </motion.div>
                            </div>
                        </motion.div>

                        {/* Right: Interactive Code Preview Demo */}
                        <motion.div
                            initial={{ opacity: 0, y: 30 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ duration: 0.8, delay: 0.2, ease: [0.16, 1, 0.3, 1] }}
                            className="hidden lg:block relative"
                        >
                            {/* Pointer Arrow */}
                            <motion.div
                                initial={{ opacity: 0, x: -20 }}
                                animate={{ opacity: 1, x: 0 }}
                                transition={{ delay: 1.5, duration: 0.8 }}
                                className="absolute -top-10 -left-12 z-20 flex flex-col items-center rotate-[-15deg]"
                            >
                                <span className="font-mono text-black font-bold text-sm shadow-[4px_4px_0px_#ef4444] bg-amber-400 px-2 py-1 mb-1 border-2 border-black">
                                    Try it!
                                </span>
                                <svg width="40" height="40" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" className="text-red-500">
                                    <path d="M5 12H19M19 12L12 5M19 12L12 19" stroke="currentColor" strokeWidth="3" strokeLinecap="square" strokeLinejoin="miter" />
                                </svg>
                            </motion.div>

                            <HeroMiniDemo />
                        </motion.div>
                    </div>
                </div>
            </section>

            {/* ─── SOCIAL PROOF STRIP ─── */}
            <div className="border-y-2 border-neutral-800 bg-black py-4 overflow-hidden relative group">
                <div className="absolute inset-0 bg-primary/5 pointer-events-none group-hover:bg-primary/10 transition-colors duration-200" />
                <div className="max-w-6xl mx-auto px-6 flex flex-wrap justify-between items-center gap-8 text-neutral-400 font-mono text-sm relative z-10 font-bold uppercase">
                    <div className="flex items-center gap-3">
                        <div className="w-2 h-2 rounded-none bg-amber-500" />
                        <span className="text-white">Zero Configuration</span>
                    </div>
                    <div className="flex items-center gap-3">
                        <div className="w-2 h-2 rounded-none bg-blue-400" />
                        <span className="text-white">Sub-second AST Scans</span>
                    </div>
                    <div className="flex items-center gap-3">
                        <div className="w-2 h-2 rounded-none bg-rose-400" />
                        <span className="text-white">Generative AI Fixes</span>
                    </div>
                </div>
            </div>

            {/* ─── UNIQUE VALUE PROPOSITION ─── */}
            <section id="why" className="py-24 px-6 border-b border-white/[0.04]">
                <div className="max-w-6xl mx-auto">
                    <div className="flex flex-col items-center justify-center text-center mb-16 w-full">
                        <p className="text-xs font-bold text-white bg-blue-600 px-3 py-1 border-2 border-slate-800 uppercase tracking-[0.2em] mb-4 brutalist-shadow-white inline-block">The "Anti-Marketing" pitch</p>
                        <h2 className="text-4xl md:text-5xl font-black tracking-tight uppercase">
                            Security tools usually suck.<br />
                            <span className="text-amber-400 border-b-4 border-amber-500/60 pb-1">We fixed it.</span>
                        </h2>
                    </div>

                    <div className="grid md:grid-cols-3 gap-8">
                        {[
                            {
                                icon: <Code2 className="w-8 h-8 text-white" />,
                                title: "Instant AST Audits",
                                desc: "Stop waiting for 30-minute CI/CD pipelines to fail. Our hybrid AST engine identifies structural vulnerabilities locally in milliseconds.",
                                bg: "bg-amber-600",
                                shadow: "shadow-[6px_6px_0px_#92400e30]"
                            },
                            {
                                icon: <GraduationCap className="w-8 h-8 text-white" />,
                                title: "Zero-BS Explanations",
                                desc: "No cryptic CWE error codes. Our models explain exactly what's wrong, why it's dangerous, and give you the patched code in plain English.",
                                bg: "bg-sky-600",
                                shadow: "shadow-[6px_6px_0px_#0369a130]"
                            },
                            {
                                icon: <Rocket className="w-8 h-8 text-white" />,
                                title: "Frictionless Workflow",
                                desc: "No 14-day trials. No forced sales calls. No bloated SDKs to install. Just paste your code, get your secure fixes, and keep shipping.",
                                bg: "bg-rose-600",
                                shadow: "shadow-[6px_6px_0px_#9f122230]"
                            }
                        ].map((uvp, i) => (
                            <motion.div
                                key={uvp.title}
                                initial={{ opacity: 0, y: 15 }}
                                whileInView={{ opacity: 1, y: 0 }}
                                viewport={{ once: true }}
                                transition={{ duration: 0.5, delay: i * 0.1 }}
                                className={`relative p-8 ${uvp.bg} border-4 border-black ${uvp.shadow} h-full group transition-transform duration-300 hover:-translate-y-2 hover:-translate-x-2`}
                            >
                                <div className="w-14 h-14 mb-8 bg-black border-4 border-black flex items-center justify-center text-white transition-transform duration-300 group-hover:scale-110">
                                    {uvp.icon}
                                </div>
                                <h3 className="text-2xl font-black text-black mb-4 tracking-tighter uppercase">{uvp.title}</h3>
                                <p className="text-[16px] text-black leading-relaxed font-bold border-t-4 border-black/20 pt-4 mt-2">
                                    {uvp.desc}
                                </p>
                            </motion.div>
                        ))}
                    </div>
                </div>
            </section>

            {/* ─── STATS TICKER ─── */}
            <section className="relative py-20 px-6 border-t-2 border-dashed border-neutral-800 bg-black">
                <div className="max-w-6xl mx-auto">
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
                        {[
                            { value: '50+', label: 'Vulnerability Patterns', color: 'text-red-500' },
                            { value: '<2s', label: 'Average Scan Time', color: 'text-blue-400' },
                            { value: '6+', label: 'Languages Supported', color: 'text-amber-400' },
                            { value: '100%', label: 'Free & Open Source', color: 'text-emerald-400' },
                        ].map((stat, i) => (
                            <motion.div
                                key={stat.label}
                                initial={{ opacity: 0, y: 20 }}
                                whileInView={{ opacity: 1, y: 0 }}
                                viewport={{ once: true }}
                                transition={{ duration: 0.5, delay: i * 0.1 }}
                                className="text-center p-6 border-2 border-neutral-700 bg-neutral-950 shadow-[4px_4px_0px_#1e293b] hover:shadow-[2px_2px_0px_#1e293b] hover:translate-x-[2px] hover:translate-y-[2px] transition-all duration-200"
                            >
                                <div className={`text-4xl md:text-5xl font-black tracking-tighter ${stat.color}`}>
                                    {stat.value}
                                </div>
                                <div className="text-[10px] font-mono font-bold text-neutral-500 uppercase tracking-widest mt-3">
                                    {stat.label}
                                </div>
                            </motion.div>
                        ))}
                    </div>
                </div>
            </section>

            {/* ─── EXPLORE SOTERIA ─── */}
            <section className="relative py-28 px-6 bg-black">
                <div className="max-w-5xl mx-auto">
                    <div className="flex flex-col items-center justify-center text-center mb-16 w-full">
                        <p className="font-mono text-sm font-bold text-black uppercase tracking-[0.2em] mb-4
                                      border-4 border-black inline-block px-4 py-2 bg-amber-500 shadow-[6px_6px_0px_#ef4444]">
                            Go Deeper
                        </p>
                        <h2 className="text-4xl md:text-5xl lg:text-7xl font-black tracking-tight leading-[1.0] mt-6 uppercase">
                            EXPLORE <span className="text-blue-400" style={{ WebkitTextStroke: '2px white' }}>SOTERIA.</span>
                        </h2>
                    </div>

                    <div className="grid md:grid-cols-3 gap-6">
                        {[
                            {
                                title: 'Features',
                                desc: 'Real-time AST scanning, AI-powered explanations, gamified XP, and GitHub integration.',
                                href: '/features',
                                icon: <Eye className="w-7 h-7" />,
                                accent: 'bg-red-600',
                                shadow: 'shadow-[6px_6px_0px_#991b1b]',
                            },
                            {
                                title: 'How It Works',
                                desc: 'Three steps: paste code, understand vulnerabilities, level up your security skills.',
                                href: '/how-it-works',
                                icon: <BookOpen className="w-7 h-7" />,
                                accent: 'bg-blue-600',
                                shadow: 'shadow-[6px_6px_0px_#1e3a5f]',
                            },
                            {
                                title: 'About',
                                desc: 'Why Soteria exists — combating the rise of AI-generated bugs, built by a CSE student.',
                                href: '/about',
                                icon: <Sparkles className="w-7 h-7" />,
                                accent: 'bg-amber-500',
                                shadow: 'shadow-[6px_6px_0px_#92400e]',
                            },
                        ].map((card, i) => (
                            <motion.div
                                key={card.title}
                                initial={{ opacity: 0, y: 20 }}
                                whileInView={{ opacity: 1, y: 0 }}
                                viewport={{ once: true }}
                                transition={{ duration: 0.6, delay: i * 0.1, ease: [0.16, 1, 0.3, 1] }}
                            >
                                <Link
                                    to={card.href}
                                    className={`block p-8 bg-neutral-900 border-4 border-black ${card.shadow} group transition-all duration-200 hover:-translate-y-2 hover:-translate-x-2 h-full`}
                                >
                                    <div className={`w-14 h-14 mb-6 ${card.accent} border-4 border-black flex items-center justify-center text-white transition-transform duration-200 group-hover:scale-110`}>
                                        {card.icon}
                                    </div>
                                    <h3 className="text-2xl font-black text-white mb-3 tracking-tighter uppercase">
                                        {card.title}
                                    </h3>
                                    <p className="text-[15px] text-neutral-400 leading-relaxed font-mono mb-6">
                                        {card.desc}
                                    </p>
                                    <div className="flex items-center gap-2 text-sm font-mono font-bold text-blue-400 uppercase tracking-widest group-hover:gap-4 transition-all duration-200">
                                        Explore <ArrowRight className="w-4 h-4" />
                                    </div>
                                </Link>
                            </motion.div>
                        ))}
                    </div>
                </div>
            </section>

            {/* ─── CALL TO ACTION ─── */}
            <section className="relative py-32 px-6 bg-blue-600 border-y-4 border-black flex flex-col items-center justify-center min-h-[50vh]">
                <div className="absolute inset-0 bg-noise opacity-[0.05] pointer-events-none" />
                <div className="w-full max-w-4xl mx-auto text-center relative z-10">
                    <h2 className="text-5xl md:text-7xl font-black mb-6 tracking-tighter text-black uppercase drop-shadow-[4px_4px_0px_rgba(0,0,0,1)] text-white" style={{ WebkitTextStroke: '2px black' }}>
                        READY TO WRITE<br />SECURE CODE?
                    </h2>
                    <p className="text-xl text-black mb-10 font-mono font-bold max-w-2xl mx-auto bg-white border-4 border-black p-4 shadow-[6px_6px_0px_#000000]">
                        Stop guessing. Start knowing. Scan your first project in seconds.
                    </p>
                    <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
                        <Link to="/signup">
                            <Button size="lg" className="h-16 px-12 text-xl font-black bg-blue-600 text-white border-2 border-blue-400 shadow-[8px_8px_0px_#1e3a5f] hover:translate-y-1 hover:translate-x-1 hover:shadow-[4px_4px_0px_#1e3a5f] transition-all rounded-lg uppercase">
                                START FREE
                            </Button>
                        </Link>
                    </div>
                </div>
            </section>

            {/* ─── FOOTER ─── */}
            <footer className="border-t-2 border-neutral-800 bg-black text-neutral-400 py-16 text-sm font-mono relative">
                <div className="max-w-6xl mx-auto px-6 flex flex-col md:flex-row justify-between items-center gap-6">
                    <Link to="/" className="flex items-center gap-3 group">
                        <img src="/soteria-logo.png" alt="Soteria" className="h-8 w-8 rounded-none object-cover transition-transform group-hover:-translate-y-[2px]" />
                        <span className="text-xl font-mono font-bold tracking-[0.15em] uppercase text-white">SOTERIA</span>
                    </Link>

                    <div className="flex gap-8 font-bold">
                        <Link to="/about" className="hover:text-primary transition-colors uppercase cursor-pointer">About the Creator</Link>
                        <a href="https://github.com/manujawahar/ACID" target="_blank" rel="noopener noreferrer" className="hover:text-primary transition-colors uppercase flex items-center gap-2 cursor-pointer">
                            <Github className="w-4 h-4" /> Open Source
                        </a>
                    </div>

                    <div className="text-neutral-500 text-[10px] tracking-widest uppercase">
                        © {new Date().getFullYear()} Soteria. Built for builders.
                    </div>
                </div>
            </footer>
        </div>
    );
}
