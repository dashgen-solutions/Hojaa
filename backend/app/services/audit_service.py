"""
Audit service for tracking all changes to the knowledge graph.
Provides full history, timeline, and change comparison capabilities.
"""
from typing import List, Optional, Dict, Any
from uuid import UUID
from datetime import datetime
from sqlalchemy.orm import Session as DBSession
from sqlalchemy import desc, and_
from app.models.database import (
    NodeHistory, Node, Source, User, ChangeType
)
from app.core.logger import get_logger

logger = get_logger(__name__)


class AuditService:
    """
    Service for recording and querying the audit trail.
    Every change to a node is logged for full accountability.
    """
    
    def record_change(
        self,
        database: DBSession,
        node_id: UUID,
        change_type: ChangeType,
        field_changed: Optional[str] = None,
        old_value: Optional[str] = None,
        new_value: Optional[str] = None,
        change_reason: Optional[str] = None,
        source_id: Optional[UUID] = None,
        changed_by: Optional[UUID] = None,
    ) -> NodeHistory:
        """
        Record a change to a node in the audit trail.
        
        Args:
            database: Database session
            node_id: ID of the node that changed
            change_type: Type of change (created, modified, status_changed, moved, deleted)
            field_changed: Which field changed (for modifications)
            old_value: Previous value
            new_value: New value
            change_reason: Why the change was made
            source_id: Source that triggered the change (meeting notes, etc.)
            changed_by: User who made the change
        
        Returns:
            The created NodeHistory record
        """
        history_entry = NodeHistory(
            node_id=node_id,
            change_type=change_type,
            field_changed=field_changed,
            old_value=old_value,
            new_value=new_value,
            change_reason=change_reason,
            source_id=source_id,
            changed_by=changed_by,
        )
        database.add(history_entry)
        return history_entry
    
    def get_node_history(
        self,
        database: DBSession,
        node_id: UUID,
    ) -> List[Dict[str, Any]]:
        """
        Get the full history for a specific node.
        
        Args:
            database: Database session
            node_id: Node to get history for
        
        Returns:
            List of history entries with enriched data
        """
        history_records = (
            database.query(NodeHistory)
            .filter(NodeHistory.node_id == node_id)
            .order_by(desc(NodeHistory.changed_at))
            .all()
        )
        
        enriched_entries = []
        for record in history_records:
            entry = {
                "id": str(record.id),
                "node_id": str(record.node_id),
                "change_type": record.change_type.value,
                "field_changed": record.field_changed,
                "old_value": record.old_value,
                "new_value": record.new_value,
                "change_reason": record.change_reason,
                "changed_at": record.changed_at.isoformat(),
                "source_name": None,
                "changed_by_name": None,
            }
            
            # Enrich with source name
            if record.source_id:
                source = database.query(Source).filter(Source.id == record.source_id).first()
                if source:
                    entry["source_name"] = source.source_name
            
            # Enrich with user name
            if record.changed_by:
                user = database.query(User).filter(User.id == record.changed_by).first()
                if user:
                    entry["changed_by_name"] = user.username
            
            enriched_entries.append(entry)
        
        return enriched_entries
    
    def get_session_timeline(
        self,
        database: DBSession,
        session_id: UUID,
        date_from: Optional[datetime] = None,
        date_to: Optional[datetime] = None,
        change_type_filter: Optional[str] = None,
        limit: int = 100,
        offset: int = 0,
    ) -> Dict[str, Any]:
        """
        Get the full audit timeline for a session.
        
        Args:
            database: Database session
            session_id: Session to get timeline for
            date_from: Filter changes from this date
            date_to: Filter changes to this date
            change_type_filter: Filter by change type
            limit: Maximum entries to return
            offset: Offset for pagination
        
        Returns:
            Timeline with enriched entries and total count
        """
        # Build base query — join nodes to filter by session
        base_query = (
            database.query(NodeHistory)
            .join(Node, NodeHistory.node_id == Node.id)
            .filter(Node.session_id == session_id)
        )
        
        # Apply filters
        if date_from:
            base_query = base_query.filter(NodeHistory.changed_at >= date_from)
        if date_to:
            base_query = base_query.filter(NodeHistory.changed_at <= date_to)
        if change_type_filter:
            base_query = base_query.filter(NodeHistory.change_type == change_type_filter)
        
        total_changes = base_query.count()
        
        history_records = (
            base_query
            .order_by(desc(NodeHistory.changed_at))
            .offset(offset)
            .limit(limit)
            .all()
        )
        
        timeline_entries = []
        for record in history_records:
            # Get node title
            node = database.query(Node).filter(Node.id == record.node_id).first()
            node_title = node.question if node else "Deleted Node"
            
            entry = {
                "id": str(record.id),
                "node_id": str(record.node_id),
                "node_title": node_title,
                "change_type": record.change_type.value,
                "field_changed": record.field_changed,
                "old_value": record.old_value,
                "new_value": record.new_value,
                "change_reason": record.change_reason,
                "changed_at": record.changed_at.isoformat(),
                "source_name": None,
                "changed_by_name": None,
            }
            
            # Enrich with source and user
            if record.source_id:
                source = database.query(Source).filter(Source.id == record.source_id).first()
                if source:
                    entry["source_name"] = source.source_name
            
            if record.changed_by:
                user = database.query(User).filter(User.id == record.changed_by).first()
                if user:
                    entry["changed_by_name"] = user.username
            
            timeline_entries.append(entry)
        
        return {
            "session_id": str(session_id),
            "total_changes": total_changes,
            "entries": timeline_entries,
        }


# Global instance
audit_service = AuditService()
