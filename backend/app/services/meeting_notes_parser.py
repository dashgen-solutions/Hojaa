"""
AI-powered meeting notes parser using Pydantic AI agents.
Analyzes meeting notes and extracts scope-relevant changes.

Supports format-specific pre-processing for:
- Otter.ai transcripts
- Fireflies.ai transcripts
- Email threads
- Slack conversation exports
- Raw text / generic notes
"""
from typing import List, Dict, Any, Optional
from uuid import UUID
from datetime import datetime
from sqlalchemy.orm import Session as DBSession
from app.services.agent_service import create_requirements_agent, cached_agent_run
from app.models.agent_models import MeetingNotesOutput, MeetingNotesContext
from app.models.database import (
    Source, SourceSuggestion, Node, NodeType, SourceType
)
from app.services.source_format_parser import preprocess_source_content
from app.core.logger import get_logger

logger = get_logger(__name__)


# ===== Format-Specific AI Prompt Hints =====
# These tell the AI what to expect from each source format,
# so it can focus on the right signals.

FORMAT_ANALYSIS_HINTS: Dict[str, str] = {
    'otter': (
        "This content is an Otter.ai transcript with speaker labels. "
        "Pay attention to:\n"
        "- Decisions announced by speakers in leadership/PM roles\n"
        "- Action items assigned to specific people\n"
        "- Feature requests or changes discussed by stakeholders\n"
        "- Disagreements that may indicate unresolved scope questions"
    ),
    'fireflies': (
        "This content is a Fireflies.ai transcript with speaker labels. "
        "Pay attention to:\n"
        "- Decisions announced by speakers in leadership/PM roles\n"
        "- Action items assigned to specific people\n"
        "- Feature requests or changes discussed by stakeholders\n"
        "- Disagreements that may indicate unresolved scope questions"
    ),
    'email': (
        "This content is an email thread. "
        "Pay attention to:\n"
        "- Decisions confirmed or approved in replies\n"
        "- Change requests from stakeholders\n"
        "- Requirements clarifications in the thread\n"
        "- The most recent email often carries the final decision"
    ),
    'slack': (
        "This content is a Slack conversation. "
        "Pay attention to:\n"
        "- Quick decisions made in thread replies\n"
        "- Emoji reactions that indicate agreement (though not in text)\n"
        "- Links to documents that may contain requirements\n"
        "- Scope changes discussed informally between team members"
    ),
    'raw': (
        "This is raw text content (meeting notes, document, or manual input). "
        "Analyze it carefully for any scope-relevant changes."
    ),
}

MEETING_TYPE_HINTS: Dict[str, str] = {
    'sprint_planning': (
        "This is a sprint planning meeting. Focus on:\n"
        "- User stories being committed to the sprint\n"
        "- Items deferred to future sprints\n"
        "- Scope adjustments for capacity reasons"
    ),
    'standup': (
        "This is a standup meeting. These rarely contain scope changes, "
        "but watch for blockers that may force scope modifications."
    ),
    'retrospective': (
        "This is a retrospective. Watch for:\n"
        "- Process changes that affect scope management\n"
        "- Technical debt items being promoted to scope"
    ),
    'client_review': (
        "This is a client review meeting. Pay close attention to:\n"
        "- New requirements from the client\n"
        "- Feedback on existing features (may lead to modifications)\n"
        "- Items the client wants removed or deferred\n"
        "- Priority changes requested by the client"
    ),
    'kickoff': (
        "This is a project kickoff meeting. Focus on:\n"
        "- Initial requirements and high-level features\n"
        "- Constraints and non-functional requirements\n"
        "- Stakeholder priorities and success criteria"
    ),
    'brainstorm': (
        "This is a brainstorming session. Be EXTRA conservative — "
        "brainstormed ideas are NOT commitments. Only flag items that "
        "were explicitly agreed upon as scope additions."
    ),
    'design_review': (
        "This is a design review meeting. Focus on:\n"
        "- Design decisions that change feature scope\n"
        "- Technical constraints that limit features\n"
        "- UX changes that add or remove requirements"
    ),
    'technical_discussion': (
        "This is a technical discussion. Focus on:\n"
        "- Architecture decisions that affect feature scope\n"
        "- Technical limitations requiring scope adjustments\n"
        "- New technical requirements discovered"
    ),
    'stakeholder_update': (
        "This is a stakeholder update meeting. Focus on:\n"
        "- Priority changes from leadership\n"
        "- New strategic requirements\n"
        "- Items being cut or deferred due to business decisions"
    ),
}


class MeetingNotesParser:
    """
    Service for parsing meeting notes and extracting scope changes.
    Uses format-specific pre-processors and format-aware AI prompts
    to deliver accurate scope analysis from any source type.
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
- For each scope change, set ``decided_by`` to the person who proposed or approved it (if identifiable)
- If no scope changes are detected, return an empty list — that's perfectly fine
- Extract action items separately (these are tasks, not scope changes)
- Note questions that were raised but not resolved

DECISION MAKER IDENTIFICATION:
- Identify the **decision makers** — people who approve, reject, or drive scope decisions
- Distinguish decision makers from observers or note-takers
- Infer their role where possible (Product Owner, CTO, Stakeholder, Tech Lead, etc.)
- For each decision maker, list the specific decisions they drove
- Only include people who clearly influenced decisions, NOT everyone who spoke

METADATA EXTRACTION:
- If you can identify participant names from the content, list them
- If you can identify a date from the content, note it
- If the meeting type is evident from the content, note it

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

    def _build_format_aware_prompt(
        self,
        source: Source,
        cleaned_content: str,
        format_metadata: Dict[str, Any],
        graph_summary: str,
    ) -> str:
        """
        Build a prompt that includes format-specific hints and
        pre-processed content for better AI analysis accuracy.
        """
        source_format = (source.source_metadata or {}).get('source_format', 'raw')
        meeting_type = (source.source_metadata or {}).get('meeting_type', None)

        # Start with format-specific analysis hint
        format_hint = FORMAT_ANALYSIS_HINTS.get(source_format, FORMAT_ANALYSIS_HINTS['raw'])

        # Add meeting type hint if available
        meeting_hint = ""
        if meeting_type and meeting_type in MEETING_TYPE_HINTS:
            meeting_hint = f"\nMEETING TYPE CONTEXT:\n{MEETING_TYPE_HINTS[meeting_type]}\n"

        # Add extracted metadata from the pre-processor
        metadata_section = self._build_metadata_section(source, format_metadata)

        prompt = f"""Analyze the following source and identify scope changes:

