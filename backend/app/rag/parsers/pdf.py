"""Layout-aware PDF parsing with PyMuPDF (AGPL, docs/decisions.md D-024).

A plain text dump loses everything that makes a PDF answerable: which line was a
heading, where a table began and ended, and which lines were a running footer.
This parser recovers that structure in explicit passes:

1. **Collect** per page: find tables (ruled first, whitespace fallback), then
   read the text lines that do not sit inside a table's area, so table cells
   never leak back in as loose sentences.
2. **Measure** across the document: the body font size, the running headers and
   footers that repeat on most pages, and the heading size to level ranking.
3. **Assemble** per page: order items for reading (two-column pages read down
   the left column first), then emit headings, tables, code listings and
   paragraphs.

Text only (D-022): a page with no text layer is counted in the stats rather than
OCR'd, so the Documents page can say a scan was not readable.
"""

from __future__ import annotations

import logging
import re
from collections import Counter
from dataclasses import dataclass

import pymupdf

from app.rag.documents import ParsedDocument, code, heading, para, table

log = logging.getLogger(__name__)

_BOLD = 1 << 4                    # span flag bit: bold face
_MONO = 1 << 3                    # span flag bit: monospaced face
_BULLET = re.compile(r"^\s*(?:[•▪◦·\-\*]|\(?[a-z0-9]{1,3}[.)])\s+", re.I)
_NUMBERED_HEADING = re.compile(r"^\s*\d+(?:\.\d+)*\.?\s+\S")
_SENTENCE_END = re.compile(r"[.!?;:]\s*$")
_DIGITS = re.compile(r"\d+")

#: A page with fewer extracted characters than this has no usable text layer.
SCANNED_CHAR_THRESHOLD = 90

# Heading inference thresholds, relative to the document's body font size.
_HEADING_SIZE_RATIO = 1.12        # clearly larger than body text
_BOLD_HEADING_SIZE_RATIO = 0.97   # bold and no smaller than body text
_HEADING_MAX_CHARS = 130
_BOLD_HEADING_MAX_CHARS = 90
_CODE_SIZE_RATIO = 1.05           # monospaced lines no larger than this are a listing

# Table acceptance thresholds.
_TABLE_MAX_PAGE_FRACTION = 0.92   # a "table" covering the page is a false positive
_TABLE_MIN_ROWS = 2
_TEXT_TABLE_MIN_ROWS = 3
_TEXT_TABLE_MIN_COLS = 2
_TEXT_TABLE_MIN_FILL = 0.5
_TEXT_TABLE_MAX_MEAN_CELL = 40

# Two-column detection and running-header detection thresholds.
_COLUMN_MIN_LINES = 8
_COLUMN_TOLERANCE = 0.04          # fraction of page width around the midpoint
_COLUMN_MIN_SIDE_FRACTION = 0.25
_EDGE_MIN_PAGES = 4
_EDGE_MAX_CHARS = 90
_EDGE_PAGE_FRACTION = 0.6


@dataclass
class _Line:
    """One text line with the typography of its largest span."""

    text: str
    size: float
    bold: bool
    mono: bool
    x0: float
    y0: float
    x1: float
    y1: float


@dataclass
class _Table:
    """One detected table, already rendered as Markdown."""

    markdown: str
    rows: int
    x0: float
    y0: float
    x1: float
    y1: float


_Boxed = _Line | _Table


# ------------------------------- geometry helpers ------------------------------ #


def _overlaps(inner: tuple[float, ...], outer: tuple[float, ...], ratio: float = 0.5) -> bool:
    """True when `inner` sits mostly inside `outer`; used to mask table areas."""
    ix0, iy0 = max(inner[0], outer[0]), max(inner[1], outer[1])
    ix1, iy1 = min(inner[2], outer[2]), min(inner[3], outer[3])
    if ix1 <= ix0 or iy1 <= iy0:
        return False
    area = (inner[2] - inner[0]) * (inner[3] - inner[1])
    return area > 0 and ((ix1 - ix0) * (iy1 - iy0)) / area >= ratio


def _column_split(items: list[_Boxed], page_width: float) -> float | None:
    """Return the page midpoint when it is a real two-column gutter, else None."""
    if len(items) < _COLUMN_MIN_LINES:
        return None
    mid = page_width / 2
    tolerance = page_width * _COLUMN_TOLERANCE
    left = right = 0
    for item in items:
        # One full-width line means the page is not split into columns.
        if item.x0 < mid - tolerance and item.x1 > mid + tolerance:
            return None
        if item.x1 <= mid:
            left += 1
        elif item.x0 >= mid:
            right += 1
    needed = max(3, len(items) * _COLUMN_MIN_SIDE_FRACTION)
    return mid if min(left, right) >= needed else None


