import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { ShieldX, ShieldCheck, AlertTriangle, Download, History, Trash2, Code2, ClipboardCheck, Sparkles } from 'lucide-react';
import { jsPDF } from 'jspdf';

// --- TYPES ---
interface AnalysisResult {
  status: 'waiting' | 'loading' | 'malicious' | 'clean' | 'error';
  message?: string;
  confidence?: number;
  riskLevel?: string;
}

interface HistoryItem {
  id: string;
  timestamp: string;
  verdict: 'malicious' | 'clean';
  riskLevel: string;
  codePreview: string;
  fullCode: string;
}

const TypewriterText = ({ text }: { text: string }) => {
  const [displayedText, setDisplayedText] = useState('');

  useEffect(() => {
    // 1. Reset text immediately when the 'text' prop changes
    setDisplayedText(''); 
    
    let currentIndex = 0;
    let isCancelled = false;

    const nextChar = () => {
      if (isCancelled) return;

      if (currentIndex < text.length) {
        // 2. Use the slice method to ensure we are grabbing the exact string up to that point
        // This prevents character skipping.
        setDisplayedText(text.slice(0, currentIndex + 1));
        currentIndex++;
        setTimeout(nextChar, 20); // 20ms delay
      }
    };

    nextChar();

    // 3. Cleanup function: stops the timer if the component unmounts 
    // or if the user clicks "Scan" again while it's still typing.
    return () => {
      isCancelled = true;
    };
  }, [text]);

  return <span>{displayedText}</span>;
};

