"""
18.2-B  External Integrations — REST API routes.

Endpoints:

  GET    /api/integrations                     — list org integrations
  POST   /api/integrations                     — create / update integration
  DELETE /api/integrations/{integration_id}     — delete
  POST   /api/integrations/test/{type}          — test connectivity
  GET    /api/integrations/syncs                — audit log
  POST   /api/integrations/jira/export-cards    — bulk export cards to Jira
  POST   /api/integrations/slack/notify         — send a Slack notification
"""
from __future__ import annotations

from typing import List, Optional
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session

from app.core.auth import get_current_user
from app.db.session import get_db
from app.models.database import (
    Card,
    Integration,
    IntegrationSync,
    IntegrationType,
    User,
)
from app.services import integration_service

router = APIRouter(prefix="/integrations", tags=["integrations"])


# ── Schemas ──

class IntegrationConfigIn(BaseModel):
    integration_type: str  # "jira" | "slack"
    config: dict = Field(default_factory=dict)
    is_active: bool = True


class IntegrationOut(BaseModel):
    id: str
    integration_type: str
    config: dict
    is_active: bool
    created_at: str

    class Config:
        from_attributes = True


class SyncOut(BaseModel):
    id: str
    action: str
    entity_type: Optional[str] = None
    external_id: Optional[str] = None
    external_url: Optional[str] = None
    status: str
    error_message: Optional[str] = None
    created_at: str


class JiraExportRequest(BaseModel):
    session_id: str
    card_ids: Optional[List[str]] = None  # None = export all cards in session


class SlackNotifyRequest(BaseModel):
    session_id: Optional[str] = None
    text: str
    channel: Optional[str] = None



# ── Endpoints ──

