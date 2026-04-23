import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAdmin } from '@/context/AdminContext';
import { Button } from '@/components/ui/button';
import { Shield } from 'lucide-react';

export default function AdminLogin() {
    const { adminLogin } = useAdmin();
    const navigate = useNavigate();
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError('');
        setLoading(true);

        try {
            await adminLogin(email, password);
            navigate('/admin/dashboard');
        } catch (err: any) {
            setError(err.message || 'Admin login failed');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="min-h-screen bg-black flex items-center justify-center px-4 relative">
            {/* Orange/red glow background — distinct from user login's blue */}
            <div className="absolute top-1/3 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[400px] h-[400px] bg-[#ADFF2F]/5 rounded-full blur-[120px] pointer-events-none" />

            <div className="max-w-md w-full p-8 rounded-3xl bg-neutral-950 border border-[#ADFF2F]/15 backdrop-blur-xl shadow-2xl shadow-black/30">
                <div className="text-center mb-8">
                    <div className="mx-auto w-14 h-14 rounded-xl bg-[#0D0D0D] border border-[#ADFF2F]/30 flex items-center justify-center mb-4">
                        <Shield className="w-7 h-7 text-white" />
                    </div>
                    <h1 className="text-2xl font-black text-white tracking-tight">Admin Portal</h1>
                    <p className="text-neutral-500 text-sm mt-1">Authorized personnel only</p>
                </div>

                <form onSubmit={handleSubmit} className="space-y-4">
                    <div>
                        <label className="text-xs font-bold text-neutral-500 uppercase tracking-widest mb-1 block">Email</label>
                        <input
                            type="email"
                            placeholder="admin@soteria.io"
                            value={email}
                            onChange={(e) => setEmail(e.target.value)}
                            required
                            className="w-full bg-black border border-white/[0.08] rounded-xl px-4 py-3 text-white placeholder-neutral-700 focus:outline-none focus:border-[#ADFF2F]/40 focus:ring-1 focus:ring-[#ADFF2F]/15 transition-colors"
                        />
                    </div>
                    <div>
                        <label className="text-xs font-bold text-neutral-500 uppercase tracking-widest mb-1 block">Password</label>
                        <input
                            type="password"
                            placeholder="Admin password"
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            required
                            className="w-full bg-black border border-white/[0.08] rounded-xl px-4 py-3 text-white placeholder-neutral-700 focus:outline-none focus:border-[#ADFF2F]/40 focus:ring-1 focus:ring-[#ADFF2F]/15 transition-colors"
                        />
                    </div>

                    {error && <p className="text-red-400 text-xs bg-red-500/10 border border-red-500/20 rounded-lg px-3 py-2">{error}</p>}

                    <Button
                        type="submit"
                        disabled={loading}
                        className="w-full bg-[#ADFF2F] text-black hover:bg-[#C4FF52] py-6 rounded-xl font-bold transition-all"
                    >
                        <Shield className="w-4 h-4 mr-2" />
                        {loading ? <span style={{opacity:0.7}}>●●●</span> : 'Admin Sign In'}
                    </Button>
                </form>

                <p className="text-center text-neutral-700 text-xs mt-6">
                    This portal is for administrators only.
                </p>
            </div>
        </div>
    );
}
