"""
SQLAlchemy database models for the application.
"""
from datetime import datetime, date
from typing import List, Optional
from uuid import uuid4
from sqlalchemy import (
    Column, String, Text, Integer, Boolean, DateTime, Date, Float,
    ForeignKey, JSON, Enum as SQLEnum, Index
)
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import relationship
from app.db.session import Base
from passlib.context import CryptContext
import enum

# Password hashing
pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")


# ===== Enumerations =====

class SessionStatus(str, enum.Enum):
    """Session status enumeration."""
    UPLOAD_PENDING = "upload_pending"
    QUESTIONS_PENDING = "questions_pending"
    TREE_GENERATED = "tree_generated"
    ACTIVE = "active"
    COMPLETED = "completed"


class NodeType(str, enum.Enum):
    """Node type enumeration."""
    ROOT = "root"
    FEATURE = "feature"
    DETAIL = "detail"


class NodeStatus(str, enum.Enum):
    """Status of a node in the scope lifecycle."""
    ACTIVE = "active"
    DEFERRED = "deferred"
    COMPLETED = "completed"
    REMOVED = "removed"
    NEW = "new"
    MODIFIED = "modified"


class ConversationStatus(str, enum.Enum):
    """Conversation status enumeration."""
    ACTIVE = "active"
    COMPLETED = "completed"
    CANCELLED = "cancelled"


class MessageRole(str, enum.Enum):
    """Message role enumeration."""
    USER = "user"
    ASSISTANT = "assistant"
    SYSTEM = "system"


class SourceType(str, enum.Enum):
    """Type of ingested source material."""
    DISCOVERY = "discovery"
    MEETING = "meeting"
    DOCUMENT = "document"
    MANUAL = "manual"
    EMAIL = "email"
    SLACK = "slack"


class SourceFormat(str, enum.Enum):
    """Format of the source content (affects pre-processing)."""
    RAW = "raw"
    OTTER = "otter"
    FIREFLIES = "fireflies"
    EMAIL = "email"
    SLACK = "slack"


class MeetingType(str, enum.Enum):
    """Type of meeting for better AI context."""
    SPRINT_PLANNING = "sprint_planning"
    STANDUP = "standup"
    RETROSPECTIVE = "retrospective"
    CLIENT_REVIEW = "client_review"
    KICKOFF = "kickoff"
    BRAINSTORM = "brainstorm"
    DESIGN_REVIEW = "design_review"
    TECHNICAL_DISCUSSION = "technical_discussion"
    STAKEHOLDER_UPDATE = "stakeholder_update"
    OTHER = "other"


class ChangeType(str, enum.Enum):
    """Type of change recorded in history."""
    CREATED = "created"
    MODIFIED = "modified"
    STATUS_CHANGED = "status_changed"
    MOVED = "moved"
    DELETED = "deleted"


class CardStatus(str, enum.Enum):
    """Status of a planning card on the board."""
    BACKLOG = "backlog"
    TODO = "todo"
    IN_PROGRESS = "in_progress"
    REVIEW = "review"
    DONE = "done"


class CardPriority(str, enum.Enum):
    """Priority level for planning cards and nodes."""
    LOW = "low"
    MEDIUM = "medium"
    HIGH = "high"
    CRITICAL = "critical"


class UserRole(str, enum.Enum):
    """Platform-level role for RBAC (SEC-2.1)."""
    OWNER = "owner"
    ADMIN = "admin"
    EDITOR = "editor"
    VIEWER = "viewer"


class OrgRole(str, enum.Enum):
    """Role within an organization."""
    OWNER = "owner"        # created the org, full control
    ADMIN = "admin"        # manage employees & sessions
    MEMBER = "member"      # regular employee


class AssignmentRole(str, enum.Enum):
    """Role of a person assigned to a node/card."""
    OWNER = "owner"
    ASSIGNEE = "assignee"
    REVIEWER = "reviewer"


# ===== Enterprise: Organization =====

