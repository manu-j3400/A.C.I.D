import sys
import ast
import os
import sqlite3
import hashlib
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
import subprocess
import threading
import re
import time
import hmac
import uuid
from functools import wraps

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
# Secure CORS configuration
allowed_origins_env = os.environ.get('ALLOWED_ORIGINS', 'http://localhost:5173,http://127.0.0.1:5173,https://www.trysoteria.live,https://trysoteria.live,https://codebasesentinel.vercel.app,https://codebasesentinel-n2ikfeqq5-manu-j3400s-projects.vercel.app')
allowed_origins = [origin.strip() for origin in allowed_origins_env.split(',') if origin.strip()]
# Add support for vercel preview branches using regex if needed, but explicit list is safer
CORS(app, resources={r"/*": {'origins': allowed_origins}})

@app.after_request
def add_security_headers(response):
    """Add critical HTTP security headers (Helmet equivalent) to all responses."""
    response.headers['X-Frame-Options'] = 'DENY'
    response.headers['X-Content-Type-Options'] = 'nosniff'
    response.headers['Strict-Transport-Security'] = 'max-age=31536000; includeSubDomains'
    # Prevents browser from caching sensitive API responses
    response.headers['Cache-Control'] = 'no-store, max-age=0'
    return response
# --- RATE LIMITER ---
RATE_LIMITS = {}
RATE_LIMIT_LOCK = threading.Lock()

# --- AUTOMATION WEBHOOK STATE ---
AUTOMATION_RUNS = {}
AUTOMATION_LOCK = threading.Lock()
AUTOMATION_TTL_SECONDS = 60 * 60 * 24  # 24h idempotency window

def rate_limit(max_requests=20, window_seconds=60):
    """
    Simple in-memory sliding window rate limiter per IP address.
    Protects against API spam and credit burn.
    """
    def decorator(f):
        @wraps(f)
        def wrapped(*args, **kwargs):
            ip = request.headers.get('X-Forwarded-For', request.remote_addr)
            if ip:
                ip = ip.split(',')[0].strip()
            else:
                ip = 'unknown'
            
            now = time.time()
            with RATE_LIMIT_LOCK:
                if ip not in RATE_LIMITS:
                    RATE_LIMITS[ip] = []
                
                # Remove timestamps older than window_seconds
                RATE_LIMITS[ip] = [t for t in RATE_LIMITS[ip] if now - t < window_seconds]
                
                if len(RATE_LIMITS[ip]) >= max_requests:
                    return jsonify({
                        'error': 'Rate limit exceeded. Please wait a minute before scanning again.',
                        'malicious': False,
                        'confidence': 0,
                        'risk_level': 'UNKNOWN',
                        'vulnerabilities': []
                    }), 429
                
                RATE_LIMITS[ip].append(now)
                
            return f(*args, **kwargs)
        return wrapped
    return decorator

def _truncate_text(value, limit=8000):
    """Keep webhook responses bounded for Make and logs."""
    if not isinstance(value, str):
        value = str(value or "")
    if len(value) <= limit:
        return value, False
    return value[:limit] + "\n...[truncated]...", True

def _cleanup_automation_runs(now_ts):
    """Drop expired idempotency entries."""
    expired = [k for k, v in AUTOMATION_RUNS.items() if now_ts - v.get('created_at', 0) > AUTOMATION_TTL_SECONDS]
    for key in expired:
        AUTOMATION_RUNS.pop(key, None)

def _extract_instruction(payload):
    """
    Convert structured request payload to a compact instruction string
    that auto_improver.py can consume via argv.
    """
    if not isinstance(payload, dict):
        return None

    explicit = payload.get('instruction')
    if isinstance(explicit, str) and explicit.strip():
        return explicit.strip()[:2000]

    task_type = payload.get('task_type', 'incremental_improvement')
    llm_strategy = payload.get('llm_strategy', {})
    scope = payload.get('scope', {})
    quality_gates = payload.get('quality_gates', {})
    metadata = payload.get('metadata', {})

    # Keep instruction deterministic and concise.
    return (
        f"Task: {task_type}. "
        f"LLM strategy: {llm_strategy}. "
        f"Scope: {scope}. "
        f"Quality gates: {quality_gates}. "
        f"Metadata: {metadata}. "
        "Generate isolated improvements only, prioritize AI/ML reliability, and keep outputs safe for draft PR review."
    )[:2000]

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

# --- SCAN HISTORY DATABASE ---
SCAN_DB_PATH = ROOT / 'middleware' / 'scan_history.db'

def init_scan_db():
    """Initialize SQLite database for scan history."""
    conn = sqlite3.connect(str(SCAN_DB_PATH))
    c = conn.cursor()
    c.execute('''CREATE TABLE IF NOT EXISTS scans (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INTEGER,
        timestamp TEXT NOT NULL,
        language TEXT,
        risk_level TEXT,
        confidence REAL,
        malicious INTEGER,
        code_hash TEXT,
        nodes_scanned INTEGER,
        reason TEXT
    )''')
    
    # Run a simple migration safely: if user_id doesn't exist, this adds it. 
    # (SQLite doesn't support IF NOT EXISTS in ALTER TABLE, so we use a try-except)
    try:
        c.execute('ALTER TABLE scans ADD COLUMN user_id INTEGER')
    except sqlite3.OperationalError:
        pass # Column already exists
        
    conn.commit()
    conn.close()
    print("✅ Scan history database initialized")

init_scan_db()

# --- USER AUTHENTICATION DATABASE ---
import bcrypt
import jwt as pyjwt
import secrets

JWT_SECRET = os.environ.get('JWT_SECRET')
if not JWT_SECRET:
    print("⚠️ WARNING: JWT_SECRET environment variable not set. Generating a random temporary secret. Sessions will not persist across restarts.")
    JWT_SECRET = secrets.token_hex(32)

def init_users_db():
    """Initialize SQLite users table."""
    conn = sqlite3.connect(str(SCAN_DB_PATH))
    c = conn.cursor()
    c.execute('''CREATE TABLE IF NOT EXISTS users (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        email TEXT UNIQUE NOT NULL,
        password_hash TEXT NOT NULL,
        is_admin INTEGER DEFAULT 0,
        created_at TEXT NOT NULL
    )''')
    conn.commit()
    
    # Seed default admin if none exists
    c.execute('SELECT id FROM users WHERE is_admin = 1')
    if not c.fetchone():
        pw_hash = bcrypt.hashpw('admin123'.encode('utf-8'), bcrypt.gensalt()).decode('utf-8')
        c.execute(
            'INSERT INTO users (name, email, password_hash, is_admin, created_at) VALUES (?, ?, ?, ?, ?)',
            ('Admin', 'admin@acid.dev', pw_hash, 1, datetime.now().isoformat())
        )
        conn.commit()
        print("✅ Default admin seeded (admin@acid.dev / admin123)")
    
    conn.close()
    print("✅ Users database initialized")

init_users_db()