SOURCE: {source.source_name}
TYPE: {source.source_type.value}
FORMAT: {source_format}

{metadata_section}

FORMAT-SPECIFIC GUIDANCE:
{format_hint}
{meeting_hint}

--- CONTENT START ---
{cleaned_content}
--- CONTENT END ---

{graph_summary}

Identify all scope changes, action items, and unresolved questions."""

        return prompt

    def _build_metadata_section(
        self,
        source: Source,
        format_metadata: Dict[str, Any],
    ) -> str:
        """Build the metadata section of the prompt from source metadata and parser output."""
        metadata = source.source_metadata or {}
        lines = []

        # Date from metadata or auto-detected
        source_date = metadata.get('date', 'Not specified')
        lines.append(f"DATE: {source_date}")

        # Attendees: from metadata, or auto-detected speakers/participants
        attendees = metadata.get('attendees', '')
        if not attendees:
            # Use speakers/participants from the format parser
            speakers = format_metadata.get('speakers', [])
            participants = format_metadata.get('participants', [])
            detected_people = speakers or participants
            if detected_people:
                attendees = ', '.join(detected_people)
                lines.append(f"PARTICIPANTS (auto-detected): {attendees}")
            else:
                lines.append("PARTICIPANTS: Not specified")
        else:
            lines.append(f"PARTICIPANTS: {attendees}")

        # Meeting type
        meeting_type = metadata.get('meeting_type', None)
        if meeting_type:
            lines.append(f"MEETING TYPE: {meeting_type}")

        # Duration
        duration = metadata.get('duration', None)
        if duration:
            lines.append(f"DURATION: {duration}")

        # Segment/message count from parser
        segment_count = format_metadata.get('segment_count', None)
        message_count = format_metadata.get('message_count', None)
        email_count = format_metadata.get('email_count', None)

        if segment_count:
            lines.append(f"TRANSCRIPT SEGMENTS: {segment_count}")
        elif message_count:
            lines.append(f"MESSAGES: {message_count}")
        elif email_count:
            lines.append(f"EMAILS IN THREAD: {email_count}")

        return '\n'.join(lines)

    async def analyze_source(
        self,
        source_id: UUID,
        database: DBSession,
        user_id=None,
    ) -> List[SourceSuggestion]:
        """
        Analyze a source (meeting notes/document) and generate suggestions.

        Pipeline:
        1. Load source from database
        2. Pre-process content using format-specific parser
        3. Build format-aware prompt with graph context
        4. Run AI analysis
        5. Store suggestions and parsed metadata

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

            # Step 1: Pre-process content with format-specific parser
            source_format = (source.source_metadata or {}).get('source_format', 'raw')
            format_result = preprocess_source_content(
                raw_content=source.raw_content,
                source_format=source_format,
            )
            cleaned_content = format_result.get('cleaned_content', source.raw_content)

            # Step 2: Store auto-detected metadata back to the source
            existing_metadata = source.source_metadata or {}
            existing_metadata['format_parser_output'] = {
                'format_detected': format_result.get('format', source_format),
                'speakers': format_result.get('speakers', []),
                'participants': format_result.get('participants', []),
                'segment_count': format_result.get('segment_count', None),
                'message_count': format_result.get('message_count', None),
                'email_count': format_result.get('email_count', None),
            }

            # Auto-fill attendees if not manually specified
            if not existing_metadata.get('attendees'):
                auto_people = (
                    format_result.get('speakers', [])
                    or format_result.get('participants', [])
                )
                if auto_people:
                    existing_metadata['attendees_auto'] = ', '.join(auto_people)

            source.source_metadata = existing_metadata

            # Step 3: Build graph summary for context
            graph_summary = self._build_graph_summary(source.session_id, database)

            # Step 4: Build format-aware prompt
            user_prompt = self._build_format_aware_prompt(
                source=source,
                cleaned_content=cleaned_content,
                format_metadata=format_result,
                graph_summary=graph_summary,
            )

            # Step 5: Run AI analysis (RISK-2.3C: logged)
            result = await cached_agent_run(
                self.analysis_agent, user_prompt,
                task="meeting_notes", session_id=str(source.session_id),
                user_id=user_id,
            )
            meeting_output = result.output

            logger.info(
                f"Analysis complete: {len(meeting_output.scope_changes)} scope changes, "
                f"{len(meeting_output.action_items)} action items detected"
            )

            # Step 6: Create suggestion records
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

            # Step 7: Update source as processed
            source.is_processed = True
            source.processed_at = datetime.utcnow()
            source.processed_summary = meeting_output.summary

            # Store action items and questions in source metadata
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
