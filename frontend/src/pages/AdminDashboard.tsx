import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAdmin } from '@/context/AdminContext';
import { Button } from '@/components/ui/button';
import { Shield, Users, LogOut, UserPlus, Clock } from 'lucide-react';

interface UserRecord {
    id: number;
    name: string;
    email: string;
    is_admin: boolean;
    created_at: string | null;
}

export default function AdminDashboard() {
    const { adminUser, adminToken, adminLogout } = useAdmin();
    const navigate = useNavigate();
    const [users, setUsers] = useState<UserRecord[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        if (!adminToken) return;
        fetch('/api/admin/users', {
            headers: { 'Authorization': `Bearer ${adminToken}` }
        })
            .then(res => {
                if (res.ok) return res.json();
                throw new Error('Failed to fetch users');
            })
            .then(data => setUsers(data.users || []))
            .catch(err => console.error(err))
            .finally(() => setLoading(false));
    }, [adminToken]);

    const handleLogout = () => {
        adminLogout();
        navigate('/admin/login');
    };

    const totalUsers = users.length;
    const adminCount = users.filter(u => u.is_admin).length;

    // "Recent" = signed up in the last 7 days
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
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
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
                            <div className="w-9 h-9 rounded-lg bg-orange-600/10 flex items-center justify-center">
                                <Shield className="w-5 h-5 text-orange-400" />
                            </div>
                            <span className="text-xs font-bold text-neutral-500 uppercase tracking-widest">Admins</span>
                        </div>
                        <p className="text-3xl font-black">{loading ? '—' : adminCount}</p>
                    </div>

                    <div className="p-5 rounded-2xl bg-neutral-950 border border-white/[0.06]">
                        <div className="flex items-center gap-3 mb-3">
                            <div className="w-9 h-9 rounded-lg bg-emerald-600/10 flex items-center justify-center">
                                <UserPlus className="w-5 h-5 text-emerald-400" />
                            </div>
                            <span className="text-xs font-bold text-neutral-500 uppercase tracking-widest">Recent Signups</span>
                        </div>
                        <p className="text-3xl font-black">{loading ? '—' : recentSignups}</p>
                        <p className="text-xs text-neutral-600 mt-1">Last 7 days</p>
                    </div>
                </div>

                {/* User Management Table */}
                <div className="rounded-2xl bg-neutral-950 border border-white/[0.06] overflow-hidden">
                    <div className="px-6 py-4 border-b border-white/[0.06] flex items-center gap-2">
                        <Users className="w-4 h-4 text-neutral-500" />
                        <h2 className="text-sm font-bold text-neutral-300 uppercase tracking-widest">Registered Users</h2>
                    </div>

                    {loading ? (
                        <div className="p-12 flex items-center justify-center">
                            <div className="w-8 h-8 rounded-full border-2 border-neutral-800 border-t-orange-500 animate-spin" />
                        </div>
                    ) : users.length === 0 ? (
                        <div className="p-12 text-center text-neutral-600">No users found.</div>
                    ) : (
                        <div className="overflow-x-auto">
                            <table className="w-full text-sm">
                                <thead>
                                    <tr className="text-left text-xs font-bold text-neutral-600 uppercase tracking-widest border-b border-white/[0.04]">
                                        <th className="px-6 py-3">ID</th>
                                        <th className="px-6 py-3">Name</th>
                                        <th className="px-6 py-3">Email</th>
                                        <th className="px-6 py-3">Role</th>
                                        <th className="px-6 py-3">Joined</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {users.map(u => (
                                        <tr key={u.id} className="border-b border-white/[0.03] hover:bg-white/[0.02] transition-colors">
                                            <td className="px-6 py-3 text-neutral-500 font-mono text-xs">{u.id}</td>
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
                                            <td className="px-6 py-3 text-neutral-500 text-xs">
                                                <span className="inline-flex items-center gap-1">
                                                    <Clock className="w-3 h-3" /> {formatDate(u.created_at)}
                                                </span>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    )}
                </div>
            </main>
        </div>
    );
}