def generate_token(user_id, email, is_admin=False):
    """Generate a JWT token."""
    import time
    payload = {
        'user_id': user_id,
        'email': email,
        'is_admin': is_admin,
        'exp': int(time.time()) + 60 * 60 * 24 * 7  # 7 days
    }
    return pyjwt.encode(payload, JWT_SECRET, algorithm='HS256')

def decode_token(token):
    """Decode and validate a JWT token."""
    try:
        return pyjwt.decode(token, JWT_SECRET, algorithms=['HS256'])
    except pyjwt.ExpiredSignatureError:
        return None
    except pyjwt.InvalidTokenError:
        return None

# ══════════════════════════════════════
# AUTH API ENDPOINTS
# ══════════════════════════════════════

def token_required(optional=False):
    """Decorator to enforce JWT authentication and extract user_id."""
    def decorator(f):
        @wraps(f)
        def wrapped(*args, **kwargs):
            token = None
            if 'Authorization' in request.headers:
                auth_header = request.headers['Authorization']
                if auth_header.startswith('Bearer '):
                    token = auth_header.split(" ")[1]
            
            if not token:
                if optional:
                    return f(None, *args, **kwargs)
                return jsonify({'error': 'Authentication token is missing'}), 401

            decoded = decode_token(token)
            if not decoded:
                if optional:
                    return f(None, *args, **kwargs)
                return jsonify({'error': 'Invalid or expired token'}), 401
                
            return f(decoded, *args, **kwargs)
        return wrapped
    return decorator

@app.route('/api/auth/signup', methods=['POST'])
@rate_limit(max_requests=5, window_seconds=300)  # 5 signups per 5 minutes per IP
def auth_signup():
    data = request.get_json()
    name = data.get('name', '').strip()
    email = data.get('email', '').strip().lower()
    password = data.get('password', '')

    if not name or not email or not password:
        return jsonify({'error': 'Name, email, and password are required'}), 400
    if len(password) < 6:
        return jsonify({'error': 'Password must be at least 6 characters'}), 400

    try:
        pw_hash = bcrypt.hashpw(password.encode('utf-8'), bcrypt.gensalt()).decode('utf-8')
        conn = sqlite3.connect(str(SCAN_DB_PATH))
        c = conn.cursor()
        c.execute(
            'INSERT INTO users (name, email, password_hash, is_admin, created_at) VALUES (?, ?, ?, ?, ?)',
            (name, email, pw_hash, 0, datetime.now().isoformat())
        )
        conn.commit()
        user_id = c.lastrowid
        conn.close()

        token = generate_token(user_id, email)
        return jsonify({
            'token': token,
            'user': {'id': user_id, 'name': name, 'email': email, 'is_admin': False}
        })
    except sqlite3.IntegrityError:
        return jsonify({'error': 'An account with this email already exists'}), 409
    except Exception as e:
        return jsonify({'error': str(e)}), 500


@app.route('/api/auth/login', methods=['POST'])
@rate_limit(max_requests=10, window_seconds=300) # 10 login attempts per 5 minutes
def auth_login():
    data = request.get_json()
    email = data.get('email', '').strip().lower()
    password = data.get('password', '')

    if not email or not password:
        return jsonify({'error': 'Email and password are required'}), 400

    conn = sqlite3.connect(str(SCAN_DB_PATH))
    conn.row_factory = sqlite3.Row
    c = conn.cursor()
    c.execute('SELECT * FROM users WHERE email = ?', (email,))
    user = c.fetchone()
    conn.close()

    if not user:
        return jsonify({'error': 'Invalid email or password'}), 401

    if not bcrypt.checkpw(password.encode('utf-8'), user['password_hash'].encode('utf-8')):
        return jsonify({'error': 'Invalid email or password'}), 401

    token = generate_token(user['id'], user['email'], bool(user['is_admin']))
    return jsonify({
        'token': token,
        'user': {
            'id': user['id'],
            'name': user['name'],
            'email': user['email'],
            'is_admin': bool(user['is_admin'])
        }
    })


@app.route('/api/auth/me', methods=['GET'])
def auth_me():
    auth_header = request.headers.get('Authorization', '')
    if not auth_header.startswith('Bearer '):
        return jsonify({'error': 'No token provided'}), 401

    token = auth_header[7:]
    payload = decode_token(token)
    if not payload:
        return jsonify({'error': 'Invalid or expired token'}), 401

    conn = sqlite3.connect(str(SCAN_DB_PATH))
    conn.row_factory = sqlite3.Row
    c = conn.cursor()
    c.execute('SELECT id, name, email, is_admin FROM users WHERE id = ?', (payload['user_id'],))
    user = c.fetchone()
    conn.close()

    if not user:
        return jsonify({'error': 'User not found'}), 404

    return jsonify({
        'user': {
            'id': user['id'],
            'name': user['name'],
            'email': user['email'],
            'is_admin': bool(user['is_admin'])
        }
    })


@app.route('/api/auth/admin/login', methods=['POST'])
@rate_limit(max_requests=5, window_seconds=300) # 5 admin login attempts per 5 minutes
def auth_admin_login():
    data = request.get_json()
    email = data.get('email', '').strip().lower()
    password = data.get('password', '')

    if not email or not password:
        return jsonify({'error': 'Email and password are required'}), 400

    conn = sqlite3.connect(str(SCAN_DB_PATH))
    conn.row_factory = sqlite3.Row
    c = conn.cursor()
    c.execute('SELECT * FROM users WHERE email = ? AND is_admin = 1', (email,))
    user = c.fetchone()
    conn.close()

    if not user:
        return jsonify({'error': 'Invalid admin credentials'}), 401

    if not bcrypt.checkpw(password.encode('utf-8'), user['password_hash'].encode('utf-8')):
        return jsonify({'error': 'Invalid admin credentials'}), 401

    token = generate_token(user['id'], user['email'], is_admin=True)
    return jsonify({
        'token': token,
        'user': {
            'id': user['id'],
            'name': user['name'],
            'email': user['email'],
            'is_admin': True
        }
    })

def save_scan_result(user_id, language, risk_level, confidence, malicious, code, nodes_scanned, reason):
    """Save a scan result to the history database."""
    try:
        code_hash = hashlib.sha256(code.encode()).hexdigest()[:16]
        conn = sqlite3.connect(str(SCAN_DB_PATH))
        c = conn.cursor()
        c.execute(
            'INSERT INTO scans (user_id, timestamp, language, risk_level, confidence, malicious, code_hash, nodes_scanned, reason) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)',
            (user_id, datetime.now().isoformat(), language, risk_level, confidence, 1 if malicious else 0, code_hash, nodes_scanned, reason)
        )
        conn.commit()
        conn.close()
    except Exception as e:
        print(f"Failed to save scan result: {e}")

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
            if not isinstance(counts, dict):
                counts = {}
            df = pd.DataFrame([counts])
            
            # Align with model features (fill missing with 0)
            if modelFeatures is not None:
                df_aligned = df.reindex(columns=modelFeatures, fill_value=0)
            else:
                df_aligned = df
            
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
        if modelFeatures is not None:
            df_aligned = df.reindex(columns=modelFeatures, fill_value=0)
        else:
            df_aligned = df

        return df_aligned, 'python'
    
    except SyntaxError:
        return "SYNTAX_ERROR", detected_language
    
    except Exception as e:
        print(f"Error processing code: {e}")
        return None, detected_language
    
