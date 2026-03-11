"""
Tests for WebRTC call signaling via the messaging WebSocket.

Tests cover:
1. MessagingConnectionManager unit tests (send_to_user, connect/disconnect)
2. Call signaling message routing (call_initiate → call_incoming, etc.)
3. Full call flow simulation (initiate → accept → offer/answer/ICE → hangup)
"""
import asyncio
import json
import pytest
import pytest_asyncio
from unittest.mock import AsyncMock, MagicMock, patch
from datetime import datetime

from app.services.messaging_ws_manager import MessagingConnectionManager, _MsgConnection


# ═══════════════════════════════════════════════════════════════
# Helpers
# ═══════════════════════════════════════════════════════════════

def make_mock_ws():
    """Create a mock WebSocket with async methods."""
    ws = AsyncMock()
    ws.accept = AsyncMock()
    ws.send_json = AsyncMock()
    ws.receive_text = AsyncMock()
    ws.close = AsyncMock()
    return ws


# ═══════════════════════════════════════════════════════════════
# Test: MessagingConnectionManager
# ═══════════════════════════════════════════════════════════════

class TestMessagingConnectionManager:
    """Unit tests for the connection manager used by call signaling."""

    @pytest.mark.asyncio
    async def test_connect_registers_user(self):
        mgr = MessagingConnectionManager()
        ws = make_mock_ws()

        conn = await mgr.connect(ws, user_id="user-A", username="Alice")

        assert mgr.is_user_online("user-A")
        assert conn.user_id == "user-A"
        assert conn.username == "Alice"
        ws.accept.assert_called_once()

    @pytest.mark.asyncio
    async def test_disconnect_removes_user(self):
        mgr = MessagingConnectionManager()
        ws = make_mock_ws()

        conn = await mgr.connect(ws, user_id="user-A", username="Alice")
        assert mgr.is_user_online("user-A")

        await mgr.disconnect(conn)
        assert not mgr.is_user_online("user-A")

    @pytest.mark.asyncio
    async def test_multiple_tabs_same_user(self):
        """A user with 2 tabs should receive messages on both connections."""
        mgr = MessagingConnectionManager()
        ws1 = make_mock_ws()
        ws2 = make_mock_ws()

        conn1 = await mgr.connect(ws1, user_id="user-A", username="Alice")
        conn2 = await mgr.connect(ws2, user_id="user-A", username="Alice")

        payload = {"type": "test", "data": "hello"}
        await mgr.send_to_user("user-A", payload)

        ws1.send_json.assert_called_once_with(payload)
        ws2.send_json.assert_called_once_with(payload)

        # Disconnect one tab → user still online
        await mgr.disconnect(conn1)
        assert mgr.is_user_online("user-A")

        # Disconnect second tab → user offline
        await mgr.disconnect(conn2)
        assert not mgr.is_user_online("user-A")

    @pytest.mark.asyncio
    async def test_send_to_offline_user_is_noop(self):
        """Sending to a user who isn't connected should not raise."""
        mgr = MessagingConnectionManager()
        # Should not raise
        await mgr.send_to_user("nonexistent-user", {"type": "test"})

    @pytest.mark.asyncio
    async def test_dead_connection_is_removed(self):
        """If send_json raises, the dead connection should be cleaned up."""
        mgr = MessagingConnectionManager()
        ws = make_mock_ws()
        ws.send_json.side_effect = RuntimeError("Connection closed")

        conn = await mgr.connect(ws, user_id="user-A", username="Alice")
        assert mgr.is_user_online("user-A")

        await mgr.send_to_user("user-A", {"type": "test"})

        # The dead connection should have been removed
        assert not mgr.is_user_online("user-A")


# ═══════════════════════════════════════════════════════════════
# Test: Call signaling message routing
# ═══════════════════════════════════════════════════════════════

