"""
Notification service using SMTP (Gmail or any SMTP provider).

Sends transactional email notifications for audit events
(node changes, source ingestion, card assignment, status updates).
"""
import smtplib
import asyncio
import re as _re
from email.mime.multipart import MIMEMultipart
from email.mime.text import MIMEText
from typing import List, Optional, Dict, Any
from uuid import UUID
from sqlalchemy.orm import Session as DBSession
from sqlalchemy import and_

from app.core.config import settings
from app.core.logger import get_logger
from app.models.database import (
    User, Session, Node, NotificationPreference, ChangeType,
    Card, TeamMember, SessionMember,
)

logger = get_logger(__name__)


def _send_email_sync(
    to_emails: List[str],
    subject: str,
    html_content: str,
) -> bool:
    """
    Send an email via SMTP (synchronous — call via asyncio.to_thread for async).
    Works with Gmail (App Password), Outlook, or any SMTP provider.
    """
    if not settings.smtp_username or not settings.smtp_password:
        logger.warning("SMTP credentials not configured — cannot send email")
        return False

    from_email = settings.smtp_from_email or settings.smtp_username
    from_name = settings.smtp_from_name or "MoMetric"

    try:
        for email in to_emails:
            msg = MIMEMultipart("alternative")
            msg["Subject"] = subject
            msg["From"] = f"{from_name} <{from_email}>"
            msg["To"] = email

            # Plain-text fallback (strip HTML tags)
            plain = html_content.replace("<br>", "\n").replace("<br/>", "\n")
            plain = _re.sub(r"<[^>]+>", "", plain)
            msg.attach(MIMEText(plain, "plain"))
            msg.attach(MIMEText(html_content, "html"))

            if settings.smtp_use_tls:
                server = smtplib.SMTP(settings.smtp_host, settings.smtp_port, timeout=15)
                server.ehlo()
                server.starttls()
                server.ehlo()
            else:
                server = smtplib.SMTP_SSL(settings.smtp_host, settings.smtp_port, timeout=15)

            server.login(settings.smtp_username, settings.smtp_password)
            server.sendmail(from_email, [email], msg.as_string())
            server.quit()

        logger.info(f"SMTP: sent email to {len(to_emails)} recipient(s): {subject[:60]}")
        return True
    except smtplib.SMTPAuthenticationError as exc:
        logger.error(f"SMTP auth failed (check App Password): {exc}")
        return False
    except smtplib.SMTPException as exc:
        logger.error(f"SMTP error: {exc}")
        return False
    except Exception as exc:
        logger.error(f"Failed to send email: {exc}")
        return False


# ---------------------------------------------------------------------------
# Notification service
# ---------------------------------------------------------------------------