def strip_comments(code_str):
    """
    Remove comments and multi-line strings from code before keyword scanning.
    Prevents AI explanations (e.g., // Removed exec()) from triggering false positives.
    """
    # Remove single-line comments (Python # and JS/Java //)
    code_str = re.sub(r'//.*', '', code_str)
    code_str = re.sub(r'#.*', '', code_str)
    # Remove block comments (JS/Java /* */)
    code_str = re.sub(r'/\*.*?\*/', '', code_str, flags=re.DOTALL)
    # Remove Python multi-line strings (often used as comments)
    code_str = re.sub(r'\"\"\"(.*?)\"\"\"', '', code_str, flags=re.DOTALL)
    code_str = re.sub(r"\'\'\'(.*?)\'\'\'", '', code_str, flags=re.DOTALL)
    return code_str


@app.route('/analyze', methods=['POST'])
@rate_limit(max_requests=20, window_seconds=60)
@token_required(optional=True)
def analyze(current_user):
    data = request.get_json()
    codeInput = data.get('code', '')

    if not isinstance(codeInput, str):
        codeInput = str(codeInput)

    if len(codeInput) > 50000:
        return jsonify({
            'status':'error',
            'message': 'Code exceeds maximum character limit (50k).'
        }), 400

    if not codeInput:
        return jsonify({'status': 'error', 'message': 'No code provided'}), 400
    
    # Strip comments to prevent AI explanations from triggering false positives
    clean_code = strip_comments(codeInput)

    # 1. KEYWORD SAFETY NET (on uncommented code)
    triggerKeywords = [k for k in BUZZ_WORDS if k in clean_code]

    # 2. TRANSFORM CODE INTO NUMBERS (Original code is passed to AST parser)
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

    # 4. INITIALIZE DEFAULTS 
    maliciousProb = 0.1
    confidence = 50.0

    # Determine highest keyword severity FIRST before AI prediction
    highest_keyword_severity = "LOW"
    critical_or_high_keyword = None
    
    if triggerKeywords:
        severity_ranks = {"LOW": 1, "MEDIUM": 2, "HIGH": 3, "CRITICAL": 4}
        for kw in triggerKeywords:
            sev = SEVERITY_LOOKUP.get(kw, "MEDIUM")
            if severity_ranks.get(sev, 0) > severity_ranks.get(highest_keyword_severity, 0):
                highest_keyword_severity = sev
                if sev in ["CRITICAL", "HIGH"]:
                    critical_or_high_keyword = kw

    # If we found a critical keyword, bump base probability before ML
    if critical_or_high_keyword:
        maliciousProb = 0.85 

    # 5. AI VERDICT
    try:
        if model is not None and hasattr(model, 'predict_proba'):
            probability = model.predict_proba(featuresDf)[0]
            # ONLY override if ML actually thinks it's strictly worse, or if no critical keywords exist
            if probability[1] > maliciousProb:
                maliciousProb = probability[1]
                confidence = round(max(probability) * 100, 1)
    except Exception as e:
        # Model may not support new language features - use keyword detection only
        print(f"Model prediction failed: {e}")

    # 6. RISK HIERARCHY LOGIC
    code_line_count = len([l for l in codeInput.splitlines() if l.strip()])

    # Priority 1: CRITICAL or HIGH Keyword Match (always wins)
    if critical_or_high_keyword:
        verdict = True
        riskLabel = highest_keyword_severity
        detail = BUZZ_WORDS.get(critical_or_high_keyword, "Suspicious pattern detected")
        message = f"Immediate threat: {detail}"
        
    # Priority 2: Very High AI Confidence on complex code (ML-only verdict)
    # Require 0.97+ threshold AND at least 5 meaningful lines to prevent false positives on trivial code
    elif maliciousProb > 0.97 and code_line_count >= 5 and not critical_or_high_keyword:
        verdict = True
        riskLabel = "HIGH"
        message = f"AI detected complex threat pattern: {round(maliciousProb * 100)}% confidence"
        
    # Priority 3: Medium Risk / Suspicious
    elif maliciousProb > 0.60 or highest_keyword_severity == "MEDIUM":
        verdict = False
        riskLabel = "MEDIUM"
        message = "Suspicious patterns noted, but insufficient evidence for threat classification"
        
    # Priority 4: Safe (LOW or no keywords, low ML risk)
    else:
        verdict = False
        riskLabel = "LOW"
        message = "Code structure follows standard safety profiles"

    result = {
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
    }

    # LINE-LEVEL VULNERABILITY DETECTION
    vulnerabilities = []
    code_lines = codeInput.split('\n')
    for line_num, line_text in enumerate(code_lines, 1):
        for pattern in BUZZ_WORDS:
            if pattern in line_text:
                severity = SEVERITY_LOOKUP.get(pattern, 'MEDIUM')
                cwe = CWE_LOOKUP.get(pattern, '')
                vulnerabilities.append({
                    'line': line_num,
                    'pattern': pattern,
                    'severity': severity,
                    'description': BUZZ_WORDS[pattern],
                    'cwe': cwe,
                    'snippet': line_text.strip()[:100]
                })
    
    if vulnerabilities:
        result['vulnerabilities'] = vulnerabilities

    # Auto-save to scan history if logged in
    user_id = current_user['user_id'] if current_user else None
    
    save_scan_result(
        user_id=user_id,
        language=detected_language,
        risk_level=riskLabel,
        confidence=confidence,
        malicious=verdict,
        code=codeInput,
        nodes_scanned=len(featuresDf.columns),
        reason=message
    )

    return jsonify(result)


