"""
SVC-2.2 — Scope Change Detector Service.

Dedicated service for analyzing content and detecting scope changes.
Extracts scope-change detection logic from MeetingNotesParser into
a reusable, independently testable service.

Capabilities:
- Analyze any text content for scope changes (add / modify / defer / remove)
- Assign confidence scores (0–1) per change
- Extract supporting quotes from source material
- Detect action items and unresolved questions
- Provide graph-context-aware analysis via current-state summary
"""
from typing import List, Dict, Any, Optional
from uuid import UUID
from datetime import datetime
from sqlalchemy.orm import Session as DBSession
from app.services.agent_service import create_requirements_agent, cached_agent_run
from app.models.agent_models import MeetingNotesOutput
from app.models.database import (
    Node, NodeType, Source, SourceSuggestion
)
from app.core.logger import get_logger

logger = get_logger(__name__)


# ── Status-transition rules ──────────────────────────────────────
# Maps change_type → the NodeStatus that should be applied.
CHANGE_TYPE_TO_STATUS = {
    "add": "new",
    "modify": "modified",
    "defer": "deferred",
    "remove": "removed",
}


class ScopeChangeDetector:
    """
    Analyses arbitrary text against the current project graph and
    returns a list of detected scope changes with confidence scores.
    """

    def __init__(self):
        self._agent = create_requirements_agent(
            system_prompt=self._system_prompt(),
            output_type=MeetingNotesOutput,
        )

    # ── Public API ───────────────────────────────────────────────

    async def detect_changes(
        self,
        content: str,
        session_id: UUID,
        database: DBSession,
        source_name: Optional[str] = None,
        format_hint: Optional[str] = None,
        meeting_type_hint: Optional[str] = None,
        min_confidence: float = 0.0,
    ) -> Dict[str, Any]:
        """
        Analyse *content* for scope changes relative to the graph of *session_id*.

        Args:
            content:            The text to analyse (already cleaned/pre-processed).
            session_id:         Session whose graph provides context.
            database:           DB session.
            source_name:        Human-readable origin label (optional).
            format_hint:        Extra guidance for the AI about the content format.
            meeting_type_hint:  Extra guidance about the meeting type.
            min_confidence:     Drop changes below this confidence threshold.

        Returns:
            {
                "scope_changes": [ {change_type, title, description, confidence, …} ],
                "action_items":  [str],
                "questions_raised": [str],
                "summary": str,
            }
        """
        graph_summary = self._build_graph_summary(session_id, database)

        user_prompt = self._build_prompt(
            content=content,
            source_name=source_name or "Unnamed source",
            format_hint=format_hint,
            meeting_type_hint=meeting_type_hint,
            graph_summary=graph_summary,
        )

        result = await cached_agent_run(
            self._agent, user_prompt, task="scope_change",
            session_id=session_id,
        )
        output: MeetingNotesOutput = result.output

        changes = []
        for sc in output.scope_changes:
            if sc.confidence < min_confidence:
                continue
            changes.append({
                "change_type": sc.change_type,
                "target_node_id": str(sc.target_node_id) if sc.target_node_id else None,
                "parent_node_id": str(sc.parent_node_id) if sc.parent_node_id else None,
                "title": sc.title,
                "description": sc.description,
                "acceptance_criteria": sc.acceptance_criteria or [],
                "confidence": sc.confidence,
                "reasoning": sc.reasoning,
                "source_quote": sc.source_quote,
                "implied_status": CHANGE_TYPE_TO_STATUS.get(sc.change_type),
            })

        logger.info(
            f"ScopeChangeDetector: {len(changes)} changes "
            f"(≥{min_confidence} conf) from {len(output.scope_changes)} raw"
        )

        return {
            "scope_changes": changes,
            "action_items": output.action_items,
            "questions_raised": output.questions_raised,
            "summary": output.summary,
        }

    async def create_suggestions_from_changes(
        self,
        changes: List[Dict[str, Any]],
        source_id: UUID,
        database: DBSession,
    ) -> List[SourceSuggestion]:
        """
        Persist a list of detected changes as SourceSuggestion rows.

        Args:
            changes:   Output of ``detect_changes()["scope_changes"]``.
            source_id: The source these changes belong to.
            database:  DB session (caller must commit).

        Returns:
            List of newly-created SourceSuggestion objects.
        """
        suggestions: List[SourceSuggestion] = []
        for ch in changes:
            sug = SourceSuggestion(
                source_id=source_id,
                change_type=ch["change_type"],
                target_node_id=ch.get("target_node_id"),
                parent_node_id=ch.get("parent_node_id"),
                title=ch["title"],
                description=ch.get("description"),
                acceptance_criteria=ch.get("acceptance_criteria", []),
                confidence=ch.get("confidence", 0.5),
                reasoning=ch.get("reasoning"),
                source_quote=ch.get("source_quote"),
            )
            database.add(sug)
            suggestions.append(sug)
        return suggestions

    # ── Internals ────────────────────────────────────────────────

    @staticmethod
    def _system_prompt() -> str:
        return """You are a scope analyst for software projects.

Given text content and the current project scope graph, identify any scope changes.

RULES:
- Be CONSERVATIVE: only flag clear scope changes, not general discussion.
- Include the EXACT QUOTE that supports each change.
- Assign a confidence score (0-1) based on clarity.
- For "add": identify the best parent node.
- For "modify": identify the exact node and what changed.
- For "defer": identify items pushed to later phases.
- For "remove": identify items explicitly dropped.
- Empty list is fine when no changes are detected.
- Extract action items separately (tasks, not scope changes).
- Note unresolved questions.

Always prioritise precision over recall."""

    def _build_graph_summary(self, session_id: UUID, database: DBSession) -> str:
        nodes = (
            database.query(Node)
            .filter(Node.session_id == session_id)
            .order_by(Node.depth, Node.order_index)
            .all()
        )
        if not nodes:
            return "No existing scope items. This is a new project."

        lines = ["CURRENT PROJECT SCOPE:", ""]
        for node in nodes:
            indent = "  " * node.depth
            status = f" [{node.status.value}]" if node.status else ""
            lines.append(f"{indent}• [{node.node_type.value.upper()}] {node.question}{status}")
            lines.append(f"{indent}  ID: {node.id}")
            if node.answer:
                short = node.answer[:200] + "..." if len(node.answer) > 200 else node.answer
                lines.append(f"{indent}  Description: {short}")
            lines.append("")
        return "\n".join(lines)

    @staticmethod
    def _build_prompt(
        content: str,
        source_name: str,
        format_hint: Optional[str],
        meeting_type_hint: Optional[str],
        graph_summary: str,
    ) -> str:
        parts = [
            f"Analyse the following source and identify scope changes:\n",
            f"SOURCE: {source_name}",
        ]
        if format_hint:
            parts.append(f"\nFORMAT GUIDANCE:\n{format_hint}")
        if meeting_type_hint:
            parts.append(f"\nMEETING TYPE:\n{meeting_type_hint}")
        parts.append(f"\n--- CONTENT START ---\n{content}\n--- CONTENT END ---\n")
        parts.append(graph_summary)
        parts.append("\nIdentify all scope changes, action items, and unresolved questions.")
        return "\n".join(parts)


# Global instance
scope_change_detector = ScopeChangeDetector()
