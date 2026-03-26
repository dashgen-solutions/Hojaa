"""
Document AI Service — LLM-powered document generation within the editor.

Users bring their own API keys (stored per-organization in the Integration table).
Falls back to platform API key for free-tier users with usage limits.
The service builds a rich system prompt with project context (scope tree, team,
existing document content) and converts LLM markdown responses into BlockNote
JSON blocks that can be inserted directly into the editor.

Supports Mermaid diagram generation — the AI can produce ```mermaid blocks that
are stored as special "mermaid" block types for client-side rendering.
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


# ── Table Cell Text Extraction ─────────────────────────────────

def _extract_cell_text(cell) -> str:
    """Extract plain text from a table cell in any format.

    Handles:
    - Array of inline content: [{"type": "text", "text": "...", "styles": {}}]
    - Single inline object: {"type": "text", "text": "..."}
    - Object with content array: {"content": [{"type": "text", "text": "..."}]}
    - Nested array: [[{"type": "text", "text": "..."}]]
    - Plain string
    """
    if cell is None:
        return ""
    if isinstance(cell, str):
        return cell
    if isinstance(cell, list):
        # Nested array [[...]]
        if cell and isinstance(cell[0], list):
            return _extract_cell_text(cell[0])
        # Array of inline content dicts
        parts = []
        for item in cell:
            if isinstance(item, dict):
                parts.append(item.get("text", ""))
            elif isinstance(item, str):
                parts.append(item)
        return "".join(parts)
    if isinstance(cell, dict):
        # Object with content property (BlockNote cell wrapper)
        if "content" in cell:
            return _extract_cell_text(cell["content"])
        # Single inline content object
        return cell.get("text", "")
    return str(cell)


# ── BlockNote → Markdown (for AI context) ──────────────────────

def _blocks_to_markdown(blocks: list) -> str:
    """Convert BlockNote JSON blocks back to markdown for AI context."""
    parts: List[str] = []
    for block in blocks:
        if not isinstance(block, dict):
            continue
        btype = block.get("type", "paragraph")
        content = block.get("content", [])
        props = block.get("props", {})

        # Extract inline text from content array
        text = ""
        if isinstance(content, list):
            for item in content:
                if isinstance(item, dict):
                    t = item.get("text", "")
                    styles = item.get("styles", {})
                    if styles.get("bold"):
                        t = f"**{t}**"
                    if styles.get("italic"):
                        t = f"*{t}*"
                    if styles.get("code"):
                        t = f"`{t}`"
                    text += t
        elif isinstance(content, dict):
            # Table content
            ctype = content.get("type", "")
            if ctype == "tableContent":
                rows = content.get("rows", [])
                for ri, row in enumerate(rows):
                    cells = row.get("cells", [])
                    cell_texts = []
                    for cell in cells:
                        cell_texts.append(_extract_cell_text(cell))
                    parts.append("| " + " | ".join(cell_texts) + " |")
                    if ri == 0:
                        parts.append("| " + " | ".join(["---"] * len(cell_texts)) + " |")
                continue

        if btype == "heading":
            level = props.get("level", 1)
            parts.append(f"{'#' * level} {text}")
        elif btype == "bulletListItem":
            parts.append(f"- {text}")
        elif btype == "numberedListItem":
            parts.append(f"1. {text}")
        elif btype == "codeBlock":
            lang = props.get("language", "")
            parts.append(f"```{lang}\n{text}\n```")
        elif btype == "mermaid":
            # Legacy mermaid blocks
            code = props.get("code", "")
            parts.append(f"```mermaid\n{code}\n```")
        elif btype == "table":
            pass  # already handled above via tableContent
        else:
            if text:
                parts.append(text)

        # Recurse into children
        children = block.get("children", [])
        if children:
            child_md = _blocks_to_markdown(children)
            if child_md:
                for cl in child_md.split("\n"):
                    parts.append(f"  {cl}")

    return "\n".join(parts)


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

    Supports: headings, paragraphs, bullet lists, numbered lists, code blocks,
    Mermaid diagram blocks (```mermaid ... ```).
    Best-effort conversion — users can always edit the result in BlockNote.
    """
    blocks: List[Dict[str, Any]] = []
    lines = md.split("\n")
    i = 0

    while i < len(lines):
        line = lines[i]

        # Code block (including Mermaid diagrams)
        if line.strip().startswith("```"):
            lang = line.strip()[3:].strip().lower()
            code_lines = []
            i += 1
            while i < len(lines) and not lines[i].strip().startswith("```"):
                code_lines.append(lines[i])
                i += 1

            if lang == "mermaid":
                # Store as a special mermaid block — frontend has a custom block spec
                blocks.append({
                    "type": "mermaid",
                    "props": {
                        "code": "\n".join(code_lines),
                    },
                    "content": [],
                })
            else:
                blocks.append({
                    "type": "codeBlock",
                    "props": {"language": lang or ""},
                    "content": [{"type": "text", "text": "\n".join(code_lines), "styles": {}}],
                })
            i += 1
            continue

        # Empty line → skip (don't create empty paragraphs)
        if not line.strip():
            i += 1
            continue

        # Table (pipe-delimited markdown table)
        if line.strip().startswith("|") and "|" in line.strip()[1:]:
            table_lines = []
            while i < len(lines) and lines[i].strip().startswith("|"):
                table_lines.append(lines[i])
                i += 1

            # Parse table rows, skip separator lines (|---|---|)
            rows = []
            for tl in table_lines:
                stripped = tl.strip()
                # Remove leading/trailing pipes and split
                inner = stripped.strip("|")
                # Skip separator lines like ---|---
                if re.match(r'^[\s\-:|]+$', inner):
                    continue
                cells = [c.strip() for c in inner.split("|")]
                row_cells = []
                for cell in cells:
                    row_cells.append(_inline_content(cell) if cell else [{"type": "text", "text": "", "styles": {}}])
                rows.append({"cells": row_cells})

            if rows:
                blocks.append({
                    "type": "table",
                    "content": {
                        "type": "tableContent",
                        "rows": rows,
                    },
                })
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

    Returns (provider, config_dict) where provider is 'openai', 'anthropic', or 'gemini'.
    Falls back to platform OpenAI key when no user integration is configured.
    Raises ValueError only when neither user nor platform key is available.
    """
    # Try user's organization integration first (priority: OpenAI > Anthropic > Gemini)
    if user.organization_id:
        integrations = (
            db.query(Integration)
            .filter(
                Integration.organization_id == user.organization_id,
                Integration.integration_type.in_([
                    IntegrationType.LLM_OPENAI,
                    IntegrationType.LLM_ANTHROPIC,
                    IntegrationType.LLM_GEMINI,
                ]),
                Integration.is_active == True,
            )
            .all()
        )

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

        for integ in integrations:
            if integ.integration_type == IntegrationType.LLM_GEMINI:
                config = integ.config or {}
                if config.get("api_key"):
                    return ("gemini", config)

    # Fallback: platform OpenAI key (for free-tier users)
    platform_key = getattr(settings, "platform_openai_api_key", None) or ""
    if platform_key:
        logger.info(f"Using platform API key for user {user.id} (no org integration)")
        return ("openai", {
            "api_key": platform_key,
            "model": "gpt-4o-mini",  # cost-effective for free tier
        })

    raise ValueError(
        "No AI provider configured. Go to Settings > AI to add your API key."
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
    team_lines = []
    for m in team:
        extra = []
        if hasattr(m, 'email') and m.email:
            extra.append(m.email)
        if hasattr(m, 'hourly_rate') and m.hourly_rate:
            extra.append(f"${m.hourly_rate}/hr")
        suffix = f" — {', '.join(extra)}" if extra else ""
        team_lines.append(f"- {m.name} ({m.role}){suffix}")

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

    # Current document content — send FULL content as markdown so AI knows what exists
    doc_content_md = ""
    if document.content and isinstance(document.content, list) and len(document.content) > 0:
        doc_content_md = _blocks_to_markdown(document.content)
        # Truncate if extremely long to stay within token limits
        if len(doc_content_md) > 50000:
            doc_content_md = doc_content_md[:50000] + "\n... [document continues, truncated for brevity]"

    context = f"""PROJECT: {project_name}
