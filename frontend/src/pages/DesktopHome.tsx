import { useState, useEffect, useRef } from 'react';
import { useNavigate, Link, useLocation } from 'react-router-dom';
import { motion, useAnimationFrame, AnimatePresence } from 'framer-motion';
import {
    Activity, Brain, AlertTriangle, ShieldCheck,
    Download, Bell, BellOff, Check, GitCompare,
    ArrowRight, X, ScanSearch, Layers, LogOut, Settings,
    ChevronRight, Zap, TrendingUp, TrendingDown, Minus
} from 'lucide-react';
import { useGame } from '@/context/GameContext';
import { useAuth } from '@/context/AuthContext';
import { API_BASE_URL } from '@/lib/api';

interface SecurityScoreData {
    score: number;
    grade: string;
    total_scans: number;
    threats: number;
    clean: number;
    languages: Record<string, number>;
    risk_distribution: Record<string, number>;
    daily_trend: { day: string; total: number; threats: number; avg_confidence: number }[];
    recent_scans?: { id: number; timestamp: string; language: string; risk_level: string; confidence: number; malicious: number; reason: string }[];
}

// ── Animated radar sweep ──────────────────────────────────────────────────────
function RadarSweep({ color }: { color: string }) {
    const ref = useRef<SVGGElement>(null);
    const angle = useRef(0);
    useAnimationFrame((_, delta) => {
        angle.current = (angle.current + delta * 0.035) % 360;
        if (ref.current) ref.current.style.transform = `rotate(${angle.current}deg)`;
    });
    return (
        <g ref={ref} style={{ transformOrigin: '140px 140px' }}>
            <defs>
                <radialGradient id="sweepGrad" cx="100%" cy="50%" r="100%">
                    <stop offset="0%" stopColor={color} stopOpacity="0.7" />
                    <stop offset="60%" stopColor={color} stopOpacity="0.15" />
                    <stop offset="100%" stopColor={color} stopOpacity="0" />
                </radialGradient>
            </defs>
            <path d="M140,140 L280,140 A140,140 0 0,1 140,140" fill="url(#sweepGrad)" />
            <line x1="140" y1="140" x2="280" y2="140" stroke={color} strokeWidth="1.5" opacity="0.9"
                style={{ filter: `drop-shadow(0 0 4px ${color})` }} />
        </g>
    );
}

// ── Sparkline ─────────────────────────────────────────────────────────────────
function Spark({ data, color = '#6366f1', filled = false }: { data: number[]; color?: string; filled?: boolean }) {
    if (data.length < 2) return <div className="w-20 h-6" />;
    const max = Math.max(...data, 1);
    const W = 80, H = 28;
    const pts = data.map((v, i) => `${(i / (data.length - 1)) * W},${H - (v / max) * (H - 2) - 1}`).join(' ');
    const fillPts = `0,${H} ${pts} ${W},${H}`;
    return (
        <svg viewBox={`0 0 ${W} ${H}`} className="w-20 h-7" style={{ overflow: 'visible' }}>
            {filled && <polygon points={fillPts} fill={color} opacity="0.08" />}
            <polyline points={pts} fill="none" stroke={color} strokeWidth="1.5"
                strokeLinecap="round" strokeLinejoin="round" />
        </svg>
    );
}

// ── Horizontal bar ────────────────────────────────────────────────────────────
function MiniBar({ value, max, color }: { value: number; max: number; color: string }) {
    const pct = max > 0 ? Math.round((value / max) * 100) : 0;
    return (
        <div className="flex items-center gap-2 w-full">
            <div className="flex-1 h-1 rounded-full bg-white/[0.06] overflow-hidden">
                <motion.div className="h-full rounded-full" style={{ background: color }}
                    initial={{ width: 0 }} animate={{ width: `${pct}%` }} transition={{ duration: 1, ease: 'easeOut' }} />
            </div>
            <span className="text-[9px] font-mono text-neutral-600 w-6 text-right">{value}</span>
        </div>
    );
}