def _reading_order(items: list[_Boxed], page_width: float) -> list[_Boxed]:
    """Sort page items top to bottom, left to right, honouring a two-column gutter."""
    def key(item: _Boxed) -> tuple[float, float]:
        return (round(item.y0, 1), item.x0)

    gutter = _column_split(items, page_width)
    if gutter is None:
        return sorted(items, key=key)
    left = sorted([i for i in items if i.x1 <= gutter], key=key)
    right = sorted([i for i in items if i.x0 >= gutter], key=key)
    return left + right


# --------------------------------- collection --------------------------------- #


def _plausible_text_table(found) -> bool:
    """Guard the borderless fallback, which can otherwise claim a whole page."""
    if found.row_count < _TEXT_TABLE_MIN_ROWS or found.col_count < _TEXT_TABLE_MIN_COLS:
        return False
    cells = [str(c) for row in found.extract() for c in row if c]
    if len(cells) < found.row_count * found.col_count * _TEXT_TABLE_MIN_FILL:
        return False
    return sum(len(c) for c in cells) / len(cells) <= _TEXT_TABLE_MAX_MEAN_CELL


def _find_tables(page: pymupdf.Page) -> list[_Table]:
    """Detect tables on a page: ruled lines first, whitespace layout as fallback."""
    tables: list[_Table] = []
    try:
        found = list(page.find_tables().tables)
        if not found:
            found = [t for t in page.find_tables(strategy="text").tables if _plausible_text_table(t)]
    except Exception:  # noqa: BLE001 - table finding is best effort
        log.debug("table detection failed on page %s", page.number, exc_info=True)
        return tables

    page_area = page.rect.get_area() or 1.0
    for found_table in found:
        markdown = (found_table.to_markdown() or "").strip()
        bbox = tuple(found_table.bbox)
        area = max(0.0, bbox[2] - bbox[0]) * max(0.0, bbox[3] - bbox[1])
        if not markdown or found_table.row_count < _TABLE_MIN_ROWS or area / page_area > _TABLE_MAX_PAGE_FRACTION:
            continue
        tables.append(
            _Table(
                markdown=markdown,
                rows=max(0, found_table.row_count - 1),
                x0=bbox[0], y0=bbox[1], x1=bbox[2], y1=bbox[3],
            )
        )
    return tables


def _page_lines(page: pymupdf.Page, masks: list[tuple[float, ...]]) -> list[_Line]:
    """Read a page's text lines, skipping blocks covered by a table mask."""
    lines: list[_Line] = []
    for block in page.get_text("dict").get("blocks", []):
        if block.get("type") != 0 or any(_overlaps(tuple(block["bbox"]), mask) for mask in masks):
            continue
        for line in block.get("lines", []):
            spans = [s for s in line.get("spans", []) if s.get("text", "").strip()]
            text = "".join(s["text"] for s in line.get("spans", [])).strip()
            if not spans or not text:
                continue
            biggest = max(spans, key=lambda s: s.get("size", 0.0))
            flags = int(biggest.get("flags", 0))
            bbox = line.get("bbox", block["bbox"])
            lines.append(
                _Line(
                    text=text,
                    size=round(float(biggest.get("size", 0.0)), 1),
                    bold=bool(flags & _BOLD),
                    mono=bool(flags & _MONO),
                    x0=bbox[0], y0=bbox[1], x1=bbox[2], y1=bbox[3],
                )
            )
    return lines


# --------------------------------- measurement --------------------------------- #


def _body_size(lines: list[_Line]) -> float:
    """The font size carrying the most characters, i.e. the body text size."""
    weight: Counter[float] = Counter()
    for line in lines:
        weight[line.size] += len(line.text)
    return weight.most_common(1)[0][0] if weight else 10.0


def _normalise(text: str) -> str:
    """Blank digits so 'Page 3' and 'Page 4' compare equal."""
    return _DIGITS.sub("#", text).strip()


def _repeated_edges(pages: list[list[_Line]]) -> set[str]:
    """Running headers and footers: the same short edge line on most pages."""
    if len(pages) < _EDGE_MIN_PAGES:
        return set()
    seen: Counter[str] = Counter()
    for lines in pages:
        if not lines:
            continue
        ordered = sorted(lines, key=lambda l: l.y0)
        # A one-line page must not count its only line twice.
        edges = {id(ordered[0]): ordered[0], id(ordered[-1]): ordered[-1]}.values()
        for line in edges:
            stripped = _normalise(line.text)
            if 0 < len(stripped) <= _EDGE_MAX_CHARS:
                seen[stripped] += 1
    threshold = max(3, int(len(pages) * _EDGE_PAGE_FRACTION))
    return {text for text, count in seen.items() if count >= threshold}


