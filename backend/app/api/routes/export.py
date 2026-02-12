"""
API routes for exporting scope documents.
Phase 5: Export & Documentation.
"""
import io
from datetime import datetime
from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import Response
from sqlalchemy.orm import Session
from app.db.session import get_db
from app.models.schemas import ExportRequest
from app.services.export_service import export_service
from app.core.logger import get_logger

logger = get_logger(__name__)

router = APIRouter(prefix="/export", tags=["export"])


def _markdown_to_styled_html(markdown_content: str) -> str:
    """Convert markdown to a fully-styled HTML document."""
    import markdown2

    html_body = markdown2.markdown(
        markdown_content,
        extras=["tables", "fenced-code-blocks", "header-ids"],
    )

    styled_html = f"""<!DOCTYPE html>
<html>
<head>
    <meta charset="utf-8">
    <title>Scope Document</title>
    <style>
        @page {{
            size: A4;
            margin: 20mm;
        }}
        body {{
            font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
            max-width: 800px;
            margin: 0 auto;
            padding: 20px;
            color: #333;
            line-height: 1.6;
            font-size: 11pt;
        }}
        h1 {{
            color: #4f46e5;
            border-bottom: 2px solid #4f46e5;
            padding-bottom: 8px;
            font-size: 20pt;
        }}
        h2 {{
            color: #4338ca;
            margin-top: 28px;
            font-size: 16pt;
        }}
        h3 {{
            color: #6366f1;
            font-size: 13pt;
        }}
        table {{
            border-collapse: collapse;
            width: 100%;
            margin: 12px 0;
            font-size: 10pt;
        }}
        th, td {{
            border: 1px solid #d1d5db;
            padding: 6px 10px;
            text-align: left;
        }}
        th {{
            background-color: #f3f4f6;
            font-weight: 600;
        }}
        tr:nth-child(even) {{
            background-color: #f9fafb;
        }}
        code {{
            background: #f3f4f6;
            padding: 1px 4px;
            border-radius: 3px;
            font-size: 10pt;
        }}
        hr {{
            border: none;
            border-top: 1px solid #e5e7eb;
            margin: 18px 0;
        }}
        ul {{
            padding-left: 20px;
        }}
        li {{
            margin: 3px 0;
        }}
        strong {{
            color: #1f2937;
        }}
        em {{
            color: #6b7280;
        }}
        blockquote {{
            border-left: 3px solid #6366f1;
            margin: 10px 0;
            padding: 8px 16px;
            background: #f5f3ff;
            color: #4338ca;
        }}
    </style>
</head>
<body>
{html_body}
</body>
</html>"""

    return styled_html


@router.post("/markdown")
async def export_markdown(
    request: ExportRequest,
    database: Session = Depends(get_db),
):
    """Export the scope document as Markdown."""
    try:
        markdown_content = export_service.export_markdown(
            database=database,
            session_id=request.session_id,
            include_deferred=request.include_deferred,
            include_change_log=request.include_change_log,
            include_assignments=request.include_assignments,
            date_from=request.date_from,
        )

        filename = f"scope_document_{datetime.utcnow().strftime('%Y%m%d_%H%M%S')}.md"

        return {
            "session_id": request.session_id,
            "format": "markdown",
            "content": markdown_content,
            "filename": filename,
            "generated_at": datetime.utcnow().isoformat(),
        }

    except ValueError as error:
        raise HTTPException(status_code=404, detail=str(error))
    except Exception as error:
        logger.error(f"Error exporting markdown: {str(error)}")
        raise HTTPException(status_code=500, detail=str(error))


@router.post("/json")
async def export_json(
    request: ExportRequest,
    database: Session = Depends(get_db),
):
    """Export the scope document as structured JSON."""
    try:
        json_content = export_service.export_json(
            database=database,
            session_id=request.session_id,
            include_deferred=request.include_deferred,
            include_change_log=request.include_change_log,
            include_assignments=request.include_assignments,
        )

        filename = f"scope_document_{datetime.utcnow().strftime('%Y%m%d_%H%M%S')}.json"

        return {
            "session_id": request.session_id,
            "format": "json",
            "content": json_content,
            "filename": filename,
            "generated_at": datetime.utcnow().isoformat(),
        }

    except ValueError as error:
        raise HTTPException(status_code=404, detail=str(error))
    except Exception as error:
        logger.error(f"Error exporting JSON: {str(error)}")
        raise HTTPException(status_code=500, detail=str(error))


