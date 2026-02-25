import { useRef, useEffect, useState, useCallback } from 'react';
import ForceGraph2D from 'react-force-graph-2d';
import { motion, AnimatePresence } from 'framer-motion';
import { Share2, RefreshCw, ZoomIn, ZoomOut, Maximize2, ScanSearch, X, Shield, Globe, AlertTriangle } from 'lucide-react';
import { Button } from '@/components/ui/button';

// Read real scan history from localStorage
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

interface GraphNode {
    id: string;
    label: string;
    group: string;
    color: string;
    size: number;
    type: 'hub' | 'scan' | 'verdict' | 'language';
    data?: HistoryItem;
}

interface GraphLink {
    source: string;
    target: string;
    color: string;
}

const RISK_COLORS: Record<string, string> = {
    CRITICAL: '#ef4444',
    HIGH: '#f97316',
    MEDIUM: '#eab308',
    LOW: '#22c55e',
    INVALID: '#6b7280',
};

const VERDICT_COLORS = {
    malicious: '#ef4444',
    clean: '#22c55e',
};

const LANG_COLOR = '#3b82f6';

function buildGraphFromHistory(history: HistoryItem[]): { nodes: GraphNode[]; links: GraphLink[] } {
    if (history.length === 0) return { nodes: [], links: [] };

    const nodes: GraphNode[] = [];
    const links: GraphLink[] = [];
    const languageNodes = new Set<string>();
    const verdictNodes = new Set<string>();

    // Hub node
    nodes.push({
        id: 'hub',
        label: 'Your Scans',
        group: 'hub',
        color: '#06b6d4',
        size: 14,
        type: 'hub',
    });

    // Verdict cluster nodes
    for (const item of history) {
        if (!verdictNodes.has(item.verdict)) {
            verdictNodes.add(item.verdict);
            nodes.push({
                id: `verdict-${item.verdict}`,
                label: item.verdict === 'malicious' ? '⚠ Threats' : '✓ Clean',
                group: 'verdict',
                color: VERDICT_COLORS[item.verdict],
                size: 10,
                type: 'verdict',
            });
            links.push({
                source: 'hub',
                target: `verdict-${item.verdict}`,
                color: VERDICT_COLORS[item.verdict] + '40',
            });
        }
    }

    // Language cluster nodes
    for (const item of history) {
        const lang = item.language || 'unknown';
        if (!languageNodes.has(lang)) {
            languageNodes.add(lang);
            nodes.push({
                id: `lang-${lang}`,
                label: lang.charAt(0).toUpperCase() + lang.slice(1),
                group: 'language',
                color: LANG_COLOR,
                size: 8,
                type: 'language',
            });
            links.push({
                source: 'hub',
                target: `lang-${lang}`,
                color: LANG_COLOR + '30',
            });
        }
    }

    // Scan nodes
    for (const item of history) {
        const lang = item.language || 'unknown';
        const riskColor = RISK_COLORS[item.riskLevel] || '#6b7280';
        nodes.push({
            id: `scan-${item.id}`,
            label: item.codePreview,
            group: 'scan',
            color: riskColor,
            size: 5,
            type: 'scan',
            data: item,
        });
        // Link to verdict
        links.push({
            source: `verdict-${item.verdict}`,
            target: `scan-${item.id}`,
            color: riskColor + '30',
        });
        // Link to language
        links.push({
            source: `lang-${lang}`,
            target: `scan-${item.id}`,
            color: LANG_COLOR + '20',
        });
    }

    return { nodes, links };
}

