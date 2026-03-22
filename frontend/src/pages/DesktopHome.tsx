import { useState, useEffect, useRef } from 'react';
import { useNavigate, Link, useLocation } from 'react-router-dom';
import { motion, useAnimationFrame, AnimatePresence } from 'framer-motion';
import {
    Activity, Brain, AlertTriangle, ShieldCheck, Download,
    Bell, BellOff, Check, GitCompare, ArrowRight, X,
    ScanSearch, Layers, LogOut, Settings, ChevronRight,
    Zap, TrendingUp, TrendingDown, Minus, Shield
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

// ── Score arc ─────────────────────────────────────────────────────────────────
function ScoreArc({ score, color, grade }: { score: number; color: string; grade: string }) {
    const r = 54;
    const circ = 2 * Math.PI * r;
    const offset = circ - (score / 100) * circ;
    return (
        <div className="relative flex items-center justify-center w-36 h-36">
            <svg className="absolute inset-0 -rotate-90" width="144" height="144" viewBox="0 0 144 144">
                <circle cx="72" cy="72" r={r} fill="none" stroke="rgba(255,255,255,0.06)" strokeWidth="6" />
                <circle cx="72" cy="72" r={r} fill="none" stroke={color} strokeWidth="6"
                    strokeLinecap="round" strokeDasharray={circ} strokeDashoffset={offset}
                    style={{ filter: `drop-shadow(0 0 8px ${color}80)`, transition: 'stroke-dashoffset 1.4s cubic-bezier(0.4,0,0.2,1)' }} />
            </svg>
            <div className="text-center z-10">
                <div className="text-4xl font-black leading-none" style={{ color, fontFamily: "'IBM Plex Mono', monospace", textShadow: `0 0 30px ${color}60` }}>
                    {grade}
                </div>
                <div className="text-[11px] text-neutral-500 mt-1" style={{ fontFamily: "'IBM Plex Mono', monospace" }}>
                    {score}/100
                </div>
            </div>
        </div>
    );
}

// ── Sparkline ─────────────────────────────────────────────────────────────────
function Spark({ data, color }: { data: number[]; color: string }) {
    if (data.length < 2) return null;
    const max = Math.max(...data, 1);
    const W = 64, H = 20;
    const pts = data.map((v, i) => `${(i / (data.length - 1)) * W},${H - (v / max) * (H - 2) - 1}`).join(' ');
    return (
        <svg viewBox={`0 0 ${W} ${H}`} className="w-16 h-5 opacity-60">
            <polyline points={pts} fill="none" stroke={color} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
    );
}

// ── Card wrapper ──────────────────────────────────────────────────────────────
function Card({ children, className = '', onClick, style }: { children: React.ReactNode; className?: string; onClick?: () => void; style?: React.CSSProperties }) {
    return (
        <div onClick={onClick} style={style}
            className={`rounded-2xl border border-white/[0.07] bg-white/[0.03] backdrop-blur-sm ${onClick ? 'cursor-pointer hover:bg-white/[0.05] hover:border-white/[0.12] transition-all' : ''} ${className}`}>
            {children}
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
        r === 'CRITICAL' ? '#ef4444' : r === 'HIGH' ? '#f97316' : r === 'MEDIUM' ? '#eab308' : '#22c55e';
    const riskBg = (r: string) =>
        r === 'CRITICAL' ? 'bg-red-500/10 text-red-400 border-red-500/20' :
        r === 'HIGH'     ? 'bg-orange-500/10 text-orange-400 border-orange-500/20' :
        r === 'MEDIUM'   ? 'bg-yellow-500/10 text-yellow-400 border-yellow-500/20' :
                           'bg-emerald-500/10 text-emerald-400 border-emerald-500/20';

    const gradeColor: Record<string, string> = {
        A: '#22c55e', B: '#6366f1', C: '#eab308', D: '#f97316', F: '#ef4444'
    };
    const accent = gradeColor[scoreData?.grade ?? ''] ?? '#6366f1';

    const cleanRate = scoreData && scoreData.total_scans > 0
        ? Math.round((scoreData.clean / scoreData.total_scans) * 100) : 0;

    const hour = new Date().getHours();
    const greeting = hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening';

    const threatTrend = (() => {
        const t = scoreData?.daily_trend ?? [];
        if (t.length < 2) return null;
        const d = t[t.length - 1].threats - t[t.length - 2].threats;
        return d > 0 ? 'up' : d < 0 ? 'down' : 'flat';
    })();

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
        const a = document.createElement('a');
        a.href = URL.createObjectURL(blob);
        a.download = `soteria_scans_${new Date().toISOString().slice(0, 10)}.csv`;
        a.click();
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

    return (
        <div className="min-h-screen bg-[#08080c] text-white flex flex-col" style={{ fontFamily: 'Inter, system-ui, sans-serif' }}>

            {/* Subtle ambient glow */}
            <div className="fixed inset-0 pointer-events-none overflow-hidden">
                <div className="absolute top-[-15%] left-[25%] w-[500px] h-[500px] rounded-full opacity-30"
                    style={{ background: `radial-gradient(circle, ${accent}18 0%, transparent 65%)`, transition: 'background 2s' }} />
                <div className="absolute bottom-0 right-[20%] w-[350px] h-[350px] rounded-full opacity-20"
                    style={{ background: 'radial-gradient(circle, #6366f115 0%, transparent 70%)' }} />
            </div>

            {/* ── NAV ── */}
            <header className="relative z-20 flex items-center justify-between px-8 h-14 border-b border-white/[0.06]">
                <div className="flex items-center gap-7">
                    <Link to="/dashboard" className="flex items-center gap-2.5">
                        <img src="/soteria-logo.png" alt="Soteria" className="w-7 h-7 rounded-lg object-cover" />
                        <span className="text-sm font-bold tracking-[0.16em]">SOTERIA</span>
                    </Link>
                    <nav className="hidden md:flex items-center gap-0.5">
                        {[
                            { to: '/dashboard', label: 'Overview', active: true },
                            { to: '/scanner',   label: 'Scanner' },
                            { to: '/batch',     label: 'Batch' },
                            { to: '/engine',    label: 'Model Lab' },
                        ].map(({ to, label, active }) => (
                            <Link key={to} to={to}
                                className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                                    active ? 'bg-white/[0.08] text-white' : 'text-neutral-500 hover:text-white hover:bg-white/[0.05]'
                                }`}>
                                {label}
                            </Link>
                        ))}
                    </nav>
                </div>
                <div className="flex items-center gap-2">
                    <span className="text-xs text-neutral-600 hidden lg:block mr-1">
                        {greeting}, {user?.name?.split(' ')[0] ?? 'there'}
                    </span>
                    <button onClick={() => navigate('/scanner')}
                        className="flex items-center gap-2 px-4 py-2 text-xs font-semibold text-black bg-white hover:bg-neutral-100 rounded-lg transition-all">
                        <ScanSearch className="w-3.5 h-3.5" />
                        New Scan
                    </button>
                    <button onClick={() => setShowSettings(s => !s)}
                        className={`p-2 rounded-lg transition-all ${showSettings ? 'bg-white/[0.08] text-white' : 'text-neutral-600 hover:text-white hover:bg-white/[0.05]'}`}>
                        <Settings className="w-4 h-4" />
                    </button>
                    <button onClick={() => { logout(); navigate('/'); }}
                        className="p-2 rounded-lg text-neutral-700 hover:text-red-400 transition-all">
                        <LogOut className="w-4 h-4" />
                    </button>
                </div>
            </header>

            {/* Settings drawer */}
            <AnimatePresence>
                {showSettings && (
                    <motion.div initial={{ opacity: 0, y: -6 }} animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -6 }} transition={{ duration: 0.15 }}
                        className="relative z-10 mx-6 mt-2 p-4 rounded-2xl border border-white/[0.08] bg-[#0e0e14]">
                        <div className="flex items-center gap-2 mb-3">
                            {webhookUrl ? <Bell className="w-3.5 h-3.5 text-violet-400" /> : <BellOff className="w-3.5 h-3.5 text-neutral-600" />}
                            <span className="text-xs font-semibold text-neutral-400">Threat Webhook</span>
                            <span className="ml-auto text-[11px] text-neutral-700">fires on every malicious verdict</span>
                        </div>
                        <div className="flex gap-2">
                            <input type="url" value={webhookUrl} onChange={e => setWebhookUrl(e.target.value)}
                                placeholder="https://hooks.slack.com/…"
                                className="flex-1 bg-black/40 border border-white/[0.08] rounded-xl px-3 py-2 text-xs text-white placeholder-neutral-700 focus:outline-none focus:border-violet-500/40 transition-colors" />
                            <button onClick={handleSaveWebhook}
                                className="flex items-center gap-1.5 px-4 py-2 text-xs font-semibold text-violet-400 bg-violet-500/10 hover:bg-violet-500/20 border border-violet-500/20 rounded-xl transition-all">
                                {webhookSaved ? <><Check className="w-3 h-3" />Saved</> : 'Save'}
                            </button>
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>

            {/* ══ MAIN CONTENT ════════════════════════════════════════════════ */}
            <main className="relative z-10 flex-1 p-4 sm:p-6 grid grid-cols-12 gap-4 auto-rows-min">

                {/* ── Security Score card ── */}
                <Card className="col-span-12 md:col-span-4 p-6 flex flex-col gap-5">
                    <div className="flex items-start justify-between">
                        <div>
                            <p className="text-xs font-semibold text-neutral-500 uppercase tracking-widest">Security Score</p>
                            <p className="text-xs text-neutral-700 mt-0.5">
                                {loading ? 'Calculating…' : scoreData?.total_scans === 0 ? 'No scans yet' : 'Based on scan history'}
                            </p>
                        </div>
                        <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-white/[0.04] border border-white/[0.06]">
                            <div className={`w-1.5 h-1.5 rounded-full ${loading ? 'bg-amber-500 animate-pulse' : 'bg-emerald-400 animate-pulse'}`} />
                            <span className="text-[10px] font-semibold text-neutral-500">{loading ? 'Loading' : 'Live'}</span>
                        </div>
                    </div>

                    <div className="flex items-center gap-6">
                        {loading ? (
                            <div className="w-36 h-36 rounded-full border-4 border-white/[0.05] animate-pulse" />
                        ) : (
                            <ScoreArc score={scoreData?.score ?? 0} color={accent} grade={scoreData?.grade ?? '—'} />
                        )}
                        <div className="space-y-3 flex-1">
                            {[
                                { label: 'Total Scans', value: scoreData?.total_scans ?? 0, color: '#6366f1' },
                                { label: 'Threats',     value: scoreData?.threats ?? 0,     color: '#ef4444' },
                                { label: 'Clean',       value: scoreData?.clean ?? 0,       color: '#22c55e' },
                            ].map(({ label, value, color }) => (
                                <div key={label}>
                                    <div className="flex justify-between items-center mb-1">
                                        <span className="text-[11px] text-neutral-500">{label}</span>
                                        {loading
                                            ? <div className="h-3 w-6 rounded bg-white/[0.07] animate-pulse" />
                                            : <span className="text-sm font-bold" style={{ color, fontFamily: "'IBM Plex Mono', monospace" }}>{value}</span>
                                        }
                                    </div>
                                    <div className="h-0.5 rounded-full bg-white/[0.05] overflow-hidden">
                                        {loading
                                            ? <div className="h-full rounded-full bg-white/[0.07] animate-pulse w-1/2" />
                                            : <motion.div className="h-full rounded-full"
                                                style={{ background: color }}
                                                initial={{ width: 0 }}
                                                animate={{ width: scoreData?.total_scans ? `${(value / scoreData.total_scans) * 100}%` : '0%' }}
                                                transition={{ duration: 1, ease: 'easeOut' }} />
                                        }
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>

                    {/* Risk pills */}
                    <div className="grid grid-cols-4 gap-2 pt-1 border-t border-white/[0.05]">
                        {(['CRITICAL', 'HIGH', 'MEDIUM', 'LOW'] as const).map(r => (
                            <div key={r} className="text-center">
                                <div className="text-base font-bold mb-0.5" style={{ color: riskColor(r), fontFamily: "'IBM Plex Mono', monospace" }}>
                                    {scoreData?.risk_distribution?.[r] ?? 0}
                                </div>
                                <div className="text-[9px] font-semibold text-neutral-700 uppercase tracking-wider">{r}</div>
                            </div>
                        ))}
                    </div>
                </Card>

                {/* ── Stats column ── */}
                <div className="col-span-12 md:col-span-4 grid sm:grid-cols-3 md:grid-cols-1 md:grid-rows-3 gap-4">

                    {/* Clean Rate */}
                    <Card className="p-5 flex flex-col justify-between">
                        <div className="flex items-center justify-between">
                            <p className="text-xs font-semibold text-neutral-500 uppercase tracking-widest">Clean Rate</p>
                            <Spark data={scoreData?.daily_trend?.map(d => d.total > 0 ? ((d.total - d.threats) / d.total) * 100 : 0) ?? []} color="#22c55e" />
                        </div>
                        <div className="flex items-end gap-3">
                            {loading
                                ? <div className="h-9 w-16 rounded-lg bg-white/[0.07] animate-pulse" />
                                : <span className="text-3xl font-black" style={{ color: '#22c55e', fontFamily: "'IBM Plex Mono', monospace" }}>{cleanRate}%</span>
                            }
                            <div className="mb-1 flex-1">
                                <div className="h-1 rounded-full bg-white/[0.05] overflow-hidden">
                                    {loading
                                        ? <div className="h-full rounded-full bg-white/[0.07] animate-pulse w-2/3" />
                                        : <motion.div className="h-full rounded-full bg-emerald-500"
                                            initial={{ width: 0 }} animate={{ width: `${cleanRate}%` }}
                                            transition={{ duration: 1.2, ease: 'easeOut' }} />
                                    }
                                </div>
                                <p className="text-[10px] text-neutral-600 mt-1">of scans returned clean</p>
                            </div>
                        </div>
                    </Card>

                    {/* XP */}
                    <Card className="p-5 flex flex-col justify-between">
                        <div className="flex items-center justify-between">
                            <p className="text-xs font-semibold text-neutral-500 uppercase tracking-widest">XP · {level}</p>
                            <span className="text-[11px] font-semibold text-amber-500 bg-amber-500/10 px-2 py-0.5 rounded-full border border-amber-500/20">
                                {streak}d streak
                            </span>
                        </div>
                        <span className="text-3xl font-black text-amber-400" style={{ fontFamily: "'IBM Plex Mono', monospace" }}>
                            {xp.toLocaleString()}
                        </span>
                    </Card>

                    {/* Languages */}
                    <Card className="p-5">
                        <p className="text-xs font-semibold text-neutral-500 uppercase tracking-widest mb-3">Languages</p>
                        <div className="flex flex-wrap gap-1.5">
                            {loading ? (
                                [...Array(4)].map((_, i) => (
                                    <div key={i} className="h-5 rounded-lg bg-white/[0.07] animate-pulse" style={{ width: `${48 + i * 12}px` }} />
                                ))
                            ) : scoreData && Object.keys(scoreData.languages).length > 0 ? (
                                Object.entries(scoreData.languages).slice(0, 8).map(([lang, count]) => (
                                    <span key={lang} className="text-[11px] font-medium px-2 py-0.5 rounded-lg bg-white/[0.05] border border-white/[0.08] text-neutral-300">
                                        {lang} <span className="text-neutral-600">{count}</span>
                                    </span>
                                ))
                            ) : (
                                <span className="text-xs text-neutral-700">Scan code to populate</span>
                            )}
                        </div>
                    </Card>
                </div>

                {/* ── Live Feed ── */}
                <Card className="col-span-12 md:col-span-4 flex flex-col overflow-hidden" style={{ maxHeight: 'min(420px, 80vw)' }}>
                    <div className="flex items-center justify-between px-5 py-4 border-b border-white/[0.06]">
                        <div className="flex items-center gap-2">
                            <div className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                            <span className="text-xs font-semibold text-neutral-400">Recent Scans</span>
                        </div>
                        <div className="flex items-center gap-1">
                            {compareIds.length === 2 && (
                                <button onClick={handleCompare} disabled={compareLoading}
                                    className="flex items-center gap-1.5 text-[11px] font-semibold text-violet-400 bg-violet-500/10 border border-violet-500/20 px-2.5 py-1 rounded-lg hover:bg-violet-500/20 transition-all disabled:opacity-40">
                                    <GitCompare className="w-3 h-3" />
                                    {compareLoading ? '…' : 'Compare'}
                                </button>
                            )}
                            {compareIds.length > 0 && (
                                <button onClick={() => { setCompareIds([]); setCompareResult(null); }}
                                    className="p-1.5 text-neutral-600 hover:text-white transition-colors rounded-lg">
                                    <X className="w-3.5 h-3.5" />
                                </button>
                            )}
                            <button onClick={handleExportCSV}
                                className="p-1.5 text-neutral-600 hover:text-white transition-colors rounded-lg">
                                <Download className="w-3.5 h-3.5" />
                            </button>
                        </div>
                    </div>

                    <AnimatePresence>
                        {(compareResult || compareError) && (
                            <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }}
                                exit={{ opacity: 0, height: 0 }}
                                className={`mx-4 mt-3 rounded-xl border p-3 text-xs overflow-hidden ${compareError ? 'border-red-500/20 bg-red-500/5 text-red-400' : 'border-violet-500/20 bg-violet-500/5'}`}>
                                {compareError || (compareResult && (
                                    <div className="flex items-center gap-2">
                                        <span className="text-violet-400 font-semibold">#{compareResult.id1}</span>
                                        <ArrowRight className="w-3 h-3 text-neutral-600" />
                                        <span className="text-violet-400 font-semibold">#{compareResult.id2}</span>
                                        <span className={`px-1.5 py-0.5 rounded text-[10px] font-semibold border ${riskBg(compareResult.risk_level_2)}`}>{compareResult.risk_level_2}</span>
                                        {!compareResult.risk_changed && <span className="text-neutral-600">No change</span>}
                                    </div>
                                ))}
                            </motion.div>
                        )}
                    </AnimatePresence>

                    <div className="flex-1 overflow-y-auto">
                        {loading ? (
                            [...Array(5)].map((_, i) => (
                                <div key={i} className="flex items-center gap-3 px-5 py-3.5 border-b border-white/[0.04] animate-pulse">
                                    <div className="w-2 h-2 rounded-full bg-neutral-800" />
                                    <div className="flex-1 space-y-1.5">
                                        <div className="h-2.5 bg-neutral-800 rounded w-20" />
                                        <div className="h-2 bg-neutral-900 rounded w-32" />
                                    </div>
                                </div>
                            ))
                        ) : scoreData?.recent_scans?.length ? (
                            scoreData.recent_scans.map((scan, i) => {
                                const sel = compareIds.includes(scan.id);
                                const rc = riskColor(scan.risk_level);
                                return (
                                    <motion.div key={scan.id || i}
                                        initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }}
                                        transition={{ delay: i * 0.03 }}
                                        onClick={() => toggleCompare(scan.id)}
                                        className={`flex items-center gap-3 px-5 py-3 border-b border-white/[0.04] hover:bg-white/[0.025] transition-colors cursor-pointer ${sel ? 'bg-violet-500/5' : ''}`}>
                                        <div className="flex-shrink-0">
                                            {scan.malicious
                                                ? <AlertTriangle className="w-3.5 h-3.5 text-red-400" />
                                                : <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />}
                                        </div>
                                        <div className="flex-1 min-w-0">
                                            <div className="flex items-center gap-2">
                                                <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded border ${riskBg(scan.risk_level)}`}>
                                                    {scan.risk_level}
                                                </span>
                                                <span className="text-[11px] text-neutral-500">{scan.language}</span>
                                            </div>
                                            <div className="flex items-center gap-2 mt-1">
                                                <div className="flex-1 h-0.5 rounded-full bg-white/[0.05]">
                                                    <div className="h-full rounded-full opacity-50" style={{ width: `${scan.confidence}%`, background: rc }} />
                                                </div>
                                                <span className="text-[10px] text-neutral-600" style={{ fontFamily: "'IBM Plex Mono', monospace" }}>{scan.confidence}%</span>
                                            </div>
                                        </div>
                                        <div className="text-right flex-shrink-0">
                                            <div className="text-[10px] text-neutral-500">
                                                {new Date(scan.timestamp).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}
                                            </div>
                                            <div className="text-[10px] text-neutral-700">
                                                {new Date(scan.timestamp).toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' })}
                                            </div>
                                        </div>
                                    </motion.div>
                                );
                            })
                        ) : (
                            <div className="flex flex-col items-center justify-center h-full py-12 px-6 text-center">
                                <div className="w-12 h-12 rounded-2xl bg-white/[0.03] border border-white/[0.07] flex items-center justify-center mb-4">
                                    <Shield className="w-5 h-5 text-neutral-700" />
                                </div>
                                <p className="text-sm font-semibold text-neutral-500 mb-1">No scans yet</p>
                                <p className="text-xs text-neutral-700 mb-4">Run a scan to populate your feed</p>
                                <button onClick={() => navigate('/scanner')}
                                    className="flex items-center gap-2 text-xs font-semibold text-white bg-white/[0.07] hover:bg-white/[0.12] border border-white/[0.10] px-4 py-2 rounded-lg transition-all">
                                    <ScanSearch className="w-3.5 h-3.5" />
                                    Start Scanning
                                </button>
                            </div>
                        )}
                    </div>
                </Card>

                {/* ── Quick navigation cards ── */}
                {[
                    { to: '/scanner', icon: Activity,  label: 'Code Reviewer', desc: 'Scan a single file or snippet',  color: '#6366f1', bg: '#6366f118' },
                    { to: '/batch',   icon: Layers,    label: 'Batch Scanner',  desc: 'Upload and scan multiple files', color: '#8b5cf6', bg: '#8b5cf618' },
                    { to: '/engine',  icon: Brain,     label: 'Model Lab',      desc: 'View engine health + metrics',   color: '#06b6d4', bg: '#06b6d418' },
                ].map(({ to, icon: Icon, label, desc, color, bg }) => (
                    <Card key={to} onClick={() => navigate(to)}
                        className="col-span-12 sm:col-span-6 md:col-span-4 p-5 flex items-center gap-4">
                        <div className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0" style={{ background: bg }}>
                            <Icon className="w-5 h-5" style={{ color }} />
                        </div>
                        <div className="flex-1 min-w-0">
                            <p className="text-sm font-semibold text-white">{label}</p>
                            <p className="text-xs text-neutral-500 mt-0.5">{desc}</p>
                        </div>
                        <ChevronRight className="w-4 h-4 text-neutral-700 flex-shrink-0" />
                    </Card>
                ))}

            </main>
        </div>
    );
}