class Organization(Base):
    """Enterprise organization — multi-tenant container."""
    __tablename__ = "organizations"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid4)
    name = Column(String(255), nullable=False)
    slug = Column(String(255), unique=True, index=True, nullable=False)  # url-safe identifier
    logo_url = Column(String(500), nullable=True)
    industry = Column(String(100), nullable=True)
    size = Column(String(50), nullable=True)       # 1-10, 11-50, 51-200, 201-500, 500+
    website = Column(String(500), nullable=True)
    created_by = Column(UUID(as_uuid=True), nullable=False)  # founding admin user id
    is_active = Column(Boolean, default=True, nullable=False)

    # Configurable policies
    scope_approval_policy = Column(
        String(20), default="role_based", nullable=False,
    )  # "anyone" | "role_based" | "admin_only"

    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow, nullable=False)

    # Relationships
    members = relationship("User", back_populates="organization", cascade="all, delete-orphan")
    sessions = relationship("Session", back_populates="organization")

    __table_args__ = (
        Index("idx_org_slug", "slug", unique=True),
    )


class User(Base):
    """User model for authentication."""
    __tablename__ = "users"
    
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid4)
    email = Column(String(255), unique=True, index=True, nullable=False)
    username = Column(String(100), unique=True, index=True, nullable=False)
    hashed_password = Column(String(255), nullable=False)
    is_active = Column(Boolean, default=True, nullable=False)
    role = Column(SQLEnum(UserRole), default=UserRole.ADMIN, nullable=False)  # SEC-2.1 global role

    # Enterprise multi-tenancy
    organization_id = Column(UUID(as_uuid=True), ForeignKey("organizations.id", ondelete="CASCADE"), nullable=True)
    org_role = Column(SQLEnum(OrgRole), default=OrgRole.MEMBER, nullable=False)
    job_title = Column(String(100), nullable=True)
    
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow, nullable=False)
    
    # Relationships
    organization = relationship("Organization", back_populates="members")
    sessions = relationship("Session", back_populates="user")
    shared_sessions = relationship("SessionMember", back_populates="user", cascade="all, delete-orphan", foreign_keys="[SessionMember.user_id]")
    
    def verify_password(self, password: str) -> bool:
        """Verify password against hash."""
        # Truncate password to 72 characters for bcrypt (simple character limit)
        if len(password) > 72:
            password = password[:72]
        return pwd_context.verify(password, self.hashed_password)
    
    @staticmethod
    def hash_password(password: str) -> str:
        """Hash a password. Truncates to 72 characters if needed for bcrypt."""
        # Truncate password to 72 characters if needed (bcrypt limit)
        if len(password) > 72:
            password = password[:72]
        return pwd_context.hash(password)


class Session(Base):
    """Session model representing a user's discovery session."""
    __tablename__ = "sessions"
    
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid4)
    user_id = Column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=True)
    organization_id = Column(UUID(as_uuid=True), ForeignKey("organizations.id", ondelete="CASCADE"), nullable=True)  # Enterprise: org scope
    user_type = Column(String(20), default="non_technical", nullable=False)  # "technical" or "non_technical"
    document_text = Column(Text, nullable=True)
    document_type = Column(String(50), nullable=True)
    document_filename = Column(String(255), nullable=True)  # Session name/title (default: "Untitled", user-editable)
    status = Column(
        SQLEnum(SessionStatus),
        default=SessionStatus.UPLOAD_PENDING,
        nullable=False
    )
    session_metadata = Column(JSON, default=dict)
    
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow, nullable=False)
    
    # Relationships
    organization = relationship("Organization", back_populates="sessions")
    user = relationship("User", back_populates="sessions")
    questions = relationship("Question", back_populates="session", cascade="all, delete-orphan")
    nodes = relationship("Node", back_populates="session", cascade="all, delete-orphan")
    conversations = relationship("Conversation", back_populates="session", cascade="all, delete-orphan")
    sources = relationship("Source", back_populates="session", cascade="all, delete-orphan")
    cards = relationship("Card", back_populates="session", cascade="all, delete-orphan")
    team_members = relationship("TeamMember", back_populates="session", cascade="all, delete-orphan")
    members = relationship("SessionMember", back_populates="session", cascade="all, delete-orphan")  # SEC-2.3


