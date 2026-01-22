"""
Document upload API routes.
"""
from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, Form
from sqlalchemy.orm import Session
from typing import Optional
from app.db.session import get_db
from app.models.schemas import DocumentUploadResponse, SessionCreate
from app.models.database import Session as DBSession, SessionStatus
from app.services.document_analyzer import document_analyzer
from app.services.question_generator import question_generator
from app.api.dependencies import validate_file_upload
from app.core.logger import get_logger

logger = get_logger(__name__)
router = APIRouter(prefix="/upload", tags=["upload"])


@router.post("/{session_id}", response_model=DocumentUploadResponse)
async def upload_document(
    session_id: str,
    file: Optional[UploadFile] = File(None),
    db: Session = Depends(get_db)
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
        
        # Get existing session
        session = db.query(DBSession).filter(
            DBSession.id == UUID(session_id)
        ).first()
        
        if not session:
            raise HTTPException(status_code=404, detail="Session not found")
        
        # Validate file
        await validate_file_upload(file)
        
        # Read and analyze file
        content = await file.read()
        document_text, document_type = document_analyzer.analyze_document(
            content, file.filename
        )
        
        # Update session with document info
        # Note: We don't automatically set document_filename to the uploaded filename
        # Users can rename the session themselves using the PATCH endpoint
        session.document_text = document_text
        session.document_type = document_type
        # Keep the existing session name (usually "Untitled")
        session.status = SessionStatus.QUESTIONS_PENDING
        db.commit()
        db.refresh(session)
        
        logger.info(f"Session updated: {session.id}")
        
        # Generate questions using AI agent (consider user's technical level)
        questions = await question_generator.generate_questions_from_document(
            document_text=document_text,
            session_id=str(session.id),
            user_type=session.user_type,
            db=db
        )
        
        logger.info(f"Generated {len(questions)} questions")
        
        return DocumentUploadResponse(
            session_id=session.id,
            questions=questions,
            message="Document analyzed successfully"
        )
        
    except ValueError as e:
        logger.error(f"Validation error: {str(e)}")
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        logger.error(f"Error uploading document: {str(e)}")
        raise HTTPException(status_code=500, detail="Internal server error")
