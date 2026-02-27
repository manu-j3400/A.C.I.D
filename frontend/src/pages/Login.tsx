import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '@/context/AuthContext';
import { Button } from '@/components/ui/button';
import { LogIn, Eye, EyeOff } from 'lucide-react';

export default function Login() {
    const { login } = useAuth();
    const navigate = useNavigate();
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [showPassword, setShowPassword] = useState(false);
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError('');
        setLoading(true);

        try {
            await login(email, password);
            navigate('/dashboard');
        } catch (err: any) {
            setError(err.message || 'Login failed');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="min-h-screen bg-black flex items-center justify-center px-4 relative">
            <div className="absolute top-1/3 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[400px] h-[400px] bg-blue-600/5 rounded-full blur-[120px] pointer-events-none" />
            <div className="max-w-md w-full p-8 rounded-3xl bg-neutral-950 border border-blue-500/10 backdrop-blur-xl shadow-2xl shadow-blue-900/10">
                <div className="text-center mb-8">
                    <Link to="/">
                        <img src="/soteria-logo.png" alt="Soteria" className="mx-auto w-14 h-14 rounded-xl object-cover mb-4" />
                    </Link>
                    <h1 className="text-2xl font-black text-white tracking-tight">Welcome Back</h1>
                    <p className="text-neutral-500 text-sm mt-1">Sign in to your account</p>
                </div>

                <form onSubmit={handleSubmit} className="space-y-4">
                    <div>
                        <label className="text-xs font-bold text-neutral-500 uppercase tracking-widest mb-1 block">Email</label>
                        <input
                            type="email"
                            placeholder="you@university.edu"
                            value={email}
                            onChange={(e) => setEmail(e.target.value)}
                            required
                            className="w-full bg-black border border-white/[0.08] rounded-xl px-4 py-3 text-white placeholder-neutral-700 focus:outline-none focus:border-blue-500/30 focus:ring-1 focus:ring-blue-500/20 transition-colors"
                        />
                    </div>
                    <div>
                        <label className="text-xs font-bold text-neutral-500 uppercase tracking-widest mb-1 block">Password</label>
                        <div className="relative">
                            <input
                                type={showPassword ? "text" : "password"}
                                placeholder="Your password"
                                value={password}
                                onChange={(e) => setPassword(e.target.value)}
                                required
                                className="w-full bg-black border border-white/[0.08] rounded-xl px-4 py-3 text-white placeholder-neutral-700 focus:outline-none focus:border-blue-500/30 focus:ring-1 focus:ring-blue-500/20 transition-colors pr-10"
                            />
                            <button
                                type="button"
                                onClick={() => setShowPassword(!showPassword)}
                                className="absolute right-3 top-1/2 -translate-y-1/2 text-neutral-500 hover:text-white transition-colors p-1"
                                aria-label={showPassword ? "Hide password" : "Show password"}
                            >
                                {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                            </button>
                        </div>
                    </div>

                    {error && <p className="text-red-400 text-xs bg-red-500/10 border border-red-500/20 rounded-lg px-3 py-2">{error}</p>}

                    <Button
                        type="submit"
                        disabled={loading}
                        className="w-full bg-gradient-to-r from-blue-600 to-blue-500 text-white hover:from-blue-500 hover:to-blue-400 py-6 rounded-xl font-bold shadow-lg shadow-blue-600/20"
                    >
                        <LogIn className="w-4 h-4 mr-2" />
                        {loading ? 'Signing In...' : 'Sign In'}
                    </Button>
                </form>

                <p className="text-center text-neutral-600 text-sm mt-6">
                    Don't have an account?{' '}
                    <Link to="/signup" className="text-blue-400 hover:text-blue-300 font-bold">
                        Sign up
                    </Link>
                </p>
                <p className="text-center text-neutral-700 text-xs mt-3">
                    <Link to="/admin/login" className="text-orange-400/60 hover:text-orange-400 transition-colors">
                        Are you an admin?
                    </Link>
                </p>
            </div>
        </div>
    );
}
