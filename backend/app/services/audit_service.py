"""
Audit service for tracking all changes to the knowledge graph.
Provides full history, timeline, and change comparison capabilities.
"""
from typing import List, Optional, Dict, Any
from uuid import UUID
from datetime import datetime
from sqlalchemy.orm import Session as DBSession
from sqlalchemy import desc, asc, and_, or_
from app.models.database import (
    NodeHistory, Node, NodeType, NodeStatus, Source, User, ChangeType
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
        session_id: Optional[UUID] = None,
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
            session_id: Session this change belongs to
        
        Returns:
            The created NodeHistory record
        """
        # Auto-resolve session_id from the node if not provided
        if session_id is None:
            node = database.query(Node).filter(Node.id == node_id).first()
            if node:
                session_id = node.session_id
        
        history_entry = NodeHistory(
            session_id=session_id,
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
        changed_by_filter: Optional[str] = None,
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
            changed_by_filter: Filter by user ID
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
        if changed_by_filter:
            base_query = base_query.filter(NodeHistory.changed_by == changed_by_filter)
        
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
                "source_id": str(record.source_id) if record.source_id else None,
                "source_name": None,
                "changed_by": str(record.changed_by) if record.changed_by else None,
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


    def get_graph_state_at(
        self,
        database: DBSession,
        session_id: UUID,
        as_of_date: datetime,
    ) -> Dict[str, Any]:
        """
        Reconstruct the graph as it existed at a specific point in time.
        
        Works by:
        1. Getting all nodes that existed at that date (created_at <= as_of_date)
        2. Replaying audit history up to that date to determine each node's state
        
        Returns:
            Snapshot of the graph with node states as of the given date
        """
        # Get all nodes created on or before the target date
        nodes_at_date = (
            database.query(Node)
            .filter(
                Node.session_id == session_id,
                Node.created_at <= as_of_date,
            )
            .order_by(Node.depth, Node.order_index)
            .all()
        )
        
        snapshot_nodes = []
        
        for node in nodes_at_date:
            # Get the most recent status change for this node before the target date
            last_status_change = (
                database.query(NodeHistory)
                .filter(
                    NodeHistory.node_id == node.id,
                    NodeHistory.change_type == ChangeType.STATUS_CHANGED,
                    NodeHistory.field_changed == "status",
                    NodeHistory.changed_at <= as_of_date,
                )
                .order_by(desc(NodeHistory.changed_at))
                .first()
            )
            
            # Determine the status at that point in time
            if last_status_change:
                status_at_date = last_status_change.new_value
            else:
                # No status change recorded before target date — use "active" as default
                status_at_date = "active"
            
            # Get the last title/description as of that date
            last_title_change = (
                database.query(NodeHistory)
                .filter(
                    NodeHistory.node_id == node.id,
                    NodeHistory.change_type == ChangeType.MODIFIED,
                    NodeHistory.field_changed == "question",
                    NodeHistory.changed_at <= as_of_date,
                )
                .order_by(desc(NodeHistory.changed_at))
                .first()
            )
            
            title_at_date = last_title_change.new_value if last_title_change else node.question
            
            # Get the last answer/description as of that date
            last_answer_change = (
                database.query(NodeHistory)
                .filter(
                    NodeHistory.node_id == node.id,
                    NodeHistory.change_type == ChangeType.MODIFIED,
                    NodeHistory.field_changed == "answer",
                    NodeHistory.changed_at <= as_of_date,
                )
                .order_by(desc(NodeHistory.changed_at))
                .first()
            )
            
            description_at_date = last_answer_change.new_value if last_answer_change else node.answer
            
            # Get the last parent_id as of that date (for accurate tree structure)
            last_move = (
                database.query(NodeHistory)
                .filter(
                    NodeHistory.node_id == node.id,
                    NodeHistory.change_type == ChangeType.MOVED,
                    NodeHistory.field_changed == "parent_id",
                    NodeHistory.changed_at <= as_of_date,
                )
                .order_by(desc(NodeHistory.changed_at))
                .first()
            )
            
            parent_id_at_date = last_move.new_value if last_move else (str(node.parent_id) if node.parent_id else None)
            
            snapshot_nodes.append({
                "id": str(node.id),
                "parent_id": parent_id_at_date,
                "title": title_at_date,
                "description": description_at_date,
                "node_type": node.node_type.value,
                "status": status_at_date,
                "depth": node.depth,
                "created_at": node.created_at.isoformat(),
            })
        
        # Count by status
        status_counts = {}
        for snapshot_node in snapshot_nodes:
            node_status = snapshot_node["status"]
            status_counts[node_status] = status_counts.get(node_status, 0) + 1
        
        return {
            "session_id": str(session_id),
            "as_of_date": as_of_date.isoformat(),
            "total_nodes": len(snapshot_nodes),
            "status_counts": status_counts,
            "nodes": snapshot_nodes,
        }
    
    def compare_graph_states(
        self,
        database: DBSession,
        session_id: UUID,
        date_from: datetime,
        date_to: datetime,
    ) -> Dict[str, Any]:
        """
        Compare the graph between two dates and produce a diff.
        
        Shows:
        - Nodes added between the two dates
        - Nodes removed (status changed to removed)
        - Nodes modified (title, description, status changes)
        - Nodes deferred
        
        Returns:
            Diff report between the two dates
        """
        # Get all audit entries between the two dates for this session
        changes_between = (
            database.query(NodeHistory)
            .join(Node, NodeHistory.node_id == Node.id)
            .filter(
                Node.session_id == session_id,
                NodeHistory.changed_at > date_from,
                NodeHistory.changed_at <= date_to,
            )
            .order_by(asc(NodeHistory.changed_at))
            .all()
        )
        
        # Also find nodes created between the two dates
        nodes_added = (
            database.query(Node)
            .filter(
                Node.session_id == session_id,
                Node.created_at > date_from,
                Node.created_at <= date_to,
            )
            .all()
        )
        
        # Build diff categories
        added = []
        removed = []
        modified = []
        deferred = []
        status_changes = []
        
        # Track which nodes we've already categorized
        processed_node_ids = set()
        
        # Process newly created nodes
        for node in nodes_added:
            added.append({
                "node_id": str(node.id),
                "title": node.question,
                "node_type": node.node_type.value,
                "status": node.status.value if node.status else "active",
                "created_at": node.created_at.isoformat(),
                "parent_id": str(node.parent_id) if node.parent_id else None,
            })
            processed_node_ids.add(str(node.id))
        
        # Process audit history changes
        for record in changes_between:
            node_id_str = str(record.node_id)
            node = database.query(Node).filter(Node.id == record.node_id).first()
            node_title = node.question if node else "Deleted Node"
            
            change_entry = {
                "node_id": node_id_str,
                "title": node_title,
                "change_type": record.change_type.value,
                "field_changed": record.field_changed,
                "old_value": record.old_value,
                "new_value": record.new_value,
                "reason": record.change_reason,
                "changed_at": record.changed_at.isoformat(),
            }
            
            # Categorize the change
            if record.change_type == ChangeType.STATUS_CHANGED:
                if record.new_value == "removed":
                    if node_id_str not in processed_node_ids:
                        removed.append(change_entry)
                        processed_node_ids.add(node_id_str)
                elif record.new_value == "deferred":
                    if node_id_str not in processed_node_ids:
                        deferred.append(change_entry)
                        processed_node_ids.add(node_id_str)
                else:
                    status_changes.append(change_entry)
            
            elif record.change_type == ChangeType.MODIFIED:
                modified.append(change_entry)
        
        return {
            "session_id": str(session_id),
            "date_from": date_from.isoformat(),
            "date_to": date_to.isoformat(),
            "summary": {
                "added_count": len(added),
                "removed_count": len(removed),
                "modified_count": len(modified),
                "deferred_count": len(deferred),
                "status_changes_count": len(status_changes),
                "total_changes": len(changes_between),
            },
            "added": added,
            "removed": removed,
            "modified": modified,
            "deferred": deferred,
            "status_changes": status_changes,
        }


    def revert_node(
        self,
        database: DBSession,
        node_id: UUID,
        history_entry_id: UUID,
        changed_by: Optional[UUID] = None,
    ) -> Dict[str, Any]:
        """
        Revert a node to the state it had before a specific history entry.
        
        Applies the old_value from the target history entry back to the node.
        Records the revert as a new MODIFIED audit entry.
        
        Args:
            database: Database session
            node_id: Node to revert
            history_entry_id: The history entry whose old_value to restore
            changed_by: User performing the revert
        
        Returns:
            Dict with reverted field and values
        """
        node = database.query(Node).filter(Node.id == node_id).first()
        if not node:
            raise ValueError(f"Node {node_id} not found")
        
        history_entry = (
            database.query(NodeHistory)
            .filter(
                NodeHistory.id == history_entry_id,
                NodeHistory.node_id == node_id,
            )
            .first()
        )
        if not history_entry:
            raise ValueError(f"History entry {history_entry_id} not found for node {node_id}")
        
        field = history_entry.field_changed
        old_value = history_entry.old_value
        
        if not field or old_value is None:
            raise ValueError("Cannot revert: history entry has no field or old value to restore")
        
        # Apply the revert
        current_value = None
        if field == "question":
            current_value = node.question
            node.question = old_value
        elif field == "answer":
            current_value = node.answer
            node.answer = old_value
        elif field == "status":
            current_value = node.status.value if node.status else "active"
            node.status = NodeStatus(old_value)
        elif field == "parent_id":
            current_value = str(node.parent_id) if node.parent_id else None
            node.parent_id = UUID(old_value) if old_value else None
        else:
            raise ValueError(f"Cannot revert field: {field}")
        
        # Record the revert in audit trail
        self.record_change(
            database=database,
            node_id=node_id,
            change_type=ChangeType.MODIFIED,
            field_changed=field,
            old_value=current_value,
            new_value=old_value,
            change_reason=f"Reverted to previous value (from entry {str(history_entry_id)[:8]})",
            changed_by=changed_by,
            session_id=node.session_id,
        )
        
        database.flush()
        
        return {
            "node_id": str(node_id),
            "field": field,
            "reverted_from": current_value,
            "reverted_to": old_value,
            "history_entry_id": str(history_entry_id),
        }
    
    def compare_node_versions(
        self,
        database: DBSession,
        node_id: UUID,
        entry_id_a: UUID,
        entry_id_b: UUID,
    ) -> Dict[str, Any]:
        """
        Compare two history entries for the same node side-by-side.
        
        Args:
            database: Database session
            node_id: Node to compare versions for
            entry_id_a: First history entry ID (older)
            entry_id_b: Second history entry ID (newer)
        
        Returns:
            Side-by-side comparison dict
        """
        node = database.query(Node).filter(Node.id == node_id).first()
        if not node:
            raise ValueError(f"Node {node_id} not found")
        
        entry_a = database.query(NodeHistory).filter(
            NodeHistory.id == entry_id_a, NodeHistory.node_id == node_id
        ).first()
        entry_b = database.query(NodeHistory).filter(
            NodeHistory.id == entry_id_b, NodeHistory.node_id == node_id
        ).first()
        
        if not entry_a or not entry_b:
            raise ValueError("One or both history entries not found for this node")
        
        def entry_to_dict(entry: NodeHistory) -> Dict[str, Any]:
            return {
                "id": str(entry.id),
                "change_type": entry.change_type.value,
                "field_changed": entry.field_changed,
                "old_value": entry.old_value,
                "new_value": entry.new_value,
                "change_reason": entry.change_reason,
                "changed_at": entry.changed_at.isoformat(),
            }
        
        return {
            "node_id": str(node_id),
            "node_title": node.question,
            "version_a": entry_to_dict(entry_a),
            "version_b": entry_to_dict(entry_b),
        }
    
    def export_audit_report(
        self,
        database: DBSession,
        session_id: UUID,
        date_from: Optional[datetime] = None,
        date_to: Optional[datetime] = None,
    ) -> str:
        """
        Generate a standalone audit report as Markdown.
        
        Args:
            database: Database session
            session_id: Session to generate report for
            date_from: Optional start date filter
            date_to: Optional end date filter
        
        Returns:
            Markdown string with the full audit report
        """
        from app.models.database import Session as SessionModel
        
        session = database.query(SessionModel).filter(SessionModel.id == session_id).first()
        if not session:
            raise ValueError(f"Session {session_id} not found")
        
        project_name = session.document_filename or "Untitled Project"
        
        # Get timeline data
        timeline = self.get_session_timeline(
            database=database,
            session_id=session_id,
            date_from=date_from,
            date_to=date_to,
            limit=500,
        )
        
        lines: list[str] = []
        lines.append(f"# Audit Report: {project_name}")
        lines.append("")
        lines.append(f"**Generated:** {datetime.utcnow().strftime('%B %d, %Y at %H:%M UTC')}")
        if date_from:
            lines.append(f"**Period:** {date_from.strftime('%B %d, %Y')} – {(date_to or datetime.utcnow()).strftime('%B %d, %Y')}")
        lines.append(f"**Total changes:** {timeline['total_changes']}")
        lines.append("")
        lines.append("---")
        lines.append("")
        
        # Summary by change type
        type_counts: Dict[str, int] = {}
        user_counts: Dict[str, int] = {}
        for entry in timeline["entries"]:
            ct = entry["change_type"]
            type_counts[ct] = type_counts.get(ct, 0) + 1
            user = entry.get("changed_by_name") or "System"
            user_counts[user] = user_counts.get(user, 0) + 1
        
        lines.append("## Summary by Change Type")
        lines.append("")
        lines.append("| Change Type | Count |")
        lines.append("|-------------|-------|")
        for ct, count in sorted(type_counts.items()):
            lines.append(f"| {ct.replace('_', ' ').title()} | {count} |")
        lines.append("")
        
        lines.append("## Summary by User")
        lines.append("")
        lines.append("| User | Changes |")
        lines.append("|------|---------|")
        for user, count in sorted(user_counts.items(), key=lambda x: -x[1]):
            lines.append(f"| {user} | {count} |")
        lines.append("")
        
        # Detailed change log
        lines.append("## Detailed Change Log")
        lines.append("")
        lines.append("| Date | Time | Node | Change | Field | Old Value | New Value | By | Source | Reason |")
        lines.append("|------|------|------|--------|-------|-----------|-----------|----|--------|--------|")
        
        for entry in timeline["entries"]:
            date_str = datetime.fromisoformat(entry["changed_at"]).strftime("%b %d")
            time_str = datetime.fromisoformat(entry["changed_at"]).strftime("%H:%M")
            node_title = entry["node_title"][:30]
            change = entry["change_type"].replace("_", " ").title()
            field = entry["field_changed"] or "-"
            old_val = (entry["old_value"] or "-")[:25]
            new_val = (entry["new_value"] or "-")[:25]
            user = entry.get("changed_by_name") or "-"
            source = entry.get("source_name") or "-"
            reason = (entry.get("change_reason") or "-")[:30]
            lines.append(f"| {date_str} | {time_str} | {node_title} | {change} | {field} | {old_val} | {new_val} | {user} | {source} | {reason} |")
        
        lines.append("")
        lines.append("---")
        lines.append(f"*Generated by MoMetric on {datetime.utcnow().strftime('%B %d, %Y')}*")
        
        return "\n".join(lines)
    
    def get_session_users(
        self,
        database: DBSession,
        session_id: UUID,
    ) -> List[Dict[str, str]]:
        """
        Get all users who have made changes in a session (for user filter dropdown).
        
        Returns:
            List of {id, username} dicts
        """
        user_ids = (
            database.query(NodeHistory.changed_by)
            .join(Node, NodeHistory.node_id == Node.id)
            .filter(
                Node.session_id == session_id,
                NodeHistory.changed_by.isnot(None),
            )
            .distinct()
            .all()
        )
        
        users = []
        for (user_id,) in user_ids:
            user = database.query(User).filter(User.id == user_id).first()
            if user:
                users.append({"id": str(user.id), "username": user.username})
        
        return users


# Global instance
audit_service = AuditService()
