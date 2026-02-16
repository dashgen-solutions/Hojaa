"""
API routes for audit trail and change history.
Phase 2 & 3: Graph State Management and Audit Trail.
"""
from uuid import UUID
from typing import Optional
from datetime import datetime
from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel
from sqlalchemy.orm import Session
from app.db.session import get_db
from app.core.auth import get_optional_user
from app.models.database import Node, NodeStatus, User, ChangeType
from app.models.schemas import NodeStatusUpdate, BulkNodeStatusUpdate, SuccessResponse
from app.services.audit_service import audit_service
from app.services.graph_service import graph_service
from app.core.logger import get_logger

logger = get_logger(__name__)

router = APIRouter(tags=["audit"])


class RevertRequest(BaseModel):
    history_entry_id: str


class CompareVersionsRequest(BaseModel):
    entry_id_a: str
    entry_id_b: str


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
    status: Optional[str] = Query(None, description="Filter by status: active, deferred, completed, removed, new, modified"),
    node_type: Optional[str] = Query(None, description="Filter by node type: root, feature, detail"),
    date_from: Optional[str] = Query(None, description="Filter nodes created/updated after this date (ISO format)"),
    date_to: Optional[str] = Query(None, description="Filter nodes created/updated before this date (ISO format)"),
    source_id: Optional[str] = Query(None, description="Filter nodes linked to a specific source"),
    search: Optional[str] = Query(None, description="Search node titles and descriptions"),
    database: Session = Depends(get_db),
):
    """Get nodes filtered by status, type, date range, source, and/or keyword search."""
    try:
        parsed_date_from = datetime.fromisoformat(date_from) if date_from else None
        parsed_date_to = datetime.fromisoformat(date_to) if date_to else None
        
        nodes = graph_service.get_filtered_nodes(
            database=database,
            session_id=session_id,
            status_filter=status,
            node_type_filter=node_type,
            date_from=parsed_date_from,
            date_to=parsed_date_to,
            source_id=source_id,
            search=search,
        )
        return nodes
        
    except Exception as error:
        logger.error(f"Error filtering nodes: {str(error)}")
        raise HTTPException(status_code=500, detail=str(error))


@router.patch("/nodes/bulk-status")
async def bulk_update_node_status(
    request: BulkNodeStatusUpdate,
    database: Session = Depends(get_db),
    current_user: User = Depends(get_optional_user),
):
    """
    Change status for multiple nodes at once.
    Records each change in the audit trail.
    """
    try:
        updated_nodes = []
        failed_node_ids = []
        
        for node_id in request.node_ids:
            try:
                result = graph_service.update_node_status(
                    database=database,
                    node_id=node_id,
                    new_status=request.status,
                    reason=request.reason,
                    changed_by=current_user.id if current_user else None,
                )
                updated_nodes.append(result)
            except ValueError:
                failed_node_ids.append(node_id)
        
        message = f"Updated {len(updated_nodes)} nodes to '{request.status}'"
        if failed_node_ids:
            message += f", {len(failed_node_ids)} not found"
        
        return {
            "success": True,
            "message": message,
            "updated_count": len(updated_nodes),
            "failed_ids": failed_node_ids,
            "nodes": updated_nodes,
        }
        
    except Exception as error:
        logger.error(f"Error in bulk status update: {str(error)}")
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


# ===== Time-Travel: Graph Snapshot (Phase 3) =====
# NOTE: These static routes MUST be defined BEFORE /audit/{session_id}
# to avoid FastAPI matching "graph-state" or "compare" as a session_id.

@router.get("/audit/graph-state")
async def get_graph_state(
    session_id: str = Query(..., description="Session ID"),
    as_of_date: str = Query(..., description="Reconstruct graph as of this date (ISO format)"),
    database: Session = Depends(get_db),
):
    """
    Reconstruct the knowledge graph as it existed at a specific point in time.
    Returns every node that existed by that date, with the status and title
    it had at that moment.
    """
    try:
        parsed_date = datetime.fromisoformat(as_of_date)
        
        snapshot = audit_service.get_graph_state_at(
            database=database,
            session_id=session_id,
            as_of_date=parsed_date,
        )
        
        return snapshot
        
    except ValueError as error:
        raise HTTPException(status_code=400, detail=f"Invalid date format: {str(error)}")
    except Exception as error:
        logger.error(f"Error getting graph state: {str(error)}")
        raise HTTPException(status_code=500, detail=str(error))


# ===== Time-Travel: Compare Two Dates (Phase 3) =====

