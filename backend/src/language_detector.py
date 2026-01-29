"""
Language Detection Module
Detects programming language from code content using heuristics and syntax patterns.
"""

import re
from typing import Optional, Tuple

# Language signatures - ordered by specificity (most specific first)
LANGUAGE_SIGNATURES = {
    'typescript': [
        (r'\binterface\s+\w+\s*{', 10),
        (r':\s*(string|number|boolean|any)\b', 8),
        (r'\btype\s+\w+\s*=', 10),
        (r'<\w+>\s*\(', 5),
        (r'\basync\s+function', 3),
    ],
    'java': [
        (r'\bpublic\s+(static\s+)?(void|class|interface)', 15),
        (r'\bprivate\s+(static\s+)?(void|class)', 12),
        (r'\bString\s+\w+\s*=', 10),
        (r'\bSystem\.out\.print', 15),
        (r'\bimport\s+java\.', 20),
        (r'\bnew\s+\w+\s*\(', 5),
        (r'\bextends\s+\w+', 8),
        (r'\bimplements\s+\w+', 10),
    ],
    'c_sharp': [
        (r'\busing\s+System', 20),
        (r'\bnamespace\s+\w+', 15),
        (r'\bConsole\.(Write|Read)', 15),
        (r'\bvar\s+\w+\s*=', 5),
        (r'\basync\s+Task', 10),
        (r'\bpublic\s+partial\s+class', 12),
    ],
    'cpp': [
        (r'#include\s*<\w+>', 15),
        (r'\bstd::', 20),
        (r'\bcout\s*<<', 15),
        (r'\bcin\s*>>', 15),
        (r'\busing\s+namespace\s+std', 20),
        (r'\btemplate\s*<', 10),
        (r'\bclass\s+\w+\s*:', 8),
        (r'nullptr', 10),
    ],
    'c': [
        (r'#include\s*<stdio\.h>', 20),
        (r'#include\s*<stdlib\.h>', 20),
        (r'\bprintf\s*\(', 15),
        (r'\bscanf\s*\(', 15),
        (r'\bmalloc\s*\(', 12),
        (r'\bfree\s*\(', 10),
        (r'\bint\s+main\s*\(', 15),
        (r'\bchar\s*\*', 8),
    ],
    'go': [
        (r'\bpackage\s+\w+', 20),
        (r'\bfunc\s+\w+\s*\(', 15),
        (r'\bfmt\.(Print|Scan)', 15),
        (r':=', 10),
        (r'\bgo\s+func', 12),
        (r'\bchan\s+\w+', 12),
        (r'\bdefer\s+', 10),
    ],
    'ruby': [
        (r'\bdef\s+\w+', 10),
        (r'\bend\s*$', 8),
        (r'\brequire\s+[\'"]', 15),
        (r'\battr_(reader|writer|accessor)', 15),
        (r'\bputs\s+', 12),
        (r'\bclass\s+\w+\s*<', 10),
        (r'\.each\s+do\s*\|', 12),
    ],
    'php': [
        (r'<\?php', 25),
        (r'\$\w+\s*=', 15),
        (r'\becho\s+', 12),
        (r'\bfunction\s+\w+\s*\(', 8),
        (r'\barray\s*\(', 10),
        (r'\->', 5),
    ],
    'javascript': [
        (r'\bconst\s+\w+\s*=', 8),
        (r'\blet\s+\w+\s*=', 8),
        (r'\bvar\s+\w+\s*=', 6),
        (r'\bfunction\s+\w+\s*\(', 8),
        (r'=>', 6),
        (r'\bconsole\.(log|error|warn)', 15),
        (r'\brequire\s*\([\'"]', 12),
        (r'\bexport\s+(default|const|function)', 12),
        (r'\bimport\s+.*\s+from\s+[\'"]', 12),
    ],
    'python': [
        (r'\bdef\s+\w+\s*\(', 10),
        (r'\bimport\s+\w+', 10),
        (r'\bfrom\s+\w+\s+import', 12),
        (r'\bprint\s*\(', 8),
        (r'\bclass\s+\w+\s*(\(|:)', 10),
        (r'\bself\.\w+', 12),
        (r'\bif\s+.*:', 5),
        (r'\belif\s+', 10),
        (r'\b__\w+__', 10),
    ],
}

# Tree-sitter language name mapping
LANGUAGE_MAP = {
    'python': 'python',
    'java': 'java',
    'javascript': 'javascript',
    'typescript': 'typescript',
    'c': 'c',
    'cpp': 'cpp',
    'c_sharp': 'c_sharp',
    'go': 'go',
    'ruby': 'ruby',
    'php': 'php',
}


def detect_language(code: str, filename: Optional[str] = None) -> Tuple[str, float]:
    """
    Detect the programming language of the given code.
    
    Returns:
        Tuple of (language_name, confidence_score)
        language_name is one of: python, java, javascript, typescript, c, cpp, c_sharp, go, ruby, php
        confidence_score is between 0.0 and 1.0
    """
    # Try filename extension first
    if filename:
        ext_lang = _detect_from_extension(filename)
        if ext_lang:
            return ext_lang, 1.0
    
    # Fall back to content analysis
    scores = {}
    
    for lang, patterns in LANGUAGE_SIGNATURES.items():
        score = 0
        for pattern, weight in patterns:
            matches = len(re.findall(pattern, code, re.MULTILINE))
            score += matches * weight
        scores[lang] = score
    
    if not scores or max(scores.values()) == 0:
        return 'python', 0.0  # Default to Python with zero confidence
    
    best_lang = max(scores, key=scores.get)
    max_score = scores[best_lang]
    
    # Normalize confidence (heuristic: 50+ points = high confidence)
    confidence = min(1.0, max_score / 50.0)
    
    return best_lang, confidence


def _detect_from_extension(filename: str) -> Optional[str]:
    """Detect language from file extension."""
    ext_map = {
        '.py': 'python',
        '.java': 'java',
        '.js': 'javascript',
        '.jsx': 'javascript',
        '.ts': 'typescript',
        '.tsx': 'typescript',
        '.c': 'c',
        '.h': 'c',
        '.cpp': 'cpp',
        '.cc': 'cpp',
        '.cxx': 'cpp',
        '.hpp': 'cpp',
        '.cs': 'c_sharp',
        '.go': 'go',
        '.rb': 'ruby',
        '.php': 'php',
    }
    
    for ext, lang in ext_map.items():
        if filename.lower().endswith(ext):
            return lang
    
    return None


def get_supported_languages() -> list:
    """Return list of supported language names."""
    return list(LANGUAGE_MAP.keys())


if __name__ == "__main__":
    # Test the detector
    test_cases = [
        ("def hello():\n    print('Hello')", "python"),
        ("public class Main { public static void main(String[] args) {} }", "java"),
        ("const x = () => console.log('hi');", "javascript"),
        ("package main\n\nfunc main() { fmt.Println(\"Hi\") }", "go"),
        ("#include <stdio.h>\nint main() { printf(\"hi\"); }", "c"),
    ]
    
    for code, expected in test_cases:
        detected, conf = detect_language(code)
        status = "✓" if detected == expected else "✗"
        print(f"{status} Expected: {expected}, Got: {detected} (confidence: {conf:.2f})")
