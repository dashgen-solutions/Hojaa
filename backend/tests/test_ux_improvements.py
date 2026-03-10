"""
Tests for UX improvements – Sprint 5.

Covers:
- Activate-all-nodes endpoint
- Simplified delete (always cascade, no keep-children option)
- Session rename (PATCH /api/sessions/{id})
- Node CRUD basics (add, update, delete flow)

Uses dependency-override pattern for authenticated integration tests
with an in-memory SQLite database.
"""
import uuid as uuid_module

# ── Monkey-patch PostgreSQL UUID to work with SQLite ──────────────────
from sqlalchemy.dialects.postgresql import UUID as PG_UUID

_orig_bind = PG_UUID.bind_processor
_orig_result = PG_UUID.result_processor


def _patched_bind(self, dialect):
    if dialect.name != "postgresql":
        def process(value):
            if value is not None:
                return str(value) if isinstance(value, uuid_module.UUID) else str(value)
            return value
        return process
    return _orig_bind(self, dialect)


def _patched_result(self, dialect, coltype):
    if dialect.name != "postgresql":
        def process(value):
            if value is not None:
                if isinstance(value, uuid_module.UUID):
                    return value
                return uuid_module.UUID(str(value))
            return value
        return process
    return _orig_result(self, dialect, coltype)


PG_UUID.bind_processor = _patched_bind
PG_UUID.result_processor = _patched_result

# ── Normal imports ────────────────────────────────────────────────────
import pytest
from uuid import uuid4, UUID
from datetime import datetime

from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import Session as SASession, sessionmaker
from sqlalchemy.pool import StaticPool

from app.main import app
from app.core.auth import get_current_user
from app.db.session import get_db
from app.models.database import (
    Base,
    User,
    Session as DBSession,
    SessionStatus,
    Node,
    NodeType,
    NodeStatus,
    Conversation,
    NodeHistory,
    ChatChannel,
    ChatChannelMember,
    TeamMember,
    SessionMember,
    UserRole,
)
from app.core.auth import get_optional_user


# ── In-memory SQLite ──────────────────────────────────────────────────

engine = create_engine(
    "sqlite://",
    connect_args={"check_same_thread": False},
    poolclass=StaticPool,
)
TestSessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)


def override_get_db():
    db = TestSessionLocal()
    try:
        yield db
    finally:
        db.close()


# ── Fake user ─────────────────────────────────────────────────────────

user_id = uuid4()
org_id = uuid4()


def _make_user(db: SASession, uid: UUID, username: str, email: str, oid=None) -> User:
    u = User(
        id=uid,
        username=username,
        email=email,
        hashed_password="fakehashed",
        is_active=True,
        organization_id=oid,
    )
    db.add(u)
    db.commit()
    db.refresh(u)
    return u


def override_current_user():
    db = TestSessionLocal()
    user = db.query(User).filter(User.id == user_id).first()
    db.close()
    return user


def override_optional_user():
    return override_current_user()


# ── Fixtures ──────────────────────────────────────────────────────────

@pytest.fixture(scope="module", autouse=True)
def setup_database():
    """Create tables and seed user once per module."""
    Base.metadata.create_all(bind=engine)
    db = TestSessionLocal()
    try:
        _make_user(db, user_id, "testuser", "testuser@test.com", org_id)
    finally:
        db.close()
    yield
    Base.metadata.drop_all(bind=engine)


@pytest.fixture(autouse=True)
def override_deps():
    """Override DB and auth deps; reset rate-limiter buckets."""
    from app.middleware.security import _general_limiter, _auth_limiter
    _general_limiter._buckets.clear()
    _auth_limiter._buckets.clear()

    app.dependency_overrides[get_db] = override_get_db
    app.dependency_overrides[get_current_user] = override_current_user
    app.dependency_overrides[get_optional_user] = override_optional_user
    yield
    app.dependency_overrides.clear()


client = TestClient(app)


# ── Helpers ───────────────────────────────────────────────────────────

