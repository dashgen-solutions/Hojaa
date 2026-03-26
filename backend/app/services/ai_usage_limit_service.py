"""
AI Usage Limit Service — Free-tier enforcement and user API key detection.

Users who have NOT configured their own LLM API key use the platform's
shared key with a per-user spend cap (default $0.10).  Once exceeded,
all AI calls are rejected with a clear message guiding them to either
configure their own key or purchase a paid plan.

Users/orgs that HAVE configured an LLM integration bypass the platform
limit entirely — their own key is used and billed to them.
"""
from datetime import datetime, timedelta
from typing import Optional, Tuple
from uuid import UUID

from sqlalchemy import func
from sqlalchemy.orm import Session as DBSession

from app.core.config import settings
from app.core.exceptions import AIUsageLimitExceeded
from app.core.logger import get_logger
from app.models.database import (
    AIUsageLog,
    Integration,
    IntegrationType,
    User,
)

logger = get_logger(__name__)


# ── Public helpers ──────────────────────────────────────────────


def user_has_own_api_key(db: DBSession, user: User) -> bool:
    """Return True if the user (or their org) has an active LLM integration."""
    if not user.organization_id:
        return False

    count = (
        db.query(Integration.id)
        .filter(
            Integration.organization_id == user.organization_id,
            Integration.integration_type.in_([
                IntegrationType.LLM_OPENAI,
                IntegrationType.LLM_ANTHROPIC,
                IntegrationType.LLM_GEMINI,
            ]),
            Integration.is_active == True,
        )
        .count()
    )
    return count > 0


def get_user_usage_usd(
    db: DBSession,
    user_id: UUID,
    *,
    since: Optional[datetime] = None,
) -> float:
    """Sum the estimated cost of all AI calls attributed to *user_id*.

    By default counts everything (lifetime). Pass *since* to scope to a
    billing window.
    """
    q = db.query(func.coalesce(func.sum(AIUsageLog.estimated_cost_usd), 0.0)).filter(
        AIUsageLog.user_id == user_id,
    )
    if since:
        q = q.filter(AIUsageLog.created_at >= since)
    return float(q.scalar())


def check_usage_limit(db: DBSession, user_id: UUID) -> None:
    """Raise ``AIUsageLimitExceeded`` if the free-tier budget is exhausted.

    Called before every AI invocation for users on the platform key.
    This is a no-op for users who have their own API key (that check is
    done externally before calling this function).
    """
    limit = settings.free_tier_usage_limit_usd
    used = get_user_usage_usd(db, user_id)
    if used >= limit:
        raise AIUsageLimitExceeded(used_usd=used, limit_usd=limit)


def enforce_ai_limit(db: DBSession, user: Optional[User]) -> None:
    """All-in-one gate for routes: skip if user has own key, else enforce limit.

    If ``user`` is None the call is allowed (anonymous / backward-compat).
    """
    if user is None:
        return

    if user_has_own_api_key(db, user):
        return

    check_usage_limit(db, user.id)


def get_user_usage_info(db: DBSession, user: User) -> dict:
    """Return a dict with usage stats suitable for API responses (/auth/me)."""
    has_key = user_has_own_api_key(db, user)
    used = 0.0 if has_key else get_user_usage_usd(db, user.id)
    limit = settings.free_tier_usage_limit_usd
    return {
        "has_own_api_key": has_key,
        "ai_usage_usd": round(used, 4),
        "ai_usage_limit_usd": round(limit, 4),
    }