@router.get("/audit/compare")
async def compare_graph_states(
    session_id: str = Query(..., description="Session ID"),
    date_from: str = Query(..., description="Start date (ISO format)"),
    date_to: str = Query(..., description="End date (ISO format)"),
    database: Session = Depends(get_db),
):
    """
    Compare the knowledge graph between two dates.
    Returns a diff showing nodes added, removed, modified, and deferred
    in the given time window.
    """
    try:
        parsed_date_from = datetime.fromisoformat(date_from)
        parsed_date_to = datetime.fromisoformat(date_to)
        
        if parsed_date_from >= parsed_date_to:
            raise HTTPException(
                status_code=400,
                detail="date_from must be earlier than date_to",
            )
        
        comparison = audit_service.compare_graph_states(
            database=database,
            session_id=session_id,
            date_from=parsed_date_from,
            date_to=parsed_date_to,
        )
        
        return comparison
        
    except HTTPException:
        raise
    except ValueError as error:
        raise HTTPException(status_code=400, detail=f"Invalid date format: {str(error)}")
    except Exception as error:
        logger.error(f"Error comparing graph states: {str(error)}")
        raise HTTPException(status_code=500, detail=str(error))


# ===== Session Audit Timeline (Phase 3) =====

@router.get("/audit/{session_id}")
async def get_audit_log(
    session_id: str,
    date_from: Optional[str] = Query(None, description="Filter from date (ISO format)"),
    date_to: Optional[str] = Query(None, description="Filter to date (ISO format)"),
    change_type: Optional[str] = Query(None, description="Filter by change type"),
    changed_by: Optional[str] = Query(None, description="Filter by user ID"),
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
            changed_by_filter=changed_by,
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
    changed_by: Optional[str] = Query(None, description="Filter by user ID"),
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
            changed_by_filter=changed_by,
        )
        
        return timeline
        
    except Exception as error:
        logger.error(f"Error getting audit timeline: {str(error)}")
        raise HTTPException(status_code=500, detail=str(error))


# ===== Session Users (for user filter dropdown) =====

@router.get("/audit/{session_id}/users")
async def get_session_users(
    session_id: str,
    database: Session = Depends(get_db),
):
    """Get all users who have made changes in this session."""
    try:
        users = audit_service.get_session_users(
            database=database,
            session_id=session_id,
        )
        return {"users": users}
    except Exception as error:
        logger.error(f"Error getting session users: {str(error)}")
        raise HTTPException(status_code=500, detail=str(error))


# ===== Node Revert (Phase 3) =====

@router.post("/nodes/{node_id}/revert")
async def revert_node(
    node_id: str,
    request: RevertRequest,
    database: Session = Depends(get_db),
    current_user: User = Depends(get_optional_user),
):
    """
    Revert a node to its state before a specific history entry.
    Restores the old_value of the target entry to the node.
    """
    try:
        result = audit_service.revert_node(
            database=database,
            node_id=UUID(node_id),
            history_entry_id=UUID(request.history_entry_id),
            changed_by=current_user.id if current_user else None,
        )
        database.commit()
        return result
    except ValueError as error:
        raise HTTPException(status_code=404, detail=str(error))
    except Exception as error:
        logger.error(f"Error reverting node: {str(error)}")
        database.rollback()
        raise HTTPException(status_code=500, detail=str(error))


# ===== Node Version Comparison (Phase 3) =====

@router.post("/nodes/{node_id}/compare-versions")
async def compare_node_versions(
    node_id: str,
    request: CompareVersionsRequest,
    database: Session = Depends(get_db),
):
    """
    Compare two history entries for a node side-by-side.
    """
    try:
        result = audit_service.compare_node_versions(
            database=database,
            node_id=UUID(node_id),
            entry_id_a=UUID(request.entry_id_a),
            entry_id_b=UUID(request.entry_id_b),
        )
        return result
    except ValueError as error:
        raise HTTPException(status_code=404, detail=str(error))
    except Exception as error:
        logger.error(f"Error comparing node versions: {str(error)}")
        raise HTTPException(status_code=500, detail=str(error))


# ===== Export Audit Report (Phase 3) =====

@router.post("/audit/{session_id}/export")
async def export_audit_report(
    session_id: str,
    date_from: Optional[str] = Query(None, description="Start date (ISO format)"),
    date_to: Optional[str] = Query(None, description="End date (ISO format)"),
    database: Session = Depends(get_db),
):
    """Export a standalone audit report as Markdown."""
    try:
        parsed_from = datetime.fromisoformat(date_from) if date_from else None
        parsed_to = datetime.fromisoformat(date_to) if date_to else None
        
        markdown = audit_service.export_audit_report(
            database=database,
            session_id=UUID(session_id),
            date_from=parsed_from,
            date_to=parsed_to,
        )
        
        from fastapi.responses import PlainTextResponse
        return PlainTextResponse(
            content=markdown,
            media_type="text/markdown",
            headers={
                "Content-Disposition": f'attachment; filename="audit-report-{session_id[:8]}.md"'
            },
        )
    except ValueError as error:
        raise HTTPException(status_code=404, detail=str(error))
    except Exception as error:
        logger.error(f"Error exporting audit report: {str(error)}")
        raise HTTPException(status_code=500, detail=str(error))
