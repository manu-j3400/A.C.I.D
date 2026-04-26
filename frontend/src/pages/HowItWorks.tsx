import React from 'react';
import { Link } from 'react-router-dom';
import PublicNavbar from '../components/PublicNavbar';
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
        <div style={{ minHeight: '100vh', background: C.bg, color: C.text, fontFamily: C.font, overflowX: 'hidden', paddingTop: 76 }}>
            <PublicNavbar />

            {/* PAGE TITLE STRIP */}
            <div style={{ borderBottom: `1px solid ${C.border}`, display: 'flex', alignItems: 'stretch', height: '36px' }}>
                <div style={{ ...cellStyle, borderLeft: `1px solid ${C.border}`, color: C.text, fontWeight: 700, letterSpacing: '0.1em', fontSize: '11px' }}>
                    HOW IT WORKS
                </div>
                <div style={{ ...cellStyle, color: C.accent }}>[ LIVE ]</div>
                <div style={{ ...cellStyle }}>KYBER ENGINE — DETECTION PIPELINE</div>
                <div style={{ flex: 1, borderRight: `1px solid ${C.border}` }} />
                <div style={{ ...cellStyle, borderRight: 'none' }}>UTC {new Date().toISOString().slice(11, 19)}</div>
            </div>

            {/* HERO */}
            <section style={{ padding: '64px 48px 48px', borderBottom: `1px solid ${C.border}` }}>
                <div style={{ maxWidth: '840px' }}>
                    <h1 style={{ fontSize: 'clamp(36px, 6vw, 72px)', fontWeight: 900, letterSpacing: '-0.02em', lineHeight: 1, margin: '0 0 20px', textTransform: 'uppercase', fontFamily: C.font }}>
                        FROM RAW CODE TO<br />
                        <span style={{ color: C.accent }}>VERDICT IN 1.3 SECONDS.</span>
                    </h1>
                    <p style={{ fontSize: '13px', color: C.subdued, maxWidth: '560px', lineHeight: 1.8, margin: 0 }}>
                        Six deterministic stages — no black boxes. AST parsing through graph neural networks, with entropy and spike neural profiling in between. Here's every step.
                    </p>
                </div>
            </section>

            {/* PIPELINE — full width scrollable */}
            <section style={{ borderBottom: `1px solid ${C.border}` }}>
                <div style={{ borderBottom: `1px solid ${C.border}`, padding: '0 48px', height: '36px', display: 'flex', alignItems: 'center' }}>
                    <span style={{ fontSize: '10px', color: C.subdued, letterSpacing: '0.15em' }}>DETECTION ENGINE PIPELINE</span>
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

            {/* STEP DETAIL — 2-col asymmetric */}
            <section style={{ borderBottom: `1px solid ${C.border}` }}>
                <div style={{ borderBottom: `1px solid ${C.border}`, padding: '0 48px', height: '36px', display: 'flex', alignItems: 'center' }}>
                    <span style={{ fontSize: '10px', color: C.subdued, letterSpacing: '0.15em' }}>STAGE BREAKDOWN</span>
                </div>

                {[
                    {
                        num: '01',
                        label: 'PASTE YOUR CODE',
                        accent: C.accent,
                        left: 'Drop any code into the scanner — Python, JavaScript, Go, Rust, TypeScript, Java, SQL. File upload (drag-and-drop) or direct paste. 30+ extensions accepted.',
                        right: [
                            'AST parse → feature extraction',
                            '52-dimensional numeric feature vector',
                            'Cyclomatic complexity, entropy, dangerous function frequencies',
                            'Language auto-detection via 12 regex heuristics',
                        ],
                    },
                    {
                        num: '02',
                        label: 'DETECTION PIPELINE RUNS',
                        accent: C.amber,
                        left: 'Entropy pre-scanner flags high-entropy literals (strings ≥ 5.0 bits, bytes ≥ 6.5 bits). SNN temporal profiler encodes 8-channel spike patterns. RF ensemble scores baseline. GCN graph attention convolution blends in when test F1 ≥ 0.70.',
                        right: [
                            'Entropy pre-scan: high-entropy string/bytes flagged pre-ML',
                            'SNN: 8-channel LIF encoder — call/line/return/exception rates, derivative, burst, silence, phase',
                            'RF acidModel.pkl — 52 AST features',
                            'GCN GATConv — control-flow graph edges with 7-dim edge features',
                        ],
                    },
                    {
                        num: '03',
                        label: 'PLAIN-ENGLISH VERDICT',
                        accent: C.text,
                        left: 'Every finding streams a Gemini 2.5 Pro explanation over SSE — first token under 400ms. What the vulnerability is, how an attacker exploits it, and the patched code. Full scan history saved; export to CSV anytime.',
                        right: [
                            'Gemini 2.5 Pro SSE — streams explanation in real time',
                            'Patched code snippet with every finding',
                            'Scan history: SQLite WAL, paginated, filterable',
                            'CSV export + webhook on malicious result',
                        ],
                    },
                ].map((step, i) => (
                    <div
                        key={step.num}
                        style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', borderBottom: i < 2 ? `1px solid ${C.border}` : 'none' }}
                    >
                        <div style={{ padding: '36px 48px', borderRight: `1px solid ${C.border}` }}>
                            <div style={{ fontSize: '48px', fontWeight: 900, color: C.muted, lineHeight: 1, marginBottom: '16px' }}>{step.num}</div>
                            <div style={{ fontSize: '11px', fontWeight: 700, color: step.accent, letterSpacing: '0.1em', marginBottom: '14px' }}>{step.label}</div>
                            <p style={{ fontSize: '12px', color: C.subdued, lineHeight: 1.8, margin: 0 }}>{step.left}</p>
                        </div>
                        <div style={{ padding: '36px 48px', background: i % 2 === 1 ? '#030303' : 'transparent' }}>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', paddingTop: '64px' }}>
                                {step.right.map((item, j) => (
                                    <div key={j} style={{ display: 'flex', gap: '10px', fontSize: '11px', color: C.subdued }}>
                                        <span style={{ color: step.accent, flexShrink: 0 }}>→</span>
                                        {item}
                                    </div>
                                ))}
                            </div>
                        </div>
                    </div>
                ))}
            </section>

            {/* TIMING TABLE */}
            <section style={{ borderBottom: `1px solid ${C.border}` }}>
                <div style={{ borderBottom: `1px solid ${C.border}`, padding: '0 48px', height: '36px', display: 'flex', alignItems: 'center' }}>
                    <span style={{ fontSize: '10px', color: C.subdued, letterSpacing: '0.15em' }}>TIMING BREAKDOWN — TYPICAL SCAN (200 LOC)</span>
                </div>
                <div style={{ padding: '0 48px' }}>
                    {[
                        { phase: 'AST parse + feature extract', time: '~80ms', color: C.text },
                        { phase: 'Entropy pre-scan', time: '~20ms', color: C.amber },
                        { phase: 'SNN temporal profile', time: '~110ms', color: C.accent },
                        { phase: 'RF ensemble inference', time: '~15ms', color: C.text },
                        { phase: 'GCN graph inference (when active)', time: '~240ms', color: C.accent },
                        { phase: 'Pattern + semgrep matching', time: '~180ms', color: C.subdued },
                        { phase: 'Gemini SSE first token', time: '~380ms', color: C.muted },
                    ].map((row, i, arr) => (
                        <div
                            key={row.phase}
                            style={{
                                display: 'flex',
                                alignItems: 'center',
                                borderBottom: i < arr.length - 1 ? `1px solid ${C.border}` : 'none',
                                height: '36px',
                            }}
                        >
                            <div style={{ flex: 1, fontSize: '11px', color: C.subdued }}>{row.phase}</div>
                            <div style={{ fontSize: '11px', fontWeight: 700, color: row.color, minWidth: '90px', textAlign: 'right' }}>{row.time}</div>
                        </div>
                    ))}
                </div>
            </section>

            {/* CTA */}
            <section style={{ padding: '64px 48px', borderBottom: `1px solid ${C.border}` }}>
                <div style={{ borderLeft: `3px solid ${C.accent}`, paddingLeft: '28px' }}>
                    <p style={{ fontSize: '12px', color: C.muted, margin: '0 0 12px', letterSpacing: '0.1em' }}>READY TO RUN IT ON YOUR CODE?</p>
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
                        START FREE
                    </Link>
                </div>
            </section>

            {/* FOOTER */}
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
