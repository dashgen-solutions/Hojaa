"""
API routes for exporting scope documents.
Phase 6: Export & Documentation — fully featured.

Routes:
  POST /export/markdown   → Markdown with all options
  POST /export/json       → Structured JSON with all options
  POST /export/pdf        → Styled PDF (cover page, TOC, headers/footers)
  POST /export/deferred   → Standalone deferred-items report
  POST /export/changelog  → Standalone change-log report (grouped by date)
  POST /export/summary    → AI executive summary (AI-3.5)
"""
import asyncio
import io
from datetime import datetime
from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import Response
from sqlalchemy.orm import Session
from app.db.session import get_db
from app.models.schemas import ExportRequest
from app.services.export_service import export_service
from app.services.pdf_generator import PDFGenerator
from app.core.config import settings
from app.core.logger import get_logger

logger = get_logger(__name__)

router = APIRouter(prefix="/export", tags=["export"])


# ──────────────────────────────────────────────────────────────
#  Helper: Markdown → styled HTML (kept for potential future use)
# ──────────────────────────────────────────────────────────────

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
        @page {{ size: A4; margin: 20mm; }}
        body {{
            font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
            max-width: 800px; margin: 0 auto; padding: 20px;
            color: #333; line-height: 1.6; font-size: 11pt;
        }}
        h1 {{ color: #4f46e5; border-bottom: 2px solid #4f46e5; padding-bottom: 8px; font-size: 20pt; }}
        h2 {{ color: #4338ca; margin-top: 28px; font-size: 16pt; }}
        h3 {{ color: #6366f1; font-size: 13pt; }}
        table {{ border-collapse: collapse; width: 100%; margin: 12px 0; font-size: 10pt; }}
        th, td {{ border: 1px solid #d1d5db; padding: 6px 10px; text-align: left; }}
        th {{ background-color: #f3f4f6; font-weight: 600; }}
        tr:nth-child(even) {{ background-color: #f9fafb; }}
        code {{ background: #f3f4f6; padding: 1px 4px; border-radius: 3px; font-size: 10pt; }}
        hr {{ border: none; border-top: 1px solid #e5e7eb; margin: 18px 0; }}
        ul {{ padding-left: 20px; }}
        li {{ margin: 3px 0; }}
        strong {{ color: #1f2937; }}
        em {{ color: #6b7280; }}
        blockquote {{
            border-left: 3px solid #6366f1; margin: 10px 0;
            padding: 8px 16px; background: #f5f3ff; color: #4338ca;
        }}
    </style>
</head>
<body>
{html_body}
</body>
</html>"""

    return styled_html


# ──────────────────────────────────────────────────────────────
#  MARKDOWN
# ──────────────────────────────────────────────────────────────

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
            include_sources=request.include_sources,
            include_completed=request.include_completed,
            include_conversations=request.include_conversations,
            detail_level=request.detail_level,
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


# ──────────────────────────────────────────────────────────────
#  DEFERRED STANDALONE
# ──────────────────────────────────────────────────────────────

@router.post("/deferred")
async def export_deferred(
    request: ExportRequest,
    database: Session = Depends(get_db),
):
    """Export only deferred items as a standalone Phase 2 document."""
    try:
        markdown_content = export_service.export_deferred_markdown(
            database=database,
            session_id=request.session_id,
        )

        filename = f"phase2_deferred_{datetime.utcnow().strftime('%Y%m%d_%H%M%S')}.md"

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
        logger.error(f"Error exporting deferred items: {str(error)}")
        raise HTTPException(status_code=500, detail=str(error))


# ──────────────────────────────────────────────────────────────
#  STANDALONE CHANGE LOG
# ──────────────────────────────────────────────────────────────

@router.post("/changelog")
async def export_changelog(
    request: ExportRequest,
    database: Session = Depends(get_db),
):
    """Export a standalone change-log report grouped by date."""
    try:
        markdown_content = export_service.export_changelog_markdown(
            database=database,
            session_id=request.session_id,
            date_from=request.date_from,
            include_sources=request.include_sources,
        )

        filename = f"changelog_{datetime.utcnow().strftime('%Y%m%d_%H%M%S')}.md"

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
        logger.error(f"Error exporting changelog: {str(error)}")
        raise HTTPException(status_code=500, detail=str(error))


# ──────────────────────────────────────────────────────────────
#  JSON
# ──────────────────────────────────────────────────────────────

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
            include_sources=request.include_sources,
            include_completed=request.include_completed,
            include_conversations=request.include_conversations,
            detail_level=request.detail_level,
            date_from=request.date_from,
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


# ──────────────────────────────────────────────────────────────
#  AI-3.5: AI Executive Summary
# ──────────────────────────────────────────────────────────────


@router.post("/summary")
async def export_summary(
    request: ExportRequest,
    database: Session = Depends(get_db),
):
    """
    Generate an AI executive summary for the scope document.
    Returns key themes, risk highlights, and a synthesised overview.
    """
    try:
        from app.services.ai_features_service import generate_export_summary
        summary = await generate_export_summary(database, request.session_id)
        return summary
    except Exception as error:
        logger.error(f"Error generating AI summary: {error}")
        raise HTTPException(status_code=500, detail=str(error))


# ──────────────────────────────────────────────────────────────
#  PDF  (uses PDFGenerator service — see services/pdf_generator.py)
# ──────────────────────────────────────────────────────────────


@router.post("/pdf")
async def export_pdf(
    request: ExportRequest,
    database: Session = Depends(get_db),
):
    """
    Export the scope document as a styled PDF with cover page,
    table of contents, and page headers/footers.
    """
    try:
        markdown_content = export_service.export_markdown(
            database=database,
            session_id=request.session_id,
            include_deferred=request.include_deferred,
            include_change_log=request.include_change_log,
            include_assignments=request.include_assignments,
            include_sources=request.include_sources,
            include_completed=request.include_completed,
            include_conversations=request.include_conversations,
            detail_level=request.detail_level,
            date_from=request.date_from,
        )

        filename = f"scope_document_{datetime.utcnow().strftime('%Y%m%d_%H%M%S')}.pdf"

        # Extract project name for cover / headers
        project_name = "Scope Document"
        for line in markdown_content.split("\n"):
            if line.startswith("# "):
                project_name = line[2:].strip()
                break

        # Determine session name
        session_name = request.session_id
        try:
            from app.models.database import Session as SessionModel
            sess = database.query(SessionModel).filter(
                SessionModel.id == request.session_id
            ).first()
            if sess and sess.document_filename:
                session_name = sess.document_filename
        except Exception:
            pass

        scope_pdf = PDFGenerator()
        scope_pdf.add_cover(project_name, str(session_name))
        scope_pdf.add_toc()

        # Content pages
        scope_pdf.pdf.add_page()
        scope_pdf.render_markdown(markdown_content)

        # Back-fill TOC page numbers and add headers/footers
        scope_pdf._fill_toc()
        scope_pdf.add_headers_footers(project_name)

        # PERF-1.3 — run PDF byte serialisation with timeout
        loop = asyncio.get_event_loop()
        try:
            pdf_bytes = await asyncio.wait_for(
                loop.run_in_executor(None, scope_pdf.output),
                timeout=settings.pdf_timeout_seconds,
            )
        except asyncio.TimeoutError:
            raise HTTPException(
                status_code=504,
                detail=f"PDF generation timed out after {settings.pdf_timeout_seconds}s",
            )
        logger.info(f"PDF generated successfully ({len(pdf_bytes)} bytes)")

        return Response(
            content=pdf_bytes,
            media_type="application/pdf",
            headers={"Content-Disposition": f'attachment; filename="{filename}"'},
        )

    except HTTPException:
        raise
    except ValueError as error:
        raise HTTPException(status_code=404, detail=str(error))
    except Exception as error:
        logger.error(f"Error exporting PDF: {str(error)}")
        raise HTTPException(status_code=500, detail=str(error))
