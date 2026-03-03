import os
import sys

import pytest

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0, ROOT)
sys.path.insert(0, os.path.join(ROOT, "backend", "src"))

os.environ.setdefault("MAKE_WEBHOOK_SECRET", "test_secret_for_ci")

from middleware.app import app


@pytest.fixture
def client():
    app.config["TESTING"] = True
    with app.test_client() as c:
        yield c


def test_signup_rejects_invalid_email(client):
    resp = client.post(
        "/api/auth/signup",
        json={"name": "A", "email": "not-an-email", "password": "password123"},
    )
    assert resp.status_code == 400
    assert "valid email" in resp.get_json().get("error", "").lower()


def test_login_rejects_non_json_payload(client):
    resp = client.post("/api/auth/login", data="raw text", content_type="text/plain")
    assert resp.status_code == 400
    assert "json" in resp.get_json().get("error", "").lower()


def test_analyze_rejects_non_json_payload(client):
    resp = client.post("/analyze", data="raw text", content_type="text/plain")
    assert resp.status_code == 400
    assert "json" in resp.get_json().get("error", "").lower()


def test_batch_scan_rejects_non_json_payload(client):
    resp = client.post("/batch-scan", data="raw text", content_type="text/plain")
    assert resp.status_code == 400
    assert "json" in resp.get_json().get("error", "").lower()


def test_github_scan_rejects_non_json_payload(client):
    resp = client.post("/github-scan", data="[]", content_type="application/json")
    assert resp.status_code == 400
    assert "json" in resp.get_json().get("error", "").lower()


def test_github_token_rejects_non_json_payload(client):
    resp = client.post("/github/token", data="raw text", content_type="text/plain")
    # In local test env OAuth may be disabled (501) before body validation runs.
    assert resp.status_code in (400, 501)
    if resp.status_code == 400:
        assert "json" in resp.get_json().get("error", "").lower()

