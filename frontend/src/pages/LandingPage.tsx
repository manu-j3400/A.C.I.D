/**
 * Soteria Landing Page
 * Design: Weaponized Minimalism · JetBrains Mono · White accent #FFFFFF
 */
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
};
const MONO: React.CSSProperties = { fontFamily: "'JetBrains Mono', monospace" };

/* ─── TYPEWRITER ─── */
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
        <div style={{
            border: `1px solid ${C.border}`, background: '#050505',
            padding: '0', flexShrink: 0,
        }}>
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
                    const safe  = line ?? '';
                    const isCrit = safe.includes('CRITICAL');
                    const isHigh = safe.includes('HIGH') && !safe.includes('RISK');
                    const isRisk = safe.includes('RISK:');
                    const isCmd  = safe.startsWith('$');
                    const isArrow = safe.trim().startsWith('→');
                    return (
                        <div key={i} style={{
                            ...MONO, fontSize: 11, lineHeight: 1.75,
                            color: isCrit ? C.red
                                 : isHigh ? '#FF8C00'
                                 : isRisk ? C.acid
                                 : isCmd  ? C.text
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

/* ─── MAIN ─── */
export default function LandingPage() {
    return (
        <div style={{ minHeight: '100vh', background: C.bg, color: C.text, ...MONO, overflowX: 'hidden' }}>
            <PublicNavbar />

            {/* ══ HERO ══════════════════════════════════════════════════════════ */}
            <section style={{ padding: '96px 24px 72px', maxWidth: 1200, margin: '0 auto' }}>

                {/* Eyebrow — left-aligned, no centering */}
                <div style={{
                    display: 'inline-flex', alignItems: 'center', gap: 8,
                    marginBottom: 40,
                }}>
                    <span style={{ width: 5, height: 5, background: C.acid, borderRadius: '50%', boxShadow: `0 0 8px ${C.acid}` }} />
                    <span style={{ fontSize: 11, color: C.sub, letterSpacing: '0.1em' }}>
                        KYBER ENGINE v2.5 — ACTIVE
                    </span>
                </div>

                {/* Two-column: headline left, terminal right */}
                <div style={{
                    display: 'grid',
                    gridTemplateColumns: '1fr 460px',
                    gap: 64, alignItems: 'flex-start',
                }}>
                    <div>
                        {/* Headline — not a tagline, a statement */}
                        <h1 style={{
                            fontSize: 'clamp(40px, 5.5vw, 72px)',
                            fontWeight: 900, lineHeight: 1.0,
                            letterSpacing: '-0.025em',
                            textTransform: 'uppercase',
                            margin: '0 0 32px',
                        }}>
                            <span style={{ display: 'block', color: C.text }}>YOUR LINTER</span>
                            <span style={{ display: 'block', color: C.text }}>MISSED THE</span>
                            <span style={{ display: 'block', color: C.acid }}>SQL INJECTION</span>
                            <span style={{ display: 'block', color: C.text }}>ON LINE 42.</span>
                        </h1>

                        {/* Sub — specific, not generic */}
                        <p style={{
                            fontSize: 12, color: C.sub, lineHeight: 1.85,
                            maxWidth: 420, marginBottom: 40,
                        }}>
                            Soteria runs AST parsing, 739 vulnerability patterns, a GCN
                            neural model, and a Spiking Neural Network in under 2 seconds.
                            It tells you the exact line, the CWE, and hands you patched code.
                            No subscription. No install. No false reassurance.
                        </p>

                        {/* CTAs — primary clear, secondary muted */}
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

                        {/* Claim strip — 3 facts, no boxes, left-aligned */}
                        <div style={{
                            display: 'flex', gap: 0,
                            borderTop: `1px solid ${C.border}`,
                            paddingTop: 24,
                        }}>
                            {[
                                { val: '739', lbl: 'PATTERNS' },
                                { val: '<2s',  lbl: 'PER SCAN' },
                                { val: '8',    lbl: 'LANGUAGES' },
                            ].map((s, i) => (
                                <div key={s.lbl} style={{
                                    paddingRight: 32,
                                    marginRight: 32,
                                    borderRight: i < 2 ? `1px solid ${C.border}` : 'none',
                                }}>
                                    <div style={{ fontSize: 28, fontWeight: 700, color: C.acid, letterSpacing: '-0.02em', lineHeight: 1 }}>
                                        {s.val}
                                    </div>
                                    <div style={{ fontSize: 10, color: C.muted, letterSpacing: '0.1em', marginTop: 4 }}>
                                        {s.lbl}
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>

                    {/* Right: live terminal — no macOS dots */}
                    <Terminal />
                </div>
            </section>

            {/* ══ WHAT ACTUALLY HAPPENS ═════════════════════════════════════════ */}
            <section style={{
                borderTop: `1px solid ${C.border}`,
                background: C.dim,
                padding: '64px 24px',
            }}>
                <div style={{ maxWidth: 1200, margin: '0 auto' }}>

                    {/* Asymmetric: label left, content right */}
                    <div style={{ display: 'grid', gridTemplateColumns: '200px 1fr', gap: 48 }}>
                        <div style={{ paddingTop: 4 }}>
                            <div style={{ fontSize: 10, color: C.acid, letterSpacing: '0.12em', marginBottom: 6 }}>
                                UNDER THE HOOD
                            </div>
                            <div style={{ fontSize: 11, color: C.muted, lineHeight: 1.7 }}>
                                what runs on every scan
                            </div>
                        </div>

                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 1, background: C.border }}>
                            {[
                                {
                                    step: 'PHASE 1',
                                    name: 'AST PARSE + PATTERN ENGINE',
                                    detail: '739 rules across 8 languages. Language-aware — `require()` flags PHP, not Python. Comment-stripped before scan to eliminate false positives from explanatory code.',
                                },
                                {
                                    step: 'PHASE 2',
                                    name: 'ENTROPY PROFILER',
                                    detail: 'Shannon entropy on strings and byte sequences. Flags obfuscated payloads, encoded shellcode, and credential-like high-entropy literals before the ML step runs.',
                                },
                                {
                                    step: 'PHASE 3',
                                    name: 'GCN NEURAL MODEL',
                                    detail: 'GATConv graph network trained on real malware. Activates when F1 ≥ 0.70. Blended with pattern scores — not a replacement, a second opinion.',
                                },
                                {
                                    step: 'PHASE 4',
                                    name: 'SNN TEMPORAL PROFILER',
                                    detail: 'Spiking Neural Network with 8 semantic channels (call rate, burst, silence, phase shift). Catches behavioral anomalies the static passes miss.',
                                },
                            ].map(p => (
                                <PhaseCard key={p.step} {...p} />
                            ))}
                        </div>
                    </div>
                </div>
            </section>

            {/* ══ DETECTION SURFACE ═════════════════════════════════════════════ */}
            <section style={{ padding: '72px 24px', maxWidth: 1200, margin: '0 auto' }}>

                {/* Flush-left heading, no centering */}
                <div style={{
                    display: 'flex', alignItems: 'baseline', gap: 24,
                    marginBottom: 48, borderBottom: `1px solid ${C.border}`, paddingBottom: 20,
                }}>
                    <h2 style={{
                        fontSize: 'clamp(20px, 2.5vw, 28px)', fontWeight: 900,
                        letterSpacing: '-0.01em', textTransform: 'uppercase',
                        margin: 0,
                    }}>
                        DETECTION SURFACE
                    </h2>
                    <span style={{ fontSize: 11, color: C.muted }}>
                        what Soteria actually catches
                    </span>
                </div>

                {/* Two columns: category + items */}
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 0, border: `1px solid ${C.border}` }}>
                    {[
                        {
                            cat: 'INJECTION',
                            cwe: 'CWE-89, 78, 79',
                            items: ['SQL (f-string, concatenation, execute)', 'Command injection via os.system / subprocess', 'XSS via innerHTML, v-html, dangerouslySetInnerHTML', 'LDAP, XPath, template injection'],
                        },
                        {
                            cat: 'SECRETS',
                            cwe: 'CWE-798',
                            items: ['Hardcoded string literals: password, secret, token', 'API key prefixes: sk-, xoxb-, AIza, SG.', 'PEM blocks: BEGIN RSA PRIVATE KEY', 'AWS credentials and session tokens'],
                        },
                        {
                            cat: 'CRYPTOGRAPHY',
                            cwe: 'CWE-327, 328',
                            items: ['MD5 / SHA1 for password hashing', 'ECB mode AES', 'JWT none algorithm acceptance', 'Random via Math.random() in security context'],
                        },
                        {
                            cat: 'RUNTIME',
                            cwe: 'CWE-94, 22, 502',
                            items: ['eval() and exec() on user input', 'Path traversal (../, ..\\ )', 'Deserialization: pickle, yaml.load, fromJson', 'Prototype pollution in JavaScript'],
                        },
                    ].map((cat, i) => (
                        <DetectionRow key={cat.cat} {...cat} dim={i % 2 === 1} />
                    ))}
                </div>

                <div style={{ marginTop: 16, fontSize: 10, color: C.muted, letterSpacing: '0.06em' }}>
                    + 695 additional patterns. Full list in{' '}
                    <Link to="/features" style={{ color: C.sub, textDecoration: 'none' }}>
                        vulnerability database →
                    </Link>
                </div>
            </section>

            {/* ══ ENGINES ═══════════════════════════════════════════════════════ */}
            <section style={{
                borderTop: `1px solid ${C.border}`,
                borderBottom: `1px solid ${C.border}`,
                background: C.dim,
                padding: '64px 24px',
            }}>
                <div style={{ maxWidth: 1200, margin: '0 auto' }}>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 320px', gap: 64, alignItems: 'start' }}>

                        <div>
                            <div style={{ fontSize: 10, color: C.acid, letterSpacing: '0.12em', marginBottom: 12 }}>
                                DETECTION ENGINES
                            </div>
                            <h2 style={{
                                fontSize: 'clamp(20px, 2.5vw, 32px)', fontWeight: 900,
                                letterSpacing: '-0.01em', textTransform: 'uppercase',
                                margin: '0 0 24px',
                            }}>
                                TEN ENGINES.<br />
                                <span style={{ color: C.acid }}>ONE VERDICT.</span>
                            </h2>
                            <p style={{ fontSize: 11, color: C.sub, lineHeight: 1.8, maxWidth: 480, margin: '0 0 36px' }}>
                                Static analysis is the floor, not the ceiling. Soteria runs
                                a fleet of specialized engines — each watching a different attack surface.
                                The final verdict is a consensus, not a coin flip.
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
                                        padding: '11px 0',
                                        borderBottom: `1px solid ${C.border}`,
                                    }}>
                                        <span style={{ fontSize: 10, color: C.muted, minWidth: 20, textAlign: 'right' }}>
                                            {String(i + 1).padStart(2, '0')}
                                        </span>
                                        <span style={{ fontSize: 11, color: C.text, fontWeight: 700, minWidth: 130 }}>
                                            {e.name}
                                        </span>
                                        <span style={{ fontSize: 11, color: C.muted }}>
                                            {e.role}
                                        </span>
                                    </div>
                                ))}
                            </div>
                        </div>

                        {/* Right: vertical stat */}
                        <div style={{
                            border: `1px solid ${C.border}`, padding: '32px 24px',
                            display: 'flex', flexDirection: 'column', gap: 0,
                            alignSelf: 'start',
                        }}>
                            <div style={{ fontSize: 10, color: C.muted, letterSpacing: '0.1em', marginBottom: 20 }}>
                                SCAN PIPELINE
                            </div>
                            {[
                                { label: 'AST parse',         val: '12ms avg' },
                                { label: 'Pattern match',     val: '18ms avg' },
                                { label: 'Entropy scan',      val: '8ms avg' },
                                { label: 'GCN inference',     val: '340ms avg' },
                                { label: 'SNN temporal',      val: '220ms avg' },
                                { label: 'Verdict blend',     val: '<1ms' },
                            ].map(r => (
                                <div key={r.label} style={{
                                    display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                                    padding: '9px 0', borderBottom: `1px solid ${C.border}`,
                                }}>
                                    <span style={{ fontSize: 11, color: C.sub }}>{r.label}</span>
                                    <span style={{ fontSize: 11, color: C.acid }}>{r.val}</span>
                                </div>
                            ))}
                            <div style={{ marginTop: 20 }}>
                                <div style={{ fontSize: 10, color: C.muted, marginBottom: 4 }}>TOTAL</div>
                                <div style={{ fontSize: 26, fontWeight: 700, color: C.text, letterSpacing: '-0.02em' }}>
                                    &lt; 2s
                                </div>
                                <div style={{ fontSize: 10, color: C.muted, marginTop: 4 }}>
                                    end-to-end, cold start
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </section>

            {/* ══ CTA ═══════════════════════════════════════════════════════════ */}
            <section style={{ padding: '80px 24px', maxWidth: 1200, margin: '0 auto' }}>
                <div style={{
                    display: 'grid', gridTemplateColumns: '1fr auto',
                    gap: 48, alignItems: 'center',
                    borderLeft: `3px solid ${C.acid}`, paddingLeft: 32,
                }}>
                    <div>
                        <h2 style={{
                            fontSize: 'clamp(24px, 3.5vw, 44px)', fontWeight: 900,
                            letterSpacing: '-0.02em', textTransform: 'uppercase',
                            margin: '0 0 12px', lineHeight: 1.05,
                        }}>
                            STOP GUESSING.<br />
                            <span style={{ color: C.acid }}>START KNOWING.</span>
                        </h2>
                        <p style={{ fontSize: 11, color: C.sub, lineHeight: 1.8, maxWidth: 520, margin: 0 }}>
                            No credit card. No trial period. No onboarding call.
                            Paste code, get findings. If it's clean, you'll know in under 2 seconds.
                        </p>
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 10, flexShrink: 0 }}>
                        <Link to="/scanner" style={{ textDecoration: 'none' }}>
                            <button style={{
                                ...MONO, fontSize: 11, fontWeight: 700, letterSpacing: '0.1em',
                                padding: '13px 32px', background: C.acid, color: '#000',
                                border: `1px solid ${C.acid}`, cursor: 'pointer', width: '100%',
                                transition: 'opacity 0.15s', whiteSpace: 'nowrap',
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
                                padding: '13px 32px', background: 'transparent', color: C.muted,
                                border: `1px solid ${C.border}`, cursor: 'pointer', width: '100%',
                                transition: 'color 0.15s, border-color 0.15s', whiteSpace: 'nowrap',
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
                </div>
            </section>

            {/* ══ FOOTER ════════════════════════════════════════════════════════ */}
            <footer style={{ borderTop: `1px solid ${C.border}`, padding: '28px 24px' }}>
                <div style={{
                    maxWidth: 1200, margin: '0 auto',
                    display: 'flex', alignItems: 'center',
                    justifyContent: 'space-between', flexWrap: 'wrap', gap: 20,
                }}>
                    <Link to="/" style={{ textDecoration: 'none', display: 'flex', alignItems: 'center', gap: 10 }}>
                        <img src="/soteria-logo.png" alt="Soteria" style={{ width: 24, height: 24, objectFit: 'cover' }} />
                        <span style={{ fontSize: 12, fontWeight: 700, letterSpacing: '0.15em', color: C.text }}>SOTERIA</span>
                    </Link>

                    <div style={{ display: 'flex', gap: 24, alignItems: 'center' }}>
                        {[
                            { to: '/features',   label: 'FEATURES'  },
                            { to: '/how-it-works', label: 'DOCS'    },
                            { to: '/changelog',  label: 'LIFECYCLE' },
                            { to: '/about',      label: 'ABOUT'     },
                        ].map(l => (
                            <Link key={l.to} to={l.to} style={{
                                fontSize: 11, color: C.muted, textDecoration: 'none',
                                letterSpacing: '0.08em', transition: 'color 0.15s',
                            }}
                                onMouseEnter={e => ((e.target as HTMLElement).style.color = C.text)}
                                onMouseLeave={e => ((e.target as HTMLElement).style.color = C.muted)}
                            >
                                {l.label}
                            </Link>
                        ))}
                    </div>

                    <div style={{ fontSize: 10, color: '#333', letterSpacing: '0.1em' }}>
                        © {new Date().getFullYear()} SOTERIA
                    </div>
                </div>
            </footer>
        </div>
    );
}

