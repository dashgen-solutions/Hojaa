"""
Pydantic models for request/response validation.

SEC-2.6: All user-facing write schemas inherit ``SanitizedModel`` which
automatically strips HTML / script tags from string fields.
"""
from datetime import datetime, date
from typing import List, Optional, Dict, Any
from uuid import UUID
from pydantic import BaseModel, Field, ConfigDict, model_validator


# ─── SEC-2.6: Sanitization mixin ────────────────────────────

def _sanitize_value(v):
    """Recursively sanitize strings inside a value."""
    if isinstance(v, str):
        from app.middleware.security import sanitize_string
        return sanitize_string(v)
    if isinstance(v, dict):
        return {k: _sanitize_value(val) for k, val in v.items()}
    if isinstance(v, list):
        return [_sanitize_value(item) for item in v]
    return v


class SanitizedModel(BaseModel):
    """Base model that sanitizes all string fields on creation (SEC-2.6)."""

    @model_validator(mode="before")
    @classmethod
    def _sanitize_inputs(cls, values):
        if isinstance(values, dict):
            skip = {"password", "hashed_password", "access_token"}
            return {
                k: _sanitize_value(v) if k not in skip else v
                for k, v in values.items()
            }
        return values


# ===== Authentication Schemas =====

class UserRegister(SanitizedModel):
    """Schema for user registration (individual or enterprise admin)."""
    email: str
    username: str = Field(..., min_length=3, max_length=100)
    password: str = Field(..., min_length=6, max_length=72)
    # Enterprise registration (optional — if provided, creates org)
    organization_name: Optional[str] = None
    industry: Optional[str] = None
    company_size: Optional[str] = None   # 1-10, 11-50, 51-200, 201-500, 500+
    website: Optional[str] = None


class UserLogin(BaseModel):
    """Schema for user login."""
    email: str
    password: str


class OrganizationResponse(BaseModel):
    """Schema for organization response."""
    id: UUID
    name: str
    slug: str
    logo_url: Optional[str] = None
    industry: Optional[str] = None
    size: Optional[str] = None
    website: Optional[str] = None
    is_active: bool
    created_at: datetime
    
    model_config = ConfigDict(from_attributes=True)


class UserResponse(BaseModel):
    """Schema for user response."""
    id: UUID
    email: str
    username: str
    is_active: bool
    role: str = "editor"  # SEC-2.1 RBAC role
    organization_id: Optional[UUID] = None
    org_role: Optional[str] = None   # owner | admin | member
    job_title: Optional[str] = None
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
    user_type: str = "non_technical"
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
    status: str = "active"
    priority: Optional[str] = None
    acceptance_criteria: Optional[List[str]] = []
    source_id: Optional[str] = None
    depth: int
    order_index: int
    can_expand: bool
    is_expanded: bool
    metadata: Optional[Dict[str, Any]] = {}
    children: Optional[List["NodeResponse"]] = []
    
    model_config = ConfigDict(from_attributes=True)


class NodeCreate(SanitizedModel):
    """Schema for creating a new node."""
    session_id: str
    parent_id: Optional[str] = None
    question: str = Field(..., min_length=1, max_length=500)
    answer: Optional[str] = ""
    node_type: Optional[str] = "feature"
    priority: Optional[str] = None
    metadata: Optional[Dict[str, Any]] = {}


class NodeUpdate(SanitizedModel):
    """Schema for updating a node."""
    question: Optional[str] = Field(None, min_length=1, max_length=500)
    answer: Optional[str] = None
    node_type: Optional[str] = None
    priority: Optional[str] = None
    acceptance_criteria: Optional[List[str]] = None
    metadata: Optional[Dict[str, Any]] = None


class NodeStatusUpdate(SanitizedModel):
    """Schema for changing node status with a reason."""
    status: str  # 'active', 'deferred', 'completed', 'removed'
    reason: Optional[str] = None


class BulkNodeStatusUpdate(SanitizedModel):
    """Schema for changing status of multiple nodes at once."""
    node_ids: List[str]
    status: str  # 'active', 'deferred', 'completed', 'removed'
    reason: Optional[str] = None


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


# ===== Source Schemas (Phase 1) =====