class TestCallSignalingRouting:
    """
    Tests that verify the call signaling logic in the WS handler.
    
    We simulate the message dispatch loop by extracting the routing 
    logic into a helper that mirrors the backend handler.
    """

    async def _simulate_message(self, mgr: MessagingConnectionManager, auth: dict, msg: dict):
        """
        Simulates the call-signaling portion of the messaging_websocket handler.
        This mirrors the elif branches in messaging.py for call signaling.
        """
        msg_type = msg.get("type", "")

        if msg_type == "call_initiate":
            target_user_id = msg.get("target_user_id")
            channel_id = msg.get("channel_id")
            call_type = msg.get("call_type", "audio")
            if target_user_id:
                await mgr.send_to_user(target_user_id, {
                    "type": "call_incoming",
                    "caller_id": auth["user_id"],
                    "caller_name": auth["username"],
                    "channel_id": channel_id,
                    "call_type": call_type,
                })

        elif msg_type == "call_accept":
            caller_id = msg.get("caller_id")
            if caller_id:
                await mgr.send_to_user(caller_id, {
                    "type": "call_accepted",
                    "callee_id": auth["user_id"],
                    "callee_name": auth["username"],
                    "channel_id": msg.get("channel_id"),
                })

        elif msg_type == "call_reject":
            caller_id = msg.get("caller_id")
            if caller_id:
                await mgr.send_to_user(caller_id, {
                    "type": "call_rejected",
                    "callee_id": auth["user_id"],
                    "callee_name": auth["username"],
                    "reason": msg.get("reason", "rejected"),
                })

        elif msg_type == "call_hangup":
            target_user_id = msg.get("target_user_id")
            if target_user_id:
                await mgr.send_to_user(target_user_id, {
                    "type": "call_ended",
                    "user_id": auth["user_id"],
                    "username": auth["username"],
                    "reason": msg.get("reason", "hangup"),
                })

        elif msg_type == "webrtc_offer":
            target_user_id = msg.get("target_user_id")
            if target_user_id:
                await mgr.send_to_user(target_user_id, {
                    "type": "webrtc_offer",
                    "from_user_id": auth["user_id"],
                    "sdp": msg.get("sdp"),
                })

        elif msg_type == "webrtc_answer":
            target_user_id = msg.get("target_user_id")
            if target_user_id:
                await mgr.send_to_user(target_user_id, {
                    "type": "webrtc_answer",
                    "from_user_id": auth["user_id"],
                    "sdp": msg.get("sdp"),
                })

        elif msg_type == "webrtc_ice_candidate":
            target_user_id = msg.get("target_user_id")
            if target_user_id:
                await mgr.send_to_user(target_user_id, {
                    "type": "webrtc_ice_candidate",
                    "from_user_id": auth["user_id"],
                    "candidate": msg.get("candidate"),
                })

    # ---- Individual signal tests ----

    @pytest.mark.asyncio
    async def test_call_initiate_sends_incoming(self):
        """call_initiate from Alice → call_incoming to Bob."""
        mgr = MessagingConnectionManager()
        bob_ws = make_mock_ws()
        await mgr.connect(bob_ws, user_id="bob-id", username="Bob")

        await self._simulate_message(
            mgr,
            auth={"user_id": "alice-id", "username": "Alice"},
            msg={
                "type": "call_initiate",
                "target_user_id": "bob-id",
                "channel_id": "ch-1",
                "call_type": "video",
            },
        )

        bob_ws.send_json.assert_called_once_with({
            "type": "call_incoming",
            "caller_id": "alice-id",
            "caller_name": "Alice",
            "channel_id": "ch-1",
            "call_type": "video",
        })

    @pytest.mark.asyncio
    async def test_call_accept_notifies_caller(self):
        """call_accept from Bob → call_accepted to Alice."""
        mgr = MessagingConnectionManager()
        alice_ws = make_mock_ws()
        await mgr.connect(alice_ws, user_id="alice-id", username="Alice")

        await self._simulate_message(
            mgr,
            auth={"user_id": "bob-id", "username": "Bob"},
            msg={
                "type": "call_accept",
                "caller_id": "alice-id",
                "channel_id": "ch-1",
            },
        )

        alice_ws.send_json.assert_called_once_with({
            "type": "call_accepted",
            "callee_id": "bob-id",
            "callee_name": "Bob",
            "channel_id": "ch-1",
        })

    @pytest.mark.asyncio
    async def test_call_reject_notifies_caller(self):
        """call_reject from Bob → call_rejected to Alice."""
        mgr = MessagingConnectionManager()
        alice_ws = make_mock_ws()
        await mgr.connect(alice_ws, user_id="alice-id", username="Alice")

        await self._simulate_message(
            mgr,
            auth={"user_id": "bob-id", "username": "Bob"},
            msg={
                "type": "call_reject",
                "caller_id": "alice-id",
                "reason": "busy",
            },
        )

        alice_ws.send_json.assert_called_once_with({
            "type": "call_rejected",
            "callee_id": "bob-id",
            "callee_name": "Bob",
            "reason": "busy",
        })

    @pytest.mark.asyncio
    async def test_call_reject_default_reason(self):
        """call_reject without explicit reason defaults to 'rejected'."""
        mgr = MessagingConnectionManager()
        alice_ws = make_mock_ws()
        await mgr.connect(alice_ws, user_id="alice-id", username="Alice")

        await self._simulate_message(
            mgr,
            auth={"user_id": "bob-id", "username": "Bob"},
            msg={
                "type": "call_reject",
                "caller_id": "alice-id",
            },
        )

        sent = alice_ws.send_json.call_args[0][0]
        assert sent["reason"] == "rejected"

    @pytest.mark.asyncio
    async def test_call_hangup_notifies_other(self):
        """call_hangup from Alice → call_ended to Bob."""
        mgr = MessagingConnectionManager()
        bob_ws = make_mock_ws()
        await mgr.connect(bob_ws, user_id="bob-id", username="Bob")

        await self._simulate_message(
            mgr,
            auth={"user_id": "alice-id", "username": "Alice"},
            msg={
                "type": "call_hangup",
                "target_user_id": "bob-id",
                "reason": "hangup",
            },
        )

        bob_ws.send_json.assert_called_once_with({
            "type": "call_ended",
            "user_id": "alice-id",
            "username": "Alice",
            "reason": "hangup",
        })

    @pytest.mark.asyncio
    async def test_webrtc_offer_forwarded(self):
        """webrtc_offer relays SDP to target."""
        mgr = MessagingConnectionManager()
        bob_ws = make_mock_ws()
        await mgr.connect(bob_ws, user_id="bob-id", username="Bob")

        sdp_data = {"type": "offer", "sdp": "v=0\r\n..."}
        await self._simulate_message(
            mgr,
            auth={"user_id": "alice-id", "username": "Alice"},
            msg={
                "type": "webrtc_offer",
                "target_user_id": "bob-id",
                "sdp": sdp_data,
            },
        )

        bob_ws.send_json.assert_called_once_with({
            "type": "webrtc_offer",
            "from_user_id": "alice-id",
            "sdp": sdp_data,
        })

    @pytest.mark.asyncio
    async def test_webrtc_answer_forwarded(self):
        """webrtc_answer relays SDP to target."""
        mgr = MessagingConnectionManager()
        alice_ws = make_mock_ws()
        await mgr.connect(alice_ws, user_id="alice-id", username="Alice")

        sdp_data = {"type": "answer", "sdp": "v=0\r\n...answer"}
        await self._simulate_message(
            mgr,
            auth={"user_id": "bob-id", "username": "Bob"},
            msg={
                "type": "webrtc_answer",
                "target_user_id": "alice-id",
                "sdp": sdp_data,
            },
        )

        alice_ws.send_json.assert_called_once_with({
            "type": "webrtc_answer",
            "from_user_id": "bob-id",
            "sdp": sdp_data,
        })

    @pytest.mark.asyncio
    async def test_webrtc_ice_candidate_forwarded(self):
        """webrtc_ice_candidate relays ICE candidate to target."""
        mgr = MessagingConnectionManager()
        bob_ws = make_mock_ws()
        await mgr.connect(bob_ws, user_id="bob-id", username="Bob")

        candidate = {"candidate": "candidate:1 1 UDP 2013266431 ...", "sdpMid": "0", "sdpMLineIndex": 0}
        await self._simulate_message(
            mgr,
            auth={"user_id": "alice-id", "username": "Alice"},
            msg={
                "type": "webrtc_ice_candidate",
                "target_user_id": "bob-id",
                "candidate": candidate,
            },
        )

        bob_ws.send_json.assert_called_once_with({
            "type": "webrtc_ice_candidate",
            "from_user_id": "alice-id",
            "candidate": candidate,
        })

    @pytest.mark.asyncio
    async def test_missing_target_is_noop(self):
        """Messages without a target user_id should not crash."""
        mgr = MessagingConnectionManager()

        # None of these should raise
        for msg_type in ["call_initiate", "call_hangup", "webrtc_offer", "webrtc_answer", "webrtc_ice_candidate"]:
            await self._simulate_message(
                mgr,
                auth={"user_id": "alice-id", "username": "Alice"},
                msg={"type": msg_type},  # missing target_user_id
            )

    @pytest.mark.asyncio
    async def test_missing_caller_in_accept_reject(self):
        """call_accept/reject without caller_id should not crash."""
        mgr = MessagingConnectionManager()
        for msg_type in ["call_accept", "call_reject"]:
            await self._simulate_message(
                mgr,
                auth={"user_id": "bob-id", "username": "Bob"},
                msg={"type": msg_type},  # missing caller_id
            )


