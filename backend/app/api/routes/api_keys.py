"""
18.2-D  Public API — API Key management REST endpoints.

Endpoints:
  GET    /api/api-keys          — list all keys for the org
  POST   /api/api-keys          — create a new key (raw key returned once)
  DELETE /api/api-keys/{key_id} — revoke (deactivate)
"""
from __future__ import annotations

from datetime import datetime
from typing import List, Optional

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel
from sqlalchemy.orm import Session

from app.core.auth import get_current_user
from app.db.session import get_db
from app.models.database import User
from app.services import api_key_service

router = APIRouter(prefix="/api-keys", tags=["api-keys"])


# ── Schemas ──

class CreateAPIKeyRequest(BaseModel):
    name: str
    scopes: Optional[List[str]] = None  # defaults to full_access
    expires_at: Optional[str] = None     # ISO datetime


class APIKeyOut(BaseModel):
    id: str
    name: str
    key_prefix: str
    scopes: List[str]
    is_active: bool
    last_used_at: Optional[str] = None
    request_count: int
    expires_at: Optional[str] = None
    created_at: str


class CreateAPIKeyResponse(BaseModel):
    """Returned only on creation — contains the raw key (shown once)."""
    raw_key: str
    key: APIKeyOut


# ── Endpoints ──

@router.get("", response_model=List[APIKeyOut])
def list_keys(
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    rows = api_key_service.list_api_keys(
        db,
        org_id=user.organization_id,
        user_id=user.id if not user.organization_id else None,
    )
    return [_to_out(r) for r in rows]


@router.post("", response_model=CreateAPIKeyResponse, status_code=201)
def create_key(
    body: CreateAPIKeyRequest,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    expires = None
    if body.expires_at:
        try:
            expires = datetime.fromisoformat(body.expires_at)
        except ValueError:
            raise HTTPException(400, "Invalid expires_at format (use ISO 8601)")

    raw_key, row = api_key_service.create_api_key(
        db,
        organization_id=user.organization_id,  # may be None
        user_id=user.id,
        name=body.name,
        scopes=body.scopes,
        expires_at=expires,
    )

    return CreateAPIKeyResponse(raw_key=raw_key, key=_to_out(row))


@router.delete("/{key_id}", status_code=204)
def revoke_key(
    key_id: str,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    ok = api_key_service.revoke_api_key(
        db, key_id,
        org_id=user.organization_id,
        user_id=user.id if not user.organization_id else None,
    )
    if not ok:
        raise HTTPException(404, "API key not found")


# ── helpers ──

def _to_out(row) -> APIKeyOut:
    return APIKeyOut(
        id=str(row.id),
        name=row.name,
        key_prefix=row.key_prefix,
        scopes=row.scopes or [],
        is_active=row.is_active,
        last_used_at=row.last_used_at.isoformat() if row.last_used_at else None,
        request_count=row.request_count or 0,
        expires_at=row.expires_at.isoformat() if row.expires_at else None,
        created_at=row.created_at.isoformat(),
    )
