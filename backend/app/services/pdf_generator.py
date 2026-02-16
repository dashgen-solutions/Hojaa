"""
SVC-6.2 — PDF Generator Service.

Dedicated service for generating branded PDF scope documents.
Provides:
- Cover page with project metadata
- Auto-generated Table of Contents
- Page headers / footers with branding
- Markdown-to-PDF rendering (headings, tables, bullets, checkboxes, etc.)
- Unicode font support (DejaVu) with Helvetica fallback

Extracted from routes/export.py::_ScopePDF into a proper,
independently importable service.
"""
import os
from datetime import datetime
from app.core.logger import get_logger

logger = get_logger(__name__)


class PDFGenerator:
    """Generates a branded scope PDF from Markdown content."""

    # ── Default colour palette (overridden by brand settings) ──
    PRIMARY = (79, 70, 229)
    H2 = (67, 56, 202)
    H3 = (99, 102, 241)
    BODY = (51, 51, 51)
    MUTED = (107, 114, 128)
    TABLE_HEADER_BG = (243, 244, 246)
    TABLE_BORDER = (209, 213, 219)
    WHITE = (255, 255, 255)
    LIGHT_BG = (249, 250, 251)

    LEFT = 15
    RIGHT = 15
    WIDTH = 210 - 15 - 15  # 180 mm usable

    # DejaVu font search paths
    _FONT_SEARCH_DIRS = [
        "/usr/share/fonts/truetype/dejavu",
        "/usr/share/fonts/dejavu",
        "/usr/share/fonts/TTF",
    ]
    _FONT_FILES = {
        "": "DejaVuSans.ttf",
        "B": "DejaVuSans-Bold.ttf",
        "I": "DejaVuSans-Oblique.ttf",
        "BI": "DejaVuSans-BoldOblique.ttf",
    }

    def __init__(self, brand: dict | None = None):
        from fpdf import FPDF

        # Apply branding overrides (instance attrs shadow class defaults)
        self._apply_brand(brand or {})

        self.pdf = FPDF()
        self.pdf.set_margins(self.LEFT, 15, self.RIGHT)
        self.pdf.set_auto_page_break(auto=True, margin=25)
        self.toc_entries: list[tuple[str, int]] = []

        self.font = self._register_unicode_font()
        if self.font != "Helvetica":
            logger.info(f"PDF using Unicode font: {self.font}")
        else:
            logger.info("PDF using Helvetica (Unicode chars will be transliterated)")

    # ── Branding helpers ─────────────────────────────────────────

    @staticmethod
    def _hex_to_rgb(hex_color: str) -> tuple:
        """Convert '#RRGGBB' to (R, G, B) tuple."""
        h = hex_color.lstrip("#")
        return (int(h[0:2], 16), int(h[2:4], 16), int(h[4:6], 16))

    @staticmethod
    def _lighten(rgb: tuple, amount: int = 30) -> tuple:
        """Lighten an RGB colour by *amount* (clamped to 255)."""
        return tuple(min(255, c + amount) for c in rgb)

    @staticmethod
    def _darken(rgb: tuple, amount: int = 20) -> tuple:
        """Darken an RGB colour by *amount* (clamped to 0)."""
        return tuple(max(0, c - amount) for c in rgb)

    def _apply_brand(self, brand: dict):
        """Override palette & text from a BrandSettings-like dict."""
        self.app_name = brand.get("app_name") or "MoMetric"
        self.pdf_header_text = brand.get("pdf_header_text")
        self.pdf_footer_text = brand.get("pdf_footer_text")
        self.brand_tagline = brand.get("tagline")

        if brand.get("primary_color"):
            self.PRIMARY = self._hex_to_rgb(brand["primary_color"])
        if brand.get("secondary_color"):
            self.H2 = self._hex_to_rgb(brand["secondary_color"])
        else:
            self.H2 = self._darken(self.PRIMARY, 15)
        if brand.get("accent_color"):
            self.H3 = self._hex_to_rgb(brand["accent_color"])
        if brand.get("text_color"):
            self.BODY = self._hex_to_rgb(brand["text_color"])
            self.MUTED = self._lighten(self.BODY, 60)

    # ── Font registration ────────────────────────────────────────

    def _register_unicode_font(self) -> str:
        for font_dir in self._FONT_SEARCH_DIRS:
            base = os.path.join(font_dir, self._FONT_FILES[""])
            if os.path.exists(base):
                for style, filename in self._FONT_FILES.items():
                    self.pdf.add_font("DejaVu", style,
                                      os.path.join(font_dir, filename))
                return "DejaVu"
        return "Helvetica"

    def _safe(self, text: str) -> str:
        if self.font != "Helvetica":
            return text
        replacements = str.maketrans({
            '\u2014': '--', '\u2013': '-', '\u2018': "'", '\u2019': "'",
            '\u201c': '"',  '\u201d': '"', '\u2026': '...', '\u2022': '-',
            '\u2192': '->', '\u2190': '<-', '\u2713': '[x]', '\u2717': '[ ]',
            '\u00a0': ' ',  '\u200b': '',  '\u2212': '-',
        })
        text = text.translate(replacements)
        return text.encode('latin-1', errors='replace').decode('latin-1')

    # ── Cover page ───────────────────────────────────────────────

    def add_cover(self, project_name: str, session_name: str,
                   document_type: str = "Scope Document"):
        pdf = self.pdf
        pdf.add_page()

        pdf.set_fill_color(*self.PRIMARY)
        pdf.rect(0, 0, 210, 60, "F")

        pdf.set_font(self.font, "B", 28)
        pdf.set_text_color(*self.WHITE)
        pdf.set_xy(self.LEFT, 18)
        pdf.multi_cell(w=self.WIDTH, h=12, text=self._safe(document_type),
                       new_x="LMARGIN", new_y="NEXT")

        pdf.set_font(self.font, "", 16)
        pdf.set_xy(self.LEFT, 38)
        pdf.multi_cell(w=self.WIDTH, h=8, text=self._safe(project_name),
                       new_x="LMARGIN", new_y="NEXT")

        pdf.set_text_color(*self.BODY)
        pdf.set_y(75)
        meta_items = [
            ("Session", session_name),
            ("Generated", datetime.utcnow().strftime("%B %d, %Y at %H:%M UTC")),
            ("Tool", self.app_name),
        ]
        for label, value in meta_items:
            pdf.set_font(self.font, "B", 11)
            pdf.set_x(self.LEFT)
            pdf.cell(w=35, h=8, text=f"{label}:")
            pdf.set_font(self.font, "", 11)
            pdf.cell(w=self.WIDTH - 35, h=8, text=self._safe(value),
                     new_x="LMARGIN", new_y="NEXT")

        # Optional tagline below metadata
        if self.brand_tagline:
            pdf.ln(6)
            pdf.set_font(self.font, "I", 10)
            pdf.set_text_color(*self.MUTED)
            pdf.set_x(self.LEFT)
            pdf.cell(w=self.WIDTH, h=6, text=self._safe(self.brand_tagline))

        pdf.set_y(270)
        pdf.set_font(self.font, "I", 8)
        pdf.set_text_color(*self.MUTED)
        footer_text = self.pdf_footer_text or f"Confidential \u2014 generated by {self.app_name}"
        pdf.cell(w=self.WIDTH, h=5,
                 text=self._safe(footer_text),
                 align="C")

    # ── Table of Contents ────────────────────────────────────────

    def add_toc(self):
        pdf = self.pdf
        pdf.add_page()
        pdf.set_font(self.font, "B", 18)
        pdf.set_text_color(*self.PRIMARY)
        pdf.cell(w=self.WIDTH, h=12, text="Table of Contents",
                 new_x="LMARGIN", new_y="NEXT")
        pdf.ln(6)
        self._toc_page = pdf.page
        self._toc_y = pdf.get_y()

    def _fill_toc(self):
        pdf = self.pdf
        current_page = pdf.page
        pdf.page = self._toc_page
        pdf.set_y(self._toc_y)

        for title, page_no in self.toc_entries:
            pdf.set_font(self.font, "", 11)
            pdf.set_text_color(*self.BODY)
            pdf.set_x(self.LEFT)
            dots = "." * max(1, 80 - len(title))
            pdf.cell(w=self.WIDTH - 15, h=7,
                     text=f"{self._safe(title)}  {dots}")
            pdf.set_font(self.font, "B", 11)
            pdf.cell(w=15, h=7, text=str(page_no), align="R",
                     new_x="LMARGIN", new_y="NEXT")

        pdf.page = current_page

    # ── Page headers & footers ───────────────────────────────────

    def add_headers_footers(self, project_name: str):
        pdf = self.pdf
        total = pdf.pages_count

        header_right = self.pdf_header_text or self.app_name

        for page_num in range(1, total + 1):
            if page_num == 1:
                continue
            pdf.page = page_num

            pdf.set_y(5)
            pdf.set_font(self.font, "", 7)
            pdf.set_text_color(*self.MUTED)
            pdf.set_x(self.LEFT)
            pdf.cell(w=self.WIDTH / 2, h=4,
                     text=self._safe(project_name[:60]))
            pdf.cell(w=self.WIDTH / 2, h=4, text=self._safe(header_right),
                     align="R", new_x="LMARGIN", new_y="NEXT")
            pdf.set_draw_color(*self.PRIMARY)
            pdf.set_line_width(0.3)
            pdf.line(self.LEFT, 10, self.LEFT + self.WIDTH, 10)

            pdf.set_y(287)
            pdf.set_font(self.font, "", 8)
            pdf.set_text_color(*self.MUTED)
            pdf.set_x(self.LEFT)
            footer = self.pdf_footer_text or f"Page {page_num} of {total}"
            if self.pdf_footer_text:
                footer = f"{self.pdf_footer_text}  |  Page {page_num} of {total}"
            pdf.cell(w=self.WIDTH, h=4, text=self._safe(footer),
                     align="C")

    # ── Write helpers ────────────────────────────────────────────

    def write_block(self, text, style="", size=10, color=None, indent_mm=0):
        color = color or self.BODY
        x_start = self.LEFT + indent_mm
        available = self.WIDTH - indent_mm
        if available < 50:
            available = self.WIDTH
            x_start = self.LEFT

        line_h = max(size * 0.55, 4.5)
        self.pdf.set_font(self.font, style, size)
        self.pdf.set_text_color(*color)
        self.pdf.set_x(x_start)
        self.pdf.multi_cell(w=available, h=line_h, text=self._safe(text),
                            new_x="LMARGIN", new_y="NEXT")

    # ── Render markdown content ──────────────────────────────────

    def render_markdown(self, markdown_content: str):
        pdf = self.pdf
        self._line_number = 0

        for raw_line in markdown_content.split("\n"):
            line = raw_line.rstrip()
            self._line_number += 1

            # Frontmatter — only treat --- as frontmatter start if within first 3 lines
            if line.strip() == "---":
                if hasattr(self, '_in_frontmatter') and self._in_frontmatter:
                    # Close frontmatter block
                    self._in_frontmatter = False
                    continue
                elif self._line_number <= 3 and not hasattr(self, '_in_frontmatter'):
                    # Open frontmatter only at document start
                    self._in_frontmatter = True
                    continue
                else:
                    # Regular horizontal rule
                    y = pdf.get_y()
                    pdf.set_draw_color(*self.TABLE_BORDER)
                    pdf.line(self.LEFT, y, self.LEFT + self.WIDTH, y)
                    pdf.ln(5)
                    continue

            if hasattr(self, '_in_frontmatter') and self._in_frontmatter:
                continue

            if not line:
                pdf.ln(3)
                continue

            # H1
            if line.startswith("# "):
                title = line[2:].strip()
                pdf.ln(2)
                self.write_block(title, "B", 18, self.PRIMARY)
                y = pdf.get_y() + 1
                pdf.set_draw_color(*self.PRIMARY)
                pdf.set_line_width(0.6)
                pdf.line(self.LEFT, y, self.LEFT + self.WIDTH, y)
                pdf.set_line_width(0.2)
                pdf.ln(6)
                continue

            # H3
            if line.startswith("### "):
                title = line[4:].strip()
                pdf.ln(3)
                self.write_block(title, "B", 12, self.H3)
                pdf.ln(2)
                continue

            # H2
            if line.startswith("## "):
                title = line[3:].strip()
                self.toc_entries.append((title, pdf.page))
                pdf.ln(4)
                self.write_block(title, "B", 14, self.H2)
                pdf.ln(3)
                continue

            # Table rows
            if line.startswith("|"):
                cells = [c.strip() for c in line.split("|")[1:-1]]
                if not cells:
                    continue
                if all(set(c) <= {"-", ":", " "} for c in cells):
                    continue

                min_col = 16
                max_cols = max(1, int(self.WIDTH / min_col))
                visible = cells[:max_cols]
                col_w = self.WIDTH / len(visible)
                row_h = 8
                row_y = pdf.get_y()

                if row_y > 265:
                    pdf.add_page()
                    row_y = pdf.get_y()

                for ci, ct in enumerate(visible):
                    cx = self.LEFT + ci * col_w
                    pdf.set_fill_color(*self.TABLE_HEADER_BG)
                    pdf.set_draw_color(*self.TABLE_BORDER)
                    pdf.rect(cx, row_y, col_w, row_h, style="D")
                    pdf.set_font(self.font, "", 8)
                    pdf.set_text_color(*self.BODY)
                    max_ch = max(1, int(col_w / 2.2))
                    pdf.set_xy(cx + 1.5, row_y + 2)
                    pdf.cell(w=col_w - 3, h=4,
                             text=self._safe(ct[:max_ch]))

                pdf.set_xy(self.LEFT, row_y + row_h)
                continue

            # Bold metadata
            if line.startswith("**") and "**" in line[2:]:
                self.write_block(line.replace("**", ""), "B", 10, self.BODY)
                continue

            # Checkbox
            if line.strip().startswith("- [ ]"):
                self.write_block("[ ]  " + line.strip()[5:].strip(), "", 9, self.BODY, indent_mm=10)
                continue

            # Blockquote
            if line.startswith("> "):
                self.write_block(line[2:].strip(), "I", 9, self.H3, indent_mm=8)
                continue

            # Bullets
            if line.startswith("- ") or line.startswith("  - "):
                nested = line.startswith("  ")
                indent = 10 if nested else 5
                text = line.lstrip(" -").strip()
                if text.startswith("**") and "**" in text[2:]:
                    self.write_block("  -  " + text.replace("**", ""), "B", 9, self.BODY, indent_mm=indent)
                else:
                    self.write_block("  -  " + text, "", 9, self.BODY, indent_mm=indent)
                continue

            # Italic
            stripped = line.strip()
            if stripped.startswith("*") and stripped.endswith("*") and not stripped.startswith("**"):
                self.write_block(stripped.strip("*"), "I", 9, self.MUTED)
                continue

            # Strikethrough
            if stripped.startswith("~~") and stripped.endswith("~~"):
                self.write_block(stripped.strip("~"), "I", 9, self.MUTED)
                continue

            # Backtick badges
            if stripped.startswith("`") and stripped.endswith("`"):
                self.write_block(stripped.strip("`"), "B", 8, self.H3, indent_mm=5)
                continue

            # Indented text
            if line.startswith("  ") and not line.startswith("  -"):
                self.write_block(line.strip(), "", 9, self.BODY, indent_mm=10)
                continue

            # Default
            self.write_block(line, "", 10, self.BODY)

    # ── High-level API ───────────────────────────────────────────

    def generate(
        self,
        markdown_content: str,
        project_name: str = "Scope Document",
        session_name: str = "",
        document_type: str = "Scope Document",
    ) -> bytes:
        """
        Generate a complete PDF from Markdown content.

        This is the main entry point — call this instead of manually
        invoking add_cover / add_toc / render_markdown / etc.

        Returns:
            PDF bytes ready for download.
        """
        self.add_cover(project_name, session_name, document_type=document_type)
        self.add_toc()
        self.pdf.add_page()
        self.render_markdown(markdown_content)
        self._fill_toc()
        self.add_headers_footers(project_name)
        return self.output()

    def output(self) -> bytes:
        return bytes(self.pdf.output())
