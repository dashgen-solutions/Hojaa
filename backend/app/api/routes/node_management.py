"""
Node management API routes.
Allows users to add, delete, and edit nodes in the requirements tree.
"""
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from uuid import UUID
from typing import List, Optional
from app.db.session import get_db
from app.models.database import Node, NodeType, Session as DBSession, Conversation
from app.models.schemas import NodeCreate, NodeUpdate, NodeResponse
from app.core.logger import get_logger
from app.core.exceptions import resource_not_found_error

logger = get_logger(__name__)
router = APIRouter(prefix="/nodes", tags=["node-management"])


@router.post("/add", response_model=NodeResponse, status_code=status.HTTP_201_CREATED)
async def add_node(
    node_data: NodeCreate,
    db: Session = Depends(get_db)
):
    """
    Add a new node to the requirements tree.
    
    Args:
        node_data: Node information including parent_id, question, answer
        db: Database session
    
    Returns:
        Created node
    """
    try:
        logger.info(f"Adding node to session {node_data.session_id}")
        
        # Verify session exists
        session = db.query(DBSession).filter(
            DBSession.id == UUID(node_data.session_id)
        ).first()
        if not session:
            raise resource_not_found_error("Session", node_data.session_id)
        
        # If parent_id provided, verify parent exists and calculate depth
        depth = 0
        if node_data.parent_id:
            parent_node = db.query(Node).filter(
                Node.id == UUID(node_data.parent_id)
            ).first()
            if not parent_node:
                raise resource_not_found_error("Parent node", node_data.parent_id)
            
            depth = parent_node.depth + 1
            
            # Get max order_index among siblings
            max_order_query = db.query(Node).filter(
                Node.parent_id == UUID(node_data.parent_id)
            ).order_by(Node.order_index.desc()).first()
            
            next_order_index = (max_order_query.order_index + 1) if max_order_query else 0
        else:
            # Root level node
            max_order_query = db.query(Node).filter(
                Node.session_id == UUID(node_data.session_id),
                Node.parent_id.is_(None)
            ).order_by(Node.order_index.desc()).first()
            
            next_order_index = (max_order_query.order_index + 1) if max_order_query else 0
        
        # Determine node type
        node_type = NodeType.FEATURE
        if depth == 0:
            node_type = NodeType.ROOT
        elif node_data.node_type:
            node_type = NodeType(node_data.node_type)
        
        # Create new node
        new_node = Node(
            session_id=UUID(node_data.session_id),
            parent_id=UUID(node_data.parent_id) if node_data.parent_id else None,
            question=node_data.question,
            answer=node_data.answer or "",
            node_type=node_type,
            depth=depth,
            order_index=next_order_index,
            can_expand=True,
            is_expanded=False,
            node_metadata=node_data.metadata or {}
        )
        
        db.add(new_node)
        db.commit()
        db.refresh(new_node)
        
        logger.info(f"Added node {new_node.id} to session {node_data.session_id}")
        
        return NodeResponse(
            id=str(new_node.id),
            session_id=str(new_node.session_id),
            parent_id=str(new_node.parent_id) if new_node.parent_id else None,
            question=new_node.question,
            answer=new_node.answer,
            node_type=new_node.node_type.value,
            depth=new_node.depth,
            order_index=new_node.order_index,
            can_expand=new_node.can_expand,
            is_expanded=new_node.is_expanded,
            metadata=new_node.node_metadata
        )
    
    except HTTPException:
        raise
    except Exception as error_instance:
        logger.error(f"Error adding node: {str(error_instance)}")
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to add node: {str(error_instance)}"
        )


