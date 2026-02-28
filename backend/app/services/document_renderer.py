"""
Document Renderer Service.

Converts BlockNote JSON content → HTML → PDF using the existing
PDFGenerator infrastructure. Resolves variables, renders scope
references and pricing tables with brand theming.
"""
from __future__ import annotations

import io
from datetime import datetime
from typing import Any, Dict, List, Optional

from app.core.logger import get_logger

logger = get_logger(__name__)


class DocumentRenderer:
    """Renders BlockNote JSON document content to HTML and PDF."""

    def __init__(self, brand: dict | None = None):
        self.brand = brand or {}

    # ── Block → HTML rendering ────────────────────────────────────

    def blocks_to_html(
        self,
        blocks: List[dict],
        variables: Dict[str, str] | None = None,
        pricing_items: List[dict] | None = None,
    ) -> str:
        """Convert BlockNote JSON blocks to HTML string."""
        variables = variables or {}
        html_parts = []

        for block in blocks:
            rendered = self._render_block(block, variables, pricing_items)
            if rendered:
                html_parts.append(rendered)

        body = "\n".join(html_parts)
        return self._wrap_html(body)

    def _render_block(
        self,
        block: dict,
        variables: Dict[str, str],
        pricing_items: List[dict] | None,
    ) -> str:
        """Render a single BlockNote block to HTML."""
        block_type = block.get("type", "paragraph")
        props = block.get("props", {})
        content = block.get("content", [])

        text = self._inline_content_to_html(content, variables)

        if block_type == "paragraph":
            return f"<p>{text}</p>" if text else ""
        elif block_type == "heading":
            level = props.get("level", 1)
            level = min(max(level, 1), 3)
            return f"<h{level}>{text}</h{level}>"
        elif block_type == "bulletListItem":
            return f"<li>{text}</li>"
        elif block_type == "numberedListItem":
            return f"<li>{text}</li>"
        elif block_type == "checkListItem":
            checked = "checked" if props.get("checked") else ""
            return f'<li><input type="checkbox" {checked} disabled /> {text}</li>'
        elif block_type == "image":
            url = props.get("url", "")
            alt = props.get("caption", "")
            return f'<img src="{url}" alt="{alt}" style="max-width:100%;" />'
        elif block_type == "table":
            return self._render_table(block)
        elif block_type == "codeBlock":
            language = props.get("language", "")
            return f"<pre><code class=\"{language}\">{text}</code></pre>"
        elif block_type == "quote" or block_type == "callout":
            return f"<blockquote>{text}</blockquote>"
        elif block_type == "divider" or block_type == "pageBreak":
            return "<hr />"
        elif block_type == "scopeReference":
            return self._render_scope_reference(props)
        elif block_type == "pricingTable":
            return self._render_pricing_table(pricing_items or [])
        elif block_type == "variableText":
            return f"<p>{text}</p>"
        else:
            return f"<p>{text}</p>" if text else ""

    def _inline_content_to_html(
        self, content: list, variables: Dict[str, str]
    ) -> str:
        """Convert inline content array to HTML with variable resolution."""
        if not content:
            return ""

        parts = []
        for item in content:
            if isinstance(item, str):
                text = self._resolve_variables(item, variables)
                parts.append(text)
            elif isinstance(item, dict):
                text = item.get("text", "")
                text = self._resolve_variables(text, variables)
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
                    text = f'<a href="{href}">{text}</a>'

                parts.append(text)

        return "".join(parts)

    def _resolve_variables(self, text: str, variables: Dict[str, str]) -> str:
        """Replace {{variable}} placeholders with resolved values."""
        for key, value in variables.items():
            text = text.replace(f"{{{{{key}}}}}", str(value))
        return text

    def _render_table(self, block: dict) -> str:
        """Render a table block."""
        rows = block.get("content", {}).get("rows", [])
        if not rows:
            return ""

        html = "<table border='1' cellpadding='6' cellspacing='0' style='border-collapse:collapse;width:100%;'>"
        for i, row in enumerate(rows):
            html += "<tr>"
            cells = row.get("cells", [])
            tag = "th" if i == 0 else "td"
            for cell in cells:
                cell_content = self._inline_content_to_html(cell, {})
                html += f"<{tag}>{cell_content}</{tag}>"
            html += "</tr>"
        html += "</table>"
        return html

    def _render_scope_reference(self, props: dict) -> str:
        """Render a scope tree node reference as a formatted box."""
        title = props.get("nodeTitle", "Scope Item")
        description = props.get("nodeDescription", "")
        status = props.get("nodeStatus", "")
        ac_list = props.get("acceptanceCriteria", [])

        html = f"""
        <div style="border:1px solid #e5e7eb;border-radius:8px;padding:12px 16px;margin:8px 0;background:#f9fafb;">
            <div style="font-weight:bold;font-size:14px;color:#111827;">📋 {title}</div>
            {f'<div style="color:#6b7280;font-size:12px;margin-top:4px;">Status: {status}</div>' if status else ''}
            {f'<p style="margin-top:8px;color:#374151;">{description}</p>' if description else ''}
        """
        if ac_list:
            html += "<ul style='margin-top:8px;padding-left:20px;'>"
            for ac in ac_list:
                html += f"<li style='color:#374151;font-size:13px;'>{ac}</li>"
            html += "</ul>"
        html += "</div>"
        return html

    def _render_pricing_table(self, items: List[dict]) -> str:
        """Render pricing line items as an HTML table."""
        if not items:
            return "<p><em>No pricing items</em></p>"

        html = """
        <table border='1' cellpadding='8' cellspacing='0' style='border-collapse:collapse;width:100%;margin:12px 0;'>
            <tr style='background:#f3f4f6;'>
                <th style='text-align:left;'>Item</th>
                <th style='text-align:left;'>Description</th>
                <th style='text-align:right;'>Qty</th>
                <th style='text-align:right;'>Unit Price</th>
                <th style='text-align:right;'>Discount</th>
                <th style='text-align:right;'>Tax</th>
                <th style='text-align:right;'>Total</th>
            </tr>
        """

        subtotal = 0.0
        total_tax = 0.0

        for item in items:
            if not item.get("is_selected", True):
                continue
            qty = item.get("quantity", 1)
            price = item.get("unit_price", 0)
            discount = item.get("discount_percent", 0)
            tax = item.get("tax_percent", 0)

            line_base = qty * price * (1 - discount / 100)
            line_tax = line_base * (tax / 100)
            line_total = line_base + line_tax

            subtotal += line_base
            total_tax += line_tax

            optional_badge = " <span style='color:#f59e0b;font-size:11px;'>(Optional)</span>" if item.get("is_optional") else ""

            html += f"""
            <tr>
                <td>{item.get('name', '')}{optional_badge}</td>
                <td style='color:#6b7280;font-size:13px;'>{item.get('description', '') or ''}</td>
                <td style='text-align:right;'>{qty}</td>
                <td style='text-align:right;'>${price:,.2f}</td>
                <td style='text-align:right;'>{discount}%</td>
                <td style='text-align:right;'>{tax}%</td>
                <td style='text-align:right;font-weight:bold;'>${line_total:,.2f}</td>
            </tr>
            """

        grand_total = subtotal + total_tax
        html += f"""
            <tr style='border-top:2px solid #374151;'>
                <td colspan='6' style='text-align:right;font-weight:bold;'>Subtotal</td>
                <td style='text-align:right;font-weight:bold;'>${subtotal:,.2f}</td>
            </tr>
            <tr>
                <td colspan='6' style='text-align:right;color:#6b7280;'>Tax</td>
                <td style='text-align:right;color:#6b7280;'>${total_tax:,.2f}</td>
            </tr>
            <tr style='background:#f3f4f6;'>
                <td colspan='6' style='text-align:right;font-weight:bold;font-size:16px;'>Total</td>
                <td style='text-align:right;font-weight:bold;font-size:16px;'>${grand_total:,.2f}</td>
            </tr>
        </table>
        """
        return html

    def _wrap_html(self, body: str) -> str:
        """Wrap body HTML in a full document."""
        primary = self.brand.get("primary_color", "#6366f1")
        font = self.brand.get("font_family", "system-ui, -apple-system, sans-serif")
        logo = self.brand.get("logo_url", "")

        header = ""
        if logo:
            header = f'<div style="margin-bottom:24px;"><img src="{logo}" alt="Logo" style="max-height:48px;" /></div>'

        return f"""<!DOCTYPE html>
<html>
<head>
    <meta charset="utf-8">
    <style>
        body {{ font-family: {font}; color: #374151; line-height: 1.6; max-width: 800px; margin: 0 auto; padding: 40px 20px; }}
        h1 {{ color: {primary}; font-size: 28px; margin-bottom: 8px; }}
        h2 {{ color: {primary}; font-size: 22px; margin-top: 32px; }}
        h3 {{ color: #4b5563; font-size: 18px; margin-top: 24px; }}
        table {{ margin: 16px 0; }}
        th {{ background: #f3f4f6; }}
        hr {{ border: none; border-top: 1px solid #e5e7eb; margin: 24px 0; }}
        a {{ color: {primary}; }}
        blockquote {{ border-left: 3px solid {primary}; padding-left: 16px; margin-left: 0; color: #6b7280; }}
        img {{ max-width: 100%; border-radius: 8px; }}
    </style>
</head>
<body>
{header}
{body}
</body>
</html>"""

    # ── PDF rendering (delegates to existing infrastructure) ──────

    def render_pdf(
        self,
        title: str,
        blocks: List[dict],
        variables: Dict[str, str] | None = None,
        pricing_items: List[dict] | None = None,
        metadata: dict | None = None,
    ) -> bytes:
        """Render document to PDF bytes.

        Tries to use the existing PDFGenerator; falls back to a
        simple HTML-based approach via fpdf2.
        """
        variables = variables or {}
        metadata = metadata or {}

        try:
            from app.services.pdf_generator import PDFGenerator

            pdf_gen = PDFGenerator(brand=self.brand)

            # Build markdown-like content from blocks
            md_lines = self._blocks_to_markdown(blocks, variables, pricing_items)
            markdown_content = "\n\n".join(md_lines)

            # Use PDFGenerator's rendering pipeline
            pdf_gen.add_cover_page(
                title=title,
                subtitle=metadata.get("subtitle", ""),
                project_name=metadata.get("project_name", ""),
                date_str=datetime.utcnow().strftime("%B %d, %Y"),
            )
            pdf_gen.render_markdown(markdown_content)
            return pdf_gen.output()

        except Exception as e:
            logger.warning(f"PDFGenerator unavailable, using fallback: {e}")
            return self._fallback_pdf(title, blocks, variables, pricing_items)

    def _blocks_to_markdown(
        self,
        blocks: List[dict],
        variables: Dict[str, str],
        pricing_items: List[dict] | None,
    ) -> List[str]:
        """Convert blocks to markdown lines for PDFGenerator."""
        lines = []
        for block in blocks:
            block_type = block.get("type", "paragraph")
            props = block.get("props", {})
            content = block.get("content", [])
            text = self._inline_to_text(content, variables)

            if block_type == "heading":
                level = props.get("level", 1)
                lines.append(f"{'#' * level} {text}")
            elif block_type == "paragraph":
                if text:
                    lines.append(text)
            elif block_type == "bulletListItem":
                lines.append(f"- {text}")
            elif block_type == "numberedListItem":
                lines.append(f"1. {text}")
            elif block_type == "divider" or block_type == "pageBreak":
                lines.append("---")
            elif block_type == "quote" or block_type == "callout":
                lines.append(f"> {text}")
            elif block_type == "codeBlock":
                lines.append(f"```\n{text}\n```")
            elif block_type == "scopeReference":
                title = props.get("nodeTitle", "")
                desc = props.get("nodeDescription", "")
                lines.append(f"**📋 {title}**")
                if desc:
                    lines.append(desc)
            elif block_type == "pricingTable" and pricing_items:
                lines.append(self._pricing_to_markdown(pricing_items))
            else:
                if text:
                    lines.append(text)

        return lines

    def _inline_to_text(self, content: list, variables: Dict[str, str]) -> str:
        """Extract plain text from inline content."""
        parts = []
        for item in content:
            if isinstance(item, str):
                parts.append(self._resolve_variables(item, variables))
            elif isinstance(item, dict):
                text = item.get("text", "")
                text = self._resolve_variables(text, variables)
                styles = item.get("styles", {})
                if styles.get("bold"):
                    text = f"**{text}**"
                if styles.get("italic"):
                    text = f"*{text}*"
                parts.append(text)
        return "".join(parts)

    def _pricing_to_markdown(self, items: List[dict]) -> str:
        """Convert pricing items to a markdown table."""
        lines = [
            "| Item | Qty | Unit Price | Total |",
            "|------|-----|-----------|-------|",
        ]
        grand_total = 0
        for item in items:
            if not item.get("is_selected", True):
                continue
            qty = item.get("quantity", 1)
            price = item.get("unit_price", 0)
            discount = item.get("discount_percent", 0)
            tax = item.get("tax_percent", 0)
            base = qty * price * (1 - discount / 100)
            total = base * (1 + tax / 100)
            grand_total += total
            lines.append(f"| {item.get('name', '')} | {qty} | ${price:,.2f} | ${total:,.2f} |")

        lines.append(f"| **Total** | | | **${grand_total:,.2f}** |")
        return "\n".join(lines)

    def _fallback_pdf(
        self,
        title: str,
        blocks: List[dict],
        variables: Dict[str, str],
        pricing_items: List[dict] | None,
    ) -> bytes:
        """Simple fallback PDF using fpdf2 directly."""
        try:
            from fpdf import FPDF
        except ImportError:
            raise RuntimeError("fpdf2 is required for PDF generation. Install it: pip install fpdf2")

        pdf = FPDF()
        pdf.set_auto_page_break(auto=True, margin=25)
        pdf.add_page()
        pdf.set_font("Helvetica", "B", 24)
        pdf.cell(0, 15, title, ln=True)
        pdf.set_font("Helvetica", "", 10)
        pdf.cell(0, 8, f"Generated: {datetime.utcnow().strftime('%B %d, %Y')}", ln=True)
        pdf.ln(10)

        for block in blocks:
            block_type = block.get("type", "paragraph")
            props = block.get("props", {})
            content = block.get("content", [])
            text = self._inline_to_text(content, variables or {})

            if block_type == "heading":
                level = props.get("level", 1)
                sizes = {1: 20, 2: 16, 3: 14}
                pdf.set_font("Helvetica", "B", sizes.get(level, 14))
                pdf.ln(6)
                pdf.multi_cell(0, 8, text)
                pdf.ln(2)
            elif block_type in ("paragraph", "variableText"):
                if text:
                    pdf.set_font("Helvetica", "", 11)
                    pdf.multi_cell(0, 6, text)
                    pdf.ln(2)
            elif block_type in ("bulletListItem", "numberedListItem"):
                pdf.set_font("Helvetica", "", 11)
                pdf.cell(8)
                pdf.multi_cell(0, 6, f"• {text}")
            elif block_type in ("divider", "pageBreak"):
                pdf.ln(4)
                pdf.line(15, pdf.get_y(), 195, pdf.get_y())
                pdf.ln(4)
            elif block_type == "pricingTable" and pricing_items:
                self._render_pricing_pdf(pdf, pricing_items)

        return pdf.output()

    def _render_pricing_pdf(self, pdf: Any, items: List[dict]) -> None:
        """Render pricing table in PDF."""
        pdf.ln(4)
        pdf.set_font("Helvetica", "B", 12)
        pdf.cell(0, 8, "Pricing", ln=True)

        # Header
        pdf.set_font("Helvetica", "B", 9)
        pdf.set_fill_color(243, 244, 246)
        pdf.cell(70, 7, "Item", border=1, fill=True)
        pdf.cell(20, 7, "Qty", border=1, fill=True, align="R")
        pdf.cell(30, 7, "Unit Price", border=1, fill=True, align="R")
        pdf.cell(25, 7, "Discount", border=1, fill=True, align="R")
        pdf.cell(35, 7, "Total", border=1, fill=True, align="R")
        pdf.ln()

        pdf.set_font("Helvetica", "", 9)
        grand_total = 0

        for item in items:
            if not item.get("is_selected", True):
                continue
            qty = item.get("quantity", 1)
            price = item.get("unit_price", 0)
            discount = item.get("discount_percent", 0)
            tax = item.get("tax_percent", 0)
            base = qty * price * (1 - discount / 100)
            total = base * (1 + tax / 100)
            grand_total += total

            pdf.cell(70, 7, item.get("name", "")[:40], border=1)
            pdf.cell(20, 7, str(qty), border=1, align="R")
            pdf.cell(30, 7, f"${price:,.2f}", border=1, align="R")
            pdf.cell(25, 7, f"{discount}%", border=1, align="R")
            pdf.cell(35, 7, f"${total:,.2f}", border=1, align="R")
            pdf.ln()

        # Total row
        pdf.set_font("Helvetica", "B", 10)
        pdf.cell(145, 8, "Total", border=1, align="R")
        pdf.cell(35, 8, f"${grand_total:,.2f}", border=1, align="R")
        pdf.ln(10)