Document Title: {document.title}
Document Status: {document.status}

SCOPE TREE ({len(nodes)} items):
{chr(10).join(scope_lines) if scope_lines else "No scope items yet."}

TEAM ({len(team)} members):
{chr(10).join(team_lines) if team_lines else "No team members yet."}

PLANNING CARDS ({len(cards)} cards):
{chr(10).join(card_lines) if card_lines else "No planning cards yet."}"""

    if doc_content_md:
        context += f"""

═══ CURRENT DOCUMENT CONTENT (already in the editor) ═══
{doc_content_md}
═══ END OF CURRENT DOCUMENT ═══"""
    else:
        context += "\n\nCURRENT DOCUMENT: Empty — no content yet."

    return context


# ── System Prompt ──────────────────────────────────────────────

SYSTEM_PROMPT_TEMPLATE = """You are an AI document assistant for Hojaa, a project management platform. You help users create and edit professional business documents: proposals, SOWs, contracts, NDAs, project plans, and technical specifications.

Project context:
{context}

═══ HOW YOU WORK ═══

When the user asks you to CREATE, EDIT, ADD, DELETE, MOVE, REMOVE, or MODIFY document content in ANY way, you MUST IMMEDIATELY return the **COMPLETE** updated document wrapped in markers:

---DOCUMENT_START---
(The FULL updated document in markdown with ALL changes already applied)
---DOCUMENT_END---

