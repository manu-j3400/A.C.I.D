import { motion } from 'framer-motion';
import { Link } from 'react-router-dom';
import { Terminal, BookOpen, Trophy, ArrowRight } from 'lucide-react';

import { COLORS } from '../theme/colors';
const C = {
    bg:      COLORS.bg,
    accent:  COLORS.acid,
    danger:  COLORS.red,
    amber:   COLORS.orange,
    text:    COLORS.text,
    subdued: COLORS.sub,
    muted:   COLORS.muted,
    border:  COLORS.border,
    font:    "'JetBrains Mono', monospace",
};

const cellStyle: React.CSSProperties = {
    borderRight: `1px solid ${C.border}`,
    padding: '0 16px',
    display: 'flex',
    alignItems: 'center',
    height: '36px',
    fontFamily: C.font,
    fontSize: '11px',
    color: C.subdued,
    whiteSpace: 'nowrap',
};

export default function HowItWorks() {
    return (
        <div style={{ minHeight: '100vh', background: C.bg, color: C.text, fontFamily: C.font, overflowX: 'hidden' }}>

            {/* ─── NAV STRIP ─── */}
            <div style={{ position: 'sticky', top: 0, zIndex: 100, background: C.bg, borderBottom: `1px solid ${C.border}`, display: 'flex', alignItems: 'center', height: '36px' }}>
                <div style={{ ...cellStyle, borderLeft: `1px solid ${C.border}` }}>
                    <Link to="/" style={{ color: C.accent, textDecoration: 'none', fontFamily: C.font, fontSize: '11px', fontWeight: 700, letterSpacing: '0.15em' }}>SOTERIA</Link>
                </div>
                <div style={{ ...cellStyle }}>
                    <Link to="/home" style={{ color: C.subdued, textDecoration: 'none', fontFamily: C.font, fontSize: '11px' }}>[ HOME ]</Link>
                </div>
                <div style={{ ...cellStyle }}>
                    <Link to="/features" style={{ color: C.subdued, textDecoration: 'none', fontFamily: C.font, fontSize: '11px' }}>[ FEATURES ]</Link>
                </div>
                <div style={{ ...cellStyle }}>
                    <Link to="/how-it-works" style={{ color: C.accent, textDecoration: 'none', fontFamily: C.font, fontSize: '11px' }}>[ HOW IT WORKS ]</Link>
                </div>
                <div style={{ ...cellStyle }}>
                    <Link to="/changelog" style={{ color: C.subdued, textDecoration: 'none', fontFamily: C.font, fontSize: '11px' }}>[ CHANGELOG ]</Link>
                </div>
                <div style={{ ...cellStyle }}>
                    <Link to="/about" style={{ color: C.subdued, textDecoration: 'none', fontFamily: C.font, fontSize: '11px' }}>[ ABOUT ]</Link>
                </div>
                <div style={{ flex: 1 }} />
                <div style={{ ...cellStyle, borderLeft: `1px solid ${C.border}`, borderRight: 'none' }}>
                    <Link to="/login" style={{ color: C.subdued, textDecoration: 'none', fontFamily: C.font, fontSize: '11px' }}>[ LOGIN ]</Link>
                </div>
                <div style={{ ...cellStyle, borderLeft: `1px solid ${C.border}`, borderRight: 'none' }}>
                    <Link to="/signup" style={{ color: C.accent, textDecoration: 'none', fontFamily: C.font, fontSize: '11px', fontWeight: 700 }}>[ START FREE ]</Link>
                </div>
            </div>

            {/* ─── PAGE TITLE STRIP ─── */}
            <div style={{ borderBottom: `1px solid ${C.border}`, display: 'flex', alignItems: 'stretch', height: '36px' }}>
                <div style={{ ...cellStyle, borderLeft: `1px solid ${C.border}`, color: C.text, fontWeight: 700, letterSpacing: '0.1em', fontSize: '11px' }}>
                    HOW IT WORKS — METHODOLOGY
                </div>
                <div style={{ ...cellStyle, color: C.accent }}>[ LIVE ]</div>
                <div style={{ ...cellStyle }}>3 STEPS</div>
                <div style={{ ...cellStyle }}>SCAN. LEARN. LEVEL UP.</div>
                <div style={{ flex: 1, borderRight: `1px solid ${C.border}` }} />
                <div style={{ ...cellStyle, borderRight: 'none' }}>UTC {new Date().toISOString().slice(11, 19)}</div>
            </div>

            {/* ─── HERO ─── */}
            <section style={{ padding: '80px 48px 48px', borderBottom: `1px solid ${C.border}` }}>
                <div style={{ maxWidth: '900px', margin: '0 auto' }}>
                    <div style={{ display: 'inline-block', border: `1px solid ${C.border}`, padding: '4px 12px', marginBottom: '24px' }}>
                        <span style={{ fontSize: '10px', color: C.accent, letterSpacing: '0.2em', fontWeight: 700 }}>// PROCESS OVERVIEW</span>
                    </div>
                    <h1 style={{ fontSize: 'clamp(40px, 7vw, 80px)', fontWeight: 900, letterSpacing: '-0.02em', lineHeight: 1, margin: '0 0 16px', textTransform: 'uppercase', fontFamily: C.font }}>
                        SCAN. LEARN.{' '}
                        <span style={{ color: C.accent }}>LEVEL UP.</span>
                    </h1>
                    <p style={{ fontSize: '14px', color: C.subdued, maxWidth: '560px', lineHeight: 1.7 }}>
                        Three deterministic steps from raw code to actionable security intelligence. No black boxes — full visibility at every stage.
                    </p>
                </div>
            </section>

            {/* ─── STEPS ─── */}
            <section style={{ borderBottom: `1px solid ${C.border}` }}>
                <div style={{ borderBottom: `1px solid ${C.border}`, padding: '0 48px', height: '36px', display: 'flex', alignItems: 'center' }}>
                    <span style={{ fontSize: '10px', color: C.subdued, letterSpacing: '0.15em' }}>// EXECUTION PIPELINE — 3 STAGES</span>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)' }}>
                    {[
                        {
                            icon: <Terminal size={24} />,
                            num: '01',
                            title: 'Paste Code',
                            desc: 'Drop any code snippet into the scanner — Python, JavaScript, Go, Rust, SQL, and more. Files via drag-and-drop or direct paste.',
                            detail: [
                                'AST parse → feature extraction',
                                '52-dimensional feature vector',
                                'Multi-language support',
                            ],
                            accent: C.accent,
                        },
                        {
                            icon: <BookOpen size={24} />,
                            num: '02',
                            title: 'Understand',
                            desc: 'Get plain-English explanations of every vulnerability and how to fix it. GCN + SNN ensemble scoring with entropy pre-scan.',
                            detail: [
                                'Gemini 2.5 Pro explainer',
                                'GCN control-flow analysis',
                                'SNN temporal profiling',
                            ],
                            accent: C.amber,
                        },
                        {
                            icon: <Trophy size={24} />,
                            num: '03',
                            title: 'Level Up',
                            desc: 'Earn XP, climb the ranks, and build real security intuition over time. Every scan tracked in your personal history.',
                            detail: [
                                'XP system + rank progression',
                                'Scan history + CSV export',
                                'Security score trending',
                            ],
                            accent: C.text,
                        },
                    ].map((step, i) => (
                        <motion.div
                            key={step.num}
                            initial={{ opacity: 0, y: 16 }}
                            whileInView={{ opacity: 1, y: 0 }}
                            viewport={{ once: true }}
                            transition={{ duration: 0.5, delay: i * 0.15, ease: [0.16, 1, 0.3, 1] }}
                            style={{
                                borderRight: i < 2 ? `1px solid ${C.border}` : 'none',
                                padding: '40px 32px',
                            }}
                        >
                            {/* Step number + icon */}
                            <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: '28px' }}>
                                <div style={{ color: step.accent }}>{step.icon}</div>
                                <div style={{ fontSize: '48px', fontWeight: 900, color: C.muted, lineHeight: 1 }}>{step.num}</div>
                            </div>

                            <div style={{ border: `1px solid ${C.border}`, padding: '4px 10px', display: 'inline-block', marginBottom: '16px' }}>
                                <span style={{ fontSize: '10px', color: step.accent, fontWeight: 700, letterSpacing: '0.1em' }}>[ STEP {step.num} ]</span>
                            </div>

                            <h3 style={{ fontSize: '20px', fontWeight: 900, textTransform: 'uppercase', color: C.text, marginBottom: '12px', lineHeight: 1.1 }}>{step.title}</h3>
                            <p style={{ fontSize: '12px', color: C.subdued, lineHeight: 1.8, marginBottom: '24px' }}>{step.desc}</p>

                            <div style={{ borderTop: `1px solid ${C.border}`, paddingTop: '16px' }}>
                                {step.detail.map((d, j) => (
                                    <div key={j} style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
                                        <span style={{ color: step.accent, fontSize: '10px' }}>+</span>
                                        <span style={{ fontSize: '11px', color: C.subdued }}>{d}</span>
                                    </div>
                                ))}
                            </div>

                            {i < 2 && (
                                <div style={{ marginTop: '32px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                                    <ArrowRight size={14} style={{ color: C.muted }} />
                                    <span style={{ fontSize: '10px', color: C.muted, letterSpacing: '0.1em' }}>NEXT: STEP {String(i + 2).padStart(2, '0')}</span>
                                </div>
                            )}
                        </motion.div>
                    ))}
                </div>
            </section>

            {/* ─── PIPELINE DIAGRAM ─── */}
            <section style={{ borderBottom: `1px solid ${C.border}` }}>
                <div style={{ borderBottom: `1px solid ${C.border}`, padding: '0 48px', height: '36px', display: 'flex', alignItems: 'center' }}>
                    <span style={{ fontSize: '10px', color: C.subdued, letterSpacing: '0.15em' }}>// DETECTION ENGINE PIPELINE</span>
                </div>
                <div style={{ padding: '40px 48px', overflowX: 'auto' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0', minWidth: '700px' }}>
                        {[
                            { label: 'RAW CODE', sub: 'Input', color: C.subdued },
                            { label: 'AST PARSE', sub: 'Phase 1', color: C.text },
                            { label: 'ENTROPY SCAN', sub: 'Phase 1.5', color: C.amber },
                            { label: 'SNN PROFILE', sub: 'Phase 1.6', color: C.accent },
                            { label: 'RF ENSEMBLE', sub: 'Phase 2', color: C.text },
                            { label: 'GCN BLEND', sub: 'Phase 5.5', color: C.accent },
                            { label: 'VERDICT', sub: 'Output', color: C.danger },
                        ].map((node, i, arr) => (
                            <div key={node.label} style={{ display: 'flex', alignItems: 'center', flex: i === arr.length - 1 ? 'none' : 1 }}>
                                <div style={{ border: `1px solid ${node.color}`, padding: '10px 14px', background: '#050505', flexShrink: 0 }}>
                                    <div style={{ fontSize: '10px', fontWeight: 700, color: node.color, letterSpacing: '0.08em' }}>{node.label}</div>
                                    <div style={{ fontSize: '9px', color: C.muted, marginTop: '2px' }}>{node.sub}</div>
                                </div>
                                {i < arr.length - 1 && (
                                    <div style={{ flex: 1, height: '1px', background: C.border, minWidth: '24px', position: 'relative' }}>
                                        <div style={{ position: 'absolute', right: '-4px', top: '-4px', width: '8px', height: '8px', borderTop: `1px solid ${C.border}`, borderRight: `1px solid ${C.border}`, transform: 'rotate(45deg)' }} />
                                    </div>
                                )}
                            </div>
                        ))}
                    </div>
                </div>
            </section>

            {/* ─── CTA ─── */}
            <section style={{ borderBottom: `1px solid ${C.border}` }}>
                <div style={{ borderBottom: `1px solid ${C.border}`, padding: '0 48px', height: '36px', display: 'flex', alignItems: 'center' }}>
                    <span style={{ fontSize: '10px', color: C.subdued, letterSpacing: '0.15em' }}>// CALL TO ACTION</span>
                </div>
                <div style={{ padding: '64px 48px', display: 'flex', flexDirection: 'column', alignItems: 'flex-start', gap: '24px' }}>
                    <h2 style={{ fontSize: 'clamp(32px, 5vw, 60px)', fontWeight: 900, textTransform: 'uppercase', lineHeight: 1, margin: 0, fontFamily: C.font }}>
                        READY TO WRITE<br />
                        <span style={{ color: C.accent }}>SECURE CODE?</span>
                    </h2>
                    <p style={{ fontSize: '13px', color: C.subdued, margin: 0 }}>Stop guessing. Start knowing. Scan your first project in seconds.</p>
                    <Link
                        to="/signup"
                        style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '10px',
                            border: `1px solid ${C.accent}`,
                            background: C.accent,
                            color: '#000',
                            fontFamily: C.font,
                            fontSize: '12px',
                            fontWeight: 700,
                            letterSpacing: '0.15em',
                            padding: '12px 28px',
                            textDecoration: 'none',
                            textTransform: 'uppercase',
                        }}
                    >
                        START FREE <ArrowRight size={14} />
                    </Link>
                </div>
            </section>

            {/* ─── FOOTER ─── */}
            <footer style={{ borderTop: `1px solid ${C.border}`, padding: '0', display: 'flex', alignItems: 'stretch', height: '36px' }}>
                <div style={{ ...cellStyle, borderLeft: `1px solid ${C.border}` }}>
                    <Link to="/" style={{ color: C.text, textDecoration: 'none', fontWeight: 700, letterSpacing: '0.15em', fontSize: '11px' }}>SOTERIA</Link>
                </div>
                <div style={{ ...cellStyle }}>
                    <span style={{ color: C.muted }}>© {new Date().getFullYear()} SOTERIA. BUILT FOR BUILDERS.</span>
                </div>
                <div style={{ flex: 1 }} />
                <div style={{ ...cellStyle, borderLeft: `1px solid ${C.border}`, borderRight: 'none' }}>
                    <Link to="/about" style={{ color: C.subdued, textDecoration: 'none', fontSize: '11px' }}>ABOUT</Link>
                </div>
                <div style={{ ...cellStyle, borderLeft: `1px solid ${C.border}`, borderRight: 'none' }}>
                    <a href="https://github.com/manujawahar/ACID" target="_blank" rel="noopener noreferrer" style={{ color: C.subdued, textDecoration: 'none', fontSize: '11px' }}>OPEN SOURCE</a>
                </div>
            </footer>
        </div>
    );
}
