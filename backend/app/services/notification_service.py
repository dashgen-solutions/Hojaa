"""
Notification service using Mailchimp Marketing API.

Manages subscriber lists and sends email notifications for audit events
(node changes, source ingestion, status updates).
"""
import hashlib
from typing import List, Optional, Dict, Any
from uuid import UUID
from datetime import datetime
from sqlalchemy.orm import Session as DBSession
from sqlalchemy import and_

from app.core.config import settings
from app.core.logger import get_logger
from app.models.database import (
    User, Session, Node, NotificationPreference, ChangeType,
    Card, TeamMember,
)

logger = get_logger(__name__)

# Lazy-initialised Mailchimp client – avoids import errors when
# mailchimp-marketing is not installed (dev environments).
_mc_client = None


def _get_mailchimp_client():
    """Return a configured Mailchimp Marketing client (singleton)."""
    global _mc_client
    if _mc_client is not None:
        return _mc_client

    if not settings.mailchimp_api_key or not settings.mailchimp_server_prefix:
        logger.warning("Mailchimp API key or server prefix not configured")
        return None

    try:
        import mailchimp_marketing as MailchimpMarketing
        from mailchimp_marketing.api_client import ApiClientError  # noqa: F401

        client = MailchimpMarketing.Client()
        client.set_config({
            "api_key": settings.mailchimp_api_key,
            "server": settings.mailchimp_server_prefix,
        })
        # Quick ping to validate credentials
        client.ping.get()
        _mc_client = client
        logger.info("Mailchimp client initialised successfully")
        return _mc_client
    except Exception as exc:
        logger.error(f"Failed to initialise Mailchimp client: {exc}")
        return None


def _subscriber_hash(email: str) -> str:
    """Mailchimp uses MD5 of the lower-cased email as a subscriber id."""
    return hashlib.md5(email.lower().encode()).hexdigest()


# ---------------------------------------------------------------------------
# Subscriber management
# ---------------------------------------------------------------------------

