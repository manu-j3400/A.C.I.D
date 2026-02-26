import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Activity, Brain, Shield, Globe, Clock, Zap, AlertTriangle, ShieldCheck, ScanSearch, TrendingUp, BarChart3, FileCode2 } from 'lucide-react';
import { useGame } from '@/context/GameContext';
import { useAdmin } from '@/context/AdminContext';
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

// --- SVG CHART COMPONENTS ---

function TrendChart({ data }: { data: SecurityScoreData['daily_trend'] }) {
    if (!data || data.length < 2) return (
        <div className="w-full h-full flex items-center justify-center text-neutral-700 text-sm">
            Need more scan data to show trends
        </div>
    );

    const maxTotal = Math.max(...data.map(d => d.total), 1);
    const width = 500;
    const height = 140;
    const padding = 20;
    const chartW = width - padding * 2;
    const chartH = height - padding * 2;

    const points = data.map((d, i) => ({
        x: padding + (i / (data.length - 1)) * chartW,
        y: padding + chartH - (d.total / maxTotal) * chartH,
        threatY: padding + chartH - (d.threats / maxTotal) * chartH,
    }));

    const totalLine = points.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x} ${p.y}`).join(' ');
    const threatLine = points.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x} ${p.threatY}`).join(' ');
    const areaPath = `${totalLine} L ${points[points.length - 1].x} ${padding + chartH} L ${points[0].x} ${padding + chartH} Z`;

    return (
        <svg viewBox={`0 0 ${width} ${height}`} className="w-full h-full">
            <defs>
                <linearGradient id="areaGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#3b82f6" stopOpacity="0.3" />
                    <stop offset="100%" stopColor="#3b82f6" stopOpacity="0" />
                </linearGradient>
            </defs>
            {/* Grid lines */}
            {[0, 0.25, 0.5, 0.75, 1].map((r, i) => (
                <line key={i} x1={padding} y1={padding + chartH * (1 - r)} x2={padding + chartW} y2={padding + chartH * (1 - r)} stroke="#1e293b" strokeWidth="0.5" />
            ))}
            {/* Area fill */}
            <path d={areaPath} fill="url(#areaGrad)" />
            {/* Total line */}
            <path d={totalLine} fill="none" stroke="#3b82f6" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
            {/* Threat line */}
            {data.some(d => d.threats > 0) && (
                <path d={threatLine} fill="none" stroke="#ef4444" strokeWidth="1.5" strokeDasharray="4 4" strokeLinecap="round" />
            )}
            {/* Data points */}
            {points.map((p, i) => (
                <circle key={i} cx={p.x} cy={p.y} r="3" fill="#3b82f6" stroke="#020617" strokeWidth="2" />
            ))}
        </svg>
    );
}

function DonutChart({ data }: { data: Record<string, number> }) {
    const entries = Object.entries(data);
    if (entries.length === 0) return null;

    const total = entries.reduce((sum, [, v]) => sum + v, 0);
    const colors = ['#3b82f6', '#8b5cf6', '#06b6d4', '#f59e0b', '#10b981', '#ec4899', '#f97316', '#6366f1'];
    const cx = 60, cy = 60, r = 45, inner = 30;

    let startAngle = -90;
    const arcs = entries.map(([label, value], i) => {
        const angle = (value / total) * 360;
        const endAngle = startAngle + angle;
        const largeArc = angle > 180 ? 1 : 0;
        const startRad = (startAngle * Math.PI) / 180;
        const endRad = (endAngle * Math.PI) / 180;

        const path = [
            `M ${cx + r * Math.cos(startRad)} ${cy + r * Math.sin(startRad)}`,
            `A ${r} ${r} 0 ${largeArc} 1 ${cx + r * Math.cos(endRad)} ${cy + r * Math.sin(endRad)}`,
            `L ${cx + inner * Math.cos(endRad)} ${cy + inner * Math.sin(endRad)}`,
            `A ${inner} ${inner} 0 ${largeArc} 0 ${cx + inner * Math.cos(startRad)} ${cy + inner * Math.sin(startRad)}`,
            'Z'
        ].join(' ');

        startAngle = endAngle;
        return { path, color: colors[i % colors.length], label, value, pct: Math.round((value / total) * 100) };
    });

    return (
        <div className="flex items-center gap-6">
            <svg viewBox="0 0 120 120" className="w-28 h-28 flex-shrink-0">
                {arcs.map((arc, i) => (
                    <path key={i} d={arc.path} fill={arc.color} className="hover:opacity-80 transition-opacity" />
                ))}
                <text x={cx} y={cy - 4} textAnchor="middle" fill="white" fontSize="16" fontWeight="900">{total}</text>
                <text x={cx} y={cy + 10} textAnchor="middle" fill="#64748b" fontSize="7" fontWeight="600">SCANS</text>
            </svg>
            <div className="space-y-1.5 flex-1 min-w-0">
                {arcs.slice(0, 6).map((arc, i) => (
                    <div key={i} className="flex items-center gap-2 text-xs">
                        <div className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: arc.color }} />
                        <span className="text-neutral-400 truncate flex-1">{arc.label}</span>
                        <span className="text-neutral-600 font-mono">{arc.pct}%</span>
                    </div>
                ))}
            </div>
        </div>
    );
}