def _is_heading(line: _Line, body: float) -> bool:
    """Infer a heading from typography: size relative to body text, or weight."""
    text = line.text.strip()
    if not text or len(text) > _HEADING_MAX_CHARS:
        return False
    numbered = bool(_NUMBERED_HEADING.match(text))
    if _BULLET.match(text) and not numbered:
        return False
    if _SENTENCE_END.search(text) and not numbered:
        return False
    if line.size >= body * _HEADING_SIZE_RATIO:
        return True
    return bool(line.bold and line.size >= body * _BOLD_HEADING_SIZE_RATIO and len(text) <= _BOLD_HEADING_MAX_CHARS)


def _level_map(sizes: list[float]) -> dict[float, int]:
    """Rank distinct heading sizes largest first into levels 1..6."""
    ranked = sorted(set(sizes), reverse=True)
    return {size: min(index + 1, 6) for index, size in enumerate(ranked)}


# ---------------------------------- assembly ---------------------------------- #


def _flush_code(parsed: ParsedDocument, lines: list[str], page_no: int) -> None:
    """Emit pending monospaced lines as one code block, one source line per line.

    Emitting each monospaced line separately once turned an 86-page report into
    1,966 passages of about 7 tokens each (D-043).
    """
    if lines:
        parsed.add(code("\n".join(lines), page_no))
        lines.clear()


def _flush_prose(parsed: ParsedDocument, buffer: list[str], page_no: int) -> None:
    """Join pending body lines into one paragraph, rejoining hyphenated words."""
    if not buffer:
        return
    text = ""
    for line in buffer:
        if text.endswith("-"):
            text = text[:-1] + line.lstrip()
        elif text:
            text += " " + line.strip()
        else:
            text = line.strip()
    buffer.clear()
    if text.strip():
        parsed.add(para(text, page_no))


def _emit_page(
    parsed: ParsedDocument,
    flow: list[_Boxed],
    page_no: int,
    body: float,
    levels: dict[float, int],
) -> None:
    """Turn one page's ordered items into elements."""
    prose: list[str] = []
    code_lines: list[str] = []

    for item in flow:
        is_table = isinstance(item, _Table)
        is_heading = not is_table and _is_heading(item, body)
        is_code = not is_table and not is_heading and item.mono and item.size <= body * _CODE_SIZE_RATIO

        if not is_code:
            _flush_code(parsed, code_lines, page_no)

        if is_table:
            _flush_prose(parsed, prose, page_no)
            parsed.add(table(item.markdown, page_no, rows=item.rows))
            parsed.bump("tables")
        elif is_heading:
            _flush_prose(parsed, prose, page_no)
            parsed.add(heading(item.text, levels.get(item.size, 2), page_no))
        elif is_code:
            _flush_prose(parsed, prose, page_no)
            code_lines.append(item.text)
        else:
            prose.append(item.text)

    _flush_code(parsed, code_lines, page_no)
    _flush_prose(parsed, prose, page_no)


# PUBLIC_INTERFACE
def parse_pdf(data: bytes) -> ParsedDocument:
    """Parse a PDF into ordered, typed elements with page numbers.

    :param data: The complete PDF bytes (already validated by ``check_file``).
    :returns: The parsed document, with ``pages``, ``tables`` and
        ``pages_without_text`` statistics.
    """
    doc = pymupdf.open(stream=data, filetype="pdf")
    parsed = ParsedDocument(elements=[], doc_type="pdf", page_count=doc.page_count)
    try:
        # Pass 1: collect tables and lines per page.
        page_tables: list[list[_Table]] = []
        page_lines: list[list[_Line]] = []
        for page in doc:
            tables = _find_tables(page)
            lines = _page_lines(page, [(t.x0, t.y0, t.x1, t.y1) for t in tables])
            page_tables.append(tables)
            page_lines.append(lines)
            if not tables and sum(len(l.text) for l in lines) < SCANNED_CHAR_THRESHOLD:
                parsed.bump("pages_without_text")

        # Pass 2: measure document-wide typography and furniture.
        every_line = [line for lines in page_lines for line in lines]
        body = _body_size(every_line) or 10.0
        drop = _repeated_edges(page_lines)
        levels = _level_map(
            [l.size for l in every_line if _is_heading(l, body) and _normalise(l.text) not in drop]
        )

        # Pass 3: assemble elements page by page in reading order.
        for index in range(doc.page_count):
            keep = [l for l in page_lines[index] if _normalise(l.text) not in drop]
            flow = _reading_order([*keep, *page_tables[index]], doc[index].rect.width)
            _emit_page(parsed, flow, index + 1, body, levels)
    finally:
        doc.close()

    parsed.bump("pages", parsed.page_count)
    return parsed