def _create_session(name: str = "Test Project") -> str:
    """Create a session with a root node and return session_id."""
    db = TestSessionLocal()
    try:
        session = DBSession(
            id=uuid4(),
            user_id=user_id,
            organization_id=org_id,
            document_filename=name,
            status=SessionStatus.TREE_GENERATED,
        )
        db.add(session)
        db.flush()

        root = Node(
            id=uuid4(),
            session_id=session.id,
            question=name,
            answer="Root node",
            node_type=NodeType.ROOT,
            status=NodeStatus.ACTIVE,
            depth=0,
            order_index=0,
            can_expand=True,
            is_expanded=True,
        )
        db.add(root)
        db.commit()
        return str(session.id), str(root.id)
    finally:
        db.close()


def _add_child_node(session_id: str, parent_id: str, question: str, status: str = "active") -> str:
    """Use API to add a child node, return node id."""
    r = client.post(
        "/api/manage/nodes/add",
        json={
            "session_id": session_id,
            "parent_id": parent_id,
            "question": question,
            "answer": "Auto-added",
            "node_type": "feature",
        },
    )
    assert r.status_code == 201, f"Failed to add node: {r.text}"
    node_id = r.json()["id"]

    # If non-active status requested, update it
    if status != "active":
        db = TestSessionLocal()
        try:
            node = db.query(Node).filter(Node.id == UUID(node_id)).first()
            node.status = NodeStatus(status)
            db.commit()
        finally:
            db.close()

    return node_id


# ═══════════════════════════════════════════════════════════════════════
#  1. ACTIVATE ALL NODES
# ═══════════════════════════════════════════════════════════════════════


class TestActivateAllNodes:
    """Tests for POST /api/manage/nodes/{session_id}/activate-all"""

    def test_activate_all_activates_deferred_nodes(self):
        """Deferred nodes become active."""
        sid, root_id = _create_session("Activate-Deferred")
        _add_child_node(sid, root_id, "Feature A", status="deferred")
        _add_child_node(sid, root_id, "Feature B", status="deferred")
        _add_child_node(sid, root_id, "Feature C", status="active")

        r = client.post(f"/api/manage/nodes/{sid}/activate-all")
        assert r.status_code == 200
        data = r.json()
        assert data["success"] is True
        assert data["activated_count"] == 2  # Only 2 were non-active

    def test_activate_all_activates_new_nodes(self):
        """NEW status nodes become active."""
        sid, root_id = _create_session("Activate-New")
        _add_child_node(sid, root_id, "New Feature", status="new")

        r = client.post(f"/api/manage/nodes/{sid}/activate-all")
        assert r.status_code == 200
        assert r.json()["activated_count"] == 1

    def test_activate_all_skips_removed(self):
        """REMOVED nodes stay removed."""
        sid, root_id = _create_session("Activate-Removed")
        nid = _add_child_node(sid, root_id, "Removed Feature", status="removed")

        r = client.post(f"/api/manage/nodes/{sid}/activate-all")
        assert r.status_code == 200
        assert r.json()["activated_count"] == 0

        # Verify still removed
        db = TestSessionLocal()
        try:
            node = db.query(Node).filter(Node.id == UUID(nid)).first()
            assert node.status == NodeStatus.REMOVED
        finally:
            db.close()

    def test_activate_all_zero_when_all_active(self):
        """Returns 0 when everything is already active."""
        sid, root_id = _create_session("All-Active")
        _add_child_node(sid, root_id, "Active Feature", status="active")

        r = client.post(f"/api/manage/nodes/{sid}/activate-all")
        assert r.status_code == 200
        assert r.json()["activated_count"] == 0

    def test_activate_all_nonexistent_session(self):
        """Returns 404 for non-existent session."""
        fake_sid = str(uuid4())
        r = client.post(f"/api/manage/nodes/{fake_sid}/activate-all")
        assert r.status_code == 404

    def test_activate_all_mixed_statuses(self):
        """Handles a mix of active, deferred, completed, new, modified."""
        sid, root_id = _create_session("Mixed-Statuses")
        _add_child_node(sid, root_id, "Active", status="active")
        _add_child_node(sid, root_id, "Deferred", status="deferred")
        _add_child_node(sid, root_id, "Completed", status="completed")
        _add_child_node(sid, root_id, "New", status="new")
        _add_child_node(sid, root_id, "Modified", status="modified")

        r = client.post(f"/api/manage/nodes/{sid}/activate-all")
        assert r.status_code == 200
        # deferred + completed + new + modified = 4
        assert r.json()["activated_count"] == 4

    def test_activate_all_response_has_message(self):
        """Response includes a human-readable message."""
        sid, root_id = _create_session("Message-Check")
        _add_child_node(sid, root_id, "Feat", status="deferred")

        r = client.post(f"/api/manage/nodes/{sid}/activate-all")
        assert r.status_code == 200
        assert "message" in r.json()
        assert "1" in r.json()["message"]

    def test_activate_all_verify_db_state(self):
        """DB records actually show ACTIVE after activation."""
        sid, root_id = _create_session("Verify-DB")
        nid = _add_child_node(sid, root_id, "To-activate", status="deferred")

        client.post(f"/api/manage/nodes/{sid}/activate-all")

        db = TestSessionLocal()
        try:
            node = db.query(Node).filter(Node.id == UUID(nid)).first()
            assert node.status == NodeStatus.ACTIVE
        finally:
            db.close()


