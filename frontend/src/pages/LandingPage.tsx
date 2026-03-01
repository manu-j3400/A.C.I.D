import { motion } from 'framer-motion';
import { Link } from 'react-router-dom';
import { Flame, Sparkles, Code2, Trophy, BookOpen, ArrowRight, Brain, Terminal, Shield, Eye, GraduationCap, Rocket } from 'lucide-react';
import { Button } from '@/components/ui/button';

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
    {
        icon: <Flame className="w-5 h-5" />,
        title: 'Roast Mode',
        description: 'Turn on AI-generated sarcastic feedback that makes learning security actually fun.',
    },
];

export default function LandingPage() {
    const scrollToSection = (e: React.MouseEvent<HTMLAnchorElement>, id: string) => {
        e.preventDefault();
        const element = document.getElementById(id);
        if (element) {
            element.scrollIntoView({ behavior: 'smooth' });
        }
    };

    return (
        <div className="min-h-screen bg-black text-white overflow-x-hidden">

            {/* ─── NAVBAR ─── */}
            <nav className="fixed top-0 left-0 right-0 z-50 bg-black/60 backdrop-blur-2xl border-b border-blue-500/10">
                <div className="max-w-7xl mx-auto flex items-center justify-between px-6 h-16">
                    <Link to="/" className="flex items-center gap-3">
                        <img src="/soteria-logo.png" alt="Soteria" className="h-9 w-9 rounded-lg object-cover" />
                        <span className="text-lg font-black tracking-tight">SOTERIA</span>
                    </Link>

                    <div className="hidden md:flex items-center gap-8">
                        <a href="#features" onClick={(e) => scrollToSection(e, 'features')} className="text-sm text-neutral-500 hover:text-blue-300 transition-colors">Features</a>
                        <a href="#how-it-works" onClick={(e) => scrollToSection(e, 'how-it-works')} className="text-sm text-neutral-500 hover:text-blue-300 transition-colors">How It Works</a>
                        <Link to="/changelog" className="text-sm text-neutral-500 hover:text-blue-300 transition-colors">Lifecycle</Link>
                        <a href="#about" onClick={(e) => scrollToSection(e, 'about')} className="text-sm text-neutral-500 hover:text-blue-300 transition-colors">About</a>
                    </div>

                    <div className="flex items-center gap-3">
                        <Link to="/login">
                            <Button variant="ghost" className="text-sm text-neutral-400 hover:text-white font-medium h-9 px-4">
                                Sign In
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

            {/* ─── HERO ─── */}
            <section className="relative pt-36 pb-28 px-6">
                <div className="absolute top-24 left-1/2 -translate-x-1/2 w-[600px] h-[400px] bg-blue-600/8 rounded-full blur-[150px] pointer-events-none" />
                <div className="absolute top-60 right-10 w-[250px] h-[250px] bg-blue-500/5 rounded-full blur-[100px] pointer-events-none" />

                <div className="max-w-7xl mx-auto relative">
                    <div className="grid lg:grid-cols-2 gap-16 items-center">
                        {/* Left: Copy */}
                        <motion.div
                            initial={{ opacity: 0, x: -25 }}
                            animate={{ opacity: 1, x: 0 }}
                            transition={{ duration: 0.7 }}
                        >
                            <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full border border-blue-500/20 bg-blue-500/5 text-blue-400 text-xs font-semibold mb-8">
                                <Sparkles className="w-3 h-3" /> Preventing you from another Clawdbot incident
                            </div>

                            <h1 className="text-5xl md:text-6xl xl:text-7xl font-black tracking-tighter leading-[0.92] mb-6">
                                Security Over Show
                                <br />
                                <span className="bg-gradient-to-r from-blue-400 via-blue-500 to-cyan-400 bg-clip-text text-transparent">
                                    From Day One.
                                </span>
                            </h1>

                            <p className="text-lg text-neutral-500 max-w-lg mb-10 leading-relaxed">
                                Soteria is an AI-powered code security platform that helps students identify vulnerabilities, understand why they matter, and build better habits — before bad ones start.
                            </p>

                            <div className="flex items-center gap-4 flex-wrap">
                                <Link to="/signup">
                                    <Button size="lg" className="font-semibold text-base h-12 px-8 bg-gradient-to-r from-blue-600 to-blue-500 text-white hover:from-blue-500 hover:to-blue-400 rounded-xl gap-2 shadow-lg shadow-blue-600/25">
                                        Start Free <ArrowRight className="w-4 h-4" />
                                    </Button>
                                </Link>
                                <a href="#how-it-works" onClick={(e) => scrollToSection(e, 'how-it-works')}>
                                    <Button size="lg" variant="outline" className="font-semibold text-base h-12 px-8 border-blue-500/15 text-neutral-400 hover:text-blue-300 hover:bg-blue-500/5 hover:border-blue-500/30 rounded-xl">
                                        Learn More
                                    </Button>
                                </a>
                            </div>
                        </motion.div>

                        {/* Right: Code Preview Card */}
                        <motion.div
                            initial={{ opacity: 0, x: 25 }}
                            animate={{ opacity: 1, x: 0 }}
                            transition={{ duration: 0.7, delay: 0.2 }}
                            className="hidden lg:block"
                        >
                            <div className="rounded-2xl border border-blue-500/10 bg-neutral-950 overflow-hidden shadow-2xl shadow-blue-900/10">
                                <div className="flex items-center gap-2 px-4 py-3 border-b border-white/[0.06] bg-neutral-900/80">
                                    <div className="w-3 h-3 rounded-full bg-neutral-700" />
                                    <div className="w-3 h-3 rounded-full bg-neutral-700" />
                                    <div className="w-3 h-3 rounded-full bg-neutral-700" />
                                    <span className="ml-2 text-xs text-neutral-600 font-mono">login.py</span>
                                </div>
                                <div className="p-5 font-mono text-sm leading-7">
                                    <div><span className="text-blue-400">query</span> <span className="text-neutral-600">=</span> <span className="text-red-400">f"SELECT * FROM users WHERE id = </span><span className="text-yellow-300">&#123;user_input&#125;</span><span className="text-red-400">"</span></div>
                                    <div className="text-neutral-700">{"# ..."}</div>
                                    <div><span className="text-blue-400">cursor</span><span className="text-neutral-500">.execute(</span><span className="text-blue-400">query</span><span className="text-neutral-500">)</span></div>
                                </div>
                                <div className="mx-4 mb-4 p-4 rounded-xl bg-white/[0.02] border border-white/[0.06]">
                                    <div className="flex items-center gap-2 mb-2">
                                        <Shield className="w-4 h-4 text-red-400" />
                                        <span className="text-xs font-bold text-red-400 uppercase tracking-wider">Vulnerability Found</span>
                                    </div>
                                    <p className="text-sm text-neutral-300 leading-relaxed">
                                        <strong className="text-white">SQL Injection</strong> — Using f-strings to build SQL queries allows attackers to manipulate your database. Use parameterized queries instead.
                                    </p>
                                    <div className="flex items-center gap-2 mt-3">
                                        <span className="text-xs px-2 py-0.5 rounded bg-red-500/10 text-red-300 font-medium border border-red-500/10">Critical</span>
                                        <span className="text-xs px-2 py-0.5 rounded bg-white/5 text-neutral-400 font-medium border border-white/5">+10 XP</span>
                                    </div>
                                </div>
                            </div>
                        </motion.div>
                    </div>
                </div>
            </section>

            {/* ─── LOGO BANNER ─── */}
            <section className="border-y border-white/[0.04] py-16 px-6">
                <div className="max-w-xl mx-auto flex justify-center">
                    <motion.img
                        src="/soteria-logo.png"
                        alt="Soteria AI"
                        className="h-24 md:h-32 object-contain opacity-50"
                        initial={{ opacity: 0 }}
                        whileInView={{ opacity: 0.5 }}
                        viewport={{ once: true }}
                    />
                </div>
            </section>

            {/* ─── UNIQUE VALUE PROPOSITION ─── */}
            <section id="why" className="py-24 px-6 border-b border-white/[0.04] bg-neutral-950/30">
                <div className="max-w-6xl mx-auto">
                    <div className="text-center mb-16">
                        <p className="text-xs font-bold text-blue-500 uppercase tracking-[0.2em] mb-3">Why Soteria?</p>
                        <h2 className="text-4xl md:text-5xl font-black tracking-tight">
                            Built for your{' '}
                            <span className="bg-gradient-to-r from-blue-400 to-cyan-400 bg-clip-text text-transparent">specific stage.</span>
                        </h2>
                    </div>

                    <div className="grid md:grid-cols-3 gap-6">
                        {[
                            {
                                icon: <GraduationCap className="w-6 h-6" />,
                                title: "For Students & Hackers",
                                desc: "Stop pushing API keys to public repos or writing SQL injections in your final projects. Learn secure coding habits in real-time before you even graduate."
                            },
                            {
                                icon: <Code2 className="w-6 h-6" />,
                                title: "For Junior Developers",
                                desc: "Stop staring at cryptic security warnings. Soteria's AI mentor explains vulnerabilities in plain English—like having a Senior Security Engineer sitting right next to you."
                            },
                            {
                                icon: <Rocket className="w-6 h-6" />,
                                title: "For Indie Builders & Startups",
                                desc: "Scanning your MVP before launch shouldn't cost $1,000/month. Ensure your fast-moving projects aren't a massive liability to your early users."
                            }
                        ].map((uvp, i) => (
                            <motion.div
                                key={uvp.title}
                                initial={{ opacity: 0, y: 15 }}
                                whileInView={{ opacity: 1, y: 0 }}
                                viewport={{ once: true }}
                                transition={{ delay: i * 0.1 }}
                                className="p-8 rounded-3xl border border-white/[0.06] bg-black hover:border-blue-500/20 hover:bg-white/[0.02] transition-colors group"
                            >
                                <div className="w-12 h-12 mb-6 rounded-2xl bg-blue-500/10 border border-blue-500/20 flex items-center justify-center text-blue-400 group-hover:bg-blue-500/20 group-hover:scale-110 transition-all duration-300">
                                    {uvp.icon}
                                </div>
                                <h3 className="text-xl font-bold text-white mb-3 tracking-wide">{uvp.title}</h3>
                                <p className="text-sm text-neutral-400 leading-relaxed">{uvp.desc}</p>
                            </motion.div>
                        ))}
                    </div>
                </div>
            </section>

            {/* ─── FEATURES ─── */}
            <section id="features" className="py-28 px-6">
                <div className="max-w-5xl mx-auto">
                    <div className="text-center mb-16">
                        <p className="text-xs font-bold text-neutral-500 uppercase tracking-[0.2em] mb-3">Features</p>
                        <h2 className="text-4xl md:text-5xl font-black tracking-tight">
                            Security education,{' '}
                            <span className="bg-gradient-to-r from-blue-400 to-cyan-400 bg-clip-text text-transparent">reimagined.</span>
                        </h2>
                    </div>

                    <div className="grid md:grid-cols-2 gap-5">
                        {features.map((feature, i) => (
                            <motion.div
                                key={feature.title}
                                initial={{ opacity: 0, y: 12 }}
                                whileInView={{ opacity: 1, y: 0 }}
                                viewport={{ once: true }}
                                transition={{ delay: i * 0.08 }}
                                className="flex gap-5 p-6 rounded-2xl border border-white/[0.06] bg-white/[0.02] hover:bg-blue-500/[0.03] hover:border-blue-500/15 transition-colors group"
                            >
                                <div className="w-11 h-11 shrink-0 rounded-xl bg-blue-500/5 border border-blue-500/10 flex items-center justify-center text-blue-400 group-hover:bg-blue-500/10 transition-colors">
                                    {feature.icon}
                                </div>
                                <div>
                                    <h3 className="text-base font-bold text-white mb-1.5">{feature.title}</h3>
                                    <p className="text-sm text-neutral-500 leading-relaxed">{feature.description}</p>
                                </div>
                            </motion.div>
                        ))}
                    </div>
                </div>
            </section>

            {/* ─── HOW IT WORKS ─── */}
            <section id="how-it-works" className="py-28 px-6 border-t border-white/[0.04]">
                <div className="max-w-4xl mx-auto">
                    <div className="text-center mb-16">
                        <p className="text-xs font-bold text-neutral-500 uppercase tracking-[0.2em] mb-3">How It Works</p>
                        <h2 className="text-4xl md:text-5xl font-black tracking-tight">
                            Scan. Learn.{' '}
                            <span className="bg-gradient-to-r from-blue-400 to-cyan-400 bg-clip-text text-transparent">Level Up.</span>
                        </h2>
                    </div>

                    <div className="grid md:grid-cols-3 gap-6">
                        {[
                            { icon: <Terminal className="w-5 h-5" />, num: '01', title: 'Paste Code', desc: 'Drop any code snippet into the scanner — Python, JavaScript, SQL, and more.' },
                            { icon: <BookOpen className="w-5 h-5" />, num: '02', title: 'Understand', desc: 'Get plain-English explanations of every vulnerability and how to fix it.' },
                            { icon: <Trophy className="w-5 h-5" />, num: '03', title: 'Level Up', desc: 'Earn XP, climb the ranks, and build real security intuition over time.' },
                        ].map((step, i) => (
                            <motion.div
                                key={step.num}
                                initial={{ opacity: 0, y: 18 }}
                                whileInView={{ opacity: 1, y: 0 }}
                                viewport={{ once: true }}
                                transition={{ delay: i * 0.12 }}
                                className="text-center p-8 rounded-2xl border border-white/[0.06] bg-white/[0.01] hover:border-blue-500/15 transition-colors"
                            >
                                <div className="text-4xl font-black text-blue-500/30 mb-4">{step.num}</div>
                                <h3 className="text-lg font-bold text-white mb-2">{step.title}</h3>
                                <p className="text-sm text-neutral-500 leading-relaxed">{step.desc}</p>
                            </motion.div>
                        ))}
                    </div>
                </div>
            </section>

            {/* ─── BOTTOM CTA ─── */}
            <section className="py-28 px-6">
                <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    whileInView={{ opacity: 1, y: 0 }}
                    viewport={{ once: true }}
                    className="max-w-3xl mx-auto text-center rounded-3xl border border-blue-500/10 bg-gradient-to-b from-blue-950/30 to-black p-14"
                >
                    <img src="/soteria-logo.png" alt="Soteria" className="w-16 h-16 mx-auto mb-6 opacity-30 rounded-xl" />
                    <h2 className="text-3xl md:text-4xl font-black tracking-tight mb-4">Ready to write safer code?</h2>
                    <p className="text-neutral-500 mb-8 max-w-md mx-auto">Join the next generation of developers who learn security from the start. Free to use.</p>
                    <Link to="/signup">
                        <Button size="lg" className="font-semibold text-base h-12 px-10 bg-gradient-to-r from-blue-600 to-blue-500 text-white hover:from-blue-500 hover:to-blue-400 rounded-xl gap-2 shadow-lg shadow-blue-600/25">
                            Create Free Account <ArrowRight className="w-4 h-4" />
                        </Button>
                    </Link>
                </motion.div>
            </section>

            {/* ─── FOOTER ─── */}
            <footer id="about" className="border-t border-white/[0.04] py-10 px-6">
                <div className="max-w-6xl mx-auto flex flex-col md:flex-row items-center justify-between gap-4">
                    <div className="flex items-center gap-2.5">
                        <img src="/soteria-logo.png" alt="Soteria" className="w-6 h-6 rounded object-cover" />
                        <span className="text-sm font-bold">SOTERIA</span>
                        <span className="text-xs text-neutral-700 ml-1">&copy; 2026</span>
                    </div>
                    <p className="text-xs text-neutral-700">AI-powered security education for students and educators.</p>
                </div>
            </footer>
        </div>
    );
}
