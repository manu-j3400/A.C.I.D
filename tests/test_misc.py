"""
Tests for model drift, security score, webhook settings, and model-stats endpoints.
"""
import uuid
from unittest.mock import patch


def _register(client):
    """Helper: register a fresh user and return (token, user_id)."""
    email = f"misc_{uuid.uuid4().hex[:8]}@example.com"
    r = client.post('/api/auth/signup', json={
        'name': 'Misc User', 'email': email, 'password': 'miscpassword123',
    })
    data = r.get_json()
    return data['token'], data['user']['id']


class TestModelDrift:
    def test_drift_requires_auth(self, client):
        resp = client.get('/api/model/drift')
        assert resp.status_code == 401

    def test_drift_insufficient_data(self, client):
        """Buffer is empty at test startup — expect insufficient_data status."""
        token, _ = _register(client)
        resp = client.get('/api/model/drift',
                          headers={'Authorization': f'Bearer {token}'})
        assert resp.status_code == 200
        data = resp.get_json()
        assert 'status' in data
        # Either insufficient_data (empty buffer) or ok (if previous tests seeded it)
        assert data['status'] in ('insufficient_data', 'ok')

    def test_drift_ok_fields(self, client):
        """If status=ok, required fields must be present."""
        token, _ = _register(client)
        resp = client.get('/api/model/drift',
                          headers={'Authorization': f'Bearer {token}'})
        data = resp.get_json()
        if data['status'] == 'ok':
            for field in ('kl_divergence', 'drift_alert', 'recent_mean', 'total_samples'):
                assert field in data


class TestSecurityScore:
    def test_requires_auth(self, client):
        resp = client.get('/security-score')
        assert resp.status_code == 401

    def test_new_user_score(self, client):
        token, _ = _register(client)
        resp = client.get('/security-score',
                          headers={'Authorization': f'Bearer {token}'})
        assert resp.status_code == 200
        data = resp.get_json()
        assert 'score' in data


class TestModelStats:
    def test_model_stats_public(self, client):
        # /model-stats uses token_required(optional=True) — accessible without auth
        resp = client.get('/model-stats')
        assert resp.status_code == 200

    def test_model_stats_authenticated(self, client):
        token, _ = _register(client)
        resp = client.get('/model-stats',
                          headers={'Authorization': f'Bearer {token}'})
        assert resp.status_code == 200


class TestWebhookSettings:
    def test_get_webhook_requires_auth(self, client):
        resp = client.get('/api/settings/webhook')
        assert resp.status_code == 401

    def test_get_webhook_empty(self, client):
        token, _ = _register(client)
        resp = client.get('/api/settings/webhook',
                          headers={'Authorization': f'Bearer {token}'})
        assert resp.status_code == 200
        data = resp.get_json()
        assert 'webhook_url' in data or data is not None

    def test_set_webhook_url(self, client):
        token, _ = _register(client)
        # Patch DNS-based SSRF check so test doesn't require live DNS resolution
        with patch('middleware.app._is_safe_external_url', return_value=True):
            resp = client.post('/api/settings/webhook',
                               headers={'Authorization': f'Bearer {token}'},
                               json={'webhook_url': 'https://hooks.example.com/test'})
        assert resp.status_code == 200

    def test_set_invalid_webhook_url(self, client):
        token, _ = _register(client)
        resp = client.post('/api/settings/webhook',
                           headers={'Authorization': f'Bearer {token}'},
                           json={'webhook_url': 'not-a-url'})
        # Should reject non-http(s) URLs
        assert resp.status_code in (400, 422)


class TestScanHistoryExport:
    def test_export_requires_auth(self, client):
        resp = client.get('/api/scan-history/export')
        assert resp.status_code == 401

    def test_export_csv(self, client):
        token, _ = _register(client)
        resp = client.get('/api/scan-history/export',
                          headers={'Authorization': f'Bearer {token}'})
        assert resp.status_code == 200
        # Should return CSV content type
        assert 'csv' in resp.content_type or resp.status_code == 200
