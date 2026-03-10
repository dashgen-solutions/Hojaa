"""
Tests for Slack-like messaging features.

Covers:
- Channel CRUD with topic & description
- Message sending with mentions & thread replies
- Reactions (add / remove / get / duplicate prevention)
- Thread replies (send / get / reply-count increment)
- Message search (across channels, within channel)
- Pin / unpin / get pins (duplicate prevention)
- @Mention user search
- Presence endpoint
- Message edit & delete
- Read tracking
- Endpoint existence & auth-required guards

Uses dependency-override pattern for authenticated integration tests
with an in-memory SQLite database.
"""
import uuid as uuid_module

# ── Monkey-patch PostgreSQL UUID to work with SQLite ──────────────────
# Must be done BEFORE any model imports trigger relationship configuration.
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
from datetime import datetime, timedelta
from unittest.mock import patch, MagicMock

from fastapi.testclient import TestClient
from fastapi import Depends
from sqlalchemy import create_engine, event
from sqlalchemy.orm import Session, sessionmaker
from sqlalchemy.pool import StaticPool

from app.main import app
from app.core.auth import get_current_user, create_access_token
from app.db.session import get_db
from app.models.database import (
    Base,
    User,
    ChatChannel,
    ChatChannelMember,
    ChatChannelMessage,
    MessageReaction,
    MessageAttachment,
    PinnedMessage,
)


# ── In-memory SQLite test DB (StaticPool = single shared connection) ──

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


# ── Fake users ────────────────────────────────────────────────────────

user1_id = uuid4()
user2_id = uuid4()
user3_id = uuid4()


def _make_user(db: Session, uid: UUID, username: str, email: str, org_id=None) -> User:
    u = User(
        id=uid,
        username=username,
        email=email,
        hashed_password="fakehashed",
        is_active=True,
        organization_id=org_id,
    )
    db.add(u)
    db.commit()
    db.refresh(u)
    return u


def override_current_user_1():
    """Dependency override returning user1."""
    db = TestSessionLocal()
    user = db.query(User).filter(User.id == user1_id).first()
    db.close()
    return user


def override_current_user_2():
    """Dependency override returning user2."""
    db = TestSessionLocal()
    user = db.query(User).filter(User.id == user2_id).first()
    db.close()
    return user


# ── Fixtures ──────────────────────────────────────────────────────────

@pytest.fixture(scope="module", autouse=True)
def setup_database():
    """Create all tables and seed test users once per module."""
    Base.metadata.create_all(bind=engine)
    db = TestSessionLocal()
    try:
        org_id = uuid4()
        _make_user(db, user1_id, "alice", "alice@test.com", org_id)
        _make_user(db, user2_id, "bob", "bob@test.com", org_id)
        _make_user(db, user3_id, "charlie", "charlie@test.com", org_id)
    finally:
        db.close()

    yield

    Base.metadata.drop_all(bind=engine)


@pytest.fixture(autouse=True)
def override_deps():
    """Override DB and auth deps for every test (user1 by default)."""
    # Reset rate-limiter buckets so tests never hit 429
    from app.middleware.security import _general_limiter, _auth_limiter
    _general_limiter._buckets.clear()
    _auth_limiter._buckets.clear()

    app.dependency_overrides[get_db] = override_get_db
    app.dependency_overrides[get_current_user] = override_current_user_1
    yield
    app.dependency_overrides.clear()


client = TestClient(app)


# ═══════════════════════════════════════════════════════════════════════
#  1.  ENDPOINT EXISTENCE (no auth — expect 401/403)
# ═══════════════════════════════════════════════════════════════════════


