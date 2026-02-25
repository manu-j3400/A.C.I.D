import React, { useCallback, useState, useEffect, useRef } from 'react';
import Editor, { OnMount, useMonaco } from '@monaco-editor/react';
import { UploadCloud } from 'lucide-react';
import { cn } from '@/lib/utils'; // Assuming this exists, based on shadcn usage in Scanner.tsx

export interface VulnerabilityMarker {
    line: number;
    pattern: string;
    severity: string;
    description: string;
    cwe?: string;
    snippet: string;
}

interface CodeEditorProps {
    code: string;
    setCode: (code: string) => void;
    language: string;
    className?: string;
    readOnly?: boolean;
    vulnerabilities?: VulnerabilityMarker[];
    activeLine?: number | null;
}

const CodeEditor: React.FC<CodeEditorProps> = ({
    code,
    setCode,
    language,
    className,
    readOnly = false,
    vulnerabilities = [],
    activeLine = null
}) => {
    const [isDragging, setIsDragging] = useState(false);
    const monaco = useMonaco();
    const editorRef = useRef<any>(null);

    const handleEditorDidMount: OnMount = (editor) => {
        editorRef.current = editor;
    };

    useEffect(() => {
        if (monaco && editorRef.current) {
            const model = editorRef.current.getModel();
            if (!model) return;

            if (vulnerabilities && vulnerabilities.length > 0) {
                const markers = vulnerabilities.map(v => ({
                    message: v.description + (v.cwe ? ` (${v.cwe})` : ''),
                    severity: v.severity === 'CRITICAL' || v.severity === 'HIGH'
                        ? monaco.MarkerSeverity.Error
                        : monaco.MarkerSeverity.Warning,
                    startLineNumber: v.line,
                    startColumn: 1,
                    endLineNumber: v.line,
                    endColumn: 1000 // Highlight the whole line
                }));
                monaco.editor.setModelMarkers(model, 'soteria', markers);
            } else {
                monaco.editor.setModelMarkers(model, 'soteria', []);
            }
        }
    }, [vulnerabilities, monaco]);

    useEffect(() => {
        if (editorRef.current && activeLine) {
            editorRef.current.revealLineInCenter(activeLine);
            editorRef.current.setPosition({ lineNumber: activeLine, column: 1 });
            editorRef.current.focus();
        }
    }, [activeLine]);

    const handleEditorChange = (value: string | undefined) => {
        setCode(value || '');
    };

    const onDrop = useCallback((e: React.DragEvent<HTMLDivElement>) => {
        e.preventDefault();
        setIsDragging(false);

        const files = e.dataTransfer.files;
        if (files && files.length > 0) {
            const file = files[0];
            const reader = new FileReader();

            reader.onload = (event) => {
                if (event.target?.result) {
                    setCode(event.target.result as string);
                }
            };

            reader.readAsText(file);
        }
    }, [setCode]);

    const onDragOver = useCallback((e: React.DragEvent<HTMLDivElement>) => {
        e.preventDefault();
        setIsDragging(true);
    }, []);

    const onDragLeave = useCallback((e: React.DragEvent<HTMLDivElement>) => {
        e.preventDefault();
        setIsDragging(false);
    }, []);

    // Standard monaco options
    const editorOptions = {
        minimap: { enabled: true },
        fontSize: 14,
        lineNumbers: 'on' as const,
        roundedSelection: false,
        scrollBeyondLastLine: false,
        readOnly: readOnly,
        automaticLayout: true,
        padding: { top: 16, bottom: 16 },
        theme: 'vs-dark', // default theme, can be customized
    };

    return (
        <div
            className={cn("relative w-full h-[600px] border border-slate-800 rounded-xl overflow-hidden group", className)}
            onDrop={onDrop}
            onDragOver={onDragOver}
            onDragLeave={onDragLeave}
        >
            {/* Drag Overlay */}
            {isDragging && (
                <div className="absolute inset-0 z-50 bg-blue-500/20 backdrop-blur-sm flex flex-col items-center justify-center border-2 border-dashed border-blue-500 rounded-xl transition-all">
                    <UploadCloud className="w-16 h-16 text-blue-400 mb-4 animate-bounce" />
                    <p className="text-xl font-bold text-blue-100">Drop file to load code</p>
                </div>
            )}

            <Editor
                height="100%"
                width="100%"
                language={language.toLowerCase()}
                value={code}
                theme="vs-dark"
                onChange={handleEditorChange}
                onMount={handleEditorDidMount}
                options={{
                    ...editorOptions,
                    readOnly: readOnly, // Use prop directly for override if needed
                }}
                loading={
                    <div className="flex items-center justify-center h-full text-slate-500">
                        Loading Editor...
                    </div>
                }
            />

            {/* File Upload Hint (visible when not dragging) */}
            {!isDragging && code.trim().length === 0 && (
                <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 pointer-events-none text-slate-600 text-center opacity-50">
                    <p className="text-sm font-mono">Type or paste code here...</p>
                    <p className="text-xs mt-2">or drag & drop a file</p>
                </div>
            )}
        </div>
    );
};

export default CodeEditor;
