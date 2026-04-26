import React from 'react';
import { Link } from 'react-router-dom';
import { ScanLine, Brain, Github, Database } from 'lucide-react';
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

export default function FeaturesPage() {
    return (
        <div style={{ minHeight: '100vh', background: C.bg, color: C.text, fontFamily: C.font, overflowX: 'hidden', paddingTop: 76 }}>
            <PublicNavbar />

            {/* PAGE TITLE STRIP */}
            <div style={{ borderBottom: `1px solid ${C.border}`, display: 'flex', alignItems: 'stretch', height: '36px' }}>
                <div style={{ ...cellStyle, borderLeft: `1px solid ${C.border}`, color: C.text, fontWeight: 700, letterSpacing: '0.1em', fontSize: '11px' }}>
                    PLATFORM CAPABILITIES
                </div>
                <div style={{ ...cellStyle, color: C.accent }}>[ LIVE ]</div>
                <div style={{ ...cellStyle }}>KYBER ENGINE v2.5.0</div>
                <div style={{ flex: 1, borderRight: `1px solid ${C.border}` }} />
                <div style={{ ...cellStyle, borderRight: 'none' }}>UTC {new Date().toISOString().slice(11, 19)}</div>
            </div>

            {/* HERO — asymmetric, no rotating words */}
            <section style={{ padding: '64px 48px 48px', borderBottom: `1px solid ${C.border}`, display: 'grid', gridTemplateColumns: '1fr 340px', gap: '64px', alignItems: 'start' }}>
                <div>
                    <h1 style={{ fontSize: 'clamp(36px, 6vw, 72px)', fontWeight: 900, letterSpacing: '-0.02em', lineHeight: 1, margin: '0 0 24px', textTransform: 'uppercase', fontFamily: C.font }}>
                        HYBRID AST + GCN + SNN.<br />
                        <span style={{ color: C.danger }}>509 VULNERABILITY PATTERNS.</span>
                    </h1>
                    <p style={{ fontSize: '13px', color: C.subdued, maxWidth: '520px', lineHeight: 1.8, margin: 0 }}>
                        Not another SAST tool with regex rules. Soteria builds a control-flow graph of your code, runs graph attention convolution over it, and blends the result with a temporal spike neural network score — then explains the finding in plain English.
                    </p>
                </div>
                <div style={{ borderLeft: `1px solid ${C.border}`, paddingLeft: '32px' }}>
                    <div style={{ fontSize: '10px', color: C.muted, letterSpacing: '0.1em', marginBottom: '16px' }}>DETECTION STACK</div>
                    {[
                        { label: 'AST Feature Extraction', sub: '52-dim vector, cyclomatic complexity', color: C.text },
                        { label: 'Entropy Pre-Scanner', sub: 'flags high-entropy strings ≥ 5 bits', color: C.amber },
                        { label: 'SNN Temporal Profiler', sub: '8-channel LIF spike encoder', color: C.accent },
                        { label: 'RF Ensemble', sub: 'acidModel.pkl baseline', color: C.text },
                        { label: 'GCN Blend', sub: 'GATConv, activates at F1 ≥ 0.70', color: C.accent },
                        { label: 'Gemini 2.5 Pro', sub: 'streaming SSE explanation', color: C.subdued },
                    ].map((layer, i) => (
                        <div key={i} style={{ display: 'flex', alignItems: 'flex-start', gap: '12px', padding: '10px 0', borderBottom: i < 5 ? `1px solid ${C.border}` : 'none' }}>
                            <span style={{ fontSize: '10px', color: C.muted, minWidth: '18px', paddingTop: '1px' }}>{String(i + 1).padStart(2, '0')}</span>
                            <div>
                                <div style={{ fontSize: '11px', fontWeight: 700, color: layer.color, letterSpacing: '0.06em' }}>{layer.label}</div>
                                <div style={{ fontSize: '10px', color: C.muted, marginTop: '2px' }}>{layer.sub}</div>
                            </div>
                        </div>
                    ))}
                </div>
            </section>

            {/* REAL-TIME SCANNING */}
            <section style={{ borderBottom: `1px solid ${C.border}`, display: 'grid', gridTemplateColumns: '1fr 1fr' }}>
                <div style={{ padding: '36px 48px', borderRight: `1px solid ${C.border}` }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '20px' }}>
                        <ScanLine size={14} style={{ color: C.danger }} />
                        <span style={{ fontSize: '10px', color: C.danger, fontWeight: 700, letterSpacing: '0.15em' }}>REAL-TIME SCANNING</span>
                    </div>
                    <h3 style={{ fontSize: '20px', fontWeight: 900, textTransform: 'uppercase', color: C.text, marginBottom: '14px', lineHeight: 1.1 }}>
                        Sub-second. In-browser.
                    </h3>
                    <p style={{ fontSize: '12px', color: C.subdued, lineHeight: 1.8, margin: '0 0 20px' }}>
                        Paste code and get a verdict in under 2 seconds. SQL injection, XSS, command injection, SSRF, path traversal, and 500+ more patterns across Python, Go, Rust, JavaScript, TypeScript, and Java.
                    </p>
                    <div style={{ display: 'flex', gap: '24px' }}>
                        <div>
                            <div style={{ fontSize: '24px', fontWeight: 900, color: C.danger }}>509+</div>
                            <div style={{ fontSize: '10px', color: C.muted, letterSpacing: '0.1em', marginTop: '2px' }}>PATTERNS</div>
                        </div>
                        <div>
                            <div style={{ fontSize: '24px', fontWeight: 900, color: C.text }}>&lt; 2s</div>
                            <div style={{ fontSize: '10px', color: C.muted, letterSpacing: '0.1em', marginTop: '2px' }}>SCAN TIME</div>
                        </div>
                        <div>
                            <div style={{ fontSize: '24px', fontWeight: 900, color: C.accent }}>6</div>
                            <div style={{ fontSize: '10px', color: C.muted, letterSpacing: '0.1em', marginTop: '2px' }}>LANGUAGES</div>
                        </div>
                    </div>
                </div>
                <div style={{ padding: '36px 48px', background: '#040404', fontFamily: C.font, fontSize: '12px', lineHeight: 1.9 }}>
                    <div style={{ border: `1px solid ${C.border}`, padding: '20px' }}>
                        <div><span style={{ color: C.accent }}>$</span> soteria scan auth_handler.py</div>
                        <div style={{ color: C.muted }}>  parsing 89 lines...</div>
                        <div style={{ color: C.muted }}>  building cfg graph... 14 nodes</div>
                        <div style={{ color: C.muted }}>  entropy scan... ok</div>
                        <div style={{ color: C.muted }}>  snn temporal profile... ok</div>
                        <div style={{ color: C.muted }}>  rf ensemble... score 0.71</div>
                        <div style={{ color: C.muted }}>  gcn blend activated... score 0.84</div>
                        <div style={{ color: C.danger, fontWeight: 700, marginTop: '4px' }}>  MALICIOUS — 2 CRITICAL</div>
                        <div style={{ color: C.amber }}>    L44: unsanitized f-string SQL</div>
                        <div style={{ color: C.amber }}>    L67: subprocess shell=True + user input</div>
                        <div style={{ color: C.accent, marginTop: '4px' }}>  completed in 1.3s</div>
                    </div>
                </div>
            </section>

            {/* AI EXPLANATIONS */}
            <section style={{ borderBottom: `1px solid ${C.border}`, display: 'grid', gridTemplateColumns: '340px 1fr' }}>
                <div style={{ borderRight: `1px solid ${C.border}`, padding: '36px 32px', background: '#030303' }}>
                    <div style={{ marginBottom: '16px' }}>
                        <div style={{ fontSize: '10px', color: C.muted, letterSpacing: '0.1em', marginBottom: '8px' }}>GEMINI 2.5 PRO — STREAMING</div>
                        <div style={{ fontSize: '11px', color: C.subdued, lineHeight: 1.8, borderLeft: `2px solid ${C.accent}`, paddingLeft: '12px' }}>
                            "The f-string on line 44 passes <span style={{ color: C.danger }}>request.args['id']</span> directly into a SQL query string. An attacker controls the value of this parameter and can inject arbitrary SQL — for example, <span style={{ color: C.amber }}>id=1 OR 1=1</span> returns all rows."
                        </div>
                    </div>
                    <div style={{ borderTop: `1px solid ${C.border}`, paddingTop: '14px', fontSize: '10px', color: C.muted }}>
                        <div>SEVERITY: CRITICAL</div>
                        <div>CWE-89: SQL Injection</div>
                        <div>FIX: parameterized query</div>
                    </div>
                </div>
                <div style={{ padding: '36px 48px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '20px' }}>
                        <Brain size={14} style={{ color: C.accent }} />
                        <span style={{ fontSize: '10px', color: C.accent, fontWeight: 700, letterSpacing: '0.15em' }}>AI EXPLANATIONS</span>
                    </div>
                    <h3 style={{ fontSize: '20px', fontWeight: 900, textTransform: 'uppercase', color: C.text, marginBottom: '14px', lineHeight: 1.1 }}>
                        No CWE codes. No noise.
                    </h3>
                    <p style={{ fontSize: '12px', color: C.subdued, lineHeight: 1.8, margin: '0 0 20px' }}>
                        Every finding streams a plain-English explanation: what the vulnerability is, how an attacker exploits it, and the exact patched code. Powered by Gemini 2.5 Pro over Server-Sent Events — first token in under 400ms.
                    </p>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                        {[
                            'Streaming SSE — no wait for full response',
                            'Patched code snippet included with every finding',
                            'References actual line numbers from your code',
                        ].map((item, i) => (
                            <div key={i} style={{ display: 'flex', gap: '10px', fontSize: '11px', color: C.subdued }}>
                                <span style={{ color: C.accent }}>→</span>
                                {item}
                            </div>
                        ))}
                    </div>
                </div>
            </section>

            {/* GITHUB INTEGRATION + BATCH */}
            <section style={{ borderBottom: `1px solid ${C.border}`, display: 'grid', gridTemplateColumns: '1fr 1fr' }}>
                <div style={{ padding: '36px 48px', borderRight: `1px solid ${C.border}` }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '20px' }}>
                        <Github size={14} style={{ color: C.text }} />
                        <span style={{ fontSize: '10px', color: C.text, fontWeight: 700, letterSpacing: '0.15em' }}>GITHUB INTEGRATION</span>
                    </div>
                    <h3 style={{ fontSize: '20px', fontWeight: 900, textTransform: 'uppercase', color: C.text, marginBottom: '14px', lineHeight: 1.1 }}>
                        Scan entire repos.
                    </h3>
                    <p style={{ fontSize: '12px', color: C.subdued, lineHeight: 1.8, margin: '0 0 20px' }}>
                        OAuth PKCE (RFC 7636) — connect once, clone and scan any repo. GIT_ASKPASS token injection, no credentials ever embedded in URLs. PRs auto-checked via the kyber-pr-check GitHub Actions workflow.
                    </p>
                    <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                        {['my-flask-app', 'react-portfolio', 'node-api'].map((repo, i) => (
                            <div
                                key={repo}
                                style={{ border: `1px solid ${C.border}`, padding: '6px 12px', fontSize: '11px', color: C.subdued, display: 'flex', alignItems: 'center', gap: '8px' }}
                            >
                                <div style={{ width: '6px', height: '6px', background: i === 0 ? C.accent : i === 1 ? C.text : C.danger }} />
                                {repo}
                            </div>
                        ))}
                    </div>
                </div>
                <div style={{ padding: '36px 48px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '20px' }}>
                        <Database size={14} style={{ color: C.amber }} />
                        <span style={{ fontSize: '10px', color: C.amber, fontWeight: 700, letterSpacing: '0.15em' }}>SCAN HISTORY</span>
                    </div>
                    <h3 style={{ fontSize: '20px', fontWeight: 900, textTransform: 'uppercase', color: C.text, marginBottom: '14px', lineHeight: 1.1 }}>
                        Every scan. Searchable.
                    </h3>
                    <p style={{ fontSize: '12px', color: C.subdued, lineHeight: 1.8, margin: '0 0 20px' }}>
                        Full scan history in SQLite WAL — paginated, filterable by verdict. Export to CSV. Webhook notifications fire on malicious results. 24h result cache means re-scanning identical code returns instantly.
                    </p>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                        {[
                            'CSV export — JWT-protected endpoint',
                            'Webhook on malicious scan result',
                            '24h SHA-256 result cache per user',
                        ].map((item, i) => (
                            <div key={i} style={{ display: 'flex', gap: '10px', fontSize: '11px', color: C.subdued }}>
                                <span style={{ color: C.amber }}>→</span>
                                {item}
                            </div>
                        ))}
                    </div>
                </div>
            </section>

            {/* CTA */}
            <section style={{ padding: '64px 48px', borderBottom: `1px solid ${C.border}` }}>
                <div style={{ borderLeft: `3px solid ${C.accent}`, paddingLeft: '28px', maxWidth: '700px' }}>
                    <div style={{ fontSize: '11px', color: C.muted, letterSpacing: '0.1em', marginBottom: '16px' }}>
                        NO INSTALL. NO CREDIT CARD. NO SALES CALL.
                    </div>
                    <h2 style={{ fontSize: 'clamp(28px, 4vw, 52px)', fontWeight: 900, textTransform: 'uppercase', lineHeight: 1.05, margin: '0 0 20px', fontFamily: C.font }}>
                        SCAN YOUR CODE.<br />
                        <span style={{ color: C.accent }}>KNOW WHAT'S IN IT.</span>
                    </h2>
                    <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
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
                        <Link
                            to="/how-it-works"
                            style={{
                                display: 'inline-block',
                                border: `1px solid ${C.border}`,
                                color: C.subdued,
                                fontFamily: C.font,
                                fontSize: '12px',
                                fontWeight: 700,
                                letterSpacing: '0.15em',
                                padding: '12px 28px',
                                textDecoration: 'none',
                                textTransform: 'uppercase',
                            }}
                        >
                            HOW IT WORKS
                        </Link>
                    </div>
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
