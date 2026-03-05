import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Shield, Loader2, Sparkles, Terminal } from 'lucide-react';
import CodeEditor from './CodeEditor';
import { cn } from '@/lib/utils';
import type { VulnerabilityMarker } from './CodeEditor';

const INITIAL_CODE = `from flask import Flask, request
import sqlite3

app = Flask(__name__)

@app.route('/login', methods=['POST'])
def login():
    username = request.form.get('username')
    password = request.form.get('password')
    
    # Connect to database
    conn = sqlite3.connect('users.db')
    cursor = conn.cursor()
    
    # Authenticate user
    query = f"SELECT * FROM users WHERE username='{username}' AND password='{password}'"
    cursor.execute(query)
    
    user = cursor.fetchone()
    
    if user:
        return "Login successful!"
    return "Invalid credentials"
`;

export function HeroMiniDemo() {
    const [code, setCode] = useState(INITIAL_CODE);
    const [isScanning, setIsScanning] = useState(false);
    const [scanComplete, setScanComplete] = useState(false);
    const [vulnerabilities, setVulnerabilities] = useState<VulnerabilityMarker[]>([]);

    // Simulate a scan for the demo
    const handleScan = () => {
        setIsScanning(true);
        setScanComplete(false);
        setVulnerabilities([]);

        // Simulating API call delay for dramatic effect
        setTimeout(() => {
            const lowerCode = code.toLowerCase();
            let newVulns: VulnerabilityMarker[] = [];

            if (lowerCode.includes("select ") || lowerCode.includes("insert ") || lowerCode.includes("update ")) {
                newVulns.push({
                    line: 15, // Mock line
                    pattern: "SQL Injection",
                    severity: "CRITICAL",
                    description: "Using f-strings or concatenation to build SQL queries allows attackers to manipulate your database.",
                    snippet: "query = f\"SELECT * FROM ...\""
                });
            } else if (lowerCode.includes("print") || lowerCode.includes("console.log")) {
                newVulns.push({
                    line: 2,
                    pattern: "Information Exposure",
                    severity: "LOW",
                    description: "Logging statements may leak sensitive information to the console or system logs in production environments.",
                    snippet: "print(...)"
                });
            }

            setVulnerabilities(newVulns);
            setIsScanning(false);
            setScanComplete(true);
        }, 1500);
    };

    const handleReset = () => {
        setCode(INITIAL_CODE);
        setVulnerabilities([]);
        setScanComplete(false);
        setIsScanning(false);
    };

    return (
        <div className="relative rounded-2xl border border-white/[0.08] bg-[#0A0A0A] overflow-hidden shadow-2xl shadow-blue-900/20 group backdrop-blur-xl">
            {/* Custom Window Header */}
            <div className="flex items-center justify-between px-4 py-3 border-b border-white/[0.06] bg-white/[0.02] backdrop-blur-md">
                <div className="flex items-center gap-2">
                    <div className="flex gap-1.5 mr-4">
                        <div className="w-3 h-3 rounded-full bg-red-500/80 shadow-[0_0_10px_rgba(239,68,68,0.5)]" />
                        <div className="w-3 h-3 rounded-full bg-yellow-500/80 shadow-[0_0_10px_rgba(234,179,8,0.5)]" />
                        <div className="w-3 h-3 rounded-full bg-green-500/80 shadow-[0_0_10px_rgba(34,197,94,0.5)]" />
                    </div>
                    <Terminal className="w-4 h-4 text-neutral-500" />
                    <span className="text-xs text-neutral-400 font-mono tracking-wide">app.py</span>
                </div>

                <div className="flex items-center gap-3">
                    <AnimatePresence mode="wait">
                        {isScanning ? (
                            <motion.div
                                initial={{ opacity: 0, scale: 0.8 }}
                                animate={{ opacity: 1, scale: 1 }}
                                exit={{ opacity: 0, scale: 0.8 }}
                                className="flex items-center gap-2 text-xs font-medium text-blue-400 font-mono bg-blue-500/10 px-3 py-1.5 rounded-full border border-blue-500/20"
                            >
                                <Loader2 className="w-3.5 h-3.5 animate-spin" /> Analyzing Model...
                            </motion.div>
                        ) : scanComplete ? (
                            <motion.button
                                initial={{ opacity: 0, scale: 0.8 }}
                                animate={{ opacity: 1, scale: 1 }}
                                exit={{ opacity: 0, scale: 0.8 }}
                                onClick={handleReset}
                                className="text-xs font-semibold text-neutral-400 hover:text-white transition-colors bg-white/5 px-3 py-1.5 rounded-full border border-white/10 hover:bg-white/10"
                            >
                                Reset Demo
                            </motion.button>
                        ) : (
                            <motion.button
                                initial={{ opacity: 0, scale: 0.8 }}
                                animate={{ opacity: 1, scale: 1 }}
                                exit={{ opacity: 0, scale: 0.8 }}
                                onClick={handleScan}
                                className="flex items-center gap-2 text-xs font-bold text-white bg-blue-600 hover:bg-blue-500 px-4 py-1.5 rounded-full shadow-[0_0_20px_-5px_rgba(59,130,246,0.5)] transition-all hover:scale-105"
                            >
                                <Sparkles className="w-3.5 h-3.5" /> Scan Code
                            </motion.button>
                        )}
                    </AnimatePresence>
                </div>
            </div>

            {/* Editor Area with elegant height transitions */}
            <div className="relative">
                <CodeEditor
                    className={cn(
                        "transition-all duration-300 ease-in-out border-none rounded-none !h-[300px]",
                        (isScanning || scanComplete) ? "opacity-50 grayscale-[50%]" : "opacity-100"
                    )}
                    code={code}
                    setCode={setCode}
                    language="python"
                    vulnerabilities={vulnerabilities}
                    readOnly={isScanning}
                />

                {/* Floating Scan Scanner beam effect */}
                {isScanning && (
                    <motion.div
                        className="absolute inset-0 z-20 pointer-events-none"
                    >
                        <motion.div
                            className="w-full h-8 bg-blue-500/20 border-y border-blue-500/30 shadow-[0_0_40px_rgba(59,130,246,0.3)] backdrop-blur-[2px]"
                            animate={{ y: [0, 300, 0] }}
                            transition={{ duration: 1.5, repeat: Infinity, ease: "linear" }}
                        />
                    </motion.div>
                )}
            </div>

            {/* Results Popover - Slides up smoothly */}
            <AnimatePresence>
                {scanComplete && (
                    <motion.div
                        initial={{ opacity: 0, y: 20, height: 0 }}
                        animate={{ opacity: 1, y: 0, height: 'auto' }}
                        exit={{ opacity: 0, y: 20, height: 0 }}
                        transition={{ duration: 0.4, type: "spring", bounce: 0.3 }}
                        className={cn(
                            "border-t overflow-hidden",
                            vulnerabilities.length > 0
                                ? (vulnerabilities[0].severity === 'CRITICAL' || vulnerabilities[0].severity === 'HIGH' ? "border-red-500/20 bg-red-950/20" : "border-yellow-500/20 bg-yellow-950/20")
                                : "border-green-500/20 bg-green-950/20"
                        )}
                    >
                        <div className="p-6">
                            {vulnerabilities.length > 0 ? (
                                <>
                                    <div className="flex items-center gap-2 mb-3">
                                        <Shield className={cn("w-5 h-5 animate-pulse", vulnerabilities[0].severity === 'CRITICAL' || vulnerabilities[0].severity === 'HIGH' ? "text-red-500" : "text-yellow-500")} />
                                        <span className={cn("text-sm font-bold tracking-[0.1em] uppercase", vulnerabilities[0].severity === 'CRITICAL' || vulnerabilities[0].severity === 'HIGH' ? "text-red-400" : "text-yellow-400")}>
                                            {vulnerabilities[0].severity === 'CRITICAL' || vulnerabilities[0].severity === 'HIGH' ? 'Vulnerability Found' : 'Security Warning'}
                                        </span>
                                    </div>
                                    <p className="text-[15px] text-neutral-300 leading-relaxed max-w-[90%]">
                                        <strong className="text-white mr-1 text-base">{vulnerabilities[0].pattern}</strong> — {vulnerabilities[0].description}
                                    </p>
                                    <div className="flex items-center gap-3 mt-5">
                                        <span className={cn(
                                            "text-xs px-3 py-1.5 rounded-lg font-bold border shadow-[inset_0_1px_rgba(255,255,255,0.1)]",
                                            vulnerabilities[0].severity === 'CRITICAL' || vulnerabilities[0].severity === 'HIGH'
                                                ? "bg-red-500/10 text-red-400 border-red-500/20"
                                                : "bg-yellow-500/10 text-yellow-500 border-yellow-500/20"
                                        )}>
                                            Severity: {vulnerabilities[0].severity}
                                        </span>
                                        <span className={cn(
                                            "text-xs px-3 py-1.5 rounded-lg font-bold border shadow-[inset_0_1px_rgba(255,255,255,0.1)]",
                                            vulnerabilities[0].severity === 'CRITICAL' || vulnerabilities[0].severity === 'HIGH'
                                                ? "bg-blue-500/10 text-blue-400 border-blue-500/20"
                                                : "bg-neutral-500/20 text-neutral-400 border-neutral-500/30"
                                        )}>
                                            XP Reward: {vulnerabilities[0].severity === 'CRITICAL' || vulnerabilities[0].severity === 'HIGH' ? '+50' : '+0'}
                                        </span>
                                    </div>
                                </>
                            ) : (
                                <>
                                    <div className="flex items-center gap-2 mb-3">
                                        <Shield className="w-5 h-5 text-green-500" />
                                        <span className="text-sm font-bold text-green-400 tracking-[0.1em] uppercase">Scan Complete</span>
                                    </div>
                                    <p className="text-[15px] text-neutral-300 leading-relaxed max-w-[90%]">
                                        <strong className="text-white mr-1 text-base">No Vulnerabilities Detected</strong> — The AST parser and AI model verified your code structure is secure.
                                    </p>
                                    <div className="flex items-center gap-3 mt-5">
                                        <span className="text-xs px-3 py-1.5 rounded-lg bg-green-500/10 text-green-400 font-bold border border-green-500/20 shadow-[inset_0_1px_rgba(255,255,255,0.1)]">Status: Secure</span>
                                        <span className="text-xs px-3 py-1.5 rounded-lg bg-blue-500/10 text-blue-400 font-bold border border-blue-500/20 shadow-[inset_0_1px_rgba(255,255,255,0.1)]">XP Reward: +10</span>
                                    </div>
                                </>
                            )}
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    );
}
