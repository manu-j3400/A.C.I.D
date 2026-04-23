import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { API_BASE_URL } from '@/lib/api';
import { useAuth } from '@/context/AuthContext';
import TrainingTerminal from '@/components/TrainingTerminal';

interface ModelStats {
    status: string;
    accuracy: string;
    last_trained: string;
    model_type: string;
    file_size: string;
    features_count: number;
    engines?: { sklearn: boolean; gcn: boolean; entropy: boolean; snn: boolean; };
}

interface EngineEntry {
    label: string;
    description: string;
    loaded: boolean;
    checkpoint?: boolean | null;
    error?: string | null;
}

interface EnginesStatus {
    engines: Record<string, EngineEntry>;
    summary: { total: number; loaded: number; vulnerability_patterns: number; };
}

interface DriftData {
    kl_divergence: number;
    drift_alert: boolean;
    total_samples: number;
    recent_mean: number;
    status: string;
}

import { COLORS } from '../theme/colors';
const C = {
    acid:   COLORS.acid,
    red:    COLORS.red,
    amber:  COLORS.orange,
    dim:    COLORS.surface,
    border: COLORS.border,
    muted:  COLORS.muted,
    text:   COLORS.text,
    sub:    COLORS.sub,
};

// Short labels for the status strip chips
const ENGINE_SHORT: Record<string, string> = {
    sklearn_ensemble: 'SKL', gcn: 'GCN', entropy: 'ENT', snn: 'SNN',
    deceptinet: 'DCN', symbapt: 'SYM', rlshield: 'RLS',
    memshield: 'MEM', containerguard: 'CGD', agentshield: 'AGS',
};

// Legacy 4-engine map used by model-stats endpoint
const ENGINE_META = [
    {
        key: 'sklearn' as const,
        label: 'ENSEMBLE CLASSIFIER',
        short: 'SKLEARN',
        desc: 'Random forest + gradient boosting over 52 AST features. Primary malware/clean classifier.',
        offline: 'Train the model using the button below to activate.',
    },
    {
        key: 'gcn' as const,
        label: 'GRAPH NEURAL NET',
        short: 'GCN',
        desc: 'GATConv network over control-flow graph. Catches structural obfuscation patterns.',
        offline: 'Requires GCN training pipeline to produce acidModel_gcn.pt.',
    },
    {
        key: 'entropy' as const,
        label: 'ENTROPY SCANNER',
        short: 'ENT',
        desc: 'Shannon entropy per string/bytes literal. Flags encrypted payloads and base64 shellcode.',
        offline: 'entropy_profiler dependency unavailable in this environment.',
    },
    {
        key: 'snn' as const,
        label: 'SPIKING NEURAL NET',
        short: 'SNN',
        desc: 'LIF neuron network profiling execution timing. Detects decryption loops and C2 rhythms.',
        offline: 'Requires snn_baseline.pt — run the SNN bootstrap script to train.',
    },
];

