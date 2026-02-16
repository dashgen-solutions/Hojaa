"""
Export service for generating scope documents in PDF, JSON, and Markdown formats.
Produces formal deliverables from the knowledge graph.

Supports:
- Markdown with YAML frontmatter, source attribution, conversations
- JSON with audit trail, sources, full planning cards, schema info
- Standalone change-log report with date grouping
- Detail levels: summary / detailed / full
- Completed-node toggle, source references, conversation history
"""
import json
from typing import Dict, Any, Optional, List
from uuid import UUID
from datetime import datetime
from collections import defaultdict
from sqlalchemy.orm import Session as DBSession
from sqlalchemy import desc, or_
from app.models.database import (
    Node, NodeType, NodeStatus, NodeHistory, Source, Session as SessionModel,
    Card, CardStatus, Assignment, TeamMember, Conversation, Message,
    AcceptanceCriterion, CardComment,
)
from app.core.logger import get_logger

logger = get_logger(__name__)


class ExportService:
    """
    Service for exporting the knowledge graph to various formats.
    Supports PDF, JSON, and Markdown exports with rich options.
    """

    # ──────────────────────────────────────────────────────────
    #  MARKDOWN EXPORT
    # ──────────────────────────────────────────────────────────

    def export_markdown(
        self,
        database: DBSession,
        session_id: UUID,
        include_deferred: bool = False,
        include_change_log: bool = False,
        include_assignments: bool = False,
        include_sources: bool = False,
        include_completed: bool = False,
        include_conversations: bool = False,
        detail_level: str = "detailed",
        date_from: Optional[datetime] = None,
    ) -> str:
        """
        Export the scope document as Markdown.

        Args:
            detail_level: 'summary' (titles only), 'detailed' (titles + descriptions),
                          'full' (everything including acceptance criteria)
        Returns:
            Markdown string of the scope document
        """
        session = database.query(SessionModel).filter(SessionModel.id == session_id).first()
        if not session:
            raise ValueError(f"Session {session_id} not found")

        root_node = (
            database.query(Node)
            .filter(Node.session_id == session_id, Node.node_type == NodeType.ROOT)
            .first()
        )

        project_name = root_node.question if root_node else "Untitled Project"
        project_description = root_node.answer if root_node else ""

        lines: list[str] = []

        # ── YAML-style frontmatter ──
        lines.append("---")
        lines.append(f"title: \"{project_name}\"")
        lines.append(f"generated: \"{datetime.utcnow().strftime('%Y-%m-%dT%H:%M:%SZ')}\"")
        lines.append(f"session: \"{session.document_filename or 'Untitled'}\"")
        lines.append(f"format: markdown")
        lines.append(f"detail_level: {detail_level}")
        lines.append("---")
        lines.append("")

        lines.append(f"# Project Scope Document: {project_name}")
        lines.append("")
        lines.append(f"**Generated:** {datetime.utcnow().strftime('%B %d, %Y at %H:%M UTC')}")
        lines.append(f"**Session:** {session.document_filename or 'Untitled'}")
        lines.append(f"**Detail Level:** {detail_level.title()}")
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

        status_filter = [NodeStatus.ACTIVE, NodeStatus.NEW, NodeStatus.MODIFIED]
        if include_completed:
            status_filter.append(NodeStatus.COMPLETED)

        active_nodes = (
            database.query(Node)
            .filter(
                Node.session_id == session_id,
                or_(Node.status.in_(status_filter), Node.status.is_(None)),
                Node.node_type != NodeType.ROOT,
            )
            .order_by(Node.depth, Node.order_index)
            .all()
        )

        if active_nodes:
            self._render_nodes_as_markdown(lines, active_nodes, database, detail_level, include_sources)
        else:
            lines.append("*No scope items have been defined yet.*")
            lines.append("")

        # Dynamic section counter
        next_section = 3

        # ── Completed Items (if toggled and there are any) ──
        if include_completed:
            completed_nodes = [n for n in active_nodes if n.status == NodeStatus.COMPLETED]
            if completed_nodes:
                lines.append("")
                lines.append(f"## {next_section}. Completed Items")
                next_section += 1
                lines.append("")
                lines.append(f"*{len(completed_nodes)} item(s) marked as completed.*")
                lines.append("")
                for node in completed_nodes:
                    lines.append(f"- ~~{node.question}~~")
                    if detail_level != "summary" and node.answer:
                        lines.append(f"  {node.answer}")
                lines.append("")

        # ── Deferred Items (optional) ──
        if include_deferred:
            lines.append("")
            lines.append(f"## {next_section}. Deferred Items")
            next_section += 1
            lines.append("")

            deferred_nodes = (
                database.query(Node)
                .filter(Node.session_id == session_id, Node.status == NodeStatus.DEFERRED)
                .order_by(Node.depth, Node.order_index)
                .all()
            )

            if deferred_nodes:
                lines.append("*These items have been deferred to a later phase.*")
                lines.append("")
                for node in deferred_nodes:
                    deferral_history = (
                        database.query(NodeHistory)
                        .filter(
                            NodeHistory.node_id == node.id,
                            NodeHistory.change_type == "status_changed",
                            NodeHistory.new_value == "deferred",
                        )
                        .order_by(NodeHistory.changed_at.desc())
                        .first()
                    )
                    defer_date = deferral_history.changed_at.strftime("%b %d, %Y") if deferral_history else ""
                    defer_reason = ""
                    if deferral_history and deferral_history.change_reason:
                        defer_reason = deferral_history.change_reason

                    lines.append(f"- **{node.question}**")
                    if detail_level != "summary" and node.answer:
                        lines.append(f"  {node.answer}")
                    if defer_date:
                        lines.append(f"  *Deferred on: {defer_date}*")
                    if defer_reason:
                        lines.append(f"  *Reason: {defer_reason}*")
                    lines.append("")
            else:
                lines.append("*No items have been deferred.*")
                lines.append("")

        # ── Sources (optional) ──
        if include_sources:
            lines.append("")
            lines.append(f"## {next_section}. Sources")
            next_section += 1
            lines.append("")

            sources = (
                database.query(Source)
                .filter(Source.session_id == session_id)
                .order_by(Source.created_at)
                .all()
            )

            if sources:
                for src in sources:
                    src_type = src.source_type.value.replace("_", " ").title() if src.source_type else "Unknown"
                    lines.append(f"### {src.source_name}")
                    lines.append(f"- **Type:** {src_type}")
                    lines.append(f"- **Added:** {src.created_at.strftime('%B %d, %Y')}")
                    if src.processed_summary:
                        lines.append(f"- **Summary:** {src.processed_summary}")

                    # Count nodes linked to this source
                    linked_count = database.query(Node).filter(Node.source_id == src.id).count()
                    if linked_count:
                        lines.append(f"- **Linked items:** {linked_count}")
                    lines.append("")
            else:
                lines.append("*No sources have been added.*")
                lines.append("")

        # ── Change Log (optional) ──
        if include_change_log:
            lines.append("")
            lines.append(f"## {next_section}. Change Log")
            next_section += 1
            lines.append("")

            self._render_change_log(lines, database, session_id, date_from, include_sources)

        # ── Team Assignments (optional) ──
        if include_assignments:
            lines.append("")
            lines.append(f"## {next_section}. Team Assignments")
            next_section += 1
            lines.append("")

            self._render_assignments(lines, database, session_id)

        # ── Conversations (optional) ──
        if include_conversations:
            lines.append("")
            lines.append(f"## {next_section}. Conversation History")
            next_section += 1
            lines.append("")

            self._render_conversations_markdown(lines, database, session_id)

        lines.append("---")
        lines.append("")
        lines.append(f"*Generated by MoMetric on {datetime.utcnow().strftime('%B %d, %Y')}*")

        return "\n".join(lines)

    # ──────────────────────────────────────────────────────────
    #  DEFERRED STANDALONE REPORT
    # ──────────────────────────────────────────────────────────

    def export_deferred_markdown(
        self,
        database: DBSession,
        session_id: UUID,
    ) -> str:
        """
        Export only deferred items as a standalone Phase 2 document
        with deferral dates.
        """
        session = database.query(SessionModel).filter(SessionModel.id == session_id).first()
        if not session:
            raise ValueError(f"Session {session_id} not found")

        project_name = session.document_filename or "Untitled Project"

        deferred_nodes = (
            database.query(Node)
            .filter(Node.session_id == session_id, Node.status == NodeStatus.DEFERRED)
            .order_by(Node.depth, Node.order_index)
            .all()
        )

        lines: list[str] = []
        lines.append(f"# {project_name} — Phase 2 (Deferred Items)")
        lines.append("")
        lines.append("*Items deferred from the active scope for future consideration.*")
        lines.append(f"*Generated: {datetime.utcnow().strftime('%B %d, %Y at %H:%M UTC')}*")
        lines.append("")

        if not deferred_nodes:
            lines.append("*No items have been deferred.*")
        else:
            lines.append(f"**Total deferred items:** {len(deferred_nodes)}")
            lines.append("")
            lines.append("| # | Item | Description | Reason | Deferred On |")
            lines.append("|---|------|-------------|--------|-------------|")

            for idx, node in enumerate(deferred_nodes, 1):
                description = (node.answer or "").replace("\n", " ").strip() or "—"
                reason = (node.deferred_reason or "").replace("\n", " ").strip()

                history = (
                    database.query(NodeHistory)
                    .filter(
                        NodeHistory.node_id == node.id,
                        NodeHistory.change_type == "status_changed",
                        NodeHistory.new_value == "deferred",
                    )
                    .order_by(NodeHistory.changed_at.desc())
                    .first()
                )

                if not reason and history and history.change_reason:
                    reason = history.change_reason
                reason = reason or "—"

                defer_date = history.changed_at.strftime("%b %d, %Y") if history else "—"

                lines.append(
                    f"| {idx} | **{node.question}** | {description} | {reason} | {defer_date} |"
                )

            lines.append("")

        lines.append("---")
        lines.append(f"*Generated by MoMetric on {datetime.utcnow().strftime('%B %d, %Y')}*")

        return "\n".join(lines)

    # ──────────────────────────────────────────────────────────
    #  STANDALONE CHANGE LOG
    # ──────────────────────────────────────────────────────────

    def export_changelog_markdown(
        self,
        database: DBSession,
        session_id: UUID,
        date_from: Optional[datetime] = None,
        include_sources: bool = False,
    ) -> str:
        """
        Export a standalone change-log report grouped by date.
        """
        session = database.query(SessionModel).filter(SessionModel.id == session_id).first()
        if not session:
            raise ValueError(f"Session {session_id} not found")

        project_name = session.document_filename or "Untitled Project"
        lines: list[str] = []
        lines.append(f"# Change Log: {project_name}")
        lines.append("")
        lines.append(f"*Generated: {datetime.utcnow().strftime('%B %d, %Y at %H:%M UTC')}*")
        if date_from:
            lines.append(f"*Changes since: {date_from.strftime('%B %d, %Y')}*")
        lines.append("")
        lines.append("---")
        lines.append("")

        self._render_change_log(lines, database, session_id, date_from, include_sources, grouped=True)

        lines.append("---")
        lines.append(f"*Generated by MoMetric on {datetime.utcnow().strftime('%B %d, %Y')}*")

        return "\n".join(lines)

    # ──────────────────────────────────────────────────────────
    #  JSON EXPORT
    # ──────────────────────────────────────────────────────────

    def export_json(
        self,
        database: DBSession,
        session_id: UUID,
        include_deferred: bool = False,
        include_change_log: bool = False,
        include_assignments: bool = False,
        include_sources: bool = False,
        include_completed: bool = False,
        include_conversations: bool = False,
        detail_level: str = "detailed",
        date_from: Optional[datetime] = None,
    ) -> str:
        """
        Export the scope document as structured JSON with optional sections.
        """
        session = database.query(SessionModel).filter(SessionModel.id == session_id).first()
        if not session:
            raise ValueError(f"Session {session_id} not found")

        root_node = (
            database.query(Node)
            .filter(Node.session_id == session_id, Node.node_type == NodeType.ROOT)
            .first()
        )

        status_filter = [NodeStatus.ACTIVE, NodeStatus.NEW, NodeStatus.MODIFIED]
        if include_deferred:
            status_filter.append(NodeStatus.DEFERRED)
        if include_completed:
            status_filter.append(NodeStatus.COMPLETED)

        all_nodes = (
            database.query(Node)
            .filter(
                Node.session_id == session_id,
                or_(Node.status.in_(status_filter), Node.status.is_(None)),
            )
            .order_by(Node.depth, Node.order_index)
            .all()
        )

        export_data: Dict[str, Any] = {
            "$schema": "https://mometric.io/schemas/scope-export-v1.json",
            "version": "1.0",
            "project": {
                "name": root_node.question if root_node else "Untitled",
                "description": root_node.answer if root_node else "",
                "session_id": str(session_id),
                "generated_at": datetime.utcnow().isoformat(),
                "detail_level": detail_level,
            },
            "scope_items": [
                self._node_to_dict(node, database, detail_level, include_sources)
                for node in all_nodes
                if node.node_type != NodeType.ROOT
            ],
        }

        # ── Sources ──
        if include_sources:
            sources = (
                database.query(Source)
                .filter(Source.session_id == session_id)
                .order_by(Source.created_at)
                .all()
            )
            export_data["sources"] = [
                {
                    "id": str(src.id),
                    "name": src.source_name,
                    "type": src.source_type.value if src.source_type else None,
                    "summary": src.processed_summary,
                    "is_processed": src.is_processed,
                    "created_at": src.created_at.isoformat() if src.created_at else None,
                    "linked_nodes": [
                        str(n.id) for n in database.query(Node).filter(Node.source_id == src.id).all()
                    ],
                }
                for src in sources
            ]

        # ── Audit Trail / Change Log ──
        if include_change_log:
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
                .limit(200)
                .all()
            )
            export_data["audit_trail"] = [
                {
                    "id": str(rec.id),
                    "node_id": str(rec.node_id),
                    "change_type": rec.change_type.value if hasattr(rec.change_type, 'value') else str(rec.change_type),
                    "field_changed": rec.field_changed,
                    "old_value": rec.old_value,
                    "new_value": rec.new_value,
                    "change_reason": rec.change_reason,
                    "changed_at": rec.changed_at.isoformat() if rec.changed_at else None,
                    "changed_by": str(rec.changed_by) if rec.changed_by else None,
                    "source_id": str(rec.source_id) if rec.source_id else None,
                }
                for rec in history_records
            ]

        # ── Planning / Assignments (full card data) ──
        if include_assignments:
            cards = database.query(Card).filter(Card.session_id == session_id).all()
            export_data["planning"] = {
                "total_cards": len(cards),
                "completed": sum(1 for c in cards if c.status == CardStatus.DONE),
                "cards": [self._card_to_dict(card, database) for card in cards],
            }

            team_members = (
                database.query(TeamMember)
                .filter(TeamMember.session_id == session_id)
                .all()
            )
            export_data["team"] = [
                {
                    "id": str(m.id),
                    "name": m.name,
                    "email": m.email,
                    "role": m.role,
                }
                for m in team_members
            ]

        # ── Conversations ──
        if include_conversations:
            conversations = (
                database.query(Conversation)
                .filter(Conversation.session_id == session_id)
                .all()
            )
            export_data["conversations"] = []
            for convo in conversations:
                messages = (
                    database.query(Message)
                    .filter(Message.conversation_id == convo.id)
                    .order_by(Message.created_at)
                    .all()
                )
                node = database.query(Node).filter(Node.id == convo.node_id).first()
                export_data["conversations"].append({
                    "id": str(convo.id),
                    "node_id": str(convo.node_id),
                    "node_title": node.question if node else "Unknown",
                    "status": convo.status.value if hasattr(convo.status, 'value') else str(convo.status),
                    "created_at": convo.created_at.isoformat() if convo.created_at else None,
                    "messages": [
                        {
                            "role": msg.role.value if hasattr(msg.role, 'value') else str(msg.role),
                            "content": msg.content,
                            "created_at": msg.created_at.isoformat() if msg.created_at else None,
                        }
                        for msg in messages
                    ],
                })

        return json.dumps(export_data, indent=2, default=str)

    # ──────────────────────────────────────────────────────────
    #  PRIVATE HELPERS
    # ──────────────────────────────────────────────────────────

    def _render_nodes_as_markdown(
        self,
        lines: List[str],
        nodes: List[Node],
        database: DBSession,
        detail_level: str = "detailed",
        include_sources: bool = False,
    ) -> None:
        """Render nodes as hierarchical markdown."""
        feature_nodes = [node for node in nodes if node.depth == 1]
        if not feature_nodes:
            min_depth = min((node.depth for node in nodes), default=0)
            feature_nodes = [node for node in nodes if node.depth == min_depth]

        for feature_index, feature in enumerate(feature_nodes, 1):
            status_badge = self._status_badge(feature.status)
            lines.append(f"### 2.{feature_index} {feature.question} {status_badge}")
            lines.append("")

            if detail_level != "summary" and feature.answer:
                lines.append(feature.answer)
                lines.append("")

            # Source attribution
            if include_sources and feature.source_id:
                source = database.query(Source).filter(Source.id == feature.source_id).first()
                if source:
                    lines.append(f"*Source: {source.source_name}*")
                    lines.append("")

            # Acceptance criteria (full detail only)
            if detail_level == "full" and feature.acceptance_criteria:
                lines.append("**Acceptance Criteria:**")
                for criterion in feature.acceptance_criteria:
                    lines.append(f"- [ ] {criterion}")
                lines.append("")

            # Render children
            self._render_child_nodes(lines, nodes, str(feature.id), 0, detail_level, include_sources, database)

    def _render_child_nodes(
        self,
        lines: List[str],
        all_nodes: List[Node],
        parent_id: str,
        indent_level: int,
        detail_level: str = "detailed",
        include_sources: bool = False,
        database: Optional[DBSession] = None,
    ) -> None:
        """Recursively render child nodes as markdown bullets."""
        child_nodes = [n for n in all_nodes if str(n.parent_id) == parent_id]
        if not child_nodes:
            return

        indent = "  " * indent_level

        for child in child_nodes:
            status_badge = self._status_badge(child.status)
            lines.append(f"{indent}- **{child.question}** {status_badge}")

            if detail_level != "summary" and child.answer:
                lines.append(f"{indent}  {child.answer}")

            # Source link
            if include_sources and child.source_id and database:
                source = database.query(Source).filter(Source.id == child.source_id).first()
                if source:
                    lines.append(f"{indent}  *Source: {source.source_name}*")

            if detail_level == "full" and child.acceptance_criteria:
                for criterion in child.acceptance_criteria:
                    lines.append(f"{indent}  - [ ] {criterion}")

            self._render_child_nodes(
                lines, all_nodes, str(child.id), indent_level + 1,
                detail_level, include_sources, database,
            )

        lines.append("")

    def _render_change_log(
        self,
        lines: List[str],
        database: DBSession,
        session_id: UUID,
        date_from: Optional[datetime] = None,
        include_sources: bool = False,
        grouped: bool = False,
    ) -> None:
        """Render change log — optionally grouped by date."""
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
            .limit(200)
            .all()
        )

        if not history_records:
            lines.append("*No changes have been recorded yet.*")
            lines.append("")
            return

        if grouped:
            # Group by date
            by_date: Dict[str, list] = defaultdict(list)
            for rec in history_records:
                day_key = rec.changed_at.strftime("%B %d, %Y") if rec.changed_at else "Unknown"
                by_date[day_key].append(rec)

            for day, records in by_date.items():
                lines.append(f"### {day}")
                lines.append("")
                for rec in records:
                    node = database.query(Node).filter(Node.id == rec.node_id).first()
                    node_name = node.question if node else "Deleted"
                    change_desc = rec.change_type.value.replace("_", " ").title() if hasattr(rec.change_type, 'value') else str(rec.change_type)
                    detail = rec.change_reason or ""
                    if rec.field_changed:
                        detail = f"{rec.field_changed}: {detail}"

                    source_ref = ""
                    if include_sources and rec.source_id:
                        src = database.query(Source).filter(Source.id == rec.source_id).first()
                        if src:
                            source_ref = f" *(via {src.source_name})*"

                    time_str = rec.changed_at.strftime("%H:%M") if rec.changed_at else ""
                    lines.append(f"- **{time_str}** — {node_name}: {change_desc}. {detail}{source_ref}")

                lines.append("")
        else:
            # Flat table
            if include_sources:
                lines.append("| Date | Node | Change | Details | Source |")
                lines.append("|------|------|--------|---------|--------|")
            else:
                lines.append("| Date | Node | Change | Details |")
                lines.append("|------|------|--------|---------|")

            for rec in history_records:
                node = database.query(Node).filter(Node.id == rec.node_id).first()
                node_name = node.question if node else "Deleted"
                date_string = rec.changed_at.strftime("%b %d, %Y") if rec.changed_at else ""
                change_desc = rec.change_type.value.replace("_", " ").title() if hasattr(rec.change_type, 'value') else str(rec.change_type)
                detail = rec.change_reason or ""
                if rec.field_changed:
                    detail = f"{rec.field_changed}: {detail}"

                if include_sources:
                    source_ref = "—"
                    if rec.source_id:
                        src = database.query(Source).filter(Source.id == rec.source_id).first()
                        if src:
                            source_ref = src.source_name
                    lines.append(f"| {date_string} | {node_name} | {change_desc} | {detail} | {source_ref} |")
                else:
                    lines.append(f"| {date_string} | {node_name} | {change_desc} | {detail} |")

            lines.append("")

    def _render_assignments(
        self,
        lines: List[str],
        database: DBSession,
        session_id: UUID,
    ) -> None:
        """Render team members and planning board assignments."""
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

        cards = database.query(Card).filter(Card.session_id == session_id).all()

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
                    lines.append(
                        f"| {node_name} | {card_status} | "
                        f"{card_priority} | - | - |"
                    )
            lines.append("")

        if not team_members and not cards:
            lines.append("*No team members or planning cards have been created yet.*")
            lines.append("")

    def _render_conversations_markdown(
        self,
        lines: List[str],
        database: DBSession,
        session_id: UUID,
    ) -> None:
        """Render conversation history grouped by node."""
        conversations = (
            database.query(Conversation)
            .filter(Conversation.session_id == session_id)
            .order_by(Conversation.created_at)
            .all()
        )

        if not conversations:
            lines.append("*No conversations recorded.*")
            lines.append("")
            return

        for convo in conversations:
            node = database.query(Node).filter(Node.id == convo.node_id).first()
            node_name = node.question if node else "Unknown"

            messages = (
                database.query(Message)
                .filter(Message.conversation_id == convo.id)
                .order_by(Message.created_at)
                .all()
            )

            if not messages:
                continue

            lines.append(f"### {node_name}")
            lines.append("")

            for msg in messages:
                role_label = msg.role.value.title() if hasattr(msg.role, 'value') else str(msg.role).title()
                time_str = msg.created_at.strftime("%H:%M") if msg.created_at else ""
                lines.append(f"> **{role_label}** ({time_str}): {msg.content}")
                lines.append("")

            lines.append("---")
            lines.append("")

    def _status_badge(self, status) -> str:
        """Return a small markdown badge for node status (non-active only)."""
        if not status:
            return ""
        badges = {
            NodeStatus.NEW: "`NEW`",
            NodeStatus.MODIFIED: "`MODIFIED`",
            NodeStatus.COMPLETED: "`DONE`",
            NodeStatus.DEFERRED: "`DEFERRED`",
        }
        return badges.get(status, "")

    def _node_to_dict(
        self,
        node: Node,
        database: DBSession,
        detail_level: str = "detailed",
        include_sources: bool = False,
    ) -> Dict[str, Any]:
        """Convert a node to a dictionary for JSON export."""
        data: Dict[str, Any] = {
            "id": str(node.id),
            "parent_id": str(node.parent_id) if node.parent_id else None,
            "title": node.question,
            "type": node.node_type.value,
            "status": node.status.value if node.status else "active",
            "depth": node.depth,
        }

        if detail_level != "summary":
            data["description"] = node.answer
            data["priority"] = node.priority.value if node.priority else None

        if detail_level == "full":
            data["acceptance_criteria"] = node.acceptance_criteria or []

        if include_sources and node.source_id:
            source = database.query(Source).filter(Source.id == node.source_id).first()
            data["source"] = {
                "id": str(source.id),
                "name": source.source_name,
                "type": source.source_type.value if source.source_type else None,
            } if source else None

        return data

    def _card_to_dict(self, card: Card, database: DBSession) -> Dict[str, Any]:
        """Convert a planning card to a full dictionary for JSON export."""
        node = database.query(Node).filter(Node.id == card.node_id).first()

        # Get acceptance criteria
        criteria = (
            database.query(AcceptanceCriterion)
            .filter(AcceptanceCriterion.card_id == card.id)
            .order_by(AcceptanceCriterion.order_index)
            .all()
        )

        # Get comments
        comments = (
            database.query(CardComment)
            .filter(CardComment.card_id == card.id)
            .order_by(CardComment.created_at)
            .all()
        )

        # Get assignments
        assignments = (
            database.query(Assignment)
            .filter(Assignment.card_id == card.id)
            .all()
        )

        return {
            "id": str(card.id),
            "node_id": str(card.node_id),
            "title": node.question if node else "Unknown",
            "description": card.description,
            "status": card.status.value,
            "priority": card.priority.value if card.priority else None,
            "story_points": card.story_points,
            "due_date": card.due_date.isoformat() if card.due_date else None,
            "created_at": card.created_at.isoformat() if card.created_at else None,
            "acceptance_criteria": [
                {
                    "text": ac.text,
                    "is_met": ac.is_met,
                    "order": ac.order_index,
                }
                for ac in criteria
            ],
            "comments": [
                {
                    "author": c.author_name,
                    "content": c.content,
                    "created_at": c.created_at.isoformat() if c.created_at else None,
                }
                for c in comments
            ],
            "assignments": [
                {
                    "team_member_id": str(a.team_member_id),
                    "role": a.role.value if hasattr(a.role, 'value') else str(a.role),
                }
                for a in assignments
            ],
        }


# Global instance
export_service = ExportService()