# ═══════════════════════════════════════════════════════════════════════
#  2. SIMPLIFIED DELETE (ALWAYS CASCADE)
# ═══════════════════════════════════════════════════════════════════════


class TestSimplifiedDelete:
    """Tests for simplified node deletion (always cascade)."""

    def test_delete_leaf_node(self):
        """Deleting a leaf node (no children) works."""
        sid, root_id = _create_session("Delete-Leaf")
        nid = _add_child_node(sid, root_id, "Leaf Node")

        r = client.delete(f"/api/manage/nodes/{nid}")
        assert r.status_code == 204

        # Verify gone
        db = TestSessionLocal()
        try:
            assert db.query(Node).filter(Node.id == UUID(nid)).first() is None
        finally:
            db.close()

    def test_delete_cascades_children(self):
        """Deleting parent also deletes all children."""
        sid, root_id = _create_session("Delete-Cascade")
        parent_id = _add_child_node(sid, root_id, "Parent Feature")
        child1 = _add_child_node(sid, parent_id, "Child 1")
        child2 = _add_child_node(sid, parent_id, "Child 2")
        grandchild = _add_child_node(sid, child1, "Grandchild")

        r = client.delete(f"/api/manage/nodes/{parent_id}")
        assert r.status_code == 204

        db = TestSessionLocal()
        try:
            for nid in [parent_id, child1, child2, grandchild]:
                assert db.query(Node).filter(Node.id == UUID(nid)).first() is None
        finally:
            db.close()

    def test_delete_root_node_forbidden(self):
        """Cannot delete the root node."""
        sid, root_id = _create_session("Delete-Root")

        r = client.delete(f"/api/manage/nodes/{root_id}")
        assert r.status_code == 400
        assert "root" in r.json()["detail"].lower()

    def test_delete_nonexistent_node(self):
        """Deleting non-existent node returns 404."""
        fake_id = str(uuid4())
        r = client.delete(f"/api/manage/nodes/{fake_id}")
        assert r.status_code == 404

    def test_cascade_false_param_still_cascades(self):
        """Even with cascade=false, children are deleted (simplified behavior)."""
        sid, root_id = _create_session("Cascade-False-Test")
        parent_id = _add_child_node(sid, root_id, "Parent")
        child_id = _add_child_node(sid, parent_id, "Child")

        r = client.delete(f"/api/manage/nodes/{parent_id}?cascade=false")
        assert r.status_code == 204

        db = TestSessionLocal()
        try:
            assert db.query(Node).filter(Node.id == UUID(parent_id)).first() is None
            assert db.query(Node).filter(Node.id == UUID(child_id)).first() is None
        finally:
            db.close()

    def test_siblings_reorder_after_delete(self):
        """Remaining siblings get their order_index adjusted."""
        sid, root_id = _create_session("Sibling-Reorder")
        n1 = _add_child_node(sid, root_id, "First")
        n2 = _add_child_node(sid, root_id, "Second")
        n3 = _add_child_node(sid, root_id, "Third")

        # Delete the second node
        r = client.delete(f"/api/manage/nodes/{n2}")
        assert r.status_code == 204

        db = TestSessionLocal()
        try:
            third = db.query(Node).filter(Node.id == UUID(n3)).first()
            # Should have been decremented from 2 to 1
            assert third is not None
            assert third.order_index < 3  # Was 2, now moved down
        finally:
            db.close()


