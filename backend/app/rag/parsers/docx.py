"""Word (.docx) parsing.

``document.paragraphs`` skips tables, so reading paragraphs alone silently drops
every table in the file. This parser walks the body's XML children instead, so
paragraphs and tables stay interleaved exactly as the author wrote them, and
maps Word's heading styles straight onto heading levels.

Text only (D-022): embedded images are not captioned, and only body-level
``w:p``/``w:tbl`` are read (text boxes, headers, footers, footnotes, comments
and ``w:sdt`` content controls are out of scope). Word gives no page numbers.
"""

from __future__ import annotations

import re
from io import BytesIO

import docx
from docx.oxml.ns import qn
from docx.table import Table as DocxTable
from docx.text.paragraph import Paragraph

from app.rag.documents import DocElement, ParsedDocument, heading, list_item, para, table

_HEADING_STYLE = re.compile(r"^Heading\s+(\d)", re.I)

# "Title" is the document root, so "Heading 1" sits one level beneath it.
_TITLE_LEVELS = {"title": 1, "subtitle": 2}
_HEADING_LEVEL_OFFSET = 1


# PUBLIC_INTERFACE
def cells_to_markdown(rows: list[list[str]]) -> str:
    """Render a rectangular cell grid as a GitHub-flavoured Markdown table.

    Pipes inside cells are escaped and newlines flattened so one row stays one
    line, which is what lets the chunker split an oversized table by rows. When
    the first row is entirely blank it is not a header, so ``col1..colN``
    headers are generated and every source row is kept as a body row.

    :param rows: Rows of cell text; ragged rows are padded to the widest row.
    :returns: The Markdown table, or ``""`` when there are no rows.
    """
    if not rows:
        return ""
    width = max(len(row) for row in rows)
    padded = [
        [(cell or "").replace("|", "\\|").replace("\n", " ").strip() for cell in row] + [""] * (width - len(row))
        for row in rows
    ]
    header, *body = padded
    if not any(header):
        header = [f"col{i + 1}" for i in range(width)]
        body = padded
    lines = [
        "| " + " | ".join(header) + " |",
        "| " + " | ".join(["---"] * width) + " |",
    ]
    lines.extend("| " + " | ".join(row) + " |" for row in body)
    return "\n".join(lines)


def _paragraph_element(paragraph: Paragraph) -> DocElement | None:
    """Map one Word paragraph onto an element, or None when it is empty."""
    text = paragraph.text.strip()
    if not text:
        return None

    style = ((paragraph.style.name if paragraph.style else "") or "").strip()
    match = _HEADING_STYLE.match(style)
    if match:
        return heading(text, int(match.group(1)) + _HEADING_LEVEL_OFFSET)

    lowered = style.lower()
    if lowered in _TITLE_LEVELS:
        return heading(text, _TITLE_LEVELS[lowered])
    if lowered.startswith("list"):
        return list_item(text)
    return para(text)


def _table_element(child, document) -> DocElement | None:
    """Render one ``w:tbl`` as a Markdown table element, or None when empty."""
    rows = [[cell.text for cell in row.cells] for row in DocxTable(child, document).rows]
    markdown = cells_to_markdown(rows)
    if not markdown:
        return None
    # The header row is not data, so it is excluded from the row count.
    return table(markdown, rows=max(0, len(rows) - 1))


# PUBLIC_INTERFACE
def parse_docx(data: bytes) -> ParsedDocument:
    """Parse a Word document into ordered elements.

    :param data: The complete ``.docx`` bytes (already validated by ``check_file``).
    :returns: The parsed document, with ``tables`` and ``paragraphs`` statistics.
    """
    document = docx.Document(BytesIO(data))
    parsed = ParsedDocument(elements=[], doc_type="docx")

    for child in document.element.body.iterchildren():
        if child.tag == qn("w:p"):
            element = _paragraph_element(Paragraph(child, document))
            if element is not None:
                parsed.add(element)
        elif child.tag == qn("w:tbl"):
            element = _table_element(child, document)
            if element is not None:
                parsed.add(element)
                parsed.bump("tables")

    parsed.bump("paragraphs", sum(1 for e in parsed.elements if e.kind in ("paragraph", "list")))
    return parsed
