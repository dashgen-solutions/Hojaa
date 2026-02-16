"""
SEC-2.1 / SEC-2.2 — Role-Based Access Control (RBAC) & Permission System.

Provides:
- ``Permission`` enum with granular actions
- ``ROLE_PERMISSIONS`` mapping (Owner → Admin → Editor → Viewer)
- FastAPI dependency factories: ``require_permission()``, ``require_session_role()``
- Helper: ``effective_role()`` — resolves the user's best role for a session
"""
from __future__ import annotations

import enum
from typing import Optional, Set
from uuid import UUID

from fastapi import Depends, HTTPException, status
from sqlalchemy.orm import Session as DBSession

from app.core.auth import get_current_user
from app.db.session import get_db
from app.models.database import User, UserRole, Session as SessionModel, SessionMember
from app.core.logger import get_logger

logger = get_logger(__name__)


# ─────────────────────────────────────────────────────────────
#  Permissions enum
# ─────────────────────────────────────────────────────────────

class Permission(str, enum.Enum):
    """Granular operations guarded by RBAC (SEC-2.2)."""
    # Nodes
    CREATE_NODE = "create_node"
    EDIT_NODE = "edit_node"
    DELETE_NODE = "delete_node"
    # Scope changes
    APPROVE_SCOPE_CHANGE = "approve_scope_change"
    # Export
    EXPORT_DOCUMENT = "export_document"
    # Team / planning
    MANAGE_TEAM = "manage_team"
    MANAGE_CARDS = "manage_cards"
    # Sources
    INGEST_SOURCE = "ingest_source"
    # Sessions
    SHARE_SESSION = "share_session"
    DELETE_SESSION = "delete_session"
    # Admin
    MANAGE_USERS = "manage_users"
    VIEW_AUDIT = "view_audit"
    # Read
    VIEW = "view"


# ─────────────────────────────────────────────────────────────
#  Role → Permissions mapping (hierarchical, inclusive)
# ─────────────────────────────────────────────────────────────

_VIEWER: Set[Permission] = {
    Permission.VIEW,
    Permission.VIEW_AUDIT,
    Permission.EXPORT_DOCUMENT,
}

_EDITOR: Set[Permission] = _VIEWER | {
    Permission.CREATE_NODE,
    Permission.EDIT_NODE,
    Permission.DELETE_NODE,
    Permission.MANAGE_CARDS,
    Permission.INGEST_SOURCE,
}

_ADMIN: Set[Permission] = _EDITOR | {
    Permission.APPROVE_SCOPE_CHANGE,
    Permission.MANAGE_TEAM,
    Permission.SHARE_SESSION,
}

_OWNER: Set[Permission] = _ADMIN | {
    Permission.DELETE_SESSION,
    Permission.MANAGE_USERS,
}

ROLE_PERMISSIONS: dict[UserRole, Set[Permission]] = {
    UserRole.VIEWER: _VIEWER,
    UserRole.EDITOR: _EDITOR,
    UserRole.ADMIN: _ADMIN,
    UserRole.OWNER: _OWNER,
}

# Rank for "best role" resolution  (higher = more privileged)
_ROLE_RANK = {
    UserRole.VIEWER: 0,
    UserRole.EDITOR: 1,
    UserRole.ADMIN: 2,
    UserRole.OWNER: 3,
}


# ─────────────────────────────────────────────────────────────
#  Helpers
# ─────────────────────────────────────────────────────────────

def has_permission(role: UserRole, perm: Permission) -> bool:
    """Check if a role grants a specific permission."""
    return perm in ROLE_PERMISSIONS.get(role, set())


def effective_role(
    user: User,
    session_id: Optional[UUID],
    db: DBSession,
) -> UserRole:
    """
    Resolve the *effective* role for a user on a given session.

    Priority:
    1. Session owner (``session.user_id == user.id``) → Owner
    2. ``SessionMember.role`` if an explicit share exists
    3. User's global ``user.role``

    The highest-privilege role wins.
    """
    best = user.role

    if session_id:
        session = db.query(SessionModel).filter(SessionModel.id == session_id).first()
        if session and session.user_id == user.id:
            # Session creator is always Owner
            best = _max_role(best, UserRole.OWNER)
        else:
            member = (
                db.query(SessionMember)
                .filter(
                    SessionMember.session_id == session_id,
                    SessionMember.user_id == user.id,
                )
                .first()
            )
            if member:
                best = _max_role(best, member.role)

    return best


def _max_role(a: UserRole, b: UserRole) -> UserRole:
    return a if _ROLE_RANK.get(a, 0) >= _ROLE_RANK.get(b, 0) else b


# ─────────────────────────────────────────────────────────────
#  FastAPI dependency factories
# ─────────────────────────────────────────────────────────────

def require_permission(perm: Permission):
    """
    Returns a FastAPI dependency that checks the **global** user role.

    Usage::

        @router.post("/admin/users")
        async def create_user(
            _: User = Depends(require_permission(Permission.MANAGE_USERS)),
        ):
            ...
    """

    def _guard(
        current_user: User = Depends(get_current_user),
    ) -> User:
        if not has_permission(current_user.role, perm):
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=f"Insufficient permissions — requires '{perm.value}'",
            )
        return current_user

    return _guard


def require_session_role(perm: Permission, *, session_id_param: str = "session_id"):
    """
    Returns a FastAPI dependency that resolves the user's *effective*
    role on the session identified by the path/query parameter
    ``session_id_param`` and checks whether it grants ``perm``.

    Usage::

        @router.post("/nodes/add")
        async def add_node(
            node_data: NodeCreate,
            db: Session = Depends(get_db),
            current_user: User = Depends(
                require_session_role(Permission.CREATE_NODE)
            ),
        ):
            ...

    The session_id is extracted from the **request** path params
    or query params at runtime.
    """

    from fastapi import Request

    def _guard(
        request: Request,
        current_user: User = Depends(get_current_user),
        db: DBSession = Depends(get_db),
    ) -> User:
        # Try path params first, then query params, then body is too late
        sid_raw = request.path_params.get(session_id_param) or request.query_params.get(session_id_param)
        sid: Optional[UUID] = None
        if sid_raw:
            try:
                sid = UUID(str(sid_raw))
            except (ValueError, AttributeError):
                pass

        role = effective_role(current_user, sid, db)
        if not has_permission(role, perm):
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=f"Insufficient permissions on this session — requires '{perm.value}'",
            )
        return current_user

    return _guard
