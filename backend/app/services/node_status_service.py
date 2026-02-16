"""
SVC-3.1 — Node Status Service.

Dedicated service for managing node status lifecycle.
Provides:
- Status-transition validation (state-machine rules)
- Single and bulk status updates with audit trail
- Lifecycle metadata management (deferred_reason, completed_at)
- Planning-board synchronisation after status changes

Extracted from GraphService.update_node_status() and enhanced with
a proper state machine and bulk-update capability.
"""
from typing import List, Dict, Any, Optional, Set
from uuid import UUID
from datetime import datetime
from sqlalchemy.orm import Session as DBSession
from app.models.database import (
    Node, NodeStatus, ChangeType
)
from app.services.audit_service import audit_service
from app.services.planning_service import planning_service
from app.core.logger import get_logger

logger = get_logger(__name__)


# ── Status transition rules (state machine) ─────────────────────
# Keys  = current status
# Values = set of statuses that the node CAN transition to.
# If a transition is not listed it is INVALID and will be rejected.
VALID_TRANSITIONS: Dict[str, Set[str]] = {
    "active":    {"deferred", "completed", "removed", "modified", "new"},
    "new":       {"active", "deferred", "completed", "removed", "modified"},
    "modified":  {"active", "deferred", "completed", "removed"},
    "deferred":  {"active", "removed"},          # must reactivate before completing
    "completed": {"active"},                      # can reopen
    "removed":   {"active"},                      # can restore
}


class NodeStatusService:
    """
    Manages node status transitions with validation, audit, and sync.
    """

    # ── Public API ───────────────────────────────────────────────

    def validate_transition(
        self,
        current_status: str,
        new_status: str,
    ) -> bool:
        """Return True if *current_status* → *new_status* is allowed."""
        if current_status == new_status:
            return True  # no-op is always valid
        allowed = VALID_TRANSITIONS.get(current_status, set())
        return new_status in allowed

    def get_allowed_transitions(self, current_status: str) -> List[str]:
        """Return the list of statuses a node in *current_status* may move to."""
        return sorted(VALID_TRANSITIONS.get(current_status, set()))

    def update_status(
        self,
        database: DBSession,
        node_id: UUID,
        new_status: str,
        reason: Optional[str] = None,
        changed_by: Optional[UUID] = None,
        source_id: Optional[UUID] = None,
        cascade_to_children: bool = False,
        skip_validation: bool = False,
    ) -> Dict[str, Any]:
        """
        Change a node's status with transition validation & audit trail.

        Args:
            database:             DB session.
            node_id:              Target node.
            new_status:           Desired status string.
            reason:               Why the change is happening.
            changed_by:           User performing the action.
            source_id:            Originating source (if any).
            cascade_to_children:  Apply recursively to descendants.
            skip_validation:      Bypass transition validation (admin use).

        Raises:
            ValueError: If the node is not found or the transition is invalid.

        Returns:
            Serialised node dict.
        """
        node = database.query(Node).filter(Node.id == node_id).first()
        if not node:
            raise ValueError(f"Node {node_id} not found")

        old_status = node.status.value if node.status else "active"

        # Validate transition
        if not skip_validation and not self.validate_transition(old_status, new_status):
            raise ValueError(
                f"Invalid status transition: {old_status} → {new_status}. "
                f"Allowed: {self.get_allowed_transitions(old_status)}"
            )

        # Apply new status
        node.status = NodeStatus(new_status)
        node.updated_at = datetime.utcnow()

        # Lifecycle metadata
        if new_status == "deferred":
            node.deferred_reason = reason
        elif new_status == "completed":
            node.completed_at = datetime.utcnow()
        elif new_status == "active":
            node.deferred_reason = None
            node.completed_at = None

        # Audit
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

        # Cascade
        if cascade_to_children:
            children = database.query(Node).filter(Node.parent_id == node_id).all()
            for child in children:
                try:
                    self.update_status(
                        database=database,
                        node_id=child.id,
                        new_status=new_status,
                        reason=f"Cascaded from parent: {reason}" if reason else "Cascaded from parent",
                        changed_by=changed_by,
                        source_id=source_id,
                        cascade_to_children=True,
                        skip_validation=skip_validation,
                    )
                except ValueError as exc:
                    logger.warning(f"Skipped cascade for child {child.id}: {exc}")

        database.commit()
        database.refresh(node)

        # Sync planning cards
        planning_service.sync_node_to_cards(
            database=database,
            node_id=node_id,
            node_status=new_status,
            session_id=node.session_id,
        )

        return self._serialize(node)

    def bulk_update_status(
        self,
        database: DBSession,
        node_ids: List[UUID],
        new_status: str,
        reason: Optional[str] = None,
        changed_by: Optional[UUID] = None,
        skip_validation: bool = False,
    ) -> Dict[str, Any]:
        """
        Update the status of multiple nodes in one transaction.

        Returns:
            {"updated": [serialised_node], "errors": [{"node_id": ..., "error": ...}]}
        """
        updated = []
        errors = []
        for nid in node_ids:
            try:
                result = self.update_status(
                    database=database,
                    node_id=nid,
                    new_status=new_status,
                    reason=reason,
                    changed_by=changed_by,
                    skip_validation=skip_validation,
                )
                updated.append(result)
            except ValueError as exc:
                errors.append({"node_id": str(nid), "error": str(exc)})

        return {"updated": updated, "errors": errors}

    # ── Serialisation ────────────────────────────────────────────

    @staticmethod
    def _serialize(node: Node) -> Dict[str, Any]:
        return {
            "id": str(node.id),
            "session_id": str(node.session_id),
            "parent_id": str(node.parent_id) if node.parent_id else None,
            "question": node.question,
            "node_type": node.node_type.value,
            "status": node.status.value if node.status else "active",
            "deferred_reason": node.deferred_reason,
            "completed_at": node.completed_at.isoformat() if node.completed_at else None,
            "updated_at": node.updated_at.isoformat(),
        }


# Global instance
node_status_service = NodeStatusService()
