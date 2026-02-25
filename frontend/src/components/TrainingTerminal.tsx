import React, { useEffect, useRef } from 'react';

interface TrainingTerminalProps {
    logs: string[];
}

// ANSI color code to Tailwind class mapping
function parseAnsi(text: string): { text: string; className: string }[] {
    const parts: { text: string; className: string }[] = [];
    const regex = /\x1b\[([0-9;]+)m/g;
    let lastIndex = 0;
    let currentClass = 'text-slate-300';

    let match;
    while ((match = regex.exec(text)) !== null) {
        // Push text before this ANSI code
        if (match.index > lastIndex) {
            parts.push({ text: text.slice(lastIndex, match.index), className: currentClass });
        }

        const code = match[1];
        if (code === '0') currentClass = 'text-slate-300';
        else if (code === '31' || code === '1;31') currentClass = 'text-red-400';
        else if (code === '32' || code === '1;32') currentClass = 'text-green-400';
        else if (code === '33' || code === '1;33') currentClass = 'text-yellow-400';
        else if (code === '34' || code === '1;34') currentClass = 'text-blue-400';
        else if (code === '35' || code === '1;35') currentClass = 'text-purple-400';
        else if (code === '36' || code === '1;36') currentClass = 'text-cyan-400';
        else if (code === '1') currentClass = 'text-white font-bold';

        lastIndex = match.index + match[0].length;
    }

    // Push remaining text
    if (lastIndex < text.length) {
        parts.push({ text: text.slice(lastIndex), className: currentClass });
    }

    return parts.length > 0 ? parts : [{ text, className: 'text-slate-300' }];
}

const TrainingTerminal: React.FC<TrainingTerminalProps> = ({ logs }) => {
    const scrollRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        if (scrollRef.current) {
            scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
        }
    }, [logs]);

    return (
        <div
            ref={scrollRef}
            className="w-full h-full bg-[#0f172a] rounded-xl overflow-y-auto p-4 font-mono text-xs leading-relaxed"
        >
            {/* Welcome banner */}
            <div className="text-cyan-400 font-bold mb-1">Soteria Neural Engine v2.0</div>
            <div className="text-slate-400 mb-1">Initializing local training environment...</div>
            <div className="mb-2" />

            {logs.length === 0 ? (
                <div className="text-slate-700 animate-pulse">
                    <span className="text-green-500">$</span> Waiting for training command...
                </div>
            ) : (
                logs.map((line, i) => (
                    <div key={i} className="min-h-[1.2em]">
                        {parseAnsi(line).map((part, j) => (
                            <span key={j} className={part.className}>{part.text}</span>
                        ))}
                    </div>
                ))
            )}

            {/* Cursor */}
            {logs.length > 0 && (
                <div className="mt-1">
                    <span className="text-green-500">$</span>
                    <span className="inline-block w-2 h-4 bg-cyan-400 ml-1 animate-pulse" />
                </div>
            )}
        </div>
    );
};

export default TrainingTerminal;
