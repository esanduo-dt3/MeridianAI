"""Word (.docx) parsing.

python-docx keeps tables out of `document.paragraphs`, so reading paragraphs
alone silently drops every table. This walks the body's XML children instead, so
paragraphs and tables stay interleaved in the order the author wrote them, and
maps heading styles straight to heading levels. Text only (D-022): embedded
images are not captioned.
"""

from __future__ import annotations

import re
from io import BytesIO

import docx
from docx.oxml.ns import qn
from docx.table import Table as DocxTable
from docx.text.paragraph import Paragraph

from app.rag.documents import ParsedDocument, heading, list_item, para, table

_HEADING_STYLE = re.compile(r"^Heading\s+(\d)", re.I)


def cells_to_markdown(rows: list[list[str]]) -> str:
    """Render a cell grid as a GitHub-flavoured Markdown table."""
    if not rows:
        return ""
    width = max(len(r) for r in rows)
    padded = [
        [(c or "").replace("|", "\\|").replace("\n", " ").strip() for c in r] + [""] * (width - len(r))
        for r in rows
    ]
    header, *body = padded
    if not any(header):
        header = [f"col{i + 1}" for i in range(width)]
        body = padded
    lines = ["| " + " | ".join(header) + " |", "| " + " | ".join(["---"] * width) + " |"]
    lines += ["| " + " | ".join(r) + " |" for r in body]
    return "\n".join(lines)


def parse_docx(data: bytes) -> ParsedDocument:
    document = docx.Document(BytesIO(data))
    parsed = ParsedDocument(elements=[], doc_type="docx")

    for child in document.element.body.iterchildren():
        if child.tag == qn("w:p"):
            paragraph = Paragraph(child, document)
            text = paragraph.text.strip()
            if not text:
                continue
            style = ((paragraph.style.name if paragraph.style else "") or "").strip()
            match = _HEADING_STYLE.match(style)
            if match:
                # Title is the document root, so Heading 1 sits one level under it.
                parsed.elements.append(heading(text, int(match.group(1)) + 1))
            elif style.lower() in ("title", "subtitle"):
                parsed.elements.append(heading(text, 1 if style.lower() == "title" else 2))
            elif style.lower().startswith("list"):
                parsed.elements.append(list_item(text))
            else:
                parsed.elements.append(para(text))
        elif child.tag == qn("w:tbl"):
            rows = [[cell.text for cell in row.cells] for row in DocxTable(child, document).rows]
            markdown = cells_to_markdown(rows)
            if markdown:
                parsed.elements.append(table(markdown, rows=max(0, len(rows) - 1)))
                parsed.bump("tables")

    parsed.bump("paragraphs", sum(1 for e in parsed.elements if e.kind in ("paragraph", "list")))
    return parsed