class NotificationService:
    """
    Manages notification preferences (DB) and dispatches email
    notifications via SMTP triggered by audit-trail events.
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

        pref = NotificationPreference(
            user_id=user_id,
            session_id=session_id,
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
            notify_team_member_added, is_subscribed
        """
        pref = self.get_or_create_preference(db, user_id, session_id)

        allowed = {
            "notify_node_created", "notify_node_modified", "notify_node_deleted",
            "notify_node_moved", "notify_status_changed", "notify_source_ingested",
            "notify_team_member_added", "is_subscribed",
        }
        for key, value in updates.items():
            if key in allowed:
                setattr(pref, key, value)

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
    # Auto-create preferences for all session participants
    # ------------------------------------------------------------------

    def _ensure_session_preferences(
        self,
        db: DBSession,
        session_id: UUID,
    ) -> None:
        """
        Ensure that every user who has access to this session (the session
        owner + all SessionMember users) has a NotificationPreference row.

        Records are created with all notification flags defaulting to True so
        that users receive notifications even if they have never visited the
        notification settings page.
        """
        # Collect user IDs that already have a preference for this session
        existing_user_ids = set(
            uid for (uid,) in
            db.query(NotificationPreference.user_id)
            .filter(NotificationPreference.session_id == session_id)
            .all()
        )

        # Gather all user IDs that should have preferences
        target_user_ids: set = set()

        # 1) Session owner
        session_obj = db.query(Session).filter(Session.id == session_id).first()
        if session_obj and session_obj.user_id:
            target_user_ids.add(session_obj.user_id)

        # 2) All SessionMembers
        members = (
            db.query(SessionMember.user_id)
            .filter(SessionMember.session_id == session_id)
            .all()
        )
        for (uid,) in members:
            target_user_ids.add(uid)

        # Create missing preferences
        new_ids = target_user_ids - existing_user_ids
        if new_ids:
            for uid in new_ids:
                pref = NotificationPreference(
                    user_id=uid,
                    session_id=session_id,
                    is_subscribed=True,
                )
                db.add(pref)
            db.commit()
            logger.info(
                f"Auto-created notification preferences for {len(new_ids)} "
                f"user(s) in session {session_id}"
            )

    # ------------------------------------------------------------------
    # Sending emails
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
        """Build a styled HTML body for a change notification email."""
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
            rows.append(
                f'<tr><td style="padding:6px 12px;font-weight:bold;color:#374151;">Field</td>'
                f'<td style="padding:6px 12px;">{field_changed}</td></tr>'
            )
        if old_value:
            rows.append(
                f'<tr><td style="padding:6px 12px;font-weight:bold;color:#374151;">Previous</td>'
                f'<td style="padding:6px 12px;color:#DC2626;">{old_value}</td></tr>'
            )
        if new_value:
            rows.append(
                f'<tr><td style="padding:6px 12px;font-weight:bold;color:#374151;">New</td>'
                f'<td style="padding:6px 12px;color:#059669;">{new_value}</td></tr>'
            )

        detail_table = (
            f'<table style="border-collapse:collapse;margin-top:12px;border:1px solid #E5E7EB;'
            f'border-radius:6px;width:100%;">{"".join(rows)}</table>'
            if rows else ""
        )

        return f"""
        <div style="font-family:'Segoe UI',Arial,sans-serif;max-width:600px;margin:auto;
                    background:#ffffff;border:1px solid #E5E7EB;border-radius:12px;overflow:hidden;">
            <div style="background:linear-gradient(135deg,#4F46E5,#7C3AED);padding:24px 28px;">
                <h2 style="color:#ffffff;margin:0;font-size:20px;">{title}</h2>
            </div>
            <div style="padding:24px 28px;">
                <p style="margin:0 0 8px;color:#6B7280;font-size:14px;">
                    <b style="color:#374151;">Session:</b> {session_name}
                </p>
                <p style="margin:0 0 8px;color:#6B7280;font-size:14px;">
                    <b style="color:#374151;">Requirement:</b> {node_question}
                </p>
                <p style="margin:0 0 16px;color:#6B7280;font-size:14px;">
                    <b style="color:#374151;">Changed by:</b> {changed_by_name}
                </p>
                {detail_table}
            </div>
            <div style="padding:16px 28px;border-top:1px solid #F3F4F6;background:#F9FAFB;">
                <p style="margin:0;font-size:12px;color:#9CA3AF;">
                    You're receiving this because you have notifications enabled
                    for this session in MoMetric.
                </p>
            </div>
        </div>
        """

    def send_email(
        self,
        subject: str,
        html_content: str,
        recipient_emails: List[str],
    ) -> bool:
        """
        Send an email via SMTP to the specified recipients (synchronous).
        """
        if not settings.smtp_enabled:
            logger.info("SMTP is disabled — email not sent")
            return False
        return _send_email_sync(recipient_emails, subject, html_content)

    async def send_email_async(
        self,
        subject: str,
        html_content: str,
        recipient_emails: List[str],
    ) -> bool:
        """Non-blocking email send via SMTP (runs in thread pool)."""
        if not settings.smtp_enabled:
            logger.info("SMTP is disabled — email not sent")
            return False
        return await asyncio.to_thread(
            _send_email_sync, recipient_emails, subject, html_content,
        )

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
        if not settings.smtp_enabled:
            return 0

        # Auto-create preferences for users who haven't visited settings yet
        self._ensure_session_preferences(db, session_id)

        pref_column = self._CHANGE_PREF_MAP.get(change_type)
        if not pref_column:
            return 0

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

        pref_user_ids = [p.user_id for p in prefs if p.user_id != changed_by]
        if not pref_user_ids:
            return 0

        users = db.query(User).filter(User.id.in_(pref_user_ids)).all()
        recipient_emails = [u.email for u in users]
        if not recipient_emails:
            return 0

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

        success = self.send_email(subject, html, recipient_emails)
        return len(recipient_emails) if success else 0

    # ------------------------------------------------------------------
    # Source ingestion notification
    # ------------------------------------------------------------------

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
        if not settings.smtp_enabled:
            return 0

        # Auto-create preferences for users who haven't visited settings yet
        self._ensure_session_preferences(db, session_id)

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
        <div style="font-family:'Segoe UI',Arial,sans-serif;max-width:600px;margin:auto;
                    background:#ffffff;border:1px solid #E5E7EB;border-radius:12px;overflow:hidden;">
            <div style="background:linear-gradient(135deg,#4F46E5,#7C3AED);padding:24px 28px;">
                <h2 style="color:#ffffff;margin:0;font-size:20px;">New Source Ingested</h2>
            </div>
            <div style="padding:24px 28px;">
                <p style="margin:0 0 8px;color:#6B7280;font-size:14px;">
                    <b style="color:#374151;">Session:</b> {session_name}
                </p>
                <p style="margin:0 0 8px;color:#6B7280;font-size:14px;">
                    <b style="color:#374151;">Source:</b> {source_name}
                </p>
                <p style="margin:0 0 8px;color:#6B7280;font-size:14px;">
                    <b style="color:#374151;">Suggestions generated:</b> {suggestions_count}
                </p>
            </div>
            <div style="padding:16px 28px;border-top:1px solid #F3F4F6;background:#F9FAFB;">
                <p style="margin:0;font-size:12px;color:#9CA3AF;">
                    You're receiving this because you have notifications enabled
                    for this session in MoMetric.
                </p>
            </div>
        </div>
        """

        success = self.send_email(subject, html, recipient_emails)
        return len(recipient_emails) if success else 0

    # ------------------------------------------------------------------
    # Card assignment notification
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
        Returns True if the email was sent, False otherwise.
        """
        if not settings.smtp_enabled:
            logger.info(
                "Card assignment notification skipped: SMTP is disabled "
                "(set SMTP_ENABLED=true and configure SMTP credentials)"
            )
            return False

        team_member = db.query(TeamMember).filter(TeamMember.id == team_member_id).first()
        if not team_member:
            logger.warning(f"Card assignment notification skipped: team member {team_member_id} not found")
            return False
        if not team_member.email or not team_member.email.strip():
            logger.info(
                f"Card assignment notification skipped: team member '{team_member.name}' "
                f"has no email — add an email in the planning board team settings"
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
            f"Card assignment notification: sending to {team_member.email} "
            f"for card '{card_title[:50]}'"
        )

        subject = f"[MoMetric] You were assigned: {card_title[:60]}"
        html = f"""
        <div style="font-family:'Segoe UI',Arial,sans-serif;max-width:600px;margin:auto;
                    background:#ffffff;border:1px solid #E5E7EB;border-radius:12px;overflow:hidden;">
            <div style="background:linear-gradient(135deg,#4F46E5,#7C3AED);padding:24px 28px;">
                <h2 style="color:#ffffff;margin:0;font-size:20px;">Card Assignment</h2>
            </div>
            <div style="padding:24px 28px;">
                <p style="margin:0 0 12px;color:#374151;font-size:15px;">
                    Hi {team_member.name},
                </p>
                <p style="margin:0 0 8px;color:#6B7280;font-size:14px;">
                    <b style="color:#374151;">{assigner_name}</b> assigned you to a planning card.
                </p>
                <p style="margin:0 0 8px;color:#6B7280;font-size:14px;">
                    <b style="color:#374151;">Session:</b> {session_name}
                </p>
                <p style="margin:0 0 8px;color:#6B7280;font-size:14px;">
                    <b style="color:#374151;">Card:</b> {card_title}
                </p>
                <p style="margin:0 0 8px;color:#6B7280;font-size:14px;">
                    <b style="color:#374151;">Role:</b> Assignee
                </p>
            </div>
            <div style="padding:16px 28px;border-top:1px solid #F3F4F6;background:#F9FAFB;">
                <p style="margin:0;font-size:12px;color:#9CA3AF;">
                    You're receiving this because you were added to a card in MoMetric.
                </p>
            </div>
        </div>
        """

        success = self.send_email(subject, html, [team_member.email])
        if success:
            logger.info(f"Card assignment notification sent to {team_member.email} for card {card_id}")
        return success

    # ------------------------------------------------------------------
    # Team member added notification
    # ------------------------------------------------------------------

    def notify_team_member_added(
        self,
        db: DBSession,
        session_id: UUID,
        member_name: str,
        member_email: Optional[str],
        member_role: str,
        added_by: Optional[UUID] = None,
    ) -> int:
        """
        Notify subscribed users that a new team member was added.
        Also sends a welcome email to the new member if they have an email.
        Returns the number of recipients notified.
        """
        if not settings.smtp_enabled:
            return 0

        # Auto-create preferences for users who haven't visited settings yet
        self._ensure_session_preferences(db, session_id)

        # 1. Notify existing subscribed users
        prefs: List[NotificationPreference] = (
            db.query(NotificationPreference)
            .filter(and_(
                NotificationPreference.session_id == session_id,
                NotificationPreference.is_subscribed == True,  # noqa: E712
                NotificationPreference.notify_team_member_added == True,  # noqa: E712
            ))
            .all()
        )

        session_obj = db.query(Session).filter(Session.id == session_id).first()
        session_name = session_obj.document_filename or "Untitled" if session_obj else "Unknown"

        adder_name = "Someone"
        if added_by:
            adder = db.query(User).filter(User.id == added_by).first()
            if adder:
                adder_name = adder.username

        notified = 0

        if prefs:
            pref_user_ids = [p.user_id for p in prefs if p.user_id != added_by]
            users = db.query(User).filter(User.id.in_(pref_user_ids)).all()
            recipient_emails = [u.email for u in users]

            if recipient_emails:
                subject = f"[MoMetric] New team member: {member_name}"
                html = f"""
                <div style="font-family:'Segoe UI',Arial,sans-serif;max-width:600px;margin:auto;
                            background:#ffffff;border:1px solid #E5E7EB;border-radius:12px;overflow:hidden;">
                    <div style="background:linear-gradient(135deg,#4F46E5,#7C3AED);padding:24px 28px;">
                        <h2 style="color:#ffffff;margin:0;font-size:20px;">New Team Member</h2>
                    </div>
                    <div style="padding:24px 28px;">
                        <p style="margin:0 0 8px;color:#6B7280;font-size:14px;">
                            <b style="color:#374151;">Session:</b> {session_name}
                        </p>
                        <p style="margin:0 0 8px;color:#6B7280;font-size:14px;">
                            <b style="color:#374151;">Name:</b> {member_name}
                        </p>
                        <p style="margin:0 0 8px;color:#6B7280;font-size:14px;">
                            <b style="color:#374151;">Role:</b> {member_role}
                        </p>
                        <p style="margin:0 0 8px;color:#6B7280;font-size:14px;">
                            <b style="color:#374151;">Added by:</b> {adder_name}
                        </p>
                    </div>
                    <div style="padding:16px 28px;border-top:1px solid #F3F4F6;background:#F9FAFB;">
                        <p style="margin:0;font-size:12px;color:#9CA3AF;">
                            You're receiving this because you have team notifications enabled
                            for this session in MoMetric.
                        </p>
                    </div>
                </div>
                """
                if self.send_email(subject, html, recipient_emails):
                    notified = len(recipient_emails)

        # 2. Send welcome email to the new team member (if they have an email)
        if member_email and member_email.strip():
            welcome_subject = f"[MoMetric] Welcome to {session_name}"
            welcome_html = f"""
            <div style="font-family:'Segoe UI',Arial,sans-serif;max-width:600px;margin:auto;
                        background:#ffffff;border:1px solid #E5E7EB;border-radius:12px;overflow:hidden;">
                <div style="background:linear-gradient(135deg,#4F46E5,#7C3AED);padding:24px 28px;">
                    <h2 style="color:#ffffff;margin:0;font-size:20px;">Welcome to the Team!</h2>
                </div>
                <div style="padding:24px 28px;">
                    <p style="margin:0 0 12px;color:#374151;font-size:15px;">
                        Hi {member_name},
                    </p>
                    <p style="margin:0 0 8px;color:#6B7280;font-size:14px;">
                        <b style="color:#374151;">{adder_name}</b> added you to the project
                        <b style="color:#374151;">{session_name}</b> as <b style="color:#374151;">{member_role}</b>.
                    </p>
                    <p style="margin:0 0 8px;color:#6B7280;font-size:14px;">
                        You may receive card assignment notifications when tasks are assigned to you.
                    </p>
                </div>
                <div style="padding:16px 28px;border-top:1px solid #F3F4F6;background:#F9FAFB;">
                    <p style="margin:0;font-size:12px;color:#9CA3AF;">Sent from MoMetric.</p>
                </div>
            </div>
            """
            self.send_email(welcome_subject, welcome_html, [member_email.strip()])

        return notified

    # ------------------------------------------------------------------
    # Health / diagnostics
    # ------------------------------------------------------------------

    def check_health(self) -> Dict[str, Any]:
        """Return email notification health status."""
        if not settings.smtp_enabled:
            return {"enabled": False, "status": "disabled", "provider": "smtp"}

        if not settings.smtp_username or not settings.smtp_password:
            return {
                "enabled": True,
                "status": "error",
                "provider": "smtp",
                "detail": "SMTP credentials not configured",
            }

        try:
            if settings.smtp_use_tls:
                server = smtplib.SMTP(settings.smtp_host, settings.smtp_port, timeout=10)
                server.ehlo()
                server.starttls()
                server.ehlo()
            else:
                server = smtplib.SMTP_SSL(settings.smtp_host, settings.smtp_port, timeout=10)

            server.login(settings.smtp_username, settings.smtp_password)
            server.quit()

            return {
                "enabled": True,
                "status": "ok",
                "provider": "smtp",
                "smtp_host": settings.smtp_host,
                "from_email": settings.smtp_from_email or settings.smtp_username,
            }
        except smtplib.SMTPAuthenticationError:
            return {
                "enabled": True,
                "status": "error",
                "provider": "smtp",
                "detail": "Authentication failed — check SMTP_USERNAME and SMTP_PASSWORD (use Gmail App Password)",
            }
        except Exception as exc:
            return {
                "enabled": True,
                "status": "error",
                "provider": "smtp",
                "detail": str(exc),
            }


# Module-level singleton
notification_service = NotificationService()