@app.route('/generate-report', methods=['POST']) 
def generateReport():
    data = request.get_json()
    snippet = data.get('code', '')
    verdict = data.get('verdict', 'UNKNOWN')
    confidence = data.get('confidence', 0)
    risk_level = data.get('risk_level', verdict)
    reason = data.get('reason', '')
    language = data.get('language', 'Unknown')
    deep_scan = data.get('deep_scan', '')
    nodes_scanned = data.get('nodes_scanned', 0)

    pdf = FPDF()
    pdf.set_auto_page_break(auto=True, margin=25)
    pdf.add_page()

    # ═══════════════════════════════════
    # HEADER — Professional branding
    # ═══════════════════════════════════
    # Navy header bar
    pdf.set_fill_color(2, 6, 23)  # Very dark navy
    pdf.rect(0, 0, 210, 40, 'F')
    
    logo_path = os.path.join(os.path.dirname(__file__), '../frontend/public/soteria-logo.png')
    if os.path.exists(logo_path):
        # fpdf2 allows adding an image with alpha channel for PNG
        pdf.image(logo_path, x=15, y=7, w=25)
    
    pdf.set_font("Helvetica", "B", 22)
    pdf.set_text_color(255, 255, 255)
    pdf.set_y(10)
    pdf.cell(0, 10, "SOTERIA SECURITY REPORT", new_x=XPos.LMARGIN, new_y=YPos.NEXT, align="C")
    
    pdf.set_font("Helvetica", size=9)
    pdf.set_text_color(148, 163, 184)  # Slate-400
    pdf.cell(0, 6, f"Soteria AI Security Engine  |  {datetime.now().strftime('%B %d, %Y at %H:%M')}", 
             new_x=XPos.LMARGIN, new_y=YPos.NEXT, align="C")
    
    pdf.ln(15)

    # ═══════════════════════════════════
    # EXECUTIVE SUMMARY
    # ═══════════════════════════════════
    pdf.set_font("Helvetica", "B", 14)
    pdf.set_text_color(30, 41, 59)  # Slate-800
    pdf.cell(0, 10, "1. Executive Summary", new_x=XPos.LMARGIN, new_y=YPos.NEXT)
    pdf.ln(2)
    
    # Risk level badge
    risk_colors = {
        'CRITICAL': (239, 68, 68),    # Red
        'HIGH': (249, 115, 22),        # Orange
        'MEDIUM': (245, 158, 11),      # Amber
        'LOW': (34, 197, 94),          # Green
    }
    badge_color = risk_colors.get(risk_level, (100, 116, 139))
    
    pdf.set_fill_color(*badge_color)
    pdf.set_font("Helvetica", "B", 11)
    pdf.set_text_color(255, 255, 255)
    badge_text = f"  {risk_level} RISK  "
    badge_width = pdf.get_string_width(badge_text) + 8
    pdf.cell(badge_width, 8, badge_text, new_x=XPos.RIGHT, new_y=YPos.TOP, fill=True)
    
    pdf.set_font("Helvetica", size=11)
    pdf.set_text_color(71, 85, 105)  # Slate-600
    pdf.cell(0, 8, f"   Confidence: {confidence}%  |  Language: {language.upper()}", new_x=XPos.LMARGIN, new_y=YPos.NEXT)
    pdf.ln(4)
    
    # Summary box
    pdf.set_fill_color(248, 250, 252)  # Slate-50
    pdf.set_draw_color(226, 232, 240)  # Slate-200
    pdf.set_font("Helvetica", size=10)
    pdf.set_text_color(51, 65, 85)    # Slate-700
    pdf.multi_cell(0, 6, f"Analysis: {reason}", fill=True, border=1)
    pdf.ln(4)
    
    # Stats row
    pdf.set_font("Helvetica", size=9)
    pdf.set_text_color(100, 116, 139)
    pdf.cell(60, 6, f"Nodes Scanned: {nodes_scanned}", new_x=XPos.RIGHT, new_y=YPos.TOP)
    pdf.cell(60, 6, f"Engine: Soteria v2.4", new_x=XPos.RIGHT, new_y=YPos.TOP)
    pdf.cell(0, 6, f"Classification: {'THREAT' if risk_level in ['CRITICAL', 'HIGH'] else 'SAFE'}", new_x=XPos.LMARGIN, new_y=YPos.NEXT)
    pdf.ln(8)

    # ═══════════════════════════════════
    # CODE ANALYSIS
    # ═══════════════════════════════════
    pdf.set_font("Helvetica", "B", 14)
    pdf.set_text_color(30, 41, 59)
    pdf.cell(0, 10, "2. Code Under Review", new_x=XPos.LMARGIN, new_y=YPos.NEXT)
    pdf.ln(2)
    
    # Code block with dark background
    pdf.set_fill_color(15, 23, 42)  # Slate-900
    pdf.set_text_color(226, 232, 240)  # Slate-200
    pdf.set_font("Courier", size=8)
    
    code_display = snippet[:3000]
    if len(snippet) > 3000:
        code_display += "\n\n... [truncated — full code available in application]"
    
    # Add line numbers
    lines = code_display.split('\n')
    numbered = '\n'.join(f"{i+1:4d} | {line}" for i, line in enumerate(lines[:60]))
    
    pdf.multi_cell(0, 4, numbered, fill=True)
    pdf.ln(6)

    # ═══════════════════════════════════
    # AI DEEP SCAN ANALYSIS (if available)
    # ═══════════════════════════════════
    if deep_scan:
        pdf.set_font("Helvetica", "B", 14)
        pdf.set_text_color(30, 41, 59)
        pdf.cell(0, 10, "3. AI-Powered Deep Analysis", new_x=XPos.LMARGIN, new_y=YPos.NEXT)
        pdf.ln(2)
        
        pdf.set_font("Helvetica", size=9)
        pdf.set_text_color(51, 65, 85)
        
        # Clean up markdown formatting for PDF
        clean_analysis = deep_scan.replace('## ', '\n').replace('### ', '\n').replace('**', '').replace('```', '\n---\n')
        pdf.multi_cell(0, 5, clean_analysis[:5000])
        pdf.ln(6)

    # ═══════════════════════════════════
    # RECOMMENDATIONS
    # ═══════════════════════════════════
    section_num = 4 if deep_scan else 3
    pdf.set_font("Helvetica", "B", 14)
    pdf.set_text_color(30, 41, 59)
    pdf.cell(0, 10, f"{section_num}. Recommendations", new_x=XPos.LMARGIN, new_y=YPos.NEXT)
    pdf.ln(2)
    
    pdf.set_font("Helvetica", size=10)
    pdf.set_text_color(51, 65, 85)
    
    if risk_level in ['CRITICAL', 'HIGH']:
        recommendations = [
            "IMMEDIATE: Do not deploy this code to production",
            "Review all flagged vulnerability patterns",
            "Apply the suggested fixes from the AI deep scan",
            "Re-scan after applying fixes to verify resolution",
            "Consider a manual security review by a senior developer"
        ]
    elif risk_level == 'MEDIUM':
        recommendations = [
            "Review flagged patterns before deploying",
            "Consider using the AI deep scan for detailed analysis",
            "Apply input validation and output escaping",
            "Re-scan after modifications"
        ]
    else:
        recommendations = [
            "Code passes automated security checks",
            "Continue following secure coding best practices",
            "Consider periodic re-scans as dependencies update",
            "Use the Code Reviewer for new code additions"
        ]
    
    for i, rec in enumerate(recommendations, 1):
        pdf.set_font("Helvetica", "B", 10)
        pdf.cell(8, 6, f"{i}.", new_x=XPos.RIGHT, new_y=YPos.TOP)
        pdf.set_font("Helvetica", size=10)
        pdf.cell(0, 6, f" {rec}", new_x=XPos.LMARGIN, new_y=YPos.NEXT)
    
    pdf.ln(10)

    # ═══════════════════════════════════
    # FOOTER
    # ═══════════════════════════════════
    pdf.set_draw_color(226, 232, 240)
    pdf.line(10, pdf.get_y(), 200, pdf.get_y())
    pdf.ln(4)
    pdf.set_font("Helvetica", "I", 8)
    pdf.set_text_color(148, 163, 184)
    pdf.cell(0, 5, "This report was generated automatically by the Soteria AI Security Engine.", new_x=XPos.LMARGIN, new_y=YPos.NEXT, align="C")
    pdf.cell(0, 5, "Results are based on ML analysis and should be supplemented with manual review for critical systems.", new_x=XPos.LMARGIN, new_y=YPos.NEXT, align="C")

    pdf_output = pdf.output() 

    return send_file(
        BytesIO(pdf_output),
        mimetype='application/pdf',
        as_attachment=True,
        download_name=f"Soteria_Security_Report_{datetime.now().strftime('%Y%m%d_%H%M')}.pdf"
    )

