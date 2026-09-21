"""Structure-aware chunking with exact character offsets.

The chunker works on the parser's element list rather than a sliding character
window:

Sections    A heading opens a section and a chunk never crosses a section
            boundary, so a passage is always about one thing.
Context     Every chunk carries its heading path ("spec.pdf > Pipeline > Charts")
            as context. It is embedded and shown to the model with the passage,
            but it is never part of the cited passage.
Atomicity   Tables and code blocks are emitted whole. An oversized table is split
            by rows, and continuation pieces carry the header row in their
            context so they still read as a table.
Sizing      Token budgets estimated from characters, with a denser ratio for
            tables and code than for prose.
Overlap     Whole trailing sentences, carried forward within a section only.

Offsets (D-023)
    Every chunk is a span of the document's canonical text, and its text is
    always exactly ``document_text[start:end]``. Splits land on sentence, row,
    line or blank-line boundaries found in that text, and merges only extend
    spans, so the invariant holds by construction. A citation can therefore
    highlight the exact passage the model read.
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

#: Below this a text chunk with nowhere to merge is page furniture, not content.
HARD_FLOOR_TOKENS = 14

#: A Markdown table needs a header row, a rule row and at least one body row
#: before it can be split by rows.
_MIN_TABLE_LINES = 3

Span = tuple[int, int]


# PUBLIC_INTERFACE
def estimate_tokens(text: str, dense: bool = False) -> int:
    """Estimate a token count from character length.

    Tables and code pack far more tokens into the same characters than prose, so
    they use a denser ratio. This is deliberately an estimate: tokenising every
    candidate split would dominate ingestion time.

    :param text: The text to measure.
    :param dense: True for tables and code, False for prose.
    :returns: An estimated token count (always at least 1).
    """
    return int(len(text) / (_DENSE_CHARS_PER_TOKEN if dense else _PROSE_CHARS_PER_TOKEN)) + 1


# PUBLIC_INTERFACE
@dataclass
class Chunk:
    """One indexable passage: a span of the document's canonical text.

    :param start: Inclusive start offset into the canonical text.
    :param end: Exclusive end offset into the canonical text.
    :param text: Exactly ``canonical_text[start:end]``.
    :param kind: ``text``, ``table`` or ``code``.
    :param section_path: The heading stack above this passage.
    :param page: First source page seen in the passage (None for Word).
    :param index: Position of the chunk in the document, 0-based.
    :param tokens: Estimated token count.
    :param table_header: Header rows repeated on a table continuation piece.
    :param source: The document's file name, used to build the context line.
    """

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
        """The heading path as stored in ``chunks.section``."""
        return " > ".join(self.section_path)

    @property
    def context(self) -> str:
        """File name and heading path, plus a table header for a continuation."""
        breadcrumb = " > ".join([self.source, *self.section_path]) if self.source else self.section
        return f"{breadcrumb}\n{self.table_header}" if self.table_header else breadcrumb

    @property
    def embed_text(self) -> str:
        """What is actually embedded: the context line followed by the passage."""
        return f"{self.context}\n\n{self.text}" if self.context else self.text

    @property
    def content_hash(self) -> str:
        """A short stable digest of the passage text."""
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

    OCR-like output, flattened tables and prose without full stops all arrive as
    a single enormous "sentence" the sentence splitter cannot break.
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
    """Split a prose span on sentence boundaries, with whole-sentence overlap."""
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
    return [part for part in parts if doc[part[0]:part[1]].strip()]


def _line_spans(doc: str, span: Span) -> list[Span]:
    """Non-empty line spans within a span."""
    start, end = span
    lines: list[Span] = []
    cursor = start
    while cursor < end:
        newline = doc.find("\n", cursor, end)
        line_end = end if newline == -1 else newline
        if doc[cursor:line_end].strip():
            lines.append((cursor, line_end))
        cursor = line_end + 1
    return lines


def _table_parts(doc: str, span: Span, max_tokens: int) -> list[tuple[Span, str]]:
    """Split a Markdown table by rows.

    :returns: ``(span, table_header)`` pairs. The first piece contains the header
        and rule rows itself; later pieces carry them as context instead.
    """
    lines = _line_spans(doc, span)
    if len(lines) < _MIN_TABLE_LINES:
        return [(span, "")]

    header_span, rule_span, *rows = lines
    header_text = f"{doc[header_span[0]:header_span[1]]}\n{doc[rule_span[0]:rule_span[1]]}"
    head_tokens = estimate_tokens(header_text, dense=True)

    groups: list[Span] = []
    group: list[Span] = []
    running = head_tokens
    for row in rows:
        cost = estimate_tokens(doc[row[0]:row[1]], dense=True)
        if group and running + cost > max_tokens:
            groups.append((group[0][0], group[-1][1]))
            group, running = [], head_tokens
        group.append(row)
        running += cost
    if group:
        groups.append((group[0][0], group[-1][1]))
    if not groups:
        return [(span, "")]

    first_end = groups[0][1]
    parts: list[tuple[Span, str]] = [((header_span[0], first_end), "")]
    parts.extend((group_span, header_text) for group_span in groups[1:])
    return parts


def _code_parts(doc: str, span: Span, max_tokens: int) -> list[Span]:
    """Split code on blank lines, the only boundary that is safe without a parser."""
    start, end = span
    blocks: list[Span] = []
    cursor = start
    for match in _BLANK_LINES.finditer(doc, start, end):
        if doc[cursor:match.start()].strip():
            blocks.append((cursor, match.start()))
        cursor = match.end()
    if doc[cursor:end].strip():
        blocks.append((cursor, end))

    # A block with no blank lines inside can still be too big: code lifted out of
    # a PDF has none. Split such a block on line boundaries instead (D-043).
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

    parts: list[Span] = []
    group: list[Span] = []
    running = 0
    for block in lined:
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


class _Builder:
    """Accumulates chunks for one document, holding the live heading stack."""

    def __init__(self, doc: str, source: str) -> None:
        self.doc = doc
        self.source = source
        self.chunks: list[Chunk] = []
        self.stack: list[tuple[int, str]] = []      # (heading level, heading text)

    @property
    def path(self) -> list[str]:
        """The current heading path."""
        return [title for _, title in self.stack]

    def push_heading(self, level: int, text: str) -> None:
        """Open a section, closing any sections at the same or deeper level."""
        while self.stack and self.stack[-1][0] >= level:
            self.stack.pop()
        self.stack.append((level, text))

    def emit(self, span: Span, kind: str, page: int | None, *, dense: bool = False, table_header: str = "") -> None:
        """Append a chunk for `span`, trimming whitespace by moving the span only."""
        start, end = span
        while start < end and self.doc[start].isspace():
            start += 1
        while end > start and self.doc[end - 1].isspace():
            end -= 1
        if start >= end:
            return
        text = self.doc[start:end]
        self.chunks.append(
            Chunk(
                start=start,
                end=end,
                text=text,
                kind=kind,
                section_path=self.path,
                page=page,
                index=len(self.chunks),
                tokens=estimate_tokens(text, dense=dense),
                table_header=table_header,
                source=self.source,
            )
        )


# PUBLIC_INTERFACE
def chunk_document(parsed: ParsedDocument, *, source: str) -> tuple[str, list[Chunk]]:
    """Chunk a parsed document into passages with exact canonical-text offsets.

    :param parsed: The parser's element list.
    :param source: The document's file name, used in each chunk's context line.
    :returns: ``(canonical_text, chunks)`` where every chunk satisfies
        ``canonical_text[chunk.start:chunk.end] == chunk.text``.
    """
    settings = get_settings()
    target = settings.chunk_target_tokens
    ceiling = settings.chunk_max_tokens
    overlap = settings.chunk_overlap_tokens
    floor = settings.chunk_min_tokens

    doc, spans = parsed.canonical()
    builder = _Builder(doc, source)
    pending: list[int] = []      # element indexes of prose buffered in this section

    def flush_prose() -> None:
        """Emit the buffered prose of the current section as one or more chunks."""
        if not pending:
            return
        span = (spans[pending[0]][0], spans[pending[-1]][1])
        page = next((parsed.elements[i].page for i in pending if parsed.elements[i].page), None)
        pending.clear()
        if not doc[span[0]:span[1]].strip():
            return
        if estimate_tokens(doc[span[0]:span[1]]) <= ceiling:
            builder.emit(span, "text", page)
            return
        for part in _prose_parts(doc, span, target, overlap):
            builder.emit(part, "text", page)

    for index, element in enumerate(parsed.elements):
        if element.is_blank:
            continue

        if element.kind == "heading":
            flush_prose()
            builder.push_heading(element.level or 1, element.text)
        elif element.kind == "table":
            flush_prose()
            for part, header in _table_parts(doc, spans[index], ceiling):
                builder.emit(part, "table", element.page, dense=True, table_header=header)
        elif element.kind == "code":
            flush_prose()
            if estimate_tokens(element.text, dense=True) <= ceiling:
                builder.emit(spans[index], "code", element.page, dense=True)
            else:
                for part in _code_parts(doc, spans[index], target):
                    builder.emit(part, "code", element.page, dense=True)
        else:
            # Paragraphs and list items accumulate until the section ends.
            pending.append(index)

    flush_prose()
    return doc, _merge_small(doc, builder.chunks, floor)


def _mergeable(a: Chunk, b: Chunk) -> bool:
    """Only adjacent prose chunks of the same section may be merged."""
    return a.kind == "text" and b.kind == "text" and a.section_path == b.section_path


def _merge_small(doc: str, chunks: list[Chunk], floor: int) -> list[Chunk]:
    """Fold undersized text chunks into an adjacent text chunk of the same section.

    Only immediate neighbours merge, so a merged span never swallows a table or
    code block sitting between them, and tables and code are never merged at
    all. A stubborn fragment below :data:`HARD_FLOOR_TOKENS` is page furniture
    and is dropped rather than indexed.
    """
    # Pass 1: fold a small chunk backwards into the chunk before it.
    merged: list[Chunk] = []
    for chunk in chunks:
        previous = merged[-1] if merged else None
        if previous is not None and chunk.tokens < floor and _mergeable(previous, chunk):
            previous.end = max(previous.end, chunk.end)
            previous.text = doc[previous.start:previous.end]
            previous.tokens = estimate_tokens(previous.text)
        else:
            merged.append(chunk)

    # Pass 2: a still-small chunk with no predecessor folds into its successor,
    # and anything below the hard floor with nowhere to go is dropped.
    out: list[Chunk] = []
    position = 0
    while position < len(merged):
        chunk = merged[position]
        following = merged[position + 1] if position + 1 < len(merged) else None
        if chunk.kind == "text" and chunk.tokens < floor:
            if following is not None and _mergeable(chunk, following):
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
