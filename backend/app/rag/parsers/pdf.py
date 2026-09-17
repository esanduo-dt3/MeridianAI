"""Layout-aware PDF parsing with PyMuPDF (AGPL, see docs/decisions.md D-024).

A plain text dump loses everything that makes a PDF answerable: which line was a
heading, where a table started and stopped, and which lines were a running
footer. This parser recovers that structure:

1. Tables first, via MuPDF's ruled and whitespace table finder. A found table is
   emitted whole as Markdown and its area is masked, so its cells never leak back
   in as loose sentences.
2. Text lines in reading order, with two-column layouts read down the left column
   before the right.
3. Headings inferred from typography (size relative to the body size, and weight),
   with the distinct heading sizes ranked into levels 1 to 6.
4. Running headers and footers dropped once they repeat across most pages.

Text only (D-022): pages without a text layer are counted in the stats rather
than OCR'd, so the Documents page can say a scan was not readable.
"""

from __future__ import annotations

import logging
import re
from collections import Counter
from dataclasses import dataclass

import pymupdf

from app.rag.documents import ParsedDocument, code, heading, para, table

log = logging.getLogger(__name__)

_BOLD = 1 << 4                    # span flag bit for bold
_MONO = 1 << 3                    # span flag bit for a monospaced face
_BULLET = re.compile(r"^\s*(?:[•▪◦·\-\*]|\(?[a-z0-9]{1,3}[.)])\s+", re.I)
_NUMBERED_HEADING = re.compile(r"^\s*\d+(?:\.\d+)*\.?\s+\S")
_SENTENCE_END = re.compile(r"[.!?;:]\s*$")

# A page with fewer extracted characters than this has no usable text layer.
SCANNED_CHAR_THRESHOLD = 90


@dataclass
class _Line:
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
    markdown: str
    rows: int
    x0: float
    y0: float
    x1: float
    y1: float


_Boxed = _Line | _Table


def _overlaps(inner: tuple[float, ...], outer: tuple[float, ...], ratio: float = 0.5) -> bool:
    """True when `inner` sits mostly inside `outer`; used to mask table areas."""
    ix0, iy0 = max(inner[0], outer[0]), max(inner[1], outer[1])
    ix1, iy1 = min(inner[2], outer[2]), min(inner[3], outer[3])
    if ix1 <= ix0 or iy1 <= iy0:
        return False
    area = (inner[2] - inner[0]) * (inner[3] - inner[1])
    return area > 0 and ((ix1 - ix0) * (iy1 - iy0)) / area >= ratio


def _column_split(lines: list[_Boxed], page_width: float) -> float | None:
    """The page midpoint when it is a real two-column gutter, else None."""
    if len(lines) < 8:
        return None
    mid = page_width / 2
    tolerance = page_width * 0.04
    left = right = 0
    for line in lines:
        if line.x0 < mid - tolerance and line.x1 > mid + tolerance:
            return None
        if line.x1 <= mid:
            left += 1
        elif line.x0 >= mid:
            right += 1
    return mid if min(left, right) >= max(3, len(lines) * 0.25) else None


def _reading_order(lines: list[_Boxed], page_width: float) -> list[_Boxed]:
    key = lambda l: (round(l.y0, 1), l.x0)  # noqa: E731
    gutter = _column_split(lines, page_width)
    if gutter is None:
        return sorted(lines, key=key)
    return sorted([l for l in lines if l.x1 <= gutter], key=key) + sorted([l for l in lines if l.x0 >= gutter], key=key)


def _page_lines(page: pymupdf.Page, masks: list[tuple[float, ...]]) -> list[_Line]:
    out: list[_Line] = []
    for block in page.get_text("dict").get("blocks", []):
        if block.get("type") != 0 or any(_overlaps(tuple(block["bbox"]), m) for m in masks):
            continue
        for line in block.get("lines", []):
            spans = [s for s in line.get("spans", []) if s.get("text", "").strip()]
            text = "".join(s["text"] for s in line.get("spans", [])).strip()
            if not spans or not text:
                continue
            biggest = max(spans, key=lambda s: s.get("size", 0.0))
            flags = int(biggest.get("flags", 0))
            bbox = line.get("bbox", block["bbox"])
            out.append(
                _Line(
                    text=text,
                    size=round(float(biggest.get("size", 0.0)), 1),
                    bold=bool(flags & _BOLD),
                    mono=bool(flags & _MONO),
                    x0=bbox[0], y0=bbox[1], x1=bbox[2], y1=bbox[3],
                )
            )
    return out


def _body_size(lines: list[_Line]) -> float:
    """The font size carrying the most characters."""
    weight: Counter[float] = Counter()
    for line in lines:
        weight[line.size] += len(line.text)
    return weight.most_common(1)[0][0] if weight else 10.0


def _normalise(text: str) -> str:
    """Blank digits so 'Page 3' and 'Page 4' compare equal."""
    return re.sub(r"\d+", "#", text).strip()


