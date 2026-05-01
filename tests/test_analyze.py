"""
Tests for the code scanning endpoint:
  POST /analyze
"""


BENIGN_CODE = """
def add(a, b):
    return a + b

result = add(1, 2)
print(result)
"""

SUSPICIOUS_CODE = """
import subprocess
import os

def run_cmd(user_input):
    subprocess.call(user_input, shell=True)
    os.system(user_input)
"""


class TestAnalyze:
    def test_benign_returns_200(self, client):
        resp = client.post('/analyze', json={'code': BENIGN_CODE})
        assert resp.status_code == 200
        data = resp.get_json()
        assert 'malicious' in data
        assert 'risk_level' in data
        assert 'confidence' in data

    def test_suspicious_code_scanned(self, client):
        resp = client.post('/analyze', json={'code': SUSPICIOUS_CODE})
        assert resp.status_code == 200
        data = resp.get_json()
        assert 'malicious' in data
        assert data['risk_level'] in ('LOW', 'MEDIUM', 'HIGH', 'CRITICAL')

    def test_missing_code_field(self, client):
        resp = client.post('/analyze', json={})
        assert resp.status_code == 400

    def test_empty_code(self, client):
        resp = client.post('/analyze', json={'code': ''})
        assert resp.status_code == 400

    def test_code_too_long(self, client):
        resp = client.post('/analyze', json={'code': 'x = 1\n' * 10000})
        assert resp.status_code == 400

    def test_non_string_code_rejected(self, client):
        resp = client.post('/analyze', json={'code': 12345})
        assert resp.status_code == 400

    def test_response_has_language_field(self, client):
        resp = client.post('/analyze', json={'code': BENIGN_CODE})
        assert resp.status_code == 200
        data = resp.get_json()
        assert 'language' in data

    def test_with_filename_hint(self, client):
        resp = client.post('/analyze', json={
            'code': BENIGN_CODE,
            'filename': 'main.py',
        })
        assert resp.status_code == 200

    def test_result_cache_hit(self, client):
        """Second identical request should return same result (cached)."""
        payload = {'code': 'print("hello world")'}
        r1 = client.post('/analyze', json=payload)
        r2 = client.post('/analyze', json=payload)
        assert r1.status_code == 200
        assert r2.status_code == 200
        assert r1.get_json()['malicious'] == r2.get_json()['malicious']
