"""
18.2-C  White-labeling — Branding REST API.

Endpoints:
  GET  /api/branding              — get current org brand settings
  PUT  /api/branding              — update brand settings
  GET  /api/branding/public/{org_slug}  — public (no auth) for login page theming
"""
from __future__ import annotations

from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel
from sqlalchemy.orm import Session

from app.core.auth import get_current_user
from app.db.session import get_db
from app.models.database import BrandSettings, Organization, User

router = APIRouter(prefix="/branding", tags=["branding"])


# ── Schemas ──

class BrandSettingsIn(BaseModel):
    app_name: Optional[str] = None
    tagline: Optional[str] = None
    logo_url: Optional[str] = None
    favicon_url: Optional[str] = None
    primary_color: Optional[str] = None
    secondary_color: Optional[str] = None
    accent_color: Optional[str] = None
    background_color: Optional[str] = None
    text_color: Optional[str] = None
    font_family: Optional[str] = None
    pdf_header_text: Optional[str] = None
    pdf_footer_text: Optional[str] = None
    email_from_name: Optional[str] = None
    custom_domain: Optional[str] = None


class BrandSettingsOut(BaseModel):
    app_name: str
    tagline: Optional[str]
    logo_url: Optional[str]
    favicon_url: Optional[str]
    primary_color: str
    secondary_color: str
    accent_color: str
    background_color: str
    text_color: str
    font_family: str
    pdf_header_text: Optional[str]
    pdf_footer_text: Optional[str]
    email_from_name: Optional[str]
    custom_domain: Optional[str]


def _to_out(b: BrandSettings) -> BrandSettingsOut:
    return BrandSettingsOut(
        app_name=b.app_name,
        tagline=b.tagline,
        logo_url=b.logo_url,
        favicon_url=b.favicon_url,
        primary_color=b.primary_color,
        secondary_color=b.secondary_color,
        accent_color=b.accent_color,
        background_color=b.background_color,
        text_color=b.text_color,
        font_family=b.font_family,
        pdf_header_text=b.pdf_header_text,
        pdf_footer_text=b.pdf_footer_text,
        email_from_name=b.email_from_name,
        custom_domain=b.custom_domain,
    )


def _defaults() -> BrandSettingsOut:
    """Return MoMetric defaults when no brand settings exist."""
    return BrandSettingsOut(
        app_name="MoMetric",
        tagline="AI-Powered Requirements Discovery",
        logo_url=None,
        favicon_url=None,
        primary_color="#6366f1",
        secondary_color="#8b5cf6",
        accent_color="#f59e0b",
        background_color="#ffffff",
        text_color="#111827",
        font_family="Inter, system-ui, sans-serif",
        pdf_header_text=None,
        pdf_footer_text=None,
        email_from_name=None,
        custom_domain=None,
    )


# ── Endpoints ──

@router.get("", response_model=BrandSettingsOut)
def get_brand_settings(
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Get the brand settings for the current user's organization."""
    if not user.organization_id:
        return _defaults()
    row = db.query(BrandSettings).filter_by(organization_id=user.organization_id).first()
    return _to_out(row) if row else _defaults()


@router.put("", response_model=BrandSettingsOut)
def update_brand_settings(
    body: BrandSettingsIn,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Update brand settings for the current user's organization (admin+ only)."""
    if not user.organization_id:
        raise HTTPException(status.HTTP_403_FORBIDDEN, "Must belong to an organization")

    row = db.query(BrandSettings).filter_by(organization_id=user.organization_id).first()

    if not row:
        row = BrandSettings(organization_id=user.organization_id)
        db.add(row)

    # Apply non-None fields
    update_data = body.dict(exclude_unset=True)
    for key, val in update_data.items():
        if val is not None:
            setattr(row, key, val)

    db.commit()
    db.refresh(row)

    # Also sync logo_url to the Organization table
    org = db.query(Organization).filter_by(id=user.organization_id).first()
    if org and row.logo_url:
        org.logo_url = row.logo_url
        db.commit()

    return _to_out(row)


@router.get("/public/{org_slug}", response_model=BrandSettingsOut)
def get_public_brand_settings(
    org_slug: str,
    db: Session = Depends(get_db),
):
    """Public endpoint — returns brand settings for an org by slug (no auth).

    Useful for rendering a branded login page before the user is authenticated.
    """
    org = db.query(Organization).filter_by(slug=org_slug, is_active=True).first()
    if not org:
        return _defaults()
    row = db.query(BrandSettings).filter_by(organization_id=org.id).first()
    return _to_out(row) if row else _defaults()