@router.post("/pdf")
async def export_pdf(
    request: ExportRequest,
    database: Session = Depends(get_db),
):
    """
    Export the scope document as a styled PDF file.
    Uses fpdf2 (pure Python, zero system dependencies).
    """
    try:
        from fpdf import FPDF

        markdown_content = export_service.export_markdown(
            database=database,
            session_id=request.session_id,
            include_deferred=request.include_deferred,
            include_change_log=request.include_change_log,
            include_assignments=request.include_assignments,
            date_from=request.date_from,
        )

        filename = f"scope_document_{datetime.utcnow().strftime('%Y%m%d_%H%M%S')}.pdf"

        # ── Page layout constants (A4 = 210 x 297 mm) ──
        LEFT_MARGIN = 15
        RIGHT_MARGIN = 15
        USABLE_WIDTH = 210 - LEFT_MARGIN - RIGHT_MARGIN  # 180 mm

        # ── Colour palette ──
        COLOR_PRIMARY = (79, 70, 229)
        COLOR_H2 = (67, 56, 202)
        COLOR_H3 = (99, 102, 241)
        COLOR_BODY = (51, 51, 51)
        COLOR_MUTED = (107, 114, 128)
        COLOR_TABLE_HEADER_BG = (243, 244, 246)
        COLOR_TABLE_BORDER = (209, 213, 219)

        pdf = FPDF()
        pdf.set_margins(LEFT_MARGIN, 15, RIGHT_MARGIN)
        pdf.set_auto_page_break(auto=True, margin=20)
        pdf.add_page()

        # ──────────────────────────────────────────────
        # Helper: write a block of text at a known position.
        # Always resets X explicitly so we never inherit a
        # stale cursor position from a previous multi_cell.
        # ──────────────────────────────────────────────
        def write_block(
            text,
            style="",
            size=10,
            color=COLOR_BODY,
            indent_mm=0,
        ):
            x_start = LEFT_MARGIN + indent_mm
            available_width = USABLE_WIDTH - indent_mm
            # Guard: never let width drop below 50 mm
            if available_width < 50:
                available_width = USABLE_WIDTH
                x_start = LEFT_MARGIN

            line_height = max(size * 0.55, 4.5)

            pdf.set_font("Helvetica", style, size)
            pdf.set_text_color(*color)
            pdf.set_x(x_start)
            pdf.multi_cell(
                w=available_width,
                h=line_height,
                text=text,
                new_x="LMARGIN",
                new_y="NEXT",
            )

        # ── Iterate over every markdown line ──
        for raw_line in markdown_content.split("\n"):
            line = raw_line.rstrip()

            # ── Empty line → small vertical spacer ──
            if not line:
                pdf.ln(3)
                continue

            # ── Horizontal rule ──
            if line.strip() == "---":
                current_y = pdf.get_y()
                pdf.set_draw_color(*COLOR_TABLE_BORDER)
                pdf.line(LEFT_MARGIN, current_y, LEFT_MARGIN + USABLE_WIDTH, current_y)
                pdf.ln(5)
                continue

            # ── H1 heading ──
            if line.startswith("# "):
                pdf.ln(2)
                write_block(line[2:].strip(), "B", 18, COLOR_PRIMARY)
                underline_y = pdf.get_y() + 1
                pdf.set_draw_color(*COLOR_PRIMARY)
                pdf.set_line_width(0.6)
                pdf.line(LEFT_MARGIN, underline_y, LEFT_MARGIN + USABLE_WIDTH, underline_y)
                pdf.set_line_width(0.2)
                pdf.ln(6)
                continue

            # ── H3 heading (check before H2) ──
            if line.startswith("### "):
                pdf.ln(3)
                write_block(line[4:].strip(), "B", 12, COLOR_H3)
                pdf.ln(2)
                continue

            # ── H2 heading ──
            if line.startswith("## "):
                pdf.ln(4)
                write_block(line[3:].strip(), "B", 14, COLOR_H2)
                pdf.ln(3)
                continue

            # ── Table rows ──
            if line.startswith("|"):
                cells = [c.strip() for c in line.split("|")[1:-1]]
                if not cells:
                    continue
                # Skip separator rows like |---|---|
                if all(set(c) <= {"-", ":", " "} for c in cells):
                    continue

                # Limit columns so each is at least 30 mm wide
                min_column_width = 30
                max_columns = max(1, int(USABLE_WIDTH / min_column_width))
                visible_cells = cells[:max_columns]
                column_width = USABLE_WIDTH / len(visible_cells)

                row_height = 8
                row_top_y = pdf.get_y()
                if row_top_y > 265:
                    pdf.add_page()
                    row_top_y = pdf.get_y()

                for col_index, cell_text in enumerate(visible_cells):
                    cell_x = LEFT_MARGIN + col_index * column_width
                    # Cell background + border
                    pdf.set_fill_color(*COLOR_TABLE_HEADER_BG)
                    pdf.set_draw_color(*COLOR_TABLE_BORDER)
                    pdf.rect(cell_x, row_top_y, column_width, row_height, style="D")
                    # Text inside cell (clipped to fit)
                    pdf.set_font("Helvetica", "", 8)
                    pdf.set_text_color(*COLOR_BODY)
                    max_chars = max(1, int(column_width / 2.2))
                    clipped_text = cell_text[:max_chars]
                    pdf.set_xy(cell_x + 1.5, row_top_y + 2)
                    pdf.cell(w=column_width - 3, h=4, text=clipped_text)

                pdf.set_xy(LEFT_MARGIN, row_top_y + row_height)
                continue

            # ── Bold metadata line  **Key:** value ──
            if line.startswith("**") and "**" in line[2:]:
                clean_text = line.replace("**", "")
                write_block(clean_text, "B", 10, COLOR_BODY)
                continue

            # ── Checkbox line  - [ ] item ──
            if line.strip().startswith("- [ ]"):
                checkbox_text = line.strip()[5:].strip()
                write_block("[ ]  " + checkbox_text, "", 9, COLOR_BODY, indent_mm=10)
                continue

            # ── Nested checkbox   - [ ] item ──
            if line.strip().startswith("- [ ]"):
                checkbox_text = line.strip()[5:].strip()
                write_block("[ ]  " + checkbox_text, "", 9, COLOR_BODY, indent_mm=14)
                continue

            # ── Bullet points ──
            if line.startswith("- ") or line.startswith("  - "):
                is_nested = line.startswith("  ")
                indent_mm = 10 if is_nested else 5
                bullet_text = line.lstrip(" -").strip()

                # Bold bullet  - **text**
                if bullet_text.startswith("**") and "**" in bullet_text[2:]:
                    write_block(
                        "  -  " + bullet_text.replace("**", ""),
                        "B", 9, COLOR_BODY, indent_mm=indent_mm,
                    )
                else:
                    write_block(
                        "  -  " + bullet_text,
                        "", 9, COLOR_BODY, indent_mm=indent_mm,
                    )
                continue

            # ── Italic line  *text* ──
            stripped = line.strip()
            if stripped.startswith("*") and stripped.endswith("*") and not stripped.startswith("**"):
                write_block(stripped.strip("*"), "I", 9, COLOR_MUTED)
                continue

            # ── Indented continuation text (2+ leading spaces) ──
            if line.startswith("  ") and not line.startswith("  -"):
                write_block(line.strip(), "", 9, COLOR_BODY, indent_mm=10)
                continue

            # ── Default body paragraph ──
            write_block(line, "", 10, COLOR_BODY)

        pdf_bytes = pdf.output()
        logger.info(f"PDF generated successfully ({len(pdf_bytes)} bytes)")

        return Response(
            content=bytes(pdf_bytes),
            media_type="application/pdf",
            headers={
                "Content-Disposition": f'attachment; filename="{filename}"',
            },
        )

    except HTTPException:
        raise
    except ValueError as error:
        raise HTTPException(status_code=404, detail=str(error))
    except Exception as error:
        logger.error(f"Error exporting PDF: {str(error)}")
        raise HTTPException(status_code=500, detail=str(error))
