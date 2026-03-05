import { motion } from 'framer-motion';
import { Link } from 'react-router-dom';
import { Code2, GraduationCap, Rocket, ScanLine, Brain, Trophy, Github, ArrowRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import PublicNavbar from '@/components/PublicNavbar';

export default function FeaturesPage() {
    return (
        <div className="min-h-screen bg-black text-white overflow-x-hidden selection:bg-blue-600 selection:text-white">
            <PublicNavbar />

            {/* ─── HERO HEADER ─── */}
            <section className="pt-32 pb-16 px-6">
                <div className="max-w-5xl mx-auto text-center">
                    <p className="font-mono text-sm font-bold text-blue-400 uppercase tracking-[0.2em] mb-4 
                                  brutalist-border inline-block px-4 py-2 bg-black brutalist-shadow-cyan">Core Platform</p>
                    <h1 className="text-4xl md:text-5xl lg:text-7xl font-black tracking-tight leading-[1.0] mt-6 uppercase">
                        SECURITY. <span className="text-red-500" style={{ WebkitTextStroke: '2px white' }}>REIMAGINED.</span>
                    </h1>
                </div>
            </section>

            {/* ─── UNIQUE VALUE PROPOSITION ─── */}
            <section className="py-16 px-6">
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

            {/* ─── BENTO GRID ─── */}
            <section className="relative py-24 px-6">
                <div className="max-w-5xl mx-auto relative">
                    <div className="grid md:grid-cols-2 gap-6">
                        {/* Real-Time Scanning */}
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
                                <div className="hidden md:block flex-1 bg-black border-4 border-neutral-700 shadow-[4px_4px_0px_#404040] p-4 font-mono font-bold text-xs leading-6 text-neutral-300 overflow-hidden group-hover:-translate-y-1 transition-transform">
                                    <motion.div
                                        animate={{ opacity: [0.3, 1, 0.3] }}
                                        transition={{ duration: 2, repeat: Infinity }}
                                    >
                                        <div><span className="text-blue-400">$</span> soteria scan login.py</div>
                                        <div className="text-neutral-500 mt-1">Analyzing 47 lines...</div>
                                        <div className="text-red-500 mt-1 font-bold">⚠ 2 critical vulnerabilities found</div>
                                        <div className="text-amber-400 font-bold">⚡ 1 warning detected</div>
                                        <div className="text-emerald-500 mt-1 font-bold">✓ Scan complete — 1.2s</div>
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
                            <div className="w-14 h-14 mb-6 bg-black border-4 border-black flex items-center justify-center text-rose-400 transition-all duration-300 group-hover:bg-rose-400 group-hover:text-black">
                                <Brain className="w-6 h-6" />
                            </div>
                            <h3 className="text-2xl font-black text-white mb-3 tracking-tighter uppercase">AI Explanations</h3>
                            <p className="text-[15px] text-neutral-400 leading-relaxed font-mono">
                                Every vulnerability comes with a clear, beginner-friendly explanation of what went wrong and how to fix it. Learn by doing.
                            </p>
                            <div className="mt-6 p-4 bg-black border-4 border-neutral-700 shadow-[4px_4px_0px_#404040] text-xs text-white font-bold font-mono">
                                <span className="text-rose-400">"</span>This f-string allows user input to modify your SQL...<span className="text-rose-400">"</span>
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
                            <div className="w-14 h-14 mb-6 bg-black border-4 border-black flex items-center justify-center text-amber-400 transition-all duration-300 group-hover:bg-amber-400 group-hover:text-black">
                                <Trophy className="w-6 h-6" />
                            </div>
                            <h3 className="text-2xl font-black text-white mb-3 tracking-tighter uppercase">Gamified Learning</h3>
                            <p className="text-[15px] text-neutral-400 leading-relaxed font-mono">
                                Earn XP for writing secure code and fixing vulnerabilities. Track your progress over time.
                            </p>
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

                        {/* GitHub Integration */}
                        <motion.div
                            initial={{ opacity: 0, y: 20 }}
                            whileInView={{ opacity: 1, y: 0 }}
                            viewport={{ once: true }}
                            transition={{ duration: 0.6, delay: 0.1, ease: [0.16, 1, 0.3, 1] }}
                            className="md:col-span-2 relative p-8 md:p-10 bg-neutral-900 border-4 border-black shadow-[8px_8px_0px_#000000] group transition-all duration-300 hover:-translate-y-1 hover:-translate-x-1 hover:bg-neutral-800"
                        >
                            <div className="flex flex-col md:flex-row gap-8 items-center">
                                <div className="flex-1">
                                    <div className="w-14 h-14 mb-6 bg-black border-4 border-black flex items-center justify-center text-blue-400 transition-all duration-300 group-hover:bg-blue-400 group-hover:text-black">
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
                                            <div className={`w-3 h-3 rounded-none ${i === 0 ? 'bg-primary' : i === 1 ? 'bg-blue-400' : 'bg-red-500'}`} />
                                            {repo}
                                        </motion.div>
                                    ))}
                                </div>
                            </div>
                        </motion.div>
                    </div>
                </div>
            </section>

            {/* ─── CTA ─── */}
            <section className="relative py-24 px-6 bg-blue-600 border-y-4 border-black flex flex-col items-center justify-center">
                <div className="w-full max-w-4xl mx-auto text-center relative z-10">
                    <h2 className="text-5xl md:text-7xl font-black mb-6 tracking-tighter text-black uppercase drop-shadow-[4px_4px_0px_rgba(0,0,0,1)] text-white" style={{ WebkitTextStroke: '2px black' }}>
                        READY TO WRITE<br />SECURE CODE?
                    </h2>
                    <Link to="/signup">
                        <Button size="lg" className="h-16 px-12 text-xl font-black bg-blue-600 text-white border-2 border-blue-400 shadow-[8px_8px_0px_#1e3a5f] hover:translate-y-1 hover:translate-x-1 hover:shadow-[4px_4px_0px_#1e3a5f] transition-all rounded-lg uppercase">
                            START FREE
                        </Button>
                    </Link>
                </div>
            </section>

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