class Question(Base):
    """Initial discovery questions model."""
    __tablename__ = "questions"
    
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid4)
    session_id = Column(UUID(as_uuid=True), ForeignKey("sessions.id", ondelete="CASCADE"), nullable=False)
    
    question_text = Column(Text, nullable=False)
    answer_text = Column(Text, nullable=True)
    category = Column(String(50), nullable=True)  # purpose, features, users, etc.
    order_index = Column(Integer, nullable=False)
    is_answered = Column(Boolean, default=False, nullable=False)
    question_metadata = Column(JSON, default=dict)
    
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow, nullable=False)
    
    # Relationships
    session = relationship("Session", back_populates="questions")


class Node(Base):
    """Tree node model representing requirements hierarchy."""
    __tablename__ = "nodes"
    
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid4)
    session_id = Column(UUID(as_uuid=True), ForeignKey("sessions.id", ondelete="CASCADE"), nullable=False)
    parent_id = Column(UUID(as_uuid=True), ForeignKey("nodes.id", ondelete="CASCADE"), nullable=True)
    
    # Node content
    question = Column(Text, nullable=False)
    answer = Column(Text, nullable=True)
    node_type = Column(SQLEnum(NodeType), nullable=False)
    
    # Scope lifecycle fields (Phase 2)
    status = Column(SQLEnum(NodeStatus), default=NodeStatus.ACTIVE, nullable=False)
    priority = Column(SQLEnum(CardPriority), nullable=True)
    acceptance_criteria = Column(JSON, default=list)
    source_id = Column(UUID(as_uuid=True), ForeignKey("sources.id", ondelete="SET NULL"), nullable=True)
    added_from_source_at = Column(DateTime, nullable=True)  # REQ-7.2.1: when node was added from a source
    assigned_to = Column(UUID(as_uuid=True), ForeignKey("team_members.id", ondelete="SET NULL"), nullable=True)  # REQ-7.2.1: direct assignment shortcut
    
    # Tree metadata
    depth = Column(Integer, default=0, nullable=False)
    order_index = Column(Integer, default=0, nullable=False)
    can_expand = Column(Boolean, default=False, nullable=False)
    is_expanded = Column(Boolean, default=False, nullable=False)
    
    # Deferred / completed metadata
    deferred_reason = Column(Text, nullable=True)
    completed_at = Column(DateTime, nullable=True)
    
    # Additional data
    node_metadata = Column(JSON, default=dict)
    
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow, nullable=False)
    
    # Relationships
    session = relationship("Session", back_populates="nodes")
    children = relationship("Node", backref="parent", remote_side=[id], cascade="all")
    conversations = relationship("Conversation", back_populates="node")
    source = relationship("Source", back_populates="nodes")
    history_entries = relationship("NodeHistory", back_populates="node", cascade="all, delete-orphan")
    assignments = relationship("Assignment", back_populates="node", cascade="all, delete-orphan")
    card = relationship("Card", back_populates="node", uselist=False, cascade="all, delete-orphan")
    direct_assignee = relationship("TeamMember", foreign_keys=[assigned_to])
    
    # Indexes for efficient filtering (REQ-3.5.2)
    __table_args__ = (
        Index("idx_nodes_status", "status"),
        Index("idx_nodes_session_status", "session_id", "status"),
        Index("idx_nodes_updated_at", "updated_at"),
        Index("idx_nodes_created_at", "created_at"),
    )


class Conversation(Base):
    """Feature-specific conversation model."""
    __tablename__ = "conversations"
    
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid4)
    session_id = Column(UUID(as_uuid=True), ForeignKey("sessions.id", ondelete="CASCADE"), nullable=False)
    node_id = Column(UUID(as_uuid=True), ForeignKey("nodes.id", ondelete="CASCADE"), nullable=False)
    
    status = Column(
        SQLEnum(ConversationStatus),
        default=ConversationStatus.ACTIVE,
        nullable=False
    )
    extracted_info = Column(JSON, default=dict)
    conversation_metadata = Column(JSON, default=dict)
    
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow, nullable=False)
    
    # Relationships
    session = relationship("Session", back_populates="conversations")
    node = relationship("Node", back_populates="conversations")
    messages = relationship("Message", back_populates="conversation", cascade="all, delete-orphan")


