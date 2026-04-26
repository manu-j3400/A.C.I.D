import { useState, useEffect, useRef } from 'react';
import { Link } from 'react-router-dom';
import PublicNavbar from '@/components/PublicNavbar';
import { COLORS } from '../theme/colors';

const C = {
    acid:   COLORS.acid,
    bg:     COLORS.bg,
    dim:    COLORS.surface,
    border: COLORS.border,
    muted:  COLORS.muted,
    sub:    COLORS.sub,
    text:   COLORS.text,
    red:    COLORS.red,
    amber:  COLORS.orange,
};

// Mono only for code, data, labels, buttons
const MONO: React.CSSProperties = { fontFamily: "'JetBrains Mono', monospace" };
// Sans for all prose
const SANS: React.CSSProperties = { fontFamily: "'Inter', -apple-system, BlinkMacSystemFont, sans-serif" };

/* ─── TYPEWRITER TERMINAL ─── */
const SCAN_LINES = [
    '$ soteria scan auth.py',
    '',
    '  [1/4] AST parse ............... 12ms',
    '  [2/4] Pattern engine .......... 739 rules',
    '  [3/4] GCN inference ........... done',
    '  [4/4] SNN temporal ............ done',
    '',
    '  FINDINGS',
    '  ────────────────────────────────────',
    '  CRITICAL  SQL injection          L.42',
    '            cursor.execute(f"..{uid}")',
    '            → use parameterized query',
    '',
    '  HIGH      Hardcoded secret       L.17',
    '            JWT_SECRET = "abc123"',
    '            → move to env var',
    '',
    '  RISK: HIGH · 2 findings · 0.8s',
];

function Terminal() {
    const [lines, setLines] = useState<string[]>([]);
    const [cursor, setCursor] = useState(true);
    const idx = useRef(0);
    const timerRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

    useEffect(() => {
        const tick = () => {
            if (idx.current < SCAN_LINES.length) {
                setLines(prev => [...prev, SCAN_LINES[idx.current]]);
                idx.current++;
                timerRef.current = setTimeout(tick, idx.current < 3 ? 120 : 60);
            } else {
                timerRef.current = setTimeout(() => {
                    setLines([]);
                    idx.current = 0;
                    timerRef.current = setTimeout(tick, 800);
                }, 4000);
            }
        };
        timerRef.current = setTimeout(tick, 600);
        const blink = setInterval(() => setCursor(c => !c), 530);
        return () => { clearTimeout(timerRef.current); clearInterval(blink); };
    }, []);

    return (
        <div style={{ border: `1px solid ${C.border}`, background: '#050505', flexShrink: 0 }}>
            <div style={{
                padding: '7px 14px', borderBottom: `1px solid ${C.border}`,
                display: 'flex', alignItems: 'center', gap: 8,
            }}>
                <span style={{ width: 5, height: 5, background: C.acid, display: 'inline-block', borderRadius: '50%' }} />
                <span style={{ ...MONO, fontSize: 10, color: C.muted, letterSpacing: '0.1em' }}>
                    SOTERIA · SCAN SESSION
                </span>
            </div>
            <div style={{ padding: '18px 20px', minHeight: 320 }}>
                {lines.map((line, i) => {
                    const safe    = line ?? '';
                    const isCrit  = safe.includes('CRITICAL');
                    const isHigh  = safe.includes('HIGH') && !safe.includes('RISK');
                    const isRisk  = safe.includes('RISK:');
                    const isCmd   = safe.startsWith('$');
                    const isArrow = safe.trim().startsWith('→');
                    return (
                        <div key={i} style={{
                            ...MONO, fontSize: 11, lineHeight: 1.75,
                            color: isCrit ? C.red
                                 : isHigh  ? C.amber
                                 : isRisk  ? C.acid
                                 : isCmd   ? C.text
                                 : isArrow ? C.acid
                                 : C.sub,
                            whiteSpace: 'pre',
                        }}>
                            {safe || '\u00A0'}
                        </div>
                    );
                })}
                {lines.length < SCAN_LINES.length && (
                    <span style={{
                        display: 'inline-block', width: 7, height: 14,
                        background: cursor ? C.acid : 'transparent',
                        verticalAlign: 'text-bottom',
                    }} />
                )}
            </div>
        </div>
    );
}