# ═══════════════════════════════════════════════════════════════
# Test: Full call flow end-to-end
# ═══════════════════════════════════════════════════════════════

class TestFullCallFlow:
    """
    Simulates a complete audio call flow:
      Alice calls Bob → Bob accepts → offer/answer exchange → ICE → Alice hangs up
    """

    async def _route(self, mgr, auth, msg):
        """Same dispatch helper."""
        msg_type = msg.get("type", "")
        if msg_type == "call_initiate":
            target = msg.get("target_user_id")
            if target:
                await mgr.send_to_user(target, {
                    "type": "call_incoming",
                    "caller_id": auth["user_id"],
                    "caller_name": auth["username"],
                    "channel_id": msg.get("channel_id"),
                    "call_type": msg.get("call_type", "audio"),
                })
        elif msg_type == "call_accept":
            caller = msg.get("caller_id")
            if caller:
                await mgr.send_to_user(caller, {
                    "type": "call_accepted",
                    "callee_id": auth["user_id"],
                    "callee_name": auth["username"],
                    "channel_id": msg.get("channel_id"),
                })
        elif msg_type == "call_reject":
            caller = msg.get("caller_id")
            if caller:
                await mgr.send_to_user(caller, {
                    "type": "call_rejected",
                    "callee_id": auth["user_id"],
                    "callee_name": auth["username"],
                    "reason": msg.get("reason", "rejected"),
                })
        elif msg_type == "webrtc_offer":
            target = msg.get("target_user_id")
            if target:
                await mgr.send_to_user(target, {
                    "type": "webrtc_offer", "from_user_id": auth["user_id"], "sdp": msg.get("sdp"),
                })
        elif msg_type == "webrtc_answer":
            target = msg.get("target_user_id")
            if target:
                await mgr.send_to_user(target, {
                    "type": "webrtc_answer", "from_user_id": auth["user_id"], "sdp": msg.get("sdp"),
                })
        elif msg_type == "webrtc_ice_candidate":
            target = msg.get("target_user_id")
            if target:
                await mgr.send_to_user(target, {
                    "type": "webrtc_ice_candidate", "from_user_id": auth["user_id"], "candidate": msg.get("candidate"),
                })
        elif msg_type == "call_hangup":
            target = msg.get("target_user_id")
            if target:
                await mgr.send_to_user(target, {
                    "type": "call_ended", "user_id": auth["user_id"], "username": auth["username"], "reason": "hangup",
                })

    @pytest.mark.asyncio
    async def test_full_audio_call_flow(self):
        """Simulate a complete audio call: initiate → accept → offer/answer/ICE → hangup."""
        mgr = MessagingConnectionManager()
        alice_ws = make_mock_ws()
        bob_ws = make_mock_ws()

        await mgr.connect(alice_ws, user_id="alice", username="Alice")
        await mgr.connect(bob_ws, user_id="bob", username="Bob")

        alice_auth = {"user_id": "alice", "username": "Alice"}
        bob_auth = {"user_id": "bob", "username": "Bob"}

        # Step 1: Alice initiates call to Bob
        await self._route(mgr, alice_auth, {
            "type": "call_initiate",
            "target_user_id": "bob",
            "channel_id": "dm-1",
            "call_type": "audio",
        })
        bob_msg_1 = bob_ws.send_json.call_args_list[-1][0][0]
        assert bob_msg_1["type"] == "call_incoming"
        assert bob_msg_1["caller_id"] == "alice"
        assert bob_msg_1["call_type"] == "audio"

        # Step 2: Bob accepts
        await self._route(mgr, bob_auth, {
            "type": "call_accept",
            "caller_id": "alice",
            "channel_id": "dm-1",
        })
        alice_msg_1 = alice_ws.send_json.call_args_list[-1][0][0]
        assert alice_msg_1["type"] == "call_accepted"
        assert alice_msg_1["callee_id"] == "bob"

        # Step 3: Alice sends SDP offer
        offer_sdp = {"type": "offer", "sdp": "v=0\r\nfake-offer-sdp"}
        await self._route(mgr, alice_auth, {
            "type": "webrtc_offer",
            "target_user_id": "bob",
            "sdp": offer_sdp,
        })
        bob_msg_2 = bob_ws.send_json.call_args_list[-1][0][0]
        assert bob_msg_2["type"] == "webrtc_offer"
        assert bob_msg_2["from_user_id"] == "alice"
        assert bob_msg_2["sdp"] == offer_sdp

        # Step 4: Bob sends SDP answer
        answer_sdp = {"type": "answer", "sdp": "v=0\r\nfake-answer-sdp"}
        await self._route(mgr, bob_auth, {
            "type": "webrtc_answer",
            "target_user_id": "alice",
            "sdp": answer_sdp,
        })
        alice_msg_2 = alice_ws.send_json.call_args_list[-1][0][0]
        assert alice_msg_2["type"] == "webrtc_answer"
        assert alice_msg_2["from_user_id"] == "bob"
        assert alice_msg_2["sdp"] == answer_sdp

        # Step 5: Alice sends ICE candidate
        ice = {"candidate": "candidate:1 1 UDP 2013266431 1.2.3.4 54321 typ host", "sdpMid": "0"}
        await self._route(mgr, alice_auth, {
            "type": "webrtc_ice_candidate",
            "target_user_id": "bob",
            "candidate": ice,
        })
        bob_msg_3 = bob_ws.send_json.call_args_list[-1][0][0]
        assert bob_msg_3["type"] == "webrtc_ice_candidate"
        assert bob_msg_3["candidate"] == ice

        # Step 6: Bob sends ICE candidate
        ice2 = {"candidate": "candidate:2 1 UDP 1234567890 5.6.7.8 12345 typ srflx", "sdpMid": "0"}
        await self._route(mgr, bob_auth, {
            "type": "webrtc_ice_candidate",
            "target_user_id": "alice",
            "candidate": ice2,
        })
        alice_msg_3 = alice_ws.send_json.call_args_list[-1][0][0]
        assert alice_msg_3["type"] == "webrtc_ice_candidate"
        assert alice_msg_3["candidate"] == ice2

        # Step 7: Alice hangs up
        await self._route(mgr, alice_auth, {
            "type": "call_hangup",
            "target_user_id": "bob",
            "reason": "hangup",
        })
        bob_msg_4 = bob_ws.send_json.call_args_list[-1][0][0]
        assert bob_msg_4["type"] == "call_ended"
        assert bob_msg_4["user_id"] == "alice"
        assert bob_msg_4["reason"] == "hangup"

        # Verify total message counts
        # Bob received: call_incoming, webrtc_offer, webrtc_ice_candidate, call_ended = 4
        assert bob_ws.send_json.call_count == 4
        # Alice received: call_accepted, webrtc_answer, webrtc_ice_candidate = 3
        assert alice_ws.send_json.call_count == 3

    @pytest.mark.asyncio
    async def test_call_rejected_flow(self):
        """Alice calls Bob → Bob rejects → Alice gets rejection."""
        mgr = MessagingConnectionManager()
        alice_ws = make_mock_ws()
        bob_ws = make_mock_ws()

        await mgr.connect(alice_ws, user_id="alice", username="Alice")
        await mgr.connect(bob_ws, user_id="bob", username="Bob")

        alice_auth = {"user_id": "alice", "username": "Alice"}
        bob_auth = {"user_id": "bob", "username": "Bob"}

        # Alice calls
        await self._route(mgr, alice_auth, {
            "type": "call_initiate",
            "target_user_id": "bob",
            "channel_id": "dm-1",
            "call_type": "audio",
        })
        assert bob_ws.send_json.call_count == 1

        # Bob rejects
        await self._route(mgr, bob_auth, {
            "type": "call_reject",
            "caller_id": "alice",
            "reason": "busy",
        })
        msg = alice_ws.send_json.call_args_list[-1][0][0]
        assert msg["type"] == "call_rejected"
        assert msg["reason"] == "busy"

        # Only those two messages exchanged
        assert bob_ws.send_json.call_count == 1  # call_incoming only
        assert alice_ws.send_json.call_count == 1  # call_rejected only

    @pytest.mark.asyncio
    async def test_video_call_type_preserved(self):
        """call_type=video should be forwarded correctly."""
        mgr = MessagingConnectionManager()
        bob_ws = make_mock_ws()
        await mgr.connect(bob_ws, user_id="bob", username="Bob")

        await self._route(
            mgr,
            {"user_id": "alice", "username": "Alice"},
            {"type": "call_initiate", "target_user_id": "bob", "channel_id": "dm-1", "call_type": "video"},
        )
        msg = bob_ws.send_json.call_args[0][0]
        assert msg["call_type"] == "video"

    @pytest.mark.asyncio
    async def test_offline_target_no_crash(self):
        """Calling an offline user should not raise or crash."""
        mgr = MessagingConnectionManager()
        # No one is connected; this should be a silent no-op
        await self._route(
            mgr,
            {"user_id": "alice", "username": "Alice"},
            {"type": "call_initiate", "target_user_id": "bob", "channel_id": "dm-1"},
        )
        # No assertion needed — just verify no exception

    @pytest.mark.asyncio
    async def test_hangup_after_disconnect(self):
        """If Bob disconnects mid-call, Alice's hangup should not crash."""
        mgr = MessagingConnectionManager()
        bob_ws = make_mock_ws()
        conn = await mgr.connect(bob_ws, user_id="bob", username="Bob")
        await mgr.disconnect(conn)

        # Alice hangs up — Bob is offline, should be no-op
        await self._route(
            mgr,
            {"user_id": "alice", "username": "Alice"},
            {"type": "call_hangup", "target_user_id": "bob"},
        )
        # No send happened since Bob is offline
        bob_ws.send_json.assert_not_called()
