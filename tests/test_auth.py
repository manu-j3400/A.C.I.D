"""
Tests for authentication endpoints:
  POST /api/auth/signup
  POST /api/auth/login
  POST /api/auth/logout
  GET  /api/auth/me
"""
import json
import uuid


def _email():
    """Generate a unique email per test to avoid DB conflicts."""
    return f"test_{uuid.uuid4().hex[:8]}@example.com"


class TestSignup:
    def test_success(self, client):
        resp = client.post('/api/auth/signup', json={
            'name': 'Test User',
            'email': _email(),
            'password': 'securepassword123',
        })
        assert resp.status_code == 201 or resp.status_code == 200
        data = resp.get_json()
        assert 'token' in data
        assert 'user' in data
        assert data['user']['name'] == 'Test User'

    def test_missing_fields(self, client):
        resp = client.post('/api/auth/signup', json={'name': 'No Email'})
        assert resp.status_code == 400
        assert 'error' in resp.get_json()

    def test_short_password(self, client):
        resp = client.post('/api/auth/signup', json={
            'name': 'Short Pass',
            'email': _email(),
            'password': 'abc',
        })
        assert resp.status_code == 400

    def test_duplicate_email(self, client):
        email = _email()
        client.post('/api/auth/signup', json={
            'name': 'First', 'email': email, 'password': 'password123',
        })
        resp = client.post('/api/auth/signup', json={
            'name': 'Second', 'email': email, 'password': 'password456',
        })
        assert resp.status_code == 409


class TestLogin:
    def test_success(self, client):
        email = _email()
        client.post('/api/auth/signup', json={
            'name': 'Login User', 'email': email, 'password': 'loginpass123',
        })
        resp = client.post('/api/auth/login', json={
            'email': email, 'password': 'loginpass123',
        })
        assert resp.status_code == 200
        data = resp.get_json()
        assert 'token' in data

    def test_wrong_password(self, client):
        email = _email()
        client.post('/api/auth/signup', json={
            'name': 'User', 'email': email, 'password': 'correctpass123',
        })
        resp = client.post('/api/auth/login', json={
            'email': email, 'password': 'wrongpassword',
        })
        assert resp.status_code == 401

    def test_unknown_email(self, client):
        resp = client.post('/api/auth/login', json={
            'email': 'nobody@nowhere.invalid', 'password': 'whatever',
        })
        assert resp.status_code == 401

    def test_missing_fields(self, client):
        resp = client.post('/api/auth/login', json={'email': 'a@b.com'})
        assert resp.status_code == 400


class TestAuthMe:
    def _register_and_token(self, client):
        email = _email()
        r = client.post('/api/auth/signup', json={
            'name': 'Me User', 'email': email, 'password': 'mepassword123',
        })
        return r.get_json()['token']

    def test_me_authenticated(self, client):
        token = self._register_and_token(client)
        resp = client.get('/api/auth/me',
                          headers={'Authorization': f'Bearer {token}'})
        assert resp.status_code == 200
        data = resp.get_json()
        assert 'user' in data or 'email' in data or 'id' in data

    def test_me_unauthenticated(self, client):
        resp = client.get('/api/auth/me')
        assert resp.status_code == 401


class TestLogout:
    def test_logout_success(self, client):
        email = _email()
        r = client.post('/api/auth/signup', json={
            'name': 'Logout User', 'email': email, 'password': 'logoutpass123',
        })
        token = r.get_json()['token']
        resp = client.post('/api/auth/logout',
                           headers={'Authorization': f'Bearer {token}'})
        assert resp.status_code == 200

    def test_logout_without_token(self, client):
        resp = client.post('/api/auth/logout')
        assert resp.status_code == 401