class Message(Base):
    """Chat message model."""
    __tablename__ = "messages"
    
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid4)
    conversation_id = Column(UUID(as_uuid=True), ForeignKey("conversations.id", ondelete="CASCADE"), nullable=False)
    
    role = Column(SQLEnum(MessageRole), nullable=False)
    content = Column(Text, nullable=False)
    message_metadata = Column(JSON, default=dict)  # suggestions, extracted_info, etc.
    
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    
    # Relationships
    conversation = relationship("Conversation", back_populates="messages")


# ===== Phase 1: Source Tracking =====

class Source(Base):
    """Tracks where scope items originated from (meeting notes, documents, manual edits)."""
    __tablename__ = "sources"
    
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid4)
    session_id = Column(UUID(as_uuid=True), ForeignKey("sessions.id", ondelete="CASCADE"), nullable=False)
    
    source_type = Column(SQLEnum(SourceType), nullable=False)
    source_name = Column(String(255), nullable=False)
    raw_content = Column(Text, nullable=True)
    processed_summary = Column(Text, nullable=True)
    source_metadata = Column(JSON, default=dict)  # date, attendees, etc.
    
    is_processed = Column(Boolean, default=False, nullable=False)
    processed_at = Column(DateTime, nullable=True)
    created_by = Column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="SET NULL"), nullable=True)
    
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow, nullable=False)
    
    # Relationships
    session = relationship("Session", back_populates="sources")
    creator = relationship("User", foreign_keys=[created_by])
    nodes = relationship("Node", back_populates="source")
    suggestions = relationship("SourceSuggestion", back_populates="source", cascade="all, delete-orphan")
    history_entries = relationship("NodeHistory", back_populates="source")
    
    # Indexes (REQ-7.4.1)
    __table_args__ = (
        Index("idx_sources_session_id", "session_id"),
        Index("idx_sources_source_type", "source_type"),
    )


class SourceSuggestion(Base):
    """AI-generated suggestions from processing a source (meeting notes, documents)."""
    __tablename__ = "source_suggestions"
    
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid4)
    source_id = Column(UUID(as_uuid=True), ForeignKey("sources.id", ondelete="CASCADE"), nullable=False)
    
    change_type = Column(String(50), nullable=False)  # 'add', 'modify', 'defer', 'remove'
    target_node_id = Column(UUID(as_uuid=True), ForeignKey("nodes.id", ondelete="SET NULL"), nullable=True)
    parent_node_id = Column(UUID(as_uuid=True), ForeignKey("nodes.id", ondelete="SET NULL"), nullable=True)
    
    title = Column(String(500), nullable=False)
    description = Column(Text, nullable=True)
    acceptance_criteria = Column(JSON, default=list)
    
    confidence = Column(Float, default=0.0, nullable=False)
    reasoning = Column(Text, nullable=True)
    source_quote = Column(Text, nullable=True)
    
    # Approval status
    is_approved = Column(Boolean, nullable=True)  # None = pending, True = approved, False = rejected
    approved_by = Column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="SET NULL"), nullable=True)
    approved_at = Column(DateTime, nullable=True)
    reviewer_note = Column(Text, nullable=True)  # Manual note from reviewer on approve/reject
    
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    
    # Relationships
    source = relationship("Source", back_populates="suggestions")
    target_node = relationship("Node", foreign_keys=[target_node_id])
    parent_node = relationship("Node", foreign_keys=[parent_node_id])


# ===== Phase 2 & 3: Audit Trail & History =====

