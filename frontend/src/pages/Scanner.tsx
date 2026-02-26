import { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Button } from '@/components/ui/button';
import CodeEditor from '@/components/CodeEditor';
import { ShieldX, ShieldCheck, AlertTriangle, Download, History, Trash2, Code2, Sparkles, Globe, Cpu, Brain, Zap, CheckCircle2, Copy, ArrowRight } from 'lucide-react';
import { Switch } from '@/components/ui/switch';
import { useGame } from '@/context/GameContext';
import { API_BASE_URL } from '@/lib/api';
import { Flame } from 'lucide-react';

// --- TYPES ---
interface AnalysisResult {
  status: 'waiting' | 'loading' | 'malicious' | 'clean' | 'error';
  message?: string;
  confidence?: number;
  riskLevel?: string;
  language?: string;
  metadata?: {
    nodes_scanned?: number;
    engine?: string;
    supported_languages?: string[];
    process_time?: string;
  };
  vulnerabilities?: {
    line: number;
    pattern: string;
    severity: string;
    description: string;
    cwe: string;
    snippet: string;
  }[];
}

interface HistoryItem {
  id: string;
  timestamp: string;
  verdict: 'malicious' | 'clean';
  riskLevel: string;
  codePreview: string;
  fullCode: string;
  language?: string;
  confidence?: number;
  nodesScanned?: number;
}

type DeepScanStatus = 'idle' | 'scanning' | 'done' | 'error';
type ResultTab = 'verdict' | 'analysis' | 'fix';

const TypewriterText = ({ text }: { text: string }) => {
  const [displayedText, setDisplayedText] = useState('');

  useEffect(() => {
    setDisplayedText('');
    let currentIndex = 0;
    let isCancelled = false;

    const nextChar = () => {
      if (isCancelled) return;
      if (currentIndex < text.length) {
        setDisplayedText(text.slice(0, currentIndex + 1));
        currentIndex++;
        setTimeout(nextChar, 20);
      }
    };

    nextChar();
    return () => { isCancelled = true; };
  }, [text]);

  return <span>{displayedText}</span>;
};