@app.route('/scan-history', methods=['GET'])
def scan_history():
    """Return scan history with optional filtering."""
    limit = request.args.get('limit', 50, type=int)
    offset = request.args.get('offset', 0, type=int)
    
    try:
        conn = sqlite3.connect(str(SCAN_DB_PATH))
        conn.row_factory = sqlite3.Row
        c = conn.cursor()
        
        # Get total count
        c.execute('SELECT COUNT(*) FROM scans')
        total = c.fetchone()[0]
        
        # Get paginated results
        c.execute('SELECT * FROM scans ORDER BY timestamp DESC LIMIT ? OFFSET ?', (limit, offset))
        rows = [dict(row) for row in c.fetchall()]
        conn.close()
        
        return jsonify({
            'scans': rows,
            'total': total,
            'limit': limit,
            'offset': offset
        })
    except Exception as e:
        return jsonify({'error': str(e)}), 500


@app.route('/security-score', methods=['GET'])
@token_required(optional=False)
def security_score(current_user):
    """Calculate aggregate security score and analytics from scan history for specific user."""
    try:
        user_id = current_user['user_id']
        conn = sqlite3.connect(str(SCAN_DB_PATH))
        conn.row_factory = sqlite3.Row
        c = conn.cursor()
        
        # Total stats
        c.execute('SELECT COUNT(*) as total FROM scans WHERE user_id = ?', (user_id,))
        total = c.fetchone()['total']
        
        if total == 0:
            return jsonify({
                'score': 100,
                'grade': 'A',
                'total_scans': 0,
                'threats': 0,
                'clean': 0,
                'languages': {},
                'risk_distribution': {},
                'daily_trend': [],
                'recent_scans': []
            })
        
        c.execute('SELECT COUNT(*) as threats FROM scans WHERE malicious = 1 AND user_id = ?', (user_id,))
        threats = c.fetchone()['threats']
        clean = total - threats
        
        # Language breakdown
        c.execute('SELECT language, COUNT(*) as count FROM scans WHERE user_id = ? GROUP BY language ORDER BY count DESC', (user_id,))
        languages = {row['language']: row['count'] for row in c.fetchall()}
        
        # Risk distribution
        c.execute('SELECT risk_level, COUNT(*) as count FROM scans WHERE user_id = ? GROUP BY risk_level', (user_id,))
        risk_dist = {row['risk_level']: row['count'] for row in c.fetchall()}
        
        # Daily trend (last 30 days)
        c.execute('''
            SELECT DATE(timestamp) as day, 
                   COUNT(*) as total,
                   SUM(CASE WHEN malicious = 1 THEN 1 ELSE 0 END) as threats,
                   AVG(confidence) as avg_confidence
            FROM scans 
            WHERE timestamp >= datetime('now', '-30 days') AND user_id = ?
            GROUP BY DATE(timestamp) 
            ORDER BY day ASC
        ''', (user_id,))
        daily_trend = [dict(row) for row in c.fetchall()]
        
        # Recent scans (last 10)
        c.execute('SELECT * FROM scans WHERE user_id = ? ORDER BY timestamp DESC LIMIT 10', (user_id,))
        recent = [dict(row) for row in c.fetchall()]
        
        conn.close()
        
        # Calculate security score (0-100)
        # Score decreases with more threats, weighted by severity
        threat_ratio = threats / total if total > 0 else 0
        critical_count = risk_dist.get('CRITICAL', 0)
        high_count = risk_dist.get('HIGH', 0)
        
        # Weighted penalty: CRITICAL = 3pts, HIGH = 2pts, MEDIUM = 1pt per scan
        penalty = (critical_count * 3 + high_count * 2 + risk_dist.get('MEDIUM', 0) * 1) / max(total, 1)
        score = max(0, round(100 - (penalty * 20) - (threat_ratio * 30)))
        
        # Letter grade
        if score >= 90: grade = 'A'
        elif score >= 80: grade = 'B'
        elif score >= 70: grade = 'C'
        elif score >= 60: grade = 'D'
        else: grade = 'F'
        
        return jsonify({
            'score': score,
            'grade': grade,
            'total_scans': total,
            'threats': threats,
            'clean': clean,
            'languages': languages,
            'risk_distribution': risk_dist,
            'daily_trend': daily_trend,
            'recent_scans': recent
        })
    except Exception as e:
        return jsonify({'error': str(e)}), 500


@app.route('/model-stats', methods=['GET'])
def model_stats():
    """Return real model stats from the actual model file on disk."""
    stats = {
        'status': 'no_model',
        'accuracy': 'N/A',
        'last_trained': 'N/A',
        'model_type': 'Unknown',
        'file_size': 'N/A',
        'features_count': 0
    }

    if MODELPATH.exists():
        stats['status'] = 'ready'
        # File metadata
        file_stat = MODELPATH.stat()
        size_kb = file_stat.st_size / 1024
        stats['file_size'] = f"{size_kb:.0f} KB" if size_kb < 1024 else f"{size_kb/1024:.1f} MB"
        stats['last_trained'] = datetime.fromtimestamp(file_stat.st_mtime).strftime('%Y-%m-%d %H:%M')

        if model is not None:
            stats['model_type'] = type(model).__name__
            if hasattr(model, 'feature_names_in_'):
                stats['features_count'] = len(model.feature_names_in_)
            # Try to get accuracy from model if available
            if hasattr(model, 'score'):
                stats['accuracy'] = 'Available'
            if hasattr(model, 'best_score_'):
                stats['accuracy'] = f"{model.best_score_ * 100:.1f}%"
            elif hasattr(model, 'oob_score_'):
                stats['accuracy'] = f"{model.oob_score_ * 100:.1f}%"
            else:
                stats['accuracy'] = 'Trained'
    else:
        stats['status'] = 'no_model'

    return jsonify(stats)


