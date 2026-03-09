import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import {
    Brain, Activity, Database, Play, Cpu, Server,
    HardDrive, Clock, CheckCircle2, XCircle, RefreshCw,
    Zap, GitBranch, Waves, FlaskConical, AlertTriangle
} from 'lucide-react';
import { Button } from '@/components/ui/button';
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
    engines?: {
        sklearn: boolean;
        gcn: boolean;
        entropy: boolean;
        snn: boolean;
    };
}

const ENGINE_META = [
    {
        key: 'sklearn' as const,
        label: 'Ensemble Classifier',
        icon: Database,
        color: 'text-blue-400',
        bg: 'bg-blue-500/10 border-blue-500/20',
        desc: 'Random forest + gradient boosting over 52 AST features. Primary malware/clean classifier.',
        offlineReason: 'Train the model using the button above to activate.',
    },
    {
        key: 'gcn' as const,
        label: 'Graph Neural Net',
        icon: GitBranch,
        color: 'text-purple-400',
        bg: 'bg-purple-500/10 border-purple-500/20',
        desc: 'GATConv network over the code\'s control-flow graph. Catches structural obfuscation patterns.',
        offlineReason: 'Requires GCN training pipeline to produce acidModel_gcn.pt.',
    },
    {
        key: 'entropy' as const,
        label: 'Entropy Scanner',
        icon: Waves,
        color: 'text-cyan-400',
        bg: 'bg-cyan-500/10 border-cyan-500/20',
        desc: 'Shannon entropy per string/bytes literal. Flags encrypted payloads and base64-encoded shellcode.',
        offlineReason: 'entropy_profiler dependency unavailable in this environment.',
    },
    {
        key: 'snn' as const,
        label: 'Spiking Neural Net',
        icon: Zap,
        color: 'text-yellow-400',
        bg: 'bg-yellow-500/10 border-yellow-500/20',
        desc: 'LIF neuron network profiling execution timing. Detects decryption loops and C2 beacon rhythms.',
        offlineReason: 'Requires snn_baseline.pt — run the SNN bootstrap script to train.',
    },
];