function SecurityGrade({ score, grade }: { score: number; grade: string }) {
    const gradeColors: Record<string, string> = {
        A: '#10b981', B: '#3b82f6', C: '#f59e0b', D: '#f97316', F: '#ef4444'
    };
    const color = gradeColors[grade] || '#64748b';
    const circumference = 2 * Math.PI * 45;
    const offset = circumference - (score / 100) * circumference;

    return (
        <div className="flex flex-col items-center">
            <svg viewBox="0 0 120 120" className="w-36 h-36">
                <circle cx="60" cy="60" r="45" fill="none" stroke="#1e293b" strokeWidth="8" />
                <circle
                    cx="60" cy="60" r="45" fill="none" stroke={color} strokeWidth="8"
                    strokeDasharray={circumference} strokeDashoffset={offset}
                    strokeLinecap="round" transform="rotate(-90 60 60)"
                    className="transition-all duration-1000"
                />
                <text x="60" y="55" textAnchor="middle" dominantBaseline="central" fill={color} fontSize="32" fontWeight="900">{grade}</text>
                <text x="60" y="78" textAnchor="middle" dominantBaseline="central" fill="#64748b" fontSize="11" fontWeight="600">{score}/100</text>
            </svg>
            <span className="text-xs text-neutral-600 font-bold uppercase tracking-widest mt-1">Security Score</span>
        </div>
    );
}

// --- MAIN PAGE ---