class NotificationService:
    """
    Manages Mailchimp audience subscribers and dispatches email
    notifications triggered by audit-trail events.
    """

    # Maps ChangeType → NotificationPreference column name
    _CHANGE_PREF_MAP: Dict[str, str] = {
        ChangeType.CREATED.value: "notify_node_created",
        ChangeType.MODIFIED.value: "notify_node_modified",
        ChangeType.DELETED.value: "notify_node_deleted",
        ChangeType.MOVED.value: "notify_node_moved",
        ChangeType.STATUS_CHANGED.value: "notify_status_changed",
    }

    # ------------------------------------------------------------------
    # Subscriber helpers
    # ------------------------------------------------------------------

    def add_subscriber(self, email: str, first_name: str = "", last_name: str = "") -> Optional[str]:
        """
        Add or update a contact in the Mailchimp audience.
        Returns the subscriber hash on success, None on failure.
        """
        client = _get_mailchimp_client()
        if not client:
            return None

        sub_hash = _subscriber_hash(email)
        try:
            client.lists.set_list_member(
                settings.mailchimp_audience_id,
                sub_hash,
                {
                    "email_address": email,
                    "status_if_new": "subscribed",
                    "merge_fields": {
                        "FNAME": first_name,
                        "LNAME": last_name,
                    },
                },
            )
            logger.info(f"Mailchimp: subscriber upserted – {email}")
            return sub_hash
        except Exception as exc:
            logger.error(f"Mailchimp: failed to upsert subscriber {email}: {exc}")
            return None

    def remove_subscriber(self, email: str) -> bool:
        """Unsubscribe a contact (sets status to 'unsubscribed')."""
        client = _get_mailchimp_client()
        if not client:
            return False

        sub_hash = _subscriber_hash(email)
        try:
            client.lists.update_list_member(
                settings.mailchimp_audience_id,
                sub_hash,
                {"status": "unsubscribed"},
            )
            logger.info(f"Mailchimp: unsubscribed – {email}")
            return True
        except Exception as exc:
            logger.error(f"Mailchimp: failed to unsubscribe {email}: {exc}")
            return False

    def check_subscriber(self, email: str) -> Optional[Dict[str, Any]]:
        """Return subscriber info or None if not found / error."""
        client = _get_mailchimp_client()
        if not client:
            return None

        sub_hash = _subscriber_hash(email)
        try:
            member = client.lists.get_list_member(
                settings.mailchimp_audience_id,
                sub_hash,
            )
            return {
                "email": member.get("email_address"),
                "status": member.get("status"),
                "subscriber_hash": sub_hash,
            }
        except Exception:
            return None

    # ------------------------------------------------------------------
    # Notification preferences (DB)
    # ------------------------------------------------------------------

    def get_or_create_preference(
        self,
        db: DBSession,
        user_id: UUID,
        session_id: UUID,
    ) -> NotificationPreference:
        """
        Return existing preference row or create one with defaults.
        Also ensures the user is subscribed in Mailchimp.
        """
        pref = (
            db.query(NotificationPreference)
            .filter(and_(
                NotificationPreference.user_id == user_id,
                NotificationPreference.session_id == session_id,
            ))
            .first()
        )
        if pref:
            return pref

        # Resolve user email for Mailchimp
        user = db.query(User).filter(User.id == user_id).first()
        sub_hash = None
        if user and settings.mailchimp_enabled:
            sub_hash = self.add_subscriber(user.email, first_name=user.username)

        pref = NotificationPreference(
            user_id=user_id,
            session_id=session_id,
            mailchimp_subscriber_hash=sub_hash,
            is_subscribed=True,
        )
        db.add(pref)
        db.flush()
        return pref

    def update_preference(
        self,
        db: DBSession,
        user_id: UUID,
        session_id: UUID,
        updates: Dict[str, bool],
    ) -> NotificationPreference:
        """
        Update notification preference flags.  Accepted keys:
            notify_node_created, notify_node_modified, notify_node_deleted,
            notify_node_moved, notify_status_changed, notify_source_ingested,
            is_subscribed
        """
        pref = self.get_or_create_preference(db, user_id, session_id)

        allowed = {
            "notify_node_created", "notify_node_modified", "notify_node_deleted",
            "notify_node_moved", "notify_status_changed", "notify_source_ingested",
            "is_subscribed",
        }
        for key, value in updates.items():
            if key in allowed:
                setattr(pref, key, value)

        # If user turned off everything, unsubscribe from Mailchimp
        if not pref.is_subscribed and settings.mailchimp_enabled:
            user = db.query(User).filter(User.id == user_id).first()
            if user:
                self.remove_subscriber(user.email)

        db.flush()
        return pref

    def get_preference(
        self,
        db: DBSession,
        user_id: UUID,
        session_id: UUID,
    ) -> Optional[NotificationPreference]:
        """Return the preference row or None."""
        return (
            db.query(NotificationPreference)
            .filter(and_(
                NotificationPreference.user_id == user_id,
                NotificationPreference.session_id == session_id,
            ))
            .first()
        )

    # ------------------------------------------------------------------
    # Sending notifications
    # ------------------------------------------------------------------

    def _build_change_html(
        self,
        change_type: str,
        node_question: str,
        field_changed: Optional[str],
        old_value: Optional[str],
        new_value: Optional[str],
        changed_by_name: str,
        session_name: str,
    ) -> str:
        """Build a simple HTML body for a change notification email."""
        title_map = {
            "created": "New Requirement Added",
            "modified": "Requirement Modified",
            "deleted": "Requirement Deleted",
            "moved": "Requirement Moved",
            "status_changed": "Requirement Status Changed",
        }
        title = title_map.get(change_type, "Requirement Changed")

        rows = []
        if field_changed:
            rows.append(f"<tr><td><b>Field</b></td><td>{field_changed}</td></tr>")
        if old_value:
            rows.append(f"<tr><td><b>Previous</b></td><td>{old_value}</td></tr>")
        if new_value:
            rows.append(f"<tr><td><b>New</b></td><td>{new_value}</td></tr>")

        detail_table = f"<table>{''.join(rows)}</table>" if rows else ""

        return f"""
        <div style="font-family:Arial,sans-serif;max-width:600px;margin:auto;">
            <h2 style="color:#4F46E5;">{title}</h2>
            <p><b>Session:</b> {session_name}</p>
            <p><b>Requirement:</b> {node_question}</p>
            <p><b>Changed by:</b> {changed_by_name}</p>
            {detail_table}
            <hr style="margin-top:24px;"/>
            <p style="font-size:12px;color:#6B7280;">
                You are receiving this because you have notifications enabled for this session in MoMetric.
            </p>
        </div>
        """

    def _send_campaign(self, subject: str, html_content: str, recipient_emails: List[str]) -> bool:
        """
        Create and immediately send a Mailchimp campaign to specific subscribers.

        On the free plan this uses a regular campaign targeted at the
        supplied emails via a segment condition.  Each call creates a
        tiny one-off campaign.
        """
        client = _get_mailchimp_client()
        if not client:
            return False

        if not recipient_emails:
            return False

        try:
            # Build segment conditions – match any of the supplied emails
            conditions = [
                {
                    "condition_type": "EmailAddress",
                    "field": "EMAIL",
                    "op": "is",
                    "value": email,
                }
                for email in recipient_emails
            ]

            # Create campaign
            campaign = client.campaigns.create({
                "type": "regular",
                "recipients": {
                    "list_id": settings.mailchimp_audience_id,
                    "segment_opts": {
                        "match": "any",
                        "conditions": conditions,
                    },
                },
                "settings": {
                    "subject_line": subject,
                    "from_name": settings.mailchimp_from_name,
                    "reply_to": settings.mailchimp_from_email,
                    "title": f"MoMetric – {subject[:60]}",
                },
            })
            campaign_id = campaign["id"]

            # Set content
            client.campaigns.set_content(campaign_id, {
                "html": html_content,
            })

            # Send immediately
            client.campaigns.send(campaign_id)
            logger.info(f"Mailchimp: campaign {campaign_id} sent to {len(recipient_emails)} recipient(s)")
            return True
        except Exception as exc:
            logger.error(f"Mailchimp: failed to send campaign: {exc}")
            return False

    # ------------------------------------------------------------------
    # Public: fire notification for a node change
    # ------------------------------------------------------------------

    def notify_node_change(
        self,
        db: DBSession,
        session_id: UUID,
        node_id: UUID,
        change_type: str,
        field_changed: Optional[str] = None,
        old_value: Optional[str] = None,
        new_value: Optional[str] = None,
        changed_by: Optional[UUID] = None,
    ) -> int:
        """
        Send notification emails to all subscribed users for this session
        who have the matching preference enabled.

        Returns the number of recipients notified.
        """
        if not settings.mailchimp_enabled:
            return 0

        # Resolve the preference field for this change type
        pref_column = self._CHANGE_PREF_MAP.get(change_type)
        if not pref_column:
            return 0

        # Fetch all preferences for the session where the flag is True
        prefs: List[NotificationPreference] = (
            db.query(NotificationPreference)
            .filter(and_(
                NotificationPreference.session_id == session_id,
                NotificationPreference.is_subscribed == True,  # noqa: E712
                getattr(NotificationPreference, pref_column) == True,  # noqa: E712
            ))
            .all()
        )

        if not prefs:
            return 0

        # Exclude the user who made the change (don't notify yourself)
        pref_user_ids = [p.user_id for p in prefs if p.user_id != changed_by]
        if not pref_user_ids:
            return 0

        # Gather emails
        users = db.query(User).filter(User.id.in_(pref_user_ids)).all()
        recipient_emails = [u.email for u in users]
        if not recipient_emails:
            return 0

        # Resolve context
        node = db.query(Node).filter(Node.id == node_id).first()
        node_question = node.question if node else "(deleted node)"
        session_obj = db.query(Session).filter(Session.id == session_id).first()
        session_name = session_obj.document_filename or "Untitled" if session_obj else "Unknown"

        changer = db.query(User).filter(User.id == changed_by).first() if changed_by else None
        changed_by_name = changer.username if changer else "System"

        subject = f"[MoMetric] Requirement {change_type}: {node_question[:80]}"
        html = self._build_change_html(
            change_type=change_type,
            node_question=node_question,
            field_changed=field_changed,
            old_value=old_value,
            new_value=new_value,
            changed_by_name=changed_by_name,
            session_name=session_name,
        )

        success = self._send_campaign(subject, html, recipient_emails)
        return len(recipient_emails) if success else 0

    def notify_source_ingested(
        self,
        db: DBSession,
        session_id: UUID,
        source_name: str,
        suggestions_count: int,
        ingested_by: Optional[UUID] = None,
    ) -> int:
        """
        Notify subscribed users that a new source has been ingested.
        Returns the number of recipients notified.
        """
        if not settings.mailchimp_enabled:
            return 0

        prefs: List[NotificationPreference] = (
            db.query(NotificationPreference)
            .filter(and_(
                NotificationPreference.session_id == session_id,
                NotificationPreference.is_subscribed == True,  # noqa: E712
                NotificationPreference.notify_source_ingested == True,  # noqa: E712
            ))
            .all()
        )

        if not prefs:
            return 0

        pref_user_ids = [p.user_id for p in prefs if p.user_id != ingested_by]
        users = db.query(User).filter(User.id.in_(pref_user_ids)).all()
        recipient_emails = [u.email for u in users]
        if not recipient_emails:
            return 0

        session_obj = db.query(Session).filter(Session.id == session_id).first()
        session_name = session_obj.document_filename or "Untitled" if session_obj else "Unknown"

        subject = f"[MoMetric] New source ingested: {source_name[:80]}"
        html = f"""
        <div style="font-family:Arial,sans-serif;max-width:600px;margin:auto;">
            <h2 style="color:#4F46E5;">New Source Ingested</h2>
            <p><b>Session:</b> {session_name}</p>
            <p><b>Source:</b> {source_name}</p>
            <p><b>Suggestions generated:</b> {suggestions_count}</p>
            <hr style="margin-top:24px;"/>
            <p style="font-size:12px;color:#6B7280;">
                You are receiving this because you have notifications enabled for this session in MoMetric.
            </p>
        </div>
        """

        success = self._send_campaign(subject, html, recipient_emails)
        return len(recipient_emails) if success else 0

    # ------------------------------------------------------------------
    # Card assignment notification (notify assignee when added to a card)
    # ------------------------------------------------------------------

    def notify_card_assignment(
        self,
        db: DBSession,
        session_id: UUID,
        card_id: UUID,
        team_member_id: UUID,
        assigned_by: Optional[UUID] = None,
    ) -> bool:
        """
        Notify a team member by email when they are assigned to a planning card.
        Uses the same Mailchimp audience (MAILCHIMP_AUDIENCE_ID): adds the
        contact if needed and sends a one-off campaign to that email.

        Returns True if the email was sent, False otherwise.
        """
        if not settings.mailchimp_enabled:
            logger.info(
                "Card assignment notification skipped: Mailchimp is disabled "
                "(set MAILCHIMP_ENABLED=true and configure API key / audience ID)"
            )
            return False

        team_member = db.query(TeamMember).filter(TeamMember.id == team_member_id).first()
        if not team_member:
            logger.warning(f"Card assignment notification skipped: team member {team_member_id} not found")
            return False
        if not team_member.email or not team_member.email.strip():
            logger.info(
                f"Card assignment notification skipped: team member '{team_member.name}' (id={team_member_id}) "
                "has no email — add an email in the planning board team settings"
            )
            return False

        card = db.query(Card).filter(Card.id == card_id).first()
        if not card:
            logger.warning(f"Card assignment notification skipped: card {card_id} not found")
            return False

        node = db.query(Node).filter(Node.id == card.node_id).first()
        card_title = node.question if node else "Planning card"

        session_obj = db.query(Session).filter(Session.id == session_id).first()
        session_name = session_obj.document_filename or "Untitled" if session_obj else "Unknown"

        assigner_name = "A team member"
        if assigned_by:
            assigner = db.query(User).filter(User.id == assigned_by).first()
            if assigner:
                assigner_name = assigner.username

        logger.info(
            f"Card assignment notification: sending to {team_member.email} for card '{card_title[:50]}'"
        )

        # Ensure assignee is in Mailchimp audience (same list used for all notifications)
        self.add_subscriber(
            team_member.email,
            first_name=team_member.name,
            last_name="",
        )

        subject = f"[MoMetric] You were assigned: {card_title[:60]}"
        html = f"""
        <div style="font-family:Arial,sans-serif;max-width:600px;margin:auto;">
            <h2 style="color:#4F46E5;">Card assignment</h2>
            <p>Hi {team_member.name},</p>
            <p><b>{assigner_name}</b> assigned you to a planning card.</p>
            <p><b>Session:</b> {session_name}</p>
            <p><b>Card:</b> {card_title}</p>
            <p><b>Your role:</b> Assignee</p>
            <hr style="margin-top:24px;"/>
            <p style="font-size:12px;color:#6B7280;">
                You are receiving this because you were added to a card in MoMetric.
            </p>
        </div>
        """

        success = self._send_campaign(subject, html, [team_member.email])
        if success:
            logger.info(f"Card assignment notification sent to {team_member.email} for card {card_id}")
        return success

    # ------------------------------------------------------------------
    # Health / diagnostics
    # ------------------------------------------------------------------

    def check_health(self) -> Dict[str, Any]:
        """Return Mailchimp integration health status."""
        if not settings.mailchimp_enabled:
            return {"enabled": False, "status": "disabled"}

        client = _get_mailchimp_client()
        if not client:
            return {"enabled": True, "status": "error", "detail": "Client init failed"}

        try:
            resp = client.ping.get()
            return {
                "enabled": True,
                "status": "ok",
                "health_check": resp.get("health_status", "unknown"),
                "audience_id": settings.mailchimp_audience_id,
            }
        except Exception as exc:
            return {"enabled": True, "status": "error", "detail": str(exc)}


# Module-level singleton
notification_service = NotificationService()
