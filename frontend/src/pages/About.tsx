import React from 'react';
import { Github, Linkedin, Globe } from 'lucide-react';
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

export default function About() {
    return (
        <div style={{ minHeight: '100vh', background: C.bg, color: C.text, fontFamily: C.font, overflowX: 'hidden', paddingTop: 76 }}>
            <PublicNavbar />

            {/* PAGE TITLE STRIP */}
            <div style={{ borderBottom: `1px solid ${C.border}`, display: 'flex', alignItems: 'stretch', height: '36px' }}>
                <div style={{ ...cellStyle, borderLeft: `1px solid ${C.border}`, color: C.text, fontWeight: 700, letterSpacing: '0.1em', fontSize: '11px' }}>
                    ABOUT
                </div>
                <div style={{ ...cellStyle, color: C.accent }}>[ ACTIVE ]</div>
                <div style={{ ...cellStyle }}>MJ // CSE @ UC IRVINE</div>
                <div style={{ flex: 1, borderRight: `1px solid ${C.border}` }} />
                <div style={{ ...cellStyle, borderRight: 'none' }}>UTC {new Date().toISOString().slice(11, 19)}</div>
            </div>

            {/* FOUNDER SECTION */}
            <section style={{ borderBottom: `1px solid ${C.border}` }}>
                <div style={{ display: 'grid', gridTemplateColumns: '260px 1fr' }}>
                    {/* Left: Identity block */}
                    <div style={{ borderRight: `1px solid ${C.border}`, padding: '48px 32px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '20px' }}>
                        <div style={{
                            width: '96px',
                            height: '96px',
                            border: `1px solid ${C.accent}`,
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            background: '#050505',
                        }}>
                            <span style={{ fontSize: '32px', fontWeight: 900, color: C.accent, letterSpacing: '-0.04em' }}>MJ</span>
                        </div>

                        <div style={{ textAlign: 'center' }}>
                            <div style={{ fontSize: '18px', fontWeight: 900, color: C.text, letterSpacing: '-0.01em', textTransform: 'uppercase' }}>Manu Jawahar</div>
                            <div style={{ fontSize: '10px', color: C.subdued, marginTop: '6px', letterSpacing: '0.1em' }}>FOUNDER — SOTERIA</div>
                            <div style={{ fontSize: '10px', color: C.muted, marginTop: '4px', letterSpacing: '0.08em' }}>CSE @ UC IRVINE · 1ST YEAR</div>
                        </div>

                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', border: `1px solid ${C.border}`, padding: '6px 14px' }}>
                            <div style={{ width: '6px', height: '6px', background: C.accent }} />
                            <span style={{ fontSize: '10px', color: C.accent, letterSpacing: '0.1em', fontWeight: 700 }}>BUILDING</span>
                        </div>

                        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', width: '100%' }}>
                            {[
                                { href: 'https://manujawahar.vercel.app/', icon: <Globe size={13} />, label: 'PERSONAL SITE' },
                                { href: 'https://github.com/manujawahar', icon: <Github size={13} />, label: 'GITHUB' },
                                { href: 'https://linkedin.com/in/manujawahar', icon: <Linkedin size={13} />, label: 'LINKEDIN' },
                            ].map((link) => (
                                <a
                                    key={link.label}
                                    href={link.href}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    style={{
                                        display: 'flex',
                                        alignItems: 'center',
                                        gap: '10px',
                                        border: `1px solid ${C.border}`,
                                        padding: '8px 14px',
                                        color: C.subdued,
                                        textDecoration: 'none',
                                        fontSize: '10px',
                                        letterSpacing: '0.1em',
                                        fontFamily: C.font,
                                        transition: 'color 0.15s, border-color 0.15s',
                                    }}
                                    onMouseEnter={e => {
                                        (e.currentTarget as HTMLAnchorElement).style.color = C.accent;
                                        (e.currentTarget as HTMLAnchorElement).style.borderColor = C.accent;
                                    }}
                                    onMouseLeave={e => {
                                        (e.currentTarget as HTMLAnchorElement).style.color = C.subdued;
                                        (e.currentTarget as HTMLAnchorElement).style.borderColor = C.border;
                                    }}
                                >
                                    {link.icon}
                                    {link.label}
                                </a>
                            ))}
                        </div>
                    </div>

                    {/* Right: Bio */}
                    <div style={{ padding: '48px 48px' }}>
                        <h2 style={{ fontSize: 'clamp(22px, 3vw, 38px)', fontWeight: 900, textTransform: 'uppercase', lineHeight: 1.05, margin: '0 0 32px', fontFamily: C.font }}>
                            BUILT BECAUSE AI WRITES<br />
                            <span style={{ color: C.accent }}>INSECURE CODE BY DEFAULT.</span>
                        </h2>

                        <div style={{ borderLeft: `2px solid ${C.accent}`, paddingLeft: '20px', marginBottom: '28px' }}>
                            <p style={{ fontSize: '13px', color: C.text, lineHeight: 1.8, margin: 0, fontWeight: 600 }}>
                                I built Soteria out of a direct frustration with modern development habits.
                            </p>
                        </div>

                        <div style={{ display: 'flex', flexDirection: 'column', gap: '18px' }}>
                            <p style={{ fontSize: '12px', color: C.subdued, lineHeight: 1.8, margin: 0 }}>
                                With the explosive rise of AI coding assistants like Copilot and ChatGPT, programming has become exponentially faster. But there's a catch: it's also become easier to ship insecure, hallucinated, or fundamentally flawed code without understanding it.
                            </p>
                            <p style={{ fontSize: '12px', color: C.subdued, lineHeight: 1.8, margin: 0 }}>
                                As a CSE student, I saw this firsthand. Students and junior developers blindly accepted AI suggestions — pasting SQL injections, exposing API keys, deploying vulnerable logic because the code compiled and "looked right."
                            </p>
                            <p style={{ fontSize: '12px', color: C.subdued, lineHeight: 1.8, margin: 0 }}>
                                The gap between "it works" and "it's secure" has never been wider. Soteria acts as an educational firewall — it catches vulnerabilities early and explains them so developers learn while they ship, not after a breach.
                            </p>
                            <p style={{ fontSize: '12px', color: C.subdued, lineHeight: 1.8, margin: 0 }}>
                                What started as a course project turned into a production ML pipeline: AST feature extraction, graph attention networks over control-flow graphs, a spike neural network temporal profiler, and Gemini-powered explanations — all running in under 2 seconds per scan.
                            </p>
                        </div>
                    </div>
                </div>
            </section>

            {/* TECH STACK */}
            <section style={{ borderBottom: `1px solid ${C.border}` }}>
                <div style={{ borderBottom: `1px solid ${C.border}`, padding: '0 48px', height: '36px', display: 'flex', alignItems: 'center' }}>
                    <span style={{ fontSize: '10px', color: C.subdued, letterSpacing: '0.15em' }}>KYBER ENGINE — TECHNICAL STACK</span>
                </div>
                <div style={{ padding: '32px 48px', display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                    {[
                        { label: 'Python / Flask', color: C.amber },
                        { label: 'PyTorch + GATConv', color: C.accent },
                        { label: 'snntorch SNN', color: C.accent },
                        { label: 'Gemini 2.5 Pro', color: C.text },
                        { label: 'React / TypeScript', color: C.text },
                        { label: 'eBPF / libbpf-rs', color: C.danger },
                        { label: 'Rust (GPU Sentinel)', color: C.danger },
                        { label: 'gRPC + Proto', color: C.subdued },
                        { label: 'SQLite3 WAL', color: C.subdued },
                        { label: 'Supabase JWT', color: C.subdued },
                        { label: 'GitHub OAuth PKCE', color: C.subdued },
                    ].map((tech) => (
                        <div
                            key={tech.label}
                            style={{
                                border: `1px solid ${C.border}`,
                                padding: '6px 14px',
                                fontSize: '11px',
                                color: tech.color,
                                letterSpacing: '0.06em',
                            }}
                        >
                            {tech.label}
                        </div>
                    ))}
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
                    <Link to="/about" style={{ color: C.accent, textDecoration: 'none', fontSize: '11px', fontWeight: 700 }}>ABOUT</Link>
                </div>
                <div style={{ ...cellStyle, borderLeft: `1px solid ${C.border}`, borderRight: 'none' }}>
                    <a href="https://github.com/manujawahar/ACID" target="_blank" rel="noopener noreferrer" style={{ color: C.subdued, textDecoration: 'none', fontSize: '11px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                        <Github size={12} /> OPEN SOURCE
                    </a>
                </div>
            </footer>
        </div>
    );
}