@router.delete("/{node_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_node(
    node_id: str,
    cascade: bool = True,
    db: Session = Depends(get_db)
):
    """
    Delete a node from the requirements tree.
    
    Args:
        node_id: Node ID to delete
        cascade: If True, delete all child nodes. If False, move children up one level.
        db: Database session
    
    Returns:
        No content (204)
    """
    try:
        logger.info(f"Deleting node {node_id} (cascade={cascade})")
        
        # Find node
        node = db.query(Node).filter(Node.id == UUID(node_id)).first()
        if not node:
            raise resource_not_found_error("Node", node_id)
        
        # Prevent deleting root node
        if node.node_type == NodeType.ROOT:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Cannot delete root node"
            )
        
        # Check if node has children
        children = db.query(Node).filter(Node.parent_id == node.id).all()
        has_children = len(children) > 0
        
        # If node has children and cascade is False, prevent deletion with helpful message
        if has_children and not cascade:
            child_count = len(children)
            child_word = "child node" if child_count == 1 else "child nodes"
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Cannot delete this node because it has {child_count} {child_word}. Please delete the child nodes first, or use cascade deletion to delete this node and all its children."
            )
        
        session_id = node.session_id
        parent_id = node.parent_id
        deleted_order_index = node.order_index
        
        if cascade:
            # Delete node and all descendants (cascade delete)
            descendant_ids = _get_all_descendant_ids(node.id, db)
            descendant_ids.append(node.id)
            
            # Delete conversations for all nodes being deleted
            db.query(Conversation).filter(Conversation.node_id.in_(descendant_ids)).delete(
                synchronize_session=False
            )
            
            # Flush to ensure conversations are deleted before deleting nodes
            db.flush()
            
            # Delete all nodes
            db.query(Node).filter(Node.id.in_(descendant_ids)).delete(
                synchronize_session=False
            )
        else:
            # Get ALL descendants (children, grandchildren, etc.)
            descendant_ids = _get_all_descendant_ids(node.id, db)
            
            # Delete conversations for the node AND all its descendants
            # (conversations are context-specific and won't make sense after tree restructure)
            nodes_to_clear_conversations = [node.id] + descendant_ids
            db.query(Conversation).filter(
                Conversation.node_id.in_(nodes_to_clear_conversations)
            ).delete(synchronize_session=False)
            
            # Flush to ensure conversations are deleted before moving children
            db.flush()
            
            # Move direct children up one level to this node's parent
            children = db.query(Node).filter(Node.parent_id == node.id).all()
            
            for child in children:
                child.parent_id = parent_id
                child.depth -= 1
                # Recalculate depth for all descendants
                _update_descendant_depths(child.id, db)
            
            # Delete the node using direct query to avoid cascade triggers
            db.query(Node).filter(Node.id == node.id).delete(
                synchronize_session=False
            )
        
        # Reorder remaining siblings
        remaining_siblings = db.query(Node).filter(
            Node.session_id == session_id,
            Node.parent_id == parent_id,
            Node.order_index > deleted_order_index
        ).all()
        
        for sibling in remaining_siblings:
            sibling.order_index -= 1
        
        db.commit()
        
        logger.info(f"Deleted node {node_id}")
        return None
    
    except HTTPException:
        raise
    except Exception as error_instance:
        logger.error(f"Error deleting node: {str(error_instance)}")
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to delete node: {str(error_instance)}"
        )


@router.patch("/{node_id}", response_model=NodeResponse)
async def update_node(
    node_id: str,
    node_update: NodeUpdate,
    db: Session = Depends(get_db)
):
    """
    Update node question, answer, or metadata.
    
    Args:
        node_id: Node ID to update
        node_update: Fields to update
        db: Database session
    
    Returns:
        Updated node
    """
    try:
        logger.info(f"Updating node {node_id}")
        
        # Find node
        node = db.query(Node).filter(Node.id == UUID(node_id)).first()
        if not node:
            raise resource_not_found_error("Node", node_id)
        
        # Update fields if provided
        if node_update.question is not None:
            node.question = node_update.question
        
        if node_update.answer is not None:
            node.answer = node_update.answer
        
        if node_update.node_type is not None:
            # Don't allow changing root node type
            if node.node_type != NodeType.ROOT:
                node.node_type = NodeType(node_update.node_type)
        
        if node_update.metadata is not None:
            # Merge or replace metadata
            if node.node_metadata:
                node.node_metadata.update(node_update.metadata)
            else:
                node.node_metadata = node_update.metadata
        
        db.commit()
        db.refresh(node)
        
        logger.info(f"Updated node {node_id}")
        
        return NodeResponse(
            id=str(node.id),
            session_id=str(node.session_id),
            parent_id=str(node.parent_id) if node.parent_id else None,
            question=node.question,
            answer=node.answer,
            node_type=node.node_type.value,
            depth=node.depth,
            order_index=node.order_index,
            can_expand=node.can_expand,
            is_expanded=node.is_expanded,
            metadata=node.node_metadata
        )
    
    except HTTPException:
        raise
    except Exception as error_instance:
        logger.error(f"Error updating node: {str(error_instance)}")
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to update node: {str(error_instance)}"
        )