@app.route('/train-stream', methods=['POST'])
def train_stream():
    """Run training pipeline and stream output via SSE."""
    def generate():
        pipeline_path = str(ROOT / 'backend' / 'train_full_pipeline.py')
        try:
            proc = subprocess.Popen(
                [sys.executable, pipeline_path],
                stdout=subprocess.PIPE,
                stderr=subprocess.STDOUT,
                text=True,
                bufsize=1,
                cwd=str(ROOT / 'backend')
            )
            for line in proc.stdout:
                line = line.rstrip('\n')
                # Sanitize: strip absolute paths and noisy warnings
                line = re.sub(r'/[\w/.-]*/ACID/', './', line)
                line = re.sub(r'/[\w/.-]*/site-packages/[\w/.-]+\.py:\d+:', '[sklearn]:', line)
                if '/Library/Frameworks/' in line or '/usr/local/lib/' in line:
                    continue  # Skip full traceback lines from system libraries
                yield f"data: {line}\n\n"
            proc.wait()
            if proc.returncode == 0:
                yield f"data: [DONE] Training completed successfully!\n\n"
                # Reload the model after training
                load_model_if_updated()
            else:
                yield f"data: [ERROR] Training failed with exit code {proc.returncode}\n\n"
        except Exception as e:
            yield f"data: [ERROR] {str(e)}\n\n"
        yield "data: [STREAM_END]\n\n"

    response = app.response_class(generate(), mimetype='text/event-stream')
    response.headers['Cache-Control'] = 'no-cache'
    response.headers['X-Accel-Buffering'] = 'no'
    return response


@app.route('/deep-scan', methods=['POST'])
def deep_scan():
    """LLM-powered deep scan that explains vulnerabilities and suggests fixes."""
    import requests as req
    import json as json_mod

    data = request.get_json()
    code = data.get('code', '')
    scan_result = data.get('scan_result', {})

    if not code:
        return jsonify({'error': 'No code provided'}), 400

    if not isinstance(code, str):
        code = str(code)

    if len(code) > 50000:
        return jsonify({'error': 'Code too large for deep scan (50k limit)'}), 400

    risk_level = scan_result.get('risk_level', 'UNKNOWN') if isinstance(scan_result, dict) else 'UNKNOWN'
    reason = scan_result.get('reason', 'No initial analysis available') if isinstance(scan_result, dict) else 'Unknown'
    language = scan_result.get('language', 'unknown') if isinstance(scan_result, dict) else 'unknown'

    system_prompt = """You are Soteria, an expert security code auditor. You analyze code for vulnerabilities and provide fixes.

RULES:
1. Be concise but thorough
2. Explain vulnerabilities in plain English that a student would understand
3. Always provide a complete fixed version of the code
4. Use this EXACT format:

## Vulnerabilities Found

[List each vulnerability with a brief explanation of WHY it's dangerous and what an attacker could do with it]

## Fixed Code

```
[The complete corrected code with all vulnerabilities patched]
```

## What Changed

[Brief bullet points explaining each fix]"""

    user_prompt = f"""Analyze this {language} code. The initial scan flagged it as {risk_level} risk.
Initial analysis: {reason}

Code to analyze:
```
{code}
```

Provide your security analysis with vulnerability explanations and a fixed version."""

    def generate():
        try:
            # Stream from Gemini API
            api_key = os.environ.get('GEMINI_API_KEY')
            if not api_key:
                yield f'data: {{"type": "error", "content": "Gemini API key not configured on server."}}\n\n'
                yield "data: [STREAM_END]\n\n"
                return
            
            url = f"https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-pro:streamGenerateContent?key={api_key}&alt=sse"
            resp = req.post(url, headers={
                "Content-Type": "application/json"
            }, json={
                "systemInstruction": {"parts": [{"text": system_prompt}]},
                "contents": [{"role": "user", "parts": [{"text": user_prompt}]}],
                "generationConfig": {"temperature": 0.2}
            }, stream=True, timeout=15)

            if resp.status_code != 200:
                err_content = resp.text.replace('\n', ' ').replace('"', "'")
                yield f"data: {{\"type\": \"error\", \"content\": \"AI API error: {resp.status_code} {err_content}\"}}\n\n"
                yield "data: [STREAM_END]\n\n"
                return

            for line in resp.iter_lines():
                if line:
                    line_str = line.decode('utf-8')
                    if line_str.startswith('data: '):
                        data_str = line_str[6:]
                        if not data_str.strip():
                            continue
                        try:
                            chunk = json_mod.loads(data_str)
                            if 'candidates' in chunk and len(chunk['candidates']) > 0:
                                candidate = chunk['candidates'][0]
                                if 'content' in candidate and 'parts' in candidate['content']:
                                    parts = candidate['content']['parts']
                                    if len(parts) > 0 and 'text' in parts[0]:
                                        token = parts[0]['text']
                                        if token:
                                            safe_token = json_mod.dumps(token)[1:-1]
                                            yield f"data: {{\"type\": \"token\", \"content\": \"{safe_token}\"}}\n\n"
                        except Exception:
                            continue

        except req.exceptions.ConnectionError:
            yield f'data: {{"type": "error", "content": "Gemini API is temporarily unavailable. The standard security analysis above still applies."}}\n\n'
        except req.exceptions.Timeout:
            yield f'data: {{"type": "error", "content": "AI analysis timed out. Please try again in a moment."}}\n\n'
        except Exception as e:
            yield f'data: {{"type": "error", "content": "AI analysis encountered an error. The standard scan results above are still valid."}}\n\n'

        yield "data: [STREAM_END]\n\n"

    response = app.response_class(generate(), mimetype='text/event-stream')
    response.headers['Cache-Control'] = 'no-cache'
    response.headers['X-Accel-Buffering'] = 'no'
    return response


@app.route('/batch-scan', methods=['POST'])
@rate_limit(max_requests=10, window_seconds=60)  # slightly stricter for batch scans
def batch_scan():
    """Scan multiple files at once."""
    data = request.get_json()
    files = data.get('files', [])
    
    result = process_files_batch(files)
    if isinstance(result, tuple):
        return jsonify(result[0]), result[1]
    return jsonify(result), 200