export default function LandingPage() {
    return (
        <div style={{ minHeight: '100vh', background: C.bg, color: C.text, overflowX: 'hidden' }}>
            <PublicNavbar />

            {/* HERO */}
            <section style={{ padding: '96px 24px 80px', maxWidth: 1200, margin: '0 auto' }}>
                <div style={{
                    display: 'grid',
                    gridTemplateColumns: '1fr 460px',
                    gap: 72, alignItems: 'flex-start',
                }}>
                    <div>
                        {/* Status label — mono, uppercase, small. This is a label. */}
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 36 }}>
                            <span style={{ width: 5, height: 5, background: C.acid, borderRadius: '50%', display: 'inline-block' }} />
                            <span style={{ ...MONO, fontSize: 10, color: C.sub, letterSpacing: '0.1em' }}>
                                KYBER ENGINE v2.5 — ACTIVE
                            </span>
                        </div>

                        {/* Headline — mono, uppercase. A statement, not a tagline. */}
                        <h1 style={{
                            ...MONO,
                            fontSize: 'clamp(38px, 5vw, 68px)',
                            fontWeight: 900, lineHeight: 1.0,
                            letterSpacing: '-0.025em',
                            textTransform: 'uppercase',
                            margin: '0 0 28px',
                        }}>
                            <span style={{ display: 'block' }}>YOUR LINTER</span>
                            <span style={{ display: 'block' }}>MISSED THE</span>
                            <span style={{ display: 'block', color: C.red }}>SQL INJECTION</span>
                            <span style={{ display: 'block' }}>ON LINE 42.</span>
                        </h1>

                        {/* Sub — Inter, sentence case. Prose is prose. */}
                        <p style={{
                            ...SANS,
                            fontSize: 15, color: C.sub, lineHeight: 1.75,
                            maxWidth: 400, marginBottom: 36, fontWeight: 400,
                        }}>
                            Soteria scans your code with AST parsing, 739 vulnerability patterns,
                            a graph neural network, and a spiking neural network — in under 2 seconds.
                            It tells you the exact line and hands you patched code.
                        </p>

                        {/* CTAs */}
                        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginBottom: 56 }}>
                            <Link to="/scanner" style={{ textDecoration: 'none' }}>
                                <button style={{
                                    ...MONO, fontSize: 11, fontWeight: 700, letterSpacing: '0.1em',
                                    padding: '12px 28px', background: C.acid, color: '#000',
                                    border: `1px solid ${C.acid}`, cursor: 'pointer',
                                    transition: 'opacity 0.15s',
                                }}
                                    onMouseEnter={e => ((e.currentTarget as HTMLElement).style.opacity = '0.85')}
                                    onMouseLeave={e => ((e.currentTarget as HTMLElement).style.opacity = '1')}
                                >
                                    SCAN YOUR CODE →
                                </button>
                            </Link>
                            <Link to="/signup" style={{ textDecoration: 'none' }}>
                                <button style={{
                                    ...MONO, fontSize: 11, letterSpacing: '0.1em',
                                    padding: '12px 24px', background: 'transparent',
                                    color: C.muted, border: `1px solid ${C.border}`, cursor: 'pointer',
                                    transition: 'color 0.15s, border-color 0.15s',
                                }}
                                    onMouseEnter={e => {
                                        (e.currentTarget as HTMLElement).style.color = C.text;
                                        (e.currentTarget as HTMLElement).style.borderColor = C.sub;
                                    }}
                                    onMouseLeave={e => {
                                        (e.currentTarget as HTMLElement).style.color = C.muted;
                                        (e.currentTarget as HTMLElement).style.borderColor = C.border;
                                    }}
                                >
                                    CREATE ACCOUNT
                                </button>
                            </Link>
                        </div>

                        {/* Stats — numbers in mono (they're data), labels in sans */}
                        <div style={{
                            display: 'flex', gap: 0,
                            borderTop: `1px solid ${C.border}`, paddingTop: 24,
                        }}>
                            {[
                                { val: '739', lbl: 'vulnerability patterns' },
                                { val: '<2s',  lbl: 'per scan' },
                                { val: '8',    lbl: 'languages' },
                            ].map((s, i) => (
                                <div key={s.lbl} style={{
                                    paddingRight: 28, marginRight: 28,
                                    borderRight: i < 2 ? `1px solid ${C.border}` : 'none',
                                }}>
                                    <div style={{ ...MONO, fontSize: 26, fontWeight: 700, color: C.text, letterSpacing: '-0.02em', lineHeight: 1 }}>
                                        {s.val}
                                    </div>
                                    <div style={{ ...SANS, fontSize: 12, color: C.muted, marginTop: 4 }}>
                                        {s.lbl}
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>

                    <Terminal />
                </div>
            </section>

            {/* WHAT ACTUALLY HAPPENS */}
            <section style={{
                borderTop: `1px solid ${C.border}`,
                background: C.dim,
                padding: '72px 24px',
            }}>
                <div style={{ maxWidth: 1200, margin: '0 auto' }}>
                    <div style={{ display: 'grid', gridTemplateColumns: '340px 1fr', gap: 80, alignItems: 'start' }}>
                        <div>
                            <div style={{ ...MONO, fontSize: 10, color: C.muted, letterSpacing: '0.12em', marginBottom: 14 }}>
                                UNDER THE HOOD
                            </div>
                            <h2 style={{
                                ...SANS,
                                fontSize: 'clamp(22px, 2.5vw, 30px)', fontWeight: 700,
                                lineHeight: 1.2, color: C.text,
                                margin: '0 0 16px',
                            }}>
                                Not regex. Not just static analysis.
                            </h2>
                            <p style={{ ...SANS, fontSize: 14, color: C.sub, lineHeight: 1.75, margin: '0 0 24px' }}>
                                Most scanners match strings. Soteria builds a control-flow graph
                                of your code, runs graph attention convolution over it, then layers
                                a spike neural network on top. The result is a verdict that catches
                                what pattern engines miss.
                            </p>
                            <p style={{ ...SANS, fontSize: 13, color: C.muted, lineHeight: 1.7, margin: 0 }}>
                                Every phase runs independently. If GCN isn't confident (F1 &lt; 0.70),
                                it sits out. The pattern engine and SNN still run. No single point of failure.
                            </p>
                        </div>

                        <div style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>
                            {[
                                {
                                    label: 'PHASE 1',
                                    name: 'AST parse + pattern engine',
                                    detail: '739 rules across 8 languages. Comment-stripped before scan. Language-aware — require() flags PHP, not Python.',
                                },
                                {
                                    label: 'PHASE 1.5',
                                    name: 'Entropy pre-scan',
                                    detail: 'Shannon entropy on strings and byte literals. Flags obfuscated payloads and credential-like literals before the ML runs.',
                                },
                                {
                                    label: 'PHASE 1.6',
                                    name: 'SNN temporal profiler',
                                    detail: '8-channel spiking neural network — call rate, burst, silence, phase shift. Catches behavioral anomalies static passes miss.',
                                },
                                {
                                    label: 'PHASE 5.5',
                                    name: 'GCN graph blend',
                                    detail: 'GATConv over your code\'s control-flow graph. Blends in when test F1 ≥ 0.70 — second opinion, not a replacement.',
                                },
                            ].map((p, i, arr) => (
                                <div key={p.label} style={{
                                    display: 'grid', gridTemplateColumns: '90px 1fr',
                                    gap: 20, padding: '20px 0',
                                    borderBottom: i < arr.length - 1 ? `1px solid ${C.border}` : 'none',
                                }}>
                                    <div style={{ ...MONO, fontSize: 9, color: C.muted, letterSpacing: '0.1em', paddingTop: 3 }}>
                                        {p.label}
                                    </div>
                                    <div>
                                        <div style={{ ...SANS, fontSize: 13, fontWeight: 600, color: C.text, marginBottom: 6 }}>
                                            {p.name}
                                        </div>
                                        <div style={{ ...SANS, fontSize: 12, color: C.sub, lineHeight: 1.65 }}>
                                            {p.detail}
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>
            </section>

            {/* DETECTION SURFACE */}
            <section style={{ padding: '72px 24px', maxWidth: 1200, margin: '0 auto' }}>
                <div style={{
                    display: 'flex', alignItems: 'baseline', gap: 20,
                    marginBottom: 40, borderBottom: `1px solid ${C.border}`, paddingBottom: 20,
                }}>
                    <h2 style={{
                        ...SANS,
                        fontSize: 'clamp(18px, 2vw, 24px)', fontWeight: 700,
                        color: C.text, margin: 0,
                    }}>
                        What it catches
                    </h2>
                    <span style={{ ...SANS, fontSize: 13, color: C.muted }}>
                        by vulnerability category
                    </span>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 0, border: `1px solid ${C.border}` }}>
                    {[
                        {
                            cat: 'INJECTION',
                            cwe: 'CWE-89, 78, 79',
                            items: [
                                'SQL via f-string, concatenation, execute()',
                                'Command injection via os.system / subprocess',
                                'XSS via innerHTML, v-html, dangerouslySetInnerHTML',
                                'LDAP, XPath, and template injection',
                            ],
                        },
                        {
                            cat: 'SECRETS',
                            cwe: 'CWE-798',
                            items: [
                                'Hardcoded password, secret, token literals',
                                'API key prefixes: sk-, xoxb-, AIza, SG.',
                                'PEM blocks: BEGIN RSA PRIVATE KEY',
                                'AWS credentials and session tokens',
                            ],
                        },
                        {
                            cat: 'CRYPTOGRAPHY',
                            cwe: 'CWE-327, 328',
                            items: [
                                'MD5 / SHA1 used for password hashing',
                                'AES in ECB mode',
                                'JWT none algorithm acceptance',
                                'Math.random() in security contexts',
                            ],
                        },
                        {
                            cat: 'RUNTIME',
                            cwe: 'CWE-94, 22, 502',
                            items: [
                                'eval() and exec() on user input',
                                'Path traversal (../, ..\\ )',
                                'Deserialization: pickle, yaml.load, fromJson',
                                'Prototype pollution in JavaScript',
                            ],
                        },
                    ].map((cat, i) => (
                        <div
                            key={cat.cat}
                            style={{
                                background: i % 2 === 1 ? C.dim : C.bg,
                                padding: '24px',
                                borderRight: `1px solid ${C.border}`,
                                borderBottom: i < 2 ? `1px solid ${C.border}` : 'none',
                            }}
                        >
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 16 }}>
                                <span style={{ ...MONO, fontSize: 11, fontWeight: 700, color: C.text, letterSpacing: '0.06em' }}>{cat.cat}</span>
                                <span style={{ ...MONO, fontSize: 9, color: C.muted }}>{cat.cwe}</span>
                            </div>
                            <ul style={{ margin: 0, padding: 0, listStyle: 'none', display: 'flex', flexDirection: 'column', gap: 8 }}>
                                {cat.items.map(item => (
                                    <li key={item} style={{ display: 'flex', alignItems: 'flex-start', gap: 8 }}>
                                        <span style={{ ...MONO, color: C.muted, flexShrink: 0, marginTop: 2, fontSize: 10 }}>—</span>
                                        <span style={{ ...SANS, fontSize: 12, color: C.sub, lineHeight: 1.5 }}>{item}</span>
                                    </li>
                                ))}
                            </ul>
                        </div>
                    ))}
                </div>

                <div style={{ marginTop: 14, ...SANS, fontSize: 12, color: C.muted }}>
                    + 695 additional patterns.{' '}
                    <Link to="/features" style={{ color: C.sub, textDecoration: 'none' }}>
                        See the full detection surface →
                    </Link>
                </div>
            </section>

            {/* ENGINES */}
            <section style={{
                borderTop: `1px solid ${C.border}`,
                borderBottom: `1px solid ${C.border}`,
                background: C.dim,
                padding: '72px 24px',
            }}>
                <div style={{ maxWidth: 1200, margin: '0 auto' }}>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 300px', gap: 72, alignItems: 'start' }}>
                        <div>
                            <div style={{ ...MONO, fontSize: 10, color: C.muted, letterSpacing: '0.12em', marginBottom: 14 }}>
                                DETECTION ENGINES
                            </div>
                            <h2 style={{
                                ...SANS,
                                fontSize: 'clamp(20px, 2.5vw, 28px)', fontWeight: 700,
                                color: C.text, margin: '0 0 14px', lineHeight: 1.2,
                            }}>
                                Static analysis is the floor, not the ceiling.
                            </h2>
                            <p style={{ ...SANS, fontSize: 14, color: C.sub, lineHeight: 1.75, maxWidth: 520, margin: '0 0 36px' }}>
                                Soteria runs a stack of specialized engines — each watching a different attack surface.
                                The verdict is a consensus.
                            </p>

                            <div style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>
                                {[
                                    { name: 'Kyber GCN',    role: 'Graph neural malware detection' },
                                    { name: 'Kyber SNN',    role: 'Temporal behavioral profiling' },
                                    { name: 'AgentShield',  role: 'DOM Merkle-hash TOCTOU mitigation' },
                                    { name: 'DeceptiNet',   role: 'Hypergame-theoretic honeypot orchestration' },
                                    { name: 'SymbAPT',      role: 'Neurosymbolic APT hunting (MITRE ATT&CK)' },
                                    { name: 'RLShield',     role: 'Multi-agent MAPPO SOC orchestration' },
                                    { name: 'eBPF Probe',   role: 'LSM kernel runtime, per-IP/port policy' },
                                    { name: 'Multi-Krum',   role: 'Byzantine-robust federated aggregation' },
                                    { name: 'GPU Sentinel', role: 'FFT anomaly detection on VRAM access' },
                                    { name: 'Semgrep',      role: '700+ community rules, auto-synced' },
                                ].map((e, i) => (
                                    <div key={e.name} style={{
                                        display: 'flex', alignItems: 'center', gap: 16,
                                        padding: '10px 0',
                                        borderBottom: `1px solid ${C.border}`,
                                    }}>
                                        <span style={{ ...MONO, fontSize: 10, color: C.muted, minWidth: 20, textAlign: 'right' }}>
                                            {String(i + 1).padStart(2, '0')}
                                        </span>
                                        <span style={{ ...MONO, fontSize: 11, color: C.text, fontWeight: 700, minWidth: 130 }}>
                                            {e.name}
                                        </span>
                                        <span style={{ ...SANS, fontSize: 12, color: C.muted }}>
                                            {e.role}
                                        </span>
                                    </div>
                                ))}
                            </div>
                        </div>

                        {/* Timing */}
                        <div style={{ border: `1px solid ${C.border}`, padding: '24px', alignSelf: 'start' }}>
                            <div style={{ ...MONO, fontSize: 10, color: C.muted, letterSpacing: '0.1em', marginBottom: 20 }}>
                                SCAN PIPELINE
                            </div>
                            {[
                                { label: 'AST parse',     val: '12ms' },
                                { label: 'Pattern match', val: '18ms' },
                                { label: 'Entropy scan',  val: '8ms' },
                                { label: 'GCN inference', val: '340ms' },
                                { label: 'SNN temporal',  val: '220ms' },
                                { label: 'Verdict blend', val: '<1ms' },
                            ].map(r => (
                                <div key={r.label} style={{
                                    display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                                    padding: '9px 0', borderBottom: `1px solid ${C.border}`,
                                }}>
                                    <span style={{ ...SANS, fontSize: 12, color: C.sub }}>{r.label}</span>
                                    <span style={{ ...MONO, fontSize: 11, color: C.text }}>{r.val}</span>
                                </div>
                            ))}
                            <div style={{ marginTop: 20 }}>
                                <div style={{ ...MONO, fontSize: 9, color: C.muted, letterSpacing: '0.1em', marginBottom: 4 }}>TOTAL</div>
                                <div style={{ ...MONO, fontSize: 28, fontWeight: 700, color: C.text, letterSpacing: '-0.02em' }}>
                                    &lt; 2s
                                </div>
                                <div style={{ ...SANS, fontSize: 12, color: C.muted, marginTop: 4 }}>
                                    end-to-end, cold start
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </section>

            {/* CTA */}
            <section style={{ padding: '80px 24px', maxWidth: 1200, margin: '0 auto' }}>
                <p style={{ ...SANS, fontSize: 13, color: C.muted, margin: '0 0 16px' }}>
                    No credit card. No install. No onboarding call.
                </p>
                <h2 style={{
                    ...SANS,
                    fontSize: 'clamp(22px, 3vw, 38px)', fontWeight: 700,
                    color: C.text, margin: '0 0 28px', lineHeight: 1.2,
                }}>
                    Paste the code you're not sure about.
                </h2>
                <div style={{ display: 'flex', gap: 10 }}>
                    <Link to="/scanner" style={{ textDecoration: 'none' }}>
                        <button style={{
                            ...MONO, fontSize: 11, fontWeight: 700, letterSpacing: '0.1em',
                            padding: '13px 32px', background: C.acid, color: '#000',
                            border: `1px solid ${C.acid}`, cursor: 'pointer',
                            transition: 'opacity 0.15s',
                        }}
                            onMouseEnter={e => ((e.currentTarget as HTMLElement).style.opacity = '0.85')}
                            onMouseLeave={e => ((e.currentTarget as HTMLElement).style.opacity = '1')}
                        >
                            OPEN SCANNER →
                        </button>
                    </Link>
                    <Link to="/signup" style={{ textDecoration: 'none' }}>
                        <button style={{
                            ...MONO, fontSize: 11, letterSpacing: '0.1em',
                            padding: '13px 28px', background: 'transparent',
                            color: C.muted, border: `1px solid ${C.border}`, cursor: 'pointer',
                            transition: 'color 0.15s, border-color 0.15s',
                        }}
                            onMouseEnter={e => {
                                (e.currentTarget as HTMLElement).style.color = C.text;
                                (e.currentTarget as HTMLElement).style.borderColor = C.sub;
                            }}
                            onMouseLeave={e => {
                                (e.currentTarget as HTMLElement).style.color = C.muted;
                                (e.currentTarget as HTMLElement).style.borderColor = C.border;
                            }}
                        >
                            CREATE FREE ACCOUNT
                        </button>
                    </Link>
                </div>
            </section>

            {/* FOOTER */}
            <footer style={{ borderTop: `1px solid ${C.border}`, padding: '28px 24px' }}>
                <div style={{
                    maxWidth: 1200, margin: '0 auto',
                    display: 'flex', alignItems: 'center',
                    justifyContent: 'space-between', flexWrap: 'wrap', gap: 20,
                }}>
                    <Link to="/" style={{ textDecoration: 'none', display: 'flex', alignItems: 'center', gap: 10 }}>
                        <img src="/soteria-logo.png" alt="Soteria" style={{ width: 24, height: 24, objectFit: 'cover' }} />
                        <span style={{ ...MONO, fontSize: 12, fontWeight: 700, letterSpacing: '0.15em', color: C.text }}>SOTERIA</span>
                    </Link>

                    <div style={{ display: 'flex', gap: 24, alignItems: 'center' }}>
                        {[
                            { to: '/features',    label: 'Features'  },
                            { to: '/how-it-works',label: 'Docs'      },
                            { to: '/changelog',   label: 'Changelog' },
                            { to: '/about',       label: 'About'     },
                        ].map(l => (
                            <Link key={l.to} to={l.to} style={{
                                ...SANS, fontSize: 13, color: C.muted, textDecoration: 'none',
                                transition: 'color 0.15s',
                            }}
                                onMouseEnter={e => ((e.target as HTMLElement).style.color = C.text)}
                                onMouseLeave={e => ((e.target as HTMLElement).style.color = C.muted)}
                            >
                                {l.label}
                            </Link>
                        ))}
                    </div>

                    <div style={{ ...SANS, fontSize: 12, color: '#333' }}>
                        © {new Date().getFullYear()} Soteria
                    </div>
                </div>
            </footer>
        </div>
    );
}