⚠️ ACT IMMEDIATELY — NEVER say "I will do X" or "Let me do X". Just DO IT in your FIRST response.
⚠️ EVERY request that changes the document MUST include the markers with the FULL updated document.
⚠️ If the user says "remove X" or "delete X" or "add X" or "move X" — that is a document change. Output the markers NOW.

You may include ONE brief sentence before the markers describing what changed. Then the markers with the full document. Nothing else.

═══ WHAT COUNTS AS A DOCUMENT CHANGE (must use markers) ═══

ANY of these words/intents from the user means you MUST output document markers:
- add, create, write, generate, include, insert, put, draft
- remove, delete, take out, drop, get rid of
- move, reorder, swap, put X before/after Y, rearrange
- update, change, modify, edit, rewrite, improve, fix, revise
- "do it", "yes", "go ahead", "ok" (after discussing a potential change)

═══ EDITING THE DOCUMENT ═══

- **Add content**: Include the new section at the correct position within the full document
- **Delete / remove content**: Simply OMIT that section entirely from the output
- **Move / reorder content**: Place the section at its new position within the full document
- **Modify content**: Change the text while preserving everything else EXACTLY as-is
- **Generate from scratch**: When the document is empty, create the full document

The document between the markers must be COMPLETE — every section that should remain MUST be present. Any section you omit WILL BE DELETED from the document. This is how deletions work.

═══ CHAT-ONLY RESPONSES (no markers) ═══

ONLY respond WITHOUT markers when the user is asking a pure question that does NOT require document changes:
- "What does this section mean?"
- "How should I structure a proposal?"
- "Explain the timeline"

═══ FORMATTING ═══

- Use ## for major sections, ### for subsections
- Use **bold** for emphasis, bullet points and numbered lists for structure
- Use markdown pipe tables (| col1 | col2 |) for structured data
- Keep language professional and client-facing
- Use the project's actual data (scope tree, team members, cards) when relevant

═══ DIAGRAMS ═══

When asked for diagrams, flowcharts, timelines, or visuals, generate Mermaid syntax in ```mermaid code blocks. The editor renders these as live interactive diagrams.

Supported: flowcharts (graph TD/LR), sequence diagrams, Gantt charts, pie charts, mindmaps, class diagrams, state diagrams, ER diagrams.

Always place diagrams inside a section with a heading:
### Project Flowchart
```mermaid
graph TD
    A[Start] --> B[Step 1]
