import { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Loader2 } from 'lucide-react';

export default function GithubCallback() {
    const [searchParams] = useSearchParams();
    const navigate = useNavigate();
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        const code = searchParams.get('code');
        if (!code) {
            setError('No code provided by GitHub');
            return;
        }

        const exchangeToken = async () => {
            try {
                const baseUrl = import.meta.env.VITE_API_URL || 'http://localhost:5001';
                const res = await fetch(`${baseUrl}/github/token`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ code })
                });

                if (!res.ok) throw new Error('Failed to exchange token');

                const data = await res.json();
                if (data.access_token) {
                    localStorage.setItem('github_token', data.access_token);
                    navigate('/batch', { replace: true });
                } else {
                    setError(data.error || 'Invalid token response from GitHub');
                }
            } catch (err: any) {
                setError(err.message);
            }
        };

        exchangeToken();
    }, [searchParams, navigate]);

    return (
        <div className="flex flex-col items-center justify-center min-h-[50vh]">
            {error ? (
                <div className="text-center">
                    <h2 className="text-2xl font-bold text-red-500 mb-2">Authentication Failed</h2>
                    <p className="text-neutral-400 mb-6">{error}</p>
                    <button onClick={() => navigate('/batch')} className="px-4 py-2 bg-neutral-800 rounded-lg hover:bg-neutral-700 transition-colors">
                        Return to Scanner
                    </button>
                </div>
            ) : (
                <div className="text-center">
                    <Loader2 className="w-12 h-12 text-blue-500 animate-spin mx-auto mb-4" />
                    <h2 className="text-xl font-bold mb-2 text-white">Connecting to GitHub...</h2>
                    <p className="text-neutral-400">Please wait while we securely link your account.</p>
                </div>
            )}
        </div>
    );
}
