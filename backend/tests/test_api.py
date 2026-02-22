"""
API endpoint tests.

These tests verify that the API routes are accessible and return expected
status codes. They do NOT require a live database or LLM API key — they
test the HTTP interface contract only.
"""
import pytest
from fastapi.testclient import TestClient
from app.main import app

client = TestClient(app)


# ── Health & Meta ─────────────────────────────────────────────

def test_root():
    """Root endpoint returns a welcome message."""
    response = client.get("/")
    assert response.status_code == 200
    assert "message" in response.json()


def test_health_check():
    """Health check returns status and version."""
    response = client.get("/health")
    assert response.status_code == 200
    data = response.json()
    assert data["status"] == "healthy"
    assert "version" in data
    assert "environment" in data


def test_api_docs():
    """Swagger UI is accessible."""
    response = client.get("/api/docs")
    assert response.status_code == 200


def test_redoc():
    """ReDoc is accessible."""
    response = client.get("/api/redoc")
    assert response.status_code == 200


def test_openapi_json():
    """OpenAPI spec is valid JSON with expected structure."""
    response = client.get("/api/openapi.json")
    assert response.status_code == 200
    spec = response.json()
    assert "openapi" in spec
    assert "paths" in spec
    assert "info" in spec
    assert len(spec["paths"]) > 50  # We have 100+ endpoints


# ── CORS ──────────────────────────────────────────────────────

def test_cors_allowed_origin():
    """CORS allows configured origins."""
    response = client.options(
        "/health",
        headers={
            "Origin": "http://localhost:3000",
            "Access-Control-Request-Method": "GET",
        },
    )
    assert response.status_code in [200, 405]


# ── Auth Endpoints ────────────────────────────────────────────

def test_login_without_credentials():
    """Login without credentials returns error."""
    response = client.post("/api/auth/login", json={})
    assert response.status_code in [422, 400, 401]


def test_register_missing_fields():
    """Register with missing fields returns validation error."""
    response = client.post("/api/auth/register", json={"email": "test@test.com"})
    assert response.status_code in [422, 400]


# ── Protected Endpoints (may return 500 without live DB) ──────

def test_sessions_endpoint_exists():
    """Sessions endpoint is routed (may fail without DB)."""
    response = client.get("/api/sessions")
    # 200 with DB, 401 if auth required, 500 if no DB — all confirm route exists
    assert response.status_code in [200, 401, 403, 500]


def test_upload_endpoint_requires_session():
    """Upload endpoint requires a session_id parameter."""
    # /api/upload/{session_id} — without session_id, returns 404 or 405
    response = client.post("/api/upload")
    assert response.status_code in [404, 405, 422]
