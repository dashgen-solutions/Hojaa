"""
Session management API routes.
Includes SEC-2.3 session sharing controls.
"""
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from sqlalchemy import or_
from typing import List, Optional
from uuid import UUID, uuid4
from pydantic import BaseModel
from app.db.session import get_db
from app.models.schemas import SessionResponse, SessionCreate
from app.models.database import (
    Session as DBSession, SessionStatus, User, UserRole, SessionMember, Organization,
)
from app.core.auth import get_optional_user, get_current_active_user, get_current_user
from app.core.logger import get_logger
from app.services.project_channel_service import (
    sync_shared_user, rename_project_channel,
)

logger = get_logger(__name__)
router = APIRouter(prefix="/sessions", tags=["sessions"])


def _can_access_session(session: DBSession, user: Optional[User], db: Session) -> bool:
    """Check if a user can access a session (owner, shared member, or guest session)."""
    if session.user_id is None:
        return True  # guest session — open
    if user is None:
        return False
    if session.user_id == user.id:
        return True
    # Check session_members table
    member = (
        db.query(SessionMember)
        .filter(SessionMember.session_id == session.id, SessionMember.user_id == user.id)
        .first()
    )
    return member is not None


@router.post("", response_model=SessionResponse, status_code=201)
async def create_session(
    db: Session = Depends(get_db),
    session_data: SessionCreate = SessionCreate(),
    current_user: Optional[User] = Depends(get_optional_user)
):
    """
    Create a new session.
    If user is authenticated, link the session to their account.
    """
    try:
        # Validate user_type
        if session_data.user_type not in ["technical", "non_technical"]:
            raise HTTPException(
                status_code=400,
                detail="user_type must be 'technical' or 'non_technical'"
            )
        
        # Create new session
        # Set default name to "Untitled" if no filename provided
        default_session_name = "Untitled"
        session_filename = session_data.document_filename if session_data.document_filename else default_session_name
        
        new_session = DBSession(
            id=uuid4(),
            user_id=current_user.id if current_user else None,
            organization_id=current_user.organization_id if current_user else None,  # Enterprise: org scope
            user_type=session_data.user_type,
            status=SessionStatus.UPLOAD_PENDING,
            document_text=session_data.document_text,
            document_type=session_data.document_type,
            document_filename=session_filename,
            session_metadata={}
        )
        
        db.add(new_session)
        db.commit()
        db.refresh(new_session)
        
        logger.info(f"Created new session: {new_session.id} for user: {current_user.id if current_user else 'anonymous'}")
        return new_session
        
    except Exception as e:
        logger.error(f"Error creating session: {str(e)}")
        db.rollback()
        raise HTTPException(status_code=500, detail="Internal server error")


@router.get("", response_model=List[SessionResponse])
async def get_sessions(
    limit: int = 100,
    db: Session = Depends(get_db),
    current_user: Optional[User] = Depends(get_optional_user)
):
    """
    Get list of recent sessions.
    If user is authenticated, returns only their sessions.
    If not authenticated, returns all sessions (for backward compatibility).
    """
    try:
        query = db.query(DBSession)
        
        # Filter by user if authenticated
        if current_user:
            if current_user.organization_id:
                # Enterprise user: see own sessions + sessions shared via session_members
                query = query.filter(
                    or_(
                        DBSession.user_id == current_user.id,
                        DBSession.id.in_(
                            db.query(SessionMember.session_id)
                            .filter(SessionMember.user_id == current_user.id)
                        ),
                    )
                )
            else:
                # Individual user: own sessions + shared
                query = query.filter(
                    or_(
                        DBSession.user_id == current_user.id,
                        DBSession.id.in_(
                            db.query(SessionMember.session_id)
                            .filter(SessionMember.user_id == current_user.id)
                        ),
                    )
                )
            logger.info(f"Fetching sessions for user: {current_user.id} (email: {current_user.email})")
        else:
            logger.info("⚠️ WARNING: Fetching all sessions (user not authenticated)")
        
        sessions = query.order_by(
            DBSession.created_at.desc()
        ).limit(limit).all()
        
        logger.info(f"Found {len(sessions)} sessions")
        if sessions and current_user:
            logger.info(f"First session user_id: {sessions[0].user_id}")
        
        return sessions
        
    except Exception as e:
        logger.error(f"Error getting sessions: {str(e)}")
        raise HTTPException(status_code=500, detail="Internal server error")