/* ─── PHASE CARD ─── */
function PhaseCard({ step, name, detail }: { step: string; name: string; detail: string }) {
    const [hov, setHov] = useState(false);
    return (
        <div
            onMouseEnter={() => setHov(true)}
            onMouseLeave={() => setHov(false)}
            style={{
                background: hov ? '#0A0A0A' : C.bg,
                padding: '24px', transition: 'background 0.15s',
            }}
        >
            <div style={{ fontSize: 10, color: hov ? C.acid : C.muted, letterSpacing: '0.12em', marginBottom: 8, transition: 'color 0.15s' }}>
                {step}
            </div>
            <div style={{ fontSize: 13, fontWeight: 700, color: C.text, marginBottom: 10, letterSpacing: '0.02em' }}>
                {name}
            </div>
            <div style={{ fontSize: 11, color: C.sub, lineHeight: 1.75 }}>
                {detail}
            </div>
        </div>
    );
}

/* ─── DETECTION ROW ─── */
function DetectionRow({ cat, cwe, items, dim }: {
    cat: string; cwe: string; items: string[]; dim?: boolean;
}) {
    return (
        <div style={{
            background: dim ? C.dim : C.bg, padding: '24px',
            borderRight: `1px solid ${C.border}`,
        }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 14 }}>
                <span style={{ fontSize: 12, fontWeight: 700, color: C.text, letterSpacing: '0.06em' }}>{cat}</span>
                <span style={{ fontSize: 10, color: C.muted, letterSpacing: '0.06em' }}>{cwe}</span>
            </div>
            <ul style={{ margin: 0, padding: 0, listStyle: 'none', display: 'flex', flexDirection: 'column', gap: 7 }}>
                {items.map(item => (
                    <li key={item} style={{ display: 'flex', alignItems: 'flex-start', gap: 8 }}>
                        <span style={{ color: C.acid, flexShrink: 0, marginTop: 1 }}>▸</span>
                        <span style={{ fontSize: 11, color: C.sub, lineHeight: 1.5 }}>{item}</span>
                    </li>
                ))}
            </ul>
        </div>
    );
}
