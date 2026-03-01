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
        <div className="min-h-screen bg-black text-white overflow-x-hidden selection:bg-blue-600 selection:text-white">

            {/* ─── NAVBAR ─── */}
            <nav className="fixed top-0 left-0 right-0 z-50 bg-black border-b border-neutral-800">
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
                            <Button className="text-sm font-semibold h-9 px-5 bg-white text-black hover:bg-neutral-200 rounded-md transition-all">
                                Get Started
                            </Button>
                        </Link>
                    </div>
                </div>
            </nav>

            {/* ─── HERO ─── */}
            <section className="relative pt-40 pb-32 px-6">
                <div className="max-w-7xl mx-auto relative">
                    <div className="grid lg:grid-cols-2 gap-16 items-center">
                        {/* Left: Copy */}
                        <motion.div
                            initial={{ opacity: 0, y: 20 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
                        >
                            <motion.div
                                className="inline-flex items-center gap-2 px-4 py-2 rounded-md border border-neutral-800 bg-neutral-900 text-neutral-300 text-xs font-semibold mb-8"
                                animate={{ y: [0, -4, 0] }}
                                transition={{ duration: 4, repeat: Infinity, ease: 'easeInOut' }}
                            >
                                <Sparkles className="w-3.5 h-3.5 text-blue-500" /> Preventing you from another Clawdbot incident
                            </motion.div>

                            <h1 className="text-5xl md:text-6xl xl:text-7xl font-black tracking-tight leading-[1.05] mb-6 text-white">
                                Security Over Show.
                                <br />
                                <span className="text-blue-500">
                                    From Day One.
                                </span>
                            </h1>

                            <p className="text-lg text-neutral-400 max-w-lg mb-10 leading-relaxed font-medium">
                                Soteria is an AI-powered code security platform that helps students identify vulnerabilities, understand why they matter, and build better habits — before bad ones start.
                            </p>

                            <div className="flex items-center gap-4 flex-wrap">
                                <Link to="/signup">
                                    <Button size="lg" className="font-semibold text-base h-12 px-8 bg-blue-600 text-white hover:bg-blue-700 rounded-md gap-2 transition-all duration-200">
                                        Start Free <ArrowRight className="w-4 h-4" />
                                    </Button>
                                </Link>
                                <a href="#how-it-works" onClick={(e) => scrollToSection(e, 'how-it-works')}>
                                    <Button size="lg" variant="outline" className="font-semibold text-base h-12 px-8 border-neutral-700 text-neutral-300 hover:text-white hover:bg-neutral-800 rounded-md transition-all duration-200">
                                        Learn More
                                    </Button>
                                </a>
                            </div>
                        </motion.div>

                        {/* Right: Code Preview Card */}
                        <motion.div
                            initial={{ opacity: 0, y: 30 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ duration: 0.8, delay: 0.2, ease: [0.16, 1, 0.3, 1] }}
                            className="hidden lg:block relative"
                        >
                            <div className="relative rounded-lg border border-neutral-800 bg-[#0A0A0A] overflow-hidden">
                                <div className="flex items-center gap-2 px-4 py-3 border-b border-neutral-800 bg-[#111]">
                                    <div className="w-3 h-3 rounded-full bg-red-500" />
                                    <div className="w-3 h-3 rounded-full bg-yellow-500" />
                                    <div className="w-3 h-3 rounded-full bg-green-500" />
                                    <span className="ml-2 text-xs text-neutral-500 font-mono tracking-wide">login.py</span>
                                </div>
                                <div className="p-6 font-mono text-[13px] leading-8">
                                    <div><span className="text-blue-500">query</span> <span className="text-neutral-500">=</span> <span className="text-emerald-500">f"SELECT * FROM users WHERE id = </span><span className="text-yellow-500">&#123;user_input&#125;</span><span className="text-emerald-500">"</span></div>
                                    <div className="text-neutral-600">{"# ..."}</div>
                                    <div><span className="text-blue-500">cursor</span><span className="text-neutral-500">.execute(</span><span className="text-blue-500">query</span><span className="text-neutral-500">)</span></div>
                                </div>
                                <div className="mx-4 mb-4 p-5 rounded-lg bg-neutral-900 border border-neutral-800">
                                    <div className="flex items-center gap-2 mb-3">
                                        <Shield className="w-4 h-4 text-red-500" />
                                        <span className="text-xs font-bold text-red-500 tracking-[0.1em] uppercase">Vulnerability Found</span>
                                    </div>
                                    <p className="text-sm text-neutral-400 leading-relaxed">
                                        <strong className="text-neutral-200 mr-1">SQL Injection</strong> — Using f-strings to build SQL queries allows attackers to manipulate your database. Use parameterized queries instead.
                                    </p>
                                    <div className="flex items-center gap-2 mt-4">
                                        <span className="text-xs px-2.5 py-1 rounded-md bg-red-950 text-red-400 font-semibold border border-red-900">Critical</span>
                                        <span className="text-xs px-2.5 py-1 rounded-md bg-neutral-800 text-neutral-300 font-medium border border-neutral-700">+10 XP</span>
                                    </div>
                                </div>
                            </div>
                        </motion.div>
                    </div>
                </div>
            </section >

            {/* ─── LOGO BANNER ─── */}
            < section className="relative border-y border-white/[0.04] py-16 px-6 overflow-hidden" >
                <div className="absolute inset-0 bg-gradient-to-r from-blue-900/5 via-transparent to-cyan-900/5 blur-3xl pointer-events-none" />
                <div className="max-w-xl mx-auto flex justify-center relative">
                    <motion.img
                        src="/soteria-logo.png"
                        alt="Soteria AI"
                        className="h-24 md:h-32 object-contain opacity-40 mix-blend-screen drop-shadow-[0_0_30px_rgba(255,255,255,0.1)] grayscale hover:grayscale-0 hover:opacity-100 transition-all duration-700"
                        initial={{ opacity: 0, scale: 0.9 }}
                        whileInView={{ opacity: 0.4, scale: 1 }}
                        transition={{ duration: 1 }}
                        viewport={{ once: true }}
                    />
                </div>
            </section >

            {/* ─── UNIQUE VALUE PROPOSITION ─── */}
            < section id="why" className="py-24 px-6 border-b border-white/[0.04] bg-neutral-950/30" >
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
                                animate={{ opacity: 1, y: 0 }}
                                transition={{ duration: 0.5, delay: i * 0.1 }}
                                className="p-8 rounded-[2rem] border border-white/[0.04] bg-[#0A0A0A] hover:bg-[#111] hover:border-white/10 hover:-translate-y-1 shadow-2xl shadow-black transition-all duration-300 group ring-1 ring-white/5 hover:shadow-[0_0_40px_-10px_rgba(59,130,246,0.15)]"
                            >
                                <div className="w-14 h-14 mb-8 rounded-2xl bg-gradient-to-br from-blue-500/10 to-cyan-500/5 border border-white/[0.05] flex items-center justify-center text-blue-400 group-hover:scale-110 group-hover:bg-blue-500/20 transition-all duration-500 shadow-[inset_0_1px_0_0_rgba(255,255,255,0.1)]">
                                    {uvp.icon}
                                </div>
                                <h3 className="text-xl font-bold text-neutral-100 mb-4 tracking-tight">{uvp.title}</h3>
                                <p className="text-[15px] text-neutral-400 leading-relaxed font-medium">{uvp.desc}</p>
                            </motion.div>
                        ))}
                    </div>
                </div>
            </section >

            {/* ─── FEATURES ─── */}
            < section id="features" className="relative py-32 px-6" >
                <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[800px] bg-blue-900/5 rounded-full blur-[150px] pointer-events-none" />
                <div className="max-w-5xl mx-auto relative">
                    <div className="text-center mb-20">
                        <p className="text-sm font-bold text-blue-500 uppercase tracking-[0.2em] mb-4">Core Platform</p>
                        <h2 className="text-4xl md:text-5xl lg:text-6xl font-black tracking-tight leading-[1.1]">
                            Security education,{' '}
                            <span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-400 to-cyan-400 drop-shadow-[0_0_30px_rgba(59,130,246,0.3)]">reimagined.</span>
                        </h2>
                    </div>

                    <div className="grid md:grid-cols-2 gap-6">
                        {features.map((feature, i) => (
                            <motion.div
                                key={feature.title}
                                initial={{ opacity: 0, y: 20 }}
                                whileInView={{ opacity: 1, y: 0 }}
                                viewport={{ once: true }}
                                transition={{ duration: 0.6, delay: i * 0.1, ease: [0.16, 1, 0.3, 1] }}
                                className="flex gap-6 p-8 rounded-[2rem] border border-white/[0.04] bg-[#0A0A0A] hover:bg-[#111] hover:border-white/10 transition-all duration-300 group hover:-translate-y-1 ring-1 ring-white/5 shadow-2xl shadow-black hover:shadow-[0_0_40px_-10px_rgba(59,130,246,0.1)]"
                            >
                                <div className="w-14 h-14 shrink-0 rounded-2xl bg-gradient-to-br from-blue-500/10 to-transparent border border-white/[0.05] flex items-center justify-center text-blue-400 group-hover:scale-110 group-hover:bg-blue-500/20 transition-all duration-500 shadow-[inset_0_1px_0_0_rgba(255,255,255,0.1)]">
                                    {feature.icon}
                                </div>
                                <div className="pt-2">
                                    <h3 className="text-lg font-bold text-neutral-100 mb-2 tracking-tight">{feature.title}</h3>
                                    <p className="text-[15px] text-neutral-400 leading-relaxed font-medium">{feature.description}</p>
                                </div>
                            </motion.div>
                        ))}
                    </div>
                </div>
            </section >

            {/* ─── HOW IT WORKS ─── */}
            < section id="how-it-works" className="relative py-32 px-6 border-t border-white/[0.04] bg-[#020202]" >
                <div className="max-w-5xl mx-auto">
                    <div className="text-center mb-24">
                        <p className="text-sm font-bold text-blue-500 uppercase tracking-[0.2em] mb-4">How It Works</p>
                        <h2 className="text-4xl md:text-5xl lg:text-6xl font-black tracking-tight leading-[1.1]">
                            Scan. Learn.{' '}
                            <span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-400 to-cyan-400 drop-shadow-[0_0_30px_rgba(59,130,246,0.3)]">Level Up.</span>
                        </h2>
                    </div>

                    <div className="relative grid md:grid-cols-3 gap-8 md:gap-12">
                        {/* Connecting Line */}
                        <div className="hidden md:block absolute top-[40px] left-20 right-20 h-px bg-gradient-to-r from-blue-500/0 via-blue-500/20 to-blue-500/0" />

                        {[
                            { icon: <Terminal className="w-6 h-6" />, num: '01', title: 'Paste Code', desc: 'Drop any code snippet into the scanner — Python, JavaScript, SQL, and more.' },
                            { icon: <BookOpen className="w-6 h-6" />, num: '02', title: 'Understand', desc: 'Get plain-English explanations of every vulnerability and how to fix it.' },
                            { icon: <Trophy className="w-6 h-6" />, num: '03', title: 'Level Up', desc: 'Earn XP, climb the ranks, and build real security intuition over time.' },
                        ].map((step, i) => (
                            <motion.div
                                key={step.num}
                                initial={{ opacity: 0, scale: 0.95, y: 20 }}
                                whileInView={{ opacity: 1, scale: 1, y: 0 }}
                                viewport={{ once: true }}
                                transition={{ duration: 0.7, delay: i * 0.15, ease: [0.16, 1, 0.3, 1] }}
                                className="relative text-center group"
                            >
                                <div className="w-20 h-20 mx-auto mb-8 rounded-full bg-[#0A0A0A] border border-white/10 flex items-center justify-center relative z-10 shadow-2xl ring-1 ring-white/5 group-hover:border-blue-500/30 group-hover:shadow-[0_0_30px_-5px_rgba(59,130,246,0.3)] transition-all duration-500">
                                    <div className="absolute inset-2 rounded-full border border-white/5 group-hover:border-blue-500/20 transition-all duration-500" />
                                    <span className="text-blue-400 group-hover:scale-110 transition-transform duration-500">{step.icon}</span>
                                    <div className="absolute -top-3 -right-3 w-8 h-8 rounded-full bg-blue-500/10 border border-blue-500/20 flex items-center justify-center backdrop-blur-md">
                                        <span className="text-[10px] font-black text-blue-300">{step.num}</span>
                                    </div>
                                </div>
                                <h3 className="text-2xl font-bold text-neutral-100 mb-3 tracking-tight">{step.title}</h3>
                                <p className="text-[15px] text-neutral-400 leading-relaxed font-medium">{step.desc}</p>
                            </motion.div>
                        ))}
                    </div>
                </div>
            </section >

            {/* ─── BOTTOM CTA ─── */}
            < section className="relative py-32 px-6 overflow-hidden" >
                <div className="absolute inset-0 top-1/2 bg-[radial-gradient(ellipse_at_center,_var(--tw-gradient-stops))] from-blue-900/20 via-[#050505] to-[#050505] pointer-events-none" />
                <motion.div
                    initial={{ opacity: 0, scale: 0.95, y: 40 }}
                    whileInView={{ opacity: 1, scale: 1, y: 0 }}
                    viewport={{ once: true }}
                    transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
                    className="relative max-w-4xl mx-auto text-center rounded-[3rem] border border-white/[0.08] bg-[#0A0A0A] p-16 shadow-[0_0_100px_-20px_rgba(59,130,246,0.15)] ring-1 ring-white/5 overflow-hidden group"
                >
                    <div className="absolute inset-0 bg-gradient-to-b from-blue-500/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-700 pointer-events-none" />

                    <img src="/soteria-logo.png" alt="Soteria" className="w-20 h-20 mx-auto mb-10 opacity-40 rounded-2xl shadow-2xl drop-shadow-[0_0_15px_rgba(255,255,255,0.2)] grayscale" />
                    <h2 className="text-4xl md:text-5xl lg:text-6xl font-black tracking-tight mb-6 text-white">Ready to write safer code?</h2>
                    <p className="text-lg text-neutral-400 mb-10 max-w-lg mx-auto font-medium">Join the next generation of developers who learn security from the start. Free to use.</p>
                    <Link to="/signup">
                        <Button size="lg" className="font-semibold text-base h-14 px-12 bg-white text-black hover:bg-neutral-200 rounded-full gap-3 shadow-[0_0_40px_-10px_rgba(255,255,255,0.3)] hover:scale-105 active:scale-95 transition-all duration-300">
                            Create Free Account <ArrowRight className="w-5 h-5" />
                        </Button>
                    </Link>
                </motion.div>
            </section >

            {/* ─── FOOTER ─── */}
            < footer id="about" className="border-t border-white/[0.04] py-10 px-6" >
                <div className="max-w-6xl mx-auto flex flex-col md:flex-row items-center justify-between gap-4">
                    <div className="flex items-center gap-2.5">
                        <img src="/soteria-logo.png" alt="Soteria" className="w-6 h-6 rounded object-cover" />
                        <span className="text-sm font-bold">SOTERIA</span>
                        <span className="text-xs text-neutral-700 ml-1">&copy; 2026</span>
                    </div>
                    <p className="text-xs text-neutral-700">Security education for students by students.</p>
                </div>
            </footer >
        </div >
    );
}
