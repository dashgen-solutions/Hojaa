"""
Notification API routes – manage Mailchimp integration, user notification
preferences, and health diagnostics.
"""
from typing import Dict, Optional
from uuid import UUID
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy.orm import Session

from app.db.session import get_db
from app.core.auth import get_current_user
from app.core.logger import get_logger
from app.models.database import User
from app.services.notification_service import notification_service

logger = get_logger(__name__)

router = APIRouter(tags=["notifications"])


# ── Pydantic schemas ──────────────────────────────────────────────────────

class NotificationPreferenceResponse(BaseModel):
    notify_node_created: bool
    notify_node_modified: bool
    notify_node_deleted: bool
    notify_node_moved: bool
    notify_status_changed: bool
    notify_source_ingested: bool
    notify_team_member_added: bool
    is_subscribed: bool


class NotificationPreferenceUpdate(BaseModel):
    notify_node_created: Optional[bool] = None
    notify_node_modified: Optional[bool] = None
    notify_node_deleted: Optional[bool] = None
    notify_node_moved: Optional[bool] = None
    notify_status_changed: Optional[bool] = None
    notify_source_ingested: Optional[bool] = None
    notify_team_member_added: Optional[bool] = None
    is_subscribed: Optional[bool] = None


# ── Routes ────────────────────────────────────────────────────────────────

@router.get("/notifications/health")
async def mailchimp_health():
    """Check Mailchimp integration health."""
    return notification_service.check_health()


@router.get(
    "/notifications/{session_id}/preferences",
    response_model=NotificationPreferenceResponse,
)
async def get_preferences(
    session_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Get the current user's notification preferences for a session."""
    try:
        pref = notification_service.get_or_create_preference(
            db, current_user.id, UUID(session_id),
        )
        db.commit()
        return NotificationPreferenceResponse(
            notify_node_created=pref.notify_node_created,
            notify_node_modified=pref.notify_node_modified,
            notify_node_deleted=pref.notify_node_deleted,
            notify_node_moved=pref.notify_node_moved,
            notify_status_changed=pref.notify_status_changed,
            notify_source_ingested=pref.notify_source_ingested,
            notify_team_member_added=pref.notify_team_member_added,
            is_subscribed=pref.is_subscribed,
        )
    except Exception as exc:
        logger.error(f"Failed to get notification preferences: {exc}")
        raise HTTPException(status_code=500, detail=str(exc))


@router.patch(
    "/notifications/{session_id}/preferences",
    response_model=NotificationPreferenceResponse,
)
async def update_preferences(
    session_id: str,
    body: NotificationPreferenceUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Update notification preferences for the current user in a session."""
    try:
        updates = {k: v for k, v in body.model_dump().items() if v is not None}
        if not updates:
            raise HTTPException(status_code=400, detail="No fields to update")

        pref = notification_service.update_preference(
            db, current_user.id, UUID(session_id), updates,
        )
        db.commit()
        return NotificationPreferenceResponse(
            notify_node_created=pref.notify_node_created,
            notify_node_modified=pref.notify_node_modified,
            notify_node_deleted=pref.notify_node_deleted,
            notify_node_moved=pref.notify_node_moved,
            notify_status_changed=pref.notify_status_changed,
            notify_source_ingested=pref.notify_source_ingested,
            notify_team_member_added=pref.notify_team_member_added,
            is_subscribed=pref.is_subscribed,
        )
    except HTTPException:
        raise
    except Exception as exc:
        logger.error(f"Failed to update notification preferences: {exc}")
        raise HTTPException(status_code=500, detail=str(exc))


@router.post("/notifications/test")
async def send_test_notification(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Send a test notification email to the current user via SMTP."""
    try:
        success, err = notification_service.send_email(
            subject="[Hojaa] Test Notification",
            html_content="""
            <div style="font-family:'Segoe UI',Arial,sans-serif;max-width:600px;margin:auto;
                        background:#ffffff;border:1px solid #E5E7EB;border-radius:12px;overflow:hidden;">
                <div style="background:linear-gradient(135deg,#4F46E5,#7C3AED);padding:24px 28px;">
                    <h2 style="color:#ffffff;margin:0;font-size:20px;">Test Notification</h2>
                </div>
                <div style="padding:24px 28px;">
                    <p style="margin:0 0 8px;color:#374151;font-size:14px;">
                        If you're reading this, your Hojaa email notifications are working correctly!
                    </p>
                </div>
                <div style="padding:16px 28px;border-top:1px solid #F3F4F6;background:#F9FAFB;">
                    <p style="margin:0;font-size:12px;color:#9CA3AF;">Sent from Hojaa via SMTP.</p>
                </div>
            </div>
            """,
            recipient_emails=[current_user.email],
        )
        if not success:
            return {
                "success": False,
                "detail": err or "SMTP is not configured or email sending failed. Check SMTP_ENABLED, SMTP_USERNAME, and SMTP_PASSWORD in environment.",
            }
        return {"success": True}
    except Exception as exc:
        logger.error(f"Test notification failed: {exc}")
        raise HTTPException(status_code=500, detail=str(exc))
