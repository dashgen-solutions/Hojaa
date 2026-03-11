"""
API routes for the messaging channel AI chatbot.

Provides an intelligent assistant scoped to a specific chat channel.
Can answer questions about channel messages, call transcriptions, and discussions.
"""
from uuid import UUID
from typing import Optional
from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel
from sqlalchemy.orm import Session

from app.db.session import get_db
from app.core.auth import get_current_user
from app.core.logger import get_logger
from app.models.database import (
    User,
    ChatChannel,
    ChatChannelMember,
    MessagingChatMessage,
)
from app.services.messaging_chat_service import process_messaging_chat

logger = get_logger(__name__)

router = APIRouter(prefix="/messaging-chat", tags=["messaging-chat"])


# ── Request / Response schemas ──

class MessagingChatRequest(BaseModel):
    channel_id: str
    message: str


class MessagingChatResponse(BaseModel):
    response: str
    tool_calls: list = []
    message_id: str


class ChatMessageOut(BaseModel):
    id: str
    role: str
    content: str
    tool_calls: Optional[list] = None
    created_at: str


# ── Helpers ──

def _require_channel_member(db: Session, channel_id: str, user: User):
    """Verify the user is a member of the channel."""
    channel = db.query(ChatChannel).filter(ChatChannel.id == channel_id).first()
    if not channel:
        raise HTTPException(status_code=404, detail="Channel not found")

    member = db.query(ChatChannelMember).filter_by(
        channel_id=channel_id, user_id=user.id
    ).first()
    if not member:
        raise HTTPException(status_code=403, detail="Not a member of this channel")

    return channel


# ── Endpoints ──

@router.post("/send", response_model=MessagingChatResponse)
async def send_messaging_chat(
    request: MessagingChatRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Send a message to the channel AI chatbot.

    The chatbot can answer questions about channel discussions, call transcriptions,
    summarize conversations, and search for specific topics.
    """
    channel = _require_channel_member(db, request.channel_id, current_user)
    channel_uuid = UUID(request.channel_id)

    # Load recent chat history from DB
    recent_msgs = (
        db.query(MessagingChatMessage)
        .filter(
            MessagingChatMessage.channel_id == channel_uuid,
            MessagingChatMessage.user_id == current_user.id,
        )
        .order_by(MessagingChatMessage.created_at.desc())
        .limit(30)
        .all()
    )
    recent_msgs.reverse()

    chat_history = [
        {"role": m.role, "content": m.content}
        for m in recent_msgs
        if m.role in ("user", "assistant")
    ]

    # Save user message
    user_msg = MessagingChatMessage(
        channel_id=channel_uuid,
        user_id=current_user.id,
        role="user",
        content=request.message,
    )
    db.add(user_msg)
    db.flush()

    # Process with AI
    result = await process_messaging_chat(
        db=db,
        channel_id=channel_uuid,
        user_id=current_user.id,
        user_message=request.message,
        chat_history=chat_history,
    )

    # Save assistant response
    assistant_msg = MessagingChatMessage(
        channel_id=channel_uuid,
        user_id=current_user.id,
        role="assistant",
        content=result["response"],
        tool_calls=result.get("tool_calls"),
    )
    db.add(assistant_msg)
    db.commit()

    return MessagingChatResponse(
        response=result["response"],
        tool_calls=result.get("tool_calls", []),
        message_id=str(assistant_msg.id),
    )


@router.get("/history/{channel_id}")
async def get_messaging_chat_history(
    channel_id: str,
    limit: int = Query(50, ge=1, le=200),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Get the chatbot conversation history for the current user in a channel."""
    _require_channel_member(db, channel_id, current_user)

    messages = (
        db.query(MessagingChatMessage)
        .filter(
            MessagingChatMessage.channel_id == channel_id,
            MessagingChatMessage.user_id == current_user.id,
        )
        .order_by(MessagingChatMessage.created_at.desc())
        .limit(limit)
        .all()
    )
    messages.reverse()

    return {
        "messages": [
            {
                "id": str(m.id),
                "role": m.role,
                "content": m.content,
                "tool_calls": m.tool_calls,
                "created_at": m.created_at.isoformat(),
            }
            for m in messages
        ]
    }


@router.delete("/history/{channel_id}")
async def clear_messaging_chat_history(
    channel_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Clear the chatbot conversation history for the current user in a channel."""
    _require_channel_member(db, channel_id, current_user)

    deleted = (
        db.query(MessagingChatMessage)
        .filter(
            MessagingChatMessage.channel_id == channel_id,
            MessagingChatMessage.user_id == current_user.id,
        )
        .delete()
    )
    db.commit()

    return {"deleted": deleted}