class NodeHistory(Base):
    """Tracks every change made to a node for full audit trail."""
    __tablename__ = "node_history"
    
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid4)
    session_id = Column(UUID(as_uuid=True), ForeignKey("sessions.id", ondelete="CASCADE"), nullable=True)
    node_id = Column(UUID(as_uuid=True), ForeignKey("nodes.id", ondelete="CASCADE"), nullable=False)
    
    change_type = Column(SQLEnum(ChangeType), nullable=False)
    field_changed = Column(String(100), nullable=True)
    old_value = Column(Text, nullable=True)
    new_value = Column(Text, nullable=True)
    change_reason = Column(Text, nullable=True)
    
    source_id = Column(UUID(as_uuid=True), ForeignKey("sources.id", ondelete="SET NULL"), nullable=True)
    changed_by = Column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="SET NULL"), nullable=True)
    
    changed_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    
    # Relationships
    node = relationship("Node", back_populates="history_entries")
    session = relationship("Session")
    source = relationship("Source", back_populates="history_entries")
    changer = relationship("User", foreign_keys=[changed_by])
    
    # Indexes for efficient querying
    __table_args__ = (
        Index("idx_node_history_node_id", "node_id"),
        Index("idx_node_history_session_id", "session_id"),
        Index("idx_node_history_changed_at", "changed_at"),
        Index("idx_node_history_change_type", "change_type"),
        Index("idx_node_history_changed_by", "changed_by"),
    )


# ===== Phase 4: Planning Board =====

class TeamMember(Base):
    """Team members available for assignment within a session."""
    __tablename__ = "team_members"
    
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid4)
    session_id = Column(UUID(as_uuid=True), ForeignKey("sessions.id", ondelete="CASCADE"), nullable=False)
    
    name = Column(String(255), nullable=False)
    email = Column(String(255), nullable=True)
    role = Column(String(100), nullable=True)  # 'developer', 'designer', 'pm', etc.
    avatar_color = Column(String(20), nullable=True)  # hex color for avatar
    
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    
    # Relationships
    session = relationship("Session", back_populates="team_members")
    assignments = relationship("Assignment", back_populates="team_member", cascade="all, delete-orphan")


class Card(Base):
    """Planning card derived from a node for lightweight task tracking."""
    __tablename__ = "cards"
    
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid4)
    node_id = Column(UUID(as_uuid=True), ForeignKey("nodes.id", ondelete="SET NULL"), nullable=True, unique=True)
    session_id = Column(UUID(as_uuid=True), ForeignKey("sessions.id", ondelete="CASCADE"), nullable=False)
    
    # Card-level title/description (used for out-of-scope cards or overrides)
    title = Column(String(500), nullable=True)
    description = Column(Text, nullable=True)
    
    status = Column(SQLEnum(CardStatus), default=CardStatus.BACKLOG, nullable=False)
    priority = Column(SQLEnum(CardPriority), default=CardPriority.MEDIUM, nullable=False)
    is_out_of_scope = Column(Boolean, default=False, nullable=False)
    
    due_date = Column(Date, nullable=True)
    estimated_hours = Column(Float, nullable=True)
    actual_hours = Column(Float, nullable=True)
    card_metadata = Column(JSON, default=dict)
    
    completed_at = Column(DateTime, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow, nullable=False)
    
    # Relationships
    node = relationship("Node", back_populates="card")
    session = relationship("Session", back_populates="cards")
    assignments = relationship("Assignment", back_populates="card", cascade="all, delete-orphan")
    acceptance_criteria = relationship("AcceptanceCriterion", back_populates="card", cascade="all, delete-orphan")
    comments = relationship("CardComment", back_populates="card", cascade="all, delete-orphan")
    
    # Indexes
    __table_args__ = (
        Index("idx_cards_session_id", "session_id"),
        Index("idx_cards_session_status", "session_id", "status"),
        Index("idx_cards_priority", "priority"),
    )


