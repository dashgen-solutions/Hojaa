"""
Node management API routes.
Allows users to add, delete, and edit nodes in the requirements tree.
"""
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from uuid import UUID
from typing import List, Optional
from app.db.session import get_db
from app.models.database import Node, NodeType, NodeStatus, ChangeType, Session as DBSession, Conversation, TeamMember, Assignment, AssignmentRole, Card
from app.models.schemas import NodeCreate, NodeUpdate, NodeResponse
from app.core.logger import get_logger
from app.core.exceptions import resource_not_found_error
from app.core.auth import get_optional_user
from app.models.database import User
from app.services.audit_service import audit_service
from app.services.notification_service import notification_service

logger = get_logger(__name__)
router = APIRouter(prefix="/nodes", tags=["node-management"])


@router.post("/add", response_model=NodeResponse, status_code=status.HTTP_201_CREATED)
async def add_node(
    node_data: NodeCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_optional_user),
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
        db.flush()
        
        # Record creation in audit trail
        audit_service.record_change(
            database=db,
            node_id=new_node.id,
            change_type=ChangeType.CREATED,
            new_value=new_node.question,
            changed_by=current_user.id if current_user else None,
            session_id=UUID(node_data.session_id),
        )
        
        db.commit()
        db.refresh(new_node)
        
        # Fire email notification (non-blocking, errors are logged)
        try:
            notification_service.notify_node_change(
                db=db,
                session_id=UUID(node_data.session_id),
                node_id=new_node.id,
                change_type=ChangeType.CREATED.value,
                new_value=new_node.question,
                changed_by=current_user.id if current_user else None,
            )
        except Exception:
            pass  # never fail the request for a notification error
        
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
    db: Session = Depends(get_db),
    current_user: User = Depends(get_optional_user),
):
    """
    Delete a node from the requirements tree.
    Always cascades — if the node has children, they are deleted too.
    
    Args:
        node_id: Node ID to delete
        cascade: Kept for backward compatibility (always treated as True)
        db: Database session
    
    Returns:
        No content (204)
    """
    try:
        logger.info(f"Deleting node {node_id} (always cascade)")
        
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
        
        # Check if node has children (for info in response, but always cascade)
        children = db.query(Node).filter(Node.parent_id == node.id).all()
        has_children = len(children) > 0
        
        session_id = node.session_id
        parent_id = node.parent_id
        deleted_order_index = node.order_index
        
        # Record deletion in audit trail before actually deleting
        audit_service.record_change(
            database=db,
            node_id=node.id,
            change_type=ChangeType.DELETED,
            old_value=node.question,
            changed_by=current_user.id if current_user else None,
            session_id=session_id,
        )
        
        # Fire email notification before deletion removes the node
        try:
            notification_service.notify_node_change(
                db=db,
                session_id=session_id,
                node_id=node.id,
                change_type=ChangeType.DELETED.value,
                old_value=node.question,
                changed_by=current_user.id if current_user else None,
            )
        except Exception:
            pass
        
        # Always cascade delete — delete node and all descendants
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
    db: Session = Depends(get_db),
    current_user: User = Depends(get_optional_user),
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
        
        # Update fields if provided, recording each change
        content_changed = False

        if node_update.question is not None:
            old_question = node.question
            node.question = node_update.question
            if old_question != node_update.question:
                content_changed = True
                audit_service.record_change(
                    database=db,
                    node_id=node.id,
                    change_type=ChangeType.MODIFIED,
                    field_changed="question",
                    old_value=old_question,
                    new_value=node_update.question,
                    changed_by=current_user.id if current_user else None,
                    session_id=node.session_id,
                )
        
        if node_update.answer is not None:
            old_answer = node.answer
            node.answer = node_update.answer
            if old_answer != node_update.answer:
                content_changed = True
                audit_service.record_change(
                    database=db,
                    node_id=node.id,
                    change_type=ChangeType.MODIFIED,
                    field_changed="answer",
                    old_value=old_answer,
                    new_value=node_update.answer,
                    changed_by=current_user.id if current_user else None,
                    session_id=node.session_id,
                )
        
        # Mark node status as modified so it shows up in the "Modified" filter
        if content_changed and node.status not in (NodeStatus.COMPLETED, NodeStatus.REMOVED):
            node.status = NodeStatus.MODIFIED
        
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
        
        # Fire email notification for modifications
        try:
            notification_service.notify_node_change(
                db=db,
                session_id=node.session_id,
                node_id=node.id,
                change_type=ChangeType.MODIFIED.value,
                changed_by=current_user.id if current_user else None,
            )
        except Exception:
            pass
        
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
    db: Session = Depends(get_db),
    current_user: User = Depends(get_optional_user),
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
        
        # Record move in audit trail
        audit_service.record_change(
            database=db,
            node_id=node.id,
            change_type=ChangeType.MOVED,
            field_changed="parent_id",
            old_value=str(old_parent_id) if old_parent_id else None,
            new_value=new_parent_id,
            changed_by=current_user.id if current_user else None,
            session_id=node.session_id,
        )
        
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
        
        # Fire email notification for move
        try:
            notification_service.notify_node_change(
                db=db,
                session_id=node.session_id,
                node_id=node.id,
                change_type=ChangeType.MOVED.value,
                field_changed="parent_id",
                old_value=str(old_parent_id) if old_parent_id else None,
                new_value=new_parent_id,
                changed_by=current_user.id if current_user else None,
            )
        except Exception:
            pass
        
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