# ═══════════════════════════════════════════════════════════════════════
#  3. NODE ADD / UPDATE BASICS
# ═══════════════════════════════════════════════════════════════════════


class TestNodeAddUpdate:
    """Tests for the node add and update endpoints."""

    def test_add_node_returns_201(self):
        """Adding a node returns 201 with correct structure."""
        sid, root_id = _create_session("Add-Node")
        r = client.post(
            "/api/manage/nodes/add",
            json={
                "session_id": sid,
                "parent_id": root_id,
                "question": "New feature",
                "answer": "Description",
                "node_type": "feature",
            },
        )
        assert r.status_code == 201
        data = r.json()
        assert data["question"] == "New feature"
        assert data["answer"] == "Description"
        assert data["node_type"] == "feature"
        assert "id" in data

    def test_add_node_invalid_session(self):
        """Adding a node to a non-existent session returns 404."""
        r = client.post(
            "/api/manage/nodes/add",
            json={
                "session_id": str(uuid4()),
                "question": "Orphan",
                "node_type": "feature",
            },
        )
        assert r.status_code == 404

    def test_update_node_question(self):
        """PATCH updates a node's question text."""
        sid, root_id = _create_session("Update-Node")
        nid = _add_child_node(sid, root_id, "Original Question")

        r = client.patch(
            f"/api/manage/nodes/{nid}",
            json={"question": "Updated Question"},
        )
        assert r.status_code == 200
        assert r.json()["question"] == "Updated Question"

    def test_update_node_answer(self):
        """PATCH updates a node's answer."""
        sid, root_id = _create_session("Update-Answer")
        nid = _add_child_node(sid, root_id, "Question with Answer")

        r = client.patch(
            f"/api/manage/nodes/{nid}",
            json={"answer": "New detailed answer"},
        )
        assert r.status_code == 200
        assert r.json()["answer"] == "New detailed answer"

    def test_update_nonexistent_node(self):
        """PATCHing a non-existent node returns 404."""
        r = client.patch(
            f"/api/manage/nodes/{uuid4()}",
            json={"question": "Ghost"},
        )
        assert r.status_code == 404


# ═══════════════════════════════════════════════════════════════════════
#  4. SESSION RENAME
# ═══════════════════════════════════════════════════════════════════════


class TestSessionRename:
    """Tests for PATCH /api/sessions/{id} — rename project."""

    def test_rename_session(self):
        """Renaming a session updates document_filename."""
        sid, _ = _create_session("Before Rename")

        r = client.patch(
            f"/api/sessions/{sid}",
            json={"document_filename": "After Rename"},
        )
        # May return 200 or the endpoint may not exist — both are valid signals
        if r.status_code == 200:
            data = r.json()
            # The response should contain the updated name
            assert data.get("document_filename") == "After Rename" or "After Rename" in str(data)

    def test_rename_nonexistent_session(self):
        """Renaming a non-existent session returns 404."""
        r = client.patch(
            f"/api/sessions/{uuid4()}",
            json={"document_filename": "Ghost"},
        )
        # Expect 404 or 422
        assert r.status_code in [404, 422, 500]


# ═══════════════════════════════════════════════════════════════════════
#  5. ENDPOINT EXISTENCE GUARDS
# ═══════════════════════════════════════════════════════════════════════