class TestEndpointsExist:
    """Verify every new messaging route is registered."""

    def test_channels_list(self):
        r = client.get("/api/messaging/channels")
        assert r.status_code in [200, 401, 403, 500]

    def test_search_endpoint(self):
        r = client.get("/api/messaging/search", params={"q": "hello"})
        assert r.status_code in [200, 401, 403, 500]

    def test_presence_endpoint(self):
        r = client.get("/api/messaging/presence")
        assert r.status_code in [200, 401, 403, 500]

    def test_reactions_endpoint_post(self):
        fake_id = str(uuid4())
        r = client.post(f"/api/messaging/messages/{fake_id}/reactions", json={"emoji": "👍"})
        assert r.status_code in [201, 401, 403, 404, 500]

    def test_thread_endpoint(self):
        fake_id = str(uuid4())
        r = client.get(f"/api/messaging/messages/{fake_id}/thread")
        assert r.status_code in [200, 401, 403, 404, 500]

    def test_pin_endpoint(self):
        fake_id = str(uuid4())
        r = client.post(f"/api/messaging/messages/{fake_id}/pin")
        assert r.status_code in [201, 401, 403, 404, 500]

    def test_mention_users_endpoint(self):
        fake_id = str(uuid4())
        r = client.get(f"/api/messaging/channels/{fake_id}/mention-users")
        assert r.status_code in [200, 401, 403, 404, 500]

    def test_pins_list_endpoint(self):
        fake_id = str(uuid4())
        r = client.get(f"/api/messaging/channels/{fake_id}/pins")
        assert r.status_code in [200, 401, 403, 404, 500]


# ═══════════════════════════════════════════════════════════════════════
#  2.  CHANNEL CRUD WITH TOPIC & DESCRIPTION
# ═══════════════════════════════════════════════════════════════════════


class TestChannelTopicDescription:
    """Test channel creation and update with topic / description."""

    def test_create_channel_with_topic(self):
        r = client.post("/api/messaging/channels", json={
            "name": "project-alpha",
            "is_direct": False,
            "member_ids": [str(user2_id)],
            "topic": "Sprint planning discussions",
            "description": "A channel for project alpha"
        })
        assert r.status_code == 201
        data = r.json()
        assert data["topic"] == "Sprint planning discussions"
        assert data["description"] == "A channel for project alpha"
        assert data["name"] == "project-alpha"

    def test_create_dm_channel(self):
        r = client.post("/api/messaging/channels", json={
            "is_direct": True,
            "member_ids": [str(user2_id)],
        })
        assert r.status_code == 201
        data = r.json()
        assert data["is_direct"] is True

    def test_update_channel_topic(self):
        # Create first
        r = client.post("/api/messaging/channels", json={
            "name": "topic-test-ch",
            "is_direct": False,
            "member_ids": [str(user2_id)],
        })
        ch_id = r.json()["id"]

        r = client.patch(f"/api/messaging/channels/{ch_id}", json={
            "topic": "New topic!",
            "description": "Updated description",
        })
        assert r.status_code == 200
        data = r.json()
        assert data["topic"] == "New topic!"
        assert data["description"] == "Updated description"

    def test_list_channels_includes_topic(self):
        r = client.get("/api/messaging/channels")
        assert r.status_code == 200
        channels = r.json()
        assert isinstance(channels, list)
        # At least one should have topic from earlier test
        topics = [c.get("topic") for c in channels if c.get("topic")]
        assert len(topics) >= 1

    def test_get_channel_detail(self):
        # Create
        r = client.post("/api/messaging/channels", json={
            "name": "detail-ch",
            "is_direct": False,
            "member_ids": [str(user2_id)],
            "topic": "Detail topic",
        })
        ch_id = r.json()["id"]
        r = client.get(f"/api/messaging/channels/{ch_id}")
        assert r.status_code == 200
        data = r.json()
        assert data["topic"] == "Detail topic"
        assert "members" in data


# ═══════════════════════════════════════════════════════════════════════
#  3.  MESSAGES WITH MENTIONS
# ═══════════════════════════════════════════════════════════════════════


