"""Structure-aware chunking with exact character offsets.

The chunker works on the parser's element list rather than a character window:

Sections    Headings open sections and a chunk never crosses a section boundary.
Context     Every chunk carries its heading path ("spec.pdf > Pipeline > Charts")
            as context. It is embedded and shown to the model with the passage,
            but it is not part of the cited passage.
Atomicity   Tables and code blocks are emitted whole. An oversized table is split
            by rows; continuation pieces carry the header row in their context so
            they still read as a table.
Sizing      Token budgets, estimated from characters, because tables and prose
            have very different tokens per character. Small fragments are folded
            into a neighbour in the same section.
Overlap     Within a section only, carried as whole sentences.

Offsets (D-023)
    Every chunk is a span of the document's canonical text, and its text is
    always exactly `document_text[start:end]`. Splits happen on sentence, row or
    blank-line boundaries found in that text, and merges extend spans, so the
    invariant holds by construction. A citation can therefore highlight the exact
    passage the model read.
"""

from __future__ import annotations

import hashlib
import re
from dataclasses import dataclass, field

from app.core.config import get_settings
from app.rag.documents import ParsedDocument

_PROSE_CHARS_PER_TOKEN = 4.0
_DENSE_CHARS_PER_TOKEN = 3.0

# A sentence ends at . ! or ? followed by whitespace and a capital or digit.
_SENTENCE_BREAK = re.compile(r"(?<=[.!?])\s+(?=[A-Z0-9])")
_WORD = re.compile(r"\S+")
_BLANK_LINES = re.compile(r"\n[ \t]*\n")
_NEWLINE = re.compile(r"\n")

# Below this a text chunk with nowhere to merge is page furniture, not content.
HARD_FLOOR_TOKENS = 14

Span = tuple[int, int]


def estimate_tokens(text: str, dense: bool = False) -> int:
    return int(len(text) / (_DENSE_CHARS_PER_TOKEN if dense else _PROSE_CHARS_PER_TOKEN)) + 1


@dataclass
class Chunk:
    """One indexable passage: a span of the document's canonical text."""

    start: int
    end: int
    text: str
    kind: str = "text"                              # text | table | code
    section_path: list[str] = field(default_factory=list)
    page: int | None = None
    index: int = 0
    tokens: int = 0
    table_header: str = ""                          # set on continuation pieces of a split table
    source: str = ""

    @property
    def section(self) -> str:
        return " > ".join(self.section_path)

    @property
    def context(self) -> str:
        """Heading path, plus a table header for a table continuation."""
        breadcrumb = " > ".join([self.source, *self.section_path]) if self.source else self.section
        return f"{breadcrumb}\n{self.table_header}" if self.table_header else breadcrumb

    @property
    def embed_text(self) -> str:
        return f"{self.context}\n\n{self.text}" if self.context else self.text

    @property
    def content_hash(self) -> str:
        return hashlib.sha256(self.text.encode("utf-8")).hexdigest()[:16]


# ------------------------------- span splitting ------------------------------- #


def _sentence_spans(text: str, base: int) -> list[Span]:
    """Sentence spans within `text`, as absolute offsets (whitespace excluded)."""
    spans: list[Span] = []
    cursor = 0
    for match in _SENTENCE_BREAK.finditer(text):
        if match.start() > cursor:
            spans.append((base + cursor, base + match.start()))
        cursor = match.end()
    if cursor < len(text):
        spans.append((base + cursor, base + len(text)))
    return spans


def _word_groups(doc: str, span: Span, max_tokens: int) -> list[Span]:
    """Split one oversized sentence on whitespace.

    OCR-like output, flattened tables or prose without full stops arrive as one
    enormous sentence that the sentence splitter cannot break.
    """
    start, end = span
    groups: list[Span] = []
    group_start: int | None = None
    group_end = start
    running = 0
    for word in _WORD.finditer(doc, start, end):
        cost = estimate_tokens(word.group())
        if group_start is not None and running + cost > max_tokens:
            groups.append((group_start, group_end))
            group_start, running = None, 0
        if group_start is None:
            group_start = word.start()
        group_end = word.end()
        running += cost
    if group_start is not None:
        groups.append((group_start, group_end))
    return groups