@router.get("/{session_id}", response_model=SessionResponse)
async def get_session(
    session_id: str,
    db: Session = Depends(get_db),
    current_user: Optional[User] = Depends(get_optional_user)
):
    """
    Get a specific session.
    If user is authenticated, verifies they own the session.
    """
    try:
        from uuid import UUID
        
        session = db.query(DBSession).filter(
            DBSession.id == UUID(session_id)
        ).first()
        
        if not session:
            raise HTTPException(status_code=404, detail="Session not found")
        
        # Verify access via ownership, guest, or share table
        if not _can_access_session(session, current_user, db):
            raise HTTPException(status_code=403, detail="Access denied to this session")
        
        return session
        
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid session ID")
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error getting session: {str(e)}")
        raise HTTPException(status_code=500, detail="Internal server error")


# ===== SEC-2.3: Session Sharing =====

class ShareSessionRequest(BaseModel):
    email: str
    role: str = "viewer"  # viewer | editor | admin


@router.post("/{session_id}/share")
async def share_session(
    session_id: str,
    body: ShareSessionRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Share a session with another user by email (SEC-2.3)."""
    try:
        sid = UUID(session_id)
        session = db.query(DBSession).filter(DBSession.id == sid).first()
        if not session:
            raise HTTPException(status_code=404, detail="Session not found")

        # Only owner or admin can share
        from app.core.permissions import effective_role, has_permission, Permission
        role = effective_role(current_user, sid, db)
        if not has_permission(role, Permission.SHARE_SESSION):
            raise HTTPException(status_code=403, detail="You don't have permission to share this session")

        # Find target user
        target = db.query(User).filter(User.email == body.email).first()
        if not target:
            raise HTTPException(status_code=404, detail="User not found")
        if target.id == current_user.id:
            raise HTTPException(status_code=400, detail="Cannot share with yourself")

        # Validate role
        try:
            share_role = UserRole(body.role)
        except ValueError:
            raise HTTPException(status_code=400, detail=f"Invalid role: {body.role}")

        # Upsert membership
        existing = (
            db.query(SessionMember)
            .filter(SessionMember.session_id == sid, SessionMember.user_id == target.id)
            .first()
        )
        if existing:
            existing.role = share_role
        else:
            db.add(SessionMember(
                session_id=sid,
                user_id=target.id,
                role=share_role,
                invited_by=current_user.id,
            ))

        # Sync: add shared user to the project channel
        try:
            sync_shared_user(db, sid, target.id, remove=False)
        except Exception as ch_err:
            logger.warning(f"Channel sync on share failed: {ch_err}")

        db.commit()

        return {"message": f"Session shared with {body.email} as {share_role.value}"}

    except HTTPException:
        raise
    except Exception as e:
        db.rollback()
        logger.error(f"Error sharing session: {e}")
        raise HTTPException(status_code=500, detail="Internal server error")


@router.delete("/{session_id}/share/{user_id}")
async def revoke_session_share(
    session_id: str,
    user_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Revoke a user's access to a session."""
    try:
        sid = UUID(session_id)
        from app.core.permissions import effective_role, has_permission, Permission
        role = effective_role(current_user, sid, db)
        if not has_permission(role, Permission.SHARE_SESSION):
            raise HTTPException(status_code=403, detail="Insufficient permissions")

        member = (
            db.query(SessionMember)
            .filter(SessionMember.session_id == sid, SessionMember.user_id == UUID(user_id))
            .first()
        )
        if not member:
            raise HTTPException(status_code=404, detail="Share not found")

        target_user_id = member.user_id
        db.delete(member)

        # Sync: remove user from the project channel
        try:
            sync_shared_user(db, sid, target_user_id, remove=True)
        except Exception as ch_err:
            logger.warning(f"Channel sync on revoke failed: {ch_err}")

        db.commit()
        return {"message": "Access revoked"}

    except HTTPException:
        raise
    except Exception as e:
        db.rollback()
        logger.error(f"Error revoking share: {e}")
        raise HTTPException(status_code=500, detail="Internal server error")


@router.get("/{session_id}/members")
async def list_session_members(
    session_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """List users who have access to this session."""
    try:
        sid = UUID(session_id)
        session = db.query(DBSession).filter(DBSession.id == sid).first()
        if not session:
            raise HTTPException(status_code=404, detail="Session not found")

        if not _can_access_session(session, current_user, db):
            raise HTTPException(status_code=403, detail="Access denied")

        members = db.query(SessionMember).filter(SessionMember.session_id == sid).all()

        result = []
        # Include owner
        if session.user_id:
            owner = db.query(User).filter(User.id == session.user_id).first()
            if owner:
                result.append({
                    "user_id": str(owner.id),
                    "email": owner.email,
                    "username": owner.username,
                    "role": "owner",
                    "is_owner": True,
                })

        for m in members:
            user = db.query(User).filter(User.id == m.user_id).first()
            if user:
                result.append({
                    "user_id": str(user.id),
                    "email": user.email,
                    "username": user.username,
                    "role": m.role.value,
                    "is_owner": False,
                })

        return {"members": result}

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error listing members: {e}")
        raise HTTPException(status_code=500, detail="Internal server error")


@router.delete("/{session_id}")
async def delete_session(
    session_id: str,
    db: Session = Depends(get_db),
    current_user: Optional[User] = Depends(get_optional_user)
):
    """
    Delete a session and all related data.
    If user is authenticated, verifies they own the session.
    """
    try:
        from uuid import UUID
        from sqlalchemy import text
        from app.models.database import (
            Document, DocumentChatMessage, DocumentVersion,
            DocumentRecipient, PricingLineItem, NodeHistory,
            Node, SessionChatMessage, WebSocketPresence,
            NotificationPreference,
        )
        
        session = db.query(DBSession).filter(
            DBSession.id == UUID(session_id)
        ).first()
        
        if not session:
            raise HTTPException(status_code=404, detail="Session not found")
        
        # Verify access via ownership, guest, or share table
        if not _can_access_session(session, current_user, db):
            raise HTTPException(status_code=403, detail="Access denied to this session")
        
        sid = session.id
        
        # 1. Delete document sub-tables first
        doc_ids = [d.id for d in db.query(Document.id).filter(Document.session_id == sid).all()]
        if doc_ids:
            db.query(DocumentChatMessage).filter(DocumentChatMessage.document_id.in_(doc_ids)).delete(synchronize_session=False)
            db.query(DocumentVersion).filter(DocumentVersion.document_id.in_(doc_ids)).delete(synchronize_session=False)
            db.query(DocumentRecipient).filter(DocumentRecipient.document_id.in_(doc_ids)).delete(synchronize_session=False)
            db.query(PricingLineItem).filter(PricingLineItem.document_id.in_(doc_ids)).delete(synchronize_session=False)
            db.query(Document).filter(Document.session_id == sid).delete(synchronize_session=False)
        
        # 2. Delete NodeHistory via raw SQL to bypass the ORM immutability
        #    listener (SEC-2.4).  This is intentional: when the *project*
        #    itself is deleted, the audit trail goes with it.
        db.execute(
            text("DELETE FROM node_history WHERE session_id = :sid"),
            {"sid": str(sid)},
        )
        
        # 3. Delete other session-scoped rows that might block cascade
        db.query(SessionChatMessage).filter(SessionChatMessage.session_id == sid).delete(synchronize_session=False)
        db.query(WebSocketPresence).filter(WebSocketPresence.session_id == sid).delete(synchronize_session=False)
        db.query(NotificationPreference).filter(NotificationPreference.session_id == sid).delete(synchronize_session=False)
        
        # 4. Now safe to delete the session; remaining cascades are clean
        db.delete(session)
        db.commit()
        
        logger.info(f"Deleted session: {session_id}")
        return {"message": "Session deleted successfully"}
        
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid session ID")
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error deleting session: {str(e)}")
        db.rollback()
        raise HTTPException(status_code=500, detail="Internal server error")


class SessionUpdateRequest(BaseModel):
    """Schema for updating session metadata."""
    document_filename: Optional[str] = None


@router.patch("/{session_id}", response_model=SessionResponse)
async def update_session(
    session_id: str,
    update_data: SessionUpdateRequest,
    db: Session = Depends(get_db),
    current_user: Optional[User] = Depends(get_optional_user)
):
    """
    Update a session's metadata (e.g., document_filename).
    If user is authenticated, verifies they own the session.
    """
    try:
        from uuid import UUID
        
        session = db.query(DBSession).filter(
            DBSession.id == UUID(session_id)
        ).first()
        
        if not session:
            raise HTTPException(status_code=404, detail="Session not found")
        
        # Verify access via ownership, guest, or share table
        if not _can_access_session(session, current_user, db):
            raise HTTPException(status_code=403, detail="Access denied to this session")
        
        # Update session name if provided
        if update_data.document_filename is not None:
            session.document_filename = update_data.document_filename
            logger.info(f"Updating session {session_id} name to: {update_data.document_filename}")

            # Sync: rename the project channel
            try:
                rename_project_channel(db, UUID(session_id), update_data.document_filename)
            except Exception as ch_err:
                logger.warning(f"Channel rename failed: {ch_err}")
        
        db.commit()
        db.refresh(session)
        
        logger.info(f"Updated session: {session_id}")
        return session
        
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid session ID")
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error updating session: {str(e)}")
        db.rollback()
        raise HTTPException(status_code=500, detail="Internal server error")
