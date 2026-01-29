import sys
import ast
import os
from pathlib import Path
from collections import Counter
from joblib import load, dump
from flask import Flask, request, jsonify
from flask_cors import CORS
import pandas as pd
from flask import send_file
from io import BytesIO
from fpdf import FPDF, XPos, YPos
from datetime import datetime

BUZZ_WORDS = {}  # Placeholder - will be loaded from vulnerability_db

# to make normalizer_AST file accessable 
ROOT = Path(__file__).resolve().parent.parent
# Ensure this points to the FOLDER, not the file
SOURCEPATH = str(ROOT / 'backend' / 'src')

if SOURCEPATH not in sys.path:
    sys.path.append(SOURCEPATH)



# --- INITIALIZATION ---
normalizer = None

try:
    # This looks for normalizer_AST.py inside the SOURCEPATH folder
    from normalizer_AST import codeNormalizer
    normalizer = codeNormalizer()
    print("✅ Normalizer loaded successfully!")
except ImportError as e:
    print(f"❌ Critical Error: Could not find normalizer_AST in {SOURCEPATH}")
    print(f"Technical detail: {e}")
    # Fallback to prevent NameError crash
    class DummyNormalizer:
        def visit(self, tree): return tree
    normalizer = DummyNormalizer()
    print("⚠️ Using Dummy Normalizer (Analysis will be less accurate)")

# Multi-language support
try:
    from language_detector import detect_language
    from treesitter_parser import get_node_counts, get_supported_languages
    MULTI_LANG_ENABLED = True
    print(f"✅ Multi-language support enabled: {get_supported_languages()}")
except ImportError as e:
    MULTI_LANG_ENABLED = False
    print(f"⚠️ Multi-language support disabled: {e}")

# Vulnerability database
try:
    from vulnerability_db import VULNERABILITY_PATTERNS
    BUZZ_WORDS = {pattern: info[0] for pattern, info in VULNERABILITY_PATTERNS.items()}
    # Also create a severity lookup
    SEVERITY_LOOKUP = {pattern: info[1] for pattern, info in VULNERABILITY_PATTERNS.items()}
    CWE_LOOKUP = {pattern: info[2] for pattern, info in VULNERABILITY_PATTERNS.items()}
    print(f"✅ Vulnerability database loaded: {len(VULNERABILITY_PATTERNS)} patterns")
except ImportError as e:
    print(f"⚠️ Vulnerability database not loaded: {e}")
    SEVERITY_LOOKUP = {}
    CWE_LOOKUP = {}


app = Flask(__name__)
# allows all routes to be cross origin (cross connection between 2 different origins; fronted and backend)
# Replace your current CORS line with this:
CORS(app, resources={r"/*": {'origins': "*"}})

MODELPATH = ROOT / 'backend'/ 'ML_master' / 'acidModel.pkl'
lastModelTime = 0
model = None
modelFeatures = None

print("🔄 ACID MIDDLEWARE INITIALIZATION")
try:
    model = load(MODELPATH)
    modelFeatures = model.feature_names_in_
    print("✅ Model loaded successfully!")
except Exception as e:
    print(f"Could not load model, {e}")

def load_model_if_updated():
    global model, lastModelTime
    try:
        # Get the timestamp of when the file was last saved
        current_mtime = os.path.getmtime(MODELPATH)
        
        # If the timestamp has changed (Watcher updated it), reload!
        if current_mtime > lastModelTime:
            print("🔄 New model detected! Reloading into memory...")
            model = load(MODELPATH)
            lastModelTime = current_mtime
    except Exception as e:
        print(f"❌ Error loading model: {e}")


# Processing Engine
def structuralDNAExtraction(rawCode):
    """
    Extract structural features from code using AST analysis.
    Supports multiple languages via tree-sitter.
    """
    detected_language = 'python'
    confidence = 0.0
    
    # Try multi-language detection first
    if MULTI_LANG_ENABLED:
        try:
            detected_language, confidence = detect_language(rawCode)
            print(f"🔍 Detected language: {detected_language} (confidence: {confidence:.2f})")
        except Exception as e:
            print(f"Language detection failed: {e}")
            detected_language = 'python'
    
    # Use tree-sitter for all languages (more consistent)
    if MULTI_LANG_ENABLED:
        try:
            counts = get_node_counts(rawCode, detected_language)
            
            if not counts:
                return "SYNTAX_ERROR"
            
            # Create DataFrame with node counts
            df = pd.DataFrame([counts])
            
            # Align with model features (fill missing with 0)
            df_aligned = df.reindex(columns=modelFeatures, fill_value=0)
            
            # Add any extra columns from detection that model doesn't know about
            for col in df.columns:
                if col not in df_aligned.columns:
                    df_aligned[col] = df[col]
            
            return df_aligned, detected_language
            
        except Exception as e:
            print(f"Tree-sitter parsing failed for {detected_language}: {e}")
            # Fall back to Python AST if tree-sitter fails
    
    # Fallback: Original Python-only AST parsing
    try:
        tree = ast.parse(rawCode)
        normalizedTree = normalizer.visit(tree)

        nodes = [type(node).__name__ for node in ast.walk(normalizedTree)]
        counts = dict(Counter(nodes))
        
        # reindexing
        df = pd.DataFrame([counts])
        df_aligned = df.reindex(columns=modelFeatures, fill_value=0)

        return df_aligned, 'python'
    
    except SyntaxError:
        return "SYNTAX_ERROR", detected_language
    
    except Exception as e:
        print(f"Error processing code: {e}")
        return None, detected_language
    