def _prose_parts(doc: str, span: Span, max_tokens: int, overlap_tokens: int) -> list[Span]:
    """Split a prose span on sentences, with a sentence or two of overlap."""
    start, end = span
    sentences: list[Span] = []
    for sentence in _sentence_spans(doc[start:end], start):
        if estimate_tokens(doc[sentence[0]:sentence[1]]) > max_tokens:
            sentences.extend(_word_groups(doc, sentence, max_tokens))
        else:
            sentences.append(sentence)

    parts: list[Span] = []
    current: list[Span] = []
    running = 0
    for sentence in sentences:
        cost = estimate_tokens(doc[sentence[0]:sentence[1]])
        if current and running + cost > max_tokens:
            parts.append((current[0][0], current[-1][1]))
            # Carry whole trailing sentences, up to the overlap budget, so a fact
            # spanning the boundary is retrievable from either side.
            tail: list[Span] = []
            carried = 0
            for previous in reversed(current):
                previous_cost = estimate_tokens(doc[previous[0]:previous[1]])
                if carried + previous_cost > overlap_tokens:
                    break
                carried += previous_cost
                tail.insert(0, previous)
            current, running = tail, carried
        current.append(sentence)
        running += cost
    if current:
        parts.append((current[0][0], current[-1][1]))
    return [p for p in parts if doc[p[0]:p[1]].strip()]


def _line_spans(doc: str, span: Span) -> list[Span]:
    """Non-empty line spans within a span."""
    start, end = span
    out: list[Span] = []
    cursor = start
    while cursor < end:
        newline = doc.find("\n", cursor, end)
        line_end = end if newline == -1 else newline
        if doc[cursor:line_end].strip():
            out.append((cursor, line_end))
        cursor = line_end + 1
    return out


def _table_parts(doc: str, span: Span, max_tokens: int) -> list[tuple[Span, str]]:
    """Split a Markdown table by rows. Returns (span, header for continuations)."""
    lines = _line_spans(doc, span)
    if len(lines) < 3:
        return [(span, "")]
    header_span, rule_span, *rows = lines
    header_text = f"{doc[header_span[0]:header_span[1]]}\n{doc[rule_span[0]:rule_span[1]]}"
    head_tokens = estimate_tokens(header_text, dense=True)

    parts: list[tuple[Span, str]] = []
    group: list[Span] = []
    running = head_tokens
    for row in rows:
        cost = estimate_tokens(doc[row[0]:row[1]], dense=True)
        if group and running + cost > max_tokens:
            parts.append(((group[0][0], group[-1][1]), ""))
            group, running = [], head_tokens
        group.append(row)
        running += cost
    if group:
        parts.append(((group[0][0], group[-1][1]), ""))
    if not parts:
        return [(span, "")]

    # The first piece starts at the header itself; later pieces carry it as context.
    first_span, _ = parts[0]
    result = [((header_span[0], first_span[1]), "")]
    result.extend((piece_span, header_text) for piece_span, _ in parts[1:])
    return result


def _code_parts(doc: str, span: Span, max_tokens: int) -> list[Span]:
    """Split code on blank lines, the only boundary safe without a parser."""
    start, end = span
    blocks: list[Span] = []
    cursor = start
    for match in _BLANK_LINES.finditer(doc, start, end):
        if doc[cursor:match.start()].strip():
            blocks.append((cursor, match.start()))
        cursor = match.end()
    if doc[cursor:end].strip():
        blocks.append((cursor, end))

    # A block with no blank lines inside can still be too big: code extracted from a
    # PDF has none. Split such a block on line boundaries instead (D-043).
    lined: list[Span] = []
    for block in blocks:
        if estimate_tokens(doc[block[0]:block[1]], dense=True) <= max_tokens:
            lined.append(block)
            continue
        line_start = block[0]
        for match in _NEWLINE.finditer(doc, block[0], block[1]):
            if doc[line_start:match.start()].strip():
                lined.append((line_start, match.start()))
            line_start = match.end()
        if doc[line_start:block[1]].strip():
            lined.append((line_start, block[1]))
    blocks = lined

    parts: list[Span] = []
    group: list[Span] = []
    running = 0
    for block in blocks:
        cost = estimate_tokens(doc[block[0]:block[1]], dense=True)
        if group and running + cost > max_tokens:
            parts.append((group[0][0], group[-1][1]))
            group, running = [], 0
        group.append(block)
        running += cost
    if group:
        parts.append((group[0][0], group[-1][1]))
    return parts or [span]


