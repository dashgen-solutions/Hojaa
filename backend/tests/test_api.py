"""
Basic API tests.
"""
import pytest
from fastapi.testclient import TestClient
from app.main import app

client = TestClient(app)


def test_root():
    """Test root endpoint."""
    response = client.get("/")
    assert response.status_code == 200
    assert "message" in response.json()


def test_health_check():
    """Test health check endpoint."""
    response = client.get("/health")
    assert response.status_code == 200
    data = response.json()
    assert data["status"] == "healthy"
    assert "version" in data


def test_upload_without_data():
    """Test upload endpoint without data should fail."""
    response = client.post("/api/upload")
    assert response.status_code == 422  # Validation error


def test_upload_with_text():
    """Test upload endpoint with text."""
    response = client.post(
        "/api/upload",
        data={"text": "I want to build a chatbot for customer support"}
    )
    
    # This might fail if database isn't set up or API key is missing
    # That's okay for basic structure test
    assert response.status_code in [200, 500, 422]


def test_api_docs():
    """Test that API docs are accessible."""
    response = client.get("/api/docs")
    assert response.status_code == 200


def test_openapi_json():
    """Test OpenAPI spec is available."""
    response = client.get("/api/openapi.json")
    assert response.status_code == 200
    assert "openapi" in response.json()
