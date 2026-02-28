import { useState, useCallback, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Upload, FileCode2, ShieldCheck, AlertTriangle, Loader2, FolderOpen, X, BarChart3, Shield, Github } from 'lucide-react';
import { API_BASE_URL } from '@/lib/api';

interface BatchFileItem {
    filename: string;
    code: string;
    size: number;
}

interface ScanResult {
    filename: string;
    status: 'malicious' | 'clean' | 'error';
    message: string;
    risk_level: string;
    confidence: number;
    language: string;
    nodes_scanned?: number;
}

interface BatchSummary {
    total_files: number;
    threats: number;
    clean: number;
    project_score: number;
    project_grade: string;
}

type ScanState = 'idle' | 'scanning' | 'done';

export default function BatchScanner() {
    const [files, setFiles] = useState<BatchFileItem[]>([]);
    const [results, setResults] = useState<ScanResult[]>([]);
    const [summary, setSummary] = useState<BatchSummary | null>(null);
    const [scanState, setScanState] = useState<ScanState>('idle');
    const [dragActive, setDragActive] = useState(false);
    const [repoUrl, setRepoUrl] = useState('');
    const [githubToken, setGithubToken] = useState<string | null>(localStorage.getItem('github_token'));
    const [repos, setRepos] = useState<any[]>([]);
    const [isFetchingRepos, setIsFetchingRepos] = useState(false);
    const inputRef = useRef<HTMLInputElement>(null);

    useEffect(() => {
        if (!githubToken) return;
        const fetchRepos = async () => {
            setIsFetchingRepos(true);
            try {
                const res = await fetch(`${API_BASE_URL}/github/repos`, {
                    headers: { 'Authorization': `Bearer ${githubToken}` }
                });
                if (res.ok) {
                    const data = await res.json();
                    setRepos(data);
                } else if (res.status === 401) {
                    localStorage.removeItem('github_token');
                    setGithubToken(null);
                }
            } catch (e) {
                console.error('Failed to fetch repos', e);
            } finally {
                setIsFetchingRepos(false);
            }
        };
        fetchRepos();
    }, [githubToken]);

    const handleGithubConnect = () => {
        const clientId = 'Ov23li9feGBY4uoDs8du';
        window.location.href = `https://github.com/login/oauth/authorize?client_id=${clientId}&scope=repo`;
    };

    const readFile = (file: File): Promise<BatchFileItem> => {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = () => {
                resolve({
                    filename: file.name,
                    code: reader.result as string,
                    size: file.size
                });
            };
            reader.onerror = reject;
            reader.readAsText(file);
        });
    };

    const handleFiles = useCallback(async (fileList: FileList | File[]) => {
        const codeExtensions = [
            '.py', '.js', '.ts', '.tsx', '.jsx', '.java', '.c', '.cpp', '.h', '.hpp',
            '.cs', '.go', '.rb', '.php', '.rs', '.swift', '.kt', '.scala', '.sh',
            '.sql', '.html', '.css', '.vue', '.svelte'
        ];

        const validFiles = Array.from(fileList).filter(f => {
            const ext = '.' + f.name.split('.').pop()?.toLowerCase();
            return codeExtensions.includes(ext) && f.size < 50000;
        });

        const readFiles = await Promise.all(validFiles.map(readFile));
        setFiles(prev => {
            const existing = new Set(prev.map(f => f.filename));
            const newFiles = readFiles.filter(f => !existing.has(f.filename));
            return [...prev, ...newFiles];
        });
    }, []);

    const handleDrop = useCallback((e: React.DragEvent) => {
        e.preventDefault();
        setDragActive(false);

        if (e.dataTransfer.items) {
            const items = Array.from(e.dataTransfer.items);
            const fileItems = items.filter(item => item.kind === 'file').map(item => item.getAsFile()).filter(Boolean) as File[];
            handleFiles(fileItems);
        }
    }, [handleFiles]);

    const handleDragOver = useCallback((e: React.DragEvent) => {
        e.preventDefault();
        setDragActive(true);
    }, []);

    const handleDragLeave = useCallback(() => {
        setDragActive(false);
    }, []);

    const removeFile = (filename: string) => {
        setFiles(prev => prev.filter(f => f.filename !== filename));
    };

    const runBatchScan = async () => {
        if (files.length === 0) return;
        setScanState('scanning');
        setResults([]);
        setSummary(null);

        try {
            const res = await fetch(`${API_BASE_URL}/batch-scan`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    files: files.map(f => ({ filename: f.filename, code: f.code }))
                })
            });

            if (!res.ok) throw new Error('Batch scan failed');
            const data = await res.json();
            setResults(data.results);
            setSummary(data.summary);
            setScanState('done');
        } catch (err) {
            console.error('Batch scan error:', err);
            setScanState('idle');
        }
    };

    const runGithubScan = async () => {
        if (!repoUrl) return;
        setScanState('scanning');
        setResults([]);
        setSummary(null);

        try {
            const res = await fetch(`${API_BASE_URL}/github-scan`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ repo_url: repoUrl, access_token: githubToken })
            });

            if (!res.ok) throw new Error('GitHub scan failed');
            const data = await res.json();
            setResults(data.results);
            setSummary(data.summary);
            setScanState('done');
        } catch (err) {
            console.error('GitHub scan error:', err);
            setScanState('idle');
        }
    };

    const resetScan = () => {
        setFiles([]);
        setResults([]);
        setSummary(null);
        setScanState('idle');
    };

    const riskColors: Record<string, string> = {
        CRITICAL: 'bg-red-500/20 text-red-400',
        HIGH: 'bg-orange-500/20 text-orange-400',
        MEDIUM: 'bg-yellow-500/20 text-yellow-400',
        LOW: 'bg-green-500/20 text-green-400',
        INVALID: 'bg-neutral-500/20 text-neutral-400'
    };

    const gradeColors: Record<string, string> = {
        A: 'text-green-400', B: 'text-blue-400', C: 'text-yellow-400', D: 'text-orange-400', F: 'text-red-400'
    };

    return (
        <div className="p-10 max-w-6xl mx-auto space-y-8">

            {/* Header */}
            <div>
                <h1 className="text-3xl font-black text-white mb-2">Batch Scanner</h1>
                <p className="text-neutral-500">Drop multiple files or import a whole GitHub repository to scan your project.</p>
            </div>

            {/* GitHub Import */}
            {scanState === 'idle' && files.length === 0 && (
                <div className="bg-neutral-950 border border-white/[0.08] p-6 rounded-2xl flex flex-col md:flex-row items-center gap-6 justify-between">
                    <div>
                        <h2 className="text-xl font-bold text-white flex items-center gap-2 mb-2">
                            <Github className="w-5 h-5 text-neutral-400" />
                            GitHub Integration
                        </h2>
                        <p className="text-sm text-neutral-500">Connect your account to securely scan private repositories directly from your codebases.</p>
                    </div>

                    {!githubToken ? (
                        <button
                            onClick={handleGithubConnect}
                            className="px-6 py-3 bg-[#24292e] hover:bg-[#2f363d] border border-white/[0.1] text-white font-bold rounded-xl transition-colors flex items-center justify-center gap-2 whitespace-nowrap"
                        >
                            <Github className="w-4 h-4" />
                            Connect GitHub
                        </button>
                    ) : (
                        <div className="flex flex-col sm:flex-row w-full md:w-auto gap-3 items-center">
                            {isFetchingRepos ? (
                                <div className="px-4 py-2 text-sm text-neutral-400 flex items-center gap-2">
                                    <Loader2 className="w-4 h-4 animate-spin" /> Loading repos...
                                </div>
                            ) : (
                                <select
                                    className="bg-black border border-white/[0.1] text-white px-4 py-2.5 rounded-xl outline-none focus:border-blue-500 min-w-[250px] w-full"
                                    value={repoUrl}
                                    onChange={(e) => setRepoUrl(e.target.value)}
                                >
                                    <option value="">Select a repository...</option>
                                    {repos.map((r: any) => (
                                        <option key={r.id} value={r.clone_url}>{r.full_name} {r.private ? '🔒' : ''}</option>
                                    ))}
                                </select>
                            )}
                            <button
                                onClick={runGithubScan}
                                disabled={!repoUrl || isFetchingRepos}
                                className="px-6 py-2.5 bg-white text-black font-bold rounded-xl hover:bg-neutral-200 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 w-full sm:w-auto"
                            >
                                <Shield className="w-4 h-4" />
                                Scan
                            </button>
                        </div>
                    )}
                </div>
            )}

            {/* Drop Zone */}
            {scanState === 'idle' && (
                <motion.div
                    initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
                    onDrop={handleDrop}
                    onDragOver={handleDragOver}
                    onDragLeave={handleDragLeave}
                    onClick={() => inputRef.current?.click()}
                    className={`relative cursor-pointer rounded-2xl border-2 border-dashed p-12 text-center transition-all ${dragActive
                        ? 'border-blue-500 bg-blue-500/5'
                        : 'border-white/[0.08] bg-neutral-950/50 hover:border-white/[0.15] hover:bg-neutral-950'
                        }`}
                >
                    <input
                        ref={inputRef}
                        type="file"
                        multiple
                        className="hidden"
                        onChange={(e) => e.target.files && handleFiles(e.target.files)}
                        accept=".py,.js,.ts,.tsx,.jsx,.java,.c,.cpp,.h,.cs,.go,.rb,.php,.rs,.swift,.kt,.sh,.sql,.html,.css,.vue,.svelte"
                    />
                    <div className="w-16 h-16 mx-auto mb-4 rounded-full border border-dashed border-neutral-700 flex items-center justify-center">
                        <Upload className={`w-7 h-7 ${dragActive ? 'text-blue-400' : 'text-neutral-600'}`} />
                    </div>
                    <h3 className="text-lg font-bold text-neutral-300 mb-2">
                        {dragActive ? 'Drop files here' : 'Drag & drop code files'}
                    </h3>
                    <p className="text-sm text-neutral-600">
                        Supports .py, .js, .ts, .java, .c, .cpp, .go, .rb, .php and more • Max 50 files • 50KB per file
                    </p>
                </motion.div>
            )}

            {/* File List */}
            {files.length > 0 && scanState === 'idle' && (
                <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-4">
                    <div className="flex items-center justify-between">
                        <h2 className="text-xs font-black text-neutral-600 uppercase tracking-widest">
                            {files.length} File{files.length !== 1 ? 's' : ''} Ready
                        </h2>
                        <div className="flex gap-3">
                            <button
                                onClick={resetScan}
                                className="px-4 py-2 text-xs font-bold text-neutral-500 hover:text-white transition-colors"
                            >
                                Clear All
                            </button>
                            <button
                                onClick={runBatchScan}
                                className="px-6 py-2.5 bg-blue-600 hover:bg-blue-500 text-white text-sm font-bold rounded-xl transition-colors flex items-center gap-2"
                            >
                                <Shield className="w-4 h-4" />
                                Scan All Files
                            </button>
                        </div>
                    </div>

                    <div className="rounded-2xl border border-white/[0.06] bg-neutral-950 overflow-hidden divide-y divide-white/[0.04]">
                        {files.map((file) => (
                            <div key={file.filename} className="px-5 py-3 flex items-center justify-between hover:bg-white/[0.02]">
                                <div className="flex items-center gap-3">
                                    <FileCode2 className="w-4 h-4 text-blue-400" />
                                    <span className="text-sm text-neutral-300 font-mono">{file.filename}</span>
                                    <span className="text-[10px] text-neutral-600">{(file.size / 1024).toFixed(1)} KB</span>
                                </div>
                                <button onClick={() => removeFile(file.filename)} className="p-1 text-neutral-700 hover:text-red-400 transition-colors" aria-label={`Remove ${file.filename}`} title="Remove file">
                                    <X className="w-4 h-4" />
                                </button>
                            </div>
                        ))}
                    </div>
                </motion.div>
            )}

            {/* Scanning Animation */}
            {scanState === 'scanning' && (
                <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="text-center py-16">
                    <Loader2 className="w-12 h-12 text-blue-400 animate-spin mx-auto mb-4" />
                    <h3 className="text-lg font-bold text-white mb-2">
                        {repoUrl && files.length === 0 ? 'Cloning & Scanning Repository...' : `Scanning ${files.length} files...`}
                    </h3>
                    <p className="text-sm text-neutral-500">Running through the Soteria ML pipeline</p>
                </motion.div>
            )}

            {/* Results */}
            {scanState === 'done' && summary && (
                <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="space-y-6">

                    {/* Summary Cards */}
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                        <div className="p-5 rounded-2xl bg-neutral-950 border border-white/[0.06] text-center">
                            <div className={`text-4xl font-black mb-1 ${gradeColors[summary.project_grade]}`}>
                                {summary.project_grade}
                            </div>
                            <div className="text-[10px] text-neutral-600 font-bold uppercase tracking-widest">Project Grade</div>
                            <div className="text-xs text-neutral-500 mt-1">{summary.project_score}/100</div>
                        </div>
                        <div className="p-5 rounded-2xl bg-neutral-950 border border-white/[0.06] text-center">
                            <div className="text-4xl font-black text-white mb-1">{summary.total_files}</div>
                            <div className="text-[10px] text-neutral-600 font-bold uppercase tracking-widest">Files Scanned</div>
                        </div>
                        <div className="p-5 rounded-2xl bg-neutral-950 border border-white/[0.06] text-center">
                            <div className="text-4xl font-black text-red-400 mb-1">{summary.threats}</div>
                            <div className="text-[10px] text-neutral-600 font-bold uppercase tracking-widest">Threats Found</div>
                        </div>
                        <div className="p-5 rounded-2xl bg-neutral-950 border border-white/[0.06] text-center">
                            <div className="text-4xl font-black text-green-400 mb-1">{summary.clean}</div>
                            <div className="text-[10px] text-neutral-600 font-bold uppercase tracking-widest">Clean Files</div>
                        </div>
                    </div>

                    {/* Results Table */}
                    <div>
                        <div className="flex items-center justify-between mb-4">
                            <h2 className="text-xs font-black text-neutral-600 uppercase tracking-widest">Per-File Results</h2>
                            <button
                                onClick={resetScan}
                                className="px-4 py-2 text-xs font-bold text-blue-400 hover:text-blue-300 transition-colors"
                            >
                                ← New Batch Scan
                            </button>
                        </div>
                        <div className="rounded-2xl border border-white/[0.06] bg-neutral-950 overflow-hidden">
                            <table className="w-full">
                                <thead>
                                    <tr className="border-b border-white/[0.06]">
                                        <th className="px-5 py-3 text-left text-[10px] font-bold text-neutral-600 uppercase tracking-widest">File</th>
                                        <th className="px-5 py-3 text-left text-[10px] font-bold text-neutral-600 uppercase tracking-widest">Language</th>
                                        <th className="px-5 py-3 text-left text-[10px] font-bold text-neutral-600 uppercase tracking-widest">Risk</th>
                                        <th className="px-5 py-3 text-left text-[10px] font-bold text-neutral-600 uppercase tracking-widest">Confidence</th>
                                        <th className="px-5 py-3 text-left text-[10px] font-bold text-neutral-600 uppercase tracking-widest">Verdict</th>
                                        <th className="px-5 py-3 text-left text-[10px] font-bold text-neutral-600 uppercase tracking-widest">Details</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-white/[0.04]">
                                    {results.map((r, i) => (
                                        <tr key={i} className="hover:bg-white/[0.02] transition-colors">
                                            <td className="px-5 py-3">
                                                <div className="flex items-center gap-2">
                                                    <FileCode2 className="w-3.5 h-3.5 text-neutral-600" />
                                                    <span className="text-sm text-neutral-300 font-mono">{r.filename}</span>
                                                </div>
                                            </td>
                                            <td className="px-5 py-3">
                                                <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-blue-500/10 text-blue-400 uppercase tracking-wider">
                                                    {r.language}
                                                </span>
                                            </td>
                                            <td className="px-5 py-3">
                                                <span className={`text-[10px] font-bold px-2 py-0.5 rounded tracking-wider ${riskColors[r.risk_level] || riskColors.INVALID}`}>
                                                    {r.risk_level}
                                                </span>
                                            </td>
                                            <td className="px-5 py-3 text-sm text-neutral-300 font-mono">{r.confidence}%</td>
                                            <td className="px-5 py-3">
                                                {r.status === 'malicious' ? (
                                                    <div className="flex items-center gap-1.5">
                                                        <AlertTriangle className="w-3.5 h-3.5 text-red-400" />
                                                        <span className="text-xs text-red-400 font-bold">Threat</span>
                                                    </div>
                                                ) : r.status === 'clean' ? (
                                                    <div className="flex items-center gap-1.5">
                                                        <ShieldCheck className="w-3.5 h-3.5 text-green-400" />
                                                        <span className="text-xs text-green-400 font-bold">Clean</span>
                                                    </div>
                                                ) : (
                                                    <span className="text-xs text-neutral-500">Error</span>
                                                )}
                                            </td>
                                            <td className="px-5 py-3 text-xs text-neutral-500 max-w-[200px] truncate">{r.message}</td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </div>
                </motion.div>
            )}
        </div>
    );
}