# ===== AI-3.1: Smart Status Suggestions =====

@router.post("/{node_id}/suggest-status")
async def suggest_status(
    node_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_optional_user),
):
    """AI-powered status suggestion based on node context, children, and history."""
    try:
        from app.services.ai_features_service import suggest_status as _suggest
        suggestions = await _suggest(db, UUID(node_id), user_id=current_user.id if current_user else None)
        return {"suggestions": suggestions}
    except ValueError as error:
        raise HTTPException(status_code=404, detail=str(error))
    except Exception as error:
        logger.error(f"Error suggesting status: {error}")
        raise HTTPException(status_code=500, detail=str(error))


# ===== DEC-1.3: Node-Level Assignment =====

@router.post("/{node_id}/assign")
async def assign_node(
    node_id: str,
    body: dict,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_optional_user),
):
    """Assign a team member directly to a node (DEC-1.3)."""
    try:
        team_member_id = body.get("team_member_id")
        if not team_member_id:
            raise HTTPException(status_code=400, detail="team_member_id is required")

        node = db.query(Node).filter(Node.id == UUID(node_id)).first()
        if not node:
            raise resource_not_found_error("Node", node_id)

        member = db.query(TeamMember).filter(TeamMember.id == UUID(team_member_id)).first()
        if not member:
            raise resource_not_found_error("Team member", team_member_id)

        # Update the direct_assignee shortcut on the node
        node.assigned_to = member.id

        # Upsert an Assignment record (node-level)
        existing = (
            db.query(Assignment)
            .filter(Assignment.node_id == UUID(node_id), Assignment.team_member_id == member.id, Assignment.card_id.is_(None))
            .first()
        )
        if not existing:
            assignment = Assignment(
                node_id=UUID(node_id),
                team_member_id=member.id,
                role=AssignmentRole.ASSIGNEE,
                assigned_by=current_user.id if current_user else None,
            )
            db.add(assignment)

        # Also assign on the linked planning card (if one exists)
        linked_card = db.query(Card).filter(Card.node_id == UUID(node_id)).first()
        if linked_card:
            card_assignment_exists = (
                db.query(Assignment)
                .filter(
                    Assignment.card_id == linked_card.id,
                    Assignment.team_member_id == member.id,
                )
                .first()
            )
            if not card_assignment_exists:
                db.add(Assignment(
                    card_id=linked_card.id,
                    node_id=UUID(node_id),
                    team_member_id=member.id,
                    role=AssignmentRole.ASSIGNEE,
                    assigned_by=current_user.id if current_user else None,
                ))

        # Audit trail
        audit_service.record_change(
            database=db,
            node_id=UUID(node_id),
            change_type=ChangeType.MODIFIED,
            field_changed="assigned_to",
            new_value=member.name,
            changed_by=current_user.id if current_user else None,
            session_id=node.session_id,
        )

        db.commit()
        db.refresh(node)

        return {
            "node_id": str(node.id),
            "assigned_to": str(member.id),
            "assignee_name": member.name,
            "assignee_avatar_color": member.avatar_color,
        }

    except HTTPException:
        raise
    except Exception as error:
        logger.error(f"Error assigning node: {error}")
        db.rollback()
        raise HTTPException(status_code=500, detail=str(error))