@app.route('/analyze', methods=['POST'])
def analyze():
    data = request.get_json()
    codeInput = data.get('code', '')

    if len(codeInput) > 50000:
        return jsonify({
            'status':'error',
            'message': 'Code exceeds maximum character limit (50k).'
        }), 400

    if not codeInput:
        return jsonify({'status': 'error', 'message': 'No code provided'}), 400
    
    # 1. KEYWORD SAFETY NET
    triggerKeywords = [k for k in BUZZ_WORDS if k in codeInput]

    # 2. TRANSFORM CODE INTO NUMBERS
    result = structuralDNAExtraction(codeInput)
    
    # Handle tuple return (dataframe, language)
    if isinstance(result, tuple):
        featuresDf, detected_language = result
    else:
        featuresDf = result
        detected_language = 'python'

    # 3. ERROR HANDLING
    if isinstance(featuresDf, str) and featuresDf == "SYNTAX_ERROR":
        return jsonify({
            'malicious': False,
            'risk_level': 'INVALID',
            'reason': f"Syntax Error: This {detected_language} code cannot be parsed",
            'language': detected_language
        }), 200
        
    if featuresDf is None:
        return jsonify({'status': 'error', 'message': 'Analysis failed.', 'language': detected_language}), 500
    
    load_model_if_updated()

    # 4. AI VERDICT
    try:
        probability = model.predict_proba(featuresDf)[0]
        maliciousProb = probability[1]
        confidence = round(max(probability) * 100, 1)
    except Exception as e:
        # Model may not support new language features - use keyword detection only
        print(f"Model prediction failed: {e}")
        maliciousProb = 0.5 if triggerKeywords else 0.1
        confidence = 50.0

    # 5. RISK HIERARCHY LOGIC
    # Priority 1: Immediate Keyword Match
    if triggerKeywords:
        verdict = True
        riskLabel = "CRITICAL"
        keyword = triggerKeywords[0]
        detail = BUZZ_WORDS.get(keyword, "Suspicious pattern detected")
        message = f"Immediate threat: {detail}"
    
    # Priority 2: High AI Confidence
    elif maliciousProb > 0.85:
        verdict = True
        riskLabel = "HIGH"
        message = f"Critical structural anomaly detected: {round(maliciousProb * 100)}% confidence"
        
    # Priority 3: Medium Risk / Suspicious
    elif maliciousProb > 0.40:
        verdict = False
        riskLabel = "MEDIUM"
        message = "Suspicious patterns noted, but insufficient evidence for threat classification"
        
    # Priority 4: Safe
    else:
        verdict = False
        riskLabel = "LOW"
        message = "Code structure follows standard safety profiles"

    return jsonify({
        'malicious': verdict,
        'confidence': confidence,
        'risk_level': riskLabel,
        'reason': message,
        'language': detected_language,
        'metadata': {
            'nodes_scanned': len(featuresDf.columns),
            'engine': 'ACID v3.0 (Multi-Language)',
            'supported_languages': ['python', 'java', 'javascript', 'typescript', 'c', 'cpp', 'c_sharp', 'go', 'ruby', 'php'],
            'process_time': 'Real-time'
        }
    })


@app.route('/generate-report', methods=['POST']) 
def generateReport():
    data = request.get_json()
    snippet = data.get('code', '')
    verdict = data.get('verdict', 'UNKNOWN')
    confidence = data.get('confidence', 0)

    # Initialize pdf
    pdf = FPDF()
    pdf.add_page()

    # Header
    pdf.set_font("Helvetica", "B", 20)
    pdf.set_text_color(147, 51, 234) 
    pdf.cell(0, 10, "CYBER SENTINEL SECURITY AUDIT", 
             new_x=XPos.LMARGIN, new_y=YPos.NEXT, align="C")
    
    pdf.set_font("Helvetica", size=10)
    pdf.set_text_color(100, 100, 100)
    pdf.cell(0, 10, f"Generated on: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}", 
             new_x=XPos.LMARGIN, new_y=YPos.NEXT, align="C")
    pdf.ln(10)

    # Risk Assessment Section
    pdf.set_font("Helvetica", "B", 14)
    pdf.set_text_color(0, 0, 0)
    pdf.cell(0, 10, "1. Executive Summary", new_x=XPos.LMARGIN, new_y=YPos.NEXT)
    
    pdf.set_font("Helvetica", size=12)
    pdf.cell(0, 10, f"Detection Verdict: {verdict}", new_x=XPos.LMARGIN, new_y=YPos.NEXT)
    pdf.cell(0, 10, f"AI Confidence Score: {confidence}%", new_x=XPos.LMARGIN, new_y=YPos.NEXT)
    pdf.ln(5)

    # Technical Details
    pdf.set_font("Helvetica", "B", 14)
    pdf.cell(0, 10, "2. Technical Code Analysis", new_x=XPos.LMARGIN, new_y=YPos.NEXT)
    
    pdf.set_font("Courier", size=9)
    # multi_cell automatically wraps text and moves to the next line
    pdf.multi_cell(0, 5, snippet[:2000] + "\n\n[... Analysis Complete ...]") 

    # FIX: In modern fpdf2, .output() returns bytes directly. 
    # No need for (dest='S') or .encode()
    pdf_output = pdf.output() 

    return send_file(
        BytesIO(pdf_output),
        mimetype='application/pdf',
        as_attachment=True,
        download_name=f"Sentinel_Report_{datetime.now().strftime('%Y%m%d')}.pdf"
    )
    
    
if __name__ == "__main__":
    print("Backend running at port 500")
    app.run(host='0.0.0.0', port=5001)

