"""
Success Metrics API routes (Section 19).

Platform-admin-only endpoints.  The app developer authenticates via
PLATFORM_ADMIN_EMAIL / PLATFORM_ADMIN_PASSWORD (set in .env) and receives
a short-lived JWT.  No database user or organisation signup is required.

All metrics are computed **platform-wide** (org_id=None) so the app owner
sees the full picture across every organisation.
"""
from datetime import timedelta
from fastapi import APIRouter, Depends, HTTPException, Query, Request
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from sqlalchemy.orm import Session
from typing import Optional
from jose import JWTError, jwt
from pydantic import BaseModel

from app.db.session import get_db
from app.core.config import settings
from app.core.auth import ALGORITHM, create_access_token
from app.services.metrics_service import metrics_service
from app.core.logger import get_logger

logger = get_logger(__name__)
router = APIRouter(prefix="/metrics", tags=["metrics"])

# Separate bearer scheme (auto_error=False so we handle 401 ourselves)
_metrics_bearer = HTTPBearer(auto_error=False)

PLATFORM_ADMIN_SUB = "platform_admin"  # JWT subject for the super-admin


# ── Auth helpers ──────────────────────────────────────────────────────

class PlatformLoginRequest(BaseModel):
    email: str
    password: str


def _verify_platform_token(
    credentials: Optional[HTTPAuthorizationCredentials] = Depends(_metrics_bearer),
) -> str:
    """Decode + verify a platform-admin JWT.  Returns the 'sub' claim."""
    if credentials is None:
        raise HTTPException(status_code=401, detail="Not authenticated")
    try:
        payload = jwt.decode(
            credentials.credentials,
            settings.secret_key,
            algorithms=[ALGORITHM],
        )
        sub: str = payload.get("sub", "")
        if sub != PLATFORM_ADMIN_SUB:
            raise HTTPException(status_code=403, detail="Not a platform admin token")
        return sub
    except JWTError:
        raise HTTPException(status_code=401, detail="Invalid or expired token")


# ── Login endpoint ────────────────────────────────────────────────────

@router.post("/login")
async def platform_admin_login(body: PlatformLoginRequest):
    """
    Authenticate the platform admin (app developer) using env-based
    credentials.  Returns a JWT valid for 24 hours.
    """
    if not settings.platform_admin_password:
        raise HTTPException(
            status_code=503,
            detail="Platform admin credentials not configured",
        )
    if (
        body.email.lower().strip() != settings.platform_admin_email.lower().strip()
        or body.password != settings.platform_admin_password
    ):
        raise HTTPException(status_code=401, detail="Invalid credentials")

    token = create_access_token(
        data={"sub": PLATFORM_ADMIN_SUB, "scope": "metrics"},
        expires_delta=timedelta(hours=24),
    )
    return {"access_token": token, "token_type": "bearer"}


# ── Metrics endpoints (platform-wide, no org filter) ─────────────────

@router.get("/product")
async def get_product_metrics(
    request: Request,
    days: int = Query(30, ge=1, le=365, description="Look-back window in days"),
    db: Session = Depends(get_db),
    _admin: str = Depends(_verify_platform_token),
):
    """METRIC-1.x: Product metrics (session completion, sources, cards, etc.)."""
    try:
        return metrics_service.product_metrics(db, org_id=None, days=days)
    except Exception as e:
        logger.error(f"Error computing product metrics: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/satisfaction")
async def get_satisfaction_metrics(
    db: Session = Depends(get_db),
    _admin: str = Depends(_verify_platform_token),
):
    """METRIC-2.x: User satisfaction proxy indicators."""
    try:
        return metrics_service.satisfaction_metrics(db, org_id=None)
    except Exception as e:
        logger.error(f"Error computing satisfaction metrics: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/technical")
async def get_technical_metrics(
    request: Request,
    _admin: str = Depends(_verify_platform_token),
):
    """METRIC-3.x: API latency, error rates, uptime."""
    try:
        from app.middleware.metrics import MetricsMiddleware
        snapshot = {}
        app = request.app
        while hasattr(app, "app"):
            if isinstance(app, MetricsMiddleware):
                snapshot = app.snapshot()
                break
            app = app.app
        return metrics_service.technical_metrics(snapshot)
    except Exception as e:
        logger.error(f"Error computing technical metrics: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/trends")
async def get_daily_trends(
    days: int = Query(30, ge=1, le=365, description="Number of days of trend data"),
    db: Session = Depends(get_db),
    _admin: str = Depends(_verify_platform_token),
):
    """Daily trend data for charts (sessions, nodes, changes, cards)."""
    try:
        return metrics_service.daily_trends(db, org_id=None, days=days)
    except Exception as e:
        logger.error(f"Error computing trends: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/all")
async def get_all_metrics(
    request: Request,
    days: int = Query(30, ge=1, le=365),
    db: Session = Depends(get_db),
    _admin: str = Depends(_verify_platform_token),
):
    """Combined endpoint returning all metrics in one response."""
    try:
        product = metrics_service.product_metrics(db, org_id=None, days=days)
        satisfaction = metrics_service.satisfaction_metrics(db, org_id=None)

        from app.middleware.metrics import MetricsMiddleware
        snapshot = {}
        app = request.app
        while hasattr(app, "app"):
            if isinstance(app, MetricsMiddleware):
                snapshot = app.snapshot()
                break
            app = app.app
        technical = metrics_service.technical_metrics(snapshot)
        trends = metrics_service.daily_trends(db, org_id=None, days=days)

        return {
            "product": product,
            "satisfaction": satisfaction,
            "technical": technical,
            "trends": trends,
        }
    except Exception as e:
        logger.error(f"Error computing all metrics: {e}")
        raise HTTPException(status_code=500, detail=str(e))


# ── RISK-2.3C: AI usage / budget monitoring ─────────────────────────

@router.get("/ai-usage")
async def get_ai_usage(
    days: int = Query(30, ge=1, le=365, description="Look-back window in days"),
    db: Session = Depends(get_db),
    _admin: str = Depends(_verify_platform_token),
):
    """Return aggregated AI/LLM usage stats for budget monitoring.

    Includes per-task breakdown, per-model breakdown, daily costs,
    cache-hit rate, and totals.
    """
    try:
        from app.services.ai_usage_service import get_usage_summary
        return get_usage_summary(db, days=days)
    except Exception as e:
        logger.error(f"Error computing AI usage: {e}")
        raise HTTPException(status_code=500, detail=str(e))
