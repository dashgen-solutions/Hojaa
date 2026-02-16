"""
Pydantic models for AI agent structured outputs.
These models ensure type-safe, validated responses from LLM agents.
"""
from typing import List, Dict, Any, Optional, Literal
from pydantic import BaseModel, Field


# ===== Meeting Notes / Source Analysis Models =====

class ScopeChange(BaseModel):
    """A single scope change detected from meeting notes or documents."""
    change_type: Literal["add", "modify", "defer", "remove"] = Field(
        description="Type of scope change"
    )
    target_node_id: Optional[str] = Field(
        default=None,
        description="ID of existing node to modify/defer/remove (null for 'add')"
    )
    parent_node_id: Optional[str] = Field(
        default=None,
        description="ID of parent node for new additions"
    )
    title: str = Field(description="Clear title for the scope change")
    description: Optional[str] = Field(
        default=None,
        description="Detailed description of the change"
    )
    acceptance_criteria: Optional[List[str]] = Field(
        default=None,
        description="Acceptance criteria if applicable"
    )
    confidence: float = Field(
        description="Confidence score 0-1 that this is a real scope change",
        ge=0.0,
        le=1.0
    )
    reasoning: str = Field(
        description="Why this is identified as a scope change"
    )
    source_quote: str = Field(
        description="Exact quote from the source that supports this change"
    )
    decided_by: Optional[str] = Field(
        default=None,
        description="Name of the person who made or proposed this decision, if identifiable from context"
    )


class DecisionMaker(BaseModel):
    """A person identified as making or influencing scope decisions."""
    name: str = Field(description="Full name (or label) of the person")
    role: Optional[str] = Field(
        default=None,
        description="Inferred role (e.g. 'Product Owner', 'CTO', 'Stakeholder')"
    )
    decisions: List[str] = Field(
        default=[],
        description="Brief list of decisions this person drove in the meeting"
    )


class MeetingNotesOutput(BaseModel):
    """Output from meeting notes analysis agent."""
    summary: str = Field(description="Brief summary of the meeting/document")
    scope_changes: List[ScopeChange] = Field(
        description="Detected scope changes (only clear, confident changes)",
        default=[]
    )
    action_items: List[str] = Field(
        description="Action items mentioned in the meeting",
        default=[]
    )
    questions_raised: List[str] = Field(
        description="Questions that need clarification",
        default=[]
    )
    decision_makers: List[DecisionMaker] = Field(
        default=[],
        description="People identified as decision makers or key influencers in the discussion"
    )


# ===== Graph Comparison Models =====

class NodeSummary(BaseModel):
    """Summary of a node for comparison purposes."""
    node_id: str = Field(description="Node ID")
    title: str = Field(description="Node title")
    description: Optional[str] = Field(default=None, description="Node description")


class ModifiedNode(BaseModel):
    """A node that was modified between two graph versions."""
    node_id: str = Field(description="Node ID")
    title: str = Field(description="Node title")
    changes: List[str] = Field(description="List of changes made")


class GraphDiffOutput(BaseModel):
    """Output from graph comparison agent."""
    added_nodes: List[NodeSummary] = Field(default=[], description="Nodes added")
    modified_nodes: List[ModifiedNode] = Field(default=[], description="Nodes modified")
    deferred_nodes: List[NodeSummary] = Field(default=[], description="Nodes deferred")
    removed_nodes: List[NodeSummary] = Field(default=[], description="Nodes removed")
    summary: str = Field(description="Human-readable summary of changes")


# ===== Question Generation Models =====

class GeneratedQuestion(BaseModel):
    """A single generated question from the AI."""
    question: str = Field(description="The question text to ask the user")
    category: str = Field(description="Category of the question (problem_discovery, user_understanding, etc.)")
    why_important: str = Field(description="Why this question is important for requirements discovery")


class QuestionGenerationOutput(BaseModel):
    """Output from question generation agent."""
    questions: List[GeneratedQuestion] = Field(
        description="List of exactly 10 discovery questions",
        min_length=10,
        max_length=10
    )


# ===== Tree Building Models =====

class FeatureNode(BaseModel):
    """A feature/component in the requirements tree."""
    name: str = Field(description="Clear, business-focused name for this component")
    description: str = Field(description="What business value this provides")
    rationale: str = Field(description="Why this is critical based on user answers")
    priority: Literal["high", "medium", "low"] = Field(description="Priority level")


class TreeStructureOutput(BaseModel):
    """Output from tree building agent."""
    project_name: str = Field(description="Brief, business-focused project name")
    project_description: str = Field(description="One sentence describing business value")
    features: List[FeatureNode] = Field(
        description="Main solution components (decide exact count based on requirements)",
        min_length=1
    )


# ===== Sub-Requirements Extraction Models =====

class SubRequirement(BaseModel):
    """A sub-requirement extracted from conversation."""
    question: str = Field(description="Clear, business-focused title")
    answer: str = Field(description="Detailed description of what's needed and why")
    type: Literal["feature", "detail"] = Field(description="Whether this is a feature or detail")
    priority: Literal["high", "medium", "low"] = Field(description="Priority level")


