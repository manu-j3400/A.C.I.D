import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '@/context/AuthContext';
import { Button } from '@/components/ui/button';
import { UserPlus } from 'lucide-react';

const GoogleIcon = () => (
    <svg className="w-5 h-5" viewBox="0 0 24 24">
        <path fill="currentColor" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
        <path fill="currentColor" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
        <path fill="currentColor" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
        <path fill="currentColor" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
    </svg>
);

export default function Signup() {
    const { signup, signInWithGoogle } = useAuth();
    const navigate = useNavigate();
    const [name, setName] = useState('');
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [error, setError] = useState('');
    const [emailExists, setEmailExists] = useState(false);
    const [loading, setLoading] = useState(false);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError('');
        setEmailExists(false);
        setLoading(true);

        try {
            await signup(name, email, password);
            navigate('/dashboard');
        } catch (err: any) {
            const msg: string = err.message || 'Signup failed';
            if (msg.toLowerCase().includes('already') || msg.toLowerCase().includes('registered') || err.status === 409) {
                setEmailExists(true);
            } else {
                setError(msg);
            }
        } finally {
            setLoading(false);
        }
    };

    const handleGoogleSignIn = async () => {
        setError('');
        setLoading(true);
        try {
            await signInWithGoogle();
        } catch (err: unknown) {
            setError(err instanceof Error ? err.message : 'Google sign-up failed');
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
                    <h1 className="text-2xl font-black text-white tracking-tight">Create Account</h1>
                    <p className="text-neutral-500 text-sm mt-1">Start your security journey</p>
                </div>

                <form onSubmit={handleSubmit} className="space-y-4">
                    <div>
                        <label className="text-xs font-bold text-neutral-500 uppercase tracking-widest mb-1 block">Name</label>
                        <input
                            type="text"
                            placeholder="Your name"
                            value={name}
                            onChange={(e) => setName(e.target.value)}
                            required
                            className="w-full bg-black border border-white/[0.08] rounded-xl px-4 py-3 text-white placeholder-neutral-700 focus:outline-none focus:border-blue-500/30 focus:ring-1 focus:ring-blue-500/20 transition-colors"
                        />
                    </div>
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
                        <input
                            type="password"
                            placeholder="Min. 6 characters"
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            required
                            minLength={6}
                            className="w-full bg-black border border-white/[0.08] rounded-xl px-4 py-3 text-white placeholder-neutral-700 focus:outline-none focus:border-blue-500/30 focus:ring-1 focus:ring-blue-500/20 transition-colors"
                        />
                    </div>

                    {error && <p className="text-red-400 text-xs bg-red-500/10 border border-red-500/20 rounded-lg px-3 py-2">{error}</p>}

                    {emailExists && (
                        <div className="text-xs bg-amber-500/10 border border-amber-500/20 rounded-lg px-3 py-3 space-y-1">
                            <p className="text-amber-400 font-semibold">An account with this email already exists.</p>
                            <p className="text-neutral-400">
                                <Link to="/login" className="text-blue-400 hover:text-blue-300 font-bold underline">Sign in instead</Link>
                                {' '}or{' '}
                                <Link to="/login?forgot=1" className="text-blue-400 hover:text-blue-300 font-bold underline">reset your password</Link>.
                            </p>
                        </div>
                    )}

                    <Button
                        type="submit"
                        disabled={loading}
                        className="w-full bg-blue-600 text-white hover:bg-blue-500 py-6 rounded-xl font-bold shadow-[4px_4px_0px_#1e3a5f] hover:shadow-[2px_2px_0px_#1e3a5f] hover:translate-x-[2px] hover:translate-y-[2px] transition-all"
                    >
                        <UserPlus className="w-4 h-4 mr-2" />
                        {loading ? 'Creating Account...' : 'Create Account'}
                    </Button>

                    <div className="relative my-6">
                        <div className="absolute inset-0 flex items-center">
                            <div className="w-full border-t border-white/10" />
                        </div>
                        <div className="relative flex justify-center text-xs uppercase">
                            <span className="bg-neutral-950 px-2 text-neutral-500">or</span>
                        </div>
                    </div>

                    <Button
                        type="button"
                        variant="outline"
                        disabled={loading}
                        onClick={handleGoogleSignIn}
                        className="w-full bg-white/5 border-white/10 hover:bg-white/10 text-white py-6 rounded-xl font-bold"
                    >
                        <GoogleIcon />
                        <span className="ml-2">Sign up with Google</span>
                    </Button>
                </form>

                <p className="text-center text-neutral-600 text-sm mt-6">
                    Already have an account?{' '}
                    <Link to="/login" className="text-blue-400 hover:text-blue-300 font-bold">
                        Log in
                    </Link>
                </p>
            </div>
        </div>
    );
}