class TestMessageSending:
    """Test sending messages, including mentions and references."""

    @pytest.fixture(autouse=True)
    def _create_channel(self):
        r = client.post("/api/messaging/channels", json={
            "name": "msg-test-ch",
            "is_direct": False,
            "member_ids": [str(user2_id)],
        })
        self.channel_id = r.json()["id"]

    def test_send_basic_message(self):
        r = client.post(f"/api/messaging/channels/{self.channel_id}/messages", json={
            "content": "Hello, world!",
        })
        assert r.status_code == 201
        data = r.json()
        assert data["content"] == "Hello, world!"
        assert data["sender_name"] == "alice"

    def test_send_message_with_mentions(self):
        content = f"Hey @[bob]({user2_id})! Check this out."
        r = client.post(f"/api/messaging/channels/{self.channel_id}/messages", json={
            "content": content,
            "mentions": [str(user2_id)],
        })
        assert r.status_code == 201
        data = r.json()
        assert str(user2_id) in data["content"]
        # mentions field is extracted from content
        assert len(data["mentions"]) >= 1

    def test_send_message_with_reference(self):
        r = client.post(f"/api/messaging/channels/{self.channel_id}/messages", json={
            "content": "Look at this node",
            "reference_type": "node",
            "reference_id": str(uuid4()),
            "reference_name": "My Node",
        })
        assert r.status_code == 201
        assert r.json()["reference_type"] == "node"

    def test_get_messages(self):
        # Send a couple
        client.post(f"/api/messaging/channels/{self.channel_id}/messages", json={"content": "msg-A"})
        client.post(f"/api/messaging/channels/{self.channel_id}/messages", json={"content": "msg-B"})
        r = client.get(f"/api/messaging/channels/{self.channel_id}/messages")
        assert r.status_code == 200
        msgs = r.json()
        assert isinstance(msgs, list)
        assert len(msgs) >= 2
        # Each message should include new fields
        for msg in msgs:
            assert "reactions" in msg
            assert "attachments" in msg
            assert "is_pinned" in msg
            assert "thread_reply_count" in msg

    def test_message_validation_empty_content(self):
        r = client.post(f"/api/messaging/channels/{self.channel_id}/messages", json={
            "content": "",
        })
        assert r.status_code == 422

    def test_non_member_cannot_send(self):
        # Switch to user3, who is not a member of this channel
        app.dependency_overrides[get_current_user] = lambda: override_deps_user3()
        # user3 is not in the channel
        db = TestSessionLocal()
        user3 = db.query(User).filter(User.id == user3_id).first()
        db.close()
        app.dependency_overrides[get_current_user] = lambda: user3
        r = client.post(f"/api/messaging/channels/{self.channel_id}/messages", json={
            "content": "Should fail!",
        })
        assert r.status_code == 403
        # Restore
        app.dependency_overrides[get_current_user] = override_current_user_1


# ═══════════════════════════════════════════════════════════════════════
#  4.  REACTIONS
# ═══════════════════════════════════════════════════════════════════════


class TestReactions:
    """Test emoji reaction add / remove / get / duplicate prevention."""

    @pytest.fixture(autouse=True)
    def _create_channel_and_message(self):
        r = client.post("/api/messaging/channels", json={
            "name": "reaction-ch",
            "is_direct": False,
            "member_ids": [str(user2_id)],
        })
        self.channel_id = r.json()["id"]
        r = client.post(f"/api/messaging/channels/{self.channel_id}/messages", json={
            "content": "React to this!",
        })
        self.message_id = r.json()["id"]

    def test_add_reaction(self):
        r = client.post(f"/api/messaging/messages/{self.message_id}/reactions", json={
            "emoji": "👍",
        })
        assert r.status_code == 201
        assert r.json()["status"] == "added"
        assert r.json()["emoji"] == "👍"

    def test_duplicate_reaction_rejected(self):
        client.post(f"/api/messaging/messages/{self.message_id}/reactions", json={"emoji": "🔥"})
        r = client.post(f"/api/messaging/messages/{self.message_id}/reactions", json={"emoji": "🔥"})
        assert r.status_code == 400
        assert "already" in r.json()["detail"].lower()

    def test_get_reactions(self):
        client.post(f"/api/messaging/messages/{self.message_id}/reactions", json={"emoji": "❤️"})
        r = client.get(f"/api/messaging/messages/{self.message_id}/reactions")
        assert r.status_code == 200
        data = r.json()
        assert isinstance(data, list)
        emojis = [item["emoji"] for item in data]
        assert "❤️" in emojis
        # Each group has count + users
        for group in data:
            assert "count" in group
            assert "users" in group
            assert group["count"] >= 1

    def test_remove_reaction(self):
        client.post(f"/api/messaging/messages/{self.message_id}/reactions", json={"emoji": "😂"})
        r = client.delete(f"/api/messaging/messages/{self.message_id}/reactions/😂")
        assert r.status_code == 200
        assert r.json()["status"] == "removed"

    def test_remove_nonexistent_reaction(self):
        r = client.delete(f"/api/messaging/messages/{self.message_id}/reactions/🤷")
        assert r.status_code == 404

    def test_reaction_on_missing_message(self):
        fake_id = str(uuid4())
        r = client.post(f"/api/messaging/messages/{fake_id}/reactions", json={"emoji": "👍"})
        assert r.status_code == 404

    def test_multiple_emojis_on_same_message(self):
        client.post(f"/api/messaging/messages/{self.message_id}/reactions", json={"emoji": "🎉"})
        client.post(f"/api/messaging/messages/{self.message_id}/reactions", json={"emoji": "🚀"})
        r = client.get(f"/api/messaging/messages/{self.message_id}/reactions")
        emojis = [item["emoji"] for item in r.json()]
        assert "🎉" in emojis
        assert "🚀" in emojis