class SubRequirementsOutput(BaseModel):
    """Output from sub-requirements extraction agent."""
    sub_requirements: List[SubRequirement] = Field(
        description="Specific sub-requirements extracted from conversation (decide exact count based on what was discussed)",
        min_length=1
    )
    summary: str = Field(description="One sentence summary of what was defined")


# ===== Conversation Models =====

class ConversationStartOutput(BaseModel):
    """Output when starting a feature conversation."""
    question: str = Field(description="First question to ask about the feature")
    suggestions: List[str] = Field(
        description="3-5 realistic answer suggestions",
        min_length=3,
        max_length=5
    )
    reasoning: str = Field(description="Why this question matters")


class ExtractedInfo(BaseModel):
    """Information extracted during conversation."""
    workflow: Optional[str] = Field(default=None, description="User workflow description")
    user_needs: Optional[str] = Field(default=None, description="Specific user needs")
    pain_points: Optional[str] = Field(default=None, description="Pain points to address")
    business_value: Optional[str] = Field(default=None, description="Business value description")
    technical_details: Optional[str] = Field(default=None, description="Technical implementation details (if applicable)")


class ConversationNextOutput(BaseModel):
    """Output for next conversation turn."""
    question: str = Field(description="Next question or completion summary")
    suggestions: List[str] = Field(
        description="Answer suggestions (empty if complete)",
        default=[]
    )
    is_complete: bool = Field(description="Whether we have enough information")
    extracted_info: ExtractedInfo = Field(description="Information learned so far")
    reasoning: str = Field(description="Why asking this or why complete")


# ===== Agent Context Models =====

class UserContext(BaseModel):
    """Context about the user for agent personalization."""
    user_type: Literal["technical", "non_technical"] = Field(
        description="User's technical level"
    )
    session_id: str = Field(description="Current session ID")


class DocumentContext(BaseModel):
    """Context from document analysis."""
    document_text: str = Field(description="The document text")
    user_type: Literal["technical", "non_technical"] = Field(description="User's technical level")


class FeatureContext(BaseModel):
    """Context for feature exploration."""
    feature_name: str = Field(description="Name of the feature being explored")
    feature_description: str = Field(description="Description of the feature")
    parent_hierarchy: str = Field(description="Hierarchical context from root")
    initial_context: str = Field(description="Initial business context from questions")
    user_type: Literal["technical", "non_technical"] = Field(description="User's technical level")


class ConversationContext(BaseModel):
    """Context for ongoing conversation."""
    feature_name: str = Field(description="Feature being discussed")
    parent_hierarchy: str = Field(description="Hierarchical context")
    conversation_history: str = Field(description="Formatted conversation history")
    extracted_info: Dict[str, Any] = Field(default={}, description="Info extracted so far")
    user_type: Literal["technical", "non_technical"] = Field(description="User's technical level")


class SubRequirementContext(BaseModel):
    """Context for extracting sub-requirements."""
    feature_name: str = Field(description="Feature discussed")
    parent_hierarchy: str = Field(description="Hierarchical context")
    conversation_history: str = Field(description="Complete conversation")
    user_type: Literal["technical", "non_technical"] = Field(description="User's technical level")


class MeetingNotesContext(BaseModel):
    """Context for meeting notes analysis."""
    raw_content: str = Field(description="Raw meeting notes or document text")
    current_graph_summary: str = Field(description="Summary of current graph state (nodes and structure)")
    session_id: str = Field(description="Session ID for reference")


# ===== AI-3.1: Smart Status Suggestions =====

class StatusSuggestion(BaseModel):
    """AI-generated suggestion for a node's status."""
    suggested_status: str = Field(description="Suggested status: active, deferred, completed, removed")
    confidence: float = Field(description="Confidence 0-1", ge=0.0, le=1.0)
    reasoning: str = Field(description="Why this status is appropriate")


class StatusSuggestionsOutput(BaseModel):
    """Output from smart status suggestion agent."""
    suggestions: List[StatusSuggestion] = Field(
        description="One or more status suggestions, ordered by confidence",
        min_length=1,
    )


# ===== AI-3.3: AC Generation =====

class GeneratedAC(BaseModel):
    """A single AI-generated acceptance criterion."""
    description: str = Field(description="Clear, testable acceptance criterion")
    priority: Literal["must", "should", "could"] = Field(
        default="must",
        description="MoSCoW priority"
    )


class ACGenerationOutput(BaseModel):
    """Output from AI acceptance-criteria generation agent."""
    acceptance_criteria: List[GeneratedAC] = Field(
        description="List of acceptance criteria derived from the node description and context",
        min_length=1,
    )


# ===== AI-3.4 / AI-3.5: Export Structuring & Summary =====

class ExportSummaryOutput(BaseModel):
    """AI-generated executive summary for export documents."""
    executive_summary: str = Field(
        description="A concise, professional executive summary of the project scope (3-5 paragraphs)"
    )
    key_themes: List[str] = Field(
        default=[],
        description="Top 3-5 recurring themes across the scope"
    )
    risk_highlights: List[str] = Field(
        default=[],
        description="Key risks or open questions to flag"
    )