export default function DesktopHome() {
    const navigate = useNavigate();
    const { xp, level, streak } = useGame();
    const { isAdminAuthenticated } = useAdmin();
    const [scoreData, setScoreData] = useState<SecurityScoreData | null>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        fetchAnalytics();
    }, []);

    const fetchAnalytics = async () => {
        try {
            // Base URL handled by API constant
            const res = await fetch(`${API_BASE_URL}/security-score`);
            const data = await res.json();
            setScoreData(data);
        } catch (e) {
            console.error('Failed to fetch analytics:', e);
        } finally {
            setLoading(false);
        }
    };

    const StatCard = ({ label, value, subtext, color = 'text-white' }: any) => (
        <motion.div
            whileHover={{ y: -3 }}
            className="p-6 rounded-2xl bg-neutral-950 border border-white/[0.06]"
        >
            <div className="text-neutral-600 text-xs font-bold uppercase tracking-widest mb-2">{label}</div>
            <div className={`text-3xl font-black mb-1 ${color}`}>{value}</div>
            <div className="text-xs text-neutral-500">{subtext}</div>
        </motion.div>
    );

    const QuickAction = ({ title, desc, icon: Icon, to, color }: any) => (
        <motion.div
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            onClick={() => navigate(to)}
            className="group cursor-pointer p-6 rounded-2xl bg-neutral-950 border border-white/[0.06] hover:border-blue-500/20 transition-all"
        >
            <div className="w-12 h-12 rounded-xl mb-4 flex items-center justify-center bg-blue-500/5 group-hover:bg-blue-500/10 transition-colors">
                <Icon className={`w-6 h-6 ${color}`} />
            </div>
            <h3 className="text-lg font-bold text-white mb-2">{title}</h3>
            <p className="text-sm text-neutral-500 leading-relaxed">{desc}</p>
        </motion.div>
    );

    const riskColors: Record<string, string> = {
        CRITICAL: 'bg-red-500', HIGH: 'bg-orange-500', MEDIUM: 'bg-yellow-500', LOW: 'bg-green-500'
    };
    const riskTextColors: Record<string, string> = {
        CRITICAL: 'text-red-400', HIGH: 'text-orange-400', MEDIUM: 'text-yellow-400', LOW: 'text-green-400'
    };

    return (
        <div className="p-10 max-w-7xl mx-auto space-y-10">

            {/* WELCOME HEADER */}
            <div className="flex justify-between items-end">
                <div>
                    <h1 className="text-4xl font-black text-white mb-2">Command Center</h1>
                    <p className="text-neutral-500">Your security analytics at a glance.</p>
                </div>
                <div className="flex items-center gap-2 px-4 py-2 bg-white/[0.03] border border-white/[0.06] rounded-full">
                    <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse"></div>
                    <span className="text-xs font-bold text-neutral-400 uppercase tracking-wide">Engine Online</span>
                </div>
            </div>

            {/* STATS GRID */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <StatCard label="Total Scans" value={scoreData?.total_scans ?? '—'} subtext={`${scoreData?.threats ?? 0} threats caught`} />
                <StatCard label="Clean Rate" value={scoreData && scoreData.total_scans > 0 ? `${Math.round((scoreData.clean / scoreData.total_scans) * 100)}%` : '—'} subtext={`${scoreData?.clean ?? 0} clean scans`} color="text-green-400" />
                <StatCard label="Languages" value={scoreData ? Object.keys(scoreData.languages).length : '—'} subtext="Unique languages scanned" />
                <StatCard label="XP / Rank" value={`${xp} XP`} subtext={`${level} — ${streak} day streak`} />
            </div>

            {/* ANALYTICS ROW */}
            {loading ? (
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    {[1, 2, 3].map(i => (
                        <div key={i} className="h-64 rounded-2xl bg-neutral-950 border border-white/[0.06] animate-pulse" />
                    ))}
                </div>
            ) : scoreData && scoreData.total_scans > 0 ? (
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">

                    {/* SECURITY SCORE */}
                    <motion.div
                        initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}
                        className="rounded-2xl bg-neutral-950 border border-white/[0.06] p-6 flex flex-col items-center justify-center"
                    >
                        <SecurityGrade score={scoreData.score} grade={scoreData.grade} />
                        <div className="mt-4 w-full">
                            <div className="grid grid-cols-4 gap-2 mt-3">
                                {['CRITICAL', 'HIGH', 'MEDIUM', 'LOW'].map(level => (
                                    <div key={level} className="text-center">
                                        <div className={`text-lg font-black ${riskTextColors[level]}`}>
                                            {scoreData.risk_distribution[level] || 0}
                                        </div>
                                        <div className="text-[9px] text-neutral-600 font-bold uppercase">{level}</div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    </motion.div>

                    {/* SCAN TREND CHART */}
                    <motion.div
                        initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.05 }}
                        className="rounded-2xl bg-neutral-950 border border-white/[0.06] p-6"
                    >
                        <div className="flex items-center gap-2 mb-4">
                            <TrendingUp className="w-4 h-4 text-blue-400" />
                            <h3 className="text-xs font-bold text-neutral-400 uppercase tracking-widest">Scan Trend (30 Days)</h3>
                        </div>
                        <div className="flex gap-4 mb-3">
                            <div className="flex items-center gap-1.5">
                                <div className="w-3 h-0.5 bg-blue-500 rounded" />
                                <span className="text-[10px] text-neutral-600">Total</span>
                            </div>
                            <div className="flex items-center gap-1.5">
                                <div className="w-3 h-0.5 bg-red-500 rounded border-dashed" />
                                <span className="text-[10px] text-neutral-600">Threats</span>
                            </div>
                        </div>
                        <div className="h-40">
                            <TrendChart data={scoreData.daily_trend} />
                        </div>
                    </motion.div>

                    {/* LANGUAGE BREAKDOWN */}
                    <motion.div
                        initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}
                        className="rounded-2xl bg-neutral-950 border border-white/[0.06] p-6"
                    >
                        <div className="flex items-center gap-2 mb-5">
                            <Globe className="w-4 h-4 text-purple-400" />
                            <h3 className="text-xs font-bold text-neutral-400 uppercase tracking-widest">Language Breakdown</h3>
                        </div>
                        <DonutChart data={scoreData.languages} />
                    </motion.div>

                </div>
            ) : (
                <motion.div
                    initial={{ opacity: 0 }} animate={{ opacity: 1 }}
                    className="rounded-3xl border border-dashed border-white/[0.08] bg-neutral-950/50 p-12 text-center"
                >
                    <div className="w-16 h-16 mx-auto mb-4 rounded-full border border-dashed border-neutral-800 flex items-center justify-center">
                        <BarChart3 className="w-8 h-8 text-neutral-700" />
                    </div>
                    <h3 className="text-lg font-bold text-neutral-400 mb-2">No Analytics Yet</h3>
                    <p className="text-sm text-neutral-600 mb-6 max-w-md mx-auto">
                        Start scanning code to build your security intelligence. Charts and scores appear after your first scan.
                    </p>
                    <button
                        onClick={() => navigate('/scanner')}
                        className="px-6 py-3 bg-blue-600/10 hover:bg-blue-600/20 text-blue-400 text-sm font-bold rounded-xl transition-colors border border-blue-500/20"
                    >
                        Run Your First Scan
                    </button>
                </motion.div>
            )}

            {/* RECENT SCANS TABLE */}
            {scoreData && scoreData.recent_scans && scoreData.recent_scans.length > 0 && (
                <div>
                    <h2 className="text-xs font-black text-neutral-600 uppercase tracking-widest mb-4">Recent Scans</h2>
                    <div className="rounded-2xl border border-white/[0.06] bg-neutral-950 overflow-hidden">
                        <table className="w-full">
                            <thead>
                                <tr className="border-b border-white/[0.06]">
                                    <th className="px-5 py-3 text-left text-[10px] font-bold text-neutral-600 uppercase tracking-widest">Time</th>
                                    <th className="px-5 py-3 text-left text-[10px] font-bold text-neutral-600 uppercase tracking-widest">Language</th>
                                    <th className="px-5 py-3 text-left text-[10px] font-bold text-neutral-600 uppercase tracking-widest">Risk</th>
                                    <th className="px-5 py-3 text-left text-[10px] font-bold text-neutral-600 uppercase tracking-widest">Confidence</th>
                                    <th className="px-5 py-3 text-left text-[10px] font-bold text-neutral-600 uppercase tracking-widest">Result</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-white/[0.04]">
                                {scoreData.recent_scans.map((scan, i) => (
                                    <tr key={scan.id || i} className="hover:bg-white/[0.02] transition-colors">
                                        <td className="px-5 py-3 text-sm text-neutral-400 font-mono">
                                            {new Date(scan.timestamp).toLocaleString(undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                                        </td>
                                        <td className="px-5 py-3">
                                            <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-blue-500/10 text-blue-400 uppercase tracking-wider">
                                                {scan.language}
                                            </span>
                                        </td>
                                        <td className="px-5 py-3">
                                            <span className={`text-[10px] font-bold px-2 py-0.5 rounded tracking-wider ${scan.risk_level === 'CRITICAL' ? 'bg-red-500/20 text-red-400' :
                                                scan.risk_level === 'HIGH' ? 'bg-orange-500/20 text-orange-400' :
                                                    scan.risk_level === 'MEDIUM' ? 'bg-yellow-500/20 text-yellow-400' :
                                                        'bg-green-500/20 text-green-400'
                                                }`}>{scan.risk_level}</span>
                                        </td>
                                        <td className="px-5 py-3 text-sm text-neutral-300 font-mono">{scan.confidence}%</td>
                                        <td className="px-5 py-3">
                                            {scan.malicious ? (
                                                <div className="flex items-center gap-1.5">
                                                    <AlertTriangle className="w-3.5 h-3.5 text-red-400" />
                                                    <span className="text-xs text-red-400 font-bold">Threat</span>
                                                </div>
                                            ) : (
                                                <div className="flex items-center gap-1.5">
                                                    <ShieldCheck className="w-3.5 h-3.5 text-green-400" />
                                                    <span className="text-xs text-green-400 font-bold">Clean</span>
                                                </div>
                                            )}
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>
            )}

            {/* TOOLS GRID */}
            <div>
                <h2 className="text-xs font-black text-neutral-600 uppercase tracking-widest mb-6">Quick Actions</h2>
                <div className={`grid grid-cols-1 gap-6 ${isAdminAuthenticated ? 'md:grid-cols-2' : ''}`}>
                    <QuickAction
                        to="/scanner"
                        title="Code Reviewer"
                        desc="Paste code and get instant vulnerability analysis with AI-powered deep scan and fix suggestions."
                        icon={Activity}
                        color="text-blue-400"
                    />
                    {isAdminAuthenticated && (
                        <QuickAction
                            to="/engine"
                            title="Model Lab"
                            desc="Train and manage your local security ML model. View stats, retrain the pipeline, and monitor performance."
                            icon={Brain}
                            color="text-cyan-400"
                        />
                    )}
                </div>
            </div>

        </div>
    );
}
