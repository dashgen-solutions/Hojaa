"""
Tests for the enhanced Document AI Chat service.

Tests cover:
- Mermaid diagram detection in markdown_to_blocknote
- Regular code block handling
- Platform API key fallback in _get_llm_config
- Preview HTML generation
- Block type conversions
"""
import json
import pytest
from unittest.mock import MagicMock, patch, PropertyMock
from uuid import uuid4

# ── markdown_to_blocknote tests ─────────────────────────────

from app.services.document_ai_service import markdown_to_blocknote


class TestMarkdownToBlocknote:
    """Tests for the enhanced markdown → BlockNote converter."""

    def test_mermaid_block_detected(self):
        md = "```mermaid\ngraph TD\n    A-->B\n```"
        blocks = markdown_to_blocknote(md)
        assert len(blocks) == 1
        assert blocks[0]["type"] == "mermaid"
        assert "graph TD" in blocks[0]["props"]["code"]

    def test_mermaid_code_preserved(self):
        code = "graph LR\n    A[Start] --> B[Middle]\n    B --> C[End]"
        md = f"```mermaid\n{code}\n```"
        blocks = markdown_to_blocknote(md)
        assert blocks[0]["props"]["code"] == code

    def test_mermaid_has_empty_content(self):
        md = "```mermaid\ngraph TD\n    A-->B\n```"
        blocks = markdown_to_blocknote(md)
        assert blocks[0]["content"] == []

    def test_regular_code_block_not_treated_as_mermaid(self):
        md = "```python\nprint('hello')\n```"
        blocks = markdown_to_blocknote(md)
        assert len(blocks) == 1
        assert blocks[0]["type"] == "codeBlock"
        assert blocks[0]["props"]["language"] == "python"

    def test_code_block_without_language(self):
        md = "```\nsome code\n```"
        blocks = markdown_to_blocknote(md)
        assert blocks[0]["type"] == "codeBlock"
        assert blocks[0]["props"]["language"] == ""

    def test_mixed_mermaid_and_code(self):
        md = """# Title

```mermaid
graph TD
    A-->B
```

```javascript
console.log('hi')
```

Normal paragraph.
"""
        blocks = markdown_to_blocknote(md)
        types = [b["type"] for b in blocks]
        assert "heading" in types
        assert "mermaid" in types
        assert "codeBlock" in types
        assert "paragraph" in types

    def test_heading_levels(self):
        md = "# H1\n## H2\n### H3"
        blocks = markdown_to_blocknote(md)
        assert len(blocks) == 3
        assert blocks[0]["props"]["level"] == 1
        assert blocks[1]["props"]["level"] == 2
        assert blocks[2]["props"]["level"] == 3

    def test_bullet_list(self):
        md = "- item one\n- item two\n* item three"
        blocks = markdown_to_blocknote(md)
        assert all(b["type"] == "bulletListItem" for b in blocks)
        assert len(blocks) == 3

    def test_numbered_list(self):
        md = "1. first\n2. second\n3. third"
        blocks = markdown_to_blocknote(md)
        assert all(b["type"] == "numberedListItem" for b in blocks)

    def test_inline_bold(self):
        md = "This is **bold** text"
        blocks = markdown_to_blocknote(md)
        content = blocks[0]["content"]
        bold_items = [c for c in content if c.get("styles", {}).get("bold")]
        assert len(bold_items) == 1
        assert bold_items[0]["text"] == "bold"

    def test_inline_code(self):
        md = "Use `myFunction()` here"
        blocks = markdown_to_blocknote(md)
        code_items = [c for c in blocks[0]["content"] if c.get("styles", {}).get("code")]
        assert len(code_items) == 1
        assert code_items[0]["text"] == "myFunction()"

    def test_empty_lines_skipped(self):
        md = "Line 1\n\n\n\nLine 2"
        blocks = markdown_to_blocknote(md)
        assert len(blocks) == 2

    def test_horizontal_rule_skipped(self):
        md = "Above\n---\nBelow"
        blocks = markdown_to_blocknote(md)
        types = [b["type"] for b in blocks]
        assert "paragraph" in types
        assert len(blocks) == 2  # hr is skipped

    def test_gantt_mermaid(self):
        md = """```mermaid
gantt
    title Project Timeline
    dateFormat YYYY-MM-DD
    section Phase 1
    Design :a1, 2024-01-01, 30d
```"""
        blocks = markdown_to_blocknote(md)
        assert blocks[0]["type"] == "mermaid"
        assert "gantt" in blocks[0]["props"]["code"]

    def test_sequence_diagram(self):
        md = """```mermaid
sequenceDiagram
    Alice->>Bob: Hello Bob
    Bob-->>Alice: Hi Alice
```"""
        blocks = markdown_to_blocknote(md)
        assert blocks[0]["type"] == "mermaid"
        assert "sequenceDiagram" in blocks[0]["props"]["code"]

    def test_pie_chart(self):
        md = """```mermaid
pie title Effort Distribution
    "Frontend" : 40
    "Backend" : 35
    "Testing" : 25
```"""
        blocks = markdown_to_blocknote(md)
        assert blocks[0]["type"] == "mermaid"
        assert "pie" in blocks[0]["props"]["code"]


