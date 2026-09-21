"""Intermediate representation shared by every document parser.

A parser never returns a flat string. It returns a :class:`ParsedDocument`: an
ordered list of typed :class:`DocElement` values in reading order. That is what
lets the chunker keep tables whole, stop a passage from crossing a section
boundary, and tell every passage which section it came from.

The document's *canonical text* is derived from those elements, and it is the
text citations point into: every chunk's ``char_start``/``char_end`` are offsets
into it (docs/decisions.md D-023). Offsets count Unicode code points, the unit
Python's ``str`` and Postgres's ``substring()`` both use.

Stability warning: :data:`ELEMENT_SEPARATOR` is part of the stored data
contract. Chunks that span several elements include it, so changing it would
invalidate every stored offset.
"""

from __future__ import annotations

from dataclasses import dataclass, field
from typing import Any, Literal

ElementKind = Literal["heading", "paragraph", "list", "table", "code"]

#: Joins elements in the canonical text. Must not change once documents exist.
ELEMENT_SEPARATOR = "\n\n"

#: Headings deeper than this are clamped; matches the HTML h1..h6 range.
MAX_HEADING_LEVEL = 6


# PUBLIC_INTERFACE
def clean_text(text: str) -> str:
    """Strip characters Postgres ``text`` cannot store.

    PDFs occasionally carry NUL bytes; a single one would fail every insert for
    the document.

    :param text: Raw text extracted by a parser.
    :returns: The same text without NUL characters.
    """
    return text.replace("\x00", "")


# PUBLIC_INTERFACE
@dataclass
class DocElement:
    """One logically distinct piece of a document, in reading order.

    :param kind: ``heading``, ``paragraph``, ``list``, ``table`` or ``code``.
    :param text: The element's text (Markdown for tables).
    :param level: Heading depth 1..6; ``0`` for everything that is not a heading.
    :param page: 1-indexed source page, or ``None`` when the format has no pages.
    :param meta: Parser-specific extras (for example a table's row count).
    """

    kind: ElementKind
    text: str
    level: int = 0
    page: int | None = None
    meta: dict[str, Any] = field(default_factory=dict)

    @property
    def is_blank(self) -> bool:
        """True when the element carries no visible text."""
        return not self.text.strip()


# PUBLIC_INTERFACE
@dataclass
class ParsedDocument:
    """A parsed file: its elements plus what the parser had to do to read it.

    :param elements: Document elements in reading order.
    :param doc_type: ``pdf`` or ``docx``.
    :param page_count: Source page count (0 when the format has no pages).
    :param stats: Counters surfaced to the Documents page (for example
        ``pages_without_text``, ``tables``, ``pages``, ``paragraphs``).
    """

    elements: list[DocElement]
    doc_type: Literal["pdf", "docx"]
    page_count: int = 0
    stats: dict[str, int] = field(default_factory=dict)

    # PUBLIC_INTERFACE
    def bump(self, key: str, by: int = 1) -> None:
        """Increment a parser statistic.

        :param key: Statistic name.
        :param by: Amount to add (default 1).
        """
        self.stats[key] = self.stats.get(key, 0) + by

    # PUBLIC_INTERFACE
    def add(self, element: DocElement) -> None:
        """Append an element in reading order.

        :param element: The element to append.
        """
        self.elements.append(element)

    # PUBLIC_INTERFACE
    def canonical(self) -> tuple[str, list[tuple[int, int]]]:
        """Build the canonical text and each element's span within it.

        Non-empty element texts are joined with :data:`ELEMENT_SEPARATOR`. Blank
        elements get a zero-length span at the current position, so span indexes
        stay aligned one-to-one with :attr:`elements`.

        :returns: ``(canonical_text, spans)`` where ``spans[i]`` is the
            ``(start, end)`` code-point span of ``elements[i]``.
        """
        parts: list[str] = []
        spans: list[tuple[int, int]] = []
        position = 0
        for element in self.elements:
            if element.is_blank:
                spans.append((position, position))
                continue
            if parts:
                parts.append(ELEMENT_SEPARATOR)
                position += len(ELEMENT_SEPARATOR)
            spans.append((position, position + len(element.text)))
            parts.append(element.text)
            position += len(element.text)
        return "".join(parts), spans


# PUBLIC_INTERFACE
def heading(text: str, level: int, page: int | None = None) -> DocElement:
    """Build a heading element with its level clamped to 1..6.

    :param text: Heading text.
    :param level: Requested depth; clamped into 1..6.
    :param page: 1-indexed source page, if known.
    :returns: A heading :class:`DocElement`.
    """
    return DocElement(
        kind="heading",
        text=clean_text(text).strip(),
        level=max(1, min(level, MAX_HEADING_LEVEL)),
        page=page,
    )


# PUBLIC_INTERFACE
def para(text: str, page: int | None = None) -> DocElement:
    """Build a paragraph element.

    :param text: Paragraph text.
    :param page: 1-indexed source page, if known.
    :returns: A paragraph :class:`DocElement`.
    """
    return DocElement(kind="paragraph", text=clean_text(text).strip(), page=page)


# PUBLIC_INTERFACE
def list_item(text: str, page: int | None = None) -> DocElement:
    """Build a list-item element.

    :param text: List item text.
    :param page: 1-indexed source page, if known.
    :returns: A list :class:`DocElement`.
    """
    return DocElement(kind="list", text=clean_text(text).strip(), page=page)


# PUBLIC_INTERFACE
def table(markdown: str, page: int | None = None, **meta: Any) -> DocElement:
    """Build a table element from a Markdown rendering of the grid.

    :param markdown: GitHub-flavoured Markdown table.
    :param page: 1-indexed source page, if known.
    :param meta: Extra parser metadata, for example ``rows=12``.
    :returns: A table :class:`DocElement`.
    """
    return DocElement(kind="table", text=clean_text(markdown).strip(), page=page, meta=meta)


# PUBLIC_INTERFACE
def code(text: str, page: int | None = None) -> DocElement:
    """Build a code element, preserving internal line breaks.

    :param text: Code listing; trailing whitespace is removed, indentation kept.
    :param page: 1-indexed source page, if known.
    :returns: A code :class:`DocElement`.
    """
    return DocElement(kind="code", text=clean_text(text).rstrip(), page=page)