@router.get("", response_model=List[IntegrationOut])
def list_integrations(
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    if not user.organization_id:
        return []
    rows = db.query(Integration).filter_by(organization_id=user.organization_id).all()
    return [
        IntegrationOut(
            id=str(r.id),
            integration_type=r.integration_type.value,
            config=_mask_secrets(r.config),
            is_active=r.is_active,
            created_at=r.created_at.isoformat(),
        )
        for r in rows
    ]


@router.post("", response_model=IntegrationOut, status_code=201)
def upsert_integration(
    body: IntegrationConfigIn,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    if not user.organization_id:
        raise HTTPException(status.HTTP_400_BAD_REQUEST,
                            "Create or join an organization first to configure integrations")
    org_id = user.organization_id
    try:
        int_type = IntegrationType(body.integration_type)
    except ValueError:
        raise HTTPException(400, f"Invalid type. Must be one of: {[t.value for t in IntegrationType]}")

    existing = (
        db.query(Integration)
        .filter_by(organization_id=org_id, integration_type=int_type)
        .first()
    )
    if existing:
        existing.config = body.config
        existing.is_active = body.is_active
        existing.updated_at = __import__("datetime").datetime.utcnow()
        db.commit()
        db.refresh(existing)
        row = existing
    else:
        row = Integration(
            organization_id=org_id,
            integration_type=int_type,
            config=body.config,
            is_active=body.is_active,
            created_by=user.id,
        )
        db.add(row)
        db.commit()
        db.refresh(row)

    return IntegrationOut(
        id=str(row.id),
        integration_type=row.integration_type.value,
        config=_mask_secrets(row.config),
        is_active=row.is_active,
        created_at=row.created_at.isoformat(),
    )


@router.delete("/{integration_id}", status_code=204)
def delete_integration(
    integration_id: str,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    if not user.organization_id:
        raise HTTPException(status.HTTP_400_BAD_REQUEST,
                            "Create or join an organization first to manage integrations")
    org_id = user.organization_id
    row = db.query(Integration).filter_by(id=integration_id, organization_id=org_id).first()
    if not row:
        raise HTTPException(404, "Integration not found")
    db.delete(row)
    db.commit()


@router.post("/test/{integration_type}")
async def test_integration(
    integration_type: str,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Test connectivity for a configured integration."""
    if not user.organization_id:
        raise HTTPException(status.HTTP_400_BAD_REQUEST,
                            "Create or join an organization first to test integrations")
    org_id = user.organization_id
    try:
        int_type = IntegrationType(integration_type)
    except ValueError:
        raise HTTPException(400, "Invalid integration type")

    integ = integration_service.get_integration(db, org_id, int_type)
    if not integ:
        raise HTTPException(404, "Integration not configured")

    if int_type == IntegrationType.JIRA:
        cfg = integ.config or {}
        import httpx
        try:
            async with httpx.AsyncClient(timeout=10) as client:
                resp = await client.get(
                    f"{cfg.get('base_url', '').rstrip('/')}/rest/api/3/myself",
                    auth=(cfg.get("email", ""), cfg.get("api_token", "")),
                )
                resp.raise_for_status()
                return {"status": "ok", "user": resp.json().get("displayName")}
        except Exception as e:
            return {"status": "error", "message": str(e)}

    elif int_type == IntegrationType.SLACK:
        result = await integration_service.slack_send_message(
            db, integ,
            text="🔔 Hojaa integration test — connection successful!",
        )
        return {"status": "ok" if result else "error"}

    elif int_type == IntegrationType.LLM_OPENAI:
        cfg = integ.config or {}
        try:
            import openai
            client = openai.OpenAI(api_key=cfg.get("api_key", ""))
            models = client.models.list()
            return {"status": "ok", "message": f"Connected. {len(models.data)} models available."}
        except Exception as e:
            return {"status": "error", "message": str(e)}

    elif int_type == IntegrationType.LLM_ANTHROPIC:
        cfg = integ.config or {}
        try:
            import anthropic
            client = anthropic.Anthropic(api_key=cfg.get("api_key", ""))
            response = client.messages.create(
                model=cfg.get("model", "claude-sonnet-4-20250514"),
                max_tokens=10,
                messages=[{"role": "user", "content": "ping"}],
            )
            return {"status": "ok", "message": "Connected successfully."}
        except Exception as e:
            return {"status": "error", "message": str(e)}

    return {"status": "unknown_type"}


@router.get("/syncs", response_model=List[SyncOut])
def list_syncs(
    limit: int = 50,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Return recent integration sync audit log entries."""
    if not user.organization_id:
        return []
    org_id = user.organization_id
    rows = (
        db.query(IntegrationSync)
        .join(Integration)
        .filter(Integration.organization_id == org_id)
        .order_by(IntegrationSync.created_at.desc())
        .limit(limit)
        .all()
    )
    return [
        SyncOut(
            id=str(r.id),
            action=r.action,
            entity_type=r.entity_type,
            external_id=r.external_id,
            external_url=r.external_url,
            status=r.status,
            error_message=r.error_message,
            created_at=r.created_at.isoformat(),
        )
        for r in rows
    ]


@router.post("/jira/export-cards")
async def export_cards_to_jira(
    body: JiraExportRequest,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Bulk-export session cards as Jira issues."""
    if not user.organization_id:
        raise HTTPException(status.HTTP_400_BAD_REQUEST,
                            "Create or join an organization first to export to Jira")
    org_id = user.organization_id
    integ = integration_service.get_integration(db, org_id, IntegrationType.JIRA)
    if not integ:
        raise HTTPException(404, "Jira integration not configured")

    q = db.query(Card).filter_by(session_id=body.session_id)
    if body.card_ids:
        q = q.filter(Card.id.in_(body.card_ids))
    cards = q.all()

    if not cards:
        raise HTTPException(404, "No cards found")

    result = await integration_service.export_cards_to_jira(
        db, integ, cards, UUID(body.session_id),
    )
    return result


@router.post("/slack/notify")
async def slack_notify(
    body: SlackNotifyRequest,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Send a custom Slack message via the org integration."""
    if not user.organization_id:
        raise HTTPException(status.HTTP_400_BAD_REQUEST,
                            "Create or join an organization first to use Slack integration")
    org_id = user.organization_id
    integ = integration_service.get_integration(db, org_id, IntegrationType.SLACK)
    if not integ:
        raise HTTPException(404, "Slack integration not configured")

    result = await integration_service.slack_send_message(
        db, integ,
        text=body.text,
        channel=body.channel,
        session_id=UUID(body.session_id) if body.session_id else None,
    )
    return {"status": "sent" if result else "failed"}


# ── Secret masking ──

_SECRET_KEYS = {"api_key", "api_token", "bot_token", "webhook_url"}


def _mask_secrets(config: dict) -> dict:
    """Mask sensitive config keys so they aren't leaked to the frontend."""
    out = {}
    for k, v in config.items():
        if k in _SECRET_KEYS and isinstance(v, str) and len(v) > 8:
            out[k] = v[:4] + "•" * (len(v) - 8) + v[-4:]
        else:
            out[k] = v
    return out
