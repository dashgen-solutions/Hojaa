"""
SQLAlchemy database models for the application.
"""
from datetime import datetime
from typing import List, Optional
from uuid import uuid4
from sqlalchemy import (
    Column, String, Text, Integer, Boolean, DateTime,
    ForeignKey, JSON, Enum as SQLEnum
)
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import relationship
from app.db.session import Base
from passlib.context import CryptContext
import enum

# Password hashing
pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")


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


class User(Base):
    """User model for authentication."""
    __tablename__ = "users"
    
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid4)
    email = Column(String(255), unique=True, index=True, nullable=False)
    username = Column(String(100), unique=True, index=True, nullable=False)
    hashed_password = Column(String(255), nullable=False)
    is_active = Column(Boolean, default=True, nullable=False)
    
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow, nullable=False)
    
    # Relationships
    sessions = relationship("Session", back_populates="user")
    
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
    user = relationship("User", back_populates="sessions")
    questions = relationship("Question", back_populates="session", cascade="all, delete-orphan")
    nodes = relationship("Node", back_populates="session", cascade="all, delete-orphan")
    conversations = relationship("Conversation", back_populates="session", cascade="all, delete-orphan")


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
    
    # Tree metadata
    depth = Column(Integer, default=0, nullable=False)
    order_index = Column(Integer, default=0, nullable=False)
    can_expand = Column(Boolean, default=False, nullable=False)
    is_expanded = Column(Boolean, default=False, nullable=False)
    
    # Additional data
    node_metadata = Column(JSON, default=dict)
    
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow, nullable=False)
    
    # Relationships
    session = relationship("Session", back_populates="nodes")
    children = relationship("Node", backref="parent", remote_side=[id], cascade="all")
    conversations = relationship("Conversation", back_populates="node")


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
