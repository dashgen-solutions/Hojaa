"""
Document AI Service — LLM-powered document generation within the editor.

Users bring their own API keys (stored per-organization in the Integration table).
The service builds a rich system prompt with project context (scope tree, team,
existing document content) and converts LLM markdown responses into BlockNote
JSON blocks that can be inserted directly into the editor.
"""
import asyncio
import json
import re
from datetime import datetime
from typing import Any, Dict, List, Optional, Tuple
from uuid import UUID, uuid4

from sqlalchemy.orm import Session as DBSession

from app.core.config import settings
from app.core.logger import get_logger
from app.models.database import (
    Document,
    DocumentChatMessage,
    Integration,
    IntegrationType,
    Node,
    Session as SessionModel,
    TeamMember,
    User,
    Card,
)

logger = get_logger(__name__)


# ── Markdown → BlockNote JSON conversion ───────────────────────

def _inline_content(text: str) -> List[Dict[str, Any]]:
    """Convert inline markdown (bold, italic, code) to BlockNote inline content."""
    parts: List[Dict[str, Any]] = []
    # Process **bold**, *italic*, `code`
    pattern = re.compile(r'(\*\*(.+?)\*\*)|(`(.+?)`)|(\*(.+?)\*)')
    last = 0
    for m in pattern.finditer(text):
        if m.start() > last:
            parts.append({"type": "text", "text": text[last:m.start()], "styles": {}})
        if m.group(1):  # bold
            parts.append({"type": "text", "text": m.group(2), "styles": {"bold": True}})
        elif m.group(3):  # code
            parts.append({"type": "text", "text": m.group(4), "styles": {"code": True}})
        elif m.group(5):  # italic
            parts.append({"type": "text", "text": m.group(6), "styles": {"italic": True}})
        last = m.end()
    if last < len(text):
        remaining = text[last:]
        if remaining:
            parts.append({"type": "text", "text": remaining, "styles": {}})
    if not parts:
        parts.append({"type": "text", "text": text, "styles": {}})
    return parts


def markdown_to_blocknote(md: str) -> List[Dict[str, Any]]:
    """
    Convert markdown text to BlockNote-compatible JSON blocks.

    Supports: headings, paragraphs, bullet lists, numbered lists, code blocks.
    Best-effort conversion — users can always edit the result in BlockNote.
    """
    blocks: List[Dict[str, Any]] = []
    lines = md.split("\n")
    i = 0

    while i < len(lines):
        line = lines[i]

        # Code block
        if line.strip().startswith("```"):
            code_lines = []
            i += 1
            while i < len(lines) and not lines[i].strip().startswith("```"):
                code_lines.append(lines[i])
                i += 1
            blocks.append({
                "type": "codeBlock",
                "content": [{"type": "text", "text": "\n".join(code_lines), "styles": {}}],
            })
            i += 1
            continue

        # Empty line → skip (don't create empty paragraphs)
        if not line.strip():
            i += 1
            continue

        # Headings
        heading_match = re.match(r'^(#{1,3})\s+(.+)', line)
        if heading_match:
            level = len(heading_match.group(1))
            blocks.append({
                "type": "heading",
                "props": {"level": level},
                "content": _inline_content(heading_match.group(2).strip()),
            })
            i += 1
            continue

        # Bullet list
        bullet_match = re.match(r'^[\s]*[-*]\s+(.+)', line)
        if bullet_match:
            blocks.append({
                "type": "bulletListItem",
                "content": _inline_content(bullet_match.group(1).strip()),
            })
            i += 1
            continue

        # Numbered list
        num_match = re.match(r'^[\s]*\d+\.\s+(.+)', line)
        if num_match:
            blocks.append({
                "type": "numberedListItem",
                "content": _inline_content(num_match.group(1).strip()),
            })
            i += 1
            continue

        # Horizontal rule
        if re.match(r'^---+$|^\*\*\*+$', line.strip()):
            i += 1
            continue

        # Default: paragraph
        blocks.append({
            "type": "paragraph",
            "content": _inline_content(line.strip()),
        })
        i += 1

    return blocks


# ── LLM Client Resolution ─────────────────────────────────────

