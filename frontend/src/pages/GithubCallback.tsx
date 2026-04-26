import { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { API_BASE_URL } from '@/lib/api';

const ACCENT = '#FFFFFF';
const FONT = "'JetBrains Mono', 'Courier New', monospace";

export default function GithubCallback() {
    const [searchParams] = useSearchParams();
    const navigate = useNavigate();
    const [error, setError] = useState<string | null>(null);
    const [tick, setTick] = useState(0);

    useEffect(() => {
        const interval = setInterval(() => setTick(t => t + 1), 400);
        return () => clearInterval(interval);
    }, []);

    useEffect(() => {
        const code         = searchParams.get('code');
        const state        = searchParams.get('state');
        const codeVerifier = sessionStorage.getItem('oauth_cv');
        sessionStorage.removeItem('oauth_cv');  // consume immediately

        if (!code || !state || !codeVerifier) {
            navigate('/batch?error=oauth_missing_params', { replace: true });
            return;
        }

        const exchangeToken = async () => {
            try {
                const res = await fetch(`${API_BASE_URL}/github/token`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ code, state, code_verifier: codeVerifier })
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

    const dots = '.'.repeat((tick % 3) + 1).padEnd(3, ' ');
    const cursor = tick % 2 === 0 ? '█' : ' ';

    return (
        <div style={{
            minHeight: '100vh',
            backgroundColor: '#000',
            display: 'flex',
            flexDirection: 'column',
            fontFamily: FONT,
        }}>
            {/* Status Strip */}
            <div style={{
                borderBottom: '1px solid #1E1E1E',
                padding: '0 24px',
                height: '28px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                backgroundColor: '#000',
            }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '24px' }}>
                    <span style={{ fontSize: '10px', color: ACCENT, letterSpacing: '0.12em' }}>
                        SOTERIA
                    </span>
                    <span style={{ fontSize: '10px', color: '#333', letterSpacing: '0.1em' }}>
                        MODULE::OAUTH_CALLBACK
                    </span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                    <span style={{ fontSize: '10px', color: error ? '#FF4444' : ACCENT, letterSpacing: '0.1em' }}>
                        {error ? '[ ERROR ]' : '[ HANDSHAKE ]'}
                    </span>
                    <span style={{ fontSize: '10px', color: '#333', letterSpacing: '0.08em' }}>
                        GITHUB / PKCE
                    </span>
                </div>
            </div>

            {/* Main Content */}
            <div style={{
                flex: 1,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                padding: '40px 24px',
            }}>
                {error ? (
                    <div style={{
                        border: '1px solid #FF4444',
                        backgroundColor: '#000',
                        padding: '40px',
                        maxWidth: '520px',
                        width: '100%',
                    }}>
                        {/* Error Header */}
                        <div style={{
                            borderBottom: '1px solid #1E1E1E',
                            paddingBottom: '16px',
                            marginBottom: '24px',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'space-between',
                        }}>
                            <span style={{ fontSize: '10px', color: '#FF4444', letterSpacing: '0.15em', fontFamily: FONT }}>
                                AUTH_FAILURE
                            </span>
                            <span style={{ fontSize: '10px', color: '#333', letterSpacing: '0.1em', fontFamily: FONT }}>
                                EXIT_CODE 1
                            </span>
                        </div>

                        {/* Error Body */}
                        <div style={{ marginBottom: '32px' }}>
                            <div style={{
                                fontSize: '11px',
                                color: '#555',
                                letterSpacing: '0.08em',
                                marginBottom: '8px',
                                fontFamily: FONT,
                            }}>
                                STDERR::
                            </div>
                            <div style={{
                                fontSize: '13px',
                                color: '#FF6666',
                                lineHeight: '1.6',
                                fontFamily: FONT,
                                padding: '12px',
                                border: '1px solid #1E1E1E',
                                backgroundColor: '#0a0000',
                            }}>
                                {error} {cursor}
                            </div>
                        </div>

                        {/* Trace */}
                        <div style={{ marginBottom: '32px' }}>
                            <div style={{ fontSize: '10px', color: '#333', letterSpacing: '0.08em', marginBottom: '8px', fontFamily: FONT }}>
                                TRACE::
                            </div>
                            {['oauth_pkce_exchange', 'github_token_endpoint', 'session_storage_cv'].map((step, i) => (
                                <div key={step} style={{
                                    fontSize: '10px',
                                    color: i === 0 ? '#FF4444' : '#2a2a2a',
                                    fontFamily: FONT,
                                    padding: '4px 0',
                                    letterSpacing: '0.06em',
                                }}>
                                    {i === 0 ? '▶' : ' '} [{String(i).padStart(2, '0')}] {step}
                                </div>
                            ))}
                        </div>

                        {/* Action */}
                        <button
                            onClick={() => navigate('/batch')}
                            style={{
                                fontFamily: FONT,
                                fontSize: '11px',
                                letterSpacing: '0.15em',
                                backgroundColor: '#000',
                                color: ACCENT,
                                border: `1px solid ${ACCENT}`,
                                padding: '10px 24px',
                                cursor: 'pointer',
                                borderRadius: '0px',
                                textTransform: 'uppercase',
                                transition: 'background-color 0.15s',
                                width: '100%',
                            }}
                            onMouseEnter={e => {
                                (e.target as HTMLButtonElement).style.backgroundColor = ACCENT;
                                (e.target as HTMLButtonElement).style.color = '#000';
                            }}
                            onMouseLeave={e => {
                                (e.target as HTMLButtonElement).style.backgroundColor = '#000';
                                (e.target as HTMLButtonElement).style.color = ACCENT;
                            }}
                        >
                            ← RETURN TO SCANNER
                        </button>
                    </div>
                ) : (
                    <div style={{
                        border: '1px solid #1E1E1E',
                        backgroundColor: '#000',
                        padding: '40px',
                        maxWidth: '520px',
                        width: '100%',
                    }}>
                        {/* Panel Header */}
                        <div style={{
                            borderBottom: '1px solid #1E1E1E',
                            paddingBottom: '16px',
                            marginBottom: '32px',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'space-between',
                        }}>
                            <span style={{ fontSize: '10px', color: ACCENT, letterSpacing: '0.15em', fontFamily: FONT }}>
                                OAUTH_HANDSHAKE
                            </span>
                            <span style={{ fontSize: '10px', color: ACCENT, letterSpacing: '0.1em', fontFamily: FONT }}>
                                [ LIVE ]
                            </span>
                        </div>

                        {/* Spinner Block */}
                        <div style={{ marginBottom: '32px' }}>
                            <div style={{
                                display: 'grid',
                                gridTemplateColumns: 'repeat(8, 1fr)',
                                gap: '4px',
                                marginBottom: '24px',
                            }}>
                                {Array.from({ length: 16 }).map((_, i) => (
                                    <div key={i} style={{
                                        height: '3px',
                                        backgroundColor: (tick + i) % 4 === 0 ? ACCENT : '#1E1E1E',
                                        transition: 'background-color 0.2s',
                                    }} />
                                ))}
                            </div>

                            <div style={{
                                fontSize: '14px',
                                color: '#fff',
                                letterSpacing: '0.12em',
                                marginBottom: '8px',
                                fontFamily: FONT,
                                textTransform: 'uppercase',
                            }}>
                                CONNECTING TO GITHUB{dots}
                            </div>
                            <div style={{
                                fontSize: '11px',
                                color: '#555',
                                letterSpacing: '0.06em',
                                fontFamily: FONT,
                            }}>
                                PKCE token exchange in progress
                            </div>
                        </div>

                        {/* Process Log */}
                        <div style={{ borderTop: '1px solid #1E1E1E', paddingTop: '20px' }}>
                            <div style={{ fontSize: '10px', color: '#333', letterSpacing: '0.08em', marginBottom: '10px', fontFamily: FONT }}>
                                PROCESS::
                            </div>
                            {[
                                { label: 'verifying code_verifier', done: true },
                                { label: 'sending pkce exchange request', done: tick > 2 },
                                { label: 'awaiting github response', done: tick > 5 },
                                { label: 'storing access token', done: false },
                            ].map((step, i) => (
                                <div key={i} style={{
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: '10px',
                                    padding: '3px 0',
                                    fontFamily: FONT,
                                    fontSize: '10px',
                                    color: step.done ? ACCENT : '#333',
                                    letterSpacing: '0.06em',
                                }}>
                                    <span>{step.done ? '✓' : '○'}</span>
                                    <span>{step.label}</span>
                                </div>
                            ))}
                        </div>
                    </div>
                )}
            </div>

            {/* Footer Strip */}
            <div style={{
                borderTop: '1px solid #1E1E1E',
                padding: '0 24px',
                height: '28px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
            }}>
                <span style={{ fontSize: '10px', color: '#222', letterSpacing: '0.08em', fontFamily: FONT }}>
                    SOTERIA SECURITY PLATFORM
                </span>
                <span style={{ fontSize: '10px', color: '#222', letterSpacing: '0.08em', fontFamily: FONT }}>
                    RFC 7636 COMPLIANT
                </span>
            </div>
        </div>
    );
}
