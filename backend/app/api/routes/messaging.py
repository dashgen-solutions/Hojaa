"""
Global Messaging API — Slack-like team communication.

REST endpoints for channels, messages, members, reactions, threads, pins, search.
WebSocket endpoint for real-time delivery with presence tracking.
"""
from __future__ import annotations

import asyncio
import json
import re
from datetime import datetime
from typing import List, Optional
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, WebSocket, WebSocketDisconnect, Query, status
from jose import JWTError, jwt
from pydantic import BaseModel, Field
from sqlalchemy import func, and_, or_, desc, asc
from sqlalchemy.orm import Session, joinedload

from app.core.auth import get_current_user
from app.core.config import settings
from app.core.logger import get_logger
from app.db.session import get_db, SessionLocal
from app.models.database import (
    User, ChatChannel, ChatChannelMember, ChatChannelMessage,
    MessageReaction, MessageAttachment, PinnedMessage,
)
from app.services.messaging_ws_manager import messaging_ws_manager

logger = get_logger(__name__)
router = APIRouter(prefix="/messaging", tags=["messaging"])

ALGORITHM = "HS256"


# ── Pydantic Schemas ──────────────────────────────────────────────────

class CreateChannelRequest(BaseModel):
    name: Optional[str] = None
    is_direct: bool = False
    member_ids: List[str]  # user UUIDs to add
    topic: Optional[str] = None
    description: Optional[str] = None


class SendMessageRequest(BaseModel):
    content: str = Field(..., min_length=1, max_length=10000)
    reference_type: Optional[str] = None  # "project" | "node" | "card"
    reference_id: Optional[str] = None
    reference_name: Optional[str] = None
    parent_message_id: Optional[str] = None  # for thread replies
    mentions: Optional[List[str]] = None  # list of user_ids mentioned with @


class EditMessageRequest(BaseModel):
    content: str = Field(..., min_length=1, max_length=10000)


class UpdateChannelRequest(BaseModel):
    name: Optional[str] = Field(None, min_length=1, max_length=255)
    topic: Optional[str] = Field(None, max_length=500)
    description: Optional[str] = None


class AddMemberRequest(BaseModel):
    user_id: str


class ReactionRequest(BaseModel):
    emoji: str = Field(..., min_length=1, max_length=50)


# ── Helper: Serialize ─────────────────────────────────────────────────

def _serialize_reactions(reactions: list) -> list:
    """Group reactions by emoji with user info."""
    grouped = {}
    for r in reactions:
        if r.emoji not in grouped:
            grouped[r.emoji] = {"emoji": r.emoji, "count": 0, "users": []}
        grouped[r.emoji]["count"] += 1
        grouped[r.emoji]["users"].append({
            "user_id": str(r.user_id),
            "username": r.user.username if r.user else "Unknown",
        })
    return list(grouped.values())


def _serialize_message(msg: ChatChannelMessage, include_reactions: bool = True) -> dict:
    result = {
        "id": str(msg.id),
        "channel_id": str(msg.channel_id),
        "sender_id": str(msg.sender_id) if msg.sender_id else None,
        "sender_name": msg.sender.username if msg.sender else "Unknown",
        "content": msg.content,
        "reference_type": msg.reference_type,
        "reference_id": msg.reference_id,
        "reference_name": msg.reference_name,
        "is_edited": msg.is_edited,
        "is_pinned": msg.is_pinned,
        "parent_message_id": str(msg.parent_message_id) if msg.parent_message_id else None,
        "thread_reply_count": msg.thread_reply_count,
        "created_at": msg.created_at.isoformat(),
    }
    if include_reactions and hasattr(msg, "reactions") and msg.reactions is not None:
        result["reactions"] = _serialize_reactions(msg.reactions)
    else:
        result["reactions"] = []
    if hasattr(msg, "attachments") and msg.attachments:
        result["attachments"] = [
            {
                "id": str(a.id),
                "file_name": a.file_name,
                "file_url": a.file_url,
                "file_type": a.file_type,
                "file_size": a.file_size,
            }
            for a in msg.attachments
        ]
    else:
        result["attachments"] = []
    # Extract @mentions from content
    result["mentions"] = re.findall(r"@\[([^\]]+)\]\(([^)]+)\)", msg.content)
    return result


def _serialize_member(member: ChatChannelMember) -> dict:
    return {
        "user_id": str(member.user_id),
        "username": member.user.username if member.user else "Unknown",
        "email": member.user.email if member.user else "",
        "joined_at": member.joined_at.isoformat(),
        "is_online": messaging_ws_manager.is_user_online(str(member.user_id)),
    }


