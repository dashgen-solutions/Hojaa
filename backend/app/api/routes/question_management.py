"""
Question management API routes.
Allows users to add, delete, and edit questions and answers.
"""
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from uuid import UUID
from typing import List
from app.db.session import get_db
from app.models.database import Question, Session as DBSession, SessionStatus
from app.models.schemas import QuestionCreate, QuestionUpdate, QuestionResponse
from app.core.logger import get_logger
from app.core.exceptions import resource_not_found_error

logger = get_logger(__name__)
router = APIRouter(prefix="/questions", tags=["question-management"])


@router.post("/{session_id}/add", response_model=QuestionResponse, status_code=status.HTTP_201_CREATED)
async def add_question(
    session_id: str,
    question_data: QuestionCreate,
    db: Session = Depends(get_db)
):
    """
    Add a new question to a session.
    
    Args:
        session_id: Session ID
        question_data: Question text and optional category
        db: Database session
    
    Returns:
        Created question
    """
    try:
        logger.info(f"Adding question to session {session_id}")
        
        # Verify session exists
        session = db.query(DBSession).filter(DBSession.id == UUID(session_id)).first()
        if not session:
            raise resource_not_found_error("Session", session_id)
        
        # Get current max order_index
        max_order_query = db.query(Question).filter(
            Question.session_id == UUID(session_id)
        ).order_by(Question.order_index.desc()).first()
        
        next_order_index = (max_order_query.order_index + 1) if max_order_query else 0
        
        # Create new question
        new_question = Question(
            session_id=UUID(session_id),
            question_text=question_data.question_text,
            category=question_data.category or "custom",
            order_index=next_order_index,
            is_answered=False
        )
        
        db.add(new_question)
        db.commit()
        db.refresh(new_question)
        
        logger.info(f"Added question {new_question.id} to session {session_id}")
        
        return QuestionResponse(
            id=new_question.id,
            question_text=new_question.question_text,
            answer_text=new_question.answer_text,
            category=new_question.category,
            order_index=new_question.order_index,
            is_answered=new_question.is_answered
        )
    
    except HTTPException:
        raise
    except Exception as error_instance:
        logger.error(f"Error adding question: {str(error_instance)}")
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to add question: {str(error_instance)}"
        )


@router.delete("/{question_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_question(
    question_id: str,
    db: Session = Depends(get_db)
):
    """
    Delete a question from a session.
    
    Args:
        question_id: Question ID to delete
        db: Database session
    
    Returns:
        No content (204)
    """
    try:
        logger.info(f"Deleting question {question_id}")
        
        # Find question
        question = db.query(Question).filter(Question.id == UUID(question_id)).first()
        if not question:
            raise resource_not_found_error("Question", question_id)
        
        session_id = question.session_id
        deleted_order_index = question.order_index
        
        # Delete question
        db.delete(question)
        
        # Reorder remaining questions
        remaining_questions = db.query(Question).filter(
            Question.session_id == session_id,
            Question.order_index > deleted_order_index
        ).all()
        
        for remaining_question in remaining_questions:
            remaining_question.order_index -= 1
        
        db.commit()
        
        logger.info(f"Deleted question {question_id}")
        return None
    
    except HTTPException:
        raise
    except Exception as error_instance:
        logger.error(f"Error deleting question: {str(error_instance)}")
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to delete question: {str(error_instance)}"
        )


@router.patch("/{question_id}", response_model=QuestionResponse)
async def update_question(
    question_id: str,
    question_update: QuestionUpdate,
    db: Session = Depends(get_db)
):
    """
    Update question text or answer.
    
    Args:
        question_id: Question ID to update
        question_update: Fields to update
        db: Database session
    
    Returns:
        Updated question
    """
    try:
        logger.info(f"Updating question {question_id}")
        
        # Find question
        question = db.query(Question).filter(Question.id == UUID(question_id)).first()
        if not question:
            raise resource_not_found_error("Question", question_id)
        
        # Update fields if provided
        if question_update.question_text is not None:
            question.question_text = question_update.question_text
        
        if question_update.answer_text is not None:
            question.answer_text = question_update.answer_text
            question.is_answered = True if question_update.answer_text else False
        
        if question_update.category is not None:
            question.category = question_update.category
        
        db.commit()
        db.refresh(question)
        
        logger.info(f"Updated question {question_id}")
        
        return QuestionResponse(
            id=question.id,
            question_text=question.question_text,
            answer_text=question.answer_text,
            category=question.category,
            order_index=question.order_index,
            is_answered=question.is_answered
        )
    
    except HTTPException:
        raise
    except Exception as error_instance:
        logger.error(f"Error updating question: {str(error_instance)}")
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to update question: {str(error_instance)}"
        )


@router.get("/{session_id}/list", response_model=List[QuestionResponse])
async def list_questions(
    session_id: str,
    db: Session = Depends(get_db)
):
    """
    Get all questions for a session.
    
    Args:
        session_id: Session ID
        db: Database session
    
    Returns:
        List of questions
    """
    try:
        logger.info(f"Listing questions for session {session_id}")
        
        # Verify session exists
        session = db.query(DBSession).filter(DBSession.id == UUID(session_id)).first()
        if not session:
            raise resource_not_found_error("Session", session_id)
        
        # Get all questions
        questions = db.query(Question).filter(
            Question.session_id == UUID(session_id)
        ).order_by(Question.order_index).all()
        
        return [
            QuestionResponse(
                id=question.id,
                question_text=question.question_text,
                answer_text=question.answer_text,
                category=question.category,
                order_index=question.order_index,
                is_answered=question.is_answered
            )
            for question in questions
        ]
    
    except HTTPException:
        raise
    except Exception as error_instance:
        logger.error(f"Error listing questions: {str(error_instance)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to list questions: {str(error_instance)}"
        )
