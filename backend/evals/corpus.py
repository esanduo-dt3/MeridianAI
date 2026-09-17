"""The workspace under test: its documents, their text, and their passages.

Read with the service role, because an eval run has no signed-in user to act
for. Everything here is read-only.
"""

from __future__ import annotations

import re
from dataclasses import dataclass, field

from app.core.supabase import Db
from evals.golden import GoldenQuestion, QuoteMatch, find_quote


@dataclass(frozen=True)
class Chunk:
    id: str
    document_id: str
    chunk_index: int
    char_start: int
    char_end: int
    section: str
    page: int | None
    content: str


@dataclass
class Document:
    id: str
    file_name: str
    parsed_status: str
    chunk_count: int
    embedded_count: int
    content_text: str
    chunks: list[Chunk]


@dataclass
class Corpus:
    workspace_id: str
    documents: list[Document]

    @property
    def ready(self) -> list[Document]:
        return [d for d in self.documents if d.parsed_status == "ready"]

    @property
    def total_chunks(self) -> int:
        return sum(len(d.chunks) for d in self.ready)

    def find_document(self, name: str) -> Document | None:
        """Match on the exact file name, then ignoring case, spaces, underscores and hyphens, then a unique partial."""
        for document in self.documents:
            if document.file_name == name:
                return document
        wanted = _norm_name(name)
        same = [d for d in self.documents if _norm_name(d.file_name) == wanted]
        if len(same) == 1:
            return same[0]
        hits = [d for d in self.documents if wanted in _norm_name(d.file_name)]
        return hits[0] if len(hits) == 1 else None

    def chunk_by_id(self, chunk_id: str) -> Chunk | None:
        for document in self.documents:
            for chunk in document.chunks:
                if chunk.id == chunk_id:
                    return chunk
        return None


async def load(db: Db, workspace_id: str) -> Corpus:
    rows = await db.select(
        "documents",
        {
            "select": "id,file_name,parsed_status,chunk_count,embedded_count,content_text",
            "workspace_id": f"eq.{workspace_id}",
            "order": "file_name.asc",
        },
    )
    documents: list[Document] = []
    for row in rows:
        chunks = await _chunks(db, row["id"])
        documents.append(
            Document(
                id=row["id"],
                file_name=row["file_name"],
                parsed_status=row["parsed_status"],
                chunk_count=row.get("chunk_count") or 0,
                embedded_count=row.get("embedded_count") or 0,
                content_text=row.get("content_text") or "",
                chunks=chunks,
            )
        )
    return Corpus(workspace_id=workspace_id, documents=documents)


async def _chunks(db: Db, document_id: str) -> list[Chunk]:
    """Paged, because a large document can exceed PostgREST's default row cap."""
    out: list[Chunk] = []
    page = 0
    size = 500
    while True:
        rows = await db.select(
            "chunks",
            {
                "select": "id,document_id,chunk_index,char_start,char_end,section,page,content",
                "document_id": f"eq.{document_id}",
                "order": "chunk_index.asc",
                "offset": str(page * size),
                "limit": str(size),
            },
        )
        out.extend(
            Chunk(
                id=r["id"],
                document_id=r["document_id"],
                chunk_index=r["chunk_index"],
                char_start=r["char_start"],
                char_end=r["char_end"],
                section=r.get("section") or "",
                page=r.get("page"),
                content=r.get("content") or "",
            )
            for r in rows
        )
        if len(rows) < size:
            return out
        page += 1


# --- Resolving golden questions against the corpus -------------------------


def _norm_name(name: str) -> str:
    """'SLT_PowerProx_solution architecture.docx' and 'SLT PowerProx solution architecture.docx' are one file."""
    return re.sub(r"[\s_\-]+", " ", name.casefold()).strip()