# ── _get_llm_config tests ──────────────────────────────────

from app.services.document_ai_service import _get_llm_config
from app.models.database import User, Integration, IntegrationType


class TestGetLlmConfig:
    """Tests for LLM config resolution with platform key fallback."""

    def _mock_user(self, org_id=None):
        user = MagicMock(spec=User)
        user.id = uuid4()
        user.organization_id = org_id
        return user

    def test_fallback_to_platform_key(self):
        """When user has no org, should fall back to platform key."""
        user = self._mock_user(org_id=None)
        db = MagicMock()

        with patch("app.services.document_ai_service.settings") as mock_settings:
            mock_settings.platform_openai_api_key = "sk-platform-test-key"
            provider, config = _get_llm_config(db, user)

        assert provider == "openai"
        assert config["api_key"] == "sk-platform-test-key"
        assert config["model"] == "gpt-4o-mini"

    def test_fallback_when_org_has_no_integrations(self):
        """When org exists but has no integrations, fall back to platform key."""
        user = self._mock_user(org_id=uuid4())
        db = MagicMock()
        # Mock empty integration query
        db.query.return_value.filter.return_value.all.return_value = []

        with patch("app.services.document_ai_service.settings") as mock_settings:
            mock_settings.platform_openai_api_key = "sk-platform-fallback"
            provider, config = _get_llm_config(db, user)

        assert provider == "openai"
        assert config["api_key"] == "sk-platform-fallback"

    def test_raises_when_no_keys_available(self):
        """When no org key and no platform key, should raise ValueError."""
        user = self._mock_user(org_id=None)
        db = MagicMock()

        with patch("app.services.document_ai_service.settings") as mock_settings:
            mock_settings.platform_openai_api_key = ""
            with pytest.raises(ValueError, match="No AI provider configured"):
                _get_llm_config(db, user)

    def test_prefers_org_openai_key(self):
        """When org has OpenAI integration, should prefer it over platform key."""
        user = self._mock_user(org_id=uuid4())
        db = MagicMock()

        integ = MagicMock(spec=Integration)
        integ.integration_type = IntegrationType.LLM_OPENAI
        integ.config = {"api_key": "sk-user-key", "model": "gpt-4o"}
        integ.is_active = True

        db.query.return_value.filter.return_value.all.return_value = [integ]

        with patch("app.services.document_ai_service.settings") as mock_settings:
            mock_settings.platform_openai_api_key = "sk-platform-key"
            provider, config = _get_llm_config(db, user)

        assert provider == "openai"
        assert config["api_key"] == "sk-user-key"

    def test_prefers_openai_over_anthropic(self):
        """When both providers exist, should prefer OpenAI."""
        user = self._mock_user(org_id=uuid4())
        db = MagicMock()

        openai_integ = MagicMock(spec=Integration)
        openai_integ.integration_type = IntegrationType.LLM_OPENAI
        openai_integ.config = {"api_key": "sk-openai", "model": "gpt-4o"}

        anthropic_integ = MagicMock(spec=Integration)
        anthropic_integ.integration_type = IntegrationType.LLM_ANTHROPIC
        anthropic_integ.config = {"api_key": "sk-anthropic", "model": "claude-sonnet-4-20250514"}

        db.query.return_value.filter.return_value.all.return_value = [
            openai_integ,
            anthropic_integ,
        ]

        with patch("app.services.document_ai_service.settings") as mock_settings:
            mock_settings.platform_openai_api_key = ""
            provider, config = _get_llm_config(db, user)

        assert provider == "openai"
        assert config["api_key"] == "sk-openai"


