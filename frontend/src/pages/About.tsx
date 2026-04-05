import { motion } from 'framer-motion';
import { Github, Linkedin, Globe, Cpu, Shield } from 'lucide-react';
import { Link } from 'react-router-dom';

const C = {
    bg: '#000000',
    accent: '#ADFF2F',
    danger: '#FF3131',
    amber: '#FF8C00',
    text: '#E5E5E5',
    subdued: '#707070',
    muted: '#404040',
    border: '#1E1E1E',
    font: "'JetBrains Mono', monospace",
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
                    <Link to="/how-it-works" style={{ color: C.subdued, textDecoration: 'none', fontFamily: C.font, fontSize: '11px' }}>[ HOW IT WORKS ]</Link>
                </div>
                <div style={{ ...cellStyle }}>
                    <Link to="/changelog" style={{ color: C.subdued, textDecoration: 'none', fontFamily: C.font, fontSize: '11px' }}>[ CHANGELOG ]</Link>
                </div>
                <div style={{ ...cellStyle }}>
                    <Link to="/about" style={{ color: C.accent, textDecoration: 'none', fontFamily: C.font, fontSize: '11px' }}>[ ABOUT ]</Link>
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
                    ABOUT — FOUNDER PROFILE
                </div>
                <div style={{ ...cellStyle, color: C.accent }}>[ ACTIVE ]</div>
                <div style={{ ...cellStyle }}>MJ // CSE @ UC IRVINE</div>
                <div style={{ flex: 1, borderRight: `1px solid ${C.border}` }} />
                <div style={{ ...cellStyle, borderRight: 'none' }}>UTC {new Date().toISOString().slice(11, 19)}</div>
            </div>

            {/* ─── FOUNDER HERO ─── */}
            <section style={{ borderBottom: `1px solid ${C.border}` }}>
                <div style={{ display: 'grid', gridTemplateColumns: '280px 1fr' }}>
                    {/* Left: Identity block */}
                    <motion.div
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
                        style={{ borderRight: `1px solid ${C.border}`, padding: '48px 32px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '20px' }}
                    >
                        {/* Avatar */}
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

                        {/* Status indicator */}
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', border: `1px solid ${C.border}`, padding: '6px 14px' }}>
                            <motion.div
                                animate={{ opacity: [1, 0.3, 1] }}
                                transition={{ duration: 1.8, repeat: Infinity }}
                                style={{ width: '6px', height: '6px', background: C.accent }}
                            />
                            <span style={{ fontSize: '10px', color: C.accent, letterSpacing: '0.1em', fontWeight: 700 }}>BUILDING</span>
                        </div>

                        {/* Social links */}
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', width: '100%' }}>
                            {[
                                {
                                    href: 'https://manujawahar.vercel.app/',
                                    icon: <Globe size={13} />,
                                    label: 'PERSONAL SITE',
                                },
                                {
                                    href: 'https://github.com/manujawahar',
                                    icon: <Github size={13} />,
                                    label: 'GITHUB',
                                },
                                {
                                    href: 'https://linkedin.com/in/manujawahar',
                                    icon: <Linkedin size={13} />,
                                    label: 'LINKEDIN',
                                },
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
                    </motion.div>

                    {/* Right: Bio text */}
                    <motion.div
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.6, delay: 0.15, ease: [0.16, 1, 0.3, 1] }}
                        style={{ padding: '48px 48px' }}
                    >
                        <div style={{ display: 'inline-block', border: `1px solid ${C.border}`, padding: '4px 12px', marginBottom: '28px' }}>
                            <span style={{ fontSize: '10px', color: C.accent, letterSpacing: '0.2em', fontWeight: 700 }}>// ORIGIN STORY</span>
                        </div>

                        <h2 style={{ fontSize: 'clamp(24px, 3vw, 40px)', fontWeight: 900, textTransform: 'uppercase', lineHeight: 1.05, margin: '0 0 32px', fontFamily: C.font }}>
                            COMBATING THE RISE OF<br />
                            <span style={{ color: C.accent }}>AI-GENERATED BUGS.</span>
                        </h2>

                        <div style={{ borderLeft: `2px solid ${C.accent}`, paddingLeft: '20px', marginBottom: '28px' }}>
                            <p style={{ fontSize: '13px', color: C.text, lineHeight: 1.8, margin: 0, fontWeight: 600 }}>
                                I built Soteria out of a direct frustration with modern development habits.
                            </p>
                        </div>

                        <div style={{ display: 'flex', flexDirection: 'column', gap: '18px' }}>
                            <p style={{ fontSize: '12px', color: C.subdued, lineHeight: 1.8, margin: 0 }}>
                                With the explosive rise of AI coding assistants like Copilot and ChatGPT, programming has become exponentially faster. But there's a serious catch: it's also become exponentially easier to ship insecure, hallucinated, or fundamentally flawed code without fully understanding it.
                            </p>
                            <p style={{ fontSize: '12px', color: C.subdued, lineHeight: 1.8, margin: 0 }}>
                                As a CSE student, I saw this happening firsthand. Students and junior developers were blindly accepting AI suggestions — pasting SQL injections, exposing API keys, and deploying vulnerable logic because the code "looked right" and compiled successfully.
                            </p>
                            <p style={{ fontSize: '12px', color: C.subdued, lineHeight: 1.8, margin: 0 }}>
                                I realized that while AI is great at writing code, we need better tools to{' '}
                                <strong style={{ color: C.text }}>verify</strong> and{' '}
                                <strong style={{ color: C.text }}>understand</strong> that code.
                            </p>
                        </div>
                    </motion.div>
                </div>
            </section>

            {/* ─── MISSION GRID ─── */}
            <section style={{ borderBottom: `1px solid ${C.border}` }}>
                <div style={{ borderBottom: `1px solid ${C.border}`, padding: '0 48px', height: '36px', display: 'flex', alignItems: 'center' }}>
                    <span style={{ fontSize: '10px', color: C.subdued, letterSpacing: '0.15em' }}>// MISSION PARAMETERS</span>
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr' }}>
                    {[
                        {
                            icon: <Cpu size={18} />,
                            label: 'THE PROBLEM',
                            tag: '[ IDENTIFIED ]',
                            tagColor: C.danger,
                            desc: 'AI writes the code, but developers copy/paste it without realizing the security implications or architectural flaws. The gap between "it works" and "it\'s secure" has never been wider.',
                        },
                        {
                            icon: <Shield size={18} />,
                            label: 'THE SOLUTION',
                            tag: '[ ACTIVE ]',
                            tagColor: C.accent,
                            desc: 'Soteria acts as an educational firewall. It catches vulnerabilities early and explains them in plain English — so developers learn while they ship.',
                        },
                    ].map((item, i) => (
                        <motion.div
                            key={item.label}
                            initial={{ opacity: 0, y: 10 }}
                            whileInView={{ opacity: 1, y: 0 }}
                            viewport={{ once: true }}
                            transition={{ duration: 0.4, delay: i * 0.1 }}
                            style={{
                                borderRight: i === 0 ? `1px solid ${C.border}` : 'none',
                                padding: '32px 48px',
                            }}
                        >
                            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '20px' }}>
                                <div style={{ color: item.tagColor }}>{item.icon}</div>
                                <span style={{ fontSize: '10px', color: item.tagColor, fontWeight: 700, letterSpacing: '0.1em' }}>{item.tag}</span>
                            </div>
                            <h3 style={{ fontSize: '16px', fontWeight: 900, color: C.text, textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: '14px' }}>{item.label}</h3>
                            <p style={{ fontSize: '12px', color: C.subdued, lineHeight: 1.8, margin: 0 }}>{item.desc}</p>
                        </motion.div>
                    ))}
                </div>
            </section>

            {/* ─── STACK INFO ─── */}
            <section style={{ borderBottom: `1px solid ${C.border}` }}>
                <div style={{ borderBottom: `1px solid ${C.border}`, padding: '0 48px', height: '36px', display: 'flex', alignItems: 'center' }}>
                    <span style={{ fontSize: '10px', color: C.subdued, letterSpacing: '0.15em' }}>// TECHNICAL STACK — KYBER ENGINE</span>
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
                    <Link to="/about" style={{ color: C.accent, textDecoration: 'none', fontSize: '11px', fontWeight: 700 }}>ABOUT THE CREATOR</Link>
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
