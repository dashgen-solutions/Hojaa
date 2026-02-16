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
    is_subscribed: bool


class NotificationPreferenceUpdate(BaseModel):
    notify_node_created: Optional[bool] = None
    notify_node_modified: Optional[bool] = None
    notify_node_deleted: Optional[bool] = None
    notify_node_moved: Optional[bool] = None
    notify_status_changed: Optional[bool] = None
    notify_source_ingested: Optional[bool] = None
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
        updates = {k: v for k, v in body.dict().items() if v is not None}
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
    """Send a test notification email to the current user."""
    try:
        sub_hash = notification_service.add_subscriber(
            current_user.email, first_name=current_user.username,
        )
        if not sub_hash:
            return {
                "success": False,
                "detail": "Mailchimp is not configured or subscriber could not be added",
            }

        success = notification_service._send_campaign(
            subject="[MoMetric] Test Notification",
            html_content="""
            <div style="font-family:Arial,sans-serif;max-width:600px;margin:auto;">
                <h2 style="color:#4F46E5;">Test Notification</h2>
                <p>If you're reading this, your MoMetric email notifications are working correctly!</p>
            </div>
            """,
            recipient_emails=[current_user.email],
        )
        return {"success": success}
    except Exception as exc:
        logger.error(f"Test notification failed: {exc}")
        raise HTTPException(status_code=500, detail=str(exc))