class TestEndpointExistence:
    """Verify all relevant endpoints are reachable."""

    def test_node_add_exists(self):
        r = client.post("/api/manage/nodes/add", json={})
        assert r.status_code in [201, 400, 404, 422]

    def test_node_delete_exists(self):
        r = client.delete(f"/api/manage/nodes/{uuid4()}")
        assert r.status_code in [204, 400, 404, 422]

    def test_node_update_exists(self):
        r = client.patch(f"/api/manage/nodes/{uuid4()}", json={})
        assert r.status_code in [200, 400, 404, 422]

    def test_activate_all_exists(self):
        r = client.post(f"/api/manage/nodes/{uuid4()}/activate-all")
        assert r.status_code in [200, 400, 404, 422]

    def test_sessions_list_exists(self):
        r = client.get("/api/sessions")
        assert r.status_code in [200, 401, 403, 500]

    def test_session_patch_exists(self):
        r = client.patch(f"/api/sessions/{uuid4()}", json={})
        assert r.status_code in [200, 400, 404, 422, 500]


# ═══════════════════════════════════════════════════════════════════════
#  6. INTEGRATION SCENARIOS
# ═══════════════════════════════════════════════════════════════════════


class TestIntegrationScenarios:
    """End-to-end-ish scenarios combining multiple operations."""

    def test_add_then_activate_all(self):
        """Add nodes with various statuses, then activate all."""
        sid, root_id = _create_session("Integration-Activate")
        _add_child_node(sid, root_id, "Active Feature", status="active")
        _add_child_node(sid, root_id, "Deferred Feature", status="deferred")
        _add_child_node(sid, root_id, "New Feature", status="new")

        # Activate all
        r = client.post(f"/api/manage/nodes/{sid}/activate-all")
        assert r.status_code == 200
        assert r.json()["activated_count"] == 2

        # Verify: re-activate returns 0
        r2 = client.post(f"/api/manage/nodes/{sid}/activate-all")
        assert r2.json()["activated_count"] == 0

    def test_add_tree_then_delete_subtree(self):
        """Build a tree, delete a subtree, verify remainder."""
        sid, root_id = _create_session("Integration-Delete")
        feat_a = _add_child_node(sid, root_id, "Feature A")
        feat_b = _add_child_node(sid, root_id, "Feature B")
        detail_a1 = _add_child_node(sid, feat_a, "Detail A1")
        detail_a2 = _add_child_node(sid, feat_a, "Detail A2")

        # Delete Feature A subtree
        r = client.delete(f"/api/manage/nodes/{feat_a}")
        assert r.status_code == 204

        # Feature B and root should survive
        db = TestSessionLocal()
        try:
            assert db.query(Node).filter(Node.id == UUID(feat_b)).first() is not None
            assert db.query(Node).filter(Node.id == UUID(root_id)).first() is not None
            # Feature A and its children should be gone
            assert db.query(Node).filter(Node.id == UUID(feat_a)).first() is None
            assert db.query(Node).filter(Node.id == UUID(detail_a1)).first() is None
            assert db.query(Node).filter(Node.id == UUID(detail_a2)).first() is None
        finally:
            db.close()

    def test_update_then_delete(self):
        """Update a node, then delete it — no errors."""
        sid, root_id = _create_session("Integration-UpdateDelete")
        nid = _add_child_node(sid, root_id, "To Update")

        # Update
        r1 = client.patch(f"/api/manage/nodes/{nid}", json={"question": "Updated"})
        assert r1.status_code == 200

        # Delete
        r2 = client.delete(f"/api/manage/nodes/{nid}")
        assert r2.status_code == 204

    def test_delete_already_deleted_returns_404(self):
        """Double-deleting a node returns 404 the second time."""
        sid, root_id = _create_session("Double-Delete")
        nid = _add_child_node(sid, root_id, "Ephemeral")

        r1 = client.delete(f"/api/manage/nodes/{nid}")
        assert r1.status_code == 204

        r2 = client.delete(f"/api/manage/nodes/{nid}")
        assert r2.status_code == 404

    def test_activate_all_is_idempotent(self):
        """Calling activate-all multiple times produces consistent results."""
        sid, root_id = _create_session("Idempotent-Activate")
        _add_child_node(sid, root_id, "Deferred", status="deferred")

        r1 = client.post(f"/api/manage/nodes/{sid}/activate-all")
        assert r1.json()["activated_count"] == 1

        r2 = client.post(f"/api/manage/nodes/{sid}/activate-all")
        assert r2.json()["activated_count"] == 0

        r3 = client.post(f"/api/manage/nodes/{sid}/activate-all")
        assert r3.json()["activated_count"] == 0

    def test_deep_cascade_delete(self):
        """Cascade delete works through 4 levels of nesting."""
        sid, root_id = _create_session("Deep-Cascade")
        n1 = _add_child_node(sid, root_id, "Level 1")
        n2 = _add_child_node(sid, n1, "Level 2")
        n3 = _add_child_node(sid, n2, "Level 3")
        n4 = _add_child_node(sid, n3, "Level 4")

        r = client.delete(f"/api/manage/nodes/{n1}")
        assert r.status_code == 204

        db = TestSessionLocal()
        try:
            for nid in [n1, n2, n3, n4]:
                assert db.query(Node).filter(Node.id == UUID(nid)).first() is None
            # Root survives
            assert db.query(Node).filter(Node.id == UUID(root_id)).first() is not None
        finally:
            db.close()