@router.post("/{node_id}/move", response_model=NodeResponse)
async def move_node(
    node_id: str,
    new_parent_id: Optional[str] = None,
    db: Session = Depends(get_db)
):
    """
    Move a node to a different parent in the tree.
    
    Args:
        node_id: Node ID to move
        new_parent_id: New parent node ID (None for root level)
        db: Database session
    
    Returns:
        Updated node
    """
    try:
        logger.info(f"Moving node {node_id} to parent {new_parent_id}")
        
        # Find node
        node = db.query(Node).filter(Node.id == UUID(node_id)).first()
        if not node:
            raise resource_not_found_error("Node", node_id)
        
        # Prevent moving root node
        if node.node_type == NodeType.ROOT:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Cannot move root node"
            )
        
        # Verify new parent exists (if provided)
        new_depth = 0
        if new_parent_id:
            new_parent = db.query(Node).filter(Node.id == UUID(new_parent_id)).first()
            if not new_parent:
                raise resource_not_found_error("New parent node", new_parent_id)
            
            # Prevent moving to own descendant
            descendant_ids = _get_all_descendant_ids(node.id, db)
            if UUID(new_parent_id) in descendant_ids:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail="Cannot move node to its own descendant"
                )
            
            new_depth = new_parent.depth + 1
        
        # Calculate depth change
        depth_change = new_depth - node.depth
        
        # Update node parent and depth
        old_parent_id = node.parent_id
        old_order_index = node.order_index
        
        node.parent_id = UUID(new_parent_id) if new_parent_id else None
        node.depth = new_depth
        
        # Get new order_index
        max_order_query = db.query(Node).filter(
            Node.parent_id == node.parent_id
        ).order_by(Node.order_index.desc()).first()
        
        node.order_index = (max_order_query.order_index + 1) if max_order_query else 0
        
        # Update all descendant depths
        _update_descendant_depths_by_change(node.id, depth_change, db)
        
        # Reorder old siblings
        old_siblings = db.query(Node).filter(
            Node.parent_id == old_parent_id,
            Node.order_index > old_order_index
        ).all()
        
        for sibling in old_siblings:
            sibling.order_index -= 1
        
        db.commit()
        db.refresh(node)
        
        logger.info(f"Moved node {node_id}")
        
        return NodeResponse(
            id=str(node.id),
            session_id=str(node.session_id),
            parent_id=str(node.parent_id) if node.parent_id else None,
            question=node.question,
            answer=node.answer,
            node_type=node.node_type.value,
            depth=node.depth,
            order_index=node.order_index,
            can_expand=node.can_expand,
            is_expanded=node.is_expanded,
            metadata=node.node_metadata
        )
    
    except HTTPException:
        raise
    except Exception as error_instance:
        logger.error(f"Error moving node: {str(error_instance)}")
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to move node: {str(error_instance)}"
        )


# Helper functions

def _get_all_descendant_ids(node_id: UUID, db: Session) -> List[UUID]:
    """
    Get all descendant node IDs recursively.
    
    Args:
        node_id: Starting node ID
        db: Database session
    
    Returns:
        List of descendant node IDs
    """
    descendant_ids = []
    
    children = db.query(Node).filter(Node.parent_id == node_id).all()
    
    for child in children:
        descendant_ids.append(child.id)
        # Recursively get child's descendants
        descendant_ids.extend(_get_all_descendant_ids(child.id, db))
    
    return descendant_ids


def _update_descendant_depths(node_id: UUID, db: Session):
    """
    Update depths of all descendants after parent depth changed.
    
    Args:
        node_id: Node whose descendants need depth update
        db: Database session
    """
    node = db.query(Node).filter(Node.id == node_id).first()
    if not node:
        return
    
    children = db.query(Node).filter(Node.parent_id == node_id).all()
    
    for child in children:
        child.depth = node.depth + 1
        _update_descendant_depths(child.id, db)


def _update_descendant_depths_by_change(node_id: UUID, depth_change: int, db: Session):
    """
    Update depths of all descendants by a specific amount.
    
    Args:
        node_id: Node whose descendants need depth update
        depth_change: Amount to change depth by
        db: Database session
    """
    children = db.query(Node).filter(Node.parent_id == node_id).all()
    
    for child in children:
        child.depth += depth_change
        _update_descendant_depths_by_change(child.id, depth_change, db)