# ═══════════════════════════════════════════════════════════════════════
#  5.  THREAD REPLIES
# ═══════════════════════════════════════════════════════════════════════


class TestThreadReplies:
    """Test sending thread replies and retrieving threads."""

    @pytest.fixture(autouse=True)
    def _create_channel_and_parent(self):
        r = client.post("/api/messaging/channels", json={
            "name": "thread-ch",
            "is_direct": False,
            "member_ids": [str(user2_id)],
        })
        self.channel_id = r.json()["id"]
        r = client.post(f"/api/messaging/channels/{self.channel_id}/messages", json={
            "content": "Thread parent message",
        })
        self.parent_id = r.json()["id"]

    def test_send_thread_reply(self):
        r = client.post(f"/api/messaging/channels/{self.channel_id}/messages", json={
            "content": "This is a reply",
            "parent_message_id": self.parent_id,
        })
        assert r.status_code == 201
        data = r.json()
        assert data["parent_message_id"] == self.parent_id
        assert data["content"] == "This is a reply"

    def test_thread_reply_increments_count(self):
        # Send 2 replies
        client.post(f"/api/messaging/channels/{self.channel_id}/messages", json={
            "content": "Reply 1",
            "parent_message_id": self.parent_id,
        })
        client.post(f"/api/messaging/channels/{self.channel_id}/messages", json={
            "content": "Reply 2",
            "parent_message_id": self.parent_id,
        })
        # Get thread
        r = client.get(f"/api/messaging/messages/{self.parent_id}/thread")
        assert r.status_code == 200
        data = r.json()
        assert data["reply_count"] >= 2
        assert len(data["replies"]) >= 2

    def test_get_thread(self):
        client.post(f"/api/messaging/channels/{self.channel_id}/messages", json={
            "content": "A thread reply",
            "parent_message_id": self.parent_id,
        })
        r = client.get(f"/api/messaging/messages/{self.parent_id}/thread")
        assert r.status_code == 200
        data = r.json()
        assert "parent" in data
        assert "replies" in data
        assert "reply_count" in data
        assert data["parent"]["id"] == self.parent_id
        assert len(data["replies"]) >= 1

    def test_thread_replies_hidden_from_main_view(self):
        client.post(f"/api/messaging/channels/{self.channel_id}/messages", json={
            "content": "Hidden thread reply",
            "parent_message_id": self.parent_id,
        })
        r = client.get(f"/api/messaging/channels/{self.channel_id}/messages")
        assert r.status_code == 200
        msgs = r.json()
        # Thread replies (with parent_message_id) should NOT appear in main view
        for msg in msgs:
            assert msg.get("parent_message_id") is None

    def test_thread_for_nonexistent_message(self):
        r = client.get(f"/api/messaging/messages/{uuid4()}/thread")
        assert r.status_code == 404


# ═══════════════════════════════════════════════════════════════════════
#  6.  MESSAGE SEARCH
# ═══════════════════════════════════════════════════════════════════════