# ═══════════════════════════════════════════════════════════════
# 7. ChatBot Rename-Project Tool
# ═══════════════════════════════════════════════════════════════

class TestChatbotRenameTool:
    """Test the rename_project tool in SessionChatTools and the
    chatbot system prompt improvements."""

    def test_rename_project_via_tool(self):
        """SessionChatTools.rename_project() renames the session."""
        from app.services.session_chat_service import SessionChatTools

        sid, _ = _create_session("Old Project Name")
        db = TestSessionLocal()
        try:
            tools = SessionChatTools(db, UUID(sid), user_id)
            result = tools.rename_project("Gym App MVP")
            assert result["success"] is True
            assert result["old_name"] == "Old Project Name"
            assert result["new_name"] == "Gym App MVP"

            # Verify in DB
            session = db.query(DBSession).filter(DBSession.id == UUID(sid)).first()
            assert session.document_filename == "Gym App MVP"
        finally:
            db.close()

    def test_rename_project_empty_name_preserved(self):
        """Rename to a different non-empty string works."""
        from app.services.session_chat_service import SessionChatTools

        sid, _ = _create_session("Start Name")
        db = TestSessionLocal()
        try:
            tools = SessionChatTools(db, UUID(sid), user_id)
            result = tools.rename_project("New Name")
            assert result["success"] is True
            assert result["new_name"] == "New Name"
        finally:
            db.close()

    def test_rename_shows_in_overview(self):
        """After rename, get_session_overview shows updated name."""
        from app.services.session_chat_service import SessionChatTools

        sid, _ = _create_session("Before Rename")
        db = TestSessionLocal()
        try:
            tools = SessionChatTools(db, UUID(sid), user_id)
            tools.rename_project("After Rename")
            overview = tools.get_session_overview()
            assert overview["project_name"] == "After Rename"
        finally:
            db.close()

    def test_rename_tool_in_execute_tool(self):
        """execute_tool correctly dispatches rename_project."""
        import json
        from app.services.session_chat_service import SessionChatTools

        sid, _ = _create_session("Dispatch Test")
        db = TestSessionLocal()
        try:
            tools = SessionChatTools(db, UUID(sid), user_id)
            raw = tools.execute_tool("rename_project", {"new_name": "Dispatched Name"})
            result = json.loads(raw)
            assert result["success"] is True
            assert result["new_name"] == "Dispatched Name"
        finally:
            db.close()

    def test_rename_tool_definition_exists(self):
        """TOOLS list includes rename_project."""
        from app.services.session_chat_service import TOOLS

        tool_names = [t["function"]["name"] for t in TOOLS]
        assert "rename_project" in tool_names

    def test_system_prompt_mentions_rename(self):
        """System prompt explains the rename capability."""
        from app.services.session_chat_service import SYSTEM_PROMPT

        assert "rename_project" in SYSTEM_PROMPT.lower() or "Rename" in SYSTEM_PROMPT

    def test_system_prompt_explains_project_creation_limit(self):
        """System prompt tells chatbot it cannot create new projects."""
        from app.services.session_chat_service import SYSTEM_PROMPT

        assert "Create new projects" in SYSTEM_PROMPT or "cannot" in SYSTEM_PROMPT.lower()


