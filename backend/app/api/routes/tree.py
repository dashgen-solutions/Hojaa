"""
Tree API routes for requirements tree operations.

PERF-3.2: Lazy loading via ``max_depth`` query param.
PERF-3.1: Flat paginated node listing via ``/tree/{session_id}/flat``.
"""
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from uuid import UUID
from typing import List, Dict, Any, Optional
from app.db.session import get_db
from app.models.schemas import NodeResponse
from app.models.database import Node, NodeStatus
from app.core.logger import get_logger

logger = get_logger(__name__)
router = APIRouter(prefix="/tree", tags=["tree"])


def node_to_dict(
    node: Node,
    db: Session,
    *,
    max_depth: Optional[int] = None,
    _current_depth: int = 0,
) -> Dict[str, Any]:
    """Convert a Node SQLAlchemy object to a dictionary with children loaded.
    Filters out REMOVED nodes so they don't appear in the tree.

    When ``max_depth`` is set, children beyond that depth are omitted
    and ``has_children: true`` is returned instead so the client can
    fetch them lazily via ``/tree/node/{id}``.
    """
    # Check if we should stop recursing
    children_data: List[Dict[str, Any]] = []
    has_children = False

    if max_depth is not None and _current_depth >= max_depth:
        # Don't load children — just check if they exist
        has_children = (
            db.query(Node.id)
            .filter(
                Node.parent_id == node.id,
                Node.status != NodeStatus.REMOVED,
            )
            .first()
            is not None
        )
    else:
        # Load children, excluding nodes with REMOVED status
        children = (
            db.query(Node)
            .filter(
                Node.parent_id == node.id,
                Node.status != NodeStatus.REMOVED,
            )
            .order_by(Node.order_index)
            .all()
        )
        has_children = len(children) > 0
        children_data = [
            node_to_dict(
                child, db,
                max_depth=max_depth,
                _current_depth=_current_depth + 1,
            )
            for child in children
        ]

    # Determine the node's status string safely
    node_status = node.status.value if node.status else "active"

    # Source info (if node was added/modified from a source)
    source_name = None
    source_type = None
    if node.source_id and node.source:
        source_name = node.source.source_name
        source_type = node.source.source_type.value if node.source.source_type else None

    return {
        "id": node.id,
        "question": node.question,
        "answer": node.answer,
        "node_type": node.node_type.value,
        "status": node_status,
        "deferred_reason": node.deferred_reason,
        "completed_at": node.completed_at.isoformat() if node.completed_at else None,
        "depth": node.depth,
        "order_index": node.order_index,
        "can_expand": node.can_expand,
        "is_expanded": node.is_expanded,
        "source_name": source_name,
        "source_type": source_type,
        "has_children": has_children,
        "children": children_data,
    }


@router.get("/{session_id}")
async def get_tree(
    session_id: UUID,
    db: Session = Depends(get_db),
    max_depth: Optional[int] = Query(
        None,
        ge=0,
        description="Maximum depth to load.  Omit for full tree (backwards-compatible).",
    ),
):
    """Get requirements tree for a session.

    Pass ``max_depth=N`` to load only the first N levels (PERF-3.2).
    Children beyond that depth will have ``has_children: true`` and
    an empty ``children`` array — fetch them on-demand via
    ``GET /tree/node/{id}``.
    """
    try:
        logger.info(f"Getting tree for session {session_id}")
        
        # Get root node
        root_node = db.query(Node).filter(
            Node.session_id == session_id,
            Node.parent_id == None
        ).first()
        
        if not root_node:
            # Tree not built yet — return empty placeholder
            return {
                "tree": {
                    "id": None,
                    "question": "Project",
                    "answer": None,
                    "node_type": "ROOT",
                    "status": "active",
                    "depth": 0,
                    "can_expand": False,
                    "children": [],
                },
                "session_id": session_id,
                "pending": True,
            }
        
        # Convert to dict with all children loaded recursively
        tree_dict = node_to_dict(root_node, db, max_depth=max_depth)
        
        return {"tree": tree_dict, "session_id": session_id}
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error getting tree: {str(e)}")
        raise HTTPException(status_code=500, detail="Internal server error")


# ── PERF-3.1: Flat paginated node listing ──

@router.get("/{session_id}/flat")
async def list_nodes_flat(
    session_id: UUID,
    db: Session = Depends(get_db),
    limit: int = Query(100, ge=1, le=500, description="Max nodes per page"),
    offset: int = Query(0, ge=0, description="Number of nodes to skip"),
    status: Optional[str] = Query(None, description="Filter by status"),
    depth: Optional[int] = Query(None, ge=0, description="Filter by depth"),
):
    """Return a flat, paginated list of nodes for a session.

    Useful for search, bulk edits, and analytics where a hierarchical
    tree isn't needed.
    """
    try:
        query = db.query(Node).filter(Node.session_id == session_id)
        if status:
            query = query.filter(Node.status == NodeStatus(status))
        if depth is not None:
            query = query.filter(Node.depth == depth)
        query = query.order_by(Node.depth, Node.order_index)

        total = query.count()
        nodes = query.offset(offset).limit(limit).all()

        items = []
        for n in nodes:
            items.append({
                "id": n.id,
                "question": n.question,
                "answer": n.answer,
                "node_type": n.node_type.value,
                "status": n.status.value if n.status else "active",
                "depth": n.depth,
                "order_index": n.order_index,
                "parent_id": n.parent_id,
            })

        return {"items": items, "total": total, "limit": limit, "offset": offset}

    except Exception as e:
        logger.error(f"Error listing flat nodes: {e}")
        raise HTTPException(status_code=500, detail="Internal server error")


@router.get("/node/{node_id}")
async def get_node(
    node_id: UUID,
    db: Session = Depends(get_db),
    max_depth: Optional[int] = Query(None, ge=0, description="Max depth of children to load"),
):
    """Get a specific node with its children (supports lazy loading)."""
    try:
        node = db.query(Node).filter(Node.id == node_id).first()
        
        if not node:
            raise HTTPException(status_code=404, detail="Node not found")
        
        # Convert to dict with children
        node_dict = node_to_dict(node, db, max_depth=max_depth)
        
        return {"node": node_dict}
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error getting node: {str(e)}")
        raise HTTPException(status_code=500, detail="Internal server error")