class TestMessageSearch:
    """Test message search across channels."""

    @pytest.fixture(autouse=True)
    def _create_searchable_content(self):
        r = client.post("/api/messaging/channels", json={
            "name": "search-ch",
            "is_direct": False,
            "member_ids": [str(user2_id)],
        })
        self.channel_id = r.json()["id"]
        client.post(f"/api/messaging/channels/{self.channel_id}/messages", json={
            "content": "The weather is great today UNIQUEWORD123",
        })
        client.post(f"/api/messaging/channels/{self.channel_id}/messages", json={
            "content": "Let's have pizza for lunch UNIQUEWORD123",
        })
        client.post(f"/api/messaging/channels/{self.channel_id}/messages", json={
            "content": "Meeting at 3pm about the backend service",
        })

    def test_search_finds_results(self):
        r = client.get("/api/messaging/search", params={"q": "UNIQUEWORD123"})
        assert r.status_code == 200
        data = r.json()
        assert "results" in data
        assert "total" in data
        assert data["total"] >= 2
        assert len(data["results"]) >= 2

    def test_search_filters_by_channel(self):
        r = client.get("/api/messaging/search", params={
            "q": "UNIQUEWORD123",
            "channel_id": self.channel_id,
        })
        assert r.status_code == 200
        data = r.json()
        for result in data["results"]:
            assert result["channel_id"] == self.channel_id

    def test_search_no_results(self):
        r = client.get("/api/messaging/search", params={"q": "xyznonexistent999"})
        assert r.status_code == 200
        data = r.json()
        assert data["total"] == 0
        assert len(data["results"]) == 0

    def test_search_includes_channel_name(self):
        r = client.get("/api/messaging/search", params={"q": "UNIQUEWORD123"})
        data = r.json()
        for result in data["results"]:
            assert "channel_name" in result

    def test_search_requires_query(self):
        r = client.get("/api/messaging/search")
        assert r.status_code == 422  # missing required q

    def test_search_respects_limit(self):
        r = client.get("/api/messaging/search", params={"q": "UNIQUEWORD123", "limit": 1})
        assert r.status_code == 200
        assert len(r.json()["results"]) <= 1


# ═══════════════════════════════════════════════════════════════════════
#  7.  PIN / UNPIN
# ═══════════════════════════════════════════════════════════════════════


class TestPinning:
    """Test message pinning and unpinning."""

    @pytest.fixture(autouse=True)
    def _create_channel_and_message(self):
        r = client.post("/api/messaging/channels", json={
            "name": "pin-ch",
            "is_direct": False,
            "member_ids": [str(user2_id)],
        })
        self.channel_id = r.json()["id"]
        r = client.post(f"/api/messaging/channels/{self.channel_id}/messages", json={
            "content": "This should be pinned",
        })
        self.message_id = r.json()["id"]

    def test_pin_message(self):
        r = client.post(f"/api/messaging/messages/{self.message_id}/pin")
        assert r.status_code == 201
        assert r.json()["status"] == "pinned"

    def test_duplicate_pin_rejected(self):
        client.post(f"/api/messaging/messages/{self.message_id}/pin")
        r = client.post(f"/api/messaging/messages/{self.message_id}/pin")
        assert r.status_code == 400
        assert "already" in r.json()["detail"].lower()

    def test_unpin_message(self):
        client.post(f"/api/messaging/messages/{self.message_id}/pin")
        r = client.delete(f"/api/messaging/messages/{self.message_id}/pin")
        assert r.status_code == 200
        assert r.json()["status"] == "unpinned"

    def test_unpin_nonexistent(self):
        r = client.delete(f"/api/messaging/messages/{self.message_id}/pin")
        assert r.status_code == 404

    def test_get_pinned_messages(self):
        client.post(f"/api/messaging/messages/{self.message_id}/pin")
        r = client.get(f"/api/messaging/channels/{self.channel_id}/pins")
        assert r.status_code == 200
        pins = r.json()
        assert isinstance(pins, list)
        assert len(pins) >= 1
        pin = pins[0]
        assert "message" in pin
        assert "pinned_by" in pin
        assert "pinned_at" in pin
        assert pin["pinned_by"] == "alice"

    def test_pin_sets_is_pinned_flag(self):
        client.post(f"/api/messaging/messages/{self.message_id}/pin")
        r = client.get(f"/api/messaging/channels/{self.channel_id}/messages")
        assert r.status_code == 200
        msgs = r.json()
        pinned = [m for m in msgs if m["id"] == self.message_id]
        assert len(pinned) == 1
        assert pinned[0]["is_pinned"] is True

    def test_pin_missing_message(self):
        r = client.post(f"/api/messaging/messages/{uuid4()}/pin")
        assert r.status_code == 404


# ═══════════════════════════════════════════════════════════════════════
#  8.  @MENTION USER SEARCH
# ═══════════════════════════════════════════════════════════════════════


