"""
Pydantic models for request/response validation.
"""
from datetime import datetime
from typing import List, Optional, Dict, Any
from uuid import UUID
from pydantic import BaseModel, Field, ConfigDict


# ===== Authentication Schemas =====

class UserRegister(BaseModel):
    """Schema for user registration."""
    # Use plain str to avoid requiring the optional `email-validator` dependency
    # at import time. If you want strict email validation, install:
    #   pip install "pydantic[email]"
    email: str
    username: str = Field(..., min_length=3, max_length=100)
    password: str = Field(..., min_length=6, max_length=72)


class UserLogin(BaseModel):
    """Schema for user login."""
    email: str
    password: str


class UserResponse(BaseModel):
    """Schema for user response."""
    id: UUID
    email: str
    username: str
    is_active: bool
    created_at: datetime
    
    model_config = ConfigDict(from_attributes=True)


class Token(BaseModel):
    """Schema for JWT token response."""
    access_token: str
    token_type: str = "bearer"


class TokenData(BaseModel):
    """Schema for token payload data."""
    user_id: Optional[UUID] = None


# ===== Session Schemas =====

class SessionCreate(BaseModel):
    """Schema for creating a new session."""
    user_type: str = "non_technical"  # "technical" or "non_technical"
    document_text: Optional[str] = None
    document_type: Optional[str] = None
    document_filename: Optional[str] = None


class SessionResponse(BaseModel):
    """Schema for session response."""
    id: UUID
    user_id: Optional[UUID] = None
    user_type: str
    status: str
    document_filename: Optional[str] = None
    created_at: datetime
    updated_at: datetime
    
    model_config = ConfigDict(from_attributes=True)


# ===== Document Upload Schemas =====

class DocumentUploadResponse(BaseModel):
    """Response after document upload."""
    session_id: UUID
    questions: List["QuestionResponse"]
    message: str = "Document analyzed successfully"


# ===== Question Schemas =====

class QuestionResponse(BaseModel):
    """Schema for question response."""
    id: UUID
    question_text: str
    category: Optional[str] = None
    order_index: int
    is_answered: bool
    answer_text: Optional[str] = None
    
    model_config = ConfigDict(from_attributes=True)


class AnswerSubmit(BaseModel):
    """Schema for submitting an answer."""
    question_id: UUID
    answer_text: str


class QuestionsSubmitRequest(BaseModel):
    """Schema for submitting all answers."""
    session_id: UUID
    answers: List[AnswerSubmit]


class QuestionCreate(BaseModel):
    """Schema for creating a new question."""
    question_text: str = Field(..., min_length=1, max_length=500)
    category: Optional[str] = "custom"


class QuestionUpdate(BaseModel):
    """Schema for updating a question."""
    question_text: Optional[str] = Field(None, min_length=1, max_length=500)
    answer_text: Optional[str] = None
    category: Optional[str] = None


# ===== Tree Schemas =====

class NodeResponse(BaseModel):
    """Schema for tree node response."""
    id: str
    session_id: str
    parent_id: Optional[str] = None
    question: str
    answer: Optional[str] = None
    node_type: str
    depth: int
    order_index: int
    can_expand: bool
    is_expanded: bool
    metadata: Optional[Dict[str, Any]] = {}
    children: Optional[List["NodeResponse"]] = []
    
    model_config = ConfigDict(from_attributes=True)


class NodeCreate(BaseModel):
    """Schema for creating a new node."""
    session_id: str
    parent_id: Optional[str] = None
    question: str = Field(..., min_length=1, max_length=500)
    answer: Optional[str] = ""
    node_type: Optional[str] = "feature"
    metadata: Optional[Dict[str, Any]] = {}


class NodeUpdate(BaseModel):
    """Schema for updating a node."""
    question: Optional[str] = Field(None, min_length=1, max_length=500)
    answer: Optional[str] = None
    node_type: Optional[str] = None
    metadata: Optional[Dict[str, Any]] = None


class TreeResponse(BaseModel):
    """Schema for complete tree response."""
    session_id: UUID
    tree: Dict[str, Any]
    message: str = "Tree generated successfully"


# ===== Chat Schemas =====

class ChatStartRequest(BaseModel):
    """Schema for starting a feature chat."""
    session_id: UUID
    node_id: UUID


class ChatStartResponse(BaseModel):
    """Response when starting a chat."""
    conversation_id: UUID
    node_id: UUID
    context: str
    first_question: str
    suggestions: List[str] = []


class ChatMessageRequest(BaseModel):
    """Schema for sending a chat message."""
    conversation_id: UUID
    message: str


class ChatMessageResponse(BaseModel):
    """Response for chat message."""
    message: str
    suggestions: List[str] = []
    is_complete: bool = False
    extracted_info: Dict[str, Any] = {}


class ChatConfirmRequest(BaseModel):
    """Schema for confirming chat and adding nodes."""
    conversation_id: UUID


class ChatConfirmResponse(BaseModel):
    """Response after confirming chat."""
    parent_node_id: UUID
    new_children: List[Dict[str, Any]]
    message: str = "Nodes added successfully"


class MessageResponse(BaseModel):
    """Schema for message response."""
    id: UUID
    role: str
    content: str
    message_metadata: Dict[str, Any] = {}
    created_at: datetime
    
    model_config = ConfigDict(from_attributes=True)


class ConversationHistoryResponse(BaseModel):
    """Schema for conversation history."""
    conversation_id: UUID
    messages: List[MessageResponse]
    extracted_info: Dict[str, Any] = {}
    status: str


# ===== Generic Response Schemas =====

class SuccessResponse(BaseModel):
    """Generic success response."""
    success: bool = True
    message: str
    data: Optional[Dict[str, Any]] = None


class ErrorResponse(BaseModel):
    """Generic error response."""
    success: bool = False
    error: str
    detail: Optional[str] = None


class HealthResponse(BaseModel):
    """Health check response."""
    status: str = "healthy"
    version: str
    environment: str
    database: str = "connected"


# ===== Transcription Schemas =====

class TranscriptionResponse(BaseModel):
    """Response from audio transcription."""
    text: str
    language: str = "unknown"
    success: bool = True


# Enable forward references
NodeResponse.model_rebuild()
