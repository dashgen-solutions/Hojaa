"""
SVC-4.2 — Versioning Service.

Provides:
- Named snapshots of the full scope graph
- List / load / delete snapshots
- Full-graph rollback to a snapshot or a point-in-time
- Leverages AuditService.get_graph_state_at() for reconstruction
"""
import json
from datetime import datetime
from typing import Dict, Any, List, Optional
from uuid import UUID, uuid4
from sqlalchemy.orm import Session as DBSession
from sqlalchemy import desc
from app.models.database import (
    Node, NodeType, NodeStatus, NodeHistory, ChangeType,
)
from app.core.logger import get_logger

logger = get_logger(__name__)


class VersioningService:
    """
    Manages named snapshots and full-graph rollback for scope trees.

    Snapshots are persisted as NodeHistory entries with a special
    change_type == CREATED, field_changed == "__snapshot__", so no new
    table is required.  The snapshot payload (JSON) is stored in
    ``new_value`` and the name in ``change_reason``.
    """

    SNAPSHOT_FIELD = "__snapshot__"

    # ── Create snapshot ──────────────────────────────────────────

    def create_snapshot(
        self,
        database: DBSession,
        session_id: UUID,
        name: str,
        description: str = "",
        changed_by: Optional[UUID] = None,
    ) -> Dict[str, Any]:
        """
        Capture a named snapshot of the current graph state.

        Returns:
            dict with snapshot_id, name, node_count, created_at
        """
        from app.services.audit_service import audit_service

        # Capture current state via audit service
        state = audit_service.get_graph_state_at(
            database=database,
            session_id=session_id,
            as_of_date=datetime.utcnow(),
        )

        payload = {
            "name": name,
            "description": description,
            "nodes": state["nodes"],
            "status_counts": state["status_counts"],
            "total_nodes": state["total_nodes"],
        }

        # Find any node to anchor the snapshot entry (root preferred)
        root = (
            database.query(Node)
            .filter(Node.session_id == session_id, Node.node_type == NodeType.ROOT)
            .first()
        )
        anchor_id = root.id if root else None
        if anchor_id is None:
            any_node = (
                database.query(Node)
                .filter(Node.session_id == session_id)
                .first()
            )
            if any_node is None:
                raise ValueError("No nodes exist in this session — cannot snapshot.")
            anchor_id = any_node.id

        snapshot_id = uuid4()
        entry = NodeHistory(
            id=snapshot_id,
            session_id=session_id,
            node_id=anchor_id,
            change_type=ChangeType.CREATED,
            field_changed=self.SNAPSHOT_FIELD,
            new_value=json.dumps(payload),
            change_reason=name,
            changed_by=changed_by,
        )
        database.add(entry)
        database.commit()

        logger.info(
            f"Snapshot '{name}' created for session {session_id} "
            f"({state['total_nodes']} nodes)"
        )

        return {
            "snapshot_id": str(snapshot_id),
            "name": name,
            "description": description,
            "node_count": state["total_nodes"],
            "created_at": entry.changed_at.isoformat(),
        }

    # ── List snapshots ───────────────────────────────────────────

    def list_snapshots(
        self,
        database: DBSession,
        session_id: UUID,
    ) -> List[Dict[str, Any]]:
        """Return all named snapshots for a session, newest first."""
        rows = (
            database.query(NodeHistory)
            .filter(
                NodeHistory.session_id == session_id,
                NodeHistory.field_changed == self.SNAPSHOT_FIELD,
            )
            .order_by(desc(NodeHistory.changed_at))
            .all()
        )

        snapshots = []
        for row in rows:
            try:
                payload = json.loads(row.new_value)
            except Exception:
                payload = {}
            snapshots.append({
                "snapshot_id": str(row.id),
                "name": payload.get("name", row.change_reason or ""),
                "description": payload.get("description", ""),
                "node_count": payload.get("total_nodes", 0),
                "created_at": row.changed_at.isoformat(),
            })
        return snapshots

    # ── Load snapshot ────────────────────────────────────────────

    def get_snapshot(
        self,
        database: DBSession,
        snapshot_id: UUID,
    ) -> Dict[str, Any]:
        """Load a single snapshot by ID."""
        row = database.query(NodeHistory).filter(
            NodeHistory.id == snapshot_id,
            NodeHistory.field_changed == self.SNAPSHOT_FIELD,
        ).first()

        if not row:
            raise ValueError(f"Snapshot {snapshot_id} not found")

        payload = json.loads(row.new_value)
        return {
            "snapshot_id": str(row.id),
            "name": payload.get("name", ""),
            "description": payload.get("description", ""),
            "node_count": payload.get("total_nodes", 0),
            "status_counts": payload.get("status_counts", {}),
            "nodes": payload.get("nodes", []),
            "created_at": row.changed_at.isoformat(),
        }

    # ── Delete snapshot ──────────────────────────────────────────

    def delete_snapshot(
        self,
        database: DBSession,
        snapshot_id: UUID,
    ) -> bool:
        row = database.query(NodeHistory).filter(
            NodeHistory.id == snapshot_id,
            NodeHistory.field_changed == self.SNAPSHOT_FIELD,
        ).first()
        if not row:
            return False
        database.delete(row)
        database.commit()
        return True

    # ── Rollback full graph ──────────────────────────────────────

    def rollback_to_snapshot(
        self,
        database: DBSession,
        session_id: UUID,
        snapshot_id: UUID,
        changed_by: Optional[UUID] = None,
    ) -> Dict[str, Any]:
        """
        Restore the entire graph to the state captured in a snapshot.

        Process:
        1. Load snapshot nodes
        2. Soft-delete (status=REMOVED) nodes that don't exist in snapshot
        3. Re-create nodes that exist in snapshot but not in DB
        4. Update nodes whose title/description/status differ
        5. Log all changes to audit trail

        Returns:
            Summary dict {restored, removed, updated, unchanged}
        """
        snapshot = self.get_snapshot(database, snapshot_id)
        snap_nodes = {n["id"]: n for n in snapshot["nodes"]}

        from app.services.audit_service import audit_service

        current_nodes = (
            database.query(Node)
            .filter(Node.session_id == session_id)
            .all()
        )
        current_map = {str(n.id): n for n in current_nodes}

        stats = {"restored": 0, "removed": 0, "updated": 0, "unchanged": 0}

        # 1. Remove nodes not in snapshot
        for nid, node in current_map.items():
            if nid not in snap_nodes and node.status != NodeStatus.REMOVED:
                old_status = node.status.value
                node.status = NodeStatus.REMOVED
                audit_service.record_change(
                    database=database,
                    node_id=node.id,
                    change_type=ChangeType.STATUS_CHANGED,
                    field_changed="status",
                    old_value=old_status,
                    new_value=NodeStatus.REMOVED.value,
                    change_reason=f"Rollback to snapshot '{snapshot['name']}'",
                    changed_by=changed_by,
                    session_id=session_id,
                )
                stats["removed"] += 1

        # 2. Restore / update nodes from snapshot
        for nid, snap in snap_nodes.items():
            node = current_map.get(nid)

            if node is None:
                # Node was deleted from DB — cannot re-create with same UUID
                # in SQLAlchemy easily; log and skip
                logger.warning(
                    f"Snapshot node {nid} no longer exists in DB — skipped"
                )
                continue

            changed_fields = []

            # Status
            target_status = NodeStatus(snap["status"])
            if node.status != target_status:
                old_s = node.status.value
                node.status = target_status
                audit_service.record_change(
                    database=database,
                    node_id=node.id,
                    change_type=ChangeType.STATUS_CHANGED,
                    field_changed="status",
                    old_value=old_s,
                    new_value=target_status.value,
                    change_reason=f"Rollback to snapshot '{snapshot['name']}'",
                    changed_by=changed_by,
                    session_id=session_id,
                )
                changed_fields.append("status")

            # Title
            if node.question != snap.get("title"):
                old_q = node.question
                node.question = snap["title"]
                audit_service.record_change(
                    database=database,
                    node_id=node.id,
                    change_type=ChangeType.MODIFIED,
                    field_changed="question",
                    old_value=old_q,
                    new_value=snap["title"],
                    change_reason=f"Rollback to snapshot '{snapshot['name']}'",
                    changed_by=changed_by,
                    session_id=session_id,
                )
                changed_fields.append("question")

            # Description
            if node.answer != snap.get("description"):
                old_a = node.answer
                node.answer = snap["description"]
                audit_service.record_change(
                    database=database,
                    node_id=node.id,
                    change_type=ChangeType.MODIFIED,
                    field_changed="answer",
                    old_value=old_a,
                    new_value=snap["description"],
                    change_reason=f"Rollback to snapshot '{snapshot['name']}'",
                    changed_by=changed_by,
                    session_id=session_id,
                )
                changed_fields.append("answer")

            if changed_fields:
                stats["updated"] += 1
            else:
                stats["unchanged"] += 1

        database.commit()

        logger.info(
            f"Rollback to snapshot '{snapshot['name']}': "
            f"removed={stats['removed']}, updated={stats['updated']}, "
            f"unchanged={stats['unchanged']}"
        )
        return stats

    # ── Point-in-time rollback ───────────────────────────────────

    def rollback_to_date(
        self,
        database: DBSession,
        session_id: UUID,
        target_date: datetime,
        changed_by: Optional[UUID] = None,
    ) -> Dict[str, Any]:
        """
        Restore the graph to the state it was in at *target_date*.

        Creates an auto-snapshot before rolling back so the user can
        undo the rollback if needed.
        """
        # Auto-snapshot current state
        self.create_snapshot(
            database=database,
            session_id=session_id,
            name=f"Pre-rollback auto-snapshot ({datetime.utcnow().strftime('%Y-%m-%d %H:%M')})",
            description="Automatically created before point-in-time rollback",
            changed_by=changed_by,
        )

        from app.services.audit_service import audit_service

        state = audit_service.get_graph_state_at(
            database=database,
            session_id=session_id,
            as_of_date=target_date,
        )

        snap_nodes = {n["id"]: n for n in state["nodes"]}

        current_nodes = (
            database.query(Node)
            .filter(Node.session_id == session_id)
            .all()
        )
        current_map = {str(n.id): n for n in current_nodes}

        stats = {"restored": 0, "removed": 0, "updated": 0, "unchanged": 0}

        reason = f"Point-in-time rollback to {target_date.isoformat()}"

        # Remove extras
        for nid, node in current_map.items():
            if nid not in snap_nodes and node.status != NodeStatus.REMOVED:
                old_status = node.status.value
                node.status = NodeStatus.REMOVED
                audit_service.record_change(
                    database=database,
                    node_id=node.id,
                    change_type=ChangeType.STATUS_CHANGED,
                    field_changed="status",
                    old_value=old_status,
                    new_value=NodeStatus.REMOVED.value,
                    change_reason=reason,
                    changed_by=changed_by,
                    session_id=session_id,
                )
                stats["removed"] += 1

        # Update to historical state
        for nid, snap in snap_nodes.items():
            node = current_map.get(nid)
            if node is None:
                continue

            changed = False
            target_status = NodeStatus(snap["status"])
            if node.status != target_status:
                old_s = node.status.value
                node.status = target_status
                audit_service.record_change(
                    database=database,
                    node_id=node.id,
                    change_type=ChangeType.STATUS_CHANGED,
                    field_changed="status",
                    old_value=old_s,
                    new_value=target_status.value,
                    change_reason=reason,
                    changed_by=changed_by,
                    session_id=session_id,
                )
                changed = True

            if node.question != snap.get("title"):
                old_q = node.question
                node.question = snap["title"]
                audit_service.record_change(
                    database=database,
                    node_id=node.id,
                    change_type=ChangeType.MODIFIED,
                    field_changed="question",
                    old_value=old_q,
                    new_value=snap["title"],
                    change_reason=reason,
                    changed_by=changed_by,
                    session_id=session_id,
                )
                changed = True

            if node.answer != snap.get("description"):
                old_a = node.answer
                node.answer = snap["description"]
                audit_service.record_change(
                    database=database,
                    node_id=node.id,
                    change_type=ChangeType.MODIFIED,
                    field_changed="answer",
                    old_value=old_a,
                    new_value=snap["description"],
                    change_reason=reason,
                    changed_by=changed_by,
                    session_id=session_id,
                )
                changed = True

            if changed:
                stats["updated"] += 1
            else:
                stats["unchanged"] += 1

        database.commit()
        logger.info(f"Point-in-time rollback to {target_date}: {stats}")
        return stats


# Global instance
versioning_service = VersioningService()