export default function NeuralEngine() {
    const { token } = useAuth();
    const [modelStats, setModelStats] = useState<ModelStats>({
        status: 'loading',
        accuracy: '—',
        last_trained: '—',
        model_type: '—',
        file_size: '—',
        features_count: 0,
    });
    const [isTraining, setIsTraining] = useState(false);
    const [logs, setLogs] = useState<string[]>([]);
    const [statsLoading, setStatsLoading] = useState(true);
    const [driftData, setDriftData] = useState<{
        kl_divergence: number;
        drift_alert: boolean;
        total_samples: number;
        recent_mean: number;
        status: string;
    } | null>(null);

    useEffect(() => {
        fetchModelStats();
        if (token) {
            fetch(`${API_BASE_URL}/api/model/drift`, {
                headers: { Authorization: `Bearer ${token}` },
            })
                .then(r => r.json())
                .then(setDriftData)
                .catch(() => {});
        }
    }, [token]);

    const fetchModelStats = async () => {
        setStatsLoading(true);
        try {
            const res = await fetch(`${API_BASE_URL}/model-stats`);
            const data = await res.json();
            setModelStats(data);
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
            if (!reader) throw new Error('No response stream');

            while (true) {
                const { done, value } = await reader.read();
                if (done) break;

                const chunk = decoder.decode(value, { stream: true });
                for (const line of chunk.split('\n')) {
                    if (!line.startsWith('data: ')) continue;
                    const msg = line.slice(6);
                    if (msg === '[STREAM_END]') {
                        setIsTraining(false);
                        fetchModelStats();
                        return;
                    }
                    const ts = new Date().toLocaleTimeString();
                    if (msg.startsWith('[DONE]')) {
                        setLogs(prev => [...prev, `\x1b[32m${msg}\x1b[0m`]);
                    } else if (msg.startsWith('[ERROR]')) {
                        setLogs(prev => [...prev, `\x1b[31m${msg}\x1b[0m`]);
                    } else {
                        setLogs(prev => [...prev, `[${ts}] ${msg}`]);
                    }
                }
            }
        } catch (e) {
            setLogs(prev => [...prev, `\x1b[31m[ERROR] Training failed: ${e}\x1b[0m`]);
        } finally {
            setIsTraining(false);
            fetchModelStats();
        }
    };

    // Infer sklearn from model status when engines field is absent (older API)
    const resolvedEngines = {
        sklearn: modelStats.engines?.sklearn ?? (modelStats.status === 'ready'),
        gcn:     modelStats.engines?.gcn     ?? false,
        entropy: modelStats.engines?.entropy ?? false,
        snn:     modelStats.engines?.snn     ?? false,
    };

    const activeEngineCount = Object.values(resolvedEngines).filter(Boolean).length;

    const statusColor =
        modelStats.status === 'ready' ? 'text-green-400' :
        modelStats.status === 'loading' ? 'text-yellow-400' : 'text-red-400';

    const statusIcon =
        modelStats.status === 'ready' ? <CheckCircle2 className="w-4 h-4 text-green-500" /> :
        modelStats.status === 'no_model' ? <XCircle className="w-4 h-4 text-red-500" /> :
        <RefreshCw className="w-4 h-4 text-yellow-500 animate-spin" />;

    return (
        <div className="min-h-screen bg-black text-neutral-200 py-12 px-6">
            <div className="max-w-7xl mx-auto space-y-8">

                {/* HEADER */}
                <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
                    <div>
                        <div className="flex items-center gap-2 text-cyan-400 mb-2">
                            <Brain className="w-5 h-5" />
                            <span className="text-xs font-bold tracking-widest uppercase">Soteria Model Lab</span>
                        </div>
                        <h1 className="text-4xl md:text-5xl font-black text-white tracking-tighter">DETECTION ENGINES</h1>
                        <p className="text-neutral-400 mt-2 max-w-2xl text-sm">
                            Four independent ML engines analyse every scan simultaneously.
                            Their scores are blended into a single risk probability.
                            This page lets you retrain the ensemble and monitor model drift.
                        </p>
                    </div>
                    <div className="flex-shrink-0 px-4 py-2 rounded-lg border border-neutral-800 flex items-center gap-3">
                        <FlaskConical className="w-4 h-4 text-cyan-500" />
                        <span className="text-xs font-mono text-neutral-400">
                            Active engines: <span className="text-white font-bold">{statsLoading ? '…' : activeEngineCount}/4</span>
                        </span>
                    </div>
                </div>

                {/* ENGINE STATUS CARDS */}
                <div>
                    <p className="text-[10px] font-black text-neutral-500 uppercase tracking-widest mb-3">Detection Layers</p>
                    <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
                        {ENGINE_META.map(({ key, label, icon: Icon, color, bg, desc, offlineReason }) => {
                            const active = resolvedEngines[key];
                            return (
                                <motion.div
                                    key={key}
                                    initial={{ opacity: 0, y: 16 }}
                                    animate={{ opacity: 1, y: 0 }}
                                    className={`p-5 rounded-2xl border backdrop-blur-xl ${active ? bg : 'bg-neutral-900/50 border-neutral-800'}`}
                                >
                                    <div className="flex items-center justify-between mb-3">
                                        <div className="flex items-center gap-2">
                                            <Icon className={`w-4 h-4 ${active ? color : 'text-neutral-600'}`} />
                                            <span className="text-[10px] font-bold tracking-wider uppercase text-neutral-400">{label}</span>
                                        </div>
                                        <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                                            active
                                                ? 'bg-green-500/10 text-green-400 border border-green-500/20'
                                                : 'bg-neutral-800 text-neutral-600 border border-neutral-700'
                                        }`}>
                                            {active ? 'LIVE' : 'OFFLINE'}
                                        </span>
                                    </div>
                                    <p className="text-[11px] text-neutral-400 leading-relaxed">{desc}</p>
                                    {!active && (
                                        <p className="text-[10px] text-neutral-600 mt-2 leading-relaxed italic">{offlineReason}</p>
                                    )}
                                </motion.div>
                            );
                        })}
                    </div>
                </div>

                {/* METRICS + ACTIONS */}
                <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">

                    {/* METRICS */}
                    <div className="lg:col-span-8 grid grid-cols-2 md:grid-cols-3 gap-4">

                        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}
                            className="p-5 rounded-2xl bg-neutral-900/50 border border-neutral-800 backdrop-blur-xl">
                            <div className="flex items-center gap-2 mb-3 text-neutral-400">
                                <Activity className="w-4 h-4" />
                                <span className="text-[10px] font-bold tracking-wider uppercase">Ensemble Status</span>
                            </div>
                            <div className="flex items-center gap-2">
                                {statusIcon}
                                <span className={`text-lg font-black uppercase ${statusColor}`}>
                                    {statsLoading ? 'Loading…' :
                                        modelStats.status === 'ready' ? 'Ready' :
                                        modelStats.status === 'no_model' ? 'No Model' : 'Offline'}
                                </span>
                            </div>
                            <div className="text-[10px] text-neutral-400 mt-1 font-mono">{modelStats.model_type}</div>
                        </motion.div>

                        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.05 }}
                            className="p-5 rounded-2xl bg-neutral-900/50 border border-neutral-800 backdrop-blur-xl">
                            <div className="flex items-center gap-2 mb-3 text-neutral-400">
                                <Database className="w-4 h-4" />
                                <span className="text-[10px] font-bold tracking-wider uppercase">Accuracy</span>
                            </div>
                            <div className="text-2xl font-black text-white">{statsLoading ? '—' : modelStats.accuracy}</div>
                            <div className="text-[10px] text-neutral-400 mt-1 font-mono">{modelStats.features_count} AST features</div>
                        </motion.div>

                        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}
                            className="p-5 rounded-2xl bg-neutral-900/50 border border-neutral-800 backdrop-blur-xl">
                            <div className="flex items-center gap-2 mb-3 text-neutral-400">
                                <Clock className="w-4 h-4" />
                                <span className="text-[10px] font-bold tracking-wider uppercase">Last Trained</span>
                            </div>
                            <div className="text-sm font-black text-white">{statsLoading ? '—' : modelStats.last_trained}</div>
                            <div className="text-[10px] text-neutral-400 mt-1 font-mono">{modelStats.file_size}</div>
                        </motion.div>

                        {/* GCN Drift */}
                        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.15 }}
                            className={`p-5 rounded-2xl border backdrop-blur-xl col-span-2 md:col-span-3 ${
                                driftData?.drift_alert
                                    ? 'bg-orange-950/30 border-orange-500/30'
                                    : 'bg-neutral-900/50 border-neutral-800'
                            }`}>
                            <div className="flex items-center gap-2 mb-3 text-neutral-400">
                                <Activity className="w-4 h-4" />
                                <span className="text-[10px] font-bold tracking-wider uppercase">Model Drift Monitor</span>
                                {driftData?.drift_alert && (
                                    <span className="ml-auto text-[10px] font-bold text-orange-400 bg-orange-500/10 px-2 py-0.5 rounded-full border border-orange-500/20">
                                        RETRAIN RECOMMENDED
                                    </span>
                                )}
                            </div>
                            {!driftData || driftData.status === 'insufficient_data' ? (
                                <div className="text-sm text-neutral-400">
                                    Run Python code scans to populate drift tracking data.
                                    <span className="block text-[10px] text-neutral-500 mt-1">
                                        Drift is measured by KL divergence between historical and recent GCN score distributions.
                                        A high KL score means the model is behaving differently on new code — time to retrain.
                                    </span>
                                </div>
                            ) : (
                                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                                    <div>
                                        <div className={`text-2xl font-black ${driftData.drift_alert ? 'text-orange-400' : 'text-green-400'}`}>
                                            {driftData.kl_divergence.toFixed(3)}
                                        </div>
                                        <div className="text-[10px] text-neutral-400 mt-1 font-mono">KL Divergence</div>
                                    </div>
                                    <div>
                                        <div className="text-2xl font-black text-white">{driftData.total_samples}</div>
                                        <div className="text-[10px] text-neutral-400 mt-1 font-mono">Scans analysed</div>
                                    </div>
                                    <div>
                                        <div className="text-2xl font-black text-white">{(driftData.recent_mean * 100).toFixed(1)}%</div>
                                        <div className="text-[10px] text-neutral-400 mt-1 font-mono">Avg risk (recent)</div>
                                    </div>
                                    <div>
                                        <div className={`text-sm font-black px-2 py-1 rounded-lg inline-block ${
                                            driftData.drift_alert
                                                ? 'bg-orange-500/20 text-orange-400'
                                                : 'bg-green-500/20 text-green-400'
                                        }`}>
                                            {driftData.drift_alert ? 'Drifting' : 'Stable'}
                                        </div>
                                        <div className="text-[10px] text-neutral-400 mt-1 font-mono">Alert threshold: KL &gt; 0.5</div>
                                    </div>
                                </div>
                            )}
                        </motion.div>

                    </div>

                    {/* RETRAIN BUTTON + NOTE */}
                    <div className="lg:col-span-4 flex flex-col gap-4">
                        <Button
                            onClick={startTraining}
                            disabled={isTraining}
                            className="flex-1 min-h-[140px] rounded-2xl bg-cyan-900/80 hover:bg-cyan-800/80 text-white font-black text-lg tracking-tight transition-all border border-cyan-700/40 flex flex-col items-center justify-center gap-2"
                        >
                            {isTraining ? (
                                <>
                                    <Play className="w-7 h-7 animate-spin" />
                                    <span>TRAINING…</span>
                                    <span className="text-xs font-normal opacity-60">Streaming pipeline output below</span>
                                </>
                            ) : modelStats.status === 'no_model' ? (
                                <>
                                    <HardDrive className="w-7 h-7" />
                                    <span>TRAIN FIRST MODEL</span>
                                    <span className="text-xs font-normal opacity-60">No ensemble found — initialize pipeline</span>
                                </>
                            ) : (
                                <>
                                    <Server className="w-7 h-7" />
                                    <span>RETRAIN ENSEMBLE</span>
                                    <span className="text-xs font-normal opacity-60">Data → AST features → Model</span>
                                </>
                            )}
                        </Button>

                        {driftData?.drift_alert && (
                            <div className="p-4 rounded-2xl bg-orange-950/40 border border-orange-500/20 flex gap-3">
                                <AlertTriangle className="w-4 h-4 text-orange-400 flex-shrink-0 mt-0.5" />
                                <p className="text-xs text-orange-300">
                                    Drift detected. The model's predictions have shifted significantly
                                    from its training baseline. A retrain is recommended.
                                </p>
                            </div>
                        )}

                        <div className="p-4 rounded-2xl bg-neutral-950 border border-neutral-800">
                            <p className="text-[10px] font-black text-neutral-500 uppercase tracking-widest mb-2">What retraining does</p>
                            <ul className="space-y-1">
                                {[
                                    'Extracts AST features from the malware corpus',
                                    'Trains the sklearn ensemble classifier',
                                    'Rebuilds GCN training graphs',
                                    'Reloads model into the analysis pipeline',
                                ].map(s => (
                                    <li key={s} className="text-[11px] text-neutral-400 flex gap-2">
                                        <Cpu className="w-3 h-3 text-neutral-500 flex-shrink-0 mt-0.5" />
                                        {s}
                                    </li>
                                ))}
                            </ul>
                        </div>
                    </div>

                </div>

                {/* TERMINAL */}
                <div className="h-[480px] bg-black rounded-3xl border border-neutral-800 p-1 overflow-hidden relative shadow-2xl">
                    <div className="absolute top-4 left-5 z-10">
                        <span className="text-[10px] font-mono text-neutral-500 tracking-widest">TRAINING PIPELINE OUTPUT</span>
                    </div>
                    <div className="absolute top-4 right-4 z-10 flex gap-2">
                        <div className={`w-3 h-3 rounded-full ${isTraining ? 'bg-green-500 animate-pulse' : 'bg-neutral-700'} border border-neutral-600`}></div>
                        <div className="w-3 h-3 rounded-full bg-neutral-800 border border-neutral-700"></div>
                        <div className="w-3 h-3 rounded-full bg-neutral-800 border border-neutral-700"></div>
                    </div>
                    <TrainingTerminal logs={logs} />
                </div>

            </div>
        </div>
    );
}