# ── Preview HTML generation tests ──────────────────────────

from app.services.document_ai_service import (
    generate_document_preview_html,
    _render_preview_block,
    _esc,
    _inline_to_html,
)


class TestPreviewHtml:
    """Tests for the HTML preview generation."""

    def test_esc_html_entities(self):
        assert _esc("<script>") == "&lt;script&gt;"
        assert _esc('"hello"') == "&quot;hello&quot;"
        assert _esc("a & b") == "a &amp; b"

    def test_inline_to_html_plain(self):
        content = [{"type": "text", "text": "hello", "styles": {}}]
        assert _inline_to_html(content) == "hello"

    def test_inline_to_html_bold(self):
        content = [{"type": "text", "text": "bold", "styles": {"bold": True}}]
        result = _inline_to_html(content)
        assert "<strong>" in result
        assert "bold" in result

    def test_inline_to_html_code(self):
        content = [{"type": "text", "text": "code", "styles": {"code": True}}]
        result = _inline_to_html(content)
        assert "<code>" in result

    def test_render_mermaid_block(self):
        block = {
            "type": "mermaid",
            "props": {"code": "graph TD\n    A-->B", "caption": "Flow"},
            "content": [],
        }
        html = _render_preview_block(block)
        assert 'class="mermaid"' in html
        assert "graph TD" in html
        assert "Flow" in html

    def test_render_heading_block(self):
        block = {
            "type": "heading",
            "props": {"level": 2},
            "content": [{"type": "text", "text": "Section Title", "styles": {}}],
        }
        html = _render_preview_block(block)
        assert "<h2>" in html
        assert "Section Title" in html

    def test_render_paragraph_block(self):
        block = {
            "type": "paragraph",
            "content": [{"type": "text", "text": "Hello world", "styles": {}}],
        }
        html = _render_preview_block(block)
        assert "<p>" in html
        assert "Hello world" in html

    def test_render_code_block(self):
        block = {
            "type": "codeBlock",
            "props": {"language": "python"},
            "content": [{"type": "text", "text": "print('hi')", "styles": {}}],
        }
        html = _render_preview_block(block)
        assert "code-block" in html
        assert "print" in html

    def test_render_bullet_item(self):
        block = {
            "type": "bulletListItem",
            "content": [{"type": "text", "text": "Item", "styles": {}}],
        }
        html = _render_preview_block(block)
        assert "<li>" in html
        assert "Item" in html

    def test_render_blockquote(self):
        block = {
            "type": "quote",
            "content": [{"type": "text", "text": "A quote", "styles": {}}],
        }
        html = _render_preview_block(block)
        assert "<blockquote>" in html

    def test_render_divider(self):
        block = {"type": "divider", "content": [], "props": {}}
        html = _render_preview_block(block)
        assert "<hr" in html

    def test_render_image(self):
        block = {
            "type": "image",
            "props": {"url": "https://example.com/img.png", "caption": "A photo"},
            "content": [],
        }
        html = _render_preview_block(block)
        assert "<img" in html
        assert "example.com" in html
        assert "<figcaption>" in html

    def test_render_empty_paragraph(self):
        block = {"type": "paragraph", "content": [], "props": {}}
        html = _render_preview_block(block)
        assert html == ""

    def test_full_preview_html_has_mermaid_script(self):
        """generate_document_preview_html should include mermaid.js CDN."""
        db = MagicMock()
        doc_id = uuid4()

        mock_doc = MagicMock()
        mock_doc.id = doc_id
        mock_doc.title = "Test Doc"
        mock_doc.status = "draft"
        mock_doc.session_id = uuid4()
        mock_doc.content = [
            {"type": "paragraph", "content": [{"type": "text", "text": "Hello", "styles": {}}]},
            {"type": "mermaid", "props": {"code": "graph TD\nA-->B", "caption": ""}, "content": []},
        ]

        mock_session = MagicMock()
        mock_session.document_filename = "My Project"

        # Set up chained query mocking
        db.query.return_value.filter.return_value.first.side_effect = [
            mock_doc,      # Document query
            mock_session,  # Session query
        ]
        db.query.return_value.filter.return_value.all.return_value = []  # TeamMember query

        html = generate_document_preview_html(db, doc_id)

        assert "mermaid.min.js" in html
        assert "Test Doc" in html
        assert 'class="mermaid"' in html
        assert "Hello" in html
