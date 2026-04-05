/**
 * Soteria Landing Page — Revamp
 * Design: Cyberpunk/HUD dark · Share Tech Mono + Fira Code
 * Components: 21stDev bento grid · blurred marquee · digit-scroll counters
 * Palette: #000000 bg · #22D3EE cyan · #22C55E green CTA · #0EA5E9 blue
 */
import React from 'react';
import { motion, AnimatePresence, useInView, useMotionValue, useSpring, useTransform } from 'framer-motion';
import { Link } from 'react-router-dom';
import {
  Shield, Code2, Brain, Zap, GitBranch, ArrowRight,
  Github, Eye, Terminal, Activity,
  Cpu, Network, CheckCircle
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import PublicNavbar from '@/components/PublicNavbar';
import { HeroMiniDemo } from '@/components/HeroMiniDemo';
import { useState, useEffect, useRef } from 'react';

/* ─────────────────── FONTS ─────────────────── */
const FontImport = () => (
  <style>{`
    @import url('https://fonts.googleapis.com/css2?family=Share+Tech+Mono&family=Fira+Code:wght@300;400;500;600;700&family=Space+Grotesk:wght@400;500;600;700;800&display=swap');
    .font-display { font-family: 'Space Grotesk', sans-serif; }
    .font-mono-tech { font-family: 'Share Tech Mono', monospace; }
    .font-code { font-family: 'Fira Code', monospace; }
    @keyframes marquee-scroll { from { transform: translateX(0); } to { transform: translateX(-50%); } }
    @keyframes scan-line { 0%,100% { top: 0%; } 50% { top: 100%; } }
    @keyframes glow-pulse { 0%,100% { opacity:0.4; transform:scale(1); } 50% { opacity:0.7; transform:scale(1.08); } }
    @keyframes border-spin { to { --angle: 360deg; } }
    @property --angle { syntax: '<angle>'; initial-value: 0deg; inherits: false; }
    .gradient-border {
      border: 1px solid transparent;
      background: linear-gradient(#000, #000) padding-box,
                  conic-gradient(from var(--angle), #22D3EE, #0EA5E9, #22C55E, #22D3EE) border-box;
      animation: border-spin 4s linear infinite;
    }
    .scanline::after {
      content: '';
      position: absolute;
      left: 0; right: 0; height: 1px;
      background: linear-gradient(90deg, transparent, rgba(34,211,238,0.3), transparent);
      animation: scan-line 6s ease-in-out infinite;
      pointer-events: none;
    }
  `}</style>
);

/* ─────────────────── ANIMATED BACKGROUND ─────────────────── */
function HeroBackground() {
  return (
    <div className="absolute inset-0 overflow-hidden pointer-events-none">
      {/* Grid */}
      <div className="absolute inset-0 opacity-[0.06]"
        style={{ backgroundImage: 'linear-gradient(rgba(34,211,238,0.5) 1px, transparent 1px), linear-gradient(90deg, rgba(34,211,238,0.5) 1px, transparent 1px)', backgroundSize: '50px 50px' }} />
      {/* Orbs */}
      <motion.div className="absolute -top-40 -left-40 w-[700px] h-[700px] rounded-full"
        style={{ background: 'radial-gradient(circle, rgba(14,165,233,0.12) 0%, transparent 70%)' }}
        animate={{ scale: [1, 1.15, 1], opacity: [0.6, 1, 0.6] }}
        transition={{ duration: 8, repeat: Infinity, ease: 'easeInOut' }} />
      <motion.div className="absolute top-1/3 right-0 w-[500px] h-[500px] rounded-full"
        style={{ background: 'radial-gradient(circle, rgba(34,211,238,0.08) 0%, transparent 70%)' }}
        animate={{ scale: [1, 1.2, 1], opacity: [0.4, 0.8, 0.4] }}
        transition={{ duration: 10, repeat: Infinity, ease: 'easeInOut', delay: 2 }} />
      <motion.div className="absolute bottom-0 left-1/3 w-[400px] h-[400px] rounded-full"
        style={{ background: 'radial-gradient(circle, rgba(34,197,94,0.06) 0%, transparent 70%)' }}
        animate={{ scale: [1, 1.1, 1], opacity: [0.3, 0.6, 0.3] }}
        transition={{ duration: 12, repeat: Infinity, ease: 'easeInOut', delay: 4 }} />
      {/* Scan line */}
      <motion.div className="absolute left-0 right-0 h-px bg-cyan-500/20"
        animate={{ top: ['0%', '100%', '0%'] }}
        transition={{ duration: 10, repeat: Infinity, ease: 'linear' }} />
    </div>
  );
}

/* ─────────────────── ROTATING TEXT ─────────────────── */
const rotatingWords = ['SECURITY', 'CONFIDENCE', 'TRUST', 'SPEED', 'ZERO BUGS', 'PEACE'];
function RotatingText() {
  const [idx, setIdx] = useState(0);
  useEffect(() => {
    const t = setInterval(() => setIdx(i => (i + 1) % rotatingWords.length), 2800);
    return () => clearInterval(t);
  }, []);
  return (
    <span className="inline-block relative h-[1.1em] overflow-hidden align-bottom">
      <AnimatePresence mode="wait">
        <motion.span key={rotatingWords[idx]}
          className="inline-block text-cyan-400 whitespace-nowrap font-display"
          style={{ textShadow: '0 0 30px rgba(34,211,238,0.6)' }}
          initial={{ y: '100%', opacity: 0 }}
          animate={{ y: '0%', opacity: 1 }}
          exit={{ y: '-100%', opacity: 0 }}
          transition={{ duration: 0.45, ease: [0.16, 1, 0.3, 1] }}>
          {rotatingWords[idx]}
        </motion.span>
      </AnimatePresence>
    </span>
  );
}

/* ─────────────────── MARQUEE ─────────────────── */
const marqueeItems = [
  { label: '509 Vulnerability Patterns', icon: <Shield className="w-3.5 h-3.5" /> },
  { label: 'Sub-second AST Scans', icon: <Zap className="w-3.5 h-3.5" /> },
  { label: 'Python · Go · Rust · JS · TS · PHP', icon: <Code2 className="w-3.5 h-3.5" /> },
  { label: 'GCN Neural Engine', icon: <Brain className="w-3.5 h-3.5" /> },
  { label: 'Zero Configuration', icon: <CheckCircle className="w-3.5 h-3.5" /> },
  { label: 'GitHub PR Integration', icon: <GitBranch className="w-3.5 h-3.5" /> },
  { label: 'AI-Powered Fix Suggestions', icon: <Cpu className="w-3.5 h-3.5" /> },
  { label: 'SNN Temporal Profiler', icon: <Activity className="w-3.5 h-3.5" /> },
];
function Marquee() {
  const doubled = [...marqueeItems, ...marqueeItems];
  return (
    <div className="border-y border-white/[0.06] bg-black/60 backdrop-blur-sm py-3 overflow-hidden relative"
      style={{ maskImage: 'linear-gradient(to right, transparent, black 8%, black 92%, transparent)' }}>
      <div className="flex gap-10 w-max"
        style={{ animation: 'marquee-scroll 32s linear infinite' }}>
        {doubled.map((item, i) => (
          <div key={i} className="flex items-center gap-2.5 text-xs font-code text-neutral-400 whitespace-nowrap px-2">
            <span className="text-cyan-500/70">{item.icon}</span>
            <span>{item.label}</span>
            <span className="text-white/20 ml-2">·</span>
          </div>
        ))}
      </div>
    </div>
  );
}

/* ─────────────────── ANIMATED COUNTER ─────────────────── */
function AnimatedStat({ value, suffix = '', label, color }: { value: number; suffix?: string; label: string; color: string }) {
  const ref = useRef<HTMLDivElement>(null);
  const isInView = useInView(ref, { once: true, margin: '-50px' });
  const motionVal = useMotionValue(0);
  const spring = useSpring(motionVal, { stiffness: 80, damping: 20 });
  const display = useTransform(spring, v => `${Math.round(v)}${suffix}`);

  useEffect(() => {
    if (isInView) motionVal.set(value);
  }, [isInView, motionVal, value]);

  return (
    <motion.div ref={ref}
      initial={{ opacity: 0, y: 20 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true }}
      transition={{ duration: 0.6 }}
      className="text-center p-6 border border-white/[0.06] bg-white/[0.02] backdrop-blur-sm hover:border-white/[0.12] transition-all duration-300 group cursor-default">
      <div className={`text-4xl md:text-5xl font-display font-black tracking-tight mb-2 tabular-nums ${color}`}
        style={{ textShadow: `0 0 20px currentColor` }}>
        <motion.span>{display}</motion.span>
      </div>
      <div className="text-[11px] font-mono-tech text-neutral-500 uppercase tracking-[0.2em]">{label}</div>
    </motion.div>
  );
}

/* ─────────────────── BENTO GRID ─────────────────── */
interface BentoCardProps {
  icon: React.ReactNode;
  title: string;
  desc: string;
  meta?: string;
  tag: string;
  colSpan?: boolean;
  accent: string;
  glow: string;
  delay?: number;
}
function BentoCard({ icon, title, desc, meta, tag, colSpan, accent, glow, delay = 0 }: BentoCardProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true }}
      transition={{ duration: 0.5, delay }}
      className={`group relative p-6 border border-white/[0.07] bg-white/[0.03] backdrop-blur-sm
        hover:border-white/[0.15] hover:-translate-y-1 hover:bg-white/[0.05]
        transition-all duration-300 overflow-hidden cursor-default
        ${colSpan ? 'md:col-span-2' : ''}`}>
      {/* Glow on hover */}
      <div className={`absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-500 pointer-events-none`}
        style={{ background: `radial-gradient(ellipse 60% 50% at 30% 20%, ${glow}, transparent)` }} />
      {/* Corner marks — HUD aesthetic */}
      <span className={`absolute top-2 left-2 w-2.5 h-2.5 border-t border-l ${accent} opacity-50 group-hover:opacity-100 transition-opacity`} />
      <span className={`absolute bottom-2 right-2 w-2.5 h-2.5 border-b border-r ${accent} opacity-50 group-hover:opacity-100 transition-opacity`} />

      <div className="relative z-10">
        <div className="flex items-start justify-between mb-4">
          <div className={`w-10 h-10 flex items-center justify-center border ${accent} bg-black/40`}>
            {icon}
          </div>
          <span className={`text-[10px] font-mono-tech uppercase tracking-widest px-2 py-1 border ${accent} bg-black/60`}>
            {tag}
          </span>
        </div>
        <h3 className="font-display font-bold text-white text-lg mb-2 tracking-tight">{title}</h3>
        {meta && <div className={`text-xs font-mono-tech mb-2 ${accent.replace('border-', 'text-')}`}>{meta}</div>}
        <p className="text-sm text-neutral-400 font-code leading-relaxed">{desc}</p>
      </div>
    </motion.div>
  );
}