def _repeated_edges(pages: list[list[_Line]]) -> set[str]:
    """Running headers and footers: the same short edge line on most pages."""
    if len(pages) < 4:
        return set()
    seen: Counter[str] = Counter()
    for lines in pages:
        if not lines:
            continue
        ordered = sorted(lines, key=lambda l: l.y0)
        for line in {id(ordered[0]): ordered[0], id(ordered[-1]): ordered[-1]}.values():
            stripped = _normalise(line.text)
            if 0 < len(stripped) <= 90:
                seen[stripped] += 1
    threshold = max(3, int(len(pages) * 0.6))
    return {text for text, count in seen.items() if count >= threshold}


def _is_heading(line: _Line, body: float) -> bool:
    text = line.text.strip()
    if not text or len(text) > 130:
        return False
    if _BULLET.match(text) and not _NUMBERED_HEADING.match(text):
        return False
    if _SENTENCE_END.search(text) and not _NUMBERED_HEADING.match(text):
        return False
    if line.size >= body * 1.12:
        return True
    return bool(line.bold and line.size >= body * 0.97 and len(text) <= 90)


def _level_map(sizes: list[float]) -> dict[float, int]:
    ranked = sorted(set(sizes), reverse=True)
    return {size: min(i + 1, 6) for i, size in enumerate(ranked)}


def _plausible_text_table(found) -> bool:
    """Guard the borderless fallback, which can otherwise claim a whole page."""
    if found.row_count < 3 or found.col_count < 2:
        return False
    cells = [str(c) for row in found.extract() for c in row if c]
    if len(cells) < found.row_count * found.col_count * 0.5:
        return False
    return sum(len(c) for c in cells) / len(cells) <= 40


def _find_tables(page: pymupdf.Page) -> list[_Table]:
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
        if not markdown or found_table.row_count < 2 or area / page_area > 0.92:
            continue
        tables.append(_Table(markdown=markdown, rows=max(0, found_table.row_count - 1), x0=bbox[0], y0=bbox[1], x1=bbox[2], y1=bbox[3]))
    return tables


def parse_pdf(data: bytes) -> ParsedDocument:
    doc = pymupdf.open(stream=data, filetype="pdf")
    parsed = ParsedDocument(elements=[], doc_type="pdf", page_count=doc.page_count)
    try:
        page_tables: list[list[_Table]] = []
        page_lines: list[list[_Line]] = []
        for page in doc:
            tables = _find_tables(page)
            page_tables.append(tables)
            lines = _page_lines(page, [(t.x0, t.y0, t.x1, t.y1) for t in tables])
            page_lines.append(lines)
            if not tables and sum(len(l.text) for l in lines) < SCANNED_CHAR_THRESHOLD:
                parsed.bump("pages_without_text")

        body = _body_size([l for lines in page_lines for l in lines]) or 10.0
        drop = _repeated_edges(page_lines)
        levels = _level_map(
            [l.size for lines in page_lines for l in lines if _is_heading(l, body) and _normalise(l.text) not in drop]
        )

        for index in range(doc.page_count):
            page_no = index + 1
            keep = [l for l in page_lines[index] if _normalise(l.text) not in drop]
            flow = _reading_order([*keep, *page_tables[index]], doc[index].rect.width)
            buffer: list[str] = []
            # Consecutive monospaced lines are one listing. Emitting each line as its
            # own code element made every line of a listing its own passage: an
            # 86-page report with code became 1,966 passages of about 7 tokens (D-043).
            code_lines: list[str] = []
            for item in flow:
                is_code = not isinstance(item, _Table) and not _is_heading(item, body) and item.mono and item.size <= body * 1.05
                if not is_code:
                    _flush_code(parsed, code_lines, page_no)
                if isinstance(item, _Table):
                    _flush(parsed, buffer, page_no)
                    parsed.elements.append(table(item.markdown, page_no, rows=item.rows))
                    parsed.bump("tables")
                elif _is_heading(item, body):
                    _flush(parsed, buffer, page_no)
                    parsed.elements.append(heading(item.text, levels.get(item.size, 2), page_no))
                elif is_code:
                    _flush(parsed, buffer, page_no)
                    code_lines.append(item.text)
                else:
                    buffer.append(item.text)
            _flush_code(parsed, code_lines, page_no)
            _flush(parsed, buffer, page_no)
    finally:
        doc.close()
    parsed.bump("pages", parsed.page_count)
    return parsed


def _flush_code(parsed: ParsedDocument, lines: list[str], page_no: int) -> None:
    """Emit pending monospaced lines as one code block, keeping each line on its own line."""
    if lines:
        parsed.elements.append(code("\n".join(lines), page_no))
        lines.clear()


def _flush(parsed: ParsedDocument, buffer: list[str], page_no: int) -> None:
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
        parsed.elements.append(para(text, page_no))