class SourceIngestRequest(BaseModel):
    """Schema for ingesting meeting notes or documents."""
    session_id: str
    source_type: str = "meeting"  # 'meeting', 'document', 'manual', 'email', 'slack'
    source_format: str = "raw"  # 'raw', 'otter', 'fireflies', 'email', 'slack'
    source_name: str = Field(..., min_length=1, max_length=255)
    raw_content: str = Field(..., min_length=1)
    meeting_type: Optional[str] = None  # 'sprint_planning', 'standup', 'retrospective', etc.
    source_metadata: Optional[Dict[str, Any]] = {}  # date, attendees, duration, etc.


class SuggestionResponse(BaseModel):
    """Schema for a single AI-generated suggestion."""
    id: str
    source_id: str
    change_type: str  # 'add', 'modify', 'defer', 'remove'
    target_node_id: Optional[str] = None
    parent_node_id: Optional[str] = None
    title: str
    description: Optional[str] = None
    acceptance_criteria: Optional[List[str]] = []
    confidence: float
    reasoning: Optional[str] = None
    source_quote: Optional[str] = None
    is_approved: Optional[bool] = None
    
    model_config = ConfigDict(from_attributes=True)


class SourceResponse(BaseModel):
    """Schema for source response."""
    id: str
    session_id: str
    source_type: str
    source_name: str
    is_processed: bool
    processed_summary: Optional[str] = None
    source_metadata: Optional[Dict[str, Any]] = {}
    suggestions_count: int = 0
    approved_count: int = 0
    rejected_count: int = 0
    pending_count: int = 0
    created_at: datetime
    
    model_config = ConfigDict(from_attributes=True)


class SourceDetailResponse(BaseModel):
    """Schema for source with its suggestions."""
    id: str
    session_id: str
    source_type: str
    source_name: str
    raw_content: Optional[str] = None
    processed_summary: Optional[str] = None
    is_processed: bool
    source_metadata: Optional[Dict[str, Any]] = {}
    suggestions: List[SuggestionResponse] = []
    created_at: datetime
    
    model_config = ConfigDict(from_attributes=True)


class SuggestionApplyRequest(BaseModel):
    """Schema for approving/rejecting suggestions."""
    suggestion_id: str
    is_approved: bool
    edited_title: Optional[str] = None
    edited_description: Optional[str] = None
    reviewer_note: Optional[str] = None


class BulkSuggestionApplyRequest(BaseModel):
    """Schema for bulk approving/rejecting suggestions."""
    decisions: List[SuggestionApplyRequest]


# ===== Node History / Audit Schemas (Phase 2 & 3) =====

class NodeHistoryResponse(BaseModel):
    """Schema for a single history entry."""
    id: str
    node_id: str
    change_type: str
    field_changed: Optional[str] = None
    old_value: Optional[str] = None
    new_value: Optional[str] = None
    change_reason: Optional[str] = None
    source_name: Optional[str] = None
    changed_by_name: Optional[str] = None
    changed_at: datetime
    
    model_config = ConfigDict(from_attributes=True)


class AuditTimelineEntry(BaseModel):
    """Schema for a timeline entry in the audit log."""
    id: str
    node_id: str
    node_title: str
    change_type: str
    field_changed: Optional[str] = None
    old_value: Optional[str] = None
    new_value: Optional[str] = None
    change_reason: Optional[str] = None
    source_name: Optional[str] = None
    changed_by_name: Optional[str] = None
    changed_at: datetime


class AuditTimelineResponse(BaseModel):
    """Schema for the full audit timeline."""
    session_id: str
    total_changes: int
    entries: List[AuditTimelineEntry]


# ===== Planning Board Schemas (Phase 4) =====

class TeamMemberCreate(BaseModel):
    """Schema for creating a team member."""
    name: str = Field(..., min_length=1, max_length=255)
    email: Optional[str] = None
    role: Optional[str] = None


class TeamMemberResponse(BaseModel):
    """Schema for team member response."""
    id: str
    session_id: str
    name: str
    email: Optional[str] = None
    role: Optional[str] = None
    avatar_color: Optional[str] = None
    created_at: datetime
    
    model_config = ConfigDict(from_attributes=True)


