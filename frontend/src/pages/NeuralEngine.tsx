import { useState, useEffect, useRef } from 'react';
import { motion } from 'framer-motion';
import { Brain, Activity, Database, Play, Cpu, Server, Lock, HardDrive, Clock, CheckCircle2, XCircle, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import TrainingTerminal from '@/components/TrainingTerminal';
import { API_BASE_URL } from '../lib/api';

interface ModelStats {
    status: string;
    accuracy: string;
    last_trained: string;
    model_type: string;
    file_size: string;
    features_count: number;
}

export default function NeuralEngine() {
    const [modelStats, setModelStats] = useState<ModelStats>({
        status: 'loading',
        accuracy: '—',
        last_trained: '—',
        model_type: '—',
        file_size: '—',
        features_count: 0
    });
    const [isTraining, setIsTraining] = useState(false);
    const [logs, setLogs] = useState<string[]>([]);
    const [hardwareInfo, setHardwareInfo] = useState({
        cores: navigator.hardwareConcurrency || 0,
        platform: navigator.platform || 'Unknown',
    });
    const [statsLoading, setStatsLoading] = useState(true);

    useEffect(() => {
        fetchModelStats();
    }, []);

    const fetchModelStats = async () => {
        setStatsLoading(true);
        try {
            const res = await fetch(`${API_BASE_URL}/model-stats`);
            const data = await res.json();
            setModelStats(data);
        } catch (e) {
            console.error("Failed to fetch stats", e);
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

            if (!response.ok) {
                throw new Error(`HTTP ${response.status}`);
            }

            const reader = response.body?.getReader();
            const decoder = new TextDecoder();

            if (!reader) throw new Error('No response stream');

            while (true) {
                const { done, value } = await reader.read();
                if (done) break;

                const chunk = decoder.decode(value, { stream: true });
                const lines = chunk.split('\n');

                for (const line of lines) {
                    if (line.startsWith('data: ')) {
                        const msg = line.slice(6);
                        if (msg === '[STREAM_END]') {
                            setIsTraining(false);
                            fetchModelStats(); // Refresh stats after training
                            return;
                        }
                        const timestamp = new Date().toLocaleTimeString();
                        if (msg.startsWith('[DONE]')) {
                            setLogs(prev => [...prev, `\x1b[32m${msg}\x1b[0m`]);
                        } else if (msg.startsWith('[ERROR]')) {
                            setLogs(prev => [...prev, `\x1b[31m${msg}\x1b[0m`]);
                        } else {
                            setLogs(prev => [...prev, `[${timestamp}] ${msg}`]);
                        }
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

    const statusColor = modelStats.status === 'ready' ? 'text-green-400' : modelStats.status === 'loading' ? 'text-yellow-400' : 'text-red-400';
    const statusIcon = modelStats.status === 'ready' ? <CheckCircle2 className="w-4 h-4 text-green-500" /> : modelStats.status === 'no_model' ? <XCircle className="w-4 h-4 text-red-500" /> : <RefreshCw className="w-4 h-4 text-yellow-500 animate-spin" />;

    return (
        <div className="min-h-screen bg-[#020617] text-slate-200 py-12 px-6">
            <div className="max-w-7xl mx-auto grid grid-cols-1 lg:grid-cols-12 gap-8">

                {/* HEADER */}
                <div className="lg:col-span-12 mb-8 flex justify-between items-end">
                    <div>
                        <div className="flex items-center gap-2 text-cyan-400 mb-2">
                            <Brain className="w-5 h-5" />
                            <span className="text-xs font-bold tracking-widest uppercase">Soteria Neural Engine</span>
                        </div>
                        <h1 className="text-5xl font-black text-white tracking-tighter">LOCAL INTELLIGENCE LAB</h1>
                        <p className="text-slate-500 mt-2 max-w-2xl">
                            Train, fine-tune, and deploy custom security models directly on your hardware.
                            Zero data egress. 100% Privacy.
                        </p>
                    </div>
                    <div className="flex gap-4">
                        <div className="px-4 py-2 bg-slate-900 rounded-lg border border-slate-800 flex items-center gap-3">
                            <Lock className="w-4 h-4 text-green-500" />
                            <span className="text-xs font-mono text-slate-400">Environment: <span className="text-white">LOCAL_AIRGAPPED</span></span>
                        </div>
                    </div>
                </div>

                {/* METRICS CARDS — Live Data */}
                <div className="lg:col-span-8 grid grid-cols-2 md:grid-cols-4 gap-4">

                    {/* Model Status */}
                    <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}
                        className="p-5 rounded-2xl bg-slate-900/50 border border-slate-800 backdrop-blur-xl">
                        <div className="flex items-center gap-2 mb-3 text-slate-400">
                            <Activity className="w-4 h-4" />
                            <span className="text-[10px] font-bold tracking-wider uppercase">Status</span>
                        </div>
                        <div className="flex items-center gap-2">
                            {statusIcon}
                            <span className={`text-lg font-black uppercase ${statusColor}`}>
                                {statsLoading ? 'Loading...' : modelStats.status === 'ready' ? 'Ready' : modelStats.status === 'no_model' ? 'No Model' : 'Offline'}
                            </span>
                        </div>
                        <div className="text-[10px] text-slate-600 mt-1 font-mono">{modelStats.model_type}</div>
                    </motion.div>

                    {/* Accuracy / Training Info */}
                    <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.05 }}
                        className="p-5 rounded-2xl bg-slate-900/50 border border-slate-800 backdrop-blur-xl">
                        <div className="flex items-center gap-2 mb-3 text-slate-400">
                            <Database className="w-4 h-4" />
                            <span className="text-[10px] font-bold tracking-wider uppercase">Accuracy</span>
                        </div>
                        <div className="text-2xl font-black text-white">{statsLoading ? '—' : modelStats.accuracy}</div>
                        <div className="text-[10px] text-slate-600 mt-1 font-mono">{modelStats.features_count} features</div>
                    </motion.div>

                    {/* Last Trained */}
                    <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}
                        className="p-5 rounded-2xl bg-slate-900/50 border border-slate-800 backdrop-blur-xl">
                        <div className="flex items-center gap-2 mb-3 text-slate-400">
                            <Clock className="w-4 h-4" />
                            <span className="text-[10px] font-bold tracking-wider uppercase">Last Trained</span>
                        </div>
                        <div className="text-lg font-black text-white">{statsLoading ? '—' : modelStats.last_trained}</div>
                        <div className="text-[10px] text-slate-600 mt-1 font-mono">{modelStats.file_size}</div>
                    </motion.div>

                    {/* Hardware */}
                    <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.15 }}
                        className="p-5 rounded-2xl bg-slate-900/50 border border-slate-800 backdrop-blur-xl">
                        <div className="flex items-center gap-2 mb-3 text-slate-400">
                            <Cpu className="w-4 h-4" />
                            <span className="text-[10px] font-bold tracking-wider uppercase">Hardware</span>
                        </div>
                        <div className="text-lg font-black text-white">{hardwareInfo.cores} Cores</div>
                        <div className="text-[10px] text-slate-600 mt-1 font-mono">{hardwareInfo.platform}</div>
                    </motion.div>

                </div>

                {/* ACTIONS */}
                <div className="lg:col-span-4 flex flex-col gap-4">
                    <Button
                        onClick={startTraining}
                        disabled={isTraining}
                        className="h-full min-h-[140px] rounded-3xl bg-cyan-500 hover:bg-cyan-400 text-black font-black text-xl tracking-tight transition-all shadow-lg shadow-cyan-900/20 active:scale-95 flex flex-col items-center justify-center gap-2"
                    >
                        {isTraining ? (
                            <>
                                <Play className="w-8 h-8 animate-spin" />
                                <span>TRAINING IN PROGRESS...</span>
                                <span className="text-xs font-normal opacity-60">Streaming real pipeline output</span>
                            </>
                        ) : modelStats.status === 'no_model' ? (
                            <>
                                <HardDrive className="w-8 h-8" />
                                <span>TRAIN FIRST MODEL</span>
                                <span className="text-xs font-normal opacity-60">No model detected — initialize pipeline</span>
                            </>
                        ) : (
                            <>
                                <Server className="w-8 h-8" />
                                <span>RETRAIN MODEL</span>
                                <span className="text-xs font-normal opacity-60">Full Pipeline: Data → Features → Model</span>
                            </>
                        )}
                    </Button>
                </div>

                {/* TERMINAL */}
                <div className="lg:col-span-12 h-[500px] bg-[#020617] rounded-3xl border border-slate-800 p-1 overflow-hidden relative shadow-2xl">
                    <div className="absolute top-4 right-4 z-10 flex gap-2">
                        <div className={`w-3 h-3 rounded-full ${isTraining ? 'bg-green-500 animate-pulse' : 'bg-red-500/20'} border border-red-500/50`}></div>
                        <div className="w-3 h-3 rounded-full bg-yellow-500/20 border border-yellow-500/50"></div>
                        <div className="w-3 h-3 rounded-full bg-green-500/20 border border-green-500/50"></div>
                    </div>
                    <TrainingTerminal logs={logs} />
                </div>

            </div>
        </div>
    );
}
