import { useEffect, useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAdmin } from '@/context/AdminContext';
import { Button } from '@/components/ui/button';
import { Shield, Users, LogOut, UserPlus, Clock, Activity, AlertTriangle } from 'lucide-react';
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

export default function AdminDashboard() {
    const { adminUser, adminToken, adminLogout } = useAdmin();
    const navigate = useNavigate();
    const [users, setUsers] = useState<UserRecord[]>([]);
    const [scans, setScans] = useState<ScanRecord[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        if (!adminToken) return;

        const fetchUsers = fetch('/api/admin/users', {
            headers: { 'Authorization': `Bearer ${adminToken}` }
        }).then(res => res.ok ? res.json() : Promise.reject('Failed to fetch users'));

        const baseUrl = import.meta.env.VITE_API_URL || 'http://localhost:5001';
        const fetchScans = fetch(`${baseUrl}/scan-history?limit=200`).then(res => res.ok ? res.json() : Promise.reject('Failed to fetch scans'));

        Promise.all([fetchUsers, fetchScans])
            .then(([userData, scanData]) => {
                setUsers(userData.users || []);
                setScans(scanData.scans || []);
            })
            .catch(err => console.error(err))
            .finally(() => setLoading(false));
    }, [adminToken]);

    const handleLogout = () => {
        adminLogout();
        navigate('/admin/login');
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
            {/* Header */}
            <header className="border-b border-white/[0.06] bg-neutral-950/80 backdrop-blur-xl sticky top-0 z-50">
                <div className="max-w-7xl mx-auto px-6 py-4 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <div className="w-9 h-9 rounded-lg bg-gradient-to-br from-orange-600 to-red-600 flex items-center justify-center shadow-lg shadow-orange-600/20">
                            <Shield className="w-5 h-5 text-white" />
                        </div>
                        <div>
                            <h1 className="text-lg font-bold tracking-tight">Admin Dashboard</h1>
                            <p className="text-xs text-neutral-500">Welcome, {adminUser?.name || 'Admin'}</p>
                        </div>
                    </div>
                    <Button
                        onClick={handleLogout}
                        variant="outline"
                        className="border-white/[0.08] text-neutral-400 hover:text-white hover:border-orange-500/30 bg-transparent"
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
            </main>
        </div>
    );
}