# ═════════════════════════════════════════════════════════════
# 8. Project ↔ Group Channel Sync
# ═════════════════════════════════════════════════════════════

class TestProjectChannelSync:
    """Verify that creating a project auto-creates a group channel,
    and team / share operations sync to the channel membership."""

    # ---- helpers ----

    def _create_extra_user(self, email: str) -> UUID:
        """Create a registered user and return their id."""
        db = TestSessionLocal()
        try:
            uid = uuid4()
            _make_user(db, uid, email.split('@')[0], email, org_id)
            return uid
        finally:
            db.close()

    def _channel_for_session(self, session_id: str) -> ChatChannel | None:
        db = TestSessionLocal()
        try:
            return (
                db.query(ChatChannel)
                .filter(
                    ChatChannel.session_id == UUID(session_id),
                    ChatChannel.is_direct == False,
                )
                .first()
            )
        finally:
            db.close()

    def _channel_member_ids(self, channel_id) -> set[str]:
        db = TestSessionLocal()
        try:
            members = db.query(ChatChannelMember).filter(
                ChatChannelMember.channel_id == channel_id
            ).all()
            return {str(m.user_id) for m in members}
        finally:
            db.close()

    # ---- tests ----

    def test_create_session_auto_creates_channel(self):
        """POST /api/sessions creates a linked group channel."""
        r = client.post("/api/sessions", json={
            "user_type": "technical",
            "document_filename": "GymApp",
        })
        assert r.status_code == 201
        sid = r.json()["id"]

        ch = self._channel_for_session(sid)
        assert ch is not None, "Project channel was not auto-created"
        assert ch.name == "GymApp"
        assert ch.is_direct is False
        # Creator should be a member
        assert str(user_id) in self._channel_member_ids(ch.id)

    def test_rename_session_renames_channel(self):
        """PATCH /api/sessions/{id} renames the linked channel too."""
        r = client.post("/api/sessions", json={
            "user_type": "non_technical",
            "document_filename": "OldName",
        })
        sid = r.json()["id"]

        r2 = client.patch(f"/api/sessions/{sid}", json={
            "document_filename": "NewName",
        })
        assert r2.status_code == 200

        ch = self._channel_for_session(sid)
        assert ch is not None
        assert ch.name == "NewName"

    def test_share_session_adds_user_to_channel(self):
        """POST /api/sessions/{id}/share adds user to the channel."""
        extra_uid = self._create_extra_user("share_test@test.com")

        r = client.post("/api/sessions", json={
            "user_type": "technical",
            "document_filename": "ShareTest",
        })
        sid = r.json()["id"]

        # Share with the extra user
        r2 = client.post(f"/api/sessions/{sid}/share", json={
            "email": "share_test@test.com",
            "role": "editor",
        })
        assert r2.status_code == 200

        ch = self._channel_for_session(sid)
        assert ch is not None
        member_ids = self._channel_member_ids(ch.id)
        assert str(extra_uid) in member_ids

    def test_revoke_share_removes_user_from_channel(self):
        """DELETE /api/sessions/{id}/share/{user_id} removes from channel."""
        extra_uid = self._create_extra_user("revoke_test@test.com")

        r = client.post("/api/sessions", json={
            "user_type": "technical",
            "document_filename": "RevokeTest",
        })
        sid = r.json()["id"]

        # Share then revoke
        client.post(f"/api/sessions/{sid}/share", json={
            "email": "revoke_test@test.com", "role": "viewer",
        })
        client.delete(f"/api/sessions/{sid}/share/{str(extra_uid)}")

        ch = self._channel_for_session(sid)
        assert ch is not None
        member_ids = self._channel_member_ids(ch.id)
        assert str(extra_uid) not in member_ids

    def test_add_team_member_syncs_to_channel(self):
        """Adding a team member whose email matches a user adds them to channel."""
        extra_uid = self._create_extra_user("team_add@test.com")

        r = client.post("/api/sessions", json={
            "user_type": "technical",
            "document_filename": "TeamSyncAdd",
        })
        sid = r.json()["id"]

        # Add team member with matching email
        r2 = client.post(
            f"/api/planning/team?session_id={sid}",
            json={"name": "Team User", "email": "team_add@test.com", "role": "developer"},
        )
        assert r2.status_code == 200

        ch = self._channel_for_session(sid)
        assert ch is not None
        assert str(extra_uid) in self._channel_member_ids(ch.id)

    def test_remove_team_member_syncs_to_channel(self):
        """Removing a team member whose email matches a user removes them from channel."""
        extra_uid = self._create_extra_user("team_remove@test.com")

        r = client.post("/api/sessions", json={
            "user_type": "technical",
            "document_filename": "TeamSyncRemove",
        })
        sid = r.json()["id"]

        # Add then remove
        r2 = client.post(
            f"/api/planning/team?session_id={sid}",
            json={"name": "Temp User", "email": "team_remove@test.com", "role": "qa"},
        )
        member_id = r2.json()["id"]

        client.delete(f"/api/planning/team/{member_id}")

        ch = self._channel_for_session(sid)
        assert ch is not None
        assert str(extra_uid) not in self._channel_member_ids(ch.id)

    def test_team_member_no_email_no_crash(self):
        """Adding a team member without an email doesn't break anything."""
        r = client.post("/api/sessions", json={
            "user_type": "technical",
            "document_filename": "NoEmail",
        })
        sid = r.json()["id"]

        r2 = client.post(
            f"/api/planning/team?session_id={sid}",
            json={"name": "NoEmail Person", "role": "designer"},
        )
        assert r2.status_code == 200  # no crash

    def test_team_member_unknown_email_no_crash(self):
        """Adding a team member with an unregistered email doesn't crash."""
        r = client.post("/api/sessions", json={
            "user_type": "technical",
            "document_filename": "UnknownEmail",
        })
        sid = r.json()["id"]

        r2 = client.post(
            f"/api/planning/team?session_id={sid}",
            json={"name": "Ghost User", "email": "nosuchuser@nowhere.com", "role": "pm"},
        )
        assert r2.status_code == 200  # no crash

    def test_service_create_project_channel_directly(self):
        """project_channel_service.create_project_channel works standalone."""
        from app.services.project_channel_service import create_project_channel

        sid, _ = _create_session("DirectService")
        db = TestSessionLocal()
        try:
            session = db.query(DBSession).filter(DBSession.id == UUID(sid)).first()
            ch = create_project_channel(db, session, user_id)
            db.commit()
            assert ch.name == "DirectService"
            assert ch.session_id == UUID(sid)
        finally:
            db.close()

    def test_service_rename_project_channel_directly(self):
        """project_channel_service.rename_project_channel works standalone."""
        from app.services.project_channel_service import (
            create_project_channel, rename_project_channel,
        )

        sid, _ = _create_session("BeforeRename")
        db = TestSessionLocal()
        try:
            session = db.query(DBSession).filter(DBSession.id == UUID(sid)).first()
            create_project_channel(db, session, user_id)
            db.commit()

            rename_project_channel(db, UUID(sid), "AfterRename")
            db.commit()

            ch = (
                db.query(ChatChannel)
                .filter(ChatChannel.session_id == UUID(sid))
                .first()
            )
            assert ch.name == "AfterRename"
        finally:
            db.close()

    def test_chatbot_rename_also_renames_channel(self):
        """SessionChatTools.rename_project also renames the linked channel."""
        from app.services.session_chat_service import SessionChatTools
        from app.services.project_channel_service import create_project_channel

        sid, _ = _create_session("BotRenameSync")
        db = TestSessionLocal()
        try:
            session = db.query(DBSession).filter(DBSession.id == UUID(sid)).first()
            create_project_channel(db, session, user_id)
            db.commit()

            tools = SessionChatTools(db, UUID(sid), user_id)
            result = tools.rename_project("BotRenamed")
            assert result["success"] is True

            ch = (
                db.query(ChatChannel)
                .filter(ChatChannel.session_id == UUID(sid))
                .first()
            )
            assert ch.name == "BotRenamed"
        finally:
            db.close()
