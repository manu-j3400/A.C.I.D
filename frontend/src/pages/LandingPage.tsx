/**
 * Soteria Landing Page — Weaponized Minimalism
 * Design: Pure black · #ADFF2F acid green · JetBrains Mono
 * No gradients · No rounded corners · No framer-motion
 */
import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import PublicNavbar from '@/components/PublicNavbar';

const C = {
    acid:   '#ADFF2F',
    bg:     '#000000',
    dim:    '#0D0D0D',
    border: '#1E1E1E',
    muted:  '#404040',
    sub:    '#707070',
    text:   '#E5E5E5',
};

const MONO: React.CSSProperties = { fontFamily: "'JetBrains Mono', monospace" };

/* ─── TICKER ─── */
const tickerItems = [
    '739 VULNERABILITY PATTERNS',
    'PYTHON · GO · RUST · JS · TS · PHP · JAVA · C/C++',
    'SUB-SECOND AST SCANS',
    'GCN NEURAL ENGINE · F1 ≥ 0.70',
    'eBPF KERNEL RUNTIME',
    'GITHUB PR INTEGRATION',
    'SNN TEMPORAL PROFILER',
    'ZERO CONFIGURATION',
];

function Ticker() {
    const doubled = [...tickerItems, ...tickerItems];
    return (
        <div style={{
            borderTop: `1px solid ${C.border}`, borderBottom: `1px solid ${C.border}`,
            padding: '10px 0', overflow: 'hidden', background: C.dim,
            maskImage: 'linear-gradient(to right, transparent, black 5%, black 95%, transparent)',
            WebkitMaskImage: 'linear-gradient(to right, transparent, black 5%, black 95%, transparent)',
        }}>
            <style>{`
                @keyframes ticker-scroll { from { transform: translateX(0); } to { transform: translateX(-50%); } }
            `}</style>
            <div style={{
                display: 'flex', gap: '60px', width: 'max-content',
                animation: 'ticker-scroll 40s linear infinite',
            }}>
                {doubled.map((item, i) => (
                    <span key={i} style={{
                        ...MONO, fontSize: 9, color: C.sub, letterSpacing: '0.15em',
                        whiteSpace: 'nowrap',
                    }}>
                        <span style={{ color: C.acid, marginRight: 10 }}>▸</span>
                        {item}
                    </span>
                ))}
            </div>
        </div>
    );
}

/* ─── ROTATING WORD ─── */
const words = ['SECURITY', 'CONFIDENCE', 'TRUST', 'SPEED', 'PRECISION'];
function RotatingWord() {
    const [idx, setIdx] = useState(0);
    const [visible, setVisible] = useState(true);

    useEffect(() => {
        const interval = setInterval(() => {
            setVisible(false);
            setTimeout(() => {
                setIdx(i => (i + 1) % words.length);
                setVisible(true);
            }, 200);
        }, 2800);
        return () => clearInterval(interval);
    }, []);

    return (
        <span style={{
            color: C.acid,
            opacity: visible ? 1 : 0,
            transition: 'opacity 0.2s',
            display: 'inline-block',
            minWidth: '10ch',
        }}>
            {words[idx]}
        </span>
    );
}

/* ─── FEATURE CARD ─── */
interface FeatureCardProps {
    tag: string;
    title: string;
    meta?: string;
    desc: string;
    wide?: boolean;
}
function FeatureCard({ tag, title, meta, desc, wide }: FeatureCardProps) {
    const [hovered, setHovered] = useState(false);
    return (
        <div
            onMouseEnter={() => setHovered(true)}
            onMouseLeave={() => setHovered(false)}
            style={{
                border: `1px solid ${hovered ? C.muted : C.border}`,
                background: hovered ? '#0A0A0A' : C.bg,
                padding: '24px',
                transition: 'border-color 0.15s, background 0.15s',
                gridColumn: wide ? 'span 2' : undefined,
                cursor: 'default',
            }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 16 }}>
                <span style={{
                    ...MONO, fontSize: 8, letterSpacing: '0.15em', color: hovered ? C.acid : C.sub,
                    border: `1px solid ${hovered ? C.acid : C.border}`,
                    padding: '3px 7px', transition: 'color 0.15s, border-color 0.15s',
                }}>
                    {tag}
                </span>
                <span style={{ ...MONO, fontSize: 8, color: C.muted, letterSpacing: '0.1em' }}>
                    {hovered ? '●' : '○'}
                </span>
            </div>
            <div style={{ ...MONO, fontSize: 14, fontWeight: 700, color: C.text, marginBottom: meta ? 6 : 10, letterSpacing: '0.03em' }}>
                {title}
            </div>
            {meta && (
                <div style={{ ...MONO, fontSize: 9, color: C.acid, marginBottom: 10, letterSpacing: '0.06em' }}>
                    {meta}
                </div>
            )}
            <div style={{ ...MONO, fontSize: 10, color: C.sub, lineHeight: 1.7, letterSpacing: '0.02em' }}>
                {desc}
            </div>
        </div>
    );
}

