"""
AI-powered meeting notes parser using Pydantic AI agents.
Analyzes meeting notes and extracts scope-relevant changes.
"""
from typing import List, Dict, Any
from uuid import UUID
from datetime import datetime
from sqlalchemy.orm import Session as DBSession
from app.services.agent_service import create_requirements_agent
from app.models.agent_models import MeetingNotesOutput, MeetingNotesContext
from app.models.database import (
    Source, SourceSuggestion, Node, NodeType, SourceType
)
from app.core.logger import get_logger

logger = get_logger(__name__)


class MeetingNotesParser:
    """
    Service for parsing meeting notes and extracting scope changes.
    Uses AI to identify additions, modifications, deferrals in scope.
    """
    
    def __init__(self):
        """Initialize parser with AI agent."""
        self.analysis_agent = create_requirements_agent(
            system_prompt=self._get_system_prompt(),
            output_type=MeetingNotesOutput,
        )
    
    def _get_system_prompt(self) -> str:
        """System prompt for meeting notes analysis."""
        return """You are a scope analyst for software projects.

Given meeting notes (or a document) and the current project scope graph, 
identify any scope changes discussed.

RULES:
- Be CONSERVATIVE: only flag clear scope changes, not general discussion
- Include the EXACT QUOTE from the meeting that supports each change
- Assign a confidence score (0-1) based on how clearly the change was discussed
- For "add": identify the best parent node in the current graph for the new item
- For "modify": identify the exact node being changed and what changed
- For "defer": identify items being pushed to later phases
- For "remove": identify items being explicitly dropped
- If no scope changes are detected, return an empty list — that's perfectly fine
- Extract action items separately (these are tasks, not scope changes)
- Note questions that were raised but not resolved

Always prioritize precision over recall. It's better to miss a subtle 
scope change than to falsely flag general discussion as a scope change."""
    
    def _build_graph_summary(self, session_id: UUID, database: DBSession) -> str:
        """Build a text summary of the current graph for AI context."""
        nodes = database.query(Node).filter(
            Node.session_id == session_id
        ).order_by(Node.depth, Node.order_index).all()
        
        if not nodes:
            return "No existing scope items. This is a new project."
        
        summary_lines = ["CURRENT PROJECT SCOPE:"]
        summary_lines.append("")
        
        for node in nodes:
            indent = "  " * node.depth
            status_indicator = ""
            if hasattr(node, 'status') and node.status:
                status_indicator = f" [{node.status.value}]"
            
            summary_lines.append(
                f"{indent}• [{node.node_type.value.upper()}] {node.question}{status_indicator}"
            )
            summary_lines.append(f"{indent}  ID: {node.id}")
            if node.answer:
                # Truncate long descriptions for prompt efficiency
                short_answer = node.answer[:200] + "..." if len(node.answer) > 200 else node.answer
                summary_lines.append(f"{indent}  Description: {short_answer}")
            summary_lines.append("")
        
        return "\n".join(summary_lines)
    
    async def analyze_source(
        self,
        source_id: UUID,
        database: DBSession
    ) -> List[SourceSuggestion]:
        """
        Analyze a source (meeting notes/document) and generate suggestions.
        
        Args:
            source_id: ID of the source to analyze
            database: Database session
        
        Returns:
            List of generated SourceSuggestion objects
        """
        try:
            source = database.query(Source).filter(Source.id == source_id).first()
            if not source:
                raise ValueError(f"Source {source_id} not found")
            
            logger.info(f"Analyzing source '{source.source_name}' for session {source.session_id}")
            
            # Build current graph summary for context
            graph_summary = self._build_graph_summary(source.session_id, database)
            
            # Build prompt
            user_prompt = f"""Analyze the following {source.source_type.value} and identify scope changes:

SOURCE: {source.source_name}
{f"DATE: {source.source_metadata.get('date', 'Not specified')}" if source.source_metadata else ""}
{f"ATTENDEES: {source.source_metadata.get('attendees', 'Not specified')}" if source.source_metadata else ""}

---
{source.raw_content}
---

{graph_summary}

Identify all scope changes, action items, and unresolved questions."""
            
            # Run AI analysis
            result = await self.analysis_agent.run(user_prompt)
            meeting_output = result.output
            
            logger.info(
                f"Analysis complete: {len(meeting_output.scope_changes)} scope changes, "
                f"{len(meeting_output.action_items)} action items detected"
            )
            
            # Create suggestion records
            created_suggestions = []
            for scope_change in meeting_output.scope_changes:
                suggestion = SourceSuggestion(
                    source_id=source_id,
                    change_type=scope_change.change_type,
                    target_node_id=scope_change.target_node_id if scope_change.target_node_id else None,
                    parent_node_id=scope_change.parent_node_id if scope_change.parent_node_id else None,
                    title=scope_change.title,
                    description=scope_change.description,
                    acceptance_criteria=scope_change.acceptance_criteria or [],
                    confidence=scope_change.confidence,
                    reasoning=scope_change.reasoning,
                    source_quote=scope_change.source_quote,
                )
                database.add(suggestion)
                created_suggestions.append(suggestion)
            
            # Update source as processed
            source.is_processed = True
            source.processed_at = datetime.utcnow()
            source.processed_summary = meeting_output.summary
            
            # Store action items and questions in source metadata
            existing_metadata = source.source_metadata or {}
            existing_metadata["action_items"] = meeting_output.action_items
            existing_metadata["questions_raised"] = meeting_output.questions_raised
            source.source_metadata = existing_metadata
            
            database.commit()
            
            for suggestion in created_suggestions:
                database.refresh(suggestion)
            
            return created_suggestions
            
        except Exception as error:
            logger.error(f"Error analyzing source: {str(error)}")
            database.rollback()
            raise


# Global instance
meeting_notes_parser = MeetingNotesParser()