export default function Scanner() {
  const [code, setCode] = useState('');
  const [result, setResult] = useState<AnalysisResult>({ status: 'waiting' });
  const [history, setHistory] = useState<HistoryItem[]>([]);
  const [isCopied, setIsCopied] = useState(false);

  // Persistence & Initialization
  useEffect(() => {
    const saved = localStorage.getItem('sentinel_audit_v2');
    if (saved) setHistory(JSON.parse(saved));
  }, []);

  useEffect(() => {
    localStorage.setItem('sentinel_audit_v2', JSON.stringify(history));
  }, [history]);

  const handleDownloadReport = async () => {
        try {
          // 1. Point to your 5001 backend
          const baseUrl = import.meta.env.VITE_API_URL || 'http://localhost:5001';
          
          const response = await fetch(`${baseUrl}/generate-report`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              code: code, // The code currently in your editor
              verdict: result.status.toUpperCase(),
              confidence: result.confidence,
              risk_level: result.riskLevel
            })
          });

          if (!response.ok) throw new Error('Backend failed to generate PDF');

          // 2. Browser trick to download the file
          const blob = await response.blob();
          const url = window.URL.createObjectURL(blob);
          const link = document.createElement('a');
          link.href = url;
          link.download = `Sentinel_Audit_${new Date().getTime()}.pdf`;
          document.body.appendChild(link);
          link.click();
          link.remove();
          
        } catch (error) {
          console.error("Report Download Error:", error);
          alert("Could not generate report. Check if Python backend is running on Port 5001.");
        }
      };


  const analyzeCode = async () => {
    if (code.length > 50000){
      setResult({
        status: 'error',
        message: 'Payload too large. Limit code to 50,000 characters.'
      })
    }
    if (!code.trim()) return;
    setResult({ status: 'loading' });


    const baseUrl = import.meta.env.VITE_API_URL || 'http://localhost:5001';

    try {
      const response = await fetch(`${baseUrl}/analyze`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code })
      });
      
      const data = await response.json();
      const verdict = data.malicious ? 'malicious' : 'clean';

      const newHistoryItem: HistoryItem = {
        id: Date.now().toString(),
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        verdict,
        riskLevel: data.risk_level, 
        codePreview: code.trim().substring(0, 35) + "...",
        fullCode: code
      };

      setHistory(prev => [newHistoryItem, ...prev].slice(0, 15));
      setResult({ 
        status: verdict, 
        message: data.reason,
        confidence: data.confidence,
        riskLevel: data.risk_level
      });
    } catch (error) {
      setResult({ status: 'error', message: 'Intelligence Link Offline. Check Backend @ Port 5001.' });
    }
  };

  const handleCopy = () => {
    navigator.clipboard.writeText(code);
    setIsCopied(true);
    setTimeout(() => setIsCopied(false), 2000);
  };

  return (
    <div className="min-h-screen bg-[#020617] bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-slate-900 via-[#020617] to-[#020617] text-slate-200 py-12 px-6 overflow-x-hidden">
      <div className="max-w-[1600px] mx-auto">
        
        {/* HERO SECTION */}
        <motion.div 
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-16 text-center space-y-4"
        >
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-purple-500/10 border border-purple-500/20 text-purple-400 text-[10px] font-black uppercase tracking-widest mb-4">
            <Sparkles className="w-3 h-3" /> AI-Powered Security
          </div>
          <h1 className="text-7xl font-black tracking-tighter bg-gradient-to-b from-white to-slate-500 bg-clip-text text-transparent">
            CYBER SENTINEL
          </h1>
          <p className="text-slate-500 font-mono text-xs tracking-[0.3em] uppercase">Deep Structural AST Analysis Engine</p>
        </motion.div>

        <div className="grid lg:grid-cols-12 gap-8 items-start">
          
          {/* SIDEBAR: AUDIT LOGS */}
          <motion.aside 
            initial={{ opacity: 0, x: -30 }}
            animate={{ opacity: 1, x: 0 }}
            className="lg:col-span-3 h-[750px] sticky top-8"
          >
            <div className="bg-slate-900/40 border border-slate-800/60 rounded-[2.5rem] p-6 h-full flex flex-col backdrop-blur-3xl shadow-2xl">
              <div className="flex items-center justify-between mb-8 px-2">
                <h3 className="text-[10px] font-black text-slate-500 tracking-[0.2em] uppercase">Audit Session</h3>
                <button onClick={() => setHistory([])} className="p-2 hover:bg-red-500/10 rounded-xl text-slate-600 hover:text-red-400 transition-all">
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
              
              <div className="flex-1 overflow-y-auto space-y-3 pr-2 custom-scrollbar">
                <AnimatePresence mode="popLayout">
                  {history.length === 0 ? (
                    <motion.div 
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      className="h-full flex flex-col items-center justify-center opacity-20 px-6 text-center"
                    >
                      <div className="w-16 h-16 mb-4 rounded-full border border-dashed border-slate-500 flex items-center justify-center">
                        <History className="w-8 h-8" />
                      </div>
                      <p className="text-[10px] uppercase font-black tracking-widest mb-2">No Audits Found</p>
                      <p className="text-[9px] font-mono leading-relaxed">Your security scan history will appear here for session tracking.</p>
                    </motion.div>
                  ) : (
                    history.map((item) => (
                      <motion.div 
                        layout
                        initial={{ opacity: 0, scale: 0.9 }}
                        animate={{ opacity: 1, scale: 1 }}
                        exit={{ opacity: 0, scale: 0.9 }}
                        key={item.id} 
                        onClick={() => setCode(item.fullCode)}
                        className="group p-4 bg-slate-950/40 border border-slate-800/50 rounded-2xl hover:border-purple-500/50 transition-all cursor-pointer hover:bg-slate-900/40"
                      >
                        <div className="flex justify-between items-center mb-2">
                          <span className={`text-[8px] font-bold px-2 py-0.5 rounded tracking-widest ${
                            item.riskLevel === 'CRITICAL' ? 'bg-red-500 text-white' : 
                            item.riskLevel === 'HIGH' ? 'bg-orange-500/20 text-orange-400' :
                            'bg-green-500/20 text-green-400'
                          }`}>
                            {item.riskLevel}
                          </span>
                          <span className="text-[9px] text-slate-600 font-mono">{item.timestamp}</span>
                        </div>
                        <p className="text-[11px] text-slate-500 font-mono truncate group-hover:text-slate-200">{item.codePreview}</p>
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
            className="lg:col-span-5 space-y-6"
          >
            <div className="relative group rounded-[2.5rem] bg-gradient-to-b from-slate-800/50 to-slate-900/50 p-[1px] shadow-2xl">
              <div className="bg-[#020617] rounded-[2.5rem] overflow-hidden">
                <div className="bg-slate-900/50 px-8 py-4 flex items-center justify-between border-b border-slate-800/50">
                  <div className="flex items-center gap-2">
                    <div className="w-2 h-2 rounded-full bg-red-500/40" />
                    <div className="w-2 h-2 rounded-full bg-yellow-500/40" />
                    <div className="w-2 h-2 rounded-full bg-green-500/40" />
                    <span className="text-[10px] font-mono text-slate-500 ml-4 uppercase tracking-widest">Compiler_Input</span>
                  </div>
                  <button onClick={handleCopy} className="text-slate-500 hover:text-white transition-colors">
                    {isCopied ? <ClipboardCheck className="w-4 h-4 text-green-400" /> : <ClipboardCheck className="w-4 h-4" />}
                  </button>
                </div>
                <Textarea
                  value={code}
                  onChange={(e) => setCode(e.target.value)}
                  className="min-h-[580px] bg-transparent border-none text-slate-300 font-mono text-sm p-8 focus-visible:ring-0 resize-none scrollbar-hide"
                  placeholder="# Paste code for AST structural verification..."
                />
              </div>
            </div>
            
            <Button 
              size="lg"
              onClick={analyzeCode}
              disabled={!code.trim() || result.status === 'loading'}
              className="w-full py-10 rounded-[2rem] bg-gradient-to-r from-purple-600 to-fuchsia-600 hover:shadow-[0_0_40px_-5px_rgba(168,85,247,0.4)] transition-all text-xl font-black italic tracking-tight"
            >
              {result.status === 'loading' ? 'SCANNING DNA...' : 'INITIALIZE VULNERABILITY SCAN'}
            </Button>
          </motion.main>

          {/* RIGHT: REPORT */}
          <motion.section 
            initial={{ opacity: 0, x: 30 }}
            animate={{ opacity: 1, x: 0 }}
            className="lg:col-span-4 h-[750px]"
          >
            <div className="bg-slate-900/40 border border-slate-800/60 rounded-[2.5rem] p-10 h-full flex flex-col backdrop-blur-3xl shadow-2xl relative overflow-hidden">
              <h3 className="text-[10px] font-black text-slate-500 tracking-[0.4em] uppercase mb-16">Security Verdict</h3>
              
              <div className="flex-1 flex flex-col items-center justify-center">
                <AnimatePresence mode="wait">
                  {result.status === 'waiting' && (
                    <motion.div 
                      key="waiting"
                      initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                      className="text-center opacity-20"
                    >
                      <Code2 className="w-20 h-20 mx-auto mb-6 stroke-[1px]" />
                      <p className="text-[10px] uppercase font-black tracking-widest">Engine Ready</p>
                    </motion.div>
                  )}

                  {result.status === 'loading' && (
                    <motion.div 
                      key="loading"
                      initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                      className="text-center"
                    >
                      <div className="w-20 h-20 rounded-full border-2 border-slate-800 border-t-purple-500 animate-spin mx-auto mb-8 shadow-2xl" />
                      <p className="text-purple-400 text-[10px] font-black tracking-widest animate-pulse">AST_PARSING_INITIATED</p>
                    </motion.div>
                  )}

                  {(result.status === 'malicious' || result.status === 'clean') && (
                    <motion.div 
                      key="result"
                      initial={{ opacity: 0, scale: 0.9, y: 20 }}
                      animate={{ opacity: 1, scale: 1, y: 0 }}
                      className="text-center w-full"
                    >
                      <div className={`mx-auto mb-10 w-32 h-32 rounded-full flex items-center justify-center border-2 shadow-2xl transition-colors duration-1000 ${
                        result.status === 'malicious' ? 'bg-red-500/5 border-red-500/20 shadow-red-500/20' : 'bg-green-500/5 border-green-500/20 shadow-green-500/20'
                      }`}>
                        {result.status === 'malicious' ? <ShieldX className="w-16 h-16 text-red-500" /> : <ShieldCheck className="w-16 h-16 text-green-500" />}
                      </div>
                      <div className={`inline-block px-6 py-1.5 rounded-full mb-8 text-[10px] font-black tracking-widest border ${
                        result.status === 'malicious' ? 'bg-red-500/10 border-red-500/20 text-red-400' : 'bg-green-500/10 border-green-500/20 text-green-400'
                      }`}>
                        {result.riskLevel} RISK
                      </div>
                      <h2 className="text-4xl font-black mb-6 tracking-tighter italic">
                        {result.status === 'malicious' ? 'Threat Detected' : 'No Threats Found'}
                      </h2>
                      <p className="text-slate-400 text-sm leading-relaxed mb-12 font-mono italic px-4 border-l-2 border-slate-800 h-16 overflow-y-auto">
                        {result.message && <TypewriterText text={result.message} />}
                      </p>
                      <Button 
                        onClick={handleDownloadReport} 
                        variant="outline" 
                        className={`w-full py-8 border-slate-800 rounded-2xl font-bold transition-all uppercase tracking-widest text-xs ${
                          result.status === 'malicious' 
                          ? 'hover:bg-red-500 hover:text-white hover:border-red-500 shadow-[0_0_20px_-5px_rgba(239,68,68,0.3)]' 
                          : 'hover:bg-white hover:text-black'
                        }`}
                      >
                        <Download className="w-4 h-4 mr-2" /> Export Audit Report
                      </Button>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            </div>
          </motion.section>
        </div>
      </div>
    </div>
  );
}