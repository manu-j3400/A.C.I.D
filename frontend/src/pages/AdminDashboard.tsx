import { useEffect, useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAdmin } from '@/context/AdminContext';
import { Button } from '@/components/ui/button';
import { Shield, Users, LogOut, UserPlus, Activity, AlertTriangle, Database, Download } from 'lucide-react';
import { API_BASE_URL } from '@/lib/api';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, ResponsiveContainer } from 'recharts';

interface UserRecord {
    id: number;
    name: string;
    email: string;
    is_admin: boolean;
    created_at: string | null;
}

interface ScanRecord {
    id: number;
    timestamp: string;
    language: string;
    risk_level: string;
    confidence: number;
    malicious: number;
    code_hash: string;
    nodes_scanned: number;
    reason: string;
}

interface TrainingStats {
    total: number;
    malicious: number;
    clean: number;
    by_language: { language: string; count: number }[];
    by_risk: { risk_level: string; count: number }[];
    last_collected: string | null;
}

export default function AdminDashboard() {
    const { adminUser, adminToken, adminLogout } = useAdmin();
    const navigate = useNavigate();
    const [users, setUsers] = useState<UserRecord[]>([]);
    const [scans, setScans] = useState<ScanRecord[]>([]);
    const [loading, setLoading] = useState(true);
    const [trainingStats, setTrainingStats] = useState<TrainingStats | null>(null);
    const [trainingLoading, setTrainingLoading] = useState(true);
    const [exportingTraining, setExportingTraining] = useState(false);
    const [exportToast, setExportToast] = useState<{ msg: string; ok: boolean } | null>(null);

    useEffect(() => {
        if (!adminToken) return;

        const fetchUsers = fetch(`${API_BASE_URL}/api/admin/users`, {
            headers: { 'Authorization': `Bearer ${adminToken}` }
        }).then(res => res.ok ? res.json() : Promise.reject('Failed to fetch users'));

        const fetchScans = fetch(`${API_BASE_URL}/scan-history?limit=200`, {
            headers: { 'Authorization': `Bearer ${adminToken}` }
        }).then(res => res.ok ? res.json() : Promise.reject('Failed to fetch scans'));

        Promise.all([fetchUsers, fetchScans])
            .then(([userData, scanData]) => {
                setUsers(userData.users || []);
                setScans(scanData.scans || []);
            })
            .catch(err => console.error(err))
            .finally(() => setLoading(false));

        fetch(`${API_BASE_URL}/api/training-data/stats`, {
            headers: { 'Authorization': `Bearer ${adminToken}` }
        })
            .then(res => res.ok ? res.json() : Promise.reject('Failed to fetch training stats'))
            .then(data => setTrainingStats(data))
            .catch(err => console.error(err))
            .finally(() => setTrainingLoading(false));
    }, [adminToken]);

    const handleLogout = () => {
        adminLogout();
        navigate('/admin/login');
    };

    const handleExportTraining = async (includeCode = false) => {
        if (!adminToken) return;
        setExportingTraining(true);
        try {
            const url = `${API_BASE_URL}/api/training-data/export${includeCode ? '?include_code=1' : ''}`;
            const res = await fetch(url, { headers: { 'Authorization': `Bearer ${adminToken}` } });
            if (!res.ok) throw new Error('Export failed');
            const blob = await res.blob();
            const a = document.createElement('a');
            a.href = URL.createObjectURL(blob);
            a.download = `soteria_training_${new Date().toISOString().slice(0, 10)}.csv`;
            a.click();
            URL.revokeObjectURL(a.href);
            setExportToast({ msg: 'Export downloaded', ok: true });
        } catch (err) {
            console.error(err);
            setExportToast({ msg: 'Export failed', ok: false });
        } finally {
            setExportingTraining(false);
            setTimeout(() => setExportToast(null), 3000);
        }
    };

    const totalUsers = users.length;
    const adminCount = users.filter(u => u.is_admin).length;
    const totalScans = scans.length;
    const criticalScans = scans.filter(s => s.risk_level === 'CRITICAL' || s.risk_level === 'HIGH').length;

    const recentSignups = users.filter(u => {
        if (!u.created_at) return false;
        const created = new Date(u.created_at);
        const weekAgo = new Date();
        weekAgo.setDate(weekAgo.getDate() - 7);
        return created >= weekAgo;
    }).length;

    const formatDate = (iso: string | null) => {
        if (!iso) return '—';
        return new Date(iso).toLocaleDateString('en-US', {
            month: 'short', day: 'numeric', year: 'numeric'
        });
    };

    const formatTime = (iso: string | null) => {
        if (!iso) return '—';
        return new Date(iso).toLocaleTimeString('en-US', {
            hour: 'numeric', minute: '2-digit'
        });
    };

    // Prepare chart data (group by day)
    const chartData = useMemo(() => {
        const counts: Record<string, { date: string; total: number; threats: number }> = {};

        scans.forEach(scan => {
            const dateStr = new Date(scan.timestamp).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
            if (!counts[dateStr]) {
                counts[dateStr] = { date: dateStr, total: 0, threats: 0 };
            }
            counts[dateStr].total += 1;
            if (scan.malicious) {
                counts[dateStr].threats += 1;
            }
        });

        return Object.values(counts).reverse(); // Oldest first for the chart
    }, [scans]);

    return (
        <div className="min-h-screen bg-black text-white">
            {/* Export toast */}
            {exportToast && (
                <div style={{
                    position: 'fixed', bottom: 24, right: 24, zIndex: 9999,
                    padding: '10px 18px', fontSize: 12, fontFamily: "'JetBrains Mono', monospace",
                    letterSpacing: '0.08em', borderRadius: 0,
                    background: exportToast.ok ? 'rgba(173,255,47,0.12)' : 'rgba(231,76,60,0.12)',
                    border: `1px solid ${exportToast.ok ? '#ADFF2F' : '#E74C3C'}`,
                    color: exportToast.ok ? '#ADFF2F' : '#E74C3C',
                }}>
                    {exportToast.ok ? '✓' : '✕'} {exportToast.msg}
                </div>
            )}
            {/* Header */}
            <header className="border-b border-white/[0.06] bg-neutral-950/80 backdrop-blur-xl sticky top-0 z-50">
                <div className="max-w-7xl mx-auto px-6 py-4 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <div className="w-9 h-9 rounded-lg bg-orange-600 flex items-center justify-center shadow-[2px_2px_0px_#7c2d12]">
                            <Shield className="w-5 h-5 text-white" />
                        </div>
                        <div>
                            <h1 className="text-lg font-bold tracking-tight">Admin Dashboard</h1>
                            <p className="text-xs text-neutral-500">Welcome, {adminUser?.name || 'Admin'}</p>
                        </div>
                    </div>
                    <Button
                        onClick={handleLogout}
                        className="border-2 border-slate-600 bg-slate-800 text-neutral-300 hover:bg-slate-700 hover:text-white shadow-[4px_4px_0px_#1e293b] hover:shadow-[2px_2px_0px_#1e293b] hover:translate-x-[2px] hover:translate-y-[2px] transition-all"
                    >
                        <LogOut className="w-4 h-4 mr-2" />
                        Logout
                    </Button>
                </div>
            </header>

            <main className="max-w-7xl mx-auto px-6 py-8 space-y-8">
                {/* Stats Cards */}
                <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
                    <div className="p-5 rounded-2xl bg-neutral-950 border border-white/[0.06]">
                        <div className="flex items-center gap-3 mb-3">
                            <div className="w-9 h-9 rounded-lg bg-blue-600/10 flex items-center justify-center">
                                <Users className="w-5 h-5 text-blue-400" />
                            </div>
                            <span className="text-xs font-bold text-neutral-500 uppercase tracking-widest">Total Users</span>
                        </div>
                        <p className="text-3xl font-black">{loading ? '—' : totalUsers}</p>
                    </div>

                    <div className="p-5 rounded-2xl bg-neutral-950 border border-white/[0.06]">
                        <div className="flex items-center gap-3 mb-3">
                            <div className="w-9 h-9 rounded-lg bg-emerald-600/10 flex items-center justify-center">
                                <UserPlus className="w-5 h-5 text-emerald-400" />
                            </div>
                            <span className="text-xs font-bold text-neutral-500 uppercase tracking-widest">New Signups</span>
                        </div>
                        <p className="text-3xl font-black">{loading ? '—' : recentSignups}</p>
                    </div>

                    <div className="p-5 rounded-2xl bg-neutral-950 border border-white/[0.06]">
                        <div className="flex items-center gap-3 mb-3">
                            <div className="w-9 h-9 rounded-lg bg-purple-600/10 flex items-center justify-center">
                                <Activity className="w-5 h-5 text-purple-400" />
                            </div>
                            <span className="text-xs font-bold text-neutral-500 uppercase tracking-widest">Total Scans</span>
                        </div>
                        <p className="text-3xl font-black">{loading ? '—' : totalScans}</p>
                    </div>

                    <div className="p-5 rounded-2xl bg-neutral-950 border border-white/[0.06]">
                        <div className="flex items-center gap-3 mb-3">
                            <div className="w-9 h-9 rounded-lg bg-red-600/10 flex items-center justify-center">
                                <AlertTriangle className="w-5 h-5 text-red-400" />
                            </div>
                            <span className="text-xs font-bold text-neutral-500 uppercase tracking-widest">Threats Found</span>
                        </div>
                        <p className="text-3xl font-black">{loading ? '—' : criticalScans}</p>
                    </div>
                </div>

                {/* Scan Analytics Chart */}
                <div className="rounded-2xl bg-neutral-950 border border-white/[0.06] overflow-hidden p-6">
                    <div className="flex items-center gap-2 mb-6">
                        <Activity className="w-4 h-4 text-purple-400" />
                        <h2 className="text-sm font-bold text-neutral-300 uppercase tracking-widest">Scan Activity Trends</h2>
                    </div>

                    {loading ? (
                        <div className="h-[300px] flex items-center justify-center">
                            <div className="w-8 h-8 rounded-full border-2 border-neutral-800 border-t-purple-500 animate-spin" />
                        </div>
                    ) : chartData.length === 0 ? (
                        <div className="h-[300px] flex items-center justify-center text-neutral-600">No scan history available.</div>
                    ) : (
                        <div className="h-[300px] w-full mt-4">
                            <ResponsiveContainer width="100%" height="100%">
                                <AreaChart data={chartData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                                    <defs>
                                        <linearGradient id="colorTotal" x1="0" y1="0" x2="0" y2="1">
                                            <stop offset="5%" stopColor="#8b5cf6" stopOpacity={0.3} />
                                            <stop offset="95%" stopColor="#8b5cf6" stopOpacity={0} />
                                        </linearGradient>
                                        <linearGradient id="colorThreats" x1="0" y1="0" x2="0" y2="1">
                                            <stop offset="5%" stopColor="#ef4444" stopOpacity={0.3} />
                                            <stop offset="95%" stopColor="#ef4444" stopOpacity={0} />
                                        </linearGradient>
                                    </defs>
                                    <XAxis dataKey="date" stroke="#525252" fontSize={12} tickLine={false} axisLine={false} />
                                    <YAxis stroke="#525252" fontSize={12} tickLine={false} axisLine={false} />
                                    <CartesianGrid strokeDasharray="3 3" stroke="#262626" vertical={false} />
                                    <RechartsTooltip
                                        contentStyle={{ backgroundColor: '#0a0a0a', borderColor: '#262626', borderRadius: '8px', color: '#fff' }}
                                        itemStyle={{ color: '#fff' }}
                                    />
                                    <Area type="monotone" dataKey="total" name="Total Scans" stroke="#8b5cf6" strokeWidth={2} fillOpacity={1} fill="url(#colorTotal)" />
                                    <Area type="monotone" dataKey="threats" name="Threats Found" stroke="#ef4444" strokeWidth={2} fillOpacity={1} fill="url(#colorThreats)" />
                                </AreaChart>
                            </ResponsiveContainer>
                        </div>
                    )}
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                    {/* Recent Scans Table */}
                    <div className="rounded-2xl bg-neutral-950 border border-white/[0.06] overflow-hidden">
                        <div className="px-6 py-4 border-b border-white/[0.06] flex items-center gap-2">
                            <Shield className="w-4 h-4 text-orange-500" />
                            <h2 className="text-sm font-bold text-neutral-300 uppercase tracking-widest">Recent Activity Log</h2>
                        </div>

                        {loading ? (
                            <div className="p-12 flex items-center justify-center">
                                <div className="w-8 h-8 rounded-full border-2 border-neutral-800 border-t-orange-500 animate-spin" />
                            </div>
                        ) : scans.length === 0 ? (
                            <div className="p-12 text-center text-neutral-600">No scans logged yet.</div>
                        ) : (
                            <div className="overflow-x-auto">
                                <table className="w-full text-sm">
                                    <thead>
                                        <tr className="text-left text-xs font-bold text-neutral-600 uppercase tracking-widest border-b border-white/[0.04]">
                                            <th className="px-6 py-3">Time</th>
                                            <th className="px-6 py-3">Risk Level</th>
                                            <th className="px-6 py-3">Language</th>
                                            <th className="px-6 py-3">Reason</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {scans.slice(0, 10).map(s => (
                                            <tr key={s.id} className="border-b border-white/[0.03] hover:bg-white/[0.02] transition-colors">
                                                <td className="px-6 py-3 text-neutral-500 text-xs">
                                                    {formatDate(s.timestamp)} <br />
                                                    <span className="text-neutral-600">{formatTime(s.timestamp)}</span>
                                                </td>
                                                <td className="px-6 py-3">
                                                    <span className={`inline-flex items-center gap-1 text-xs font-bold px-2 py-0.5 rounded-full ${s.risk_level === 'CRITICAL' || s.risk_level === 'HIGH'
                                                        ? 'bg-red-500/10 text-red-400 border border-red-500/20'
                                                        : s.risk_level === 'MEDIUM'
                                                            ? 'bg-amber-500/10 text-amber-400 border border-amber-500/20'
                                                            : 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                                                        }`}>
                                                        {s.risk_level}
                                                    </span>
                                                </td>
                                                <td className="px-6 py-3 text-neutral-400 font-mono text-xs">{s.language || 'unknown'}</td>
                                                <td className="px-6 py-3 text-neutral-500 text-xs max-w-[200px] truncate" title={s.reason}>
                                                    {s.reason || 'No description'}
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        )}
                    </div>

                    {/* User Management Table */}
                    <div className="rounded-2xl bg-neutral-950 border border-white/[0.06] overflow-hidden">
                        <div className="px-6 py-4 border-b border-white/[0.06] flex items-center gap-2">
                            <Users className="w-4 h-4 text-blue-500" />
                            <h2 className="text-sm font-bold text-neutral-300 uppercase tracking-widest">Registered Users</h2>
                        </div>

                        {loading ? (
                            <div className="p-12 flex items-center justify-center">
                                <div className="w-8 h-8 rounded-full border-2 border-neutral-800 border-t-blue-500 animate-spin" />
                            </div>
                        ) : users.length === 0 ? (
                            <div className="p-12 text-center text-neutral-600">No users found.</div>
                        ) : (
                            <div className="overflow-x-auto">
                                <table className="w-full text-sm">
                                    <thead>
                                        <tr className="text-left text-xs font-bold text-neutral-600 uppercase tracking-widest border-b border-white/[0.04]">
                                            <th className="px-6 py-3">Name</th>
                                            <th className="px-6 py-3">Email</th>
                                            <th className="px-6 py-3">Role</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {users.slice(0, 10).map(u => (
                                            <tr key={u.id} className="border-b border-white/[0.03] hover:bg-white/[0.02] transition-colors">
                                                <td className="px-6 py-3 font-medium">{u.name}</td>
                                                <td className="px-6 py-3 text-neutral-400">{u.email}</td>
                                                <td className="px-6 py-3">
                                                    {u.is_admin ? (
                                                        <span className="inline-flex items-center gap-1 text-xs font-bold px-2 py-0.5 rounded-full bg-orange-600/10 text-orange-400 border border-orange-500/20">
                                                            <Shield className="w-3 h-3" /> Admin
                                                        </span>
                                                    ) : (
                                                        <span className="text-xs text-neutral-500">User</span>
                                                    )}
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        )}
                    </div>
                </div>

                {/* Training Data Collection Panel */}
                <div className="rounded-2xl bg-neutral-950 border border-white/[0.06] overflow-hidden">
                    <div className="px-6 py-4 border-b border-white/[0.06] flex items-center justify-between">
                        <div className="flex items-center gap-2">
                            <Database className="w-4 h-4 text-emerald-500" />
                            <h2 className="text-sm font-bold text-neutral-300 uppercase tracking-widest">Training Corpus</h2>
                        </div>
                        <div className="flex items-center gap-2">
                            <Button
                                onClick={() => handleExportTraining(false)}
                                disabled={exportingTraining || trainingLoading || !trainingStats || trainingStats.total === 0}
                                className="h-8 text-xs border border-neutral-700 bg-neutral-900 text-neutral-300 hover:bg-neutral-800 hover:text-white disabled:opacity-40"
                            >
                                <Download className="w-3 h-3 mr-1.5" />
                                Export CSV
                            </Button>
                            <Button
                                onClick={() => handleExportTraining(true)}
                                disabled={exportingTraining || trainingLoading || !trainingStats || trainingStats.total === 0}
                                className="h-8 text-xs border border-neutral-700 bg-neutral-900 text-neutral-300 hover:bg-neutral-800 hover:text-white disabled:opacity-40"
                            >
                                <Download className="w-3 h-3 mr-1.5" />
                                With Code
                            </Button>
                        </div>
                    </div>

                    {trainingLoading ? (
                        <div className="p-12 flex items-center justify-center">
                            <div className="w-8 h-8 rounded-full border-2 border-neutral-800 border-t-emerald-500 animate-spin" />
                        </div>
                    ) : !trainingStats || trainingStats.total === 0 ? (
                        <div className="p-12 text-center text-neutral-600 text-sm">
                            No training samples collected yet. Run scans to populate the corpus.
                        </div>
                    ) : (
                        <div className="p-6 grid grid-cols-1 sm:grid-cols-3 gap-6">
                            {/* Label balance */}
                            <div>
                                <p className="text-xs font-bold text-neutral-500 uppercase tracking-widest mb-4">Label Balance</p>
                                <div className="space-y-3">
                                    <div>
                                        <div className="flex justify-between text-xs mb-1">
                                            <span className="text-red-400 font-medium">Malicious</span>
                                            <span className="text-neutral-400 font-mono">{trainingStats.malicious.toLocaleString()}</span>
                                        </div>
                                        <div className="h-2 rounded-full bg-neutral-800 overflow-hidden">
                                            <div
                                                className="h-full bg-red-500 rounded-full"
                                                style={{ width: `${trainingStats.total > 0 ? (trainingStats.malicious / trainingStats.total) * 100 : 0}%` }}
                                            />
                                        </div>
                                    </div>
                                    <div>
                                        <div className="flex justify-between text-xs mb-1">
                                            <span className="text-emerald-400 font-medium">Clean</span>
                                            <span className="text-neutral-400 font-mono">{trainingStats.clean.toLocaleString()}</span>
                                        </div>
                                        <div className="h-2 rounded-full bg-neutral-800 overflow-hidden">
                                            <div
                                                className="h-full bg-emerald-500 rounded-full"
                                                style={{ width: `${trainingStats.total > 0 ? (trainingStats.clean / trainingStats.total) * 100 : 0}%` }}
                                            />
                                        </div>
                                    </div>
                                    <div className="pt-2 border-t border-white/[0.04]">
                                        <div className="flex justify-between text-xs">
                                            <span className="text-neutral-500">Total samples</span>
                                            <span className="text-white font-bold font-mono">{trainingStats.total.toLocaleString()}</span>
                                        </div>
                                        {trainingStats.last_collected && (
                                            <div className="flex justify-between text-xs mt-1">
                                                <span className="text-neutral-500">Last collected</span>
                                                <span className="text-neutral-400 font-mono">
                                                    {new Date(trainingStats.last_collected).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                                                </span>
                                            </div>
                                        )}
                                    </div>
                                </div>
                            </div>

                            {/* By language */}
                            <div>
                                <p className="text-xs font-bold text-neutral-500 uppercase tracking-widest mb-4">By Language</p>
                                <div className="space-y-2">
                                    {trainingStats.by_language.slice(0, 6).map(({ language, count }) => (
                                        <div key={language}>
                                            <div className="flex justify-between text-xs mb-1">
                                                <span className="text-neutral-300 font-mono">{language}</span>
                                                <span className="text-neutral-500">{count.toLocaleString()}</span>
                                            </div>
                                            <div className="h-1.5 rounded-full bg-neutral-800 overflow-hidden">
                                                <div
                                                    className="h-full rounded-full"
                                                    style={{
                                                        width: `${trainingStats.total > 0 ? (count / trainingStats.total) * 100 : 0}%`,
                                                        background: '#5599FF',
                                                    }}
                                                />
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>

                            {/* By risk level */}
                            <div>
                                <p className="text-xs font-bold text-neutral-500 uppercase tracking-widest mb-4">By Risk Level</p>
                                <div className="space-y-2">
                                    {trainingStats.by_risk.map(({ risk_level, count }) => {
                                        const color = risk_level === 'CRITICAL' || risk_level === 'HIGH'
                                            ? '#ef4444'
                                            : risk_level === 'MEDIUM' ? '#f59e0b'
                                            : risk_level === 'LOW' ? '#ADFF2F'
                                            : '#404040';
                                        return (
                                            <div key={risk_level}>
                                                <div className="flex justify-between text-xs mb-1">
                                                    <span className="font-mono" style={{ color }}>{risk_level || 'UNKNOWN'}</span>
                                                    <span className="text-neutral-500">{count.toLocaleString()}</span>
                                                </div>
                                                <div className="h-1.5 rounded-full bg-neutral-800 overflow-hidden">
                                                    <div
                                                        className="h-full rounded-full"
                                                        style={{
                                                            width: `${trainingStats.total > 0 ? (count / trainingStats.total) * 100 : 0}%`,
                                                            background: color,
                                                        }}
                                                    />
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>
                            </div>
                        </div>
                    )}
                </div>
            </main>
        </div>
    );
}
