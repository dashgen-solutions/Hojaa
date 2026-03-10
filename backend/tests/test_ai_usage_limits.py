"""
Tests for the AI usage limit feature.

Covers:
- ai_usage_limit_service functions (unit)
- AIUsageLimitExceeded exception structure
- 402 handler integration via TestClient
- /auth/register with openai_api_key
- /auth/me returns usage info fields
"""
import pytest
from uuid import uuid4
from unittest.mock import patch, MagicMock

from fastapi.testclient import TestClient
from app.main import app
from app.core.exceptions import AIUsageLimitExceeded

client = TestClient(app)


# ── AIUsageLimitExceeded Exception ──────────────────────────────


class TestAIUsageLimitExceededException:
    """Verify the custom exception carries the expected payload."""

    def test_default_message(self):
        exc = AIUsageLimitExceeded(used_usd=0.12, limit_usd=0.10)
        assert exc.used_usd == 0.12
        assert exc.limit_usd == 0.10
        assert "$0.12" in exc.message
        assert "$0.10" in exc.message

    def test_custom_message(self):
        exc = AIUsageLimitExceeded(used_usd=0.05, limit_usd=0.10, message="Custom!")
        assert exc.message == "Custom!"
        assert exc.used_usd == 0.05

    def test_details_dict(self):
        exc = AIUsageLimitExceeded(used_usd=0.3, limit_usd=0.1)
        assert exc.details["error_code"] == "AI_USAGE_LIMIT_EXCEEDED"
        assert exc.details["used_usd"] == 0.3
        assert exc.details["limit_usd"] == 0.1

    def test_rounding(self):
        exc = AIUsageLimitExceeded(used_usd=0.123456789, limit_usd=0.100000001)
        assert exc.used_usd == 0.1235
        assert exc.limit_usd == 0.1


# ── 402 Exception Handler (integration) ────────────────────────


class TestUsageLimitHandler:
    """Verify the global exception handler converts AIUsageLimitExceeded to 402."""

    def test_402_response_structure(self):
        """Simulate an endpoint raising AIUsageLimitExceeded and verify the 402 JSON."""

        # Temporarily mount a test route that always raises the exception
        from fastapi import APIRouter
        test_router = APIRouter()

        @test_router.get("/_test_402")
        async def _raise_limit():
            raise AIUsageLimitExceeded(used_usd=0.11, limit_usd=0.10)

        app.include_router(test_router)
        try:
            resp = client.get("/_test_402")
            assert resp.status_code == 402
            body = resp.json()
            assert body["success"] is False
            assert body["error"] == "AI_USAGE_LIMIT_EXCEEDED"
            assert body["used_usd"] == 0.11
            assert body["limit_usd"] == 0.10
            assert "$0.11" in body["detail"]
        finally:
            # Clean up: remove the test route
            app.routes[:] = [r for r in app.routes if getattr(r, "path", None) != "/_test_402"]


# ── ai_usage_limit_service unit tests ──────────────────────────

class TestUserHasOwnApiKey:
    """Test user_has_own_api_key() with mocked DB."""

    def test_no_org_returns_false(self):
        from app.services.ai_usage_limit_service import user_has_own_api_key
        user = MagicMock()
        user.organization_id = None
        db = MagicMock()
        assert user_has_own_api_key(db, user) is False

    def test_org_with_llm_integration_returns_true(self):
        from app.services.ai_usage_limit_service import user_has_own_api_key
        user = MagicMock()
        user.organization_id = uuid4()
        db = MagicMock()
        # Simulate count() returning 1
        db.query.return_value.filter.return_value.count.return_value = 1
        assert user_has_own_api_key(db, user) is True

    def test_org_without_llm_integration_returns_false(self):
        from app.services.ai_usage_limit_service import user_has_own_api_key
        user = MagicMock()
        user.organization_id = uuid4()
        db = MagicMock()
        db.query.return_value.filter.return_value.count.return_value = 0
        assert user_has_own_api_key(db, user) is False


class TestGetUserUsageUsd:
    """Test get_user_usage_usd() with mocked DB."""

    def test_returns_zero_when_no_usage(self):
        from app.services.ai_usage_limit_service import get_user_usage_usd
        db = MagicMock()
        db.query.return_value.filter.return_value.scalar.return_value = 0.0
        assert get_user_usage_usd(db, uuid4()) == 0.0

    def test_returns_accumulated_cost(self):
        from app.services.ai_usage_limit_service import get_user_usage_usd
        db = MagicMock()
        db.query.return_value.filter.return_value.scalar.return_value = 0.075
        assert get_user_usage_usd(db, uuid4()) == 0.075

    def test_since_parameter_adds_filter(self):
        from app.services.ai_usage_limit_service import get_user_usage_usd
        from datetime import datetime
        db = MagicMock()
        # With 'since', filter is chained twice
        db.query.return_value.filter.return_value.filter.return_value.scalar.return_value = 0.03
        result = get_user_usage_usd(db, uuid4(), since=datetime(2026, 1, 1))
        assert result == 0.03