class CardCreate(SanitizedModel):
    """Schema for creating a planning card from a node."""
    node_id: Optional[str] = None
    session_id: str
    title: Optional[str] = None
    description: Optional[str] = None
    priority: Optional[str] = "medium"
    due_date: Optional[date] = None
    is_out_of_scope: bool = False


class CardUpdate(SanitizedModel):
    """Schema for updating a planning card."""
    status: Optional[str] = None
    priority: Optional[str] = None
    due_date: Optional[date] = None
    estimated_hours: Optional[float] = None
    actual_hours: Optional[float] = None
    title: Optional[str] = None
    description: Optional[str] = None


class AssignmentCreate(BaseModel):
    """Schema for assigning a team member to a card."""
    team_member_id: str
    role: Optional[str] = "assignee"


class CardAssignmentResponse(BaseModel):
    """Schema for assignment on a card."""
    id: str
    team_member_id: str
    team_member_name: str
    role: str
    assigned_at: datetime
    
    model_config = ConfigDict(from_attributes=True)


class CardResponse(BaseModel):
    """Schema for planning card response."""
    id: str
    node_id: Optional[str] = None
    session_id: str
    node_title: str
    node_description: Optional[str] = None
    node_type: str
    node_status: Optional[str] = None
    title: Optional[str] = None
    description: Optional[str] = None
    status: str
    priority: str
    is_out_of_scope: bool = False
    due_date: Optional[date] = None
    estimated_hours: Optional[float] = None
    actual_hours: Optional[float] = None
    assignments: List[CardAssignmentResponse] = []
    acceptance_criteria: List['AcceptanceCriterionResponse'] = []
    comments: List['CardCommentResponse'] = []
    ac_total: int = 0
    ac_completed: int = 0
    completed_at: Optional[datetime] = None
    created_at: datetime
    updated_at: datetime
    
    model_config = ConfigDict(from_attributes=True)


class AcceptanceCriterionResponse(BaseModel):
    """Schema for acceptance criterion response."""
    id: str
    card_id: str
    node_id: Optional[str] = None
    description: str
    is_completed: bool
    completed_at: Optional[datetime] = None
    order_index: int = 0
    
    model_config = ConfigDict(from_attributes=True)


class AcceptanceCriterionCreate(BaseModel):
    """Schema for creating an acceptance criterion."""
    description: str
    node_id: Optional[str] = None


class AcceptanceCriterionUpdate(BaseModel):
    """Schema for updating an acceptance criterion."""
    description: Optional[str] = None
    is_completed: Optional[bool] = None


class CardCommentResponse(BaseModel):
    """Schema for card comment response."""
    id: str
    card_id: str
    author_name: Optional[str] = None
    content: str
    created_at: datetime
    
    model_config = ConfigDict(from_attributes=True)


class CardCommentCreate(SanitizedModel):
    """Schema for adding a comment to a card."""
    content: str


class WorkloadEntry(BaseModel):
    """Schema for a single team member workload entry."""
    team_member_id: str
    team_member_name: str
    avatar_color: Optional[str] = None
    total_cards: int = 0
    cards_by_status: Dict[str, int] = {}


class PlanningBoardResponse(BaseModel):
    """Schema for the full planning board."""
    session_id: str
    columns: Dict[str, List[CardResponse]]
    team_members: List[TeamMemberResponse]
    total_cards: int
    completed_cards: int


class BulkCardCreate(BaseModel):
    """Schema for bulk creating cards from graph nodes."""
    session_id: str
    node_types: Optional[List[str]] = ["feature"]  # which node types to create cards for
    include_details: bool = False


# ===== Export Schemas (Phase 5) =====

class ExportRequest(BaseModel):
    """Schema for export request."""
    session_id: str
    format: str = "pdf"  # 'pdf', 'json', 'markdown'
    include_deferred: bool = False
    include_change_log: bool = False
    include_assignments: bool = False
    include_sources: bool = False
    include_completed: bool = False
    include_conversations: bool = False
    detail_level: str = "detailed"  # 'summary', 'detailed', 'full'
    date_from: Optional[datetime] = None


class ExportResponse(BaseModel):
    """Schema for export response."""
    session_id: str
    format: str
    content: Optional[str] = None  # For markdown/JSON
    download_url: Optional[str] = None  # For PDF
    filename: str
    generated_at: datetime


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
