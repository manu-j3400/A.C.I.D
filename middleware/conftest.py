"""
Shared pytest fixtures for the Soteria middleware test suite.
"""
import os
import pytest

# Set test credentials before app imports
os.environ['GITHUB_CLIENT_ID'] = 'test-client-id-xxxxxx'
os.environ['GITHUB_CLIENT_SECRET'] = 'test-client-secret-xxxxxx'


@pytest.fixture(autouse=True)
def clear_rate_limits():
    """Reset the in-memory rate limit buckets before every test so tests
    don't exhaust each other's limits."""
    from middleware.app import RATE_LIMITS, RATE_LIMIT_LOCK
    with RATE_LIMIT_LOCK:
        RATE_LIMITS.clear()
    yield
    with RATE_LIMIT_LOCK:
        RATE_LIMITS.clear()