@dataclass
class Resolved:
    question: GoldenQuestion
    document: Document | None
    expected_chunk_ids: list[str]
    expected_chunk_indexes: list[int]
    problem: str | None = None
    # One group per passage the answer needs; each lists the chunks that hold it (D-043).
    required_groups: list[list[str]] = field(default_factory=list)
    distractor_chunk_ids: list[str] = field(default_factory=list)
    warnings: list[str] = field(default_factory=list)

    @property
    def ok(self) -> bool:
        return self.problem is None


def _locate(documents: list[Document], quote: str) -> tuple[list[Chunk], list[str]]:
    """Chunks holding the quote, and a warning for each match that crosses a passage boundary.

    A quote wholly inside a passage resolves to that passage. A quote that
    crosses a boundary resolves to every passage it overlaps: a person copying a
    multi-sentence quote cannot see where the chunker split, and citing either
    side is citing the evidence (D-043).
    """
    found: list[Chunk] = []
    warnings: list[str] = []
    for document in documents:
        for match in find_quote(document.content_text, quote):
            inside = [c for c in document.chunks if c.char_start <= match.char_start and match.char_end <= c.char_end]
            if not inside:
                inside = [c for c in document.chunks if c.char_start < match.char_end and match.char_start < c.char_end]
                if inside:
                    warnings.append(
                        f"quote spans passages {', '.join(str(c.chunk_index) for c in inside)} of {document.file_name}; "
                        "all of them count as correct"
                    )
            found.extend(c for c in inside if c not in found)
    return found, warnings


def resolve(corpus: Corpus, question: GoldenQuestion) -> Resolved:
    if not question.answerable:
        return Resolved(question=question, document=None, expected_chunk_ids=[], expected_chunk_indexes=[])

    named: list[Document] = []
    for name in question.documents:
        document = corpus.find_document(name)
        if document is None:
            names = ", ".join(d.file_name for d in corpus.documents) or "none"
            return Resolved(question, None, [], [], f"no document matching {name!r}. Workspace has: {names}")
        if document.parsed_status != "ready":
            return Resolved(question, document, [], [], f"{document.file_name} is {document.parsed_status}, not ready")
        named.append(document)

    scope = named or corpus.ready
    first = named[0] if named else None
    where = ", ".join(d.file_name for d in named) if named else "any ready document"
    warnings: list[str] = []
    groups: list[list[str]] = []

    # The expected quote, with its acceptable alternatives, is the first required passage.
    primary, notes = _locate(scope, question.expected_quote or "")
    if not primary:
        return Resolved(
            question, first, [], [],
            f"expected_quote was not found in {where}. Copy it verbatim from the document text "
            "(the Documents viewer shows the extracted text).",
        )
    warnings.extend(notes)
    group = list(primary)
    for alternative in question.also_acceptable:
        extra, notes = _locate(corpus.ready, alternative)
        if not extra:
            warnings.append(f"also_acceptable quote not found, ignored: {alternative[:70]!r}")
        warnings.extend(notes)
        group.extend(c for c in extra if c not in group)
    groups.append([c.id for c in group])
    every = list(group)

    for required in question.also_required:
        chunks, notes = _locate(scope, required)
        if not chunks:
            return Resolved(question, first, [], [], f"also_required quote was not found in {where}: {required[:70]!r}")
        warnings.extend(notes)
        groups.append([c.id for c in chunks])
        every.extend(c for c in chunks if c not in every)

    distractors: list[str] = []
    for trap in question.distractor_quotes:
        chunks, _ = _locate(corpus.ready, trap)
        if not chunks:
            warnings.append(f"distractor quote not found, ignored: {trap[:70]!r}")
        distractors.extend(c.id for c in chunks if c.id not in distractors)

    return Resolved(
        question=question,
        document=first,
        expected_chunk_ids=[c.id for c in every],
        expected_chunk_indexes=[c.chunk_index for c in every],
        required_groups=groups,
        distractor_chunk_ids=[d for d in distractors if all(d not in g for g in groups)],
        warnings=warnings,
    )
