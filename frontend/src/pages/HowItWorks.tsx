import { motion } from 'framer-motion';
import { Link } from 'react-router-dom';
import { Terminal, BookOpen, Trophy, ArrowRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import PublicNavbar from '@/components/PublicNavbar';

export default function HowItWorks() {
    return (
        <div className="min-h-screen bg-black text-white overflow-x-hidden selection:bg-blue-600 selection:text-white">
            <PublicNavbar />

            {/* ─── HOW IT WORKS ─── */}
            <section className="relative pt-32 pb-32 px-6 bg-black">
                <div className="absolute inset-0 bg-noise opacity-[0.05] pointer-events-none" />
                <div className="max-w-5xl mx-auto relative z-10">
                    <div className="flex flex-col items-center justify-center text-center mb-24 w-full">
                        <p className="font-mono text-sm font-bold text-blue-400 uppercase tracking-[0.2em] mb-4 
                                      brutalist-border inline-block px-4 py-2 bg-black brutalist-shadow-cyan">How It Works</p>
                        <h1 className="text-4xl md:text-5xl lg:text-7xl font-bold tracking-tight leading-[1.0] mt-6 uppercase">
                            SCAN. LEARN. <span className="text-blue-400" style={{ WebkitTextStroke: '1px white' }}>LEVEL UP.</span>
                        </h1>
                    </div>

                    <div className="relative grid md:grid-cols-3 gap-12">
                        {/* Connecting Line */}
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
                                className="relative text-center group bg-black p-8 border-2 border-neutral-700 shadow-[4px_4px_0px_#1e293b] transition-all duration-200 hover:shadow-[2px_2px_0px_#1e293b] hover:translate-x-[2px] hover:translate-y-[2px]"
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

            {/* ─── CTA ─── */}
            <section className="relative py-24 px-6 bg-cyan-400 border-y-4 border-black flex flex-col items-center justify-center">
                <div className="w-full max-w-4xl mx-auto text-center relative z-10">
                    <h2 className="text-5xl md:text-7xl font-black mb-6 tracking-tighter text-black uppercase drop-shadow-[4px_4px_0px_rgba(0,0,0,1)] text-white" style={{ WebkitTextStroke: '2px black' }}>
                        READY TO WRITE<br />SECURE CODE?
                    </h2>
                    <p className="text-xl text-black mb-10 font-mono font-bold max-w-2xl mx-auto bg-white border-4 border-black p-4 shadow-[6px_6px_0px_#000000]">
                        Stop guessing. Start knowing. Scan your first project in seconds.
                    </p>
                    <Link to="/signup">
                        <Button size="lg" className="h-16 px-12 text-xl font-black bg-blue-600 text-white border-2 border-blue-400 shadow-[8px_8px_0px_#1e3a5f] hover:translate-y-1 hover:translate-x-1 hover:shadow-[4px_4px_0px_#1e3a5f] transition-all rounded-lg uppercase">
                            START FREE <ArrowRight className="w-5 h-5 ml-2" />
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