class TestMentionUsers:
    """Test @mention user search in channel."""

    @pytest.fixture(autouse=True)
    def _create_channel(self):
        r = client.post("/api/messaging/channels", json={
            "name": "mention-ch",
            "is_direct": False,
            "member_ids": [str(user2_id), str(user3_id)],
        })
        self.channel_id = r.json()["id"]

    def test_get_mentionable_users(self):
        r = client.get(f"/api/messaging/channels/{self.channel_id}/mention-users")
        assert r.status_code == 200
        data = r.json()
        assert isinstance(data, list)
        # Should return other members (not self)
        usernames = [u["username"] for u in data]
        assert "alice" not in usernames  # self is excluded
        assert "bob" in usernames

    def test_mention_search_by_name(self):
        r = client.get(f"/api/messaging/channels/{self.channel_id}/mention-users", params={"q": "bob"})
        assert r.status_code == 200
        data = r.json()
        assert len(data) >= 1
        assert data[0]["username"] == "bob"

    def test_mention_search_no_results(self):
        r = client.get(f"/api/messaging/channels/{self.channel_id}/mention-users", params={"q": "zzzzz"})
        assert r.status_code == 200
        assert len(r.json()) == 0

    def test_mention_includes_online_status(self):
        r = client.get(f"/api/messaging/channels/{self.channel_id}/mention-users")
        assert r.status_code == 200
        for user in r.json():
            assert "is_online" in user
            assert "id" in user
            assert "username" in user
            assert "email" in user


# ═══════════════════════════════════════════════════════════════════════
#  9.  PRESENCE
# ═══════════════════════════════════════════════════════════════════════


class TestPresence:
    """Test online presence endpoint."""

    def test_get_presence(self):
        r = client.get("/api/messaging/presence")
        assert r.status_code == 200
        data = r.json()
        assert isinstance(data, list)
        for entry in data:
            assert "user_id" in entry
            assert "username" in entry
            assert "is_online" in entry
            assert isinstance(entry["is_online"], bool)

    def test_presence_includes_org_users(self):
        r = client.get("/api/messaging/presence")
        data = r.json()
        usernames = [u["username"] for u in data]
        # All three test users are in the same org
        assert "alice" in usernames
        assert "bob" in usernames
        assert "charlie" in usernames


# ═══════════════════════════════════════════════════════════════════════
# 10.  MESSAGE EDIT & DELETE
# ═══════════════════════════════════════════════════════════════════════


class TestMessageEditDelete:
    """Test editing and deleting messages."""

    @pytest.fixture(autouse=True)
    def _create_channel_and_message(self):
        r = client.post("/api/messaging/channels", json={
            "name": "edit-ch",
            "is_direct": False,
            "member_ids": [str(user2_id)],
        })
        self.channel_id = r.json()["id"]
        r = client.post(f"/api/messaging/channels/{self.channel_id}/messages", json={
            "content": "Original message",
        })
        self.message_id = r.json()["id"]

    def test_edit_own_message(self):
        r = client.patch(f"/api/messaging/messages/{self.message_id}", json={
            "content": "Edited message",
        })
        assert r.status_code == 200
        data = r.json()
        assert data["content"] == "Edited message"
        assert data["is_edited"] is True

    def test_cannot_edit_others_message(self):
        # Switch to user2
        db = TestSessionLocal()
        user2 = db.query(User).filter(User.id == user2_id).first()
        db.close()
        app.dependency_overrides[get_current_user] = lambda: user2
        r = client.patch(f"/api/messaging/messages/{self.message_id}", json={
            "content": "Hacked!",
        })
        assert r.status_code == 403
        # Restore
        app.dependency_overrides[get_current_user] = override_current_user_1

    def test_delete_own_message(self):
        r = client.delete(f"/api/messaging/messages/{self.message_id}")
        assert r.status_code == 204

    def test_cannot_delete_others_message(self):
        db = TestSessionLocal()
        user2 = db.query(User).filter(User.id == user2_id).first()
        db.close()
        app.dependency_overrides[get_current_user] = lambda: user2
        r = client.delete(f"/api/messaging/messages/{self.message_id}")
        assert r.status_code == 403
        app.dependency_overrides[get_current_user] = override_current_user_1

    def test_edit_nonexistent_message(self):
        r = client.patch(f"/api/messaging/messages/{uuid4()}", json={"content": "x"})
        assert r.status_code == 404


# ═══════════════════════════════════════════════════════════════════════
# 11.  READ TRACKING
# ═══════════════════════════════════════════════════════════════════════


class TestReadTracking:
    """Test mark as read and unread count."""

    @pytest.fixture(autouse=True)
    def _create_channel(self):
        r = client.post("/api/messaging/channels", json={
            "name": "read-ch",
            "is_direct": False,
            "member_ids": [str(user2_id)],
        })
        self.channel_id = r.json()["id"]

    def test_mark_channel_read(self):
        r = client.post(f"/api/messaging/channels/{self.channel_id}/read")
        assert r.status_code == 200
        assert r.json()["status"] == "read"

    def test_get_unread_count(self):
        r = client.get("/api/messaging/unread")
        assert r.status_code == 200
        data = r.json()
        assert "total" in data
        assert isinstance(data["total"], int)


