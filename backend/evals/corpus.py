"""The workspace under test: its documents, their text, and their passages.

Read with the service role, because an eval run has no signed-in user to act
for. Everything here is read-only.
"""

from __future__ import annotations

from dataclasses import dataclass

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
        """Match on the file name, then on a unique case-insensitive partial name."""
        for document in self.documents:
            if document.file_name == name:
                return document
        lowered = name.casefold()
        hits = [d for d in self.documents if lowered in d.file_name.casefold()]
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


@dataclass
class Resolved:
    question: GoldenQuestion
    document: Document | None
    expected_chunk_ids: list[str]
    expected_chunk_indexes: list[int]
    problem: str | None = None

    @property
    def ok(self) -> bool:
        return self.problem is None


def resolve(corpus: Corpus, question: GoldenQuestion) -> Resolved:
    if not question.answerable:
        return Resolved(question=question, document=None, expected_chunk_ids=[], expected_chunk_indexes=[])

    document = corpus.find_document(question.document) if question.document else None
    if question.document and document is None:
        names = ", ".join(d.file_name for d in corpus.documents) or "none"
        return Resolved(question, None, [], [], f"no document matching {question.document!r}. Workspace has: {names}")
    if document is not None and document.parsed_status != "ready":
        return Resolved(question, document, [], [], f"{document.file_name} is {document.parsed_status}, not ready")

    named = [document] if document is not None else corpus.ready
    quotes = [question.expected_quote, *question.also_acceptable]

    chunk_ids: list[str] = []
    chunk_indexes: list[int] = []
    straddled: list[str] = []
    missing: list[str] = []

    for position, quote in enumerate(quotes):
        if not quote:
            continue
        # The expected quote is looked for in the document the question names.
        # Alternates are looked for across the whole corpus: a fact stated in two
        # documents is legitimately citable from either, and scoping them to the
        # named document would mark a correct citation wrong.
        searched = named if position == 0 else corpus.ready
        hits: list[tuple[Document, QuoteMatch]] = []
        for candidate in searched:
            hits.extend((candidate, m) for m in find_quote(candidate.content_text, quote))
        if not hits:
            missing.append(quote)
            continue
        for candidate, match in hits:
            containing = [
                c for c in candidate.chunks if c.char_start <= match.char_start and match.char_end <= c.char_end
            ]
            if not containing:
                straddled.append(quote)
                continue
            for chunk in containing:
                if chunk.id not in chunk_ids:
                    chunk_ids.append(chunk.id)
                    chunk_indexes.append(chunk.chunk_index)

    if question.expected_quote in missing:
        where = document.file_name if document else "any ready document"
        return Resolved(
            question,
            document,
            [],
            [],
            f"expected_quote was not found in {where}. Copy it verbatim from the document text "
            "(the Documents viewer shows the extracted text).",
        )
    if not chunk_ids and straddled:
        return Resolved(
            question,
            document,
            [],
            [],
            "expected_quote spans a passage boundary and sits inside no single passage. Shorten it, or move it "
            "to the sentence the answer really rests on.",
        )
    if not chunk_ids:
        return Resolved(question, document, [], [], "expected_quote could not be resolved to a passage")

    return Resolved(question, document, chunk_ids, chunk_indexes)
