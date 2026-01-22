"""
Session management API routes.
"""
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import List, Optional
from uuid import uuid4
from pydantic import BaseModel
from app.db.session import get_db
from app.models.schemas import SessionResponse, SessionCreate
from app.models.database import Session as DBSession, SessionStatus, User
from app.core.auth import get_optional_user, get_current_active_user
from app.core.logger import get_logger

logger = get_logger(__name__)
router = APIRouter(prefix="/sessions", tags=["sessions"])


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
            query = query.filter(DBSession.user_id == current_user.id)
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
        
        # Verify ownership if user is authenticated
        # Allow access if: session belongs to user OR session has no owner (guest session)
        if current_user and session.user_id is not None and session.user_id != current_user.id:
            raise HTTPException(status_code=403, detail="Access denied to this session")
        
        return session
        
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid session ID")
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error getting session: {str(e)}")
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
        
        session = db.query(DBSession).filter(
            DBSession.id == UUID(session_id)
        ).first()
        
        if not session:
            raise HTTPException(status_code=404, detail="Session not found")
        
        # Verify ownership if user is authenticated
        # Allow deletion if: session belongs to user OR session has no owner (guest session)
        if current_user and session.user_id is not None and session.user_id != current_user.id:
            raise HTTPException(status_code=403, detail="Access denied to this session")
        
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
        
        # Verify ownership if user is authenticated
        if current_user and session.user_id is not None and session.user_id != current_user.id:
            raise HTTPException(status_code=403, detail="Access denied to this session")
        
        # Update session name if provided
        if update_data.document_filename is not None:
            session.document_filename = update_data.document_filename
            logger.info(f"Updating session {session_id} name to: {update_data.document_filename}")
        
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