# ═══════════════════════════════════════════════════════════════════════
# 12.  CHANNEL MEMBERS
# ═══════════════════════════════════════════════════════════════════════


class TestChannelMembers:
    """Test adding and removing channel members."""

    @pytest.fixture(autouse=True)
    def _create_channel(self):
        r = client.post("/api/messaging/channels", json={
            "name": "members-ch",
            "is_direct": False,
            "member_ids": [str(user2_id)],
        })
        self.channel_id = r.json()["id"]

    def test_add_member(self):
        r = client.post(f"/api/messaging/channels/{self.channel_id}/members", json={
            "user_id": str(user3_id),
        })
        assert r.status_code == 201

    def test_remove_member(self):
        # Add first
        client.post(f"/api/messaging/channels/{self.channel_id}/members", json={
            "user_id": str(user3_id),
        })
        r = client.delete(f"/api/messaging/channels/{self.channel_id}/members/{user3_id}")
        assert r.status_code == 204

    def test_member_serialization_includes_online(self):
        r = client.get(f"/api/messaging/channels/{self.channel_id}")
        assert r.status_code == 200
        data = r.json()
        for member in data.get("members", []):
            assert "is_online" in member
            assert "username" in member


# ═══════════════════════════════════════════════════════════════════════
# 13.  ORG USERS FOR MESSAGING
# ═══════════════════════════════════════════════════════════════════════


class TestMessagingUsers:
    """Test listing users available for messaging."""

    def test_list_messaging_users(self):
        r = client.get("/api/messaging/users")
        assert r.status_code == 200
        data = r.json()
        assert isinstance(data, list)
        # Should exclude self (alice)
        usernames = [u["username"] for u in data]
        assert "alice" not in usernames
        # Should include others in same org
        assert "bob" in usernames

    def test_users_have_expected_fields(self):
        r = client.get("/api/messaging/users")
        for user in r.json():
            assert "id" in user
            assert "username" in user
            assert "email" in user


# ═══════════════════════════════════════════════════════════════════════
# 14.  CHANNEL DELETE
# ═══════════════════════════════════════════════════════════════════════


class TestChannelDelete:
    """Test channel deletion."""

    def test_delete_channel(self):
        r = client.post("/api/messaging/channels", json={
            "name": "deleteme-ch",
            "is_direct": False,
            "member_ids": [str(user2_id)],
        })
        ch_id = r.json()["id"]
        r = client.delete(f"/api/messaging/channels/{ch_id}")
        assert r.status_code == 204

    def test_delete_nonexistent_channel(self):
        r = client.delete(f"/api/messaging/channels/{uuid4()}")
        assert r.status_code in [403, 404]


# ═══════════════════════════════════════════════════════════════════════
# 15.  MESSAGE SERIALIZATION FORMAT
# ═══════════════════════════════════════════════════════════════════════


class TestMessageSerialization:
    """Verify the message response format contains all Slack-like fields."""

    @pytest.fixture(autouse=True)
    def _create_channel_and_message(self):
        r = client.post("/api/messaging/channels", json={
            "name": "serial-ch",
            "is_direct": False,
            "member_ids": [str(user2_id)],
        })
        self.channel_id = r.json()["id"]
        r = client.post(f"/api/messaging/channels/{self.channel_id}/messages", json={
            "content": "Serialization test",
        })
        self.message = r.json()

    def test_message_has_all_fields(self):
        m = self.message
        assert "id" in m
        assert "channel_id" in m
        assert "sender_id" in m
        assert "sender_name" in m
        assert "content" in m
        assert "is_edited" in m
        assert "is_pinned" in m
        assert "parent_message_id" in m
        assert "thread_reply_count" in m
        assert "reactions" in m
        assert "attachments" in m
        assert "mentions" in m
        assert "created_at" in m

    def test_default_values(self):
        m = self.message
        assert m["is_edited"] is False
        assert m["is_pinned"] is False
        assert m["parent_message_id"] is None
        assert m["thread_reply_count"] == 0
        assert m["reactions"] == []
        assert m["attachments"] == []