class TestCheckUsageLimit:
    """Test check_usage_limit() raises when over budget."""

    def test_under_limit_no_exception(self):
        from app.services.ai_usage_limit_service import check_usage_limit
        with patch("app.services.ai_usage_limit_service.get_user_usage_usd", return_value=0.05):
            check_usage_limit(MagicMock(), uuid4())  # Should not raise

    def test_at_limit_raises(self):
        from app.services.ai_usage_limit_service import check_usage_limit
        with patch("app.services.ai_usage_limit_service.get_user_usage_usd", return_value=0.10):
            with pytest.raises(AIUsageLimitExceeded) as exc_info:
                check_usage_limit(MagicMock(), uuid4())
            assert exc_info.value.used_usd == 0.10
            assert exc_info.value.limit_usd == 0.10

    def test_over_limit_raises(self):
        from app.services.ai_usage_limit_service import check_usage_limit
        with patch("app.services.ai_usage_limit_service.get_user_usage_usd", return_value=0.25):
            with pytest.raises(AIUsageLimitExceeded):
                check_usage_limit(MagicMock(), uuid4())


class TestEnforceAiLimit:
    """Test enforce_ai_limit() all-in-one gate."""

    def test_none_user_is_noop(self):
        from app.services.ai_usage_limit_service import enforce_ai_limit
        enforce_ai_limit(MagicMock(), None)  # No exception

    def test_user_with_own_key_skips_check(self):
        from app.services.ai_usage_limit_service import enforce_ai_limit
        with patch("app.services.ai_usage_limit_service.user_has_own_api_key", return_value=True):
            enforce_ai_limit(MagicMock(), MagicMock(id=uuid4()))  # No exception

    def test_user_without_key_under_limit_passes(self):
        from app.services.ai_usage_limit_service import enforce_ai_limit
        user = MagicMock()
        user.id = uuid4()
        with (
            patch("app.services.ai_usage_limit_service.user_has_own_api_key", return_value=False),
            patch("app.services.ai_usage_limit_service.get_user_usage_usd", return_value=0.02),
        ):
            enforce_ai_limit(MagicMock(), user)  # No exception

    def test_user_without_key_over_limit_raises(self):
        from app.services.ai_usage_limit_service import enforce_ai_limit
        user = MagicMock()
        user.id = uuid4()
        with (
            patch("app.services.ai_usage_limit_service.user_has_own_api_key", return_value=False),
            patch("app.services.ai_usage_limit_service.get_user_usage_usd", return_value=0.15),
        ):
            with pytest.raises(AIUsageLimitExceeded):
                enforce_ai_limit(MagicMock(), user)


class TestGetUserUsageInfo:
    """Test the /me helper returns the right shape."""

    def test_user_with_key(self):
        from app.services.ai_usage_limit_service import get_user_usage_info
        user = MagicMock()
        user.id = uuid4()
        with patch("app.services.ai_usage_limit_service.user_has_own_api_key", return_value=True):
            info = get_user_usage_info(MagicMock(), user)
        assert info["has_own_api_key"] is True
        assert info["ai_usage_usd"] == 0.0  # skipped when own key
        assert "ai_usage_limit_usd" in info

    def test_user_without_key(self):
        from app.services.ai_usage_limit_service import get_user_usage_info
        user = MagicMock()
        user.id = uuid4()
        with (
            patch("app.services.ai_usage_limit_service.user_has_own_api_key", return_value=False),
            patch("app.services.ai_usage_limit_service.get_user_usage_usd", return_value=0.04),
        ):
            info = get_user_usage_info(MagicMock(), user)
        assert info["has_own_api_key"] is False
        assert info["ai_usage_usd"] == 0.04


# ── Auth endpoints ──────────────────────────────────────────────


class TestRegisterWithApiKey:
    """Verify /register accepts the optional openai_api_key field."""

    def test_register_rejects_missing_required_fields(self):
        """Baseline: register still validates required fields."""
        resp = client.post("/api/auth/register", json={"email": "x@x.com"})
        assert resp.status_code in [422, 400]

    def test_register_schema_accepts_api_key_field(self):
        """The schema should accept openai_api_key without 422."""
        resp = client.post("/api/auth/register", json={
            "email": f"test_{uuid4().hex[:8]}@example.com",
            "username": f"user_{uuid4().hex[:8]}",
            "password": "securepass123",
            "openai_api_key": "sk-test-key-value",
        })
        # May fail with 500 (no live DB) or succeed (201) — but NOT 422
        assert resp.status_code != 422
