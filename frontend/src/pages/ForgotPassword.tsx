import { useState } from 'react';
import { Link } from 'react-router-dom';
import { supabase } from '@/lib/supabase';
import { Button } from '@/components/ui/button';
import { Mail, ArrowLeft, CheckCircle2 } from 'lucide-react';

export default function ForgotPassword() {
    const [email, setEmail] = useState('');
    const [sent, setSent] = useState(false);
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError('');
        setLoading(true);

        const { error: sbError } = await supabase.auth.resetPasswordForEmail(email.trim().toLowerCase(), {
            redirectTo: `${window.location.origin}/reset-password`,
        });

        setLoading(false);

        if (sbError) {
            setError(sbError.message);
        } else {
            setSent(true);
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
                    <h1 className="text-2xl font-black text-white tracking-tight">Reset Password</h1>
                    <p className="text-neutral-500 text-sm mt-1">
                        {sent ? 'Check your inbox' : "Enter your email and we'll send a reset link"}
                    </p>
                </div>

                {sent ? (
                    <div className="text-center space-y-4">
                        <div className="flex justify-center">
                            <CheckCircle2 className="w-12 h-12 text-green-500" />
                        </div>
                        <p className="text-neutral-300 text-sm">
                            A password reset link has been sent to <span className="text-white font-semibold">{email}</span>.
                            Check your spam folder if it doesn't arrive within a few minutes.
                        </p>
                        <Link to="/login">
                            <Button className="w-full mt-4 bg-blue-800/80 hover:bg-blue-700/80 py-6 rounded-xl font-bold transition-all">
                                <ArrowLeft className="w-4 h-4 mr-2" />
                                Back to Sign In
                            </Button>
                        </Link>
                    </div>
                ) : (
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

                        {error && (
                            <p className="text-red-400 text-xs bg-red-500/10 border border-red-500/20 rounded-lg px-3 py-2">{error}</p>
                        )}

                        <Button
                            type="submit"
                            disabled={loading}
                            className="w-full bg-blue-800/80 hover:bg-blue-700/80 py-6 rounded-xl font-bold transition-all"
                        >
                            <Mail className="w-4 h-4 mr-2" />
                            {loading ? 'Sending...' : 'Send Reset Link'}
                        </Button>

                        <Link to="/login" className="flex items-center justify-center gap-1 text-neutral-500 hover:text-white text-sm transition-colors mt-2">
                            <ArrowLeft className="w-3.5 h-3.5" />
                            Back to Sign In
                        </Link>
                    </form>
                )}
            </div>
        </div>
    );
}
