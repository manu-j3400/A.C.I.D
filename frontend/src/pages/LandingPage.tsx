import { motion, AnimatePresence, useMotionValue, useTransform, animate } from 'framer-motion';
import { Link } from 'react-router-dom';
import { Flame, Sparkles, Code2, Trophy, BookOpen, ArrowRight, Brain, Terminal, Shield, Eye, GraduationCap, Rocket, Zap, ScanLine, Github } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import PublicNavbar from '@/components/PublicNavbar';
import { HeroMiniDemo } from '@/components/HeroMiniDemo';
import { useState, useEffect, useRef, useCallback } from 'react';

/* ─────────────────── ANIMATED GRID BACKGROUND ─────────────────── */
function GridBackground() {
    return (
        <div className="absolute inset-0 overflow-hidden pointer-events-none">
            {/* Dot grid */}
            <div
                className="absolute inset-0"
                style={{
                    backgroundImage: `radial-gradient(circle, rgba(59,130,246,0.15) 1px, transparent 1px)`,
                    backgroundSize: '40px 40px',
                    maskImage: 'radial-gradient(ellipse 80% 70% at 50% 30%, black 30%, transparent 80%)',
                    WebkitMaskImage: 'radial-gradient(ellipse 80% 70% at 50% 30%, black 30%, transparent 80%)',
                }}
            />
            {/* Breathing pulse glow */}
            <motion.div
                className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] rounded-full"
                style={{
                    background: 'radial-gradient(circle, rgba(59,130,246,0.08) 0%, transparent 70%)',
                }}
                animate={{ scale: [1, 1.2, 1], opacity: [0.5, 0.8, 0.5] }}
                transition={{ duration: 6, repeat: Infinity, ease: 'easeInOut' }}
            />
            {/* Horizontal scan line */}
            <motion.div
                className="absolute left-0 right-0 h-px"
                style={{
                    background: 'linear-gradient(90deg, transparent, rgba(59,130,246,0.3), transparent)',
                }}
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
                    className="inline-block text-cyan-400 whitespace-nowrap"
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

/* ─────────────────── MAIN LANDING PAGE COMPONENT ─────────────────── */
const features = [
    {
        icon: <Eye className="w-5 h-5" />,
        title: 'Real-Time Scanning',
        description: 'Detects SQL injection, XSS, code injection, and dozens of vulnerability patterns instantly.',
    },
    {
        icon: <Brain className="w-5 h-5" />,
        title: 'AI-Powered Explanations',
        description: 'Every vulnerability comes with a clear, beginner-friendly explanation of what went wrong and how to fix it.',
    },
    {
        icon: <Trophy className="w-5 h-5" />,
        title: 'Gamified Learning',
        description: 'Earn XP for every scan. Level up from Novice to Architect. Track your streak.',
    },
];

/* ═══════════════════ MAIN COMPONENT ═══════════════════ */
export default function LandingPage() {
    const scrollToSection = (e: React.MouseEvent<HTMLAnchorElement>, id: string) => {
        e.preventDefault();
        const element = document.getElementById(id);
        if (element) {
            element.scrollIntoView({ behavior: 'smooth' });
        }
    };

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

                            <h1 className="text-5xl md:text-6xl lg:text-7xl font-black mb-2 leading-[1.05] tracking-tight">
                                <span className="text-white">Deploy Code With</span><br />
                            </h1>
                            <div className="text-[3.5rem] md:text-[5rem] lg:text-[6rem] font-black uppercase mb-6 leading-[1] tracking-tight">
                                <span className="text-transparent bg-clip-text bg-gradient-to-r from-cyan-400 to-blue-500" style={{ WebkitTextStroke: '1px white' }}>
                                    <RotatingText />
                                </span>
                            </div>

                            <p className="text-[17px] md:text-lg text-neutral-300 mb-10 leading-relaxed font-medium max-w-[90%]">
                                Soteria is an AI-powered code security platform that helps developers instantly identify vulnerabilities, understand why they matter, and ship secure code without slowing down.
                            </p>

                            <div className="flex items-center gap-4 flex-wrap">
                                <Link to="/signup">
                                    <Button size="lg" className="font-bold text-base h-12 px-8 bg-blue-600 text-black hover:bg-blue-500 rounded-none gap-2 transition-all duration-200 brutalist-shadow">
                                        Start Free <ArrowRight className="w-4 h-4 ml-1" />
                                    </Button>
                                </Link>
                                <a href="#how-it-works" onClick={(e) => scrollToSection(e, 'how-it-works')}>
                                    <Button size="lg" variant="outline" className="font-bold text-base h-12 px-8 border-white/30 text-white hover:text-black hover:bg-white rounded-none transition-all duration-200 brutalist-shadow-white">
                                        Learn More
                                    </Button>
                                </a>
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
                                <span className="font-mono text-black font-bold text-sm shadow-[4px_4px_0px_#ef4444] bg-yellow-400 px-2 py-1 mb-1 border-2 border-black">
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
                <div className="absolute inset-0 bg-primary/5 pointer-events-none group-hover:bg-primary/10 transition-colors duration-500" />
                <div className="max-w-6xl mx-auto px-6 flex flex-wrap justify-between items-center gap-8 text-neutral-400 font-mono text-sm relative z-10 font-bold uppercase">
                    <div className="flex items-center gap-3">
                        <div className="w-2 h-2 rounded-none bg-yellow-400" />
                        <span className="text-white">Zero Configuration</span>
                    </div>
                    <div className="flex items-center gap-3">
                        <div className="w-2 h-2 rounded-none bg-cyan-400" />
                        <span className="text-white">Sub-second AST Scans</span>
                    </div>
                    <div className="flex items-center gap-3">
                        <div className="w-2 h-2 rounded-none bg-pink-500" />
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
                            <span className="text-transparent bg-clip-text bg-gradient-to-r from-yellow-400 to-yellow-600 border-b-4 border-yellow-500 pb-1">We fixed it.</span>
                        </h2>
                    </div>

                    <div className="grid md:grid-cols-3 gap-8">
                        {[
                            {
                                icon: <Code2 className="w-8 h-8 text-white" />,
                                title: "Instant AST Audits",
                                desc: "Stop waiting for 30-minute CI/CD pipelines to fail. Our hybrid AST engine identifies structural vulnerabilities locally in milliseconds.",
                                bg: "bg-yellow-400",
                                shadow: "shadow-[6px_6px_0px_#facc1530]"
                            },
                            {
                                icon: <GraduationCap className="w-8 h-8 text-white" />,
                                title: "Zero-BS Explanations",
                                desc: "No cryptic CWE error codes. Our models explain exactly what's wrong, why it's dangerous, and give you the patched code in plain English.",
                                bg: "bg-cyan-400",
                                shadow: "shadow-[6px_6px_0px_#22d3ee30]"
                            },
                            {
                                icon: <Rocket className="w-8 h-8 text-white" />,
                                title: "Frictionless Workflow",
                                desc: "No 14-day trials. No forced sales calls. No bloated SDKs to install. Just paste your code, get your secure fixes, and keep shipping.",
                                bg: "bg-pink-500",
                                shadow: "shadow-[6px_6px_0px_#ec489930]"
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

            {/* ─── FEATURES (BENTO GRID) ─── */}
            <section id="features" className="relative py-32 px-6">
                <div className="max-w-5xl mx-auto relative">
                    <div className="flex flex-col items-center justify-center text-center mb-20 w-full">
                        <p className="font-mono text-sm font-bold text-black uppercase tracking-[0.2em] mb-4 
                                      border-4 border-black inline-block px-4 py-2 bg-yellow-400 shadow-[6px_6px_0px_#ef4444]">
                            Core Platform
                        </p>
                        <h2 className="text-4xl md:text-5xl lg:text-7xl font-black tracking-tight leading-[1.0] mt-6">
                            SECURITY. <span className="text-transparent bg-clip-text bg-gradient-to-r from-red-500 to-yellow-500" style={{ WebkitTextStroke: '2px white' }}>REIMAGINED.</span>
                        </h2>
                    </div>

                    {/* Bento Grid: 2 cols, asymmetric */}
                    <div className="grid md:grid-cols-2 gap-6">
                        {/* Large card: Real-Time Scanning (spans full width) */}
                        <motion.div
                            initial={{ opacity: 0, y: 20 }}
                            whileInView={{ opacity: 1, y: 0 }}
                            viewport={{ once: true }}
                            transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
                            className="md:col-span-2 relative p-8 md:p-10 bg-neutral-900 border-4 border-black shadow-[8px_8px_0px_#000000] group transition-all duration-300 hover:-translate-y-1 hover:-translate-x-1 hover:bg-neutral-800"
                        >
                            <div className="flex flex-col md:flex-row gap-8 items-start relative z-10">
                                <div className="flex-1">
                                    <div className="w-14 h-14 mb-6 bg-black border-4 border-black flex items-center justify-center text-red-500 transition-all duration-300 group-hover:bg-red-500 group-hover:text-black">
                                        <ScanLine className="w-6 h-6" />
                                    </div>
                                    <h3 className="text-3xl font-black text-white mb-3 tracking-tighter uppercase">Real-Time Scanning</h3>
                                    <p className="text-[15px] text-neutral-400 leading-relaxed font-mono max-w-md">
                                        Detects SQL injection, XSS, code injection, and dozens of vulnerability patterns instantly. Paste your code and get results in under 2 seconds.
                                    </p>
                                </div>
                                {/* Mini code animation */}
                                <div className="hidden md:block flex-1 bg-black border-4 border-neutral-700 shadow-[4px_4px_0px_#404040] p-4 font-mono font-bold text-xs leading-6 text-neutral-300 overflow-hidden group-hover:-translate-y-1 transition-transform">
                                    <motion.div
                                        animate={{ opacity: [0.3, 1, 0.3] }}
                                        transition={{ duration: 2, repeat: Infinity }}
                                    >
                                        <div><span className="text-cyan-400">$</span> soteria scan login.py</div>
                                        <div className="text-neutral-500 mt-1">Analyzing 47 lines...</div>
                                        <div className="text-red-500 mt-1 font-bold">⚠ 2 critical vulnerabilities found</div>
                                        <div className="text-yellow-400 font-bold">⚡ 1 warning detected</div>
                                        <div className="text-green-400 mt-1 font-bold">✓ Scan complete — 1.2s</div>
                                    </motion.div>
                                </div>
                            </div>
                        </motion.div>

                        {/* AI Explanations */}
                        <motion.div
                            initial={{ opacity: 0, y: 20 }}
                            whileInView={{ opacity: 1, y: 0 }}
                            viewport={{ once: true }}
                            transition={{ duration: 0.6, delay: 0.1, ease: [0.16, 1, 0.3, 1] }}
                            className="relative p-8 bg-neutral-900 border-4 border-black shadow-[8px_8px_0px_#000000] group transition-all duration-300 hover:-translate-y-1 hover:-translate-x-1 hover:bg-neutral-800"
                        >
                            <div className="w-14 h-14 mb-6 bg-black border-4 border-black flex items-center justify-center text-pink-500 transition-all duration-300 group-hover:bg-pink-500 group-hover:text-black">
                                <Brain className="w-6 h-6" />
                            </div>
                            <h3 className="text-2xl font-black text-white mb-3 tracking-tighter uppercase">AI Explanations</h3>
                            <p className="text-[15px] text-neutral-400 leading-relaxed font-mono">
                                Every vulnerability comes with a clear, beginner-friendly explanation of what went wrong and how to fix it. Learn by doing.
                            </p>
                            <div className="mt-6 p-4 bg-black border-4 border-neutral-700 shadow-[4px_4px_0px_#404040] text-xs text-white font-bold font-mono">
                                <span className="text-pink-500">"</span>This f-string allows user input to modify your SQL...<span className="text-pink-500">"</span>
                            </div>
                        </motion.div>

                        {/* Gamified Learning */}
                        <motion.div
                            initial={{ opacity: 0, y: 20 }}
                            whileInView={{ opacity: 1, y: 0 }}
                            viewport={{ once: true }}
                            transition={{ duration: 0.6, delay: 0.2, ease: [0.16, 1, 0.3, 1] }}
                            className="relative p-8 bg-neutral-900 border-4 border-black shadow-[8px_8px_0px_#000000] group transition-all duration-300 hover:-translate-y-1 hover:-translate-x-1 hover:bg-neutral-800"
                        >
                            <div className="w-14 h-14 mb-6 bg-black border-4 border-black flex items-center justify-center text-yellow-400 transition-all duration-300 group-hover:bg-yellow-400 group-hover:text-black">
                                <Trophy className="w-6 h-6" />
                            </div>
                            <h3 className="text-2xl font-black text-white mb-3 tracking-tighter uppercase">Gamified Learning</h3>
                            <p className="text-[15px] text-neutral-400 leading-relaxed font-mono">
                                Earn XP for writing secure code and fixing vulnerabilities. Track your progress across the semester.
                            </p>

                            {/* Animated XP Progress */}
                            <div className="mt-6">
                                <div className="flex justify-between text-xs font-mono text-neutral-500 mb-2 font-bold uppercase">
                                    <span>Level 4 Scanner</span>
                                    <span className="text-primary">850 / 1000 XP</span>
                                </div>
                                <div className="h-4 bg-neutral-900 brutalist-border overflow-hidden p-[2px]">
                                    <motion.div
                                        className="h-full bg-primary"
                                        initial={{ width: "0%" }}
                                        whileInView={{ width: "85%" }}
                                        viewport={{ once: true }}
                                        transition={{ duration: 1.5, delay: 0.5, ease: "easeOut" }}
                                    />
                                </div>
                            </div>
                        </motion.div>

                        {/* GitHub Integration Card */}
                        <motion.div
                            initial={{ opacity: 0, y: 20 }}
                            whileInView={{ opacity: 1, y: 0 }}
                            viewport={{ once: true }}
                            transition={{ duration: 0.6, delay: 0.1, ease: [0.16, 1, 0.3, 1] }}
                            className="md:col-span-2 relative p-8 md:p-10 bg-neutral-900 border-4 border-black shadow-[8px_8px_0px_#000000] group transition-all duration-300 hover:-translate-y-1 hover:-translate-x-1 hover:bg-neutral-800"
                        >
                            <div className="flex flex-col md:flex-row gap-8 items-center">
                                <div className="flex-1">
                                    <div className="w-14 h-14 mb-6 bg-black border-4 border-black flex items-center justify-center text-cyan-400 transition-all duration-300 group-hover:bg-cyan-400 group-hover:text-black">
                                        <Github className="w-6 h-6" />
                                    </div>
                                    <h3 className="text-2xl font-black text-white mb-3 tracking-tighter uppercase">GitHub Integration</h3>
                                    <p className="text-[15px] text-neutral-400 leading-relaxed font-mono max-w-md">
                                        Connect your GitHub account with one click. Scan entire repositories for vulnerabilities automatically.
                                    </p>
                                </div>
                                <div className="hidden md:flex gap-3">
                                    {['my-flask-app', 'react-portfolio', 'node-api'].map((repo, i) => (
                                        <motion.div
                                            key={repo}
                                            initial={{ opacity: 0, y: 10 }}
                                            whileInView={{ opacity: 1, y: 0 }}
                                            viewport={{ once: true }}
                                            transition={{ delay: 0.6 + i * 0.15 }}
                                            className="px-4 py-3 bg-black brutalist-border text-xs font-mono text-neutral-400 flex items-center gap-2 brutalist-shadow-white"
                                        >
                                            <div className={`w-3 h-3 rounded-none ${i === 0 ? 'bg-primary' : i === 1 ? 'bg-cyan-400' : 'bg-red-500'}`} />
                                            {repo}
                                        </motion.div>
                                    ))}
                                </div>
                            </div>
                        </motion.div>
                    </div>
                </div>
            </section>

            {/* ─── HOW IT WORKS ─── */}
            <section id="how-it-works" className="relative py-32 px-6 border-t-2 border-dashed border-neutral-800 bg-black">
                <div className="absolute inset-0 bg-noise opacity-[0.05] pointer-events-none" />
                <div className="max-w-5xl mx-auto relative z-10">
                    <div className="flex flex-col items-center justify-center text-center mb-24 w-full">
                        <p className="font-mono text-sm font-bold text-cyan-400 uppercase tracking-[0.2em] mb-4 
                                      brutalist-border inline-block px-4 py-2 bg-black brutalist-shadow-cyan">How It Works</p>
                        <h2 className="text-4xl md:text-5xl lg:text-7xl font-bold tracking-tight leading-[1.0] mt-6 uppercase">
                            SCAN. LEARN. <span className="text-transparent bg-clip-text bg-gradient-to-r from-chartreuse to-cyan-400" style={{ WebkitTextStroke: '1px white' }}>LEVEL UP.</span>
                        </h2>
                    </div>

                    <div className="relative grid md:grid-cols-3 gap-12">
                        {/* Connecting Line - Dashed Brutalist */}
                        <div className="hidden md:block absolute top-[40px] left-20 right-20 h-px border-t-2 border-dashed border-neutral-600" />

                        {[
                            { icon: <Terminal className="w-8 h-8" />, num: '01', title: 'Paste Code', desc: 'Drop any code snippet into the scanner — Python, JavaScript, SQL, and more.' },
                            { icon: <BookOpen className="w-8 h-8" />, num: '02', title: 'Understand', desc: 'Get plain-English explanations of every vulnerability and how to fix it.' },
                            { icon: <Trophy className="w-8 h-8" />, num: '03', title: 'Level Up', desc: 'Earn XP, climb the ranks, and build real security intuition over time.' },
                        ].map((step, i) => (
                            <motion.div
                                key={step.num}
                                initial={{ opacity: 0, scale: 0.95, y: 20 }}
                                whileInView={{ opacity: 1, scale: 1, y: 0 }}
                                viewport={{ once: true }}
                                transition={{ duration: 0.7, delay: i * 0.15, ease: [0.16, 1, 0.3, 1] }}
                                className="relative text-center group bg-black p-8 brutalist-border brutalist-shadow transition-all duration-300 hover:-translate-y-2 hover:-translate-x-2 hover:brutalist-shadow-cyan"
                            >
                                <div className="w-20 h-20 mx-auto mb-8 bg-neutral-900 border-2 border-neutral-700 flex items-center justify-center relative z-10 group-hover:bg-cyan-500 group-hover:text-black group-hover:border-cyan-400 transition-colors duration-300">
                                    <span className="text-white group-hover:text-black transition-colors duration-300">{step.icon}</span>
                                    <div className="absolute -top-4 -right-4 w-10 h-10 bg-primary border-2 border-black flex items-center justify-center">
                                        <span className="text-sm font-black text-black">{step.num}</span>
                                    </div>
                                </div>
                                <h3 className="text-2xl font-bold text-white mb-3 tracking-tight uppercase">{step.title}</h3>
                                <p className="text-[15px] text-neutral-400 leading-relaxed font-mono">{step.desc}</p>
                            </motion.div>
                        ))}
                    </div>
                </div>
            </section>

            {/* ─── CALL TO ACTION ─── */}
            <section className="relative py-32 px-6 bg-cyan-400 border-y-4 border-black flex flex-col items-center justify-center min-h-[50vh]">
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
                            <Button size="lg" className="h-16 px-12 text-xl font-black bg-yellow-400 text-black border-4 border-black shadow-[8px_8px_0px_#000000] hover:translate-y-1 hover:translate-x-1 hover:shadow-[4px_4px_0px_#000000] transition-all rounded-none uppercase">
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
