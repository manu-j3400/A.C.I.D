"""
Simple Flask Backend Example for Cyber Sentinel
This is a reference implementation - run separately on port 5000

Requirements:
pip install flask flask-cors

To run:
python backend-example.py
"""

from flask import Flask, request, jsonify
from flask_cors import CORS

app = Flask(__name__)
CORS(app)

# Simple malware detection patterns
MALICIOUS_PATTERNS = [
    'eval(',
    'exec(',
    '__import__',
    'os.system',
    'subprocess',
    'rm -rf',
    'DROP TABLE',
    'DELETE FROM',
    '<script>alert',
    'document.cookie',
    'base64.b64decode',
    'pickle.loads'
]

@app.route('/analyze', methods=['POST'])
def analyze_code():
    data = request.json
    code = data.get('code', '')
    
    if not code:
        return jsonify({'error': 'No code provided'}), 400
    
    # Simple pattern matching (replace with ML model in production)
    code_lower = code.lower()
    for pattern in MALICIOUS_PATTERNS:
        if pattern.lower() in code_lower:
            return jsonify({
                'malicious': True,
                'reason': f'Suspicious pattern detected: {pattern}',
                'confidence': 0.85
            })
    
    return jsonify({
        'malicious': False,
        'reason': 'No malicious patterns detected',
        'confidence': 0.95
    })

@app.route('/health', methods=['GET'])
def health():
    return jsonify({'status': 'healthy', 'message': 'Cyber Sentinel API running'})

if __name__ == '__main__':
    print("Starting Cyber Sentinel Backend on port 5000...")
    app.run(debug=True, port=5000)