def _get_unread_count(db: Session, channel_id: UUID, user_id: UUID) -> int:
    """Count messages newer than the member's last_read_at."""
    member = (
        db.query(ChatChannelMember)
        .filter_by(channel_id=channel_id, user_id=user_id)
        .first()
    )
    if not member:
        return 0

    query = db.query(func.count(ChatChannelMessage.id)).filter(
        ChatChannelMessage.channel_id == channel_id,
        ChatChannelMessage.sender_id != user_id,  # don't count own messages
    )
    if member.last_read_at:
        query = query.filter(ChatChannelMessage.created_at > member.last_read_at)
    return query.scalar() or 0


# ── Channels ──────────────────────────────────────────────────────────

@router.get("/channels")
def list_channels(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """List all channels the current user belongs to, sorted by most recent message."""
    # Get channel IDs user is a member of
    memberships = (
        db.query(ChatChannelMember)
        .filter(ChatChannelMember.user_id == current_user.id)
        .all()
    )
    channel_ids = [m.channel_id for m in memberships]

    if not channel_ids:
        return []

    # Get channels with eager-loaded members
    channels = (
        db.query(ChatChannel)
        .filter(ChatChannel.id.in_(channel_ids))
        .options(joinedload(ChatChannel.members).joinedload(ChatChannelMember.user))
        .all()
    )

    # Build response with last_message and unread_count
    result = []
    for ch in channels:
        # Last message
        last_msg = (
            db.query(ChatChannelMessage)
            .filter(ChatChannelMessage.channel_id == ch.id)
            .order_by(desc(ChatChannelMessage.created_at))
            .first()
        )

        unread = _get_unread_count(db, ch.id, current_user.id)

        # For DMs, determine the other user's info
        other_user = None
        if ch.is_direct:
            for m in ch.members:
                if m.user_id != current_user.id:
                    other_user = {
                        "user_id": str(m.user_id),
                        "username": m.user.username if m.user else "Unknown",
                    }
                    break

        result.append({
            "id": str(ch.id),
            "name": ch.name,
            "is_direct": ch.is_direct,
            "topic": ch.topic,
            "description": ch.description,
            "other_user": other_user,
            "members": [_serialize_member(m) for m in ch.members],
            "member_count": len(ch.members),
            "last_message": {
                "content": last_msg.content[:100] if last_msg else None,
                "sender_name": last_msg.sender.username if last_msg and last_msg.sender else None,
                "created_at": last_msg.created_at.isoformat() if last_msg else None,
            } if last_msg else None,
            "unread_count": unread,
            "created_at": ch.created_at.isoformat(),
        })

    # Sort by last message time (most recent first)
    result.sort(
        key=lambda c: c["last_message"]["created_at"] if c["last_message"] else c["created_at"],
        reverse=True,
    )
    return result


@router.post("/channels", status_code=201)
def create_channel(
    body: CreateChannelRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Create a new channel (DM or group)."""
    if body.is_direct:
        # DM must have exactly one other member
        if len(body.member_ids) != 1:
            raise HTTPException(400, "DM channels require exactly one other member")

        other_id = UUID(body.member_ids[0])

        # Check if DM already exists between these two users
        existing = (
            db.query(ChatChannel)
            .join(ChatChannelMember, ChatChannel.id == ChatChannelMember.channel_id)
            .filter(
                ChatChannel.is_direct == True,
                ChatChannelMember.user_id.in_([current_user.id, other_id]),
            )
            .group_by(ChatChannel.id)
            .having(func.count(ChatChannelMember.id) == 2)
            .first()
        )

        if existing:
            # Verify both users are in this channel
            member_ids_in_ch = {
                str(m.user_id)
                for m in db.query(ChatChannelMember)
                .filter(ChatChannelMember.channel_id == existing.id)
                .all()
            }
            if str(current_user.id) in member_ids_in_ch and str(other_id) in member_ids_in_ch:
                return {"id": str(existing.id), "is_direct": True, "already_exists": True}

    elif not body.name:
        raise HTTPException(400, "Group channels require a name")

    # Create channel
    channel = ChatChannel(
        name=body.name if not body.is_direct else None,
        is_direct=body.is_direct,
        topic=body.topic if not body.is_direct else None,
        description=body.description if not body.is_direct else None,
        organization_id=current_user.organization_id,
        created_by=current_user.id,
    )
    db.add(channel)
    db.flush()

    # Add creator as member
    db.add(ChatChannelMember(channel_id=channel.id, user_id=current_user.id))

    # Add other members
    for uid_str in body.member_ids:
        uid = UUID(uid_str)
        if uid == current_user.id:
            continue  # skip self
        # Verify user exists and is in same org
        user = db.query(User).filter(User.id == uid, User.is_active == True).first()
        if not user:
            raise HTTPException(400, f"User {uid_str} not found")
        db.add(ChatChannelMember(channel_id=channel.id, user_id=uid))

    db.commit()
    db.refresh(channel)

    return {
        "id": str(channel.id),
        "name": channel.name,
        "is_direct": channel.is_direct,
        "topic": channel.topic,
        "description": channel.description,
    }


@router.get("/channels/{channel_id}")
def get_channel(
    channel_id: str,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Get channel details + members."""
    ch = db.query(ChatChannel).filter(ChatChannel.id == channel_id).first()
    if not ch:
        raise HTTPException(404, "Channel not found")

    # Verify membership
    membership = (
        db.query(ChatChannelMember)
        .filter_by(channel_id=ch.id, user_id=current_user.id)
        .first()
    )
    if not membership:
        raise HTTPException(403, "You are not a member of this channel")

    members = (
        db.query(ChatChannelMember)
        .filter(ChatChannelMember.channel_id == ch.id)
        .options(joinedload(ChatChannelMember.user))
        .all()
    )

    return {
        "id": str(ch.id),
        "name": ch.name,
        "is_direct": ch.is_direct,
        "topic": ch.topic,
        "description": ch.description,
        "created_by": str(ch.created_by) if ch.created_by else None,
        "members": [_serialize_member(m) for m in members],
        "created_at": ch.created_at.isoformat(),
    }


@router.patch("/channels/{channel_id}")
def update_channel(
    channel_id: str,
    body: UpdateChannelRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Update channel name (groups only)."""
    ch = db.query(ChatChannel).filter(ChatChannel.id == channel_id).first()
    if not ch:
        raise HTTPException(404, "Channel not found")
    if ch.is_direct and body.name:
        raise HTTPException(400, "Cannot rename DM channels")

    membership = (
        db.query(ChatChannelMember)
        .filter_by(channel_id=ch.id, user_id=current_user.id)
        .first()
    )
    if not membership:
        raise HTTPException(403, "You are not a member of this channel")

    if body.name is not None:
        ch.name = body.name
    if body.topic is not None:
        ch.topic = body.topic
    if body.description is not None:
        ch.description = body.description
    db.commit()

    # Broadcast channel update via WS
    import asyncio
    try:
        asyncio.get_event_loop().create_task(
            messaging_ws_manager.send_to_channel_members(
                channel_id, {
                    "type": "channel_update",
                    "channel_id": channel_id,
                    "name": body.name,
                    "action": "renamed",
                },
                exclude_user=str(current_user.id),
            )
        )
    except Exception:
        pass

    return {
        "id": str(ch.id),
        "name": ch.name,
        "topic": ch.topic,
        "description": ch.description,
    }


@router.delete("/channels/{channel_id}", status_code=204)
def delete_channel(
    channel_id: str,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Delete a channel (creator only)."""
    ch = db.query(ChatChannel).filter(ChatChannel.id == channel_id).first()
    if not ch:
        raise HTTPException(404, "Channel not found")
    if ch.created_by != current_user.id:
        raise HTTPException(403, "Only the channel creator can delete it")

    db.delete(ch)
    db.commit()


# ── Channel Members ───────────────────────────────────────────────────

@router.post("/channels/{channel_id}/members", status_code=201)
def add_channel_member(
    channel_id: str,
    body: AddMemberRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Add a member to a group channel."""
    ch = db.query(ChatChannel).filter(ChatChannel.id == channel_id).first()
    if not ch:
        raise HTTPException(404, "Channel not found")
    if ch.is_direct:
        raise HTTPException(400, "Cannot add members to DM channels")

    # Verify requester is a member
    membership = (
        db.query(ChatChannelMember)
        .filter_by(channel_id=ch.id, user_id=current_user.id)
        .first()
    )
    if not membership:
        raise HTTPException(403, "You are not a member of this channel")

    target_uid = UUID(body.user_id)
    # Check not already a member
    existing = (
        db.query(ChatChannelMember)
        .filter_by(channel_id=ch.id, user_id=target_uid)
        .first()
    )
    if existing:
        raise HTTPException(400, "User is already a member")

    user = db.query(User).filter(User.id == target_uid, User.is_active == True).first()
    if not user:
        raise HTTPException(404, "User not found")

    db.add(ChatChannelMember(channel_id=ch.id, user_id=target_uid))
    db.commit()

    # Broadcast
    import asyncio
    try:
        asyncio.get_event_loop().create_task(
            messaging_ws_manager.send_to_channel_members(
                channel_id, {
                    "type": "channel_update",
                    "channel_id": channel_id,
                    "action": "member_added",
                    "user_id": str(target_uid),
                    "username": user.username,
                },
            )
        )
    except Exception:
        pass

    return {"status": "added"}


@router.delete("/channels/{channel_id}/members/{user_id}", status_code=204)
def remove_channel_member(
    channel_id: str,
    user_id: str,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Remove a member from a group channel, or leave the channel."""
    ch = db.query(ChatChannel).filter(ChatChannel.id == channel_id).first()
    if not ch:
        raise HTTPException(404, "Channel not found")
    if ch.is_direct:
        raise HTTPException(400, "Cannot remove members from DM channels")

    target_uid = UUID(user_id)
    # Either removing self (leaving) or creator removing someone
    if target_uid != current_user.id and ch.created_by != current_user.id:
        raise HTTPException(403, "Only the channel creator can remove members")

    member = (
        db.query(ChatChannelMember)
        .filter_by(channel_id=ch.id, user_id=target_uid)
        .first()
    )
    if not member:
        raise HTTPException(404, "Member not found in channel")

    db.delete(member)
    db.commit()


# ── Messages ──────────────────────────────────────────────────────────

@router.get("/channels/{channel_id}/messages")
def get_messages(
    channel_id: str,
    limit: int = Query(50, ge=1, le=100),
    before: Optional[str] = Query(None),  # ISO timestamp for pagination
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Get paginated messages for a channel (newest first)."""
    # Verify membership
    membership = (
        db.query(ChatChannelMember)
        .filter_by(channel_id=channel_id, user_id=current_user.id)
        .first()
    )
    if not membership:
        raise HTTPException(403, "You are not a member of this channel")

    query = (
        db.query(ChatChannelMessage)
        .filter(ChatChannelMessage.channel_id == channel_id)
        .filter(ChatChannelMessage.parent_message_id == None)  # exclude thread replies from main view
        .options(
            joinedload(ChatChannelMessage.sender),
            joinedload(ChatChannelMessage.reactions).joinedload(MessageReaction.user),
            joinedload(ChatChannelMessage.attachments),
        )
    )

    if before:
        try:
            before_dt = datetime.fromisoformat(before)
            query = query.filter(ChatChannelMessage.created_at < before_dt)
        except ValueError:
            pass

    messages = query.order_by(desc(ChatChannelMessage.created_at)).limit(limit).all()

    # Return in chronological order (oldest first)
    messages.reverse()
    return [_serialize_message(m) for m in messages]


@router.post("/channels/{channel_id}/messages", status_code=201)
def send_message(
    channel_id: str,
    body: SendMessageRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Send a message to a channel."""
    # Verify membership
    membership = (
        db.query(ChatChannelMember)
        .filter_by(channel_id=channel_id, user_id=current_user.id)
        .first()
    )
    if not membership:
        raise HTTPException(403, "You are not a member of this channel")

    msg = ChatChannelMessage(
        channel_id=UUID(channel_id),
        sender_id=current_user.id,
        content=body.content,
        reference_type=body.reference_type,
        reference_id=body.reference_id,
        reference_name=body.reference_name,
        parent_message_id=UUID(body.parent_message_id) if body.parent_message_id else None,
    )
    db.add(msg)

    # If this is a thread reply, increment the parent's thread_reply_count
    if body.parent_message_id:
        parent = db.query(ChatChannelMessage).filter(
            ChatChannelMessage.id == body.parent_message_id
        ).first()
        if parent:
            parent.thread_reply_count = (parent.thread_reply_count or 0) + 1

    # Update sender's last_read_at
    membership.last_read_at = datetime.utcnow()

    db.commit()
    db.refresh(msg)

    serialized = _serialize_message(msg)

    # Broadcast via WebSocket
    import asyncio
    ws_event_type = "thread_reply" if body.parent_message_id else "new_message"
    try:
        asyncio.get_event_loop().create_task(
            messaging_ws_manager.send_to_channel_members(
                channel_id,
                {"type": ws_event_type, "channel_id": channel_id, "message": serialized},
                exclude_user=str(current_user.id),
            )
        )
    except Exception:
        pass

    return serialized


@router.patch("/messages/{message_id}")
def edit_message(
    message_id: str,
    body: EditMessageRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Edit own message."""
    msg = db.query(ChatChannelMessage).filter(ChatChannelMessage.id == message_id).first()
    if not msg:
        raise HTTPException(404, "Message not found")
    if msg.sender_id != current_user.id:
        raise HTTPException(403, "You can only edit your own messages")

    msg.content = body.content
    msg.is_edited = True
    db.commit()
    db.refresh(msg)

    serialized = _serialize_message(msg)

    # Broadcast edit
    import asyncio
    try:
        asyncio.get_event_loop().create_task(
            messaging_ws_manager.send_to_channel_members(
                str(msg.channel_id),
                {"type": "message_edited", "channel_id": str(msg.channel_id), "message": serialized},
                exclude_user=str(current_user.id),
            )
        )
    except Exception:
        pass

    return serialized


@router.delete("/messages/{message_id}", status_code=204)
def delete_message(
    message_id: str,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Delete own message."""
    msg = db.query(ChatChannelMessage).filter(ChatChannelMessage.id == message_id).first()
    if not msg:
        raise HTTPException(404, "Message not found")
    if msg.sender_id != current_user.id:
        raise HTTPException(403, "You can only delete your own messages")

    channel_id = str(msg.channel_id)
    msg_id = str(msg.id)

    db.delete(msg)
    db.commit()

    # Broadcast deletion
    import asyncio
    try:
        asyncio.get_event_loop().create_task(
            messaging_ws_manager.send_to_channel_members(
                channel_id,
                {"type": "message_deleted", "channel_id": channel_id, "message_id": msg_id},
                exclude_user=str(current_user.id),
            )
        )
    except Exception:
        pass


# ── Reactions ─────────────────────────────────────────────────────────

@router.post("/messages/{message_id}/reactions", status_code=201)
def add_reaction(
    message_id: str,
    body: ReactionRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Add an emoji reaction to a message."""
    msg = db.query(ChatChannelMessage).filter(ChatChannelMessage.id == message_id).first()
    if not msg:
        raise HTTPException(404, "Message not found")

    # Verify membership
    membership = (
        db.query(ChatChannelMember)
        .filter_by(channel_id=msg.channel_id, user_id=current_user.id)
        .first()
    )
    if not membership:
        raise HTTPException(403, "You are not a member of this channel")

    # Check if already reacted with same emoji
    existing = (
        db.query(MessageReaction)
        .filter_by(message_id=msg.id, user_id=current_user.id, emoji=body.emoji)
        .first()
    )
    if existing:
        raise HTTPException(400, "You already reacted with this emoji")

    reaction = MessageReaction(
        message_id=msg.id,
        user_id=current_user.id,
        emoji=body.emoji,
    )
    db.add(reaction)
    db.commit()

    # Broadcast reaction via WebSocket
    try:
        asyncio.get_event_loop().create_task(
            messaging_ws_manager.send_to_channel_members(
                str(msg.channel_id),
                {
                    "type": "reaction_added",
                    "channel_id": str(msg.channel_id),
                    "message_id": message_id,
                    "emoji": body.emoji,
                    "user_id": str(current_user.id),
                    "username": current_user.username,
                },
            )
        )
    except Exception:
        pass

    return {"status": "added", "emoji": body.emoji}


@router.delete("/messages/{message_id}/reactions/{emoji}")
def remove_reaction(
    message_id: str,
    emoji: str,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Remove an emoji reaction from a message."""
    reaction = (
        db.query(MessageReaction)
        .filter_by(message_id=UUID(message_id), user_id=current_user.id, emoji=emoji)
        .first()
    )
    if not reaction:
        raise HTTPException(404, "Reaction not found")

    channel_id = str(
        db.query(ChatChannelMessage.channel_id)
        .filter(ChatChannelMessage.id == message_id)
        .scalar()
    )

    db.delete(reaction)
    db.commit()

    # Broadcast reaction removal
    try:
        asyncio.get_event_loop().create_task(
            messaging_ws_manager.send_to_channel_members(
                channel_id,
                {
                    "type": "reaction_removed",
                    "channel_id": channel_id,
                    "message_id": message_id,
                    "emoji": emoji,
                    "user_id": str(current_user.id),
                },
            )
        )
    except Exception:
        pass

    return {"status": "removed"}


@router.get("/messages/{message_id}/reactions")
def get_reactions(
    message_id: str,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Get all reactions on a message, grouped by emoji."""
    reactions = (
        db.query(MessageReaction)
        .filter(MessageReaction.message_id == message_id)
        .options(joinedload(MessageReaction.user))
        .all()
    )
    return _serialize_reactions(reactions)


# ── Thread Replies ────────────────────────────────────────────────────

@router.get("/messages/{message_id}/thread")
def get_thread(
    message_id: str,
    limit: int = Query(50, ge=1, le=100),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Get thread replies for a parent message."""
    parent = (
        db.query(ChatChannelMessage)
        .filter(ChatChannelMessage.id == message_id)
        .options(
            joinedload(ChatChannelMessage.sender),
            joinedload(ChatChannelMessage.reactions).joinedload(MessageReaction.user),
        )
        .first()
    )
    if not parent:
        raise HTTPException(404, "Message not found")

    # Verify membership
    membership = (
        db.query(ChatChannelMember)
        .filter_by(channel_id=parent.channel_id, user_id=current_user.id)
        .first()
    )
    if not membership:
        raise HTTPException(403, "You are not a member of this channel")

    replies = (
        db.query(ChatChannelMessage)
        .filter(ChatChannelMessage.parent_message_id == message_id)
        .options(
            joinedload(ChatChannelMessage.sender),
            joinedload(ChatChannelMessage.reactions).joinedload(MessageReaction.user),
        )
        .order_by(asc(ChatChannelMessage.created_at))
        .limit(limit)
        .all()
    )

    return {
        "parent": _serialize_message(parent),
        "replies": [_serialize_message(r) for r in replies],
        "reply_count": parent.thread_reply_count,
    }


# ── Message Search ────────────────────────────────────────────────────

@router.get("/search")
def search_messages(
    q: str = Query(..., min_length=1, max_length=200),
    channel_id: Optional[str] = Query(None),
    limit: int = Query(20, ge=1, le=50),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Search messages across channels the user belongs to."""
    # Get user's channel IDs
    user_channel_ids = [
        m.channel_id
        for m in db.query(ChatChannelMember)
        .filter(ChatChannelMember.user_id == current_user.id)
        .all()
    ]

    if not user_channel_ids:
        return {"results": [], "total": 0}

    query = (
        db.query(ChatChannelMessage)
        .filter(
            ChatChannelMessage.channel_id.in_(user_channel_ids),
            ChatChannelMessage.content.ilike(f"%{q}%"),
        )
        .options(joinedload(ChatChannelMessage.sender))
    )

    if channel_id:
        query = query.filter(ChatChannelMessage.channel_id == channel_id)

    total = query.count()
    messages = query.order_by(desc(ChatChannelMessage.created_at)).limit(limit).all()

    results = []
    for msg in messages:
        serialized = _serialize_message(msg, include_reactions=False)
        # Add channel info for context
        ch = db.query(ChatChannel).filter(ChatChannel.id == msg.channel_id).first()
        serialized["channel_name"] = ch.name if ch else None
        serialized["is_direct"] = ch.is_direct if ch else False
        results.append(serialized)

    return {"results": results, "total": total}


# ── Pinned Messages ──────────────────────────────────────────────────

@router.post("/messages/{message_id}/pin", status_code=201)
def pin_message(
    message_id: str,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Pin a message in its channel."""
    msg = db.query(ChatChannelMessage).filter(ChatChannelMessage.id == message_id).first()
    if not msg:
        raise HTTPException(404, "Message not found")

    # Verify membership
    membership = (
        db.query(ChatChannelMember)
        .filter_by(channel_id=msg.channel_id, user_id=current_user.id)
        .first()
    )
    if not membership:
        raise HTTPException(403, "You are not a member of this channel")

    # Check if already pinned
    existing = (
        db.query(PinnedMessage)
        .filter_by(channel_id=msg.channel_id, message_id=msg.id)
        .first()
    )
    if existing:
        raise HTTPException(400, "Message is already pinned")

    pin = PinnedMessage(
        channel_id=msg.channel_id,
        message_id=msg.id,
        pinned_by=current_user.id,
    )
    db.add(pin)
    msg.is_pinned = True
    db.commit()

    # Broadcast pin event
    try:
        asyncio.get_event_loop().create_task(
            messaging_ws_manager.send_to_channel_members(
                str(msg.channel_id),
                {
                    "type": "message_pinned",
                    "channel_id": str(msg.channel_id),
                    "message_id": message_id,
                    "pinned_by": current_user.username,
                },
            )
        )
    except Exception:
        pass

    return {"status": "pinned"}


@router.delete("/messages/{message_id}/pin")
def unpin_message(
    message_id: str,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Unpin a message."""
    msg = db.query(ChatChannelMessage).filter(ChatChannelMessage.id == message_id).first()
    if not msg:
        raise HTTPException(404, "Message not found")

    pin = (
        db.query(PinnedMessage)
        .filter_by(channel_id=msg.channel_id, message_id=msg.id)
        .first()
    )
    if not pin:
        raise HTTPException(404, "Message is not pinned")

    db.delete(pin)
    msg.is_pinned = False
    db.commit()

    return {"status": "unpinned"}


@router.get("/channels/{channel_id}/pins")
def get_pinned_messages(
    channel_id: str,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Get all pinned messages in a channel."""
    # Verify membership
    membership = (
        db.query(ChatChannelMember)
        .filter_by(channel_id=channel_id, user_id=current_user.id)
        .first()
    )
    if not membership:
        raise HTTPException(403, "You are not a member of this channel")

    pins = (
        db.query(PinnedMessage)
        .filter(PinnedMessage.channel_id == channel_id)
        .options(
            joinedload(PinnedMessage.message).joinedload(ChatChannelMessage.sender),
            joinedload(PinnedMessage.user),
        )
        .order_by(desc(PinnedMessage.created_at))
        .all()
    )

    return [
        {
            "id": str(p.id),
            "message": _serialize_message(p.message, include_reactions=False) if p.message else None,
            "pinned_by": p.user.username if p.user else "Unknown",
            "pinned_at": p.created_at.isoformat(),
        }
        for p in pins
    ]


# ── @Mention User Search ─────────────────────────────────────────────

@router.get("/channels/{channel_id}/mention-users")
def get_mentionable_users(
    channel_id: str,
    q: str = Query("", max_length=100),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Get users that can be @mentioned in a channel (members of the channel)."""
    membership = (
        db.query(ChatChannelMember)
        .filter_by(channel_id=channel_id, user_id=current_user.id)
        .first()
    )
    if not membership:
        raise HTTPException(403, "You are not a member of this channel")

    query = (
        db.query(User)
        .join(ChatChannelMember, ChatChannelMember.user_id == User.id)
        .filter(
            ChatChannelMember.channel_id == channel_id,
            User.id != current_user.id,
            User.is_active == True,
        )
    )
    if q:
        query = query.filter(
            or_(
                User.username.ilike(f"%{q}%"),
                User.email.ilike(f"%{q}%"),
            )
        )

    users = query.order_by(User.username).limit(10).all()
    return [
        {
            "id": str(u.id),
            "username": u.username,
            "email": u.email,
            "is_online": messaging_ws_manager.is_user_online(str(u.id)),
        }
        for u in users
    ]


# ── User Presence ────────────────────────────────────────────────────

@router.get("/presence")
def get_online_users(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Get online status of users in the same org."""
    query = db.query(User).filter(
        User.is_active == True,
    )
    if current_user.organization_id:
        query = query.filter(User.organization_id == current_user.organization_id)

    users = query.all()
    return [
        {
            "user_id": str(u.id),
            "username": u.username,
            "is_online": messaging_ws_manager.is_user_online(str(u.id)),
        }
        for u in users
    ]


# ── Read Tracking ─────────────────────────────────────────────────────

@router.post("/channels/{channel_id}/read")
def mark_as_read(
    channel_id: str,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Mark a channel as read (updates last_read_at to now)."""
    membership = (
        db.query(ChatChannelMember)
        .filter_by(channel_id=channel_id, user_id=current_user.id)
        .first()
    )
    if not membership:
        raise HTTPException(403, "You are not a member of this channel")

    membership.last_read_at = datetime.utcnow()
    db.commit()
    return {"status": "read"}


# ── Unread Count ──────────────────────────────────────────────────────

@router.get("/unread")
def get_unread_count(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Get total unread message count across all channels."""
    memberships = (
        db.query(ChatChannelMember)
        .filter(ChatChannelMember.user_id == current_user.id)
        .all()
    )

    total = 0
    for m in memberships:
        total += _get_unread_count(db, m.channel_id, current_user.id)

    return {"total": total}


# ── Org Users for Messaging ──────────────────────────────────────────

@router.get("/users")
def list_messaging_users(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """List users in the same org, available for messaging."""
    query = db.query(User).filter(
        User.is_active == True,
        User.id != current_user.id,
    )

    if current_user.organization_id:
        query = query.filter(User.organization_id == current_user.organization_id)

    users = query.order_by(User.username).all()

    return [
        {
            "id": str(u.id),
            "username": u.username,
            "email": u.email,
            "job_title": u.job_title,
        }
        for u in users
    ]


# ── WebSocket Endpoint ───────────────────────────────────────────────

def _authenticate_messaging_ws(token: str) -> dict | None:
    """Validate JWT for messaging WebSocket. Returns {user_id, username} or None."""
    try:
        payload = jwt.decode(token, settings.secret_key, algorithms=[ALGORITHM])
        user_id = payload.get("sub")
        if not user_id:
            return None
        db = SessionLocal()
        try:
            user = db.query(User).filter(User.id == user_id).first()
            if not user or not user.is_active:
                return None
            return {"user_id": str(user.id), "username": user.username}
        finally:
            db.close()
    except (JWTError, Exception):
        return None


@router.websocket("/ws/messaging")
async def messaging_websocket(
    websocket: WebSocket,
    token: str = Query(...),
):
    """WebSocket endpoint for real-time messaging with presence tracking."""
    auth = _authenticate_messaging_ws(token)
    if not auth:
        await websocket.close(code=4001, reason="Authentication failed")
        return

    conn = await messaging_ws_manager.connect(
        websocket,
        user_id=auth["user_id"],
        username=auth["username"],
    )

    # Broadcast online presence to all org users
    try:
        db = SessionLocal()
        try:
            user = db.query(User).filter(User.id == auth["user_id"]).first()
            if user and user.organization_id:
                org_users = db.query(User.id).filter(
                    User.organization_id == user.organization_id,
                    User.id != user.id,
                    User.is_active == True,
                ).all()
                for (uid,) in org_users:
                    await messaging_ws_manager.send_to_user(str(uid), {
                        "type": "presence",
                        "user_id": auth["user_id"],
                        "username": auth["username"],
                        "status": "online",
                    })
        finally:
            db.close()
    except Exception:
        pass

    try:
        while True:
            raw = await websocket.receive_text()
            try:
                msg = json.loads(raw)
            except json.JSONDecodeError:
                continue

            msg_type = msg.get("type", "")

            if msg_type == "heartbeat":
                await websocket.send_json({
                    "type": "heartbeat_ack",
                    "ts": datetime.utcnow().isoformat(),
                })

            elif msg_type == "typing":
                channel_id = msg.get("channel_id")
                if channel_id:
                    await messaging_ws_manager.send_to_channel_members(
                        channel_id,
                        {
                            "type": "typing",
                            "channel_id": channel_id,
                            "user_id": auth["user_id"],
                            "username": auth["username"],
                            "timestamp": datetime.utcnow().isoformat(),
                        },
                        exclude_user=auth["user_id"],
                    )

            elif msg_type == "presence_update":
                # User manually sets status (away, dnd, etc.)
                user_status = msg.get("status", "online")
                try:
                    db = SessionLocal()
                    try:
                        user = db.query(User).filter(User.id == auth["user_id"]).first()
                        if user and user.organization_id:
                            org_users = db.query(User.id).filter(
                                User.organization_id == user.organization_id,
                                User.id != user.id,
                                User.is_active == True,
                            ).all()
                            for (uid,) in org_users:
                                await messaging_ws_manager.send_to_user(str(uid), {
                                    "type": "presence",
                                    "user_id": auth["user_id"],
                                    "username": auth["username"],
                                    "status": user_status,
                                })
                    finally:
                        db.close()
                except Exception:
                    pass

    except WebSocketDisconnect:
        await messaging_ws_manager.disconnect(conn)
        # Broadcast offline presence
        try:
            db = SessionLocal()
            try:
                user = db.query(User).filter(User.id == auth["user_id"]).first()
                if user and user.organization_id:
                    org_users = db.query(User.id).filter(
                        User.organization_id == user.organization_id,
                        User.id != user.id,
                        User.is_active == True,
                    ).all()
                    for (uid,) in org_users:
                        await messaging_ws_manager.send_to_user(str(uid), {
                            "type": "presence",
                            "user_id": auth["user_id"],
                            "username": auth["username"],
                            "status": "offline",
                        })
            finally:
                db.close()
        except Exception:
            pass
    except Exception as e:
        logger.error(f"Messaging WS error: {e}", exc_info=True)
        await messaging_ws_manager.disconnect(conn)
