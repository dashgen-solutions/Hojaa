"""
18.2-A  Real-time Collaboration — WebSocket endpoint.

Clients connect to  ``/api/ws/{session_id}?token=<jwt>``

Supported inbound message types:
  - ``{ "type": "heartbeat" }``  — keeps presence alive
  - ``{ "type": "cursor", "node_id": "...", "x": 0, "y": 0 }``  — cursor position
  - ``{ "type": "typing", "node_id": "..." }``  — typing indicator

All outbound messages have ``{ "type": "...", ... }`` format.
"""
from __future__ import annotations

import json
from fastapi import APIRouter, WebSocket, WebSocketDisconnect, Query
from jose import JWTError, jwt
from datetime import datetime

from app.core.config import settings
from app.core.logger import get_logger
from app.db.session import SessionLocal
from app.models.database import User
from app.services.websocket_manager import ws_manager

logger = get_logger(__name__)
router = APIRouter(tags=["websocket"])

ALGORITHM = "HS256"


def _authenticate_ws(token: str) -> dict | None:
    """Validate JWT and return {user_id, username} or None."""
    try:
        payload = jwt.decode(token, settings.secret_key, algorithms=[ALGORITHM])
        user_id = payload.get("sub")
        if not user_id:
            return None
        db = SessionLocal()
        try:
            user = db.query(User).filter(User.id == user_id).first()
            if not user or not user.is_active:
                return None
            return {"user_id": str(user.id), "username": user.username}
        finally:
            db.close()
    except (JWTError, Exception):
        return None


@router.websocket("/ws/{session_id}")
async def websocket_endpoint(
    websocket: WebSocket,
    session_id: str,
    token: str = Query(...),
):
    """WebSocket endpoint for real-time session collaboration."""

    # Authenticate
    auth = _authenticate_ws(token)
    if not auth:
        await websocket.close(code=4001, reason="Authentication failed")
        return

    conn = await ws_manager.connect(
        websocket,
        session_id=session_id,
        user_id=auth["user_id"],
        username=auth["username"],
    )

    try:
        while True:
            raw = await websocket.receive_text()
            try:
                msg = json.loads(raw)
            except json.JSONDecodeError:
                continue

            msg_type = msg.get("type", "")

            if msg_type == "heartbeat":
                # Update presence heartbeat
                ws_manager._upsert_presence(session_id, auth["user_id"])
                await websocket.send_json({"type": "heartbeat_ack", "ts": datetime.utcnow().isoformat()})

            elif msg_type == "cursor":
                # Relay cursor position to others
                await ws_manager.broadcast(session_id, {
                    "type": "cursor",
                    "user_id": auth["user_id"],
                    "username": auth["username"],
                    "node_id": msg.get("node_id"),
                    "x": msg.get("x", 0),
                    "y": msg.get("y", 0),
                    "timestamp": datetime.utcnow().isoformat(),
                }, exclude=conn)

            elif msg_type == "typing":
                await ws_manager.broadcast(session_id, {
                    "type": "typing",
                    "user_id": auth["user_id"],
                    "username": auth["username"],
                    "node_id": msg.get("node_id"),
                    "timestamp": datetime.utcnow().isoformat(),
                }, exclude=conn)

            elif msg_type == "lock":
                # Node-level editing lock
                await ws_manager.broadcast(session_id, {
                    "type": "lock",
                    "action": msg.get("action", "acquire"),  # acquire | release
                    "user_id": auth["user_id"],
                    "username": auth["username"],
                    "node_id": msg.get("node_id"),
                    "timestamp": datetime.utcnow().isoformat(),
                })

    except WebSocketDisconnect:
        await ws_manager.disconnect(conn)
    except Exception as e:
        logger.error(f"WS error: {e}", exc_info=True)
        await ws_manager.disconnect(conn)