// Parse LLM output to extract fixed code
function extractFixedCode(llmOutput: string): string | null {
  const fixedCodeMatch = llmOutput.match(/## Fixed Code[\s\S]*?```(?:\w*)\n([\s\S]*?)```/);
  if (fixedCodeMatch) return fixedCodeMatch[1].trim();
  const anyCodeMatch = llmOutput.match(/```(?:\w*)\n([\s\S]*?)```/);
  if (anyCodeMatch) return anyCodeMatch[1].trim();
  return null;
}

export default function Scanner() {
  const [code, setCode] = useState('');
  const [result, setResult] = useState<AnalysisResult>({ status: 'waiting' });
  const [history, setHistory] = useState<HistoryItem[]>([]);
  const [isCopied, setIsCopied] = useState(false);

  const [deepScanStatus, setDeepScanStatus] = useState<DeepScanStatus>('idle');
  const [llmOutput, setLlmOutput] = useState('');
  const [activeTab, setActiveTab] = useState<ResultTab>('verdict');
  const [activeLine, setActiveLine] = useState<number | null>(null);
  const llmOutputRef = useRef('');

  const { xp, addXp, roastMode, toggleRoastMode } = useGame();

  // Persistence
  useEffect(() => {
    const saved = localStorage.getItem('soteria_audit_v2');
    if (saved) setHistory(JSON.parse(saved));
  }, []);

  useEffect(() => {
    localStorage.setItem('soteria_audit_v2', JSON.stringify(history));
  }, [history]);

  const handleDownloadReport = async () => {
    try {
      const baseUrl = import.meta.env.VITE_API_URL || 'http://localhost:5001';
      const response = await fetch(`/generate-report`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          code: code,
          verdict: result.status.toUpperCase(),
          confidence: result.confidence,
          risk_level: result.riskLevel,
          reason: result.message,
          language: result.language,
          deep_scan: llmOutput || '',
          nodes_scanned: result.metadata?.nodes_scanned || 0
        })
      });
      if (!response.ok) throw new Error('Backend failed to generate PDF');
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `Soteria_Security_Report_${new Date().getTime()}.pdf`;
      document.body.appendChild(link);
      link.click();
      link.remove();
    } catch (error) {
      console.error("Report Download Error:", error);
      alert("Could not generate report. Check if Python backend is running on Port 5001.");
    }
  };

  const analyzeCode = async () => {
    if (code.length > 50000) {
      setResult({ status: 'error', message: 'Payload too large. Limit code to 50,000 characters.' });
      return;
    }
    if (!code.trim()) return;

    setDeepScanStatus('idle');
    setLlmOutput('');
    setActiveTab('verdict');
    setActiveLine(null);
    llmOutputRef.current = '';
    setResult({ status: 'loading' });

    const baseUrl = import.meta.env.VITE_API_URL || 'http://localhost:5001';

    try {
      const response = await fetch(`/analyze`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code, roast_mode: roastMode })
      });

      const data = await response.json();
      const verdict = data.malicious ? 'malicious' : 'clean';

      addXp(10);
      if (verdict === 'clean') addXp(50);

      const newHistoryItem: HistoryItem = {
        id: Date.now().toString(),
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        verdict,
        riskLevel: data.risk_level,
        codePreview: code.trim().substring(0, 35) + "...",
        fullCode: code,
        language: data.language,
        confidence: data.confidence,
        nodesScanned: data.metadata?.nodes_scanned
      };

      setHistory(prev => [newHistoryItem, ...prev].slice(0, 15));
      setResult({
        status: verdict,
        message: data.reason,
        confidence: data.confidence,
        riskLevel: data.risk_level,
        language: data.language,
        metadata: data.metadata,
        vulnerabilities: data.vulnerabilities
      });
    } catch (error) {
      setResult({ status: 'error', message: 'Intelligence Link Offline. Check Backend @ Port 5001.' });
    }
  };

  const startDeepScan = async () => {
    setDeepScanStatus('scanning');
    setLlmOutput('');
    setActiveTab('analysis');
    llmOutputRef.current = '';

    const baseUrl = import.meta.env.VITE_API_URL || 'http://localhost:5001';

    try {
      const response = await fetch(`/deep-scan`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          code,
          scan_result: {
            risk_level: result.riskLevel,
            reason: result.message,
            language: result.language,
            confidence: result.confidence
          }
        })
      });

      if (!response.ok) throw new Error(`HTTP ${response.status}`);

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
            const raw = line.slice(6);
            if (raw === '[STREAM_END]') {
              setDeepScanStatus('done');
              return;
            }
            try {
              const parsed = JSON.parse(raw);
              if (parsed.type === 'token') {
                const content = parsed.content.replace(/\\n/g, '\n');
                llmOutputRef.current += content;
                setLlmOutput(llmOutputRef.current);
              } else if (parsed.type === 'done') {
                setDeepScanStatus('done');
              } else if (parsed.type === 'error') {
                setLlmOutput(parsed.content);
                setDeepScanStatus('error');
              }
            } catch {
              continue;
            }
          }
        }
      }
    } catch (e) {
      setLlmOutput(`Failed to connect to deep scan service: ${e}`);
      setDeepScanStatus('error');
    }
  };

  const fixedCode = extractFixedCode(llmOutput);

  const applyFix = () => {
    if (fixedCode) {
      setCode(fixedCode);
      setActiveTab('verdict');
    }
  };

  const handleCopy = () => {
    navigator.clipboard.writeText(code);
    setIsCopied(true);
    setTimeout(() => setIsCopied(false), 2000);
  };

  const hasResults = result.status === 'malicious' || result.status === 'clean';

  return (
    <div className="min-h-screen bg-[#020617] bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-slate-900 via-[#020617] to-[#020617] text-slate-200 py-8 px-6 overflow-x-hidden">
      <div className="max-w-[1600px] mx-auto">

        {/* HEADER — clean, minimal */}
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-10 flex items-center justify-between"
        >
          <div className="flex items-center gap-5">
            <div>
              <h1 className="text-3xl font-black tracking-tight text-white">
                Code Reviewer
              </h1>
              <p className="text-slate-600 text-xs font-mono tracking-wider mt-0.5">Security Analysis Engine</p>
            </div>
            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-blue-500/10 border border-blue-500/20 text-blue-400 text-[9px] font-bold uppercase tracking-widest">
              <Sparkles className="w-3 h-3" /> AI-Powered
            </div>
          </div>

          {/* Roast Toggle */}
          <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-slate-900/60 border border-slate-800">
            <span className={`text-[10px] font-bold uppercase tracking-widest transition-colors ${!roastMode ? 'text-green-400' : 'text-slate-600'}`}>Mentor</span>
            <Switch
              checked={roastMode}
              onCheckedChange={toggleRoastMode}
              className="data-[state=checked]:bg-red-500"
            />
            <span className={`text-[10px] font-bold uppercase tracking-widest transition-colors flex items-center gap-1 ${roastMode ? 'text-red-400' : 'text-slate-600'}`}>
              Roast <Flame className={`w-3 h-3 ${roastMode ? 'animate-pulse' : ''}`} />
            </span>
          </div>
        </motion.div>

        <div className="grid lg:grid-cols-12 gap-6 items-start">

          {/* LEFT: AUDIT HISTORY — compact */}
          <motion.aside
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            className="lg:col-span-2 h-[680px] sticky top-6"
          >
            <div className="bg-slate-900/30 border border-slate-800/50 rounded-2xl p-4 h-full flex flex-col backdrop-blur-xl">
              <div className="flex items-center justify-between mb-4 px-1">
                <h3 className="text-[9px] font-black text-slate-600 tracking-[0.15em] uppercase">History</h3>
                {history.length > 0 && (
                  <button onClick={() => setHistory([])} className="p-1.5 hover:bg-red-500/10 rounded-lg text-slate-700 hover:text-red-400 transition-all">
                    <Trash2 className="w-3 h-3" />
                  </button>
                )}
              </div>

              <div className="flex-1 overflow-y-auto space-y-2 pr-1 custom-scrollbar">
                <AnimatePresence mode="popLayout">
                  {history.length === 0 ? (
                    <motion.div
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      className="h-full flex flex-col items-center justify-center opacity-20 px-3 text-center"
                    >
                      <History className="w-6 h-6 mb-3" />
                      <p className="text-[9px] uppercase font-bold tracking-widest mb-1">No Scans</p>
                      <p className="text-[8px] font-mono leading-relaxed">Scan results appear here</p>
                    </motion.div>
                  ) : (
                    history.map((item) => (
                      <motion.div
                        layout
                        initial={{ opacity: 0, scale: 0.95 }}
                        animate={{ opacity: 1, scale: 1 }}
                        exit={{ opacity: 0, scale: 0.95 }}
                        key={item.id}
                        onClick={() => setCode(item.fullCode)}
                        className="group p-3 bg-slate-950/40 border border-slate-800/40 rounded-xl hover:border-blue-500/30 transition-all cursor-pointer hover:bg-slate-900/30"
                      >
                        <div className="flex justify-between items-center mb-1.5">
                          <span className={`text-[7px] font-bold px-1.5 py-0.5 rounded tracking-widest ${item.riskLevel === 'CRITICAL' ? 'bg-red-500 text-white' :
                            item.riskLevel === 'HIGH' ? 'bg-orange-500/20 text-orange-400' :
                              'bg-green-500/20 text-green-400'
                            }`}>
                            {item.riskLevel}
                          </span>
                          <span className="text-[8px] text-slate-700 font-mono">{item.timestamp}</span>
                        </div>
                        <p className="text-[10px] text-slate-600 font-mono truncate group-hover:text-slate-300">{item.codePreview}</p>
                      </motion.div>
                    ))
                  )}
                </AnimatePresence>
              </div>
            </div>
          </motion.aside>

          {/* CENTER: EDITOR */}
          <motion.main
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="lg:col-span-6 space-y-4"
          >
            <CodeEditor
              code={code}
              setCode={setCode}
              language={
                result.language?.toLowerCase() ||
                (code.includes('import ') ? 'python' :
                  code.includes('public class') ? 'java' :
                    code.includes('function') ? 'javascript' : 'python')
              }
              className="h-[540px] shadow-2xl shadow-blue-900/10"
              vulnerabilities={result.vulnerabilities}
              activeLine={activeLine}
            />

            <Button
              size="lg"
              onClick={analyzeCode}
              disabled={!code.trim() || result.status === 'loading'}
              className="w-full py-7 rounded-2xl bg-gradient-to-r from-blue-600 to-cyan-600 hover:from-blue-500 hover:to-cyan-500 hover:shadow-[0_0_30px_-5px_rgba(59,130,246,0.4)] transition-all text-sm font-bold tracking-wide"
            >
              {result.status === 'loading' ? (
                <span className="flex items-center gap-2">
                  <div className="w-4 h-4 rounded-full border-2 border-white/30 border-t-white animate-spin" />
                  Analyzing...
                </span>
              ) : (
                <span className="flex items-center gap-2">
                  <ShieldCheck className="w-4 h-4" />
                  Run Security Scan
                </span>
              )}
            </Button>

            {/* Deep Scan Button — appears after quick scan */}
            <AnimatePresence>
              {hasResults && (
                <motion.div
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -10 }}
                >
                  <Button
                    size="lg"
                    onClick={startDeepScan}
                    disabled={deepScanStatus === 'scanning'}
                    className="w-full py-6 rounded-2xl bg-gradient-to-r from-purple-600 via-violet-600 to-fuchsia-600 hover:from-purple-500 hover:via-violet-500 hover:to-fuchsia-500 hover:shadow-[0_0_30px_-5px_rgba(168,85,247,0.4)] transition-all text-sm font-bold tracking-wide"
                  >
                    {deepScanStatus === 'scanning' ? (
                      <span className="flex items-center gap-2">
                        <div className="w-4 h-4 rounded-full border-2 border-white/30 border-t-white animate-spin" />
                        AI Analyzing...
                      </span>
                    ) : deepScanStatus === 'done' ? (
                      <span className="flex items-center gap-2">
                        <CheckCircle2 className="w-4 h-4" />
                        Re-analyze with AI
                      </span>
                    ) : (
                      <span className="flex items-center gap-2">
                        <Brain className="w-4 h-4" />
                        Deep Scan with AI
                        <Zap className="w-3.5 h-3.5 text-yellow-300" />
                      </span>
                    )}
                  </Button>
                </motion.div>
              )}
            </AnimatePresence>
          </motion.main>

          {/* RIGHT: REPORT PANEL */}
          <motion.section
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            className="lg:col-span-4 h-[680px]"
          >
            <div className="bg-slate-900/30 border border-slate-800/50 rounded-2xl p-5 h-full flex flex-col backdrop-blur-xl relative overflow-hidden">

              {/* Tab Switcher */}
              {hasResults && (
                <div className="flex gap-1 mb-4 p-1 bg-slate-950/60 rounded-xl">
                  {([
                    { key: 'verdict', label: 'Verdict', icon: <ShieldCheck className="w-3 h-3" /> },
                    { key: 'analysis', label: 'Analysis', icon: <Brain className="w-3 h-3" />, disabled: deepScanStatus === 'idle' },
                    { key: 'fix', label: 'Fix', icon: <Code2 className="w-3 h-3" />, disabled: !fixedCode },
                  ] as { key: ResultTab; label: string; icon: React.ReactNode; disabled?: boolean }[]).map(tab => (
                    <button
                      key={tab.key}
                      onClick={() => !tab.disabled && setActiveTab(tab.key)}
                      disabled={tab.disabled}
                      className={`flex-1 flex items-center justify-center gap-1.5 px-2 py-2 rounded-lg text-[9px] font-bold uppercase tracking-widest transition-all ${activeTab === tab.key
                        ? 'bg-slate-800 text-white shadow-lg'
                        : tab.disabled
                          ? 'text-slate-700 cursor-not-allowed'
                          : 'text-slate-500 hover:text-slate-300'
                        }`}
                    >
                      {tab.icon}
                      {tab.label}
                    </button>
                  ))}
                </div>
              )}

              <div className="flex-1 flex flex-col overflow-hidden">

                {/* === VERDICT TAB === */}
                {(activeTab === 'verdict' || !hasResults) && (
                  <div className="flex-1 flex flex-col items-center justify-center overflow-y-auto">
                    <AnimatePresence mode="wait">
                      {result.status === 'waiting' && (
                        <motion.div
                          key="waiting"
                          initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                          className="text-center opacity-15"
                        >
                          <Code2 className="w-16 h-16 mx-auto mb-4 stroke-[1px]" />
                          <p className="text-[9px] uppercase font-bold tracking-widest">Paste code & scan</p>
                        </motion.div>
                      )}

                      {result.status === 'loading' && (
                        <motion.div
                          key="loading"
                          initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                          className="text-center"
                        >
                          <div className="w-16 h-16 rounded-full border-2 border-slate-800 border-t-blue-500 animate-spin mx-auto mb-6" />
                          <p className="text-blue-400 text-[9px] font-bold tracking-widest animate-pulse">Analyzing...</p>
                        </motion.div>
                      )}

                      {(result.status === 'malicious' || result.status === 'clean') && (
                        <motion.div
                          key="result"
                          initial={{ opacity: 0, scale: 0.95, y: 10 }}
                          animate={{ opacity: 1, scale: 1, y: 0 }}
                          className="text-center w-full px-2"
                        >
                          {/* Language + Engine badges */}
                          <div className="flex items-center justify-center gap-2 mb-4 flex-wrap">
                            {result.language && (
                              <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-blue-500/10 border border-blue-500/20 text-blue-400 text-[9px] font-bold uppercase tracking-widest">
                                <Globe className="w-2.5 h-2.5" />
                                {result.language}
                              </span>
                            )}
                            {result.metadata?.nodes_scanned && (
                              <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-slate-500/10 border border-slate-500/20 text-slate-400 text-[9px] font-bold tracking-widest">
                                <Cpu className="w-2.5 h-2.5" />
                                {result.metadata.nodes_scanned} nodes
                              </span>
                            )}
                          </div>

                          <div className={`mx-auto mb-5 w-20 h-20 rounded-full flex items-center justify-center border-2 shadow-xl transition-colors duration-1000 ${result.status === 'malicious' ? 'bg-red-500/5 border-red-500/20 shadow-red-500/10' : 'bg-green-500/5 border-green-500/20 shadow-green-500/10'}`}>
                            {result.status === 'malicious' ? <ShieldX className="w-10 h-10 text-red-500" /> : <ShieldCheck className="w-10 h-10 text-green-500" />}
                          </div>

                          <div className={`inline-block px-4 py-1 rounded-full mb-3 text-[9px] font-bold tracking-widest border ${result.status === 'malicious' ? 'bg-red-500/10 border-red-500/20 text-red-400' : 'bg-green-500/10 border-green-500/20 text-green-400'}`}>
                            {result.riskLevel} RISK
                          </div>

                          <h2 className="text-xl font-bold mb-3 tracking-tight">
                            {result.status === 'malicious' ? 'Threat Detected' : 'No Threats Found'}
                          </h2>

                          {/* Confidence Bar */}
                          {result.confidence != null && (
                            <div className="w-full mb-4 px-1">
                              <div className="flex justify-between items-center mb-1">
                                <span className="text-[8px] font-bold text-slate-600 uppercase tracking-widest">Confidence</span>
                                <span className="text-[9px] font-bold text-white">{result.confidence}%</span>
                              </div>
                              <div className="w-full h-1.5 rounded-full bg-slate-800 overflow-hidden">
                                <motion.div
                                  initial={{ width: 0 }}
                                  animate={{ width: `${result.confidence}%` }}
                                  transition={{ duration: 1, ease: 'easeOut' }}
                                  className={`h-full rounded-full ${result.confidence > 80 ? (result.status === 'malicious' ? 'bg-red-500' : 'bg-green-500') : 'bg-yellow-500'}`}
                                />
                              </div>
                            </div>
                          )}

                          <p className="text-slate-400 text-xs leading-relaxed mb-4 font-mono px-3 border-l-2 border-slate-800 h-10 overflow-y-auto text-left">
                            {result.message && <TypewriterText text={result.message} />}
                          </p>

                          {result.metadata?.engine && (
                            <p className="text-[8px] text-slate-700 font-mono mb-3 tracking-wider">{result.metadata.engine}</p>
                          )}

                          <div className="flex gap-2">
                            <Button
                              onClick={handleDownloadReport}
                              variant="outline"
                              className={`flex-1 py-5 border-slate-800 rounded-xl font-bold transition-all uppercase tracking-widest text-[9px] ${result.status === 'malicious'
                                ? 'hover:bg-red-500 hover:text-white hover:border-red-500'
                                : 'hover:bg-white hover:text-black'
                                }`}
                            >
                              <Download className="w-3 h-3 mr-1.5" /> Export
                            </Button>
                            {result.status === 'malicious' && deepScanStatus === 'idle' && (
                              <Button
                                onClick={startDeepScan}
                                className="flex-1 py-5 rounded-xl font-bold uppercase tracking-widest text-[9px] bg-purple-600 hover:bg-purple-500"
                              >
                                <Brain className="w-3 h-3 mr-1.5" /> AI Fix
                              </Button>
                            )}
                          </div>

                          {/* VULNERABILITY HEATMAP */}
                          {result.vulnerabilities && result.vulnerabilities.length > 0 && (
                            <div className="w-full mt-4 text-left">
                              <div className="flex items-center gap-2 mb-2">
                                <Flame className="w-3 h-3 text-orange-400" />
                                <span className="text-[9px] font-bold text-neutral-500 uppercase tracking-widest">
                                  {result.vulnerabilities.length} Vulnerabilit{result.vulnerabilities.length === 1 ? 'y' : 'ies'} Found
                                </span>
                              </div>
                              <div className="max-h-48 overflow-y-auto space-y-1.5 pr-1 custom-scrollbar">
                                {result.vulnerabilities.map((v, i) => (
                                  <div
                                    key={i}
                                    onClick={() => setActiveLine(v.line)}
                                    className="flex items-start gap-2 p-2 rounded-lg bg-neutral-950 border border-white/[0.04] hover:border-white/[0.08] hover:bg-white/[0.02] transition-colors cursor-pointer group/vuln"
                                  >
                                    <span className={`flex-shrink-0 text-[8px] font-black px-1.5 py-0.5 rounded tracking-wider ${v.severity === 'CRITICAL' ? 'bg-red-500/20 text-red-400' :
                                      v.severity === 'HIGH' ? 'bg-orange-500/20 text-orange-400' :
                                        'bg-yellow-500/20 text-yellow-400'
                                      }`}>{v.severity}</span>
                                    <div className="flex-1 min-w-0">
                                      <div className="flex items-center gap-2">
                                        <span className="text-[9px] font-bold text-blue-400 group-hover/vuln:text-blue-300 transition-colors">Line {v.line}</span>
                                        {v.cwe && <span className="text-[8px] text-neutral-600 font-mono">{v.cwe}</span>}
                                      </div>
                                      <p className="text-[10px] text-neutral-400 leading-snug">{v.description}</p>
                                      <code className="text-[9px] text-neutral-600 font-mono truncate block">{v.snippet}</code>
                                    </div>
                                  </div>
                                ))}
                              </div>
                            </div>
                          )}
                        </motion.div>
                      )}

                      {result.status === 'error' && (
                        <motion.div
                          key="error"
                          initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                          className="text-center px-4"
                        >
                          <AlertTriangle className="w-12 h-12 mx-auto mb-3 text-yellow-500" />
                          <p className="text-yellow-400 text-xs font-mono">{result.message}</p>
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </div>
                )}

                {/* === ANALYSIS TAB === */}
                {activeTab === 'analysis' && deepScanStatus !== 'idle' && (
                  <div className="flex-1 flex flex-col overflow-hidden">
                    <div className="flex items-center gap-2 mb-3">
                      <Brain className="w-3.5 h-3.5 text-purple-400" />
                      <span className="text-[9px] font-bold text-purple-400 uppercase tracking-widest">AI Analysis</span>
                      {deepScanStatus === 'scanning' && (
                        <div className="w-2.5 h-2.5 rounded-full bg-purple-500 animate-pulse ml-auto" />
                      )}
                      {deepScanStatus === 'done' && (
                        <CheckCircle2 className="w-3 h-3 text-green-500 ml-auto" />
                      )}
                    </div>

                    <div className="flex-1 overflow-y-auto rounded-xl bg-slate-950/60 border border-slate-800/40 p-4">
                      <pre className="whitespace-pre-wrap text-[11px] text-slate-300 font-mono leading-relaxed">
                        {llmOutput || (deepScanStatus === 'scanning' ? 'Waiting for AI response...' : '')}
                        {deepScanStatus === 'scanning' && (
                          <span className="inline-block w-1.5 h-3 bg-purple-400 animate-pulse ml-0.5" />
                        )}
                      </pre>
                    </div>

                    {deepScanStatus === 'done' && fixedCode && (
                      <Button
                        onClick={() => setActiveTab('fix')}
                        className="mt-3 py-5 rounded-xl bg-green-600 hover:bg-green-500 font-bold uppercase tracking-widest text-[10px]"
                      >
                        <Code2 className="w-3.5 h-3.5 mr-2" />
                        View Fixed Code
                        <ArrowRight className="w-3.5 h-3.5 ml-2" />
                      </Button>
                    )}
                  </div>
                )}

                {/* === FIX TAB === */}
                {activeTab === 'fix' && fixedCode && (
                  <div className="flex-1 flex flex-col overflow-hidden">
                    <div className="flex items-center gap-2 mb-3">
                      <Code2 className="w-3.5 h-3.5 text-green-400" />
                      <span className="text-[9px] font-bold text-green-400 uppercase tracking-widest">Suggested Fix</span>
                    </div>

                    <div className="flex-1 overflow-y-auto rounded-xl bg-slate-950/60 border border-green-500/10 p-4">
                      <pre className="text-[11px] text-green-300 font-mono leading-relaxed whitespace-pre-wrap">
                        {fixedCode}
                      </pre>
                    </div>

                    <div className="flex gap-2 mt-3">
                      <Button
                        onClick={applyFix}
                        className="flex-1 py-5 rounded-xl bg-green-600 hover:bg-green-500 font-bold uppercase tracking-widest text-[10px]"
                      >
                        <CheckCircle2 className="w-3.5 h-3.5 mr-2" />
                        Apply Fix
                      </Button>
                      <Button
                        onClick={() => {
                          navigator.clipboard.writeText(fixedCode);
                          setIsCopied(true);
                          setTimeout(() => setIsCopied(false), 2000);
                        }}
                        variant="outline"
                        className="py-5 rounded-xl border-slate-700 font-bold text-xs"
                      >
                        {isCopied ? <CheckCircle2 className="w-3.5 h-3.5 text-green-400" /> : <Copy className="w-3.5 h-3.5" />}
                      </Button>
                    </div>
                  </div>
                )}

              </div>
            </div>
          </motion.section>
        </div>
      </div>
    </div>
  );
}