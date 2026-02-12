"""
API routes for audit trail and change history.
Phase 2 & 3: Graph State Management and Audit Trail.
"""
from uuid import UUID
from typing import Optional
from datetime import datetime
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from app.db.session import get_db
from app.core.auth import get_optional_user
from app.models.database import Node, NodeStatus, User, ChangeType
from app.models.schemas import NodeStatusUpdate, SuccessResponse
from app.services.audit_service import audit_service
from app.services.graph_service import graph_service
from app.core.logger import get_logger

logger = get_logger(__name__)

router = APIRouter(tags=["audit"])


# ===== Node Status Management (Phase 2) =====

@router.patch("/nodes/{node_id}/status")
async def update_node_status(
    node_id: str,
    request: NodeStatusUpdate,
    cascade: bool = Query(False, description="Apply status to all children"),
    database: Session = Depends(get_db),
    current_user: User = Depends(get_optional_user),
):
    """
    Change a node's status (active, deferred, completed, removed).
    Records the change with reason in the audit trail.
    """
    try:
        result = graph_service.update_node_status(
            database=database,
            node_id=node_id,
            new_status=request.status,
            reason=request.reason,
            changed_by=current_user.id if current_user else None,
            cascade_to_children=cascade,
        )
        return result
        
    except ValueError as error:
        raise HTTPException(status_code=404, detail=str(error))
    except Exception as error:
        logger.error(f"Error updating node status: {str(error)}")
        raise HTTPException(status_code=500, detail=str(error))


@router.get("/nodes/{session_id}/filter")
async def get_filtered_nodes(
    session_id: str,
    status: Optional[str] = Query(None, description="Filter by status: active, deferred, completed, removed"),
    node_type: Optional[str] = Query(None, description="Filter by node type: root, feature, detail"),
    database: Session = Depends(get_db),
):
    """Get nodes filtered by status and/or type."""
    try:
        nodes = graph_service.get_filtered_nodes(
            database=database,
            session_id=session_id,
            status_filter=status,
            node_type_filter=node_type,
        )
        return nodes
        
    except Exception as error:
        logger.error(f"Error filtering nodes: {str(error)}")
        raise HTTPException(status_code=500, detail=str(error))


# ===== Node History (Phase 3) =====

@router.get("/nodes/{node_id}/history")
async def get_node_history(
    node_id: str,
    database: Session = Depends(get_db),
):
    """Get the full change history for a specific node."""
    try:
        node = database.query(Node).filter(Node.id == node_id).first()
        if not node:
            raise HTTPException(status_code=404, detail="Node not found")
        
        history = audit_service.get_node_history(
            database=database,
            node_id=node_id,
        )
        
        return {
            "node_id": node_id,
            "node_title": node.question,
            "history": history,
        }
        
    except HTTPException:
        raise
    except Exception as error:
        logger.error(f"Error getting node history: {str(error)}")
        raise HTTPException(status_code=500, detail=str(error))


# ===== Session Audit Timeline (Phase 3) =====

@router.get("/audit/{session_id}")
async def get_audit_log(
    session_id: str,
    date_from: Optional[str] = Query(None, description="Filter from date (ISO format)"),
    date_to: Optional[str] = Query(None, description="Filter to date (ISO format)"),
    change_type: Optional[str] = Query(None, description="Filter by change type"),
    limit: int = Query(100, ge=1, le=500),
    offset: int = Query(0, ge=0),
    database: Session = Depends(get_db),
):
    """Get the full audit log for a session."""
    try:
        parsed_date_from = None
        parsed_date_to = None
        
        if date_from:
            parsed_date_from = datetime.fromisoformat(date_from)
        if date_to:
            parsed_date_to = datetime.fromisoformat(date_to)
        
        timeline = audit_service.get_session_timeline(
            database=database,
            session_id=session_id,
            date_from=parsed_date_from,
            date_to=parsed_date_to,
            change_type_filter=change_type,
            limit=limit,
            offset=offset,
        )
        
        return timeline
        
    except Exception as error:
        logger.error(f"Error getting audit log: {str(error)}")
        raise HTTPException(status_code=500, detail=str(error))


@router.get("/audit/{session_id}/timeline")
async def get_audit_timeline(
    session_id: str,
    days: int = Query(7, ge=1, le=365, description="Number of days to look back"),
    database: Session = Depends(get_db),
):
    """Get a timeline view of recent changes (last N days)."""
    try:
        from datetime import timedelta
        date_from = datetime.utcnow() - timedelta(days=days)
        
        timeline = audit_service.get_session_timeline(
            database=database,
            session_id=session_id,
            date_from=date_from,
        )
        
        return timeline
        
    except Exception as error:
        logger.error(f"Error getting audit timeline: {str(error)}")
        raise HTTPException(status_code=500, detail=str(error))