@app.route('/automation/run-improver', methods=['POST'])
@rate_limit(max_requests=6, window_seconds=60)
def run_improver():
    """
    Secure webhook endpoint for Make to enqueue improvement tasks.
    Cursor reads and executes the queue — no LLM calls here.
    Guardrails: shared-secret auth, idempotency, structured response.
    """
    configured_secret = os.environ.get('MAKE_WEBHOOK_SECRET')
    provided_secret = request.headers.get('X-Automation-Secret', '')
    if not configured_secret:
        return jsonify({
            'status': 'error',
            'error_code': 'automation_secret_not_configured',
            'message': 'MAKE_WEBHOOK_SECRET is not configured on the server.'
        }), 503

    if not provided_secret or not hmac.compare_digest(provided_secret, configured_secret):
        return jsonify({
            'status': 'error',
            'error_code': 'unauthorized',
            'message': 'Invalid automation secret.'
        }), 401

    idempotency_key = (request.headers.get('Idempotency-Key') or '').strip()
    if not idempotency_key:
        return jsonify({
            'status': 'error',
            'error_code': 'missing_idempotency_key',
            'message': 'Idempotency-Key header is required.'
        }), 400

    payload = request.get_json(silent=True)
    if not isinstance(payload, dict):
        return jsonify({
            'status': 'error',
            'error_code': 'invalid_json',
            'message': 'Request body must be valid JSON object.'
        }), 400

    mode = payload.get('mode')
    if mode != 'draft_only':
        return jsonify({
            'status': 'error',
            'error_code': 'invalid_mode',
            'message': "Only mode='draft_only' is allowed."
        }), 400

    now_ts = time.time()
    with AUTOMATION_LOCK:
        _cleanup_automation_runs(now_ts)
        existing = AUTOMATION_RUNS.get(idempotency_key)
        if existing:
            cached = dict(existing.get('response', {}))
            cached['duplicate'] = True
            cached['idempotency_key'] = idempotency_key
            return jsonify(cached), 200

    try:
        sys.path.insert(0, str(ROOT))
        from auto_improver import add_task, queue_summary

        task = add_task(
            task_type=payload.get('task_type', 'incremental_improvement'),
            scope=payload.get('scope'),
            quality_gates=payload.get('quality_gates'),
            metadata=payload.get('metadata'),
            instruction=_extract_instruction(payload)
        )
        summary = queue_summary()

        response_payload = {
            'status': 'success',
            'task_id': task['id'],
            'idempotency_key': idempotency_key,
            'mode': mode,
            'message': 'Task enqueued. Cursor will execute on next check-in.',
            'queue_summary': summary
        }
        http_status = 200
    except ValueError as e:
        response_payload = {
            'status': 'error',
            'error_code': 'queue_full',
            'message': str(e),
            'idempotency_key': idempotency_key
        }
        http_status = 429
    except Exception as e:
        response_payload = {
            'status': 'error',
            'error_code': 'enqueue_failed',
            'message': str(e),
            'idempotency_key': idempotency_key
        }
        http_status = 500

    with AUTOMATION_LOCK:
        AUTOMATION_RUNS[idempotency_key] = {
            'status': 'completed',
            'created_at': now_ts,
            'response': response_payload
        }

    return jsonify(response_payload), http_status


def _require_automation_secret():
    """Shared auth check for automation endpoints. Returns error tuple or None."""
    configured_secret = os.environ.get('MAKE_WEBHOOK_SECRET')
    provided_secret = request.headers.get('X-Automation-Secret', '')
    if not configured_secret:
        return jsonify({
            'status': 'error',
            'error_code': 'automation_secret_not_configured',
            'message': 'MAKE_WEBHOOK_SECRET is not configured on the server.'
        }), 503
    if not provided_secret or not hmac.compare_digest(provided_secret, configured_secret):
        return jsonify({
            'status': 'error',
            'error_code': 'unauthorized',
            'message': 'Invalid automation secret.'
        }), 401
    return None


@app.route('/automation/webhook/render-deploy', methods=['POST'])
@rate_limit(max_requests=10, window_seconds=60)
def render_deploy_webhook():
    """
    Reactive Healing Loop entry point.
    Render POSTs here on deploy failure. Circuit breaker prevents loops.
    """
    auth_error = _require_automation_secret()
    if auth_error:
        return auth_error

    payload = request.get_json(silent=True)
    if not isinstance(payload, dict):
        return jsonify({'status': 'error', 'error_code': 'invalid_json',
                        'message': 'Request body must be valid JSON.'}), 400

    try:
        sys.path.insert(0, str(ROOT))
        from automation_agent import handle_render_failure
        result = handle_render_failure(payload)
        status_code = 200 if result.get('status') != 'circuit_breaker_open' else 429
        return jsonify(result), status_code
    except Exception as e:
        return jsonify({'status': 'error', 'error_code': 'healing_failed',
                        'message': str(e)}), 500


@app.route('/automation/improve', methods=['GET', 'POST'])
@rate_limit(max_requests=6, window_seconds=60)
def proactive_improve():
    """
    Proactive Improvement Loop entry point.
    Triggered by Make cron or manual GET. Reads ROADMAP.md and enqueues
    the next highest-priority task for Cursor.
    """
    auth_error = _require_automation_secret()
    if auth_error:
        return auth_error

    try:
        sys.path.insert(0, str(ROOT))
        from automation_agent import handle_proactive_improvement
        result = handle_proactive_improvement()
        return jsonify(result), 200
    except Exception as e:
        return jsonify({'status': 'error', 'error_code': 'improve_failed',
                        'message': str(e)}), 500


@app.route('/automation/status', methods=['GET'])
@rate_limit(max_requests=20, window_seconds=60)
def automation_status():
    """Diagnostics: queue summary + circuit breaker state."""
    auth_error = _require_automation_secret()
    if auth_error:
        return auth_error

    try:
        sys.path.insert(0, str(ROOT))
        from auto_improver import queue_summary
        from automation_agent import circuit_breaker
        return jsonify({
            'queue': queue_summary(),
            'circuit_breaker': circuit_breaker.status()
        }), 200
    except Exception as e:
        return jsonify({'status': 'error', 'message': str(e)}), 500


import tempfile
import subprocess
import os

