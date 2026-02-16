"""
18.2-A  Real-time Collaboration — WebSocket Connection Manager.

Provides:
- Per-session rooms with connection tracking.
- Presence broadcasting (join / leave / heartbeat).
- Event broadcasting (node changes, card updates, chat messages, etc.).
- Stale-connection cleanup (heartbeat-based).

All connected clients for a session receive every event in that room.
"""
from __future__ import annotations

import asyncio
import json
from datetime import datetime, timedelta
from typing import Any, Dict, List, Optional, Set
from uuid import UUID

from fastapi import WebSocket, WebSocketDisconnect
from sqlalchemy.orm import Session as DBSession

from app.core.logger import get_logger
from app.db.session import SessionLocal
from app.models.database import WebSocketPresence

logger = get_logger(__name__)

# Heartbeat interval — clients should ping at this cadence
HEARTBEAT_INTERVAL_SECONDS = 30
# Connections not heard from in this window are considered stale
STALE_THRESHOLD = timedelta(seconds=HEARTBEAT_INTERVAL_SECONDS * 3)


class _Connection:
    """Wrapper around a WebSocket with metadata."""

    __slots__ = ("ws", "user_id", "username", "session_id", "connected_at")

    def __init__(self, ws: WebSocket, user_id: str, username: str, session_id: str):
        self.ws = ws
        self.user_id = user_id
        self.username = username
        self.session_id = session_id
        self.connected_at = datetime.utcnow()


class ConnectionManager:
    """Manages WebSocket connections grouped by session_id."""

    def __init__(self) -> None:
        # session_id → set of _Connection
        self._rooms: Dict[str, Set[_Connection]] = {}
        self._cleanup_task: Optional[asyncio.Task] = None

    # ── lifecycle ──

    async def connect(
        self,
        ws: WebSocket,
        session_id: str,
        user_id: str,
        username: str,
    ) -> _Connection:
        """Accept a WebSocket and register in the session room."""
        await ws.accept()

        conn = _Connection(ws, user_id, username, session_id)
        room = self._rooms.setdefault(session_id, set())
        room.add(conn)

        # Persist presence row
        self._upsert_presence(session_id, user_id)

        # Broadcast join event
        await self.broadcast(session_id, {
            "type": "presence",
            "action": "join",
            "user_id": user_id,
            "username": username,
            "online_users": self._online_users(session_id),
            "timestamp": datetime.utcnow().isoformat(),
        }, exclude=conn)

        # Send current presence to the joining client
        await self._send(conn, {
            "type": "presence",
            "action": "state",
            "online_users": self._online_users(session_id),
            "timestamp": datetime.utcnow().isoformat(),
        })

        logger.info(f"WS connected: user={user_id} session={session_id}")
        return conn

    async def disconnect(self, conn: _Connection) -> None:
        """Remove a connection and broadcast leave event."""
        room = self._rooms.get(conn.session_id)
        if room:
            room.discard(conn)
            if not room:
                del self._rooms[conn.session_id]

        # Remove presence row
        self._remove_presence(conn.session_id, conn.user_id)

        await self.broadcast(conn.session_id, {
            "type": "presence",
            "action": "leave",
            "user_id": conn.user_id,
            "username": conn.username,
            "online_users": self._online_users(conn.session_id),
            "timestamp": datetime.utcnow().isoformat(),
        })

        logger.info(f"WS disconnected: user={conn.user_id} session={conn.session_id}")

    # ── messaging ──

    async def broadcast(
        self,
        session_id: str,
        data: dict,
        exclude: Optional[_Connection] = None,
    ) -> None:
        """Send a JSON message to all connections in a session room."""
        room = self._rooms.get(session_id, set())
        dead: List[_Connection] = []

        for conn in room:
            if conn is exclude:
                continue
            try:
                await self._send(conn, data)
            except Exception:
                dead.append(conn)

        # Clean up dead connections
        for d in dead:
            room.discard(d)
            self._remove_presence(d.session_id, d.user_id)

    async def _send(self, conn: _Connection, data: dict) -> None:
        try:
            await conn.ws.send_json(data)
        except Exception:
            raise

    # ── presence helpers ──

    def _online_users(self, session_id: str) -> List[dict]:
        """Return list of currently-connected users in a session."""
        room = self._rooms.get(session_id, set())
        seen: Dict[str, dict] = {}
        for conn in room:
            if conn.user_id not in seen:
                seen[conn.user_id] = {
                    "user_id": conn.user_id,
                    "username": conn.username,
                    "connected_at": conn.connected_at.isoformat(),
                }
        return list(seen.values())

    def _upsert_presence(self, session_id: str, user_id: str) -> None:
        """Insert or update presence row (fire-and-forget)."""
        try:
            db: DBSession = SessionLocal()
            try:
                existing = (
                    db.query(WebSocketPresence)
                    .filter_by(session_id=session_id, user_id=user_id)
                    .first()
                )
                if existing:
                    existing.last_heartbeat = datetime.utcnow()
                else:
                    db.add(WebSocketPresence(
                        session_id=session_id,
                        user_id=user_id,
                    ))
                db.commit()
            finally:
                db.close()
        except Exception as e:
            logger.warning(f"Presence upsert failed: {e}")

    def _remove_presence(self, session_id: str, user_id: str) -> None:
        """Remove presence row (fire-and-forget)."""
        try:
            db: DBSession = SessionLocal()
            try:
                db.query(WebSocketPresence).filter_by(
                    session_id=session_id, user_id=user_id,
                ).delete()
                db.commit()
            finally:
                db.close()
        except Exception as e:
            logger.warning(f"Presence remove failed: {e}")

    # ── periodic cleanup ──

    async def start_cleanup_loop(self) -> None:
        """Start a background task that cleans stale presence rows."""
        self._cleanup_task = asyncio.create_task(self._cleanup_loop())

    async def _cleanup_loop(self) -> None:
        while True:
            await asyncio.sleep(HEARTBEAT_INTERVAL_SECONDS * 2)
            try:
                cutoff = datetime.utcnow() - STALE_THRESHOLD
                db: DBSession = SessionLocal()
                try:
                    db.query(WebSocketPresence).filter(
                        WebSocketPresence.last_heartbeat < cutoff,
                    ).delete()
                    db.commit()
                finally:
                    db.close()
            except Exception as e:
                logger.warning(f"Presence cleanup error: {e}")

    def stop_cleanup_loop(self) -> None:
        if self._cleanup_task:
            self._cleanup_task.cancel()


# ── Singleton ──
ws_manager = ConnectionManager()
