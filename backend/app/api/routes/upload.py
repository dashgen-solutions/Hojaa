"""
Document upload API routes.
"""
from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, Form
from sqlalchemy.orm import Session
from typing import Optional
from app.db.session import get_db
from app.models.schemas import DocumentUploadResponse, SessionCreate
from app.models.database import Session as DBSession, SessionStatus, User
from app.services.document_analyzer import document_analyzer
from app.services.question_generator import question_generator
from app.api.dependencies import validate_file_upload
from app.core.auth import get_optional_user
from app.core.logger import get_logger

logger = get_logger(__name__)
router = APIRouter(prefix="/upload", tags=["upload"])


@router.post("/{session_id}", response_model=DocumentUploadResponse)
async def upload_document(
    session_id: str,
    file: Optional[UploadFile] = File(None),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_optional_user),
):
    """
    Upload a document or text and generate initial questions.
    
    File must be provided.
    """
    try:
        from uuid import UUID
        
        logger.info(f"Document upload request received for session {session_id}")
        
        if not file:
            raise HTTPException(
                status_code=400,
                detail="File must be provided"
            )
        
        # Validate session ID format
        try:
            session_uuid = UUID(session_id)
        except ValueError:
            raise HTTPException(
                status_code=400,
                detail=f"Invalid session ID format: {session_id}"
            )
        
        # Get existing session
        session = db.query(DBSession).filter(
            DBSession.id == session_uuid
        ).first()
        
        if not session:
            raise HTTPException(
                status_code=404,
                detail=f"Session not found: {session_id}"
            )
        
        # Validate file and get content (avoids double reading)
        validated_file, file_content = await validate_file_upload(file)
        
        # Analyze document
        try:
            document_text, document_type = document_analyzer.analyze_document(
                file_content, validated_file.filename
            )
        except ValueError as e:
            logger.error(f"Document analysis error: {str(e)}")
            raise HTTPException(status_code=400, detail=str(e))
        except Exception as e:
            logger.error(f"Unexpected error analyzing document: {str(e)}", exc_info=True)
            raise HTTPException(
                status_code=500,
                detail=f"Failed to analyze document: {str(e)}"
            )
        
        # Update session with document info
        # Note: We don't automatically set document_filename to the uploaded filename
        # Users can rename the session themselves using the PATCH endpoint
        session.document_text = document_text
        session.document_type = document_type
        # Keep the existing session name (usually "Untitled")
        session.status = SessionStatus.QUESTIONS_PENDING
        
        try:
            db.commit()
            db.refresh(session)
        except Exception as e:
            logger.error(f"Database error updating session: {str(e)}", exc_info=True)
            db.rollback()
            raise HTTPException(
                status_code=500,
                detail="Failed to save document to database"
            )
        
        logger.info(f"Session updated: {session.id}, document type: {document_type}")
        
        # Generate questions using AI agent (consider user's technical level)
        try:
            questions = await question_generator.generate_questions_from_document(
                document_text=document_text,
                session_id=str(session.id),
                user_type=session.user_type,
                db=db,
                user_id=current_user.id if current_user else None,
            )
        except Exception as e:
            logger.error(f"Error generating questions: {str(e)}", exc_info=True)
            raise HTTPException(
                status_code=500,
                detail=f"Failed to generate questions: {str(e)}"
            )
        
        logger.info(f"Generated {len(questions)} questions for session {session.id}")
        
        return DocumentUploadResponse(
            session_id=session.id,
            questions=questions,
            message="Document analyzed successfully"
        )
        
    except HTTPException:
        # Re-raise HTTP exceptions as-is
        raise
    except ValueError as e:
        logger.error(f"Validation error: {str(e)}", exc_info=True)
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        logger.error(f"Unexpected error uploading document: {str(e)}", exc_info=True)
        raise HTTPException(
            status_code=500,
            detail=f"Internal server error: {str(e)}"
        )
