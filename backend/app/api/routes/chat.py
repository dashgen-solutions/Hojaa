"""
Chat API routes for feature exploration.
"""
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from app.db.session import get_db
from app.models.schemas import (
    ChatStartRequest, ChatStartResponse,
    ChatMessageRequest, ChatMessageResponse,
    ChatConfirmRequest, ChatConfirmResponse,
    ConversationHistoryResponse
)
from app.models.database import Conversation, Message
from app.services.conversation_flow import conversation_flow
from app.services.tree_builder import tree_builder
from app.core.logger import get_logger

logger = get_logger(__name__)
router = APIRouter(prefix="/chat", tags=["chat"])


@router.post("/start", response_model=ChatStartResponse)
async def start_chat(
    request: ChatStartRequest,
    db: Session = Depends(get_db)
):
    """Start a new conversation for exploring a feature node."""
    try:
        logger.info(f"Starting chat for node {request.node_id}")
        
        # Use AI-powered conversation flow
        result = await conversation_flow.start_feature_conversation(
            session_id=request.session_id,
            node_id=request.node_id,
            db=db
        )
        
        return ChatStartResponse(**result)
        
    except ValueError as e:
        logger.error(f"Validation error: {str(e)}")
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        logger.error(f"Error starting chat: {str(e)}")
        raise HTTPException(status_code=500, detail="Internal server error")


@router.post("/message", response_model=ChatMessageResponse)
async def send_message(
    request: ChatMessageRequest,
    db: Session = Depends(get_db)
):
    """Send a message in an ongoing conversation."""
    try:
        logger.info(f"Processing message for conversation {request.conversation_id}")
        
        # Use AI-powered conversation flow
        result = await conversation_flow.process_user_message(
            conversation_id=request.conversation_id,
            user_message=request.message,
            db=db
        )
        
        return ChatMessageResponse(**result)
        
    except ValueError as e:
        logger.error(f"Validation error: {str(e)}")
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        logger.error(f"Error sending message: {str(e)}")
        raise HTTPException(status_code=500, detail="Internal server error")


@router.post("/confirm", response_model=ChatConfirmResponse)
async def confirm_chat(
    request: ChatConfirmRequest,
    db: Session = Depends(get_db)
):
    """Confirm conversation and create child nodes in tree."""
    try:
        logger.info(f"Confirming conversation {request.conversation_id}")
        
        # Get conversation to get parent node
        conversation = db.query(Conversation).filter(
            Conversation.id == request.conversation_id
        ).first()
        
        if not conversation:
            raise HTTPException(status_code=404, detail="Conversation not found")
        
        # Expand node from conversation using AI agent
        child_nodes = await tree_builder.expand_node_from_conversation(
            conversation_id=request.conversation_id,
            parent_node_id=conversation.node_id,
            db=db
        )
        
        # Convert nodes to dict format with empty children lists
        child_nodes_data = []
        for node in child_nodes:
            node_dict = {
                "id": str(node.id),
                "session_id": str(node.session_id),
                "parent_id": str(node.parent_id) if node.parent_id else None,
                "question": node.question,
                "answer": node.answer,
                "node_type": node.node_type.value if hasattr(node.node_type, 'value') else node.node_type,
                "depth": node.depth,
                "order_index": node.order_index,
                "can_expand": node.can_expand,
                "is_expanded": node.is_expanded,
                "metadata": node.node_metadata or {},
                "children": []  # New nodes don't have children yet
            }
            child_nodes_data.append(node_dict)
        
        return ChatConfirmResponse(
            parent_node_id=conversation.node_id,
            new_children=child_nodes_data,
            message=f"Added {len(child_nodes)} new requirements"
        )
        
    except ValueError as e:
        logger.error(f"Validation error: {str(e)}")
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        logger.error(f"Error confirming chat: {str(e)}")
        raise HTTPException(status_code=500, detail="Internal server error")


@router.get("/history/{conversation_id}", response_model=ConversationHistoryResponse)
async def get_conversation_history(
    conversation_id: str,
    db: Session = Depends(get_db)
):
    """Get complete conversation history."""
    try:
        from uuid import UUID
        
        conversation = db.query(Conversation).filter(
            Conversation.id == UUID(conversation_id)
        ).first()
        
        if not conversation:
            raise HTTPException(status_code=404, detail="Conversation not found")
        
        messages = db.query(Message).filter(
            Message.conversation_id == UUID(conversation_id)
        ).order_by(Message.created_at).all()
        
        return ConversationHistoryResponse(
            conversation_id=UUID(conversation_id),
            messages=messages,
            extracted_info=conversation.extracted_info or {},
            status=conversation.status.value
        )
        
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid conversation ID")
    except Exception as e:
        logger.error(f"Error getting conversation history: {str(e)}")
        raise HTTPException(status_code=500, detail="Internal server error")