def _get_llm_config(db: DBSession, user: User) -> Tuple[str, Dict[str, Any]]:
    """
    Resolve the user's organization's LLM integration.

    Returns (provider, config_dict) where provider is 'openai' or 'anthropic'.
    Raises ValueError if no LLM integration is configured.
    """
    if not user.organization_id:
        raise ValueError(
            "No organization found. Please join an organization to use AI features."
        )

    integrations = (
        db.query(Integration)
        .filter(
            Integration.organization_id == user.organization_id,
            Integration.integration_type.in_([
                IntegrationType.LLM_OPENAI,
                IntegrationType.LLM_ANTHROPIC,
            ]),
            Integration.is_active == True,
        )
        .all()
    )

    if not integrations:
        raise ValueError(
            "No AI provider configured. Go to Settings > AI to add your API key."
        )

    # Prefer OpenAI if both are configured (user can change default later)
    for integ in integrations:
        if integ.integration_type == IntegrationType.LLM_OPENAI:
            config = integ.config or {}
            if config.get("api_key"):
                return ("openai", config)

    for integ in integrations:
        if integ.integration_type == IntegrationType.LLM_ANTHROPIC:
            config = integ.config or {}
            if config.get("api_key"):
                return ("anthropic", config)

    raise ValueError(
        "AI provider is configured but missing an API key. Go to Settings > AI to update."
    )


# ── Project Context Builder ───────────────────────────────────

def _build_project_context(db: DBSession, document: Document) -> str:
    """Build a context string with project data for the system prompt."""
    session = db.query(SessionModel).filter(
        SessionModel.id == document.session_id
    ).first()

    project_name = session.document_filename or "Untitled" if session else "Unknown"

    # Scope tree (limited)
    nodes = (
        db.query(Node)
        .filter(Node.session_id == document.session_id)
        .order_by(Node.depth, Node.order_index)
        .limit(100)
        .all()
    )

    scope_lines = []
    for n in nodes:
        indent = "  " * (n.depth or 0)
        status = n.status.value if n.status else "unknown"
        ntype = n.node_type.value if n.node_type else "item"
        desc_preview = (n.answer or "")[:80].replace("\n", " ")
        scope_lines.append(f"{indent}- [{ntype}] {n.question} ({status}){': ' + desc_preview if desc_preview else ''}")

    # Team
    team = (
        db.query(TeamMember)
        .filter(TeamMember.session_id == document.session_id)
        .all()
    )
    team_lines = [f"- {m.name} ({m.role})" for m in team]

    # Cards summary
    cards = (
        db.query(Card)
        .filter(Card.session_id == document.session_id)
        .limit(50)
        .all()
    )
    card_lines = []
    for c in cards:
        status = c.status.value if c.status else "unknown"
        hours = f", {c.estimated_hours}h" if c.estimated_hours else ""
        card_lines.append(f"- {c.title} ({status}{hours})")

    # Current document content summary
    doc_content_summary = ""
    if document.content and isinstance(document.content, list) and len(document.content) > 0:
        # Extract text from blocks for context
        text_parts = []
        for block in document.content[:20]:  # first 20 blocks
            if isinstance(block, dict):
                content = block.get("content", [])
                if isinstance(content, list):
                    for item in content:
                        if isinstance(item, dict) and item.get("text"):
                            text_parts.append(item["text"])
        if text_parts:
            doc_content_summary = "\n".join(text_parts[:30])

    context = f"""PROJECT: {project_name}
Document Title: {document.title}
Document Status: {document.status}

SCOPE TREE ({len(nodes)} items):
{chr(10).join(scope_lines) if scope_lines else "No scope items yet."}

TEAM ({len(team)} members):
{chr(10).join(team_lines) if team_lines else "No team members yet."}

PLANNING CARDS ({len(cards)} cards):
{chr(10).join(card_lines) if card_lines else "No planning cards yet."}"""

    if doc_content_summary:
        context += f"\n\nCURRENT DOCUMENT CONTENT:\n{doc_content_summary}"

    return context


# ── System Prompt ──────────────────────────────────────────────

SYSTEM_PROMPT_TEMPLATE = """You are an AI document assistant for MoMetric, a project management platform. You help users generate professional business documents: proposals, statements of work (SOW), contracts, NDAs, invoices, and scope documents.

You have access to the following project context:

{context}

INSTRUCTIONS:
- Generate well-structured, professional document content in markdown format
- Use the project's actual data (scope tree items, team members, cards) when relevant
- Use appropriate headings (# ## ###), bullet points, numbered lists for structure
- When asked about pricing, use the planning cards' estimated hours to calculate costs
- Keep the language professional and suitable for client-facing documents
- If the user asks you to reference specific scope items, include their details
- You can extend or modify existing document content when asked
- Be concise but thorough — generate content ready to be inserted into a document

FORMATTING:
- Use markdown formatting (headings, bold, italic, bullet lists, numbered lists)
- Use ## for major sections, ### for subsections
- Use **bold** for emphasis on important terms
- Structure content logically with clear sections"""


# ── Main Service Function ──────────────────────────────────────