// ── Main ──────────────────────────────────────────────────────────────────────
export default function DesktopHome() {
    const navigate = useNavigate();
    const { key: locationKey } = useLocation();
    const { xp, level, streak } = useGame();
    const { token, user, logout } = useAuth();
    const [scoreData, setScoreData] = useState<SecurityScoreData | null>(null);
    const [loading, setLoading] = useState(true);
    const [showSettings, setShowSettings] = useState(false);
    const [compareIds, setCompareIds] = useState<number[]>([]);
    const [compareResult, setCompareResult] = useState<any>(null);
    const [compareLoading, setCompareLoading] = useState(false);
    const [compareError, setCompareError] = useState<string | null>(null);
    const [webhookUrl, setWebhookUrl] = useState('');
    const [webhookSaved, setWebhookSaved] = useState(false);

    const riskColor = (r: string) =>
        r === 'CRITICAL' ? '#ef4444' : r === 'HIGH' ? '#f97316' : r === 'MEDIUM' ? '#f59e0b' : '#10b981';
    const riskBadge = (r: string) =>
        r === 'CRITICAL' ? 'bg-red-500/15 text-red-400 border border-red-500/20' :
        r === 'HIGH'     ? 'bg-orange-500/15 text-orange-400 border border-orange-500/20' :
        r === 'MEDIUM'   ? 'bg-yellow-500/15 text-yellow-400 border border-yellow-500/20' :
                           'bg-emerald-500/15 text-emerald-400 border border-emerald-500/20';

    const toggleCompare = (id: number) => {
        setCompareResult(null); setCompareError(null);
        setCompareIds(p => p.includes(id) ? p.filter(x => x !== id) : p.length >= 2 ? [p[1], id] : [...p, id]);
    };

    const handleCompare = async () => {
        if (compareIds.length !== 2 || !token) return;
        setCompareLoading(true); setCompareResult(null); setCompareError(null);
        try {
            const res = await fetch(`${API_BASE_URL}/api/scan-history/compare?id1=${compareIds[0]}&id2=${compareIds[1]}`,
                { headers: { Authorization: `Bearer ${token}` } });
            const data = await res.json();
            res.ok ? setCompareResult(data) : setCompareError(data.error || 'Compare failed');
        } catch { setCompareError('Network error'); }
        finally { setCompareLoading(false); }
    };

    const handleExportCSV = async () => {
        if (!token) return;
        const res = await fetch(`${API_BASE_URL}/api/scan-history/export`, { headers: { Authorization: `Bearer ${token}` } });
        if (!res.ok) return;
        const blob = await res.blob();
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a'); a.href = url;
        a.download = `soteria_scans_${new Date().toISOString().slice(0, 10)}.csv`; a.click();
        URL.revokeObjectURL(url);
    };

    useEffect(() => {
        if (!token) return;
        fetch(`${API_BASE_URL}/api/settings/webhook`, { headers: { Authorization: `Bearer ${token}` } })
            .then(r => r.json()).then(d => setWebhookUrl(d.webhook_url || '')).catch(() => {});
    }, [token]);

    const handleSaveWebhook = async () => {
        if (!token) return;
        await fetch(`${API_BASE_URL}/api/settings/webhook`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
            body: JSON.stringify({ webhook_url: webhookUrl }),
        });
        setWebhookSaved(true);
        setTimeout(() => setWebhookSaved(false), 2000);
    };

    useEffect(() => {
        const timeout = setTimeout(() => setLoading(false), 5000);
        (async () => {
            try {
                const headers: Record<string, string> = { 'Content-Type': 'application/json' };
                if (token) headers['Authorization'] = `Bearer ${token}`;
                const res = await fetch(`${API_BASE_URL}/security-score`, { headers });
                if (res.ok) setScoreData(await res.json());
            } catch {}
            finally { setLoading(false); clearTimeout(timeout); }
        })();
        return () => clearTimeout(timeout);
    }, [token, locationKey]);

    const gradeColor: Record<string, string> = {
        A: '#10b981', B: '#6366f1', C: '#f59e0b', D: '#f97316', F: '#ef4444'
    };
    const accentColor = gradeColor[scoreData?.grade ?? ''] ?? '#334155';
    const cleanRate = scoreData && scoreData.total_scans > 0
        ? Math.round((scoreData.clean / scoreData.total_scans) * 100) : 0;
    const circumference = 2 * Math.PI * 140;
    const hour = new Date().getHours();
    const greeting = hour < 12 ? 'Morning' : hour < 17 ? 'Afternoon' : 'Evening';
    const maxRisk = Math.max(...Object.values(scoreData?.risk_distribution ?? {}), 1);

    const threatTrend = (() => {
        const trend = scoreData?.daily_trend ?? [];
        if (trend.length < 2) return null;
        const last = trend[trend.length - 1].threats;
        const prev = trend[trend.length - 2].threats;
        if (last > prev) return 'up';
        if (last < prev) return 'down';
        return 'flat';
    })();

    return (
        <div className="min-h-screen bg-[#050505] text-white overflow-hidden flex flex-col select-none"
            style={{ fontFamily: "'IBM Plex Mono', monospace" }}>

            {/* ── Background: grid + noise ── */}
            <div className="fixed inset-0 pointer-events-none" style={{
                backgroundImage: `
                    linear-gradient(rgba(255,255,255,0.03) 1px, transparent 1px),
                    linear-gradient(90deg, rgba(255,255,255,0.03) 1px, transparent 1px)`,
                backgroundSize: '56px 56px',
            }} />

            {/* ── Ambient colour glows ── */}
            <div className="fixed inset-0 pointer-events-none overflow-hidden">
                <div className="absolute -top-[20%] left-[15%] w-[600px] h-[600px] rounded-full opacity-60"
                    style={{ background: `radial-gradient(circle, ${accentColor}0f 0%, transparent 65%)`, transition: 'background 1.5s' }} />
                <div className="absolute top-[30%] right-[-5%] w-[400px] h-[400px] rounded-full opacity-40"
                    style={{ background: 'radial-gradient(circle, #6366f10a 0%, transparent 70%)' }} />
                <div className="absolute bottom-[-10%] left-[35%] w-[500px] h-[300px] rounded-full opacity-30"
                    style={{ background: 'radial-gradient(circle, #8b5cf60a 0%, transparent 70%)' }} />
            </div>

            {/* ══ TOP NAV ══════════════════════════════════════════════════════ */}
            <header className="relative z-20 flex items-center justify-between px-8 h-14 border-b border-white/[0.08]"
                style={{ background: 'linear-gradient(180deg, rgba(255,255,255,0.03) 0%, transparent 100%)' }}>
                <div className="flex items-center gap-8">
                    <Link to="/dashboard" className="flex items-center gap-3">
                        <img src="/soteria-logo.png" alt="Soteria" className="w-8 h-8 rounded-xl object-cover" />
                        <span className="text-sm font-bold tracking-[0.18em] text-white">SOTERIA</span>
                    </Link>
                    <nav className="hidden md:flex items-center gap-0.5">
                        {[
                            { to: '/dashboard', label: 'Overview', active: true },
                            { to: '/scanner',   label: 'Scanner' },
                            { to: '/batch',     label: 'Batch' },
                            { to: '/engine',    label: 'Model Lab' },
                        ].map(({ to, label, active }) => (
                            <Link key={to} to={to}
                                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                                    active
                                        ? 'bg-white/[0.09] text-white border border-white/[0.12]'
                                        : 'text-neutral-500 hover:text-neutral-200 hover:bg-white/[0.05]'
                                }`}>
                                {label}
                            </Link>
                        ))}
                    </nav>
                </div>
                <div className="flex items-center gap-2">
                    <span className="text-[11px] text-neutral-600 hidden lg:block mr-1">
                        {greeting}, {user?.name?.split(' ')[0] ?? 'there'}
                    </span>
                    <button onClick={() => navigate('/scanner')}
                        className="flex items-center gap-2 px-4 py-2 text-xs font-bold text-black bg-white hover:bg-neutral-100 rounded-lg transition-all">
                        <ScanSearch className="w-3.5 h-3.5" />
                        New Scan
                    </button>
                    <button onClick={() => setShowSettings(s => !s)}
                        className={`p-2 rounded-lg transition-all ${showSettings
                            ? 'bg-white/[0.09] text-white border border-white/[0.12]'
                            : 'text-neutral-600 hover:text-white hover:bg-white/[0.05]'}`}>
                        <Settings className="w-4 h-4" />
                    </button>
                    <button onClick={() => { logout(); navigate('/'); }}
                        className="p-2 rounded-lg text-neutral-700 hover:text-red-400 hover:bg-red-500/10 transition-all">
                        <LogOut className="w-4 h-4" />
                    </button>
                </div>
            </header>

            {/* ── Settings drawer ── */}
            <AnimatePresence>
                {showSettings && (
                    <motion.div initial={{ opacity: 0, y: -6, scaleY: 0.96 }} animate={{ opacity: 1, y: 0, scaleY: 1 }}
                        exit={{ opacity: 0, y: -6, scaleY: 0.96 }} transition={{ duration: 0.15 }}
                        className="relative z-10 mx-6 mt-2 p-4 rounded-2xl border border-white/[0.10] backdrop-blur-2xl"
                        style={{ background: 'rgba(10,10,12,0.9)' }}>
                        <div className="flex items-center gap-2 mb-3">
                            {webhookUrl ? <Bell className="w-3.5 h-3.5 text-violet-400" /> : <BellOff className="w-3.5 h-3.5 text-neutral-600" />}
                            <span className="text-[10px] font-bold text-neutral-400 tracking-widest">THREAT WEBHOOK</span>
                            <span className="ml-auto text-[10px] text-neutral-700">fires on every malicious verdict</span>
                        </div>
                        <div className="flex gap-2">
                            <input type="url" value={webhookUrl} onChange={e => setWebhookUrl(e.target.value)}
                                placeholder="https://hooks.slack.com/…"
                                className="flex-1 bg-black/50 border border-white/[0.08] rounded-lg px-3 py-2 text-xs text-white placeholder-neutral-700 focus:outline-none focus:border-violet-500/50 transition-colors" />
                            <button onClick={handleSaveWebhook}
                                className="flex items-center gap-1.5 px-4 py-2 text-xs font-bold text-violet-400 bg-violet-500/10 hover:bg-violet-500/20 border border-violet-500/20 rounded-lg transition-all">
                                {webhookSaved ? <><Check className="w-3 h-3" /> Saved</> : 'Save'}
                            </button>
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>

            {/* ══ MAIN 3-PANEL GRID ════════════════════════════════════════════ */}
            <main className="relative z-10 flex-1 grid grid-cols-1 lg:grid-cols-12 overflow-hidden">

                {/* ═══════════════════════════════════════════════════════
                    LEFT — RADAR + SCORE
                ═══════════════════════════════════════════════════════ */}
                <div className="lg:col-span-4 flex flex-col border-r border-white/[0.08]"
                    style={{ background: 'linear-gradient(180deg, rgba(255,255,255,0.012) 0%, transparent 60%)' }}>

                    {/* Panel accent top bar */}
                    <div className="h-px w-full" style={{
                        background: `linear-gradient(90deg, transparent 0%, ${accentColor}60 40%, ${accentColor}60 60%, transparent 100%)`,
                        transition: 'background 1s'
                    }} />

                    {/* Radar area */}
                    <div className="flex-1 flex flex-col items-center justify-center px-6 py-8 gap-6">

                        {/* Radar SVG */}
                        <div className="relative" style={{ filter: `drop-shadow(0 0 40px ${accentColor}20)` }}>
                            <svg width="280" height="280" viewBox="0 0 280 280">
                                {/* Faint radial fill */}
                                <radialGradient id="radarBg" cx="50%" cy="50%" r="50%">
                                    <stop offset="0%" stopColor={accentColor} stopOpacity="0.04" />
                                    <stop offset="100%" stopColor={accentColor} stopOpacity="0" />
                                </radialGradient>
                                <circle cx="140" cy="140" r="138" fill="url(#radarBg)" />

                                {/* Grid rings */}
                                {[120, 90, 60, 30].map((r, i) => (
                                    <circle key={r} cx="140" cy="140" r={r} fill="none"
                                        stroke={i === 0 ? 'rgba(255,255,255,0.07)' : 'rgba(255,255,255,0.04)'}
                                        strokeWidth={i === 0 ? 1 : 0.75}
                                        strokeDasharray={i % 2 === 0 ? undefined : '3 5'} />
                                ))}

                                {/* Diagonal guides */}
                                {[45, 135].map(a => {
                                    const rad = (a * Math.PI) / 180;
                                    return <line key={a}
                                        x1={140 + 130 * Math.cos(rad)} y1={140 + 130 * Math.sin(rad)}
                                        x2={140 - 130 * Math.cos(rad)} y2={140 - 130 * Math.sin(rad)}
                                        stroke="rgba(255,255,255,0.03)" strokeWidth="0.75" />;
                                })}
                                <line x1="10" y1="140" x2="270" y2="140" stroke="rgba(255,255,255,0.04)" strokeWidth="0.75" />
                                <line x1="140" y1="10" x2="140" y2="270" stroke="rgba(255,255,255,0.04)" strokeWidth="0.75" />

                                {/* Outer score ring (track) */}
                                <circle cx="140" cy="140" r="130" fill="none" stroke="rgba(255,255,255,0.06)" strokeWidth="2" />
                                {/* Outer score ring (fill) */}
                                <circle cx="140" cy="140" r="130" fill="none"
                                    stroke={accentColor} strokeWidth="2.5" strokeLinecap="round"
                                    strokeDasharray={circumference}
                                    strokeDashoffset={circumference - ((scoreData?.score ?? 0) / 100) * circumference}
                                    transform="rotate(-90 140 140)"
                                    style={{ filter: `drop-shadow(0 0 8px ${accentColor})`, transition: 'all 1.4s cubic-bezier(0.4,0,0.2,1)' }} />

                                {/* Sweep */}
                                {!loading && <RadarSweep color={accentColor} />}

                                {/* Engine nodes */}
                                {[
                                    { angle: 45,  label: 'SK',  active: !loading },
                                    { angle: 135, label: 'GCN', active: false },
                                    { angle: 225, label: 'ENT', active: !loading },
                                    { angle: 315, label: 'SNN', active: false },
                                ].map(({ angle, label, active }) => {
                                    const rad = (angle * Math.PI) / 180;
                                    const x = 140 + 130 * Math.cos(rad);
                                    const y = 140 + 130 * Math.sin(rad);
                                    return (
                                        <g key={label}>
                                            <circle cx={x} cy={y} r="11"
                                                fill={active ? `${accentColor}22` : 'rgba(15,15,20,0.9)'}
                                                stroke={active ? accentColor : 'rgba(255,255,255,0.1)'} strokeWidth="1" />
                                            {active && (
                                                <circle cx={x} cy={y} r="16" fill="none" stroke={accentColor} strokeWidth="0.5" opacity="0.3">
                                                    <animate attributeName="r" values="11;20;11" dur="2.8s" repeatCount="indefinite" />
                                                    <animate attributeName="opacity" values="0.3;0;0.3" dur="2.8s" repeatCount="indefinite" />
                                                </circle>
                                            )}
                                            <text x={x} y={y + 0.5} textAnchor="middle" dominantBaseline="central"
                                                fill={active ? accentColor : 'rgba(100,116,139,1)'} fontSize="5.5" fontWeight="700"
                                                fontFamily="IBM Plex Mono">{label}</text>
                                        </g>
                                    );
                                })}

                                {/* Threat blips */}
                                {(scoreData?.threats ?? 0) > 0 && (
                                    <>
                                        <circle cx="195" cy="115" r="3.5" fill="#ef4444" opacity="0.9">
                                            <animate attributeName="opacity" values="0.9;0.2;0.9" dur="2.2s" repeatCount="indefinite" />
                                        </circle>
                                        <circle cx="105" cy="185" r="2.5" fill="#f97316" opacity="0.7">
                                            <animate attributeName="opacity" values="0.7;0.15;0.7" dur="1.8s" repeatCount="indefinite" />
                                        </circle>
                                    </>
                                )}

                                {/* Center disc */}
                                <circle cx="140" cy="140" r="48" fill="#050505" />
                                <circle cx="140" cy="140" r="48" fill="none" stroke="rgba(255,255,255,0.06)" strokeWidth="1" />
                                <circle cx="140" cy="140" r="44" fill={`${accentColor}08`} style={{ transition: 'fill 1s' }} />

                                {/* Grade */}
                                {loading ? (
                                    <circle cx="140" cy="140" r="18" fill="none" stroke="rgba(255,255,255,0.08)" strokeWidth="1.5">
                                        <animateTransform attributeName="transform" type="rotate"
                                            from="0 140 140" to="360 140 140" dur="1.2s" repeatCount="indefinite" />
                                    </circle>
                                ) : (
                                    <>
                                        <text x="140" y="137" textAnchor="middle" dominantBaseline="central"
                                            fill={accentColor} fontSize="34" fontWeight="900" fontFamily="IBM Plex Mono"
                                            style={{ filter: `drop-shadow(0 0 20px ${accentColor}80)`, transition: 'fill 1s' }}>
                                            {scoreData?.grade ?? '—'}
                                        </text>
                                        <text x="140" y="162" textAnchor="middle" dominantBaseline="central"
                                            fill="rgba(100,116,139,0.9)" fontSize="8" fontWeight="600" fontFamily="IBM Plex Mono">
                                            {scoreData?.score ?? 0}/100
                                        </text>
                                    </>
                                )}
                            </svg>

                            {/* Status badge */}
                            <div className="absolute bottom-3 left-1/2 -translate-x-1/2 flex items-center gap-1.5 px-2.5 py-1 rounded-full border border-white/[0.08]"
                                style={{ background: 'rgba(5,5,5,0.8)', backdropFilter: 'blur(8px)' }}>
                                <div className={`w-1.5 h-1.5 rounded-full ${loading ? 'bg-amber-500 animate-pulse' : 'bg-emerald-400 animate-pulse'}`} />
                                <span className="text-[8px] font-bold text-neutral-500 tracking-widest uppercase">
                                    {loading ? 'Loading' : 'Nominal'}
                                </span>
                            </div>
                        </div>

                        {/* Risk distribution bars */}
                        <div className="w-full max-w-[240px] rounded-xl border border-white/[0.08] p-4"
                            style={{ background: 'rgba(255,255,255,0.02)' }}>
                            <p className="text-[9px] font-bold text-neutral-600 tracking-widest uppercase mb-3">Risk Breakdown</p>
                            <div className="space-y-2.5">
                                {([['CRITICAL', '#ef4444'], ['HIGH', '#f97316'], ['MEDIUM', '#f59e0b'], ['LOW', '#10b981']] as const).map(([r, c]) => (
                                    <div key={r} className="flex items-center gap-2">
                                        <span className="text-[9px] font-bold w-14 text-neutral-600">{r}</span>
                                        <MiniBar value={scoreData?.risk_distribution?.[r] ?? 0} max={maxRisk} color={c} />
                                    </div>
                                ))}
                            </div>
                        </div>
                    </div>
                </div>

                {/* ═══════════════════════════════════════════════════════
                    MIDDLE — INTELLIGENCE
                ═══════════════════════════════════════════════════════ */}
                <div className="lg:col-span-4 flex flex-col border-r border-white/[0.08]">
                    <div className="h-px w-full bg-white/[0.06]" />

                    {/* Panel header */}
                    <div className="px-6 py-3.5 border-b border-white/[0.08] flex items-center justify-between">
                        <span className="text-[9px] font-bold text-neutral-600 tracking-widest uppercase">Security Intelligence</span>
                        <div className="flex items-center gap-1.5">
                            <div className="w-1 h-1 rounded-full bg-emerald-500 animate-pulse" />
                            <span className="text-[9px] text-neutral-700">Live</span>
                        </div>
                    </div>

                    {/* Stat cells */}
                    <div className="flex flex-col divide-y divide-white/[0.06]">

                        {/* Total scans */}
                        <div className="px-6 py-5 hover:bg-white/[0.015] transition-colors">
                            <div className="flex items-start justify-between mb-3">
                                <span className="text-[9px] font-bold text-neutral-600 tracking-widest uppercase">Total Scans</span>
                                <Spark data={scoreData?.daily_trend?.map(d => d.total) ?? []} color="#6366f1" filled />
                            </div>
                            <div className="flex items-end gap-3">
                                <span className="text-[42px] font-black leading-none"
                                    style={{ color: '#6366f1', fontVariantNumeric: 'tabular-nums', textShadow: '0 0 40px #6366f140' }}>
                                    {loading ? '—' : (scoreData?.total_scans ?? 0)}
                                </span>
                                <div className="mb-1.5">
                                    <div className="flex items-center gap-1 text-[10px]">
                                        <span className="text-red-400 font-bold">{scoreData?.threats ?? 0}</span>
                                        <span className="text-neutral-700">threats</span>
                                    </div>
                                    <div className="flex items-center gap-1 text-[10px]">
                                        <span className="text-emerald-400 font-bold">{scoreData?.clean ?? 0}</span>
                                        <span className="text-neutral-700">clean</span>
                                    </div>
                                </div>
                                {threatTrend && (
                                    <div className="mb-1.5 ml-auto">
                                        {threatTrend === 'up' ? <TrendingUp className="w-4 h-4 text-red-400" /> :
                                         threatTrend === 'down' ? <TrendingDown className="w-4 h-4 text-emerald-400" /> :
                                         <Minus className="w-4 h-4 text-neutral-600" />}
                                    </div>
                                )}
                            </div>
                        </div>

                        {/* Clean rate */}
                        <div className="px-6 py-5 hover:bg-white/[0.015] transition-colors">
                            <div className="flex items-start justify-between mb-3">
                                <span className="text-[9px] font-bold text-neutral-600 tracking-widest uppercase">Clean Rate</span>
                                <Spark data={scoreData?.daily_trend?.map(d => d.total > 0 ? ((d.total - d.threats) / d.total) * 100 : 0) ?? []} color="#10b981" filled />
                            </div>
                            <div className="flex items-end gap-3 mb-3">
                                <span className="text-[42px] font-black leading-none"
                                    style={{ color: '#10b981', fontVariantNumeric: 'tabular-nums', textShadow: '0 0 40px #10b98140' }}>
                                    {loading ? '—' : `${cleanRate}%`}
                                </span>
                            </div>
                            {/* Clean rate bar */}
                            <div className="h-1 rounded-full bg-white/[0.06] overflow-hidden">
                                <motion.div className="h-full rounded-full bg-emerald-500"
                                    initial={{ width: 0 }} animate={{ width: `${cleanRate}%` }}
                                    transition={{ duration: 1.2, ease: 'easeOut' }} />
                            </div>
                        </div>

                        {/* XP */}
                        <div className="px-6 py-5 hover:bg-white/[0.015] transition-colors">
                            <div className="flex items-start justify-between mb-3">
                                <span className="text-[9px] font-bold text-neutral-600 tracking-widest uppercase">XP · {level}</span>
                                <span className="text-[9px] text-amber-500 font-bold">{streak}d streak</span>
                            </div>
                            <span className="text-[42px] font-black leading-none"
                                style={{ color: '#f59e0b', fontVariantNumeric: 'tabular-nums', textShadow: '0 0 40px #f59e0b40' }}>
                                {xp}
                            </span>
                        </div>
                    </div>

                    {/* Languages */}
                    <div className="px-6 py-4 border-t border-white/[0.08]">
                        <p className="text-[9px] font-bold text-neutral-600 tracking-widest uppercase mb-2.5">Languages Scanned</p>
                        <div className="flex flex-wrap gap-1.5">
                            {scoreData && Object.entries(scoreData.languages).slice(0, 8).map(([lang, count]) => (
                                <span key={lang} className="px-2 py-1 text-[9px] font-bold rounded-md border border-white/[0.10] text-neutral-400 bg-white/[0.03]">
                                    {lang} <span className="text-neutral-600 ml-0.5">{count}</span>
                                </span>
                            ))}
                            {!scoreData && <span className="text-[10px] text-neutral-700">No data yet</span>}
                        </div>
                    </div>

                    {/* Quick nav */}
                    <div className="px-6 py-4 border-t border-white/[0.08] space-y-1.5 mt-auto">
                        {[
                            { to: '/scanner', icon: Activity,  label: 'Code Reviewer', desc: 'Single file analysis', color: '#6366f1' },
                            { to: '/batch',   icon: Layers,    label: 'Batch Scanner',  desc: 'Multi-file upload',  color: '#8b5cf6' },
                            { to: '/engine',  icon: Brain,     label: 'Model Lab',      desc: 'Engine status',      color: '#06b6d4' },
                        ].map(({ to, icon: Icon, label, desc, color: c }) => (
                            <button key={to} onClick={() => navigate(to)}
                                className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl border border-white/[0.07] hover:border-white/[0.15] hover:bg-white/[0.04] transition-all group text-left">
                                <div className="w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0"
                                    style={{ background: `${c}18` }}>
                                    <Icon className="w-3.5 h-3.5" style={{ color: c }} />
                                </div>
                                <div className="flex-1 min-w-0">
                                    <div className="text-[11px] font-bold text-neutral-300 group-hover:text-white transition-colors">{label}</div>
                                    <div className="text-[9px] text-neutral-700 group-hover:text-neutral-500 transition-colors">{desc}</div>
                                </div>
                                <ChevronRight className="w-3.5 h-3.5 text-neutral-700 group-hover:text-neutral-400 transition-all group-hover:translate-x-0.5" />
                            </button>
                        ))}
                    </div>
                </div>

                {/* ═══════════════════════════════════════════════════════
                    RIGHT — LIVE FEED
                ═══════════════════════════════════════════════════════ */}
                <div className="lg:col-span-4 flex flex-col">
                    <div className="h-px w-full bg-white/[0.06]" />

                    {/* Panel header */}
                    <div className="px-6 py-3.5 border-b border-white/[0.08] flex items-center justify-between">
                        <div className="flex items-center gap-2">
                            <div className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                            <span className="text-[9px] font-bold text-neutral-600 tracking-widest uppercase">Live Feed</span>
                            {scoreData?.recent_scans && (
                                <span className="text-[9px] text-neutral-700">
                                    — {scoreData.recent_scans.length} recent
                                </span>
                            )}
                        </div>
                        <div className="flex items-center gap-1">
                            {compareIds.length === 2 && (
                                <button onClick={handleCompare} disabled={compareLoading}
                                    className="flex items-center gap-1.5 text-[9px] font-bold text-violet-400 bg-violet-500/10 border border-violet-500/20 px-2.5 py-1 rounded-lg hover:bg-violet-500/20 transition-all disabled:opacity-40">
                                    <GitCompare className="w-3 h-3" />
                                    {compareLoading ? '…' : 'Compare'}
                                </button>
                            )}
                            {compareIds.length > 0 && (
                                <button onClick={() => { setCompareIds([]); setCompareResult(null); setCompareError(null); }}
                                    className="p-1.5 text-neutral-700 hover:text-white transition-colors rounded-lg hover:bg-white/[0.05]">
                                    <X className="w-3.5 h-3.5" />
                                </button>
                            )}
                            <button onClick={handleExportCSV}
                                className="p-1.5 text-neutral-700 hover:text-white transition-colors rounded-lg hover:bg-white/[0.05]">
                                <Download className="w-3.5 h-3.5" />
                            </button>
                        </div>
                    </div>

                    {/* Compare result */}
                    <AnimatePresence>
                        {(compareResult || compareError) && (
                            <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }}
                                exit={{ opacity: 0, height: 0 }}
                                className={`mx-4 mt-3 rounded-xl border p-3 text-xs overflow-hidden ${
                                    compareError ? 'border-red-500/20 bg-red-500/5 text-red-400' : 'border-violet-500/20 bg-violet-500/5'}`}>
                                {compareError ? compareError : (
                                    <div>
                                        <div className="flex items-center gap-2 text-violet-400 font-bold text-[9px] uppercase tracking-widest mb-2">
                                            <GitCompare className="w-3 h-3" />
                                            #{compareResult.id1} vs #{compareResult.id2}
                                        </div>
                                        <div className="flex items-center gap-2 text-[10px]">
                                            <span className="text-neutral-500">Risk</span>
                                            <span className={`px-1.5 py-0.5 rounded text-[9px] font-bold ${riskBadge(compareResult.risk_level_1)}`}>{compareResult.risk_level_1}</span>
                                            <ArrowRight className="w-3 h-3 text-neutral-700" />
                                            <span className={`px-1.5 py-0.5 rounded text-[9px] font-bold ${riskBadge(compareResult.risk_level_2)}`}>{compareResult.risk_level_2}</span>
                                            {!compareResult.risk_changed && <span className="text-neutral-600 ml-1">No change</span>}
                                        </div>
                                    </div>
                                )}
                            </motion.div>
                        )}
                    </AnimatePresence>

                    {/* Feed */}
                    <div className="flex-1 overflow-y-auto">
                        {loading ? (
                            <div>
                                {[...Array(7)].map((_, i) => (
                                    <div key={i} className="px-6 py-4 border-b border-white/[0.05] animate-pulse flex gap-3">
                                        <div className="w-1 h-8 rounded-full bg-neutral-800 flex-shrink-0 mt-0.5" />
                                        <div className="flex-1 space-y-2">
                                            <div className="h-2 bg-neutral-800 rounded w-20" />
                                            <div className="h-2 bg-neutral-900 rounded w-32" />
                                        </div>
                                        <div className="h-2 bg-neutral-900 rounded w-10" />
                                    </div>
                                ))}
                            </div>
                        ) : scoreData?.recent_scans && scoreData.recent_scans.length > 0 ? (
                            scoreData.recent_scans.map((scan, i) => {
                                const sel = compareIds.includes(scan.id);
                                const rc = riskColor(scan.risk_level);
                                return (
                                    <motion.div key={scan.id || i}
                                        initial={{ opacity: 0, x: 12 }} animate={{ opacity: 1, x: 0 }}
                                        transition={{ delay: i * 0.035, ease: 'easeOut' }}
                                        onClick={() => toggleCompare(scan.id)}
                                        className={`flex gap-3 px-5 py-3.5 border-b border-white/[0.05] hover:bg-white/[0.025] transition-colors cursor-pointer ${
                                            sel ? 'bg-violet-500/5' : ''}`}>

                                        {/* Risk color bar */}
                                        <div className="w-0.5 rounded-full flex-shrink-0 self-stretch my-0.5"
                                            style={{ background: rc, boxShadow: `0 0 6px ${rc}80` }} />

                                        <div className="flex-1 min-w-0">
                                            <div className="flex items-center gap-1.5 mb-1">
                                                {scan.malicious ? (
                                                    <AlertTriangle className="w-3 h-3 text-red-400 flex-shrink-0" />
                                                ) : (
                                                    <ShieldCheck className="w-3 h-3 text-emerald-400 flex-shrink-0" />
                                                )}
                                                <span className={`text-[11px] font-bold ${scan.malicious ? 'text-red-400' : 'text-emerald-400'}`}>
                                                    {scan.malicious ? 'Threat detected' : 'Clean'}
                                                </span>
                                                <span className="text-[9px] text-neutral-700">·</span>
                                                <span className="text-[9px] font-bold text-neutral-500 uppercase">{scan.language}</span>
                                            </div>
                                            <div className="flex items-center gap-2">
                                                <span className={`text-[8px] font-bold px-1.5 py-0.5 rounded ${riskBadge(scan.risk_level)}`}>
                                                    {scan.risk_level}
                                                </span>
                                                <div className="flex-1 h-0.5 rounded-full bg-white/[0.05] overflow-hidden">
                                                    <div className="h-full rounded-full" style={{ width: `${scan.confidence}%`, background: rc, opacity: 0.6 }} />
                                                </div>
                                                <span className="text-[9px] text-neutral-600">{scan.confidence}%</span>
                                            </div>
                                        </div>

                                        <div className="text-right flex-shrink-0 flex flex-col justify-center gap-0.5">
                                            <div className="text-[9px] font-mono text-neutral-500">
                                                {new Date(scan.timestamp).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}
                                            </div>
                                            <div className="text-[9px] font-mono text-neutral-700">
                                                {new Date(scan.timestamp).toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' })}
                                            </div>
                                        </div>
                                    </motion.div>
                                );
                            })
                        ) : (
                            <div className="flex flex-col items-center justify-center h-full py-24 px-8 text-center">
                                <div className="w-14 h-14 rounded-2xl border border-dashed border-white/[0.10] flex items-center justify-center mb-5"
                                    style={{ background: 'rgba(255,255,255,0.02)' }}>
                                    <Zap className="w-6 h-6 text-neutral-700" />
                                </div>
                                <p className="text-xs font-bold text-neutral-500 mb-1 tracking-widest uppercase">No scans yet</p>
                                <p className="text-[11px] text-neutral-700 mb-5 leading-relaxed">
                                    Run your first scan to start<br />seeing results here.
                                </p>
                                <button onClick={() => navigate('/scanner')}
                                    className="flex items-center gap-2 text-xs font-bold text-white bg-white/[0.08] hover:bg-white/[0.12] border border-white/[0.10] px-4 py-2 rounded-lg transition-all">
                                    <ScanSearch className="w-3.5 h-3.5" />
                                    Start Scanning
                                </button>
                            </div>
                        )}
                    </div>
                </div>

            </main>
        </div>
    );
}