/* ─────────────────── HOW IT WORKS STEP ─────────────────── */
function Step({ num, title, desc, delay }: { num: string; title: string; desc: string; delay: number }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true }}
      transition={{ duration: 0.6, delay }}
      className="flex flex-col items-center text-center relative">
      <div className="w-14 h-14 border-2 border-cyan-500/40 bg-cyan-500/[0.08] flex items-center justify-center mb-5 relative"
        style={{ boxShadow: '0 0 20px rgba(34,211,238,0.15)' }}>
        <span className="font-mono-tech text-cyan-400 text-xl">{num}</span>
      </div>
      <h3 className="font-display font-bold text-white text-lg mb-2">{title}</h3>
      <p className="text-sm text-neutral-400 font-code leading-relaxed max-w-[220px]">{desc}</p>
    </motion.div>
  );
}

/* ═══════════════════ MAIN COMPONENT ═══════════════════ */
export default function LandingPage() {
  return (
    <div className="min-h-screen bg-black text-white overflow-x-hidden selection:bg-cyan-600/40">
      <FontImport />
      <PublicNavbar />

      {/* ─── HERO ─── */}
      <section className="relative pt-36 pb-24 px-6 scanline overflow-hidden">
        <HeroBackground />
        <div className="max-w-7xl mx-auto relative z-10">
          <div className="grid lg:grid-cols-2 gap-16 items-center">

            {/* Left */}
            <motion.div
              initial={{ opacity: 0, y: 24 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.9, ease: [0.16, 1, 0.3, 1] }}>

              {/* Badge */}
              <motion.div
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.2 }}
                className="inline-flex items-center gap-2 mb-7 px-3 py-1.5 border border-cyan-500/30 bg-cyan-500/[0.06] backdrop-blur-sm">
                <span className="flex h-1.5 w-1.5 rounded-full bg-cyan-400" style={{ boxShadow: '0 0 8px rgba(34,211,238,0.8)' }} />
                <span className="font-mono-tech text-[11px] text-cyan-400/80 uppercase tracking-widest">Soteria Engine v2.0 · Live</span>
              </motion.div>

              {/* Headline */}
              <h1 className="font-display font-black leading-[1.04] tracking-tight mb-3 uppercase">
                <span className="block text-4xl md:text-5xl lg:text-6xl text-white/90 mb-1">Deploy Code With</span>
                <span className="block text-[3.2rem] md:text-[4.5rem] lg:text-[5.5rem]">
                  <RotatingText />
                </span>
              </h1>

              <p className="font-code text-[15px] text-neutral-400 leading-relaxed mb-9 max-w-[500px]">
                AI-powered code security that identifies vulnerabilities in milliseconds.
                Understand why they matter. Ship secure code — without slowing down.
              </p>

              {/* CTAs */}
              <div className="flex items-center gap-4 flex-wrap">
                <Link to="/signup">
                  <Button size="lg"
                    className="h-12 px-8 font-display font-bold text-sm bg-cyan-500 text-black hover:bg-cyan-400 transition-all duration-200 rounded-none border-0 uppercase tracking-wider"
                    style={{ boxShadow: '0 0 20px rgba(34,211,238,0.35)' }}>
                    Start Free <ArrowRight className="w-4 h-4 ml-1" />
                  </Button>
                </Link>
                <Link to="/how-it-works">
                  <Button size="lg" variant="ghost"
                    className="h-12 px-7 font-display font-bold text-sm text-neutral-300 hover:text-white hover:bg-white/[0.06] border border-white/10 rounded-none uppercase tracking-wider transition-all duration-200">
                    See How It Works
                  </Button>
                </Link>
                <motion.a
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ delay: 0.6 }}
                  href="https://www.producthunt.com/products/soteria?embed=true&utm_source=badge-featured&utm_medium=badge&utm_campaign=badge-soteria"
                  target="_blank" rel="noopener noreferrer">
                  <img alt="Soteria on Product Hunt"
                    src="https://api.producthunt.com/widgets/embed-image/v1/featured.svg?post_id=1088107&theme=dark&t=1772448063610"
                    className="h-11 w-auto opacity-80 hover:opacity-100 transition-opacity" />
                </motion.a>
              </div>
            </motion.div>

            {/* Right: Demo */}
            <motion.div
              initial={{ opacity: 0, y: 30 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.9, delay: 0.25, ease: [0.16, 1, 0.3, 1] }}
              className="hidden lg:block relative">
              {/* Try it label */}
              <motion.div
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 1.4 }}
                className="absolute -top-8 -left-10 z-20 flex items-center gap-2 -rotate-6">
                <span className="font-mono-tech text-xs bg-amber-400 text-black px-2 py-1 border border-black">
                  Try it!
                </span>
                <ArrowRight className="w-4 h-4 text-amber-400" />
              </motion.div>
              {/* Glow frame */}
              <div className="absolute inset-0 -m-4 rounded-sm pointer-events-none"
                style={{ boxShadow: 'inset 0 0 60px rgba(34,211,238,0.06)' }} />
              <HeroMiniDemo />
            </motion.div>
          </div>
        </div>
      </section>

      {/* ─── MARQUEE ─── */}
      <Marquee />

      {/* ─── BENTO FEATURES ─── */}
      <section className="relative py-24 px-6 bg-black">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-14">
            <motion.p
              initial={{ opacity: 0, y: 10 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              className="font-mono-tech text-[11px] text-cyan-500 uppercase tracking-[0.3em] mb-4">
              // capability_matrix
            </motion.p>
            <motion.h2
              initial={{ opacity: 0, y: 10 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: 0.1 }}
              className="font-display font-black text-4xl md:text-5xl uppercase tracking-tight">
              Everything You Need To{' '}
              <span className="text-cyan-400" style={{ textShadow: '0 0 30px rgba(34,211,238,0.4)' }}>
                Ship Safe
              </span>
            </motion.h2>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <BentoCard
              colSpan
              icon={<Terminal className="w-5 h-5 text-cyan-400" />}
              title="Real-time AST Scanner"
              meta="// avg_scan_time: &lt;2000ms"
              desc="Hybrid AST engine parses your code's syntax tree structurally — identifying injection vectors, taint flows, and unsafe patterns before your CI/CD pipeline even starts."
              tag="Core"
              accent="border-cyan-500/40"
              glow="rgba(34,211,238,0.08)"
              delay={0}
            />
            <BentoCard
              icon={<Shield className="w-5 h-5 text-emerald-400" />}
              title="509 Vulnerability Patterns"
              meta="// langs: py · go · rs · js · ts · php"
              desc="Hand-crafted detection rules covering OWASP Top 10, supply chain attacks, and language-specific CVEs."
              tag="Detection"
              accent="border-emerald-500/40"
              glow="rgba(34,197,94,0.08)"
              delay={0.05}
            />
            <BentoCard
              icon={<Brain className="w-5 h-5 text-violet-400" />}
              title="GCN + SNN Neural Engine"
              meta="// model: GATConv · F1 ≥ 0.70"
              desc="Graph Convolutional Network blended with a Spiking Neural Network temporal profiler for deep structural malware detection."
              tag="AI"
              accent="border-violet-500/40"
              glow="rgba(139,92,246,0.08)"
              delay={0.1}
            />
            <BentoCard
              icon={<Eye className="w-5 h-5 text-amber-400" />}
              title="Zero-BS Explanations"
              desc="No cryptic CWE codes. Soteria explains what's wrong, why it matters, and hands you patched code — in plain English."
              tag="UX"
              accent="border-amber-500/40"
              glow="rgba(245,158,11,0.08)"
              delay={0.15}
            />
            <BentoCard
              icon={<GitBranch className="w-5 h-5 text-sky-400" />}
              title="GitHub PR Reviews"
              desc="Automated PR security reviewer runs on every pull request — flags CRITICAL findings before merge, posts GitHub-ready comments."
              tag="CI/CD"
              accent="border-sky-500/40"
              glow="rgba(14,165,233,0.08)"
              delay={0.2}
            />
            <BentoCard
              icon={<Network className="w-5 h-5 text-rose-400" />}
              title="eBPF Kernel Engine"
              desc="Module 1 production runtime — LSM hooks, per-IP/port policy enforcement, and hot-reload via inotify."
              tag="Runtime"
              accent="border-rose-500/40"
              glow="rgba(244,63,94,0.08)"
              delay={0.25}
            />
          </div>
        </div>
      </section>

      {/* ─── STATS ─── */}
      <section className="py-20 px-6 border-y border-white/[0.04] bg-black">
        <div className="max-w-5xl mx-auto grid grid-cols-2 md:grid-cols-4 gap-3">
          <AnimatedStat value={509} suffix="+" label="Vulnerability Patterns" color="text-cyan-400" />
          <AnimatedStat value={2} suffix="s" label="Avg Scan Time" color="text-emerald-400" />
          <AnimatedStat value={6} suffix="+" label="Languages" color="text-sky-400" />
          <AnimatedStat value={100} suffix="%" label="Free & Open Source" color="text-amber-400" />
        </div>
      </section>

      {/* ─── HOW IT WORKS ─── */}
      <section className="py-28 px-6 bg-black">
        <div className="max-w-5xl mx-auto">
          <div className="text-center mb-16">
            <motion.p
              initial={{ opacity: 0 }}
              whileInView={{ opacity: 1 }}
              viewport={{ once: true }}
              className="font-mono-tech text-[11px] text-emerald-500 uppercase tracking-[0.3em] mb-4">
              // execution_flow
            </motion.p>
            <motion.h2
              initial={{ opacity: 0, y: 10 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: 0.1 }}
              className="font-display font-black text-4xl md:text-5xl uppercase tracking-tight">
              Three Steps to{' '}
              <span className="text-emerald-400" style={{ textShadow: '0 0 30px rgba(34,197,94,0.4)' }}>
                Secure Code
              </span>
            </motion.h2>
          </div>

          <div className="relative grid md:grid-cols-3 gap-8">
            {/* Connector line */}
            <div className="hidden md:block absolute top-7 left-[calc(16.7%+28px)] right-[calc(16.7%+28px)] h-px bg-gradient-to-r from-cyan-500/20 via-emerald-500/20 to-cyan-500/20" />

            <Step num="01" title="Paste Your Code"
              desc="Drop any snippet or file — Python, Go, Rust, JS, TS, PHP. No install required."
              delay={0} />
            <Step num="02" title="Kyber Engine Analyzes"
              desc="AST parsing + GCN neural model + 509 pattern rules run in under 2 seconds."
              delay={0.15} />
            <Step num="03" title="Fix & Ship"
              desc="Get the exact vulnerable line, CWE reference, and AI-generated patched code."
              delay={0.3} />
          </div>
        </div>
      </section>

      {/* ─── CTA ─── */}
      <section className="py-28 px-6 bg-black">
        <div className="max-w-4xl mx-auto">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.7 }}
            className="gradient-border p-px">
            <div className="bg-black px-10 py-16 text-center relative overflow-hidden">
              {/* Inner glow */}
              <div className="absolute inset-0 pointer-events-none"
                style={{ background: 'radial-gradient(ellipse 60% 60% at 50% 0%, rgba(34,211,238,0.06), transparent)' }} />

              <p className="font-mono-tech text-[11px] text-cyan-500 uppercase tracking-[0.3em] mb-5">
                // ready_to_deploy
              </p>
              <h2 className="font-display font-black text-4xl md:text-6xl uppercase tracking-tight text-white mb-5 leading-tight">
                Stop Guessing.<br />
                <span className="text-cyan-400" style={{ textShadow: '0 0 40px rgba(34,211,238,0.5)' }}>
                  Start Knowing.
                </span>
              </h2>
              <p className="font-code text-neutral-400 text-base mb-10 max-w-xl mx-auto">
                Scan your first project in seconds. No credit card. No bloated SDK. No 14-day trial.
              </p>
              <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
                <Link to="/signup">
                  <Button size="lg"
                    className="h-12 px-10 text-base font-display font-bold bg-emerald-500 text-black hover:bg-emerald-400 rounded-none border-0 uppercase tracking-wider transition-all duration-200"
                    style={{ boxShadow: '0 0 30px rgba(34,197,94,0.4)' }}>
                    Start Free — No Sign Up Required
                  </Button>
                </Link>
                <Link to="/scanner">
                  <Button size="lg" variant="ghost"
                    className="h-12 px-8 text-base font-display font-bold text-neutral-400 hover:text-white border border-white/10 rounded-none uppercase tracking-wider transition-all duration-200">
                    <Terminal className="w-4 h-4 mr-2" /> Open Scanner
                  </Button>
                </Link>
              </div>
            </div>
          </motion.div>
        </div>
      </section>

      {/* ─── FOOTER ─── */}
      <footer className="border-t border-white/[0.05] bg-black py-12">
        <div className="max-w-6xl mx-auto px-6 flex flex-col md:flex-row justify-between items-center gap-6">
          <Link to="/" className="flex items-center gap-3 group">
            <img src="/soteria-logo.png" alt="Soteria" className="h-8 w-8 object-cover" />
            <span className="font-mono-tech text-lg tracking-[0.2em] uppercase text-white">SOTERIA</span>
          </Link>

          <div className="flex gap-8 font-mono-tech text-xs">
            {[
              { to: '/about', label: 'About' },
              { to: '/features', label: 'Features' },
              { to: '/changelog', label: 'Changelog' },
            ].map(link => (
              <Link key={link.to} to={link.to}
                className="text-neutral-500 hover:text-cyan-400 transition-colors uppercase tracking-widest">
                {link.label}
              </Link>
            ))}
            <a href="https://github.com/manujawahar/ACID" target="_blank" rel="noopener noreferrer"
              className="text-neutral-500 hover:text-cyan-400 transition-colors uppercase tracking-widest flex items-center gap-1.5">
              <Github className="w-3.5 h-3.5" /> GitHub
            </a>
          </div>

          <div className="font-mono-tech text-[10px] text-neutral-600 uppercase tracking-widest">
            © {new Date().getFullYear()} Soteria · Built for builders
          </div>
        </div>
      </footer>
    </div>
  );
}