async def generate_document_content(
    db: DBSession,
    document_id: UUID,
    user_message: str,
    user: User,
) -> Dict[str, Any]:
    """
    Process a user's chat message and generate document content.

    Returns:
        {
            "message_id": str,
            "response": str,          # AI response text (markdown)
            "blocks": list,           # BlockNote JSON blocks
            "provider": str,          # "openai" or "anthropic"
            "model": str,             # model used
        }
    """
    # 1. Fetch document
    document = db.query(Document).filter(Document.id == document_id).first()
    if not document:
        raise ValueError("Document not found.")

    # 2. Resolve LLM provider
    provider, config = _get_llm_config(db, user)

    # 3. Build system prompt with project context
    context = _build_project_context(db, document)
    system_prompt = SYSTEM_PROMPT_TEMPLATE.format(context=context)

    # 4. Load chat history for this document (last 20 messages)
    history = (
        db.query(DocumentChatMessage)
        .filter(DocumentChatMessage.document_id == document_id)
        .order_by(DocumentChatMessage.created_at.asc())
        .all()
    )

    # 5. Build conversation messages
    messages = []
    for msg in history[-20:]:
        messages.append({"role": msg.role, "content": msg.content})
    messages.append({"role": "user", "content": user_message})

    # 6. Call LLM
    response_text = ""
    model_used = ""

    try:
        if provider == "openai":
            response_text, model_used = await _call_openai(
                config, system_prompt, messages
            )
        elif provider == "anthropic":
            response_text, model_used = await _call_anthropic(
                config, system_prompt, messages
            )
    except Exception as e:
        logger.error(f"LLM API error ({provider}): {e}")
        raise ValueError(f"AI generation failed: {str(e)}")

    # 7. Convert markdown response to BlockNote blocks
    blocks = markdown_to_blocknote(response_text)

    # 8. Save chat messages (user + assistant)
    user_msg = DocumentChatMessage(
        id=uuid4(),
        document_id=document_id,
        role="user",
        content=user_message,
    )
    assistant_msg = DocumentChatMessage(
        id=uuid4(),
        document_id=document_id,
        role="assistant",
        content=response_text,
        generated_blocks=blocks,
    )
    db.add(user_msg)
    db.add(assistant_msg)
    db.commit()

    return {
        "message_id": str(assistant_msg.id),
        "response": response_text,
        "blocks": blocks,
        "provider": provider,
        "model": model_used,
    }


async def _call_openai(
    config: Dict[str, Any],
    system_prompt: str,
    messages: List[Dict[str, str]],
) -> Tuple[str, str]:
    """Call OpenAI API with the org's API key."""
    import openai

    client = openai.AsyncOpenAI(api_key=config["api_key"])
    model = config.get("model", "gpt-4o")

    full_messages = [{"role": "system", "content": system_prompt}] + messages

    response = await asyncio.wait_for(
        client.chat.completions.create(
            model=model,
            messages=full_messages,
            temperature=0.5,
            max_tokens=4000,
        ),
        timeout=120,
    )

    content = response.choices[0].message.content or ""
    return (content, model)


async def _call_anthropic(
    config: Dict[str, Any],
    system_prompt: str,
    messages: List[Dict[str, str]],
) -> Tuple[str, str]:
    """Call Anthropic API with the org's API key."""
    import anthropic

    client = anthropic.AsyncAnthropic(api_key=config["api_key"])
    model = config.get("model", "claude-sonnet-4-20250514")

    response = await asyncio.wait_for(
        asyncio.to_thread(
            lambda: anthropic.Anthropic(api_key=config["api_key"]).messages.create(
                model=model,
                system=system_prompt,
                messages=messages,
                max_tokens=4000,
                temperature=0.5,
            )
        ),
        timeout=120,
    )

    content = response.content[0].text if response.content else ""
    return (content, model)


# ── Chat History Helpers ───────────────────────────────────────

def get_chat_history(db: DBSession, document_id: UUID) -> List[Dict[str, Any]]:
    """Get chat history for a document."""
    messages = (
        db.query(DocumentChatMessage)
        .filter(DocumentChatMessage.document_id == document_id)
        .order_by(DocumentChatMessage.created_at.asc())
        .all()
    )
    return [
        {
            "id": str(msg.id),
            "role": msg.role,
            "content": msg.content,
            "generated_blocks": msg.generated_blocks,
            "created_at": msg.created_at.isoformat() if msg.created_at else None,
        }
        for msg in messages
    ]


def clear_chat_history(db: DBSession, document_id: UUID) -> None:
    """Clear all chat messages for a document."""
    db.query(DocumentChatMessage).filter(
        DocumentChatMessage.document_id == document_id
    ).delete()
    db.commit()
