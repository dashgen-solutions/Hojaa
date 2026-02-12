"""
Export service for generating scope documents in PDF, JSON, and Markdown formats.
Produces formal deliverables from the knowledge graph.
"""
import json
from typing import Dict, Any, Optional, List
from uuid import UUID
from datetime import datetime
from sqlalchemy.orm import Session as DBSession
from sqlalchemy import desc, or_
from app.models.database import (
    Node, NodeType, NodeStatus, NodeHistory, Source, Session as SessionModel,
    Card, CardStatus, Assignment, TeamMember
)
from app.core.logger import get_logger

logger = get_logger(__name__)


class ExportService:
    """
    Service for exporting the knowledge graph to various formats.
    Supports PDF, JSON, and Markdown exports.
    """
    
    def export_markdown(
        self,
        database: DBSession,
        session_id: UUID,
        include_deferred: bool = False,
        include_change_log: bool = False,
        include_assignments: bool = False,
        date_from: Optional[datetime] = None,
    ) -> str:
        """
        Export the scope document as Markdown.
        
        Returns:
            Markdown string of the scope document
        """
        session = database.query(SessionModel).filter(SessionModel.id == session_id).first()
        if not session:
            raise ValueError(f"Session {session_id} not found")
        
        # Get root node
        root_node = (
            database.query(Node)
            .filter(Node.session_id == session_id, Node.node_type == NodeType.ROOT)
            .first()
        )
        
        project_name = root_node.question if root_node else "Untitled Project"
        project_description = root_node.answer if root_node else ""
        
        lines = []
        lines.append(f"# Project Scope Document: {project_name}")
        lines.append("")
        lines.append(f"**Generated:** {datetime.utcnow().strftime('%B %d, %Y at %H:%M UTC')}")
        lines.append(f"**Session:** {session.document_filename or 'Untitled'}")
        lines.append("")
        lines.append("---")
        lines.append("")
        
        # ── Section 1: Executive Summary ──
        lines.append("## 1. Executive Summary")
        lines.append("")
        if project_description:
            lines.append(project_description)
        else:
            lines.append("*No project description available.*")
        lines.append("")
        
        # ── Section 2: Active Scope Items ──
        lines.append("## 2. Scope Items")
        lines.append("")
        
        # Include nodes with ACTIVE status OR NULL status (treats NULL as active)
        active_nodes = (
            database.query(Node)
            .filter(
                Node.session_id == session_id,
                or_(Node.status == NodeStatus.ACTIVE, Node.status.is_(None)),
                Node.node_type != NodeType.ROOT,
            )
            .order_by(Node.depth, Node.order_index)
            .all()
        )
        
        if active_nodes:
            self._render_nodes_as_markdown(lines, active_nodes, database)
        else:
            lines.append("*No scope items have been defined yet.*")
            lines.append("")
        
        # Dynamic section counter (sections 1 and 2 are always present)
        next_section_number = 3
        
        # ── Deferred Items (optional) ──
        if include_deferred:
            lines.append("")
            lines.append(f"## {next_section_number}. Deferred Items")
            next_section_number += 1
            lines.append("")
            
            deferred_nodes = (
                database.query(Node)
                .filter(
                    Node.session_id == session_id,
                    Node.status == NodeStatus.DEFERRED,
                )
                .order_by(Node.depth, Node.order_index)
                .all()
            )
            
            if deferred_nodes:
                lines.append("*These items have been deferred to a later phase.*")
                lines.append("")
                for node in deferred_nodes:
                    lines.append(f"- **{node.question}**")
                    if node.answer:
                        lines.append(f"  {node.answer}")
                    # Find deferral reason from history
                    deferral_history = (
                        database.query(NodeHistory)
                        .filter(
                            NodeHistory.node_id == node.id,
                            NodeHistory.change_type == "status_changed",
                            NodeHistory.new_value == "deferred",
                        )
                        .first()
                    )
                    if deferral_history and deferral_history.change_reason:
                        lines.append(f"  *Reason: {deferral_history.change_reason}*")
                    lines.append("")
            else:
                lines.append("*No items have been deferred.*")
                lines.append("")
        
        # ── Change Log (optional) ──
        if include_change_log:
            lines.append("")
            lines.append(f"## {next_section_number}. Change Log")
            next_section_number += 1
            lines.append("")
            
            history_query = (
                database.query(NodeHistory)
                .join(Node, NodeHistory.node_id == Node.id)
                .filter(Node.session_id == session_id)
            )
            
            if date_from:
                history_query = history_query.filter(NodeHistory.changed_at >= date_from)
            
            history_records = (
                history_query
                .order_by(desc(NodeHistory.changed_at))
                .limit(50)
                .all()
            )
            
            if history_records:
                lines.append("| Date | Node | Change | Details |")
                lines.append("|------|------|--------|---------|")
                
                for record in history_records:
                    node = database.query(Node).filter(Node.id == record.node_id).first()
                    node_name = node.question if node else "Deleted"
                    date_string = record.changed_at.strftime("%b %d, %Y")
                    change_description = record.change_type.value.replace("_", " ").title()
                    detail = record.change_reason or ""
                    if record.field_changed:
                        detail = f"{record.field_changed}: {detail}"
                    lines.append(f"| {date_string} | {node_name} | {change_description} | {detail} |")
                lines.append("")
            else:
                lines.append("*No changes have been recorded yet.*")
                lines.append("")
        
        # ── Team Assignments (optional) ──
        if include_assignments:
            lines.append("")
            lines.append(f"## {next_section_number}. Team Assignments")
            next_section_number += 1
            lines.append("")
            
            # List all team members in this session
            team_members = (
                database.query(TeamMember)
                .filter(TeamMember.session_id == session_id)
                .all()
            )
            
            if team_members:
                lines.append("**Team Members:**")
                lines.append("")
                for member in team_members:
                    role_label = f" ({member.role})" if member.role else ""
                    email_label = f" - {member.email}" if member.email else ""
                    lines.append(f"- **{member.name}**{role_label}{email_label}")
                lines.append("")
            
            # Show all planning cards with their assignments
            cards = (
                database.query(Card)
                .filter(Card.session_id == session_id)
                .all()
            )
            
            if cards:
                lines.append("**Planning Board:**")
                lines.append("")
                lines.append("| Feature | Status | Priority | Assignee | Role |")
                lines.append("|---------|--------|----------|----------|------|")
                
                for card in cards:
                    node = database.query(Node).filter(Node.id == card.node_id).first()
                    node_name = node.question if node else "Unknown"
                    card_status = card.status.value.replace("_", " ").title()
                    card_priority = card.priority.value.title() if card.priority else "-"
                    
                    # Get assignments for this card
                    card_assignments = (
                        database.query(Assignment)
                        .filter(Assignment.card_id == card.id)
                        .all()
                    )
                    
                    if card_assignments:
                        for assignment in card_assignments:
                            member = database.query(TeamMember).filter(
                                TeamMember.id == assignment.team_member_id
                            ).first()
                            member_name = member.name if member else "Unassigned"
                            assignment_role = assignment.role.value.title()
                            lines.append(
                                f"| {node_name} | {card_status} | "
                                f"{card_priority} | {member_name} | {assignment_role} |"
                            )
                    else:
                        # Show card even without assignments
                        lines.append(
                            f"| {node_name} | {card_status} | "
                            f"{card_priority} | - | - |"
                        )
                lines.append("")
            
            # If nothing at all (no team members AND no cards)
            if not team_members and not cards:
                lines.append("*No team members or planning cards have been created yet.*")
                lines.append("")
        
        lines.append("---")
        lines.append("")
        lines.append(f"*Generated by MoMetric on {datetime.utcnow().strftime('%B %d, %Y')}*")
        
        return "\n".join(lines)
    
    def export_json(
        self,
        database: DBSession,
        session_id: UUID,
        include_deferred: bool = False,
        include_change_log: bool = False,
        include_assignments: bool = False,
    ) -> str:
        """
        Export the scope document as structured JSON.
        
        Returns:
            JSON string of the scope document
        """
        session = database.query(SessionModel).filter(SessionModel.id == session_id).first()
        if not session:
            raise ValueError(f"Session {session_id} not found")
        
        # Build tree structure
        root_node = (
            database.query(Node)
            .filter(Node.session_id == session_id, Node.node_type == NodeType.ROOT)
            .first()
        )
        
        status_filter = [NodeStatus.ACTIVE]
        if include_deferred:
            status_filter.append(NodeStatus.DEFERRED)
        
        all_nodes = (
            database.query(Node)
            .filter(
                Node.session_id == session_id,
                or_(Node.status.in_(status_filter), Node.status.is_(None)),
            )
            .order_by(Node.depth, Node.order_index)
            .all()
        )
        
        export_data = {
            "project": {
                "name": root_node.question if root_node else "Untitled",
                "description": root_node.answer if root_node else "",
                "session_id": str(session_id),
                "generated_at": datetime.utcnow().isoformat(),
            },
            "scope_items": [self._node_to_dict(node) for node in all_nodes if node.node_type != NodeType.ROOT],
        }
        
        if include_assignments:
            cards = database.query(Card).filter(Card.session_id == session_id).all()
            export_data["planning"] = {
                "total_cards": len(cards),
                "completed": sum(1 for card in cards if card.status == CardStatus.DONE),
                "cards": [
                    {
                        "node_id": str(card.node_id),
                        "status": card.status.value,
                        "priority": card.priority.value,
                        "due_date": card.due_date.isoformat() if card.due_date else None,
                    }
                    for card in cards
                ],
            }
        
        return json.dumps(export_data, indent=2, default=str)
    
    def _render_nodes_as_markdown(
        self,
        lines: List[str],
        nodes: List[Node],
        database: DBSession,
    ) -> None:
        """Render nodes as a hierarchical markdown list."""
        # Build a lookup of children by parent_id
        children_by_parent = {}
        for node in nodes:
            parent_key = str(node.parent_id) if node.parent_id else None
            if parent_key not in children_by_parent:
                children_by_parent[parent_key] = []
            children_by_parent[parent_key].append(node)
        
        # Get top-level nodes (depth 1 = direct children of ROOT)
        feature_nodes = [node for node in nodes if node.depth == 1]
        
        # Fallback: if no depth-1 nodes, grab the shallowest non-root nodes
        if not feature_nodes:
            min_depth = min((node.depth for node in nodes), default=0)
            feature_nodes = [node for node in nodes if node.depth == min_depth]
        
        for feature_index, feature in enumerate(feature_nodes, 1):
            lines.append(f"### 2.{feature_index} {feature.question}")
            lines.append("")
            if feature.answer:
                lines.append(feature.answer)
                lines.append("")
            
            # Render acceptance criteria for this feature
            if feature.acceptance_criteria:
                lines.append("**Acceptance Criteria:**")
                for criterion in feature.acceptance_criteria:
                    lines.append(f"- [ ] {criterion}")
                lines.append("")
            
            # Render all children recursively
            self._render_child_nodes(lines, nodes, str(feature.id), indent_level=0)
    
    def _render_child_nodes(
        self,
        lines: List[str],
        all_nodes: List[Node],
        parent_id: str,
        indent_level: int,
    ) -> None:
        """Recursively render child nodes under a parent as markdown bullets."""
        child_nodes = [
            node for node in all_nodes
            if str(node.parent_id) == parent_id
        ]
        
        if not child_nodes:
            return
        
        # Indent prefix: each level gets 2 extra spaces
        base_indent = "  " * indent_level
        
        for child in child_nodes:
            lines.append(f"{base_indent}- **{child.question}**")
            if child.answer:
                lines.append(f"{base_indent}  {child.answer}")
            if child.acceptance_criteria:
                for criterion in child.acceptance_criteria:
                    lines.append(f"{base_indent}  - [ ] {criterion}")
            
            # Recurse into deeper children
            self._render_child_nodes(lines, all_nodes, str(child.id), indent_level + 1)
        
        lines.append("")
    
    def _node_to_dict(self, node: Node) -> Dict[str, Any]:
        """Convert a node to a dictionary for JSON export."""
        return {
            "id": str(node.id),
            "parent_id": str(node.parent_id) if node.parent_id else None,
            "title": node.question,
            "description": node.answer,
            "type": node.node_type.value,
            "status": node.status.value if node.status else "active",
            "priority": node.priority.value if node.priority else None,
            "acceptance_criteria": node.acceptance_criteria or [],
            "depth": node.depth,
        }


# Global instance
export_service = ExportService()
