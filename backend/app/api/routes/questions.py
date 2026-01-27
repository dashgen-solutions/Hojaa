"""
Questions API routes.
"""
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from uuid import UUID
from typing import Dict, Any
from app.db.session import get_db
from app.models.schemas import QuestionsSubmitRequest, TreeResponse, NodeResponse
from app.models.database import Question, Session as DBSession, SessionStatus, Node
from app.services.tree_builder import tree_builder
from app.core.logger import get_logger

logger = get_logger(__name__)
router = APIRouter(prefix="/questions", tags=["questions"])


def node_to_dict(node: Node) -> Dict[str, Any]:
    """Convert a Node SQLAlchemy object to a dictionary for response."""
    return {
        "id": node.id,
        "question": node.question,
        "answer": node.answer,
        "node_type": node.node_type.value,
        "depth": node.depth,
        "order_index": node.order_index,
        "can_expand": node.can_expand,
        "is_expanded": node.is_expanded,
        "children": [node_to_dict(child) for child in (node.children or [])]
    }


@router.post("/submit", response_model=TreeResponse)
async def submit_questions(
    request: QuestionsSubmitRequest,
    db: Session = Depends(get_db)
):
    """
    Submit answers to initial questions and generate requirements tree.
    """
    try:
        logger.info(f"Submitting answers for session {request.session_id}")
        
        # Verify session exists
        session = db.query(DBSession).filter(
            DBSession.id == request.session_id
        ).first()
        
        if not session:
            raise HTTPException(status_code=404, detail="Session not found")
        
        # Update questions with answers
        for answer_data in request.answers:
            question = db.query(Question).filter(
                Question.id == answer_data.question_id
            ).first()
            
            if not question:
                logger.warning(f"Question {answer_data.question_id} not found")
                continue
            
            question.answer_text = answer_data.answer_text
            question.is_answered = True
        
        db.commit()
        
        # Build tree from answers using AI agent (consider user's technical level)
        root_node = await tree_builder.build_initial_tree(
            session_id=request.session_id,
            user_type=session.user_type,
            db=db
        )
        
        # Update session status
        session.status = SessionStatus.TREE_GENERATED
        db.commit()
        
        # Refresh to load relationships
        db.refresh(root_node)
        
        logger.info(f"Tree generated for session {request.session_id}")
        
        # Convert to dict for proper serialization
        tree_dict = node_to_dict(root_node)
        
        return TreeResponse(
            session_id=request.session_id,
            tree=tree_dict,
            message="Tree generated successfully"
        )
        
    except ValueError as e:
        logger.error(f"Validation error: {str(e)}")
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        logger.error(f"Error submitting questions: {str(e)}")
        raise HTTPException(status_code=500, detail="Internal server error")


@router.get("/{session_id}")
async def get_questions(
    session_id: UUID,
    db: Session = Depends(get_db)
):
    """Get all questions for a session."""
    try:
        questions = db.query(Question).filter(
            Question.session_id == session_id
        ).order_by(Question.order_index).all()
        
        if not questions:
            raise HTTPException(status_code=404, detail="No questions found")
        
        return {"questions": questions}
        
    except Exception as e:
        logger.error(f"Error getting questions: {str(e)}")
        raise HTTPException(status_code=500, detail="Internal server error")