export default function KnowledgeGraph() {
    const fgRef = useRef<any>(null);
    const [history, setHistory] = useState<HistoryItem[]>([]);
    const [graphData, setGraphData] = useState<{ nodes: GraphNode[]; links: GraphLink[] }>({ nodes: [], links: [] });
    const [selectedNode, setSelectedNode] = useState<GraphNode | null>(null);

    // Load history from localStorage
    useEffect(() => {
        const saved = localStorage.getItem('soteria_audit_v2');
        if (saved) {
            try {
                const parsed = JSON.parse(saved);
                setHistory(parsed);
            } catch (e) {
                console.error('Failed to parse scan history', e);
            }
        }
    }, []);

    // Build graph when history changes
    useEffect(() => {
        const data = buildGraphFromHistory(history);
        setGraphData(data);
    }, [history]);

    // Auto-fit after data loaded
    useEffect(() => {
        if (graphData.nodes.length > 0) {
            setTimeout(() => fgRef.current?.zoomToFit(400, 80), 500);
        }
    }, [graphData]);

    const handleZoomIn = () => fgRef.current?.zoom(fgRef.current.zoom() * 1.5, 400);
    const handleZoomOut = () => fgRef.current?.zoom(fgRef.current.zoom() / 1.5, 400);
    const handleZoomToFit = () => fgRef.current?.zoomToFit(400, 80);

    const refreshGraph = () => {
        const saved = localStorage.getItem('soteria_audit_v2');
        if (saved) {
            try {
                setHistory(JSON.parse(saved));
            } catch { }
        }
    };

    const handleNodeClick = useCallback((node: any) => {
        const graphNode = node as GraphNode;
        if (graphNode.type === 'scan') {
            setSelectedNode(graphNode);
        }
        fgRef.current?.centerAt(node.x, node.y, 800);
        fgRef.current?.zoom(5, 800);
    }, []);

    const nodeCanvasObject = useCallback((node: any, ctx: CanvasRenderingContext2D) => {
        const gNode = node as GraphNode & { x: number; y: number };
        const size = gNode.size || 5;

        // Glow effect
        ctx.shadowColor = gNode.color;
        ctx.shadowBlur = gNode.type === 'hub' ? 20 : gNode.type === 'verdict' ? 12 : 6;

        // Draw node circle
        ctx.beginPath();
        ctx.arc(gNode.x, gNode.y, size, 0, 2 * Math.PI);
        ctx.fillStyle = gNode.color + (gNode.type === 'scan' ? '90' : 'cc');
        ctx.fill();

        // Border
        ctx.strokeStyle = gNode.color;
        ctx.lineWidth = gNode.type === 'hub' ? 2 : 1;
        ctx.stroke();

        // Reset shadow
        ctx.shadowBlur = 0;

        // Label for non-scan nodes
        if (gNode.type !== 'scan') {
            ctx.font = `bold ${gNode.type === 'hub' ? 5 : 4}px sans-serif`;
            ctx.textAlign = 'center';
            ctx.fillStyle = '#e2e8f0';
            ctx.fillText(gNode.label, gNode.x, gNode.y + size + 8);
        }
    }, []);

    // Stats from history
    const totalScans = history.length;
    const threats = history.filter(h => h.verdict === 'malicious').length;
    const languages = new Set(history.map(h => h.language || 'unknown')).size;

    return (
        <div className="min-h-screen bg-[#020617] relative overflow-hidden">
            {/* OVERLAY UI */}
            <div className="absolute top-28 left-8 z-10 pointer-events-none">
                <motion.div initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }}>
                    <div className="flex items-center gap-2 text-cyan-400 mb-2">
                        <Share2 className="w-5 h-5" />
                        <span className="text-xs font-bold tracking-widest uppercase">Knowledge Graph</span>
                    </div>
                    <h1 className="text-4xl font-black text-white tracking-tighter">SCAN INTELLIGENCE MAP</h1>
                    <p className="text-slate-500 mt-2 max-w-md">
                        {totalScans > 0
                            ? `Mapping ${totalScans} scan${totalScans !== 1 ? 's' : ''} across ${languages} language${languages !== 1 ? 's' : ''}. ${threats} threat${threats !== 1 ? 's' : ''} detected.`
                            : 'No scans yet — analyze some code in the Soteria Engine to build your intelligence map.'
                        }
                    </p>
                </motion.div>
            </div>

            {/* Stats bar */}
            {totalScans > 0 && (
                <div className="absolute top-28 right-8 z-10 flex gap-3">
                    <div className="px-4 py-2 bg-slate-900/80 backdrop-blur-sm border border-slate-800 rounded-xl flex items-center gap-2">
                        <ScanSearch className="w-4 h-4 text-cyan-400" />
                        <span className="text-xs font-bold text-white">{totalScans}</span>
                        <span className="text-[10px] text-slate-500 uppercase tracking-wider">Scans</span>
                    </div>
                    <div className="px-4 py-2 bg-slate-900/80 backdrop-blur-sm border border-slate-800 rounded-xl flex items-center gap-2">
                        <AlertTriangle className="w-4 h-4 text-red-400" />
                        <span className="text-xs font-bold text-white">{threats}</span>
                        <span className="text-[10px] text-slate-500 uppercase tracking-wider">Threats</span>
                    </div>
                    <div className="px-4 py-2 bg-slate-900/80 backdrop-blur-sm border border-slate-800 rounded-xl flex items-center gap-2">
                        <Globe className="w-4 h-4 text-blue-400" />
                        <span className="text-xs font-bold text-white">{languages}</span>
                        <span className="text-[10px] text-slate-500 uppercase tracking-wider">Languages</span>
                    </div>
                </div>
            )}

            {/* Legend */}
            <div className="absolute bottom-20 left-8 z-10 pointer-events-none">
                <div className="flex flex-col gap-1.5 text-[10px] font-mono">
                    <div className="text-slate-600 uppercase tracking-widest mb-1 font-bold">Risk Levels</div>
                    {Object.entries(RISK_COLORS).map(([level, color]) => (
                        <div key={level} className="flex items-center gap-2">
                            <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: color }} />
                            <span className="text-slate-500">{level}</span>
                        </div>
                    ))}
                    <div className="mt-2 text-slate-600 uppercase tracking-widest mb-1 font-bold">Node Types</div>
                    <div className="flex items-center gap-2">
                        <div className="w-2.5 h-2.5 rounded-full bg-cyan-500" />
                        <span className="text-slate-500">Hub</span>
                    </div>
                    <div className="flex items-center gap-2">
                        <div className="w-2.5 h-2.5 rounded-full bg-blue-500" />
                        <span className="text-slate-500">Language</span>
                    </div>
                </div>
            </div>

            {/* Controls */}
            <div className="absolute bottom-8 right-8 z-10 flex flex-col gap-2">
                <Button variant="secondary" size="icon" onClick={handleZoomIn}><ZoomIn className="w-4 h-4" /></Button>
                <Button variant="secondary" size="icon" onClick={handleZoomOut}><ZoomOut className="w-4 h-4" /></Button>
                <Button variant="secondary" size="icon" onClick={handleZoomToFit}><Maximize2 className="w-4 h-4" /></Button>
                <Button variant="default" size="icon" onClick={refreshGraph} className="mt-4 bg-cyan-600 hover:bg-cyan-500"><RefreshCw className="w-4 h-4" /></Button>
            </div>

            {/* Selected Node Detail Panel */}
            <AnimatePresence>
                {selectedNode && selectedNode.data && (
                    <motion.div
                        initial={{ opacity: 0, x: 40 }}
                        animate={{ opacity: 1, x: 0 }}
                        exit={{ opacity: 0, x: 40 }}
                        className="absolute top-28 right-8 z-20 w-96 bg-slate-900/95 backdrop-blur-xl border border-slate-700 rounded-2xl shadow-2xl overflow-hidden"
                    >
                        <div className="p-5">
                            <div className="flex justify-between items-start mb-4">
                                <div>
                                    <span className={`text-[9px] font-bold px-2 py-0.5 rounded tracking-widest ${selectedNode.data.riskLevel === 'CRITICAL' ? 'bg-red-500 text-white' :
                                        selectedNode.data.riskLevel === 'HIGH' ? 'bg-orange-500/20 text-orange-400' :
                                            selectedNode.data.riskLevel === 'LOW' ? 'bg-green-500/20 text-green-400' :
                                                'bg-yellow-500/20 text-yellow-400'
                                        }`}>
                                        {selectedNode.data.riskLevel}
                                    </span>
                                    {selectedNode.data.language && (
                                        <span className="ml-2 text-[9px] font-bold px-2 py-0.5 rounded bg-blue-500/20 text-blue-400 tracking-widest uppercase">
                                            {selectedNode.data.language}
                                        </span>
                                    )}
                                </div>
                                <button onClick={() => setSelectedNode(null)} className="text-slate-500 hover:text-white transition-colors">
                                    <X className="w-4 h-4" />
                                </button>
                            </div>

                            <div className="flex items-center gap-2 mb-3">
                                <Shield className={`w-4 h-4 ${selectedNode.data.verdict === 'malicious' ? 'text-red-400' : 'text-green-400'}`} />
                                <span className={`text-sm font-bold ${selectedNode.data.verdict === 'malicious' ? 'text-red-400' : 'text-green-400'}`}>
                                    {selectedNode.data.verdict === 'malicious' ? 'Threat Detected' : 'Clean'}
                                </span>
                                <span className="text-[10px] text-slate-600 ml-auto font-mono">{selectedNode.data.timestamp}</span>
                            </div>

                            {selectedNode.data.confidence != null && (
                                <div className="mb-3">
                                    <div className="flex justify-between text-[9px] text-slate-500 mb-1">
                                        <span>Confidence</span>
                                        <span className="text-white font-bold">{selectedNode.data.confidence}%</span>
                                    </div>
                                    <div className="w-full h-1 rounded-full bg-slate-800">
                                        <div className="h-full rounded-full bg-cyan-500" style={{ width: `${selectedNode.data.confidence}%` }} />
                                    </div>
                                </div>
                            )}

                            <div className="bg-black/50 rounded-lg p-3 border border-slate-800 max-h-[200px] overflow-auto">
                                <pre className="text-[10px] text-slate-400 font-mono whitespace-pre-wrap break-all">
                                    {selectedNode.data.fullCode.substring(0, 500)}
                                    {selectedNode.data.fullCode.length > 500 && '\n\n... (truncated)'}
                                </pre>
                            </div>
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>

            {/* Empty State */}
            {totalScans === 0 && (
                <div className="absolute inset-0 flex items-center justify-center z-10">
                    <motion.div
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        className="text-center max-w-md"
                    >
                        <div className="w-24 h-24 mx-auto mb-6 rounded-full border-2 border-dashed border-slate-700 flex items-center justify-center">
                            <ScanSearch className="w-10 h-10 text-slate-700" />
                        </div>
                        <h2 className="text-2xl font-black text-white mb-3">No Intelligence Data</h2>
                        <p className="text-slate-500 text-sm mb-6">
                            Scan some code in the Soteria Engine first. Each scan creates a node in your intelligence map, revealing patterns across languages and risk levels.
                        </p>
                        <Button
                            onClick={() => window.location.hash = '#/scanner'}
                            className="bg-cyan-600 hover:bg-cyan-500 text-white font-bold rounded-xl"
                        >
                            <ScanSearch className="w-4 h-4 mr-2" /> Go to Scanner
                        </Button>
                    </motion.div>
                </div>
            )}

            {/* GRAPH */}
            {totalScans > 0 && (
                <div className="w-full h-screen">
                    <ForceGraph2D
                        ref={fgRef}
                        graphData={graphData}
                        nodeLabel={(node: any) => {
                            const n = node as GraphNode;
                            if (n.type === 'scan' && n.data) {
                                return `${n.data.riskLevel} | ${n.data.codePreview}`;
                            }
                            return n.label;
                        }}
                        nodeCanvasObject={nodeCanvasObject}
                        linkColor={(link: any) => link.color || 'rgba(255,255,255,0.05)'}
                        linkWidth={1}
                        backgroundColor="#020617"
                        enableNodeDrag={true}
                        d3AlphaDecay={0.02}
                        d3VelocityDecay={0.08}
                        onNodeClick={handleNodeClick}
                    />
                </div>
            )}
        </div>
    );
}
