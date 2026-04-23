import { motion } from 'framer-motion';
import { Link } from 'react-router-dom';
import { Code2, GraduationCap, Rocket, ScanLine, Brain, Trophy, Github } from 'lucide-react';

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

export default function FeaturesPage() {
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
                    <Link to="/features" style={{ color: C.accent, textDecoration: 'none', fontFamily: C.font, fontSize: '11px' }}>[ FEATURES ]</Link>
                </div>
                <div style={{ ...cellStyle }}>
                    <Link to="/how-it-works" style={{ color: C.subdued, textDecoration: 'none', fontFamily: C.font, fontSize: '11px' }}>[ HOW IT WORKS ]</Link>
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
                    CORE PLATFORM — FEATURES
                </div>
                <div style={{ ...cellStyle, color: C.accent }}>[ LIVE ]</div>
                <div style={{ ...cellStyle }}>6 FEATURES</div>
                <div style={{ ...cellStyle }}>KYBER ENGINE v2.5.0</div>
                <div style={{ flex: 1, borderRight: `1px solid ${C.border}` }} />
                <div style={{ ...cellStyle, borderRight: 'none' }}>UTC {new Date().toISOString().slice(11, 19)}</div>
            </div>

            {/* ─── HERO ─── */}
            <section style={{ padding: '80px 48px 48px', borderBottom: `1px solid ${C.border}` }}>
                <div style={{ maxWidth: '900px', margin: '0 auto' }}>
                    <div style={{ display: 'inline-block', border: `1px solid ${C.border}`, padding: '4px 12px', marginBottom: '24px' }}>
                        <span style={{ fontSize: '10px', color: C.accent, letterSpacing: '0.2em', fontWeight: 700 }}>// CORE PLATFORM</span>
                    </div>
                    <h1 style={{ fontSize: 'clamp(40px, 7vw, 80px)', fontWeight: 900, letterSpacing: '-0.02em', lineHeight: 1, margin: '0 0 16px', textTransform: 'uppercase', fontFamily: C.font }}>
                        SECURITY.{' '}
                        <span style={{ color: C.danger, WebkitTextStroke: `1px ${C.text}` } as React.CSSProperties}>REIMAGINED.</span>
                    </h1>
                    <p style={{ fontSize: '14px', color: C.subdued, maxWidth: '560px', lineHeight: 1.7 }}>
                        Hybrid AST + GCN + SNN detection stack. Sub-second vulnerability identification across 500+ patterns in Python, Go, Rust, JavaScript, and more.
                    </p>
                </div>
            </section>

            {/* ─── UVP GRID ─── */}
            <section style={{ padding: '0', borderBottom: `1px solid ${C.border}` }}>
                <div style={{ borderBottom: `1px solid ${C.border}`, padding: '0 48px', height: '36px', display: 'flex', alignItems: 'center' }}>
                    <span style={{ fontSize: '10px', color: C.subdued, letterSpacing: '0.15em' }}>// VALUE PROPOSITION — 3 PILLARS</span>
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', maxWidth: '100%' }}>
                    {[
                        {
                            icon: <Code2 size={20} />,
                            label: 'INSTANT AST AUDITS',
                            tag: '[ FEATURE ]',
                            tagColor: C.accent,
                            desc: 'Stop waiting for 30-minute CI/CD pipelines to fail. Hybrid AST engine identifies structural vulnerabilities locally in milliseconds.',
                            stat: '< 2s',
                            statLabel: 'SCAN TIME',
                        },
                        {
                            icon: <GraduationCap size={20} />,
                            label: 'ZERO-BS EXPLANATIONS',
                            tag: '[ FEATURE ]',
                            tagColor: C.amber,
                            desc: 'No cryptic CWE codes. Models explain exactly what\'s wrong, why it\'s dangerous, and give you the patched code in plain English.',
                            stat: '100%',
                            statLabel: 'PLAIN ENGLISH',
                        },
                        {
                            icon: <Rocket size={20} />,
                            label: 'FRICTIONLESS WORKFLOW',
                            tag: '[ FEATURE ]',
                            tagColor: C.danger,
                            desc: 'No 14-day trials. No forced sales calls. No bloated SDKs. Paste your code, get secure fixes, keep shipping.',
                            stat: '0',
                            statLabel: 'SETUP STEPS',
                        },
                    ].map((uvp, i) => (
                        <motion.div
                            key={uvp.label}
                            initial={{ opacity: 0, y: 10 }}
                            whileInView={{ opacity: 1, y: 0 }}
                            viewport={{ once: true }}
                            transition={{ duration: 0.4, delay: i * 0.1 }}
                            style={{
                                borderRight: i < 2 ? `1px solid ${C.border}` : 'none',
                                padding: '32px',
                                cursor: 'default',
                            }}
                        >
                            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '20px' }}>
                                <div style={{ color: uvp.tagColor }}>{uvp.icon}</div>
                                <span style={{ fontSize: '10px', color: uvp.tagColor, fontWeight: 700, letterSpacing: '0.1em' }}>{uvp.tag}</span>
                            </div>
                            <div style={{ fontSize: '11px', fontWeight: 700, color: C.text, letterSpacing: '0.1em', marginBottom: '12px' }}>{uvp.label}</div>
                            <p style={{ fontSize: '12px', color: C.subdued, lineHeight: 1.7, marginBottom: '24px' }}>{uvp.desc}</p>
                            <div style={{ borderTop: `1px solid ${C.border}`, paddingTop: '16px' }}>
                                <div style={{ fontSize: '28px', fontWeight: 900, color: uvp.tagColor, lineHeight: 1 }}>{uvp.stat}</div>
                                <div style={{ fontSize: '10px', color: C.subdued, letterSpacing: '0.12em', marginTop: '4px' }}>{uvp.statLabel}</div>
                            </div>
                        </motion.div>
                    ))}
                </div>
            </section>

            {/* ─── FEATURE BLOCKS ─── */}
            <section style={{ borderBottom: `1px solid ${C.border}` }}>
                <div style={{ borderBottom: `1px solid ${C.border}`, padding: '0 48px', height: '36px', display: 'flex', alignItems: 'center' }}>
                    <span style={{ fontSize: '10px', color: C.subdued, letterSpacing: '0.15em' }}>// PLATFORM CAPABILITIES</span>
                </div>

                {/* Real-Time Scanning — full width */}
                <motion.div
                    initial={{ opacity: 0, y: 10 }}
                    whileInView={{ opacity: 1, y: 0 }}
                    viewport={{ once: true }}
                    transition={{ duration: 0.5 }}
                    style={{ borderBottom: `1px solid ${C.border}`, display: 'grid', gridTemplateColumns: '1fr 1fr' }}
                >
                    <div style={{ padding: '32px 48px', borderRight: `1px solid ${C.border}` }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '16px' }}>
                            <ScanLine size={16} style={{ color: C.danger }} />
                            <span style={{ fontSize: '10px', color: C.danger, fontWeight: 700, letterSpacing: '0.15em' }}>[ ACTIVE ] REAL-TIME SCANNING</span>
                        </div>
                        <h3 style={{ fontSize: '22px', fontWeight: 900, textTransform: 'uppercase', color: C.text, marginBottom: '12px', lineHeight: 1.1 }}>Real-Time Scanning</h3>
                        <p style={{ fontSize: '12px', color: C.subdued, lineHeight: 1.8 }}>
                            Detects SQL injection, XSS, code injection, and dozens of vulnerability patterns instantly. Paste your code and get results in under 2 seconds.
                        </p>
                    </div>
                    <div style={{ padding: '32px 48px', background: '#040404' }}>
                        <div style={{ border: `1px solid ${C.muted}`, padding: '16px', fontFamily: C.font, fontSize: '12px', lineHeight: 1.8 }}>
                            <motion.div animate={{ opacity: [0.4, 1, 0.4] }} transition={{ duration: 2.5, repeat: Infinity }}>
                                <div><span style={{ color: C.accent }}>$</span> soteria scan login.py</div>
                                <div style={{ color: C.subdued }}>Analyzing 47 lines...</div>
                                <div style={{ color: C.danger, fontWeight: 700 }}>! 2 CRITICAL VULNERABILITIES FOUND</div>
                                <div style={{ color: C.amber, fontWeight: 700 }}>! 1 WARNING DETECTED</div>
                                <div style={{ color: C.accent, fontWeight: 700 }}>+ SCAN COMPLETE — 1.2s</div>
                            </motion.div>
                        </div>
                    </div>
                </motion.div>

                {/* AI Explanations + Gamified Learning */}
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', borderBottom: `1px solid ${C.border}` }}>
                    <motion.div
                        initial={{ opacity: 0, y: 10 }}
                        whileInView={{ opacity: 1, y: 0 }}
                        viewport={{ once: true }}
                        transition={{ duration: 0.5, delay: 0.1 }}
                        style={{ padding: '32px 48px', borderRight: `1px solid ${C.border}` }}
                    >
                        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '16px' }}>
                            <Brain size={16} style={{ color: C.accent }} />
                            <span style={{ fontSize: '10px', color: C.accent, fontWeight: 700, letterSpacing: '0.15em' }}>[ ACTIVE ] AI EXPLANATIONS</span>
                        </div>
                        <h3 style={{ fontSize: '22px', fontWeight: 900, textTransform: 'uppercase', color: C.text, marginBottom: '12px', lineHeight: 1.1 }}>AI Explanations</h3>
                        <p style={{ fontSize: '12px', color: C.subdued, lineHeight: 1.8, marginBottom: '20px' }}>
                            Every vulnerability comes with a clear, beginner-friendly explanation of what went wrong and how to fix it. Learn by doing.
                        </p>
                        <div style={{ border: `1px solid ${C.muted}`, padding: '12px 16px', background: '#050505' }}>
                            <span style={{ color: C.accent, fontSize: '12px' }}>"</span>
                            <span style={{ fontSize: '12px', color: C.text }}>This f-string allows user input to modify your SQL...</span>
                            <span style={{ color: C.accent, fontSize: '12px' }}>"</span>
                        </div>
                    </motion.div>

                    <motion.div
                        initial={{ opacity: 0, y: 10 }}
                        whileInView={{ opacity: 1, y: 0 }}
                        viewport={{ once: true }}
                        transition={{ duration: 0.5, delay: 0.2 }}
                        style={{ padding: '32px 48px' }}
                    >
                        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '16px' }}>
                            <Trophy size={16} style={{ color: C.amber }} />
                            <span style={{ fontSize: '10px', color: C.amber, fontWeight: 700, letterSpacing: '0.15em' }}>[ ACTIVE ] GAMIFIED LEARNING</span>
                        </div>
                        <h3 style={{ fontSize: '22px', fontWeight: 900, textTransform: 'uppercase', color: C.text, marginBottom: '12px', lineHeight: 1.1 }}>Gamified Learning</h3>
                        <p style={{ fontSize: '12px', color: C.subdued, lineHeight: 1.8, marginBottom: '20px' }}>
                            Earn XP for writing secure code and fixing vulnerabilities. Track your progress over time.
                        </p>
                        <div>
                            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '10px', color: C.subdued, marginBottom: '8px', letterSpacing: '0.1em' }}>
                                <span>LEVEL 4 SCANNER</span>
                                <span style={{ color: C.amber }}>850 / 1000 XP</span>
                            </div>
                            <div style={{ height: '6px', background: C.muted, border: `1px solid ${C.border}` }}>
                                <motion.div
                                    style={{ height: '100%', background: C.amber }}
                                    initial={{ width: '0%' }}
                                    whileInView={{ width: '85%' }}
                                    viewport={{ once: true }}
                                    transition={{ duration: 1.5, delay: 0.5, ease: 'easeOut' }}
                                />
                            </div>
                        </div>
                    </motion.div>
                </div>

                {/* GitHub Integration */}
                <motion.div
                    initial={{ opacity: 0, y: 10 }}
                    whileInView={{ opacity: 1, y: 0 }}
                    viewport={{ once: true }}
                    transition={{ duration: 0.5, delay: 0.1 }}
                    style={{ display: 'grid', gridTemplateColumns: '1fr 1fr' }}
                >
                    <div style={{ padding: '32px 48px', borderRight: `1px solid ${C.border}` }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '16px' }}>
                            <Github size={16} style={{ color: C.text }} />
                            <span style={{ fontSize: '10px', color: C.text, fontWeight: 700, letterSpacing: '0.15em' }}>[ ACTIVE ] GITHUB INTEGRATION</span>
                        </div>
                        <h3 style={{ fontSize: '22px', fontWeight: 900, textTransform: 'uppercase', color: C.text, marginBottom: '12px', lineHeight: 1.1 }}>GitHub Integration</h3>
                        <p style={{ fontSize: '12px', color: C.subdued, lineHeight: 1.8 }}>
                            Connect your GitHub account with one click. Scan entire repositories for vulnerabilities automatically.
                        </p>
                    </div>
                    <div style={{ padding: '32px 48px', background: '#030303', display: 'flex', alignItems: 'center', gap: '12px' }}>
                        {['my-flask-app', 'react-portfolio', 'node-api'].map((repo, i) => (
                            <motion.div
                                key={repo}
                                initial={{ opacity: 0, y: 8 }}
                                whileInView={{ opacity: 1, y: 0 }}
                                viewport={{ once: true }}
                                transition={{ delay: 0.4 + i * 0.15 }}
                                style={{ border: `1px solid ${C.border}`, padding: '8px 14px', fontSize: '11px', color: C.subdued, display: 'flex', alignItems: 'center', gap: '8px' }}
                            >
                                <div style={{ width: '6px', height: '6px', background: i === 0 ? C.accent : i === 1 ? C.text : C.danger }} />
                                {repo}
                            </motion.div>
                        ))}
                    </div>
                </motion.div>
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
                    <p style={{ fontSize: '13px', color: C.subdued, margin: 0 }}>Stop guessing. Start knowing. Scan your first project in seconds — no install required.</p>
                    <Link
                        to="/signup"
                        style={{
                            display: 'inline-block',
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
                        START FREE — NO CREDIT CARD
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