```

═══ CRITICAL RULES ═══

1. ACT ON THE FIRST REQUEST — never say "I will" without immediately doing it
2. ALWAYS include ALL existing sections that should remain (omitted = deleted)
3. Preserve EXACT text, formatting, and structure for sections you are NOT changing
4. NEVER describe actions inside the document body — just make the changes
5. Keep your pre-marker explanation to ONE sentence maximum
6. When in doubt about whether to output markers, OUTPUT THEM — it's better to act than to ask"""


# ── Smart Apply Prompt ─────────────────────────────────────────

APPLY_SYSTEM_PROMPT = """You are a document editor AI. You receive a full document (as a JSON array of BlockNote blocks) and a set of new content blocks to merge in.

Your job is to produce a COMPLETE updated document by intelligently merging the new content INTO the existing document at the most appropriate locations.

RULES:
1. Return ONLY valid JSON — a single array of BlockNote blocks representing the full updated document.
2. Place new content where it logically belongs based on headings, topic, and document structure.
3. If the new content has headings that match existing sections, REPLACE or UPDATE those sections.
4. If the new content covers a new topic, INSERT it at the most logical position.
5. If the new content has multiple sections (multiple headings), distribute them to the appropriate places throughout the document.
6. Preserve all existing content that is NOT being replaced.
7. Do NOT add any explanation or markdown — return ONLY the JSON array.
8. If the existing document is empty, just return the new content blocks as-is.

Each block has this structure:
{{"type": "paragraph"|"heading"|"bulletListItem"|"numberedListItem"|"codeBlock"|"mermaid", "props": {{}}, "content": [{{"type":"text","text":"...","styles":{{}}}}], "children": []}}

Heading blocks have props: {{"level": 1|2|3}}"""


# ── Main Service Function ──────────────────────────────────────

def _extract_document_content(response_text: str) -> Tuple[str, str]:
    """
    Extract document content from AI response using ---DOCUMENT_START---/---DOCUMENT_END--- markers.

    Returns (chat_text, document_markdown).
    - If markers found: chat_text is the explanation outside markers, document_markdown is the full doc.
    - If no markers: chat_text is the full response, document_markdown is empty (chat-only response).
    """
    start_marker = "---DOCUMENT_START---"
    end_marker = "---DOCUMENT_END---"

    start_idx = response_text.find(start_marker)
    end_idx = response_text.find(end_marker)

    if start_idx == -1 or end_idx == -1 or end_idx <= start_idx:
        # No valid markers — treat as chat-only response (question/explanation)
        return response_text.strip(), ""

    chat_before = response_text[:start_idx].strip()
    doc_content = response_text[start_idx + len(start_marker):end_idx].strip()
    chat_after = response_text[end_idx + len(end_marker):].strip()

    chat_text = "\n\n".join(filter(None, [chat_before, chat_after])).strip()

    return chat_text, doc_content


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
        elif provider == "gemini":
            response_text, model_used = await _call_gemini(
                config, system_prompt, messages
            )
        else:
            raise ValueError(f"Unknown AI provider: {provider}")
    except Exception as e:
        logger.error(f"LLM API error ({provider}): {e}")
        raise ValueError(f"AI generation failed: {str(e)}")

    # 7. Extract document content from response markers
    chat_text, doc_markdown = _extract_document_content(response_text)

    # 8. Convert document markdown to BlockNote blocks (if document content present)
    blocks = markdown_to_blocknote(doc_markdown) if doc_markdown else []
    is_full_replace = bool(doc_markdown)

    # 9. Save chat messages (user + assistant)
    # Store clean chat text so history is readable (not raw markers)
    display_text = chat_text if chat_text else ("Document updated." if is_full_replace else response_text)

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
        content=display_text,
        generated_blocks=blocks if not is_full_replace else None,
    )
    db.add(user_msg)
    db.add(assistant_msg)
    db.commit()

    return {
        "message_id": str(assistant_msg.id),
        "response": display_text,
        "blocks": blocks,
        "is_full_replace": is_full_replace,
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
            temperature=0.4,
            max_tokens=16000,
        ),
        timeout=180,
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
                max_tokens=16000,
                temperature=0.4,
            )
        ),
        timeout=180,
    )

    content = response.content[0].text if response.content else ""
    return (content, model)


async def _call_gemini(
    config: Dict[str, Any],
    system_prompt: str,
    messages: List[Dict[str, str]],
) -> Tuple[str, str]:
    """Call Google Gemini API with the org's API key."""
    import google.generativeai as genai

    api_key = config["api_key"]
    model_name = config.get("model", "gemini-2.0-flash")

    genai.configure(api_key=api_key)

    # Build Gemini chat history from messages (excluding the last user message)
    history = []
    for msg in messages[:-1]:
        role = "user" if msg["role"] == "user" else "model"
        history.append({"role": role, "parts": [msg["content"]]})

    last_user_message = messages[-1]["content"] if messages else ""

    model_obj = genai.GenerativeModel(
        model_name=model_name,
        system_instruction=system_prompt,
    )

    chat = model_obj.start_chat(history=history)

    response = await asyncio.wait_for(
        asyncio.to_thread(
            lambda: chat.send_message(last_user_message)
        ),
        timeout=180,
    )

    content = response.text or ""
    return (content, model_name)


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


# ── Smart Apply (merge AI blocks into document) ───────────────

def _extract_text_from_blocks(blocks: list) -> str:
    """Extract plain text from BlockNote blocks for context."""
    parts = []
    for block in blocks:
        if isinstance(block, dict):
            content = block.get("content", [])
            if isinstance(content, list):
                for item in content:
                    if isinstance(item, dict) and item.get("text"):
                        parts.append(item["text"])
            # heading level
            if block.get("type") == "heading":
                level = block.get("props", {}).get("level", 1)
                prefix = "#" * level + " "
                parts[-1:] = [prefix + parts[-1]] if parts else []
    return "\n".join(parts)


def _find_section_index(blocks: list, heading_text: str) -> int:
    """Find the index of a heading block that matches the given text (case-insensitive)."""
    target = heading_text.strip().lower()
    for i, block in enumerate(blocks):
        if isinstance(block, dict) and block.get("type") == "heading":
            content = block.get("content", [])
            block_text = ""
            if isinstance(content, list):
                for item in content:
                    if isinstance(item, dict):
                        block_text += item.get("text", "")
            if block_text.strip().lower() == target:
                return i
    return -1


def _get_section_end(blocks: list, start_idx: int) -> int:
    """Find the end of a section (next heading of same or higher level, or end of doc)."""
    if start_idx >= len(blocks):
        return len(blocks)
    start_block = blocks[start_idx]
    start_level = start_block.get("props", {}).get("level", 1) if start_block.get("type") == "heading" else 0
    for i in range(start_idx + 1, len(blocks)):
        block = blocks[i]
        if isinstance(block, dict) and block.get("type") == "heading":
            level = block.get("props", {}).get("level", 1)
            if level <= start_level:
                return i
    return len(blocks)


def _get_heading_text(block: dict) -> str:
    """Extract heading text from a block."""
    content = block.get("content", [])
    text = ""
    if isinstance(content, list):
        for item in content:
            if isinstance(item, dict):
                text += item.get("text", "")
    return text.strip()


async def apply_blocks_to_document(
    db: DBSession,
    document_id: UUID,
    new_blocks: list,
    user: User,
    full_replace: bool = False,
) -> Dict[str, Any]:
    """
    Apply AI-generated blocks to a document.

    When full_replace=True (default for AI chat): replaces entire document content.
    The AI returns the complete updated document, so we just swap it in.

    When full_replace=False (manual insert/legacy): merges sections intelligently
    by matching headings and inserting new content at logical positions.

    Returns the updated document content.
    """
    document = db.query(Document).filter(Document.id == document_id).first()
    if not document:
        raise ValueError("Document not found.")

    if full_replace:
        # Full document replace — AI returned the complete updated document
        document.content = new_blocks
        db.commit()
        logger.info(f"Full document replace: {len(new_blocks)} blocks")
        return {"content": new_blocks, "action": "full_replace"}

    existing = list(document.content) if document.content else []

    if not existing:
        # Empty document — just use the new blocks
        document.content = new_blocks
        db.commit()
        return {"content": new_blocks, "action": "replaced_empty"}

    # ── Section-level merge (for manual "Insert" button / legacy) ──
    result = list(existing)

    # Split new_blocks into sections (each starts with a heading)
    new_sections: list = []  # list of (heading_text, level, blocks)
    current_section_blocks: list = []
    current_heading: str = ""
    current_level: int = 0

    for block in new_blocks:
        if isinstance(block, dict) and block.get("type") == "heading":
            # Save previous section
            if current_section_blocks:
                new_sections.append((current_heading, current_level, current_section_blocks))
            current_heading = _get_heading_text(block)
            current_level = block.get("props", {}).get("level", 1)
            current_section_blocks = [block]
        else:
            current_section_blocks.append(block)

    # Don't forget last section
    if current_section_blocks:
        new_sections.append((current_heading, current_level, current_section_blocks))

    insertions_at_end = []

    for heading, level, section_blocks in new_sections:
        if not heading:
            # No heading — append at end
            insertions_at_end.extend(section_blocks)
            continue

        # Try to find matching section in existing document
        match_idx = _find_section_index(result, heading)

        if match_idx >= 0:
            # Replace existing section
            section_end = _get_section_end(result, match_idx)
            result = result[:match_idx] + section_blocks + result[section_end:]
        else:
            # Find best insertion point — after the last heading of same or lower level
            insert_at = len(result)
            for i in range(len(result) - 1, -1, -1):
                b = result[i]
                if isinstance(b, dict) and b.get("type") == "heading":
                    b_level = b.get("props", {}).get("level", 1)
                    if b_level <= level:
                        # Insert after this section
                        insert_at = _get_section_end(result, i)
                        break
            result = result[:insert_at] + section_blocks + result[insert_at:]

    # Append any non-headed content at end
    if insertions_at_end:
        result.extend(insertions_at_end)

    document.content = result
    db.commit()

    return {"content": result, "action": "merged"}


# ── Document Preview (HTML) ────────────────────────────────────

def generate_document_preview_html(
    db: DBSession,
    document_id: UUID,
) -> str:
    """
    Generate a rich HTML preview of a document's BlockNote content.

    Renders all block types including Mermaid diagrams (with a client-side
    placeholder div so the frontend can initialize mermaid.js).
    """
    document = db.query(Document).filter(Document.id == document_id).first()
    if not document:
        raise ValueError("Document not found.")

    # Get project/team context for header
    session = db.query(SessionModel).filter(
        SessionModel.id == document.session_id
    ).first()
    project_name = session.document_filename or "Untitled" if session else "Unknown"

    team = (
        db.query(TeamMember)
        .filter(TeamMember.session_id == document.session_id)
        .all()
    )

    blocks = document.content if isinstance(document.content, list) else []

    # Build HTML body
    html_parts = []

    # Document header with team info
    html_parts.append(f'<div class="doc-header">')
    html_parts.append(f'<h1 class="doc-title">{_esc(document.title)}</h1>')
    html_parts.append(f'<div class="doc-project">Project: {_esc(project_name)}</div>')
    if team:
        html_parts.append('<div class="doc-team">')
        html_parts.append('<span class="doc-team-label">Team:</span> ')
        team_str = ", ".join(f"{_esc(m.name)} ({_esc(m.role)})" for m in team)
        html_parts.append(team_str)
        html_parts.append('</div>')
    html_parts.append(f'<div class="doc-date">{datetime.utcnow().strftime("%B %d, %Y")}</div>')
    html_parts.append('</div>')
    html_parts.append('<hr class="doc-divider" />')

    # Render content blocks
    for block in blocks:
        rendered = _render_preview_block(block)
        if rendered:
            html_parts.append(rendered)

    body = "\n".join(html_parts)
    return _wrap_preview_html(document.title, body)


def _esc(text: str) -> str:
    """Escape HTML entities."""
    return (
        text.replace("&", "&amp;")
        .replace("<", "&lt;")
        .replace(">", "&gt;")
        .replace('"', "&quot;")
    )


def _render_preview_block(block: dict) -> str:
    """Render a single block to preview HTML."""
    block_type = block.get("type", "paragraph")
    props = block.get("props", {})
    content = block.get("content", [])

    text = _inline_to_html(content)

    if block_type == "mermaid":
        code = props.get("code", "")
        caption = props.get("caption", "")
        caption_html = f'<p class="mermaid-caption">{_esc(caption)}</p>' if caption else ""
        return (
            f'<div class="mermaid-container">'
            f'<pre class="mermaid">{_esc(code)}</pre>'
            f'{caption_html}'
            f'</div>'
        )
    elif block_type == "paragraph":
        return f"<p>{text}</p>" if text else ""
    elif block_type == "heading":
        level = min(max(props.get("level", 1), 1), 3)
        return f"<h{level}>{text}</h{level}>"
    elif block_type == "bulletListItem":
        return f'<ul><li>{text}</li></ul>'
    elif block_type == "numberedListItem":
        return f'<ol><li>{text}</li></ol>'
    elif block_type == "checkListItem":
        checked = "checked" if props.get("checked") else ""
        return f'<div class="check-item"><input type="checkbox" {checked} disabled /> {text}</div>'
    elif block_type == "codeBlock":
        lang = props.get("language", "")
        return f'<pre class="code-block"><code class="{lang}">{text}</code></pre>'
    elif block_type in ("quote", "callout"):
        return f"<blockquote>{text}</blockquote>"
    elif block_type in ("divider", "pageBreak"):
        return '<hr />'
    elif block_type == "image":
        url = props.get("url", "")
        alt = props.get("caption", "")
        return f'<figure><img src="{url}" alt="{_esc(alt)}" />{f"<figcaption>{_esc(alt)}</figcaption>" if alt else ""}</figure>'
    elif block_type == "table":
        return _render_table_html(block)
    else:
        return f"<p>{text}</p>" if text else ""


def _inline_to_html(content: list) -> str:
    """Convert BlockNote inline content array to HTML."""
    if not content:
        return ""
    parts = []
    for item in content:
        if isinstance(item, str):
            parts.append(_esc(item))
        elif isinstance(item, dict):
            text = _esc(item.get("text", ""))
            styles = item.get("styles", {})
            if styles.get("bold"):
                text = f"<strong>{text}</strong>"
            if styles.get("italic"):
                text = f"<em>{text}</em>"
            if styles.get("underline"):
                text = f"<u>{text}</u>"
            if styles.get("strikethrough"):
                text = f"<s>{text}</s>"
            if styles.get("code"):
                text = f"<code>{text}</code>"
            href = item.get("href")
            if href:
                text = f'<a href="{href}" target="_blank">{text}</a>'
            parts.append(text)
    return "".join(parts)


def _render_table_html(block: dict) -> str:
    """Render a table block to HTML."""
    rows = block.get("content", {})
    if isinstance(rows, dict):
        rows = rows.get("rows", [])
    if not rows:
        return ""
    html = '<table class="doc-table">'
    for i, row in enumerate(rows):
        html += "<tr>"
        cells = row.get("cells", [])
        tag = "th" if i == 0 else "td"
        for cell in cells:
            cell_text = _extract_cell_text(cell)
            cell_html = _esc(cell_text) if cell_text else ""
            html += f"<{tag}>{cell_html}</{tag}>"
        html += "</tr>"
    html += "</table>"
    return html


def _wrap_preview_html(title: str, body: str) -> str:
    """Wrap the preview body in a full HTML document with beautiful styling."""
    return f"""<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>{_esc(title)}</title>
<script src="https://cdn.jsdelivr.net/npm/mermaid@11/dist/mermaid.min.js"></script>
<script>mermaid.initialize({{startOnLoad:true, theme:'neutral', securityLevel:'loose'}});</script>
<style>
  * {{ margin: 0; padding: 0; box-sizing: border-box; }}
  body {{
    font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
    color: #1a1a2e;
    background: #ffffff;
    line-height: 1.7;
    padding: 40px;
    max-width: 900px;
    margin: 0 auto;
  }}
  .doc-header {{ margin-bottom: 24px; }}
  .doc-title {{ font-size: 28px; font-weight: 700; color: #111; margin-bottom: 8px; }}
  .doc-project {{ font-size: 14px; color: #6b7280; margin-bottom: 4px; }}
  .doc-team {{ font-size: 13px; color: #6b7280; margin-bottom: 4px; }}
  .doc-team-label {{ font-weight: 600; color: #374151; }}
  .doc-date {{ font-size: 13px; color: #9ca3af; }}
  .doc-divider {{ border: none; border-top: 2px solid #e5e7eb; margin: 20px 0 32px; }}
  h1 {{ font-size: 24px; font-weight: 700; margin: 32px 0 12px; color: #111827; }}
  h2 {{ font-size: 20px; font-weight: 600; margin: 28px 0 10px; color: #1f2937; border-bottom: 1px solid #e5e7eb; padding-bottom: 6px; }}
  h3 {{ font-size: 16px; font-weight: 600; margin: 20px 0 8px; color: #374151; }}
  p {{ margin: 8px 0; color: #374151; }}
  ul, ol {{ margin: 8px 0 8px 24px; }}
  li {{ margin: 4px 0; color: #374151; }}
  blockquote {{
    border-left: 3px solid #e4ff1a;
    background: #fafaf5;
    padding: 12px 16px;
    margin: 12px 0;
    border-radius: 0 8px 8px 0;
    color: #4b5563;
  }}
  .code-block {{
    background: #1e293b;
    color: #e2e8f0;
    border-radius: 8px;
    padding: 16px;
    overflow-x: auto;
    font-size: 13px;
    margin: 12px 0;
  }}
  code {{
    background: #f3f4f6;
    padding: 2px 6px;
    border-radius: 4px;
    font-size: 13px;
    font-family: 'JetBrains Mono', 'Fira Code', monospace;
  }}
  .code-block code {{ background: transparent; padding: 0; }}
  .mermaid-container {{
    margin: 20px 0;
    padding: 20px;
    background: #fafbfc;
    border: 1px solid #e5e7eb;
    border-radius: 12px;
    text-align: center;
  }}
  .mermaid {{ font-size: 14px; }}
  .mermaid-caption {{
    font-size: 12px;
    color: #9ca3af;
    margin-top: 8px;
    font-style: italic;
  }}
  .doc-table {{
    width: 100%;
    border-collapse: collapse;
    margin: 16px 0;
    font-size: 14px;
  }}
  .doc-table th, .doc-table td {{
    border: 1px solid #e5e7eb;
    padding: 10px 12px;
    text-align: left;
  }}
  .doc-table th {{ background: #f9fafb; font-weight: 600; color: #374151; }}
  .doc-table td {{ color: #4b5563; }}
  .check-item {{
    display: flex;
    align-items: center;
    gap: 8px;
    margin: 4px 0;
    color: #374151;
  }}
  figure {{ margin: 16px 0; text-align: center; }}
  figure img {{ max-width: 100%; border-radius: 8px; }}
  figcaption {{ font-size: 12px; color: #9ca3af; margin-top: 6px; }}
  strong {{ color: #111827; }}
  hr {{ border: none; border-top: 1px solid #e5e7eb; margin: 24px 0; }}
  a {{ color: #3b82f6; text-decoration: none; }}
  a:hover {{ text-decoration: underline; }}
</style>
</head>
<body>
{body}
</body>
</html>"""
