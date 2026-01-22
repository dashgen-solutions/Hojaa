"""
Pydantic models for AI agent structured outputs.
These models ensure type-safe, validated responses from LLM agents.
"""
from typing import List, Dict, Any, Optional, Literal
from pydantic import BaseModel, Field


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
