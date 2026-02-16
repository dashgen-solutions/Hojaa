"""
API routes for the session-level AI chatbot.

Provides an intelligent assistant scoped to a specific session.
Access restricted to session owners and admins.
"""
from uuid import UUID
from typing import Optional, List
from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel
from sqlalchemy.orm import Session

from app.db.session import get_db
from app.core.auth import get_current_user
from app.core.logger import get_logger
from app.models.database import (
    User, SessionChatMessage,
    Session as SessionModel, SessionMember, UserRole,
)
from app.services.session_chat_service import process_session_chat

logger = get_logger(__name__)

router = APIRouter(prefix="/session-chat", tags=["session-chat"])


# ── Request / Response schemas ──────────────────────────────────

class SessionChatRequest(BaseModel):
    session_id: str
    message: str


class ChatMessageOut(BaseModel):
    id: str
    role: str
    content: str
    tool_calls: Optional[list] = None
    created_at: str


class SessionChatResponse(BaseModel):
    response: str
    tool_calls: list = []
    actions_taken: list = []
    message_id: str


# ── Helpers ─────────────────────────────────────────────────────

def _require_admin_or_owner(db: Session, session_id: str, user: User):
    """
    Verify the user is owner or admin for the given session.
    Raises 403 if not authorised.
    """
    sess = db.query(SessionModel).filter(SessionModel.id == session_id).first()
    if not sess:
        raise HTTPException(status_code=404, detail="Session not found")

    # Session creator
    if sess.user_id and str(sess.user_id) == str(user.id):
        return sess

    # Global admin / owner role
    if user.role in (UserRole.OWNER, UserRole.ADMIN):
        return sess

    # Session-level share with admin/owner role
    membership = db.query(SessionMember).filter(
        SessionMember.session_id == session_id,
        SessionMember.user_id == user.id,
    ).first()
    if membership and membership.role in (UserRole.OWNER, UserRole.ADMIN):
        return sess

    raise HTTPException(
        status_code=403,
        detail="Session chatbot is available to session owners and admins only.",
    )


# ── Endpoints ───────────────────────────────────────────────────

@router.post("/send", response_model=SessionChatResponse)
async def send_chat_message(
    request: SessionChatRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Send a message to the session AI chatbot.
    
    The chatbot can answer questions about the session, perform actions
    (create nodes, manage team, assign cards), and provide analytics.
    
    **Access:** Session owner or admin only.
    """
    session = _require_admin_or_owner(db, request.session_id, current_user)
    session_uuid = UUID(request.session_id)

    # Load recent chat history from DB
    recent_msgs = (
        db.query(SessionChatMessage)
        .filter(
            SessionChatMessage.session_id == session_uuid,
            SessionChatMessage.user_id == current_user.id,
        )
        .order_by(SessionChatMessage.created_at.desc())
        .limit(30)
        .all()
    )
    recent_msgs.reverse()  # oldest first

    chat_history = [
        {"role": m.role, "content": m.content}
        for m in recent_msgs
        if m.role in ("user", "assistant")
    ]

    # Save user message
    user_msg = SessionChatMessage(
        session_id=session_uuid,
        user_id=current_user.id,
        role="user",
        content=request.message,
    )
    db.add(user_msg)
    db.flush()

    # Process with AI
    result = await process_session_chat(
        db=db,
        session_id=session_uuid,
        user_id=current_user.id,
        user_message=request.message,
        chat_history=chat_history,
    )

    # Save assistant response
    assistant_msg = SessionChatMessage(
        session_id=session_uuid,
        user_id=current_user.id,
        role="assistant",
        content=result["response"],
        tool_calls=result.get("tool_calls"),
        message_metadata={"actions_taken": result.get("actions_taken", [])},
    )
    db.add(assistant_msg)
    db.commit()

    return SessionChatResponse(
        response=result["response"],
        tool_calls=result.get("tool_calls", []),
        actions_taken=result.get("actions_taken", []),
        message_id=str(assistant_msg.id),
    )


@router.get("/history/{session_id}")
async def get_chat_history(
    session_id: str,
    limit: int = Query(50, ge=1, le=200),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Get the chat history for the current user in a session.
    
    **Access:** Session owner or admin only.
    """
    _require_admin_or_owner(db, session_id, current_user)

    messages = (
        db.query(SessionChatMessage)
        .filter(
            SessionChatMessage.session_id == session_id,
            SessionChatMessage.user_id == current_user.id,
        )
        .order_by(SessionChatMessage.created_at.asc())
        .limit(limit)
        .all()
    )

    return {
        "messages": [
            {
                "id": str(m.id),
                "role": m.role,
                "content": m.content,
                "tool_calls": m.tool_calls,
                "created_at": m.created_at.isoformat() if m.created_at else None,
            }
            for m in messages
        ],
    }


@router.delete("/history/{session_id}")
async def clear_chat_history(
    session_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Clear chat history for the current user in a session."""
    _require_admin_or_owner(db, session_id, current_user)

    deleted = (
        db.query(SessionChatMessage)
        .filter(
            SessionChatMessage.session_id == session_id,
            SessionChatMessage.user_id == current_user.id,
        )
        .delete()
    )
    db.commit()
    return {"deleted": deleted}