/* ─── STEP ─── */
function Step({ num, title, desc }: { num: string; title: string; desc: string }) {
    return (
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center', gap: 12 }}>
            <div style={{
                width: 48, height: 48, border: `1px solid ${C.acid}`,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                ...MONO, fontSize: 13, fontWeight: 700, color: C.acid,
            }}>
                {num}
            </div>
            <div style={{ ...MONO, fontSize: 13, fontWeight: 700, color: C.text, letterSpacing: '0.04em' }}>{title}</div>
            <div style={{ ...MONO, fontSize: 10, color: C.sub, lineHeight: 1.7, maxWidth: 200 }}>{desc}</div>
        </div>
    );
}

/* ─── STAT ─── */
function Stat({ value, label }: { value: string; label: string }) {
    return (
        <div style={{
            border: `1px solid ${C.border}`, padding: '20px 24px', textAlign: 'center',
        }}>
            <div style={{ ...MONO, fontSize: 32, fontWeight: 700, color: C.acid, letterSpacing: '-0.02em', marginBottom: 6 }}>
                {value}
            </div>
            <div style={{ ...MONO, fontSize: 8, color: C.sub, letterSpacing: '0.18em', textTransform: 'uppercase' }}>
                {label}
            </div>
        </div>
    );
}

/* ══════════════════ MAIN PAGE ══════════════════ */
export default function LandingPage() {
    return (
        <div style={{ minHeight: '100vh', background: C.bg, color: C.text, ...MONO, overflowX: 'hidden' }}>
            <PublicNavbar />

            {/* ─── HERO ─── */}
            <section style={{ padding: '100px 24px 80px', maxWidth: 1200, margin: '0 auto' }}>

                {/* Status badge */}
                <div style={{
                    display: 'inline-flex', alignItems: 'center', gap: 8,
                    border: `1px solid ${C.border}`, padding: '5px 12px', marginBottom: 32,
                }}>
                    <span style={{
                        width: 6, height: 6, borderRadius: '50%', background: C.acid,
                        display: 'inline-block', boxShadow: `0 0 6px ${C.acid}`,
                    }} />
                    <span style={{ fontSize: 9, color: C.sub, letterSpacing: '0.15em' }}>
                        SOTERIA ENGINE v2.5 · LIVE
                    </span>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0,1fr) minmax(0,1fr)', gap: 64, alignItems: 'center' }}>

                    {/* Left: headline + CTAs */}
                    <div>
                        <h1 style={{
                            fontSize: 'clamp(36px, 5vw, 64px)', fontWeight: 900,
                            lineHeight: 1.05, letterSpacing: '-0.02em', textTransform: 'uppercase',
                            margin: '0 0 20px',
                        }}>
                            <span style={{ display: 'block', color: C.text }}>DEPLOY CODE</span>
                            <span style={{ display: 'block', color: C.text }}>WITH</span>
                            <span style={{ display: 'block' }}>
                                <RotatingWord />
                            </span>
                        </h1>

                        <p style={{
                            fontSize: 12, color: C.sub, lineHeight: 1.8,
                            maxWidth: 440, marginBottom: 36, letterSpacing: '0.02em',
                        }}>
                            AI-powered code security that identifies vulnerabilities in milliseconds.
                            Understand why they matter. Ship secure code — without slowing down.
                        </p>

                        {/* CTAs */}
                        <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
                            <Link to="/signup" style={{ textDecoration: 'none' }}>
                                <button style={{
                                    ...MONO, fontSize: 11, fontWeight: 700, letterSpacing: '0.1em',
                                    padding: '12px 28px', background: C.acid, color: '#000',
                                    border: `1px solid ${C.acid}`, cursor: 'pointer',
                                    transition: 'opacity 0.15s',
                                }}
                                    onMouseEnter={e => ((e.currentTarget as HTMLElement).style.opacity = '0.85')}
                                    onMouseLeave={e => ((e.currentTarget as HTMLElement).style.opacity = '1')}
                                >
                                    [ START FREE ] →
                                </button>
                            </Link>
                            <Link to="/how-it-works" style={{ textDecoration: 'none' }}>
                                <button style={{
                                    ...MONO, fontSize: 11, fontWeight: 700, letterSpacing: '0.1em',
                                    padding: '12px 28px', background: 'transparent', color: C.sub,
                                    border: `1px solid ${C.border}`, cursor: 'pointer',
                                    transition: 'color 0.15s, border-color 0.15s',
                                }}
                                    onMouseEnter={e => {
                                        (e.currentTarget as HTMLElement).style.color = C.text;
                                        (e.currentTarget as HTMLElement).style.borderColor = C.muted;
                                    }}
                                    onMouseLeave={e => {
                                        (e.currentTarget as HTMLElement).style.color = C.sub;
                                        (e.currentTarget as HTMLElement).style.borderColor = C.border;
                                    }}
                                >
                                    HOW IT WORKS
                                </button>
                            </Link>
                        </div>
                    </div>

                    {/* Right: terminal-style code preview */}
                    <div style={{ display: 'none' }} className="lg-hero-demo">
                        {/* Shown via CSS on large screens */}
                    </div>

                    {/* Right: terminal block */}
                    <div style={{
                        border: `1px solid ${C.border}`, background: C.dim,
                        display: 'flex', flexDirection: 'column',
                    }}>
                        {/* Terminal header */}
                        <div style={{
                            padding: '8px 14px', borderBottom: `1px solid ${C.border}`,
                            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                        }}>
                            <span style={{ fontSize: 8, color: C.sub, letterSpacing: '0.12em' }}>SCAN OUTPUT</span>
                            <div style={{ display: 'flex', gap: 5 }}>
                                {['#FF5F56', '#FFBD2E', C.acid].map((c, i) => (
                                    <span key={i} style={{ width: 8, height: 8, borderRadius: '50%', background: c, display: 'inline-block' }} />
                                ))}
                            </div>
                        </div>
                        {/* Terminal body */}
                        <pre style={{
                            margin: 0, padding: '20px', fontSize: 10, lineHeight: 1.8,
                            color: C.sub, overflowX: 'auto', flexGrow: 1,
                        }}>
{`$ soteria scan --file main.py

  [ANALYZING] AST parse complete
  [ANALYZING] 739 patterns loaded
  [ANALYZING] GCN inference...

  ┌─ FINDINGS ─────────────────────┐
  │ `}<span style={{ color: '#FF5F56' }}>CRITICAL</span>{`  SQL Injection          │
  │   line 42 · CWE-89             │
  │   fix: use parameterized query  │
  │                                 │
  │ `}<span style={{ color: '#FFBD2E' }}>HIGH    </span>{`  Hardcoded Secret       │
  │   line 17 · CWE-798            │
  │   fix: use env variables        │
  └─────────────────────────────────┘

  `}<span style={{ color: C.acid }}>RISK: HIGH  · 2 issues · 0.8s</span>{`
`}
                        </pre>
                    </div>
                </div>
            </section>

            {/* ─── TICKER ─── */}
            <Ticker />

            {/* ─── STATS ─── */}
            <section style={{ padding: '60px 24px', maxWidth: 1200, margin: '0 auto' }}>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 1, background: C.border }}>
                    {[
                        { value: '739+', label: 'Vulnerability Patterns' },
                        { value: '<2s',  label: 'Avg Scan Time' },
                        { value: '8+',   label: 'Languages' },
                        { value: '100%', label: 'Free & Open Source' },
                    ].map(s => (
                        <div key={s.label} style={{ background: C.bg }}>
                            <Stat value={s.value} label={s.label} />
                        </div>
                    ))}
                </div>
            </section>

            {/* ─── FEATURES ─── */}
            <section style={{ padding: '40px 24px 80px', maxWidth: 1200, margin: '0 auto' }}>
                <div style={{ marginBottom: 40 }}>
                    <div style={{ fontSize: 9, color: C.acid, letterSpacing: '0.2em', marginBottom: 10 }}>
                        // CAPABILITY_MATRIX
                    </div>
                    <h2 style={{
                        fontSize: 'clamp(24px, 3vw, 36px)', fontWeight: 900,
                        letterSpacing: '-0.01em', textTransform: 'uppercase', margin: 0,
                    }}>
                        EVERYTHING YOU NEED TO{' '}
                        <span style={{ color: C.acid }}>SHIP SAFE</span>
                    </h2>
                </div>

                <div style={{
                    display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)',
                    gap: 1, background: C.border,
                }}>
                    {/* Wide card */}
                    <div style={{ gridColumn: 'span 2', background: C.bg }}>
                        <FeatureCard
                            tag="CORE"
                            title="REAL-TIME AST SCANNER"
                            meta="// avg_scan_time: <2s · 739 patterns loaded"
                            desc="Hybrid AST engine parses your code's syntax tree structurally — identifying injection vectors, taint flows, and unsafe patterns before your CI/CD pipeline even starts."
                        />
                    </div>
                    <div style={{ background: C.bg }}>
                        <FeatureCard
                            tag="DETECTION"
                            title="739 VULNERABILITY PATTERNS"
                            meta="// py · go · rs · js · ts · php · java · c/c++"
                            desc="Hand-crafted detection rules covering OWASP Top 10, supply chain attacks, Log4Shell, and language-specific CVEs."
                        />
                    </div>
                    <div style={{ background: C.bg }}>
                        <FeatureCard
                            tag="AI"
                            title="GCN + SNN NEURAL ENGINE"
                            meta="// GATConv · F1 ≥ 0.70 · snn_baseline.pt"
                            desc="Graph Convolutional Network blended with a Spiking Neural Network temporal profiler for deep structural malware detection."
                        />
                    </div>
                    <div style={{ background: C.bg }}>
                        <FeatureCard
                            tag="CI/CD"
                            title="GITHUB PR REVIEWS"
                            desc="Automated PR security reviewer runs on every pull request — flags CRITICAL findings before merge, posts GitHub-ready review comments."
                        />
                    </div>
                    <div style={{ background: C.bg }}>
                        <FeatureCard
                            tag="RUNTIME"
                            title="eBPF KERNEL ENGINE"
                            desc="Module 1 production runtime — LSM hooks, per-IP/port policy enforcement, and hot-reload via inotify. Zero overhead syscall monitoring."
                        />
                    </div>
                    <div style={{ background: C.bg }}>
                        <FeatureCard
                            tag="UX"
                            title="ZERO-BS EXPLANATIONS"
                            desc="No cryptic CWE codes left unexplained. Soteria tells you what's wrong, why it matters, and hands you patched code."
                        />
                    </div>
                    <div style={{ background: C.bg }}>
                        <FeatureCard
                            tag="DETECTION"
                            title="10-ENGINE FLEET"
                            meta="// AgentShield · DeceptiNet · SymbAPT · RLShield · MemShield..."
                            desc="Ten specialized detection engines covering TOCTOU mitigation, APT hunting, SOC orchestration, memory exploits, and container escapes."
                        />
                    </div>
                </div>
            </section>

            {/* ─── HOW IT WORKS ─── */}
            <section style={{
                padding: '60px 24px 80px',
                borderTop: `1px solid ${C.border}`, borderBottom: `1px solid ${C.border}`,
                background: C.dim,
            }}>
                <div style={{ maxWidth: 900, margin: '0 auto' }}>
                    <div style={{ textAlign: 'center', marginBottom: 48 }}>
                        <div style={{ fontSize: 9, color: C.acid, letterSpacing: '0.2em', marginBottom: 10 }}>
                            // EXECUTION_FLOW
                        </div>
                        <h2 style={{
                            fontSize: 'clamp(22px, 3vw, 32px)', fontWeight: 900,
                            letterSpacing: '-0.01em', textTransform: 'uppercase', margin: 0,
                        }}>
                            THREE STEPS TO{' '}
                            <span style={{ color: C.acid }}>SECURE CODE</span>
                        </h2>
                    </div>

                    <div style={{
                        display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)',
                        gap: 32, position: 'relative',
                    }}>
                        {/* Connector */}
                        <div style={{
                            position: 'absolute', top: 24, left: 'calc(16.7% + 28px)',
                            right: 'calc(16.7% + 28px)', height: 1, background: C.border,
                        }} />
                        <Step num="01" title="PASTE YOUR CODE"
                            desc="Drop any snippet or file — Python, Go, Rust, JS, TS, PHP, Java, C/C++. No install required." />
                        <Step num="02" title="KYBER ANALYZES"
                            desc="AST parsing + GCN neural model + 739 pattern rules run in under 2 seconds." />
                        <Step num="03" title="FIX & SHIP"
                            desc="Get the exact vulnerable line, CWE reference, and AI-generated patched code." />
                    </div>
                </div>
            </section>

            {/* ─── CTA ─── */}
            <section style={{ padding: '80px 24px', maxWidth: 900, margin: '0 auto' }}>
                <div style={{
                    border: `1px solid ${C.border}`, padding: '56px 48px',
                    textAlign: 'center',
                }}>
                    <div style={{ fontSize: 9, color: C.acid, letterSpacing: '0.2em', marginBottom: 16 }}>
                        // READY_TO_DEPLOY
                    </div>
                    <h2 style={{
                        fontSize: 'clamp(28px, 4vw, 52px)', fontWeight: 900,
                        letterSpacing: '-0.02em', textTransform: 'uppercase',
                        margin: '0 0 12px', lineHeight: 1.05,
                    }}>
                        STOP GUESSING.<br />
                        <span style={{ color: C.acid }}>START KNOWING.</span>
                    </h2>
                    <p style={{
                        fontSize: 11, color: C.sub, lineHeight: 1.8,
                        maxWidth: 480, margin: '0 auto 36px',
                    }}>
                        Scan your first project in seconds. No credit card. No bloated SDK. No 14-day trial.
                    </p>
                    <div style={{ display: 'flex', gap: 12, justifyContent: 'center', flexWrap: 'wrap' }}>
                        <Link to="/signup" style={{ textDecoration: 'none' }}>
                            <button style={{
                                ...MONO, fontSize: 11, fontWeight: 700, letterSpacing: '0.1em',
                                padding: '13px 32px', background: C.acid, color: '#000',
                                border: `1px solid ${C.acid}`, cursor: 'pointer',
                                transition: 'opacity 0.15s',
                            }}
                                onMouseEnter={e => ((e.currentTarget as HTMLElement).style.opacity = '0.85')}
                                onMouseLeave={e => ((e.currentTarget as HTMLElement).style.opacity = '1')}
                            >
                                [ START FREE — NO SIGN UP REQUIRED ]
                            </button>
                        </Link>
                        <Link to="/scanner" style={{ textDecoration: 'none' }}>
                            <button style={{
                                ...MONO, fontSize: 11, fontWeight: 700, letterSpacing: '0.1em',
                                padding: '13px 28px', background: 'transparent', color: C.sub,
                                border: `1px solid ${C.border}`, cursor: 'pointer',
                                transition: 'color 0.15s, border-color 0.15s',
                            }}
                                onMouseEnter={e => {
                                    (e.currentTarget as HTMLElement).style.color = C.text;
                                    (e.currentTarget as HTMLElement).style.borderColor = C.muted;
                                }}
                                onMouseLeave={e => {
                                    (e.currentTarget as HTMLElement).style.color = C.sub;
                                    (e.currentTarget as HTMLElement).style.borderColor = C.border;
                                }}
                            >
                                &gt; OPEN SCANNER
                            </button>
                        </Link>
                    </div>
                </div>
            </section>

            {/* ─── FOOTER ─── */}
            <footer style={{
                borderTop: `1px solid ${C.border}`,
                padding: '32px 24px',
            }}>
                <div style={{
                    maxWidth: 1200, margin: '0 auto',
                    display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 20,
                }}>
                    <Link to="/" style={{ textDecoration: 'none', display: 'flex', alignItems: 'center', gap: 10 }}>
                        <img src="/soteria-logo.png" alt="Soteria" style={{ width: 28, height: 28, objectFit: 'cover' }} />
                        <span style={{ ...MONO, fontSize: 13, fontWeight: 700, letterSpacing: '0.15em', color: C.text }}>
                            SOTERIA
                        </span>
                    </Link>

                    <div style={{ display: 'flex', gap: 28 }}>
                        {[
                            { to: '/about', label: 'ABOUT' },
                            { to: '/features', label: 'FEATURES' },
                            { to: '/changelog', label: 'CHANGELOG' },
                        ].map(link => (
                            <Link key={link.to} to={link.to} style={{
                                ...MONO, fontSize: 9, color: C.sub, textDecoration: 'none',
                                letterSpacing: '0.12em', transition: 'color 0.15s',
                            }}
                                onMouseEnter={e => ((e.target as HTMLElement).style.color = C.text)}
                                onMouseLeave={e => ((e.target as HTMLElement).style.color = C.sub)}
                            >
                                {link.label}
                            </Link>
                        ))}
                        <a href="https://github.com/manujawahar/ACID" target="_blank" rel="noopener noreferrer"
                            style={{ ...MONO, fontSize: 9, color: C.sub, textDecoration: 'none', letterSpacing: '0.12em', transition: 'color 0.15s' }}
                            onMouseEnter={e => ((e.target as HTMLElement).style.color = C.text)}
                            onMouseLeave={e => ((e.target as HTMLElement).style.color = C.sub)}
                        >
                            GITHUB
                        </a>
                    </div>

                    <div style={{ ...MONO, fontSize: 8, color: C.muted, letterSpacing: '0.12em' }}>
                        © {new Date().getFullYear()} SOTERIA · BUILT FOR BUILDERS
                    </div>
                </div>
            </footer>
        </div>
    );
}