class NotificationPreference(Base):
    """User notification preferences per session — controls which email alerts they receive."""
    __tablename__ = "notification_preferences"
    
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid4)
    user_id = Column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    session_id = Column(UUID(as_uuid=True), ForeignKey("sessions.id", ondelete="CASCADE"), nullable=False)
    
    # Which events to notify about
    notify_node_created = Column(Boolean, default=True, nullable=False)
    notify_node_modified = Column(Boolean, default=True, nullable=False)
    notify_node_deleted = Column(Boolean, default=True, nullable=False)
    notify_node_moved = Column(Boolean, default=False, nullable=False)
    notify_status_changed = Column(Boolean, default=True, nullable=False)
    notify_source_ingested = Column(Boolean, default=True, nullable=False)
    
    # Mailchimp subscriber hash (md5 of lowercase email) — cached for fast lookups
    mailchimp_subscriber_hash = Column(String(32), nullable=True)
    is_subscribed = Column(Boolean, default=True, nullable=False)
    
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow, nullable=False)
    
    # Relationships
    user = relationship("User", foreign_keys=[user_id])
    session = relationship("Session", foreign_keys=[session_id])
    
    __table_args__ = (
        Index("idx_notification_pref_user_session", "user_id", "session_id", unique=True),
    )


class AcceptanceCriterion(Base):
    """Individual acceptance criterion on a planning card."""
    __tablename__ = "acceptance_criteria"
    
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid4)
    card_id = Column(UUID(as_uuid=True), ForeignKey("cards.id", ondelete="CASCADE"), nullable=False)
    node_id = Column(UUID(as_uuid=True), ForeignKey("nodes.id", ondelete="SET NULL"), nullable=True)
    
    description = Column(Text, nullable=False)
    is_completed = Column(Boolean, default=False, nullable=False)
    completed_at = Column(DateTime, nullable=True)
    order_index = Column(Integer, default=0, nullable=False)
    
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    
    # Relationships
    card = relationship("Card", back_populates="acceptance_criteria")
    node = relationship("Node")
    
    __table_args__ = (
        Index("idx_ac_card_id", "card_id"),
    )


class CardComment(Base):
    """Comment / note on a planning card."""
    __tablename__ = "card_comments"
    
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid4)
    card_id = Column(UUID(as_uuid=True), ForeignKey("cards.id", ondelete="CASCADE"), nullable=False)
    author_id = Column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="SET NULL"), nullable=True)
    
    content = Column(Text, nullable=False)
    
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow, nullable=False)
    
    # Relationships
    card = relationship("Card", back_populates="comments")
    author = relationship("User", foreign_keys=[author_id])
    
    __table_args__ = (
        Index("idx_card_comments_card_id", "card_id"),
    )


# ===== SEC-2.3: Session Sharing =====

class SessionMember(Base):
    """Controls which users can access a session and at what role (SEC-2.3)."""
    __tablename__ = "session_members"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid4)
    session_id = Column(UUID(as_uuid=True), ForeignKey("sessions.id", ondelete="CASCADE"), nullable=False)
    user_id = Column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    role = Column(SQLEnum(UserRole), default=UserRole.VIEWER, nullable=False)  # per-session role
    invited_by = Column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="SET NULL"), nullable=True)

    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)

    # Relationships
    session = relationship("Session", back_populates="members")
    user = relationship("User", back_populates="shared_sessions", foreign_keys=[user_id])
    inviter = relationship("User", foreign_keys=[invited_by])

    __table_args__ = (
        Index("idx_session_member_unique", "session_id", "user_id", unique=True),
    )


class Assignment(Base):
    """Links team members to nodes or cards."""
    __tablename__ = "assignments"
    
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid4)
    node_id = Column(UUID(as_uuid=True), ForeignKey("nodes.id", ondelete="CASCADE"), nullable=True)
    card_id = Column(UUID(as_uuid=True), ForeignKey("cards.id", ondelete="CASCADE"), nullable=True)
    team_member_id = Column(UUID(as_uuid=True), ForeignKey("team_members.id", ondelete="CASCADE"), nullable=False)
    
    role = Column(SQLEnum(AssignmentRole), default=AssignmentRole.ASSIGNEE, nullable=False)
    assigned_by = Column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="SET NULL"), nullable=True)
    
    assigned_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    
    # Relationships
    node = relationship("Node", back_populates="assignments")
    card = relationship("Card", back_populates="assignments")
    team_member = relationship("TeamMember", back_populates="assignments")
    assigner = relationship("User", foreign_keys=[assigned_by])
