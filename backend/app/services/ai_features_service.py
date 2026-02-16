"""
AI-3.1  Smart status suggestions
AI-3.3  AI-powered acceptance criteria generation
AI-3.4  Export document structuring (AI-enhanced)
AI-3.5  Executive summary generation for exports

All "Phase 2-5 AI features" live here so routes can import one service.
"""
from typing import Dict, Any, List, Optional
from uuid import UUID
from sqlalchemy.orm import Session as DBSession
from app.services.agent_service import (
    create_requirements_agent,
    cached_agent_run,
)
from app.models.agent_models import (
    StatusSuggestionsOutput,
    ACGenerationOutput,
    ExportSummaryOutput,
)
from app.models.database import Node, NodeStatus, NodeHistory, ChangeType
from app.core.config import settings
from app.core.logger import get_logger

logger = get_logger(__name__)


# ─────────────────────────────────────────────────────────────
#  AI-3.1 — Smart status suggestions
# ─────────────────────────────────────────────────────────────

_STATUS_SUGGEST_AGENT = create_requirements_agent(
    system_prompt=(
        "You are a scope-management assistant. Given a node's title, "
        "description, its children's statuses, recent audit history, and "
        "its planning-board column, suggest the most appropriate lifecycle "
        "status.\n\n"
        "Valid statuses: active, deferred, completed, removed, new, modified.\n"
        "Return 1-3 suggestions ordered by confidence."
    ),
    output_type=StatusSuggestionsOutput,
    task="status_suggest",
)


async def suggest_status(
    database: DBSession,
    node_id: UUID,
) -> List[Dict[str, Any]]:
    """
    Return AI-recommended status(es) for a node based on its
    context (children, audit trail, linked planning card).
    """
    node = database.query(Node).filter(Node.id == node_id).first()
    if not node:
        raise ValueError("Node not found")

    # Gather context
    children = database.query(Node).filter(Node.parent_id == node_id).all()
    child_statuses = [c.status.value for c in children] if children else ["none"]

    recent_history = (
        database.query(NodeHistory)
        .filter(NodeHistory.node_id == node_id)
        .order_by(NodeHistory.changed_at.desc())
        .limit(5)
        .all()
    )
    history_lines = [
        f"{h.change_type.value}: {h.field_changed}={h.new_value}"
        for h in recent_history
    ] or ["No history"]

    # Check planning card
    from app.models.database import Card
    card = database.query(Card).filter(Card.node_id == str(node_id)).first()
    card_col = card.column if card else "none"

    prompt = (
        f"Node: {node.question}\n"
        f"Description: {node.answer or 'N/A'}\n"
        f"Current status: {node.status.value}\n"
        f"Planning column: {card_col}\n"
        f"Children statuses: {', '.join(child_statuses)}\n"
        f"Recent history:\n" + "\n".join(history_lines)
    )

    result = await cached_agent_run(
        _STATUS_SUGGEST_AGENT,
        prompt,
        model_name="status_suggest",
        cache_ttl=settings.cache_ttl_seconds,
    )
    return [s.model_dump() for s in result.output.suggestions]


# ─────────────────────────────────────────────────────────────
#  AI-3.3 — Acceptance criteria generation
# ─────────────────────────────────────────────────────────────

_AC_AGENT = create_requirements_agent(
    system_prompt=(
        "You are a QA specialist. Given a feature's title, description, "
        "and the hierarchical context of the project, generate clear, "
        "testable acceptance criteria.\n\n"
        "Each AC must be:\n"
        "- Specific and unambiguous\n"
        "- Verifiable (pass/fail)\n"
        "- Scoped to the feature (not generic boilerplate)\n\n"
        "Assign a MoSCoW priority to each: must, should, or could.\n"
        "Generate 3-8 criteria depending on the feature's complexity."
    ),
    output_type=ACGenerationOutput,
    task="ac_generate",
)


async def generate_acceptance_criteria(
    database: DBSession,
    node_id: UUID,
) -> List[Dict[str, Any]]:
    """
    AI-generate acceptance criteria for a node/card.
    """
    node = database.query(Node).filter(Node.id == node_id).first()
    if not node:
        raise ValueError("Node not found")

    # Build hierarchy context
    hierarchy = []
    current = node
    while current:
        hierarchy.append(f"{'  ' * current.depth}{current.question}")
        if current.parent_id:
            current = database.query(Node).filter(Node.id == current.parent_id).first()
        else:
            break
    hierarchy.reverse()

    prompt = (
        f"Feature: {node.question}\n"
        f"Description: {node.answer or 'No description'}\n\n"
        f"Project hierarchy:\n" + "\n".join(hierarchy)
    )

    result = await cached_agent_run(
        _AC_AGENT,
        prompt,
        model_name="ac_generate",
        cache_ttl=settings.cache_ttl_seconds,
    )
    return [ac.model_dump() for ac in result.output.acceptance_criteria]


# ─────────────────────────────────────────────────────────────
#  AI-3.4 / AI-3.5 — Export summary & structuring
# ─────────────────────────────────────────────────────────────

_SUMMARY_AGENT = create_requirements_agent(
    system_prompt=(
        "You are a technical writer producing a professional executive "
        "summary for a scope document. Given the full list of scope items, "
        "their statuses, and any deferred items, write:\n\n"
        "1. An executive summary (3-5 paragraphs) covering project purpose, "
        "   key capabilities, current status, and next steps.\n"
        "2. Top 3-5 recurring themes.\n"
        "3. Key risks or open questions.\n\n"
        "Write in a clear, business-friendly tone.  Do NOT repeat every "
        "scope item — synthesise and summarise."
    ),
    output_type=ExportSummaryOutput,
    task="summary",
)


async def generate_export_summary(
    database: DBSession,
    session_id: UUID,
) -> Dict[str, Any]:
    """
    Generate an AI executive summary for an export document.
    """
    nodes = (
        database.query(Node)
        .filter(Node.session_id == session_id)
        .order_by(Node.depth, Node.order_index)
        .all()
    )
    if not nodes:
        return {
            "executive_summary": "No scope items available.",
            "key_themes": [],
            "risk_highlights": [],
        }

    # Build concise scope overview for the AI
    lines = []
    for n in nodes:
        indent = "  " * n.depth
        status_tag = f"[{n.status.value}]" if n.status != NodeStatus.ACTIVE else ""
        lines.append(f"{indent}- {n.question} {status_tag}")
        if n.answer:
            lines.append(f"{indent}  {n.answer[:200]}")

    deferred = [n for n in nodes if n.status == NodeStatus.DEFERRED]
    deferred_section = ""
    if deferred:
        deferred_section = "\n\nDEFERRED ITEMS:\n" + "\n".join(
            f"- {d.question}" for d in deferred
        )

    prompt = (
        f"SCOPE ITEMS ({len(nodes)} total):\n"
        + "\n".join(lines)
        + deferred_section
    )

    result = await cached_agent_run(
        _SUMMARY_AGENT,
        prompt,
        model_name="summary",
        cache_ttl=settings.cache_ttl_seconds,
    )
    return result.output.model_dump()