@router.delete("/{node_id}/assign")
async def unassign_node(
    node_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_optional_user),
):
    """Remove the direct assignment from a node."""
    try:
        node = db.query(Node).filter(Node.id == UUID(node_id)).first()
        if not node:
            raise resource_not_found_error("Node", node_id)

        old_assignee_name = None
        if node.assigned_to and node.direct_assignee:
            old_assignee_name = node.direct_assignee.name

        old_member_id = node.assigned_to
        node.assigned_to = None

        # Remove node-level assignment records
        db.query(Assignment).filter(
            Assignment.node_id == UUID(node_id),
            Assignment.card_id.is_(None),
        ).delete(synchronize_session="fetch")

        # Also remove from linked planning card
        if old_member_id:
            linked_card = db.query(Card).filter(Card.node_id == UUID(node_id)).first()
            if linked_card:
                db.query(Assignment).filter(
                    Assignment.card_id == linked_card.id,
                    Assignment.team_member_id == old_member_id,
                ).delete(synchronize_session="fetch")

        # Audit trail
        audit_service.record_change(
            database=db,
            node_id=UUID(node_id),
            change_type=ChangeType.MODIFIED,
            field_changed="assigned_to",
            old_value=old_assignee_name,
            new_value=None,
            changed_by=current_user.id if current_user else None,
            session_id=node.session_id,
        )

        db.commit()
        return {"node_id": str(node.id), "assigned_to": None}

    except HTTPException:
        raise
    except Exception as error:
        logger.error(f"Error unassigning node: {error}")
        db.rollback()
        raise HTTPException(status_code=500, detail=str(error))


# ===== Activate All Nodes =====

@router.post("/{session_id}/activate-all")
async def activate_all_nodes(
    session_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_optional_user),
):
    """
    Set all non-removed nodes in a session to ACTIVE status.
    Useful for quickly enabling all nodes before card generation.
    """
    try:
        session_uuid = UUID(session_id)

        # Verify session exists
        session = db.query(DBSession).filter(DBSession.id == session_uuid).first()
        if not session:
            raise resource_not_found_error("Session", session_id)

        # Get all non-removed, non-active nodes
        nodes = (
            db.query(Node)
            .filter(
                Node.session_id == session_uuid,
                Node.status != NodeStatus.ACTIVE,
                Node.status != NodeStatus.REMOVED,
            )
            .all()
        )

        activated_count = 0
        for node in nodes:
            old_status = node.status.value if node.status else "active"
            node.status = NodeStatus.ACTIVE

            audit_service.record_change(
                database=db,
                node_id=node.id,
                change_type=ChangeType.STATUS_CHANGED,
                field_changed="status",
                old_value=old_status,
                new_value="active",
                changed_by=current_user.id if current_user else None,
                session_id=session_uuid,
            )
            activated_count += 1

        db.commit()

        logger.info(f"Activated {activated_count} nodes in session {session_id}")
        return {
            "success": True,
            "activated_count": activated_count,
            "message": f"Activated {activated_count} nodes",
        }

    except HTTPException:
        raise
    except Exception as error:
        logger.error(f"Error activating all nodes: {error}")
        db.rollback()
        raise HTTPException(status_code=500, detail=str(error))
