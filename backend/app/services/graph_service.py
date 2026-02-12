"""
Graph service for managing the knowledge graph lifecycle.
Handles node status changes, source attribution, and suggestion application.
"""
from typing import List, Dict, Any, Optional
from uuid import UUID
from datetime import datetime
from sqlalchemy.orm import Session as DBSession
from sqlalchemy import and_
from app.models.database import (
    Node, NodeType, NodeStatus, CardPriority, ChangeType,
    Source, SourceSuggestion, NodeHistory
)
from app.services.audit_service import audit_service
from app.core.logger import get_logger

logger = get_logger(__name__)


class GraphService:
    """
    Service for managing the knowledge graph state.
    Handles status changes, filtering, and suggestion application.
    """
    
    def update_node_status(
        self,
        database: DBSession,
        node_id: UUID,
        new_status: str,
        reason: Optional[str] = None,
        changed_by: Optional[UUID] = None,
        source_id: Optional[UUID] = None,
        cascade_to_children: bool = False,
    ) -> Dict[str, Any]:
        """
        Change a node's status with audit trail.
        
        Args:
            database: Database session
            node_id: Node to update
            new_status: New status value
            reason: Why the status changed
            changed_by: User making the change
            source_id: Source that triggered the change
            cascade_to_children: Apply status to all descendants
        
        Returns:
            Updated node data
        """
        node = database.query(Node).filter(Node.id == node_id).first()
        if not node:
            raise ValueError(f"Node {node_id} not found")
        
        old_status = node.status.value if node.status else "active"
        node.status = NodeStatus(new_status)
        node.updated_at = datetime.utcnow()
        
        # Record in audit trail
        audit_service.record_change(
            database=database,
            node_id=node_id,
            change_type=ChangeType.STATUS_CHANGED,
            field_changed="status",
            old_value=old_status,
            new_value=new_status,
            change_reason=reason,
            source_id=source_id,
            changed_by=changed_by,
        )
        
        # Cascade to children if requested
        if cascade_to_children:
            children = database.query(Node).filter(Node.parent_id == node_id).all()
            for child in children:
                self.update_node_status(
                    database=database,
                    node_id=child.id,
                    new_status=new_status,
                    reason=f"Cascaded from parent: {reason}" if reason else "Cascaded from parent",
                    changed_by=changed_by,
                    source_id=source_id,
                    cascade_to_children=True,
                )
        
        database.commit()
        database.refresh(node)
        
        return self._serialize_node(node)
    
    def get_filtered_nodes(
        self,
        database: DBSession,
        session_id: UUID,
        status_filter: Optional[str] = None,
        node_type_filter: Optional[str] = None,
    ) -> List[Dict[str, Any]]:
        """
        Get nodes filtered by status and/or type.
        
        Returns:
            List of serialized nodes matching the filters
        """
        query = database.query(Node).filter(Node.session_id == session_id)
        
        if status_filter:
            query = query.filter(Node.status == NodeStatus(status_filter))
        
        if node_type_filter:
            query = query.filter(Node.node_type == NodeType(node_type_filter))
        
        nodes = query.order_by(Node.depth, Node.order_index).all()
        
        return [self._serialize_node(node) for node in nodes]
    
    def apply_suggestion(
        self,
        database: DBSession,
        suggestion_id: UUID,
        is_approved: bool,
        approved_by: Optional[UUID] = None,
        edited_title: Optional[str] = None,
        edited_description: Optional[str] = None,
    ) -> Optional[Dict[str, Any]]:
        """
        Apply or reject a source suggestion.
        If approved, modifies the graph accordingly.
        
        Returns:
            The created/modified node data if approved, None if rejected
        """
        suggestion = database.query(SourceSuggestion).filter(
            SourceSuggestion.id == suggestion_id
        ).first()
        
        if not suggestion:
            raise ValueError(f"Suggestion {suggestion_id} not found")
        
        # Update suggestion status
        suggestion.is_approved = is_approved
        suggestion.approved_by = approved_by
        suggestion.approved_at = datetime.utcnow()
        
        if not is_approved:
            database.commit()
            logger.info(f"Suggestion {suggestion_id} rejected")
            return None
        
        # Get the source for attribution
        source = database.query(Source).filter(Source.id == suggestion.source_id).first()
        
        # Use edited values if provided
        title = edited_title or suggestion.title
        description = edited_description or suggestion.description
        
        result_node = None
        
        if suggestion.change_type == "add":
            # Create a new node
            parent_id = suggestion.parent_node_id
            
            # If no parent specified, find the root node
            if not parent_id and source:
                root_node = (
                    database.query(Node)
                    .filter(
                        and_(
                            Node.session_id == source.session_id,
                            Node.node_type == NodeType.ROOT,
                        )
                    )
                    .first()
                )
                if root_node:
                    parent_id = root_node.id
            
            # Determine depth from parent
            parent_depth = 0
            if parent_id:
                parent = database.query(Node).filter(Node.id == parent_id).first()
                if parent:
                    parent_depth = parent.depth
            
            # Count siblings for order_index
            sibling_count = database.query(Node).filter(Node.parent_id == parent_id).count()
            
            new_node = Node(
                session_id=source.session_id if source else None,
                parent_id=parent_id,
                question=title,
                answer=description,
                node_type=NodeType.FEATURE,
                status=NodeStatus.ACTIVE,
                source_id=suggestion.source_id,
                acceptance_criteria=suggestion.acceptance_criteria or [],
                depth=parent_depth + 1,
                order_index=sibling_count,
                can_expand=True,
                is_expanded=False,
            )
            database.add(new_node)
            database.flush()
            
            audit_service.record_change(
                database=database,
                node_id=new_node.id,
                change_type=ChangeType.CREATED,
                field_changed=None,
                new_value=title,
                change_reason=f"Added from source: {source.source_name}" if source else "Added from suggestion",
                source_id=suggestion.source_id,
                changed_by=approved_by,
            )
            
            result_node = new_node
        
        elif suggestion.change_type == "modify":
            if suggestion.target_node_id:
                target_node = database.query(Node).filter(
                    Node.id == suggestion.target_node_id
                ).first()
                
                if target_node:
                    old_question = target_node.question
                    old_answer = target_node.answer
                    
                    target_node.question = title
                    target_node.answer = description
                    target_node.updated_at = datetime.utcnow()
                    
                    audit_service.record_change(
                        database=database,
                        node_id=target_node.id,
                        change_type=ChangeType.MODIFIED,
                        field_changed="question",
                        old_value=old_question,
                        new_value=title,
                        change_reason=f"Modified from source: {source.source_name}" if source else "Modified from suggestion",
                        source_id=suggestion.source_id,
                        changed_by=approved_by,
                    )
                    
                    result_node = target_node
        
        elif suggestion.change_type == "defer":
            if suggestion.target_node_id:
                target_node = database.query(Node).filter(
                    Node.id == suggestion.target_node_id
                ).first()
                
                if target_node:
                    old_status = target_node.status.value
                    target_node.status = NodeStatus.DEFERRED
                    target_node.updated_at = datetime.utcnow()
                    
                    audit_service.record_change(
                        database=database,
                        node_id=target_node.id,
                        change_type=ChangeType.STATUS_CHANGED,
                        field_changed="status",
                        old_value=old_status,
                        new_value="deferred",
                        change_reason=f"Deferred from source: {source.source_name}" if source else "Deferred from suggestion",
                        source_id=suggestion.source_id,
                        changed_by=approved_by,
                    )
                    
                    result_node = target_node
        
        elif suggestion.change_type == "remove":
            if suggestion.target_node_id:
                target_node = database.query(Node).filter(
                    Node.id == suggestion.target_node_id
                ).first()
                
                if target_node:
                    old_status = target_node.status.value
                    target_node.status = NodeStatus.REMOVED
                    target_node.updated_at = datetime.utcnow()
                    
                    audit_service.record_change(
                        database=database,
                        node_id=target_node.id,
                        change_type=ChangeType.STATUS_CHANGED,
                        field_changed="status",
                        old_value=old_status,
                        new_value="removed",
                        change_reason=f"Removed from source: {source.source_name}" if source else "Removed from suggestion",
                        source_id=suggestion.source_id,
                        changed_by=approved_by,
                    )
                    
                    result_node = target_node
        
        database.commit()
        
        if result_node:
            database.refresh(result_node)
            return self._serialize_node(result_node)
        
        return None
    
    def _serialize_node(self, node: Node) -> Dict[str, Any]:
        """Serialize a node to a dictionary."""
        return {
            "id": str(node.id),
            "session_id": str(node.session_id),
            "parent_id": str(node.parent_id) if node.parent_id else None,
            "question": node.question,
            "answer": node.answer,
            "node_type": node.node_type.value,
            "status": node.status.value if node.status else "active",
            "priority": node.priority.value if node.priority else None,
            "acceptance_criteria": node.acceptance_criteria or [],
            "source_id": str(node.source_id) if node.source_id else None,
            "depth": node.depth,
            "order_index": node.order_index,
            "can_expand": node.can_expand,
            "is_expanded": node.is_expanded,
            "metadata": node.node_metadata or {},
            "created_at": node.created_at.isoformat(),
            "updated_at": node.updated_at.isoformat(),
        }


# Global instance
graph_service = GraphService()
