"""
Tree API routes for requirements tree operations.
"""
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from uuid import UUID
from typing import List, Dict, Any
from app.db.session import get_db
from app.models.schemas import NodeResponse
from app.models.database import Node
from app.core.logger import get_logger

logger = get_logger(__name__)
router = APIRouter(prefix="/tree", tags=["tree"])


def node_to_dict(node: Node, db: Session) -> Dict[str, Any]:
    """Convert a Node SQLAlchemy object to a dictionary with children loaded."""
    # Load children
    children = db.query(Node).filter(
        Node.parent_id == node.id
    ).order_by(Node.order_index).all()
    
    return {
        "id": node.id,
        "question": node.question,
        "answer": node.answer,
        "node_type": node.node_type.value,
        "depth": node.depth,
        "order_index": node.order_index,
        "can_expand": node.can_expand,
        "is_expanded": node.is_expanded,
        "children": [node_to_dict(child, db) for child in children]
    }


@router.get("/{session_id}")
async def get_tree(
    session_id: UUID,
    db: Session = Depends(get_db)
):
    """Get complete requirements tree for a session."""
    try:
        logger.info(f"Getting tree for session {session_id}")
        
        # Get root node
        root_node = db.query(Node).filter(
            Node.session_id == session_id,
            Node.parent_id == None
        ).first()
        
        if not root_node:
            raise HTTPException(status_code=404, detail="Tree not found")
        
        # Convert to dict with all children loaded recursively
        tree_dict = node_to_dict(root_node, db)
        
        return {"tree": tree_dict, "session_id": session_id}
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error getting tree: {str(e)}")
        raise HTTPException(status_code=500, detail="Internal server error")


@router.get("/node/{node_id}")
async def get_node(
    node_id: UUID,
    db: Session = Depends(get_db)
):
    """Get a specific node with its children."""
    try:
        node = db.query(Node).filter(Node.id == node_id).first()
        
        if not node:
            raise HTTPException(status_code=404, detail="Node not found")
        
        # Convert to dict with children
        node_dict = node_to_dict(node, db)
        
        return {"node": node_dict}
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error getting node: {str(e)}")
        raise HTTPException(status_code=500, detail="Internal server error")