def process_files_batch(files):
    if not files:
        return {'error': 'No files provided'}, 400
    
    if len(files) > 50:
        return {'error': 'Maximum 50 files per batch scan'}, 400
    
    results = []
    total_threats = 0
    risk_weights = {'CRITICAL': 4, 'HIGH': 3, 'MEDIUM': 2, 'LOW': 0}
    total_risk_score = 0
    
    for file_item in files:
        if not isinstance(file_item, dict):
            continue
            
        filename = file_item.get('filename', 'unknown')
        code = file_item.get('code', '')
        
        if not isinstance(code, str):
            code = str(code)
            
        if not code or len(code) > 50000:
            results.append({
                'filename': filename,
                'status': 'error',
                'message': 'Empty or too large (50k limit)',
                'risk_level': 'INVALID',
                'confidence': 0,
                'language': 'unknown'
            })
            continue
        
        try:
            # Detect language and extract features
            result = structuralDNAExtraction(code)
            
            if isinstance(result, tuple):
                featuresDf, detected_language = result
            else:
                featuresDf = result
                detected_language = 'python'
            
            if isinstance(featuresDf, str) and featuresDf == "SYNTAX_ERROR":
                results.append({
                    'filename': filename,
                    'status': 'error',
                    'message': f'Syntax error in {detected_language} code',
                    'risk_level': 'INVALID',
                    'confidence': 0,
                    'language': detected_language
                })
                continue
            
            if featuresDf is None:
                results.append({
                    'filename': filename,
                    'status': 'error',
                    'message': 'Analysis failed',
                    'risk_level': 'INVALID',
                    'confidence': 0,
                    'language': detected_language
                })
                continue
            
            load_model_if_updated()
            
            # Keyword check
            triggerKeywords = [k for k in BUZZ_WORDS if k in code]
            
            # ML prediction
            maliciousProb = 0.5 if triggerKeywords else 0.1
            confidence = 50.0

            try:
                if model is not None and hasattr(model, 'predict_proba'):
                    probability = model.predict_proba(featuresDf)[0]
                    maliciousProb = probability[1]
                    confidence = round(max(probability) * 100, 1)
            except Exception as e:
                print(f"Batch model prediction failed: {e}")
            
            # Risk classification
            highest_keyword_severity = "LOW"
            critical_or_high_keyword = None
            if triggerKeywords:
                severity_ranks = {"LOW": 1, "MEDIUM": 2, "HIGH": 3, "CRITICAL": 4}
                for kw in triggerKeywords:
                    sev = SEVERITY_LOOKUP.get(kw, "MEDIUM")
                    if severity_ranks.get(sev, 0) > severity_ranks.get(highest_keyword_severity, 0):
                        highest_keyword_severity = sev
                        critical_or_high_keyword = kw

            if critical_or_high_keyword and highest_keyword_severity in ["CRITICAL", "HIGH"]:
                verdict = True
                riskLabel = highest_keyword_severity
                message = f"Immediate threat: {BUZZ_WORDS.get(critical_or_high_keyword, 'Suspicious pattern')}"
            elif maliciousProb > 0.85:
                verdict = True
                riskLabel = "HIGH"
                message = f"Critical structural anomaly: {round(maliciousProb * 100)}% confidence"
            elif maliciousProb > 0.40 or highest_keyword_severity == "MEDIUM":
                verdict = False
                riskLabel = "MEDIUM"
                message = "Suspicious patterns noted"
            else:
                verdict = False
                riskLabel = "LOW"
                message = "Standard safety profile"
            
            if verdict:
                total_threats += 1
            total_risk_score += risk_weights.get(riskLabel, 0)
            
            results.append({
                'filename': filename,
                'status': 'malicious' if verdict else 'clean',
                'message': message,
                'risk_level': riskLabel,
                'confidence': confidence,
                'language': detected_language,
                'nodes_scanned': len(featuresDf.columns)
            })
            
            # Save to history
            save_scan_result(
                language=detected_language,
                risk_level=riskLabel,
                confidence=confidence,
                malicious=verdict,
                code=code,
                nodes_scanned=len(featuresDf.columns),
                reason=message
            )
            
        except Exception as e:
            results.append({
                'filename': filename,
                'status': 'error',
                'message': str(e),
                'risk_level': 'INVALID',
                'confidence': 0,
                'language': 'unknown'
            })
    
    # Calculate project risk score
    max_possible = len(files) * 4
    project_score = max(0, round(100 - (total_risk_score / max(max_possible, 1)) * 100))
    
    if project_score >= 90: project_grade = 'A'
    elif project_score >= 80: project_grade = 'B'
    elif project_score >= 70: project_grade = 'C'
    elif project_score >= 60: project_grade = 'D'
    else: project_grade = 'F'
    
    return {
        'results': results,
        'summary': {
            'total_files': len(files),
            'threats': total_threats,
            'clean': len(files) - total_threats,
            'project_score': project_score,
            'project_grade': project_grade
        }
    }

import requests

GITHUB_CLIENT_ID = os.environ.get("GITHUB_CLIENT_ID")
GITHUB_CLIENT_SECRET = os.environ.get("GITHUB_CLIENT_SECRET")

if not GITHUB_CLIENT_ID or not GITHUB_CLIENT_SECRET:
    print("⚠️ WARNING: GITHUB_CLIENT_ID or GITHUB_CLIENT_SECRET not set. GitHub OAuth login will be disabled.")

@app.route('/github/token', methods=['POST'])
def github_token():
    if not GITHUB_CLIENT_ID or not GITHUB_CLIENT_SECRET:
        return jsonify({'error': 'GitHub OAuth login is not configured.'}), 501

    data = request.get_json()
    code = data.get('code')
    if not code:
        return jsonify({'error': 'No code provided'}), 400
        
    resp = requests.post(
        'https://github.com/login/oauth/access_token',
        json={
            'client_id': GITHUB_CLIENT_ID,
            'client_secret': GITHUB_CLIENT_SECRET,
            'code': code
        },
        headers={'Accept': 'application/json'}
    )
    return jsonify(resp.json()), resp.status_code

@app.route('/github/repos', methods=['GET'])
def github_repos():
    auth_header = request.headers.get('Authorization')
    if not auth_header:
        return jsonify({'error': 'No token provided'}), 401
        
    resp = requests.get('https://api.github.com/user/repos', headers={
        'Authorization': auth_header,
        'Accept': 'application/vnd.github.v3+json'
    }, params={'sort': 'updated', 'per_page': 100})
    
    return jsonify(resp.json()), resp.status_code


@app.route('/github-scan', methods=['POST'])
def github_scan():
    """Clone a GitHub repository and scan it."""
    data = request.get_json()
    repo_url = data.get('repo_url')
    access_token = data.get('access_token')
    
    if not repo_url or not repo_url.startswith('https://github.com/'):
        return jsonify({'error': 'Invalid or missing GitHub URL'}), 400
        
    clone_url = repo_url
    if access_token:
        # Insert oauth token into URL for authenticated clone
        if repo_url.startswith('https://github.com/'):
            clone_url = f"https://oauth2:{access_token}@" + repo_url[8:]
        
    code_extensions = [
        '.py', '.js', '.ts', '.tsx', '.jsx', '.java', '.c', '.cpp', '.h', '.hpp',
        '.cs', '.go', '.rb', '.php', '.rs', '.swift', '.kt', '.scala', '.sh',
        '.sql', '.html', '.css', '.vue', '.svelte'
    ]
    
    files_data = []
    
    with tempfile.TemporaryDirectory() as temp_dir:
        try:
            # Shallow clone with potentially authenticated URL
            subprocess.run(['git', 'clone', '--depth', '1', clone_url, temp_dir], check=True, capture_output=True)
            
            for root, dirs, files in os.walk(temp_dir):
                if '.git' in dirs:
                    dirs.remove('.git')
                for file in files:
                    ext = os.path.splitext(file)[1].lower()
                    if ext in code_extensions:
                        filepath = os.path.join(root, file)
                        # Size limit 50KB to keep it safe
                        if os.path.getsize(filepath) < 50000:
                            try:
                                with open(filepath, 'r', encoding='utf-8') as f:
                                    content = f.read()
                                rel_path = os.path.relpath(filepath, temp_dir)
                                files_data.append({'filename': rel_path, 'code': content})
                                if len(files_data) >= 50:
                                    break
                            except Exception:
                                pass
                if len(files_data) >= 50:
                    break
        except Exception as e:
            return jsonify({'error': f'Failed to clone repository: {str(e)}'}), 500
            
    result, status = process_files_batch(files_data) if isinstance(process_files_batch(files_data), tuple) else (process_files_batch(files_data), 200)
    return jsonify(result), status


if __name__ == "__main__":
    print("Backend running at port 500")
    app.run(host='0.0.0.0', port=5001)
