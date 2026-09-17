"""The intermediate representation every parser produces.

A parser returns an ordered list of typed elements, not one flat string, so the
chunker can keep tables whole, never cross a section boundary, and tell every
chunk which section it came from.

The document's canonical text is built from those elements, and it is the text
citations point into: every chunk's char_start/char_end are offsets into it
(docs/decisions.md D-023). Offsets count Unicode code points, the same unit
Python's str and Postgres's substring() use.
"""

from __future__ import annotations

from dataclasses import dataclass, field
from typing import Any, Literal

ElementKind = Literal["heading", "paragraph", "list", "table", "code"]

# Joins elements in the canonical text. Chunks spanning several elements include
# it, so it must stay stable once documents are stored.
ELEMENT_SEPARATOR = "\n\n"


def clean_text(text: str) -> str:
    """Postgres text cannot hold NUL, and PDFs occasionally contain it."""
    return text.replace("\x00", "")


@dataclass
class DocElement:
    """One logically distinct piece of a document, in reading order."""

    kind: ElementKind
    text: str
    level: int = 0                 # heading depth 1..6; 0 for everything else
    page: int | None = None        # 1-indexed source page
    meta: dict[str, Any] = field(default_factory=dict)


@dataclass
class ParsedDocument:
    """A parsed file: its elements plus what the parser had to do to read it."""

    elements: list[DocElement]
    doc_type: Literal["pdf", "docx"]
    page_count: int = 0
    stats: dict[str, int] = field(default_factory=dict)

    def bump(self, key: str, by: int = 1) -> None:
        self.stats[key] = self.stats.get(key, 0) + by

    def canonical(self) -> tuple[str, list[tuple[int, int]]]:
        """The canonical text and each element's (start, end) span within it.

        Empty elements get a zero-length span at the current position so element
        indexes stay aligned with the element list.
        """
        parts: list[str] = []
        spans: list[tuple[int, int]] = []
        position = 0
        for element in self.elements:
            if not element.text.strip():
                spans.append((position, position))
                continue
            if parts:
                parts.append(ELEMENT_SEPARATOR)
                position += len(ELEMENT_SEPARATOR)
            spans.append((position, position + len(element.text)))
            parts.append(element.text)
            position += len(element.text)
        return "".join(parts), spans


def heading(text: str, level: int, page: int | None = None) -> DocElement:
    return DocElement(kind="heading", text=clean_text(text).strip(), level=max(1, min(level, 6)), page=page)


def para(text: str, page: int | None = None) -> DocElement:
    return DocElement(kind="paragraph", text=clean_text(text).strip(), page=page)


def list_item(text: str, page: int | None = None) -> DocElement:
    return DocElement(kind="list", text=clean_text(text).strip(), page=page)


def table(markdown: str, page: int | None = None, **meta: Any) -> DocElement:
    return DocElement(kind="table", text=clean_text(markdown).strip(), page=page, meta=meta)


def code(text: str, page: int | None = None) -> DocElement:
    return DocElement(kind="code", text=clean_text(text).rstrip(), page=page)
