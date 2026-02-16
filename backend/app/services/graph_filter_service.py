"""
SVC-3.2 — Graph Filter Service.

Dedicated service for querying and filtering the knowledge graph.
Provides:
- Multi-criteria filtering (status, type, date, source, keyword)
- Subtree extraction (all descendants of a given node)
- Complex OR/AND filter composition
- Statistics per filter result

Extracted from GraphService.get_filtered_nodes() and enhanced with
subtree queries and stats.
"""
from typing import List, Dict, Any, Optional
from uuid import UUID
from datetime import datetime
from sqlalchemy.orm import Session as DBSession
from sqlalchemy import or_
from app.models.database import (
    Node, NodeType, NodeStatus, Source
)
from app.core.logger import get_logger

logger = get_logger(__name__)


class GraphFilterService:
    """
    Applies filters to the knowledge graph and returns matching nodes
    or subgraphs.
    """

    # ── Public API ───────────────────────────────────────────────

    def get_filtered_nodes(
        self,
        database: DBSession,
        session_id: UUID,
        status_filter: Optional[str] = None,
        node_type_filter: Optional[str] = None,
        date_from: Optional[datetime] = None,
        date_to: Optional[datetime] = None,
        source_id: Optional[str] = None,
        search: Optional[str] = None,
        parent_id: Optional[UUID] = None,
        include_subtree: bool = False,
        max_depth: Optional[int] = None,
    ) -> List[Dict[str, Any]]:
        """
        Query nodes with flexible filtering.

        Args:
            session_id:       Restrict to this session.
            status_filter:    e.g. "deferred", "active".
            node_type_filter: e.g. "feature", "detail".
            date_from / date_to: Updated-at range.
            source_id:        Nodes originating from this source.
            search:           Keyword substring search (title + description).
            parent_id:        If set with include_subtree=True, returns
                              only the subtree rooted at this node.
            include_subtree:  When True + parent_id, recursively fetch
                              descendants.
            max_depth:        Limit subtree depth (relative to parent).

        Returns:
            List of serialised node dicts.
        """
        # Subtree mode: collect IDs first, then fetch
        if parent_id and include_subtree:
            return self._get_subtree(
                database, session_id, parent_id,
                max_depth=max_depth,
                status_filter=status_filter,
                node_type_filter=node_type_filter,
                search=search,
            )

        query = database.query(Node).filter(Node.session_id == session_id)

        if status_filter:
            query = query.filter(Node.status == NodeStatus(status_filter))
        if node_type_filter:
            query = query.filter(Node.node_type == NodeType(node_type_filter))
        if date_from:
            query = query.filter(Node.updated_at >= date_from)
        if date_to:
            query = query.filter(Node.updated_at <= date_to)
        if source_id:
            query = query.filter(Node.source_id == source_id)
        if parent_id and not include_subtree:
            query = query.filter(Node.parent_id == parent_id)
        if search:
            like = f"%{search}%"
            query = query.filter(
                or_(Node.question.ilike(like), Node.answer.ilike(like))
            )

        nodes = query.order_by(Node.depth, Node.order_index).all()
        return [self._serialize(n) for n in nodes]

    def get_subtree(
        self,
        database: DBSession,
        session_id: UUID,
        root_node_id: UUID,
        max_depth: Optional[int] = None,
    ) -> List[Dict[str, Any]]:
        """
        Return the full subtree rooted at *root_node_id*.

        Args:
            max_depth: Maximum depth levels below root to include.
                       None = unlimited.
        """
        return self._get_subtree(database, session_id, root_node_id, max_depth)

    def get_filter_statistics(
        self,
        database: DBSession,
        session_id: UUID,
    ) -> Dict[str, Any]:
        """
        Return aggregate counts broken down by status and node_type
        for the given session — useful for building filter UIs.
        """
        nodes = (
            database.query(Node)
            .filter(Node.session_id == session_id)
            .all()
        )
        status_counts: Dict[str, int] = {}
        type_counts: Dict[str, int] = {}
        source_counts: Dict[str, int] = {}

        for n in nodes:
            s = n.status.value if n.status else "active"
            status_counts[s] = status_counts.get(s, 0) + 1

            t = n.node_type.value
            type_counts[t] = type_counts.get(t, 0) + 1

            if n.source_id:
                sid = str(n.source_id)
                source_counts[sid] = source_counts.get(sid, 0) + 1

        return {
            "total": len(nodes),
            "by_status": status_counts,
            "by_type": type_counts,
            "by_source": source_counts,
        }

    # ── Internals ────────────────────────────────────────────────

    def _get_subtree(
        self,
        database: DBSession,
        session_id: UUID,
        root_id: UUID,
        max_depth: Optional[int] = None,
        status_filter: Optional[str] = None,
        node_type_filter: Optional[str] = None,
        search: Optional[str] = None,
    ) -> List[Dict[str, Any]]:
        """BFS expansion of the subtree rooted at *root_id*."""
        root = database.query(Node).filter(
            Node.id == root_id, Node.session_id == session_id
        ).first()
        if not root:
            return []

        root_depth = root.depth
        collected: List[Node] = [root]
        frontier = [root_id]

        while frontier:
            children = (
                database.query(Node)
                .filter(Node.parent_id.in_(frontier), Node.session_id == session_id)
                .order_by(Node.order_index)
                .all()
            )
            next_frontier = []
            for child in children:
                relative_depth = child.depth - root_depth
                if max_depth is not None and relative_depth > max_depth:
                    continue
                collected.append(child)
                next_frontier.append(child.id)
            frontier = next_frontier

        # Apply optional in-memory filters
        results = collected
        if status_filter:
            target = NodeStatus(status_filter)
            results = [n for n in results if n.status == target]
        if node_type_filter:
            target_type = NodeType(node_type_filter)
            results = [n for n in results if n.node_type == target_type]
        if search:
            low = search.lower()
            results = [
                n for n in results
                if low in (n.question or "").lower() or low in (n.answer or "").lower()
            ]

        return [self._serialize(n) for n in results]

    @staticmethod
    def _serialize(node: Node) -> Dict[str, Any]:
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
            "deferred_reason": node.deferred_reason,
            "completed_at": node.completed_at.isoformat() if node.completed_at else None,
            "depth": node.depth,
            "order_index": node.order_index,
            "can_expand": node.can_expand,
            "is_expanded": node.is_expanded,
            "created_at": node.created_at.isoformat(),
            "updated_at": node.updated_at.isoformat(),
        }


# Global instance
graph_filter_service = GraphFilterService()