export default function NeuralEngine() {
    const { token } = useAuth();
    const [modelStats, setModelStats] = useState<ModelStats>({
        status: 'loading', accuracy: '—', last_trained: '—',
        model_type: '—', file_size: '—', features_count: 0,
    });
    const [isTraining, setIsTraining] = useState(false);
    const [logs, setLogs] = useState<string[]>([]);
    const [statsLoading, setStatsLoading] = useState(true);
    const [driftData, setDriftData] = useState<DriftData | null>(null);
    const [enginesStatus, setEnginesStatus] = useState<EnginesStatus | null>(null);

    useEffect(() => {
        fetchModelStats();
        fetchEnginesStatus();
        if (token) {
            fetch(`${API_BASE_URL}/api/model/drift`, { headers: { Authorization: `Bearer ${token}` } })
                .then(r => r.json()).then(setDriftData).catch(() => {});
        }
    }, [token]);

    const fetchEnginesStatus = async () => {
        try {
            const res = await fetch(`${API_BASE_URL}/api/engines/status`);
            if (res.ok) setEnginesStatus(await res.json());
        } catch { /* middleware offline */ }
    };

    const fetchModelStats = async () => {
        setStatsLoading(true);
        try {
            const res = await fetch(`${API_BASE_URL}/model-stats`);
            setModelStats(await res.json());
        } catch {
            setModelStats(prev => ({ ...prev, status: 'offline' }));
        } finally {
            setStatsLoading(false);
        }
    };

    const startTraining = async () => {
        setIsTraining(true);
        setLogs(['\x1b[33m[INIT] Connecting to training pipeline...\x1b[0m']);
        try {
            const response = await fetch(`${API_BASE_URL}/train-stream`, { method: 'POST' });
            if (!response.ok) throw new Error(`HTTP ${response.status}`);
            const reader = response.body?.getReader();
            const decoder = new TextDecoder();
            if (!reader) throw new Error('No stream');
            while (true) {
                const { done, value } = await reader.read(); if (done) break;
                const chunk = decoder.decode(value, { stream: true });
                for (const line of chunk.split('\n')) {
                    if (!line.startsWith('data: ')) continue;
                    const msg = line.slice(6);
                    if (msg === '[STREAM_END]') { setIsTraining(false); fetchModelStats(); return; }
                    const ts = new Date().toLocaleTimeString();
                    if (msg.startsWith('[DONE]')) setLogs(p => [...p, `\x1b[32m${msg}\x1b[0m`]);
                    else if (msg.startsWith('[ERROR]')) setLogs(p => [...p, `\x1b[31m${msg}\x1b[0m`]);
                    else setLogs(p => [...p, `[${ts}] ${msg}`]);
                }
            }
        } catch (e) {
            setLogs(p => [...p, `\x1b[31m[ERROR] Training failed: ${e}\x1b[0m`]);
        } finally {
            setIsTraining(false);
            fetchModelStats();
        }
    };

    const resolvedEngines = {
        sklearn: modelStats.engines?.sklearn ?? (modelStats.status === 'ready'),
        gcn:     modelStats.engines?.gcn     ?? false,
        entropy: modelStats.engines?.entropy ?? false,
        snn:     modelStats.engines?.snn     ?? false,
    };
    const activeCount = Object.values(resolvedEngines).filter(Boolean).length;

    const sysStatus = modelStats.status === 'ready' ? 'OPERATIONAL'
        : modelStats.status === 'no_model' ? 'NO MODEL'
        : modelStats.status === 'loading'  ? 'LOADING'
        : 'OFFLINE';
    const sysColor = modelStats.status === 'ready' ? C.acid
        : modelStats.status === 'loading'  ? C.amber
        : C.red;

    return (
        <div style={{
            minHeight: '100vh', background: '#000',
            fontFamily: "'JetBrains Mono', monospace",
            color: C.text,
        }}>
            {/* ── TOP STATUS STRIP ─────────────────────────────────────────── */}
            <div style={{
                display: 'flex', alignItems: 'center', height: 36,
                borderBottom: `1px solid ${C.border}`, fontSize: 10,
                letterSpacing: '0.08em',
            }}>
                <EngCell style={{ color: sysColor, fontWeight: 700, minWidth: 200 }}>
                    KYBER ENGINE — {statsLoading ? 'LOADING...' : sysStatus}
                </EngCell>
                <EngCell>ML ENGINES: <span style={{ color: C.text }}>{statsLoading ? '—' : activeCount}/4 ACTIVE</span></EngCell>
                <EngCell>ALL ENGINES: <span style={{ color: enginesStatus ? C.acid : C.sub }}>{enginesStatus ? `${enginesStatus.summary.loaded}/${enginesStatus.summary.total}` : '—'}</span></EngCell>
                <EngCell>PATTERNS: <span style={{ color: C.text }}>{enginesStatus?.summary.vulnerability_patterns ?? '—'}</span></EngCell>
                <EngCell>ACCURACY: <span style={{ color: C.text }}>{statsLoading ? '—' : modelStats.accuracy}</span></EngCell>
                {driftData?.drift_alert && (
                    <EngCell style={{ color: C.amber, fontWeight: 700 }}>[ DRIFT ALERT ]</EngCell>
                )}
                <EngCell style={{ marginLeft: 'auto' }}>
                    <button
                        onClick={fetchModelStats}
                        style={{ color: C.sub, background: 'none', border: 'none', cursor: 'pointer', fontFamily: 'inherit', fontSize: 10, letterSpacing: '0.08em' }}
                        onMouseEnter={e => (e.currentTarget.style.color = C.text)}
                        onMouseLeave={e => (e.currentTarget.style.color = C.sub)}
                    >
                        [ REFRESH ]
                    </button>
                </EngCell>
            </div>

            <div style={{ display: 'flex', height: 'calc(100vh - 36px)' }}>

                {/* ── LEFT COLUMN ──────────────────────────────────────────── */}
                <div style={{ width: 320, flexShrink: 0, borderRight: `1px solid ${C.border}`, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>

                    {/* Engine status list */}
                    <div style={{ borderBottom: `1px solid ${C.border}`, padding: '12px 0' }}>
                        <div style={{ fontSize: 8, color: C.sub, letterSpacing: '0.14em', padding: '0 16px', marginBottom: 8 }}>DETECTION LAYERS</div>
                        {ENGINE_META.map(({ key, label, short, desc, offline }) => {
                            const active = resolvedEngines[key];
                            return (
                                <motion.div
                                    key={key}
                                    initial={{ opacity: 0, x: -8 }}
                                    animate={{ opacity: 1, x: 0 }}
                                    style={{
                                        padding: '10px 16px',
                                        borderLeft: `2px solid ${active ? C.acid : C.border}`,
                                        marginLeft: 0,
                                        background: active ? 'rgba(173,255,47,0.03)' : 'transparent',
                                        marginBottom: 1,
                                    }}
                                >
                                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                                            <span style={{ fontSize: 8, color: active ? C.acid : C.muted, border: `1px solid ${active ? C.acid : C.muted}`, padding: '1px 4px', fontWeight: 700 }}>
                                                {short}
                                            </span>
                                            <span style={{ fontSize: 9, color: active ? C.text : C.sub, fontWeight: active ? 700 : 400 }}>{label}</span>
                                        </div>
                                        <span style={{ fontSize: 8, color: active ? C.acid : C.red, fontWeight: 700 }}>
                                            {active ? '[ LIVE ]' : '[ OFFLINE ]'}
                                        </span>
                                    </div>
                                    <div style={{ fontSize: 8, color: C.sub, lineHeight: 1.6 }}>
                                        {active ? desc : offline}
                                    </div>
                                </motion.div>
                            );
                        })}
                    </div>

                    {/* Extended engine fleet */}
                    {enginesStatus && (
                        <div style={{ borderBottom: `1px solid ${C.border}`, padding: '12px 0' }}>
                            <div style={{ fontSize: 8, color: C.sub, letterSpacing: '0.14em', padding: '0 16px', marginBottom: 8 }}>ENGINE FLEET</div>
                            {Object.entries(enginesStatus.engines).map(([key, eng]) => (
                                <div key={key} style={{
                                    display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                                    padding: '5px 16px', borderLeft: `2px solid ${eng.loaded ? C.acid : C.border}`,
                                    marginBottom: 1, background: eng.loaded ? 'rgba(173,255,47,0.02)' : 'transparent',
                                }}>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                                        <span style={{
                                            fontSize: 7, border: `1px solid ${eng.loaded ? C.acid : C.muted}`,
                                            color: eng.loaded ? C.acid : C.muted, padding: '1px 3px', fontWeight: 700,
                                        }}>
                                            {ENGINE_SHORT[key] ?? key.slice(0, 3).toUpperCase()}
                                        </span>
                                        <span style={{ fontSize: 8, color: eng.loaded ? C.text : C.sub }}>{eng.label}</span>
                                    </div>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                                        {eng.checkpoint !== undefined && eng.checkpoint !== null && (
                                            <span style={{ fontSize: 7, color: eng.checkpoint ? C.acid : C.amber }}>
                                                {eng.checkpoint ? '✓ PT' : '✗ PT'}
                                            </span>
                                        )}
                                        <span style={{ fontSize: 7, color: eng.loaded ? C.acid : C.red, fontWeight: 700 }}>
                                            {eng.loaded ? 'LIVE' : 'OFF'}
                                        </span>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}

                    {/* Model metadata */}
                    <div style={{ borderBottom: `1px solid ${C.border}`, padding: '12px 0' }}>
                        <div style={{ fontSize: 8, color: C.sub, letterSpacing: '0.14em', padding: '0 16px', marginBottom: 8 }}>MODEL METADATA</div>
                        {[
                            { label: 'TYPE',     value: modelStats.model_type },
                            { label: 'TRAINED',  value: modelStats.last_trained },
                            { label: 'SIZE',     value: modelStats.file_size },
                        ].map(({ label, value }) => (
                            <div key={label} style={{ display: 'flex', justifyContent: 'space-between', padding: '4px 16px', fontSize: 9 }}>
                                <span style={{ color: C.sub }}>{label}</span>
                                <span style={{ color: C.text }}>{statsLoading ? '—' : value}</span>
                            </div>
                        ))}
                    </div>

                    {/* Drift panel */}
                    <div style={{ padding: '12px 0' }}>
                        <div style={{ fontSize: 8, color: C.sub, letterSpacing: '0.14em', padding: '0 16px', marginBottom: 8 }}>
                            DRIFT MONITOR
                            {driftData?.drift_alert && (
                                <span style={{ marginLeft: 8, color: C.amber }}>[ ALERT ]</span>
                            )}
                        </div>
                        {!driftData ? (
                            <div style={{ padding: '4px 16px', fontSize: 9, color: C.sub, lineHeight: 1.7 }}>
                                Run scans to populate drift tracking.
                                KL divergence measured against training distribution.
                            </div>
                        ) : (
                            <>
                                {[
                                    { label: 'KL DIVERGENCE', value: driftData.kl_divergence?.toFixed(3) ?? '—', alert: driftData.drift_alert },
                                    { label: 'SCANS SAMPLED', value: String(driftData.total_samples) },
                                    { label: 'AVG RISK (RECENT)', value: `${(driftData.recent_mean * 100).toFixed(1)}%` },
                                    { label: 'STATUS', value: driftData.drift_alert ? 'DRIFTING' : 'STABLE', alert: driftData.drift_alert },
                                ].map(({ label, value, alert }) => (
                                    <div key={label} style={{ display: 'flex', justifyContent: 'space-between', padding: '4px 16px', fontSize: 9 }}>
                                        <span style={{ color: C.sub }}>{label}</span>
                                        <span style={{ color: alert ? C.amber : C.text, fontWeight: alert ? 700 : 400 }}>{value}</span>
                                    </div>
                                ))}
                                {driftData.drift_alert && (
                                    <div style={{ margin: '8px 16px', padding: '8px 10px', background: 'rgba(255,140,0,0.08)', border: `1px solid rgba(255,140,0,0.25)`, fontSize: 8, color: '#FFBA60', lineHeight: 1.6 }}>
                                        ! Model drift detected. Predictions have shifted from baseline. Retrain recommended.
                                    </div>
                                )}
                            </>
                        )}
                    </div>

                    {/* Spacer + retrain section */}
                    <div style={{ marginTop: 'auto', borderTop: `1px solid ${C.border}`, padding: 16 }}>
                        <div style={{ fontSize: 8, color: C.sub, letterSpacing: '0.12em', marginBottom: 10 }}>TRAINING PIPELINE</div>
                        <ul style={{ margin: '0 0 14px 0', padding: 0, listStyle: 'none', fontSize: 8, color: C.sub, lineHeight: 2 }}>
                            {['Extract AST features from malware corpus', 'Train sklearn ensemble classifier', 'Rebuild GCN training graphs', 'Reload model into analysis pipeline'].map(s => (
                                <li key={s} style={{ display: 'flex', gap: 6, alignItems: 'flex-start' }}>
                                    <span style={{ color: C.acid, marginTop: 1 }}>›</span>{s}
                                </li>
                            ))}
                        </ul>
                        <button
                            onClick={startTraining}
                            disabled={isTraining}
                            style={{
                                width: '100%', padding: '12px 0',
                                background: isTraining ? C.dim : C.acid,
                                border: `1px solid ${isTraining ? C.muted : C.acid}`,
                                color: isTraining ? C.sub : '#000',
                                fontFamily: "'JetBrains Mono', monospace", fontSize: 11,
                                fontWeight: 700, letterSpacing: '0.1em',
                                cursor: isTraining ? 'not-allowed' : 'pointer',
                                transition: 'background 0.15s',
                            }}
                        >
                            {isTraining ? '[ TRAINING... ]'
                                : modelStats.status === 'no_model' ? '[ TRAIN FIRST MODEL ]'
                                : '[ RETRAIN ENSEMBLE ]'}
                        </button>
                    </div>
                </div>

                {/* ── RIGHT: TERMINAL ───────────────────────────────────────── */}
                <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>

                    {/* Terminal header */}
                    <div style={{
                        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                        height: 36, borderBottom: `1px solid ${C.border}`,
                        padding: '0 16px', fontSize: 9, color: C.sub, letterSpacing: '0.1em',
                    }}>
                        <span>TRAINING PIPELINE OUTPUT</span>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                            <span style={{ width: 6, height: 6, borderRadius: '50%', background: isTraining ? C.acid : C.muted, display: 'inline-block', animation: isTraining ? 'pulse 1s infinite' : 'none' }} />
                            <span style={{ color: isTraining ? C.acid : C.sub }}>{isTraining ? '[ STREAMING ]' : '[ IDLE ]'}</span>
                        </div>
                    </div>

                    {/* Terminal body */}
                    <div style={{ flex: 1, overflow: 'hidden', background: C.dim }}>
                        {logs.length === 0 ? (
                            <div style={{ padding: 24, fontSize: 10, color: C.sub, lineHeight: 2 }}>
                                <div>kyber@soteria:~$ <span style={{ color: C.acid }}>_</span></div>
                                <div style={{ marginTop: 16, color: C.muted }}>TRAINING PIPELINE IDLE</div>
                                <div style={{ color: C.muted }}>CLICK [ RETRAIN ENSEMBLE ] TO START</div>
                                <div style={{ marginTop: 16, color: C.muted }}>PHASES: AST EXTRACTION → FEATURE MATRIX → SKLEARN → GCN → RELOAD</div>
                            </div>
                        ) : (
                            <TrainingTerminal logs={logs} />
                        )}
                    </div>
                </div>
            </div>

            <style>{`
                @keyframes pulse { 0%,100% { opacity: 1; } 50% { opacity: 0.3; } }
            `}</style>
        </div>
    );
}

function EngCell({ children, style }: { children: React.ReactNode; style?: React.CSSProperties }) {
    return (
        <div style={{
            display: 'flex', alignItems: 'center', height: '100%',
            padding: '0 14px', borderRight: '1px solid #1E1E1E',
            fontSize: 10, color: '#707070', letterSpacing: '0.08em',
            gap: 6, whiteSpace: 'nowrap', ...style,
        }}>
            {children}
        </div>
    );
}
