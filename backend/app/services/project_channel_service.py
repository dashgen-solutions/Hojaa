"""
Project ↔ Messaging-Channel sync service.

Automatically creates a group chat channel for each project and keeps
the channel membership in sync when:
  • a project is created  → create linked channel, add owner
  • session is shared     → add shared user to channel
  • session share revoked → remove user from channel
  • team member added     → if email matches a registered user, add to channel
  • team member removed   → if email matches a registered user, remove from channel
  • project renamed       → rename the linked channel
"""
from __future__ import annotations

from typing import Optional
from uuid import UUID, uuid4

from sqlalchemy.orm import Session as DBSessionType

from app.models.database import (
    Session as DBSession,
    ChatChannel,
    ChatChannelMember,
    User,
)
from app.core.logger import get_logger

logger = get_logger(__name__)


# ── helpers ──────────────────────────────────────────────────────────

def _get_project_channel(db: DBSessionType, session_id: UUID) -> Optional[ChatChannel]:
    """Return the ChatChannel linked to a project, or None."""
    return (
        db.query(ChatChannel)
        .filter(ChatChannel.session_id == session_id, ChatChannel.is_direct == False)
        .first()
    )


def _is_channel_member(db: DBSessionType, channel_id: UUID, user_id: UUID) -> bool:
    return (
        db.query(ChatChannelMember)
        .filter(
            ChatChannelMember.channel_id == channel_id,
            ChatChannelMember.user_id == user_id,
        )
        .first()
    ) is not None


def _add_channel_member(db: DBSessionType, channel_id: UUID, user_id: UUID) -> None:
    if _is_channel_member(db, channel_id, user_id):
        return
    db.add(ChatChannelMember(channel_id=channel_id, user_id=user_id))


def _remove_channel_member(db: DBSessionType, channel_id: UUID, user_id: UUID) -> None:
    member = (
        db.query(ChatChannelMember)
        .filter(
            ChatChannelMember.channel_id == channel_id,
            ChatChannelMember.user_id == user_id,
        )
        .first()
    )
    if member:
        db.delete(member)


def _resolve_email_to_user(db: DBSessionType, email: Optional[str]) -> Optional[User]:
    """Look up a registered User by email (case-insensitive)."""
    if not email:
        return None
    return db.query(User).filter(User.email == email.strip().lower()).first()


# ── public API ───────────────────────────────────────────────────────

def create_project_channel(
    db: DBSessionType,
    session: DBSession,
    creator_id: UUID,
) -> ChatChannel:
    """Create a group chat channel linked to a project and add the creator."""
    channel_name = session.document_filename or "Untitled"
    channel = ChatChannel(
        id=uuid4(),
        name=channel_name,
        is_direct=False,
        topic=f"Project channel for {channel_name}",
        description="Auto-created project group",
        organization_id=session.organization_id,
        created_by=creator_id,
        session_id=session.id,
    )
    db.add(channel)
    db.flush()  # get channel.id

    # Add creator as first member
    db.add(ChatChannelMember(channel_id=channel.id, user_id=creator_id))
    logger.info(f"Created project channel '{channel_name}' for session {session.id}")
    return channel


def sync_shared_user(
    db: DBSessionType,
    session_id: UUID,
    user_id: UUID,
    *,
    remove: bool = False,
) -> None:
    """Add or remove a shared user from the project's channel."""
    channel = _get_project_channel(db, session_id)
    if not channel:
        return
    if remove:
        _remove_channel_member(db, channel.id, user_id)
        logger.info(f"Removed user {user_id} from project channel {channel.id}")
    else:
        _add_channel_member(db, channel.id, user_id)
        logger.info(f"Added user {user_id} to project channel {channel.id}")


def sync_team_member(
    db: DBSessionType,
    session_id: UUID,
    email: Optional[str],
    *,
    remove: bool = False,
) -> None:
    """Sync a team member to the project channel by resolving their email
    to a registered User.  No-op if email is None or unresolvable."""
    user = _resolve_email_to_user(db, email)
    if not user:
        return
    sync_shared_user(db, session_id, user.id, remove=remove)


def rename_project_channel(
    db: DBSessionType,
    session_id: UUID,
    new_name: str,
) -> None:
    """Rename the linked channel when the project is renamed."""
    channel = _get_project_channel(db, session_id)
    if not channel:
        return
    channel.name = new_name
    channel.topic = f"Project channel for {new_name}"
    logger.info(f"Renamed project channel {channel.id} to '{new_name}'")