# --------------------------------- the chunker --------------------------------- #


def chunk_document(parsed: ParsedDocument, *, source: str) -> tuple[str, list[Chunk]]:
    """Return the canonical document text and its chunks."""
    settings = get_settings()
    target = settings.chunk_target_tokens
    ceiling = settings.chunk_max_tokens
    overlap = settings.chunk_overlap_tokens
    floor = settings.chunk_min_tokens

    doc, spans = parsed.canonical()
    chunks: list[Chunk] = []
    stack: list[tuple[int, str]] = []
    buffer: list[int] = []          # element indexes of pending prose in this section

    def path() -> list[str]:
        return [title for _, title in stack]

    def emit(span: Span, kind: str, page: int | None, *, dense: bool = False, table_header: str = "") -> None:
        start, end = span
        # Trim surrounding whitespace by moving the span, never by editing text.
        while start < end and doc[start].isspace():
            start += 1
        while end > start and doc[end - 1].isspace():
            end -= 1
        if start >= end:
            return
        text = doc[start:end]
        chunks.append(
            Chunk(
                start=start,
                end=end,
                text=text,
                kind=kind,
                section_path=path(),
                page=page,
                index=len(chunks),
                tokens=estimate_tokens(text, dense=dense),
                table_header=table_header,
                source=source,
            )
        )

    def flush_prose() -> None:
        if not buffer:
            return
        first, last = buffer[0], buffer[-1]
        span = (spans[first][0], spans[last][1])
        page = next((parsed.elements[i].page for i in buffer if parsed.elements[i].page), None)
        buffer.clear()
        if not doc[span[0]:span[1]].strip():
            return
        if estimate_tokens(doc[span[0]:span[1]]) <= ceiling:
            emit(span, "text", page)
            return
        for part in _prose_parts(doc, span, target, overlap):
            emit(part, "text", page)

    for index, element in enumerate(parsed.elements):
        if not element.text.strip():
            continue
        if element.kind == "heading":
            flush_prose()
            level = element.level or 1
            while stack and stack[-1][0] >= level:
                stack.pop()
            stack.append((level, element.text))
        elif element.kind == "table":
            flush_prose()
            for part, header in _table_parts(doc, spans[index], ceiling):
                emit(part, "table", element.page, dense=True, table_header=header)
        elif element.kind == "code":
            flush_prose()
            if estimate_tokens(element.text, dense=True) <= ceiling:
                emit(spans[index], "code", element.page, dense=True)
            else:
                for part in _code_parts(doc, spans[index], target):
                    emit(part, "code", element.page, dense=True)
        else:
            buffer.append(index)

    flush_prose()
    return doc, _merge_small(doc, chunks, floor)


def _merge_small(doc: str, chunks: list[Chunk], floor: int) -> list[Chunk]:
    """Fold undersized text chunks into an adjacent text chunk of the same section.

    Only immediate neighbours merge, so the merged span never swallows a table
    or code block sitting between them. Tables and code are never merged.
    """
    def mergeable(a: Chunk, b: Chunk) -> bool:
        return a.kind == "text" and b.kind == "text" and a.section_path == b.section_path

    merged: list[Chunk] = []
    for chunk in chunks:
        previous = merged[-1] if merged else None
        if previous is not None and chunk.tokens < floor and mergeable(previous, chunk):
            previous.end = max(previous.end, chunk.end)
            previous.text = doc[previous.start:previous.end]
            previous.tokens = estimate_tokens(previous.text)
        else:
            merged.append(chunk)

    out: list[Chunk] = []
    position = 0
    while position < len(merged):
        chunk = merged[position]
        following = merged[position + 1] if position + 1 < len(merged) else None
        if chunk.kind == "text" and chunk.tokens < floor:
            if following is not None and mergeable(chunk, following):
                following.start = min(chunk.start, following.start)
                following.text = doc[following.start:following.end]
                following.tokens = estimate_tokens(following.text)
                position += 1
                continue
            if chunk.tokens < HARD_FLOOR_TOKENS and len(merged) > 1:
                position += 1
                continue
        out.append(chunk)
        position += 1

    for index, chunk in enumerate(out):
        chunk.index = index
    return out or merged[:1]
