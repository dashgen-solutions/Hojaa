"""
Messaging WebSocket Connection Manager.

Manages user-level WebSocket connections for the global messaging feature.
Unlike the session-scoped ws_manager, this is keyed by user_id so that
messages can be pushed to any online user regardless of which session they're in.
"""
from __future__ import annotations

import asyncio
from datetime import datetime
from typing import Any, Dict, List, Optional, Set

from fastapi import WebSocket
from sqlalchemy.orm import Session as DBSession

from app.core.logger import get_logger
from app.db.session import SessionLocal
from app.models.database import ChatChannelMember

logger = get_logger(__name__)


class _MsgConnection:
    """Wrapper around a WebSocket with user metadata."""

    __slots__ = ("ws", "user_id", "username", "connected_at")

    def __init__(self, ws: WebSocket, user_id: str, username: str):
        self.ws = ws
        self.user_id = user_id
        self.username = username
        self.connected_at = datetime.utcnow()


class MessagingConnectionManager:
    """Manages WebSocket connections for messaging, keyed by user_id."""

    def __init__(self) -> None:
        # user_id -> set of _MsgConnection  (a user may have multiple tabs)
        self._connections: Dict[str, Set[_MsgConnection]] = {}

    # -- lifecycle --

    async def connect(self, ws: WebSocket, user_id: str, username: str) -> _MsgConnection:
        """Accept a WebSocket and register for the user."""
        await ws.accept()
        conn = _MsgConnection(ws, user_id, username)
        self._connections.setdefault(user_id, set()).add(conn)
        logger.info(f"Messaging WS connected: user={user_id}")
        return conn

    async def disconnect(self, conn: _MsgConnection) -> None:
        """Remove a connection."""
        conns = self._connections.get(conn.user_id)
        if conns:
            conns.discard(conn)
            if not conns:
                del self._connections[conn.user_id]
        logger.info(f"Messaging WS disconnected: user={conn.user_id}")

    # -- sending --

    async def send_to_user(self, user_id: str, data: dict) -> None:
        """Send a JSON message to all connections of a specific user."""
        conns = self._connections.get(user_id, set())
        dead: List[_MsgConnection] = []
        for conn in conns:
            try:
                await conn.ws.send_json(data)
            except Exception:
                dead.append(conn)
        for d in dead:
            conns.discard(d)

    async def send_to_channel_members(
        self,
        channel_id: str,
        data: dict,
        exclude_user: Optional[str] = None,
    ) -> None:
        """
        Send a message to all online members of a channel.

        Looks up channel membership from DB, then pushes to each online user.
        """
        # Get member user_ids from DB
        member_user_ids = self._get_channel_member_ids(channel_id)

        for uid in member_user_ids:
            if uid == exclude_user:
                continue
            await self.send_to_user(uid, data)

    def _get_channel_member_ids(self, channel_id: str) -> List[str]:
        """Fetch channel member user_ids from DB (synchronous, fire-and-forget)."""
        try:
            db: DBSession = SessionLocal()
            try:
                members = (
                    db.query(ChatChannelMember.user_id)
                    .filter(ChatChannelMember.channel_id == channel_id)
                    .all()
                )
                return [str(m.user_id) for m in members]
            finally:
                db.close()
        except Exception as e:
            logger.warning(f"Failed to get channel members for WS broadcast: {e}")
            return []

    def is_user_online(self, user_id: str) -> bool:
        """Check if a user has any active WebSocket connections."""
        return bool(self._connections.get(user_id))


# -- Singleton --
messaging_ws_manager = MessagingConnectionManager()
