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
from typing import List, Optional, Dict, Any, Tuple
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
) -> Tuple[bool, str]:
    """
    Send an email via SMTP (synchronous — call via asyncio.to_thread for async).
    Works with Gmail (App Password), Outlook, or any SMTP provider.

    Returns (True, "") on success, or (False, short_error_message) on failure.
    """
    smtp_username = (settings.smtp_username or "").strip()
    # Gmail app passwords are often entered with spaces for readability.
    # Normalize to the real 16-char secret before auth.
    smtp_password = (settings.smtp_password or "").replace(" ", "").strip()

    if not to_emails:
        return False, "No recipient email addresses"

    if not smtp_username or not smtp_password:
        logger.warning("SMTP credentials not configured — cannot send email")
        return False, "SMTP credentials not configured (SMTP_USERNAME / SMTP_PASSWORD)"

    from_email = settings.smtp_from_email or settings.smtp_username
    from_name = settings.smtp_from_name or "Hojaa"

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

            server.login(smtp_username, smtp_password)
            refused = server.sendmail(from_email, [email], msg.as_string())
            server.quit()
            if refused:
                err = f"Server refused recipient(s): {refused}"
                logger.error(f"SMTP sendmail refused: {refused}")
                return False, err

        logger.info(f"SMTP: sent email to {len(to_emails)} recipient(s): {subject[:60]}")
        return True, ""
    except smtplib.SMTPAuthenticationError as exc:
        logger.error(f"SMTP auth failed (check App Password): {exc}")
        return False, f"SMTP authentication failed: {exc}"
    except smtplib.SMTPException as exc:
        logger.error(f"SMTP error: {exc}")
        return False, f"SMTP error: {exc}"
    except Exception as exc:
        logger.error(f"Failed to send email: {exc}")
        return False, f"Email send failed: {exc}"


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
    # Hojaa-branded email wrapper
    # ------------------------------------------------------------------

    @staticmethod
    def _hojaa_email_wrap(title: str, body_html: str) -> str:
        """
        Wrap *body_html* in a consistent Hojaa-branded email shell.

        Layout:
          - Dark (#060606) header bar with "Hojaa" in white (#ffffff)
          - A title banner row in neon lime with dark text
          - White card body for the actual content
          - Dark (#111111) footer with muted text
        """
        return f"""\
<div style="font-family:'Segoe UI',Roboto,Arial,sans-serif;max-width:600px;margin:0 auto;background:#F4F4F5;">
  <!-- Header -->
  <div style="background:#060606;padding:20px 28px;text-align:left;">
    <table cellpadding="0" cellspacing="0" border="0"><tr>
      <td style="vertical-align:middle;padding-right:12px;">
        <img src="data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHZpZXdCb3g9IjAgMCA1NiA1NiIgd2lkdGg9IjM2IiBoZWlnaHQ9IjM2Ij48ZGVmcz48bGluZWFyR3JhZGllbnQgaWQ9ImciIHgxPSIwJSIgeTE9IjAlIiB4Mj0iMTAwJSIgeTI9IjEwMCUiPjxzdG9wIG9mZnNldD0iMCUiIHN0b3AtY29sb3I9IiNFNEZGMUEiLz48c3RvcCBvZmZzZXQ9IjEwMCUiIHN0b3AtY29sb3I9IiNjOGU2MDAiLz48L2xpbmVhckdyYWRpZW50PjwvZGVmcz48cmVjdCB3aWR0aD0iNTYiIGhlaWdodD0iNTYiIHJ4PSIxNCIgZmlsbD0idXJsKCNnKSIgdHJhbnNmb3JtPSJyb3RhdGUoLTMgMjggMjgpIi8+PGNpcmNsZSBjeD0iMzQiIGN5PSIyMCIgcj0iMTAiIGZpbGw9Im5vbmUiIHN0cm9rZT0iIzExMSIgc3Ryb2tlLXdpZHRoPSIyLjUiLz48ZyB0cmFuc2Zvcm09InRyYW5zbGF0ZSg5LCAxNCkiPjxwYXRoIGQ9Ik0zIDhoMTVNMTIgMmw2IDYtNiA2IiBzdHJva2U9IiMxMTEiIHN0cm9rZS13aWR0aD0iMi41IiBmaWxsPSJub25lIiBzdHJva2UtbGluZWNhcD0icm91bmQiIHN0cm9rZS1saW5lam9pbj0icm91bmQiLz48L2c+PHBvbHlnb24gcG9pbnRzPSIwLC02IC03LDYgNyw2IiB0cmFuc2Zvcm09InRyYW5zbGF0ZSgxOCwzNikgcm90YXRlKC0xNSkiIGZpbGw9IiMxMTEiLz48L3N2Zz4=" alt="Hojaa" width="36" height="36" style="display:block;" />
      </td>
      <td style="vertical-align:middle;">
        <span style="font-size:22px;font-weight:700;letter-spacing:1px;color:#ffffff;">Hojaa</span>
      </td>
    </tr></table>
  </div>

  <!-- Title banner -->
  <div style="background:#E4FF1A;padding:18px 28px;">
    <h2 style="margin:0;font-size:18px;font-weight:700;color:#060606;">{title}</h2>
  </div>

  <!-- Body card -->
  <div style="background:#ffffff;padding:28px;border-left:1px solid #E5E7EB;border-right:1px solid #E5E7EB;">
    {body_html}
  </div>

  <!-- Footer -->
  <div style="background:#111111;padding:20px 28px;text-align:center;">
    <p style="margin:0 0 4px;font-size:11px;color:#888888;">
      You received this email because of your notification settings in
      <span style="color:#ffffff;font-weight:600;">Hojaa</span>.
    </p>
    <p style="margin:0;font-size:11px;color:#555555;">
      &copy; {__import__('datetime').date.today().year} Hojaa &mdash; Requirements, reimagined.
    </p>
  </div>
</div>"""

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
            '<table style="border-collapse:collapse;margin-top:16px;width:100%;'
            'border:1px solid #E5E7EB;border-radius:6px;overflow:hidden;">'
            + ''.join(rows)
            + '</table>'
            if rows else ""
        )

        body = f"""\
<p style="margin:0 0 10px;color:#6B7280;font-size:14px;line-height:1.6;">
  <b style="color:#374151;">Session:</b> {session_name}
</p>
<p style="margin:0 0 10px;color:#6B7280;font-size:14px;line-height:1.6;">
  <b style="color:#374151;">Requirement:</b>
  <span style="color:#E4FF1A;background:#060606;padding:2px 8px;border-radius:4px;font-weight:600;">{node_question}</span>
</p>
<p style="margin:0 0 16px;color:#6B7280;font-size:14px;line-height:1.6;">
  <b style="color:#374151;">Changed by:</b> {changed_by_name}
</p>
{detail_table}"""

        return self._hojaa_email_wrap(title, body)

    def send_email(
        self,
        subject: str,
        html_content: str,
        recipient_emails: List[str],
    ) -> Tuple[bool, str]:
        """
        Send an email via SMTP to the specified recipients (synchronous).
        Returns (True, "") on success, or (False, reason) on failure.
        """
        if not settings.smtp_enabled:
            logger.warning("SMTP is disabled — email not sent (set SMTP_ENABLED=true)")
            return False, "SMTP is disabled on the server (set SMTP_ENABLED=true)"
        return _send_email_sync(recipient_emails, subject, html_content)

    async def send_email_async(
        self,
        subject: str,
        html_content: str,
        recipient_emails: List[str],
    ) -> Tuple[bool, str]:
        """Non-blocking email send via SMTP (runs in thread pool)."""
        if not settings.smtp_enabled:
            logger.warning("SMTP is disabled — email not sent (set SMTP_ENABLED=true)")
            return False, "SMTP is disabled on the server (set SMTP_ENABLED=true)"
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

        subject = f"[Hojaa] Requirement {change_type}: {node_question[:80]}"
        html = self._build_change_html(
            change_type=change_type,
            node_question=node_question,
            field_changed=field_changed,
            old_value=old_value,
            new_value=new_value,
            changed_by_name=changed_by_name,
            session_name=session_name,
        )

        success, _ = self.send_email(subject, html, recipient_emails)
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

        subject = f"[Hojaa] New source ingested: {source_name[:80]}"
        body = f"""\
<p style="margin:0 0 10px;color:#6B7280;font-size:14px;line-height:1.6;">
  <b style="color:#374151;">Session:</b> {session_name}
</p>
<p style="margin:0 0 10px;color:#6B7280;font-size:14px;line-height:1.6;">
  <b style="color:#374151;">Source:</b> {source_name}
</p>
<div style="margin:16px 0;padding:14px 18px;background:#F9FAFB;border-left:4px solid #E4FF1A;border-radius:4px;">
  <span style="font-size:24px;font-weight:700;color:#060606;">{suggestions_count}</span>
  <span style="font-size:13px;color:#6B7280;margin-left:8px;">suggestions generated</span>
</div>"""
        html = self._hojaa_email_wrap("New Source Ingested", body)

        success, _ = self.send_email(subject, html, recipient_emails)
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

        subject = f"[Hojaa] You were assigned: {card_title[:60]}"
        body = f"""\
<p style="margin:0 0 14px;color:#374151;font-size:15px;line-height:1.5;">
  Hi <b>{team_member.name}</b>,
</p>
<p style="margin:0 0 18px;color:#6B7280;font-size:14px;line-height:1.6;">
  <b style="color:#374151;">{assigner_name}</b> assigned you to a planning card.
</p>

<!-- Card detail box -->
<div style="background:#F9FAFB;border:1px solid #E5E7EB;border-radius:8px;overflow:hidden;margin-bottom:8px;">
  <div style="background:#060606;padding:14px 18px;">
    <span style="color:#E4FF1A;font-size:15px;font-weight:700;">{card_title}</span>
  </div>
  <div style="padding:14px 18px;">
    <table style="border-collapse:collapse;width:100%;font-size:14px;color:#374151;">
      <tr>
        <td style="padding:6px 0;font-weight:600;width:90px;color:#6B7280;">Session</td>
        <td style="padding:6px 0;">{session_name}</td>
      </tr>
      <tr>
        <td style="padding:6px 0;font-weight:600;width:90px;color:#6B7280;">Role</td>
        <td style="padding:6px 0;">
          <span style="background:#E4FF1A;color:#060606;padding:2px 10px;border-radius:12px;font-size:12px;font-weight:700;">Assignee</span>
        </td>
      </tr>
    </table>
  </div>
</div>"""
        html = self._hojaa_email_wrap("Card Assignment", body)

        success, _ = self.send_email(subject, html, [team_member.email])
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
                subject = f"[Hojaa] New team member: {member_name}"
                team_body = f"""\
<p style="margin:0 0 10px;color:#6B7280;font-size:14px;line-height:1.6;">
  <b style="color:#374151;">Session:</b> {session_name}
</p>
<div style="background:#F9FAFB;border:1px solid #E5E7EB;border-radius:8px;padding:16px 18px;margin:12px 0;">
  <table style="border-collapse:collapse;width:100%;font-size:14px;color:#374151;">
    <tr>
      <td style="padding:5px 0;font-weight:600;width:90px;color:#6B7280;">Name</td>
      <td style="padding:5px 0;font-weight:700;">{member_name}</td>
    </tr>
    <tr>
      <td style="padding:5px 0;font-weight:600;width:90px;color:#6B7280;">Role</td>
      <td style="padding:5px 0;">
        <span style="background:#E4FF1A;color:#060606;padding:2px 10px;border-radius:12px;font-size:12px;font-weight:700;">{member_role}</span>
      </td>
    </tr>
    <tr>
      <td style="padding:5px 0;font-weight:600;width:90px;color:#6B7280;">Added by</td>
      <td style="padding:5px 0;">{adder_name}</td>
    </tr>
  </table>
</div>"""
                html = self._hojaa_email_wrap("New Team Member", team_body)
                if self.send_email(subject, html, recipient_emails)[0]:
                    notified = len(recipient_emails)

        # 2. Send welcome email to the new team member (if they have an email)
        if member_email and member_email.strip():
            welcome_subject = f"[Hojaa] Welcome to {session_name}"
            welcome_body = f"""\
<p style="margin:0 0 14px;color:#374151;font-size:15px;line-height:1.5;">
  Hi <b>{member_name}</b>,
</p>
<p style="margin:0 0 10px;color:#6B7280;font-size:14px;line-height:1.6;">
  <b style="color:#374151;">{adder_name}</b> added you to the project
  <b style="color:#374151;">{session_name}</b> as
  <span style="background:#E4FF1A;color:#060606;padding:2px 10px;border-radius:12px;font-size:12px;font-weight:700;">{member_role}</span>.
</p>
<p style="margin:0;color:#6B7280;font-size:14px;line-height:1.6;">
  You may receive card assignment notifications when tasks are assigned to you.
</p>"""
            welcome_html = self._hojaa_email_wrap("Welcome to the Team!", welcome_body)
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

        smtp_pw = (settings.smtp_password or "").replace(" ", "").strip()

        try:
            if settings.smtp_use_tls:
                server = smtplib.SMTP(settings.smtp_host, settings.smtp_port, timeout=10)
                server.ehlo()
                server.starttls()
                server.ehlo()
            else:
                server = smtplib.SMTP_SSL(settings.smtp_host, settings.smtp_port, timeout=10)

            server.login(settings.smtp_username.strip(), smtp_pw)
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
