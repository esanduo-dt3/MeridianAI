"""Ingestion orchestration: parse, chunk, embed, store (D-022, D-023, D-025).

Runs in the background after the upload request has already returned, and
reports progress through ``documents.parsed_status`` (pending, processing,
ready, failed) with ``processing_stage`` (parsing, embedding) and
``embedded_count``, which is what the Documents page polls.

Passages are saved as soon as the document is chunked, before any embedding, so
they can be previewed while vectors are written batch by batch (D-034).

Every row written carries the document's ``workspace_id``: the workspace is the
search namespace. Writes use the service role because users may not write chunks
directly; the API has already checked the uploader is an Admin.

A failure never leaves a half-indexed document searchable: search only reads
documents marked ``ready``. The document is marked ``failed`` with a readable
reason, and the passages already saved stay visible until it is reprocessed or
deleted.
"""

from __future__ import annotations

import logging
import time
import uuid
from datetime import datetime, timezone

from anyio import to_thread

from app.core import audit
from app.core.config import get_settings
from app.core.supabase import Db, open_service_db
from app.llm.gateway import ModelError, QuotaExceeded, get_gateway
from app.rag.chunker import Chunk, chunk_document
from app.rag.parse import UnsupportedDocument, check_file, parse_file

log = logging.getLogger(__name__)

#: Rows per insert. Chunks are small; embedding rows carry a 1,536-float vector.
_CHUNK_INSERT_BATCH = 200
_EMBEDDING_INSERT_BATCH = 40

# Messages shown to the uploader verbatim.
_UNREADABLE = "The file couldn't be read. It may be damaged or password-protected."
_SCANNED = "No text was found. The PDF looks scanned, and scanned pages aren't supported yet."
_NO_TEXT = "No readable text was found in this document."
_QUOTA_DAILY = "The daily Gemini embedding quota is used up. Reprocess this document tomorrow, or use a paid key."
_QUOTA_MINUTE = "The Gemini embedding quota was busy. Wait a minute, then reprocess this document."
_MODEL_ERROR = "Embedding failed because the model provider returned an error. Try reprocessing."
_UNEXPECTED = "Processing failed unexpectedly. Try again."


# PUBLIC_INTERFACE
class IngestFailure(Exception):
    """An ingestion failure whose message is safe to show to the uploader."""


def _vector_literal(vector: list[float]) -> str:
    """Render an embedding as the pgvector text literal PostgREST accepts."""
    return "[" + ",".join(f"{v:.7f}" for v in vector) + "]"


def _parse_and_chunk(doc_type: str, data: bytes, file_name: str) -> tuple[str, list[Chunk], dict[str, int], int]:
    """Validate, parse and chunk a file. CPU-bound, so it runs in a worker thread.

    :returns: ``(canonical_text, chunks, parser_stats, page_count)``.
    :raises UnsupportedDocument: When the file fails validation or splits into
        more passages than ``MAX_PASSAGES_PER_DOCUMENT``.
    """
    check_file(doc_type, data)
    parsed = parse_file(doc_type, data)
    text, chunks = chunk_document(parsed, source=file_name)
    limit = get_settings().max_passages_per_document
    if len(chunks) > limit:
        raise UnsupportedDocument(
            f"This document splits into {len(chunks)} passages; the limit is {limit}. Split it into smaller files."
        )
    return text, chunks, parsed.stats, parsed.page_count


async def _clear_chunks(db: Db, document_id: str) -> None:
    """Remove any chunks and embeddings from a previous run, so reprocessing is clean."""
    await db.delete("chunks", {"document_id": f"eq.{document_id}"})
    await db.delete("chunk_embeddings", {"document_id": f"eq.{document_id}"})


async def _set_document(db: Db, document_id: str, fields: dict) -> None:
    """Patch one document row by id."""
    await db.update("documents", {"id": f"eq.{document_id}"}, fields, select="id")


async def _begin(db: Db, document_id: str) -> None:
    """Move the document into processing/parsing and drop stale index rows."""
    await _set_document(
        db,
        document_id,
        {
            "parsed_status": "processing",
            "processing_stage": "parsing",
            "parse_error": None,
            "embedded_count": 0,
            "chunk_count": 0,
        },
    )
    await _clear_chunks(db, document_id)


async def _extract(document_id: str, file_name: str, doc_type: str, data: bytes):
    """Run parsing and chunking off the event loop, mapping failures to messages."""
    try:
        return await to_thread.run_sync(_parse_and_chunk, doc_type, data, file_name)
    except UnsupportedDocument as exc:
        raise IngestFailure(str(exc)) from exc
    except Exception as exc:  # noqa: BLE001 - malformed files raise many exception types
        log.warning("parsing failed for %s", document_id, exc_info=True)
        raise IngestFailure(_UNREADABLE) from exc


def _require_chunks(chunks: list[Chunk], stats: dict[str, int]) -> None:
    """Fail with the most informative reason when a document yielded no passages."""
    if chunks:
        return
    if stats.get("pages_without_text"):
        raise IngestFailure(_SCANNED)
    raise IngestFailure(_NO_TEXT)


async def _save_chunks(
    db: Db,
    *,
    document_id: str,
    workspace_id: str,
    chunks: list[Chunk],
    text: str,
    stats: dict[str, int],
    pages: int,
) -> list[str]:
    """Store every passage before embedding starts, so they can be previewed (D-034).

    :returns: The generated chunk ids, aligned with `chunks`.
    """
    chunk_ids = [str(uuid.uuid4()) for _ in chunks]
    await db.insert_many(
        "chunks",
        [
            {
                "id": chunk_ids[i],
                "document_id": document_id,
                "workspace_id": workspace_id,
                "chunk_index": chunk.index,
                "content": chunk.text,
                "char_start": chunk.start,
                "char_end": chunk.end,
                "kind": chunk.kind,
                "section": chunk.section,
                "page": chunk.page,
                "token_count": chunk.tokens,
                "context": chunk.context,
            }
            for i, chunk in enumerate(chunks)
        ],
        batch=_CHUNK_INSERT_BATCH,
    )
    await _set_document(
        db,
        document_id,
        {
            "content_text": text,
            "page_count": pages or None,
            "chunk_count": len(chunks),
            "parse_stats": stats,
            "processing_stage": "embedding",
        },
    )
    return chunk_ids


async def _embed_batch(gateway, chunks: list[Chunk], indexes: range) -> list[list[float]]:
    """Embed one batch of passages, translating provider errors for the uploader (D-033)."""
    try:
        return await gateway.embed([chunks[i].embed_text for i in indexes], "document")
    except QuotaExceeded as exc:
        raise IngestFailure(_QUOTA_DAILY if exc.daily else _QUOTA_MINUTE) from exc
    except ModelError as exc:
        raise IngestFailure(_MODEL_ERROR) from exc


async def _embed_chunks(db: Db, *, document_id: str, workspace_id: str, chunks: list[Chunk], chunk_ids: list[str]) -> None:
    """Embed every passage in paced batches and attach the vectors to their chunks.

    ``attach_chunk_embeddings`` sets each chunk's ``embedding_ref`` and refreshes
    ``embedded_count`` in one statement, so the Documents page sees progress
    batch by batch.
    """
    settings = get_settings()
    gateway = get_gateway()
    model_label = f"{settings.gemini_embed_model}@{settings.embed_dim}"
    # The free tier counts every text in a batch as one request, so the batch can
    # never exceed the per-minute budget.
    batch_size = max(1, min(settings.embed_batch_size, settings.embed_requests_per_minute))

    for first in range(0, len(chunks), batch_size):
        indexes = range(first, min(first + batch_size, len(chunks)))
        vectors = await _embed_batch(gateway, chunks, indexes)
        embedding_ids = [str(uuid.uuid4()) for _ in indexes]
        await db.insert_many(
            "chunk_embeddings",
            [
                {
                    "id": embedding_id,
                    "workspace_id": workspace_id,
                    "document_id": document_id,
                    "model": model_label,
                    "embedding": _vector_literal(vector),
                }
                for embedding_id, vector in zip(embedding_ids, vectors)
            ],
            batch=_EMBEDDING_INSERT_BATCH,
        )
        await db.rpc(
            "attach_chunk_embeddings",
            {
                "p_document_id": document_id,
                "p_pairs": [
                    {"chunk_id": chunk_ids[i], "embedding_id": embedding_id}
                    for i, embedding_id in zip(indexes, embedding_ids)
                ],
            },
        )


async def _finish(db: Db, *, document_id: str, workspace_id: str, chunks: int, stats: dict[str, int], seconds: float) -> None:
    """Mark the document ready and audit the successful run."""
    await _set_document(
        db,
        document_id,
        {
            "parsed_status": "ready",
            "processing_stage": None,
            "parse_error": None,
            "processed_at": datetime.now(timezone.utc).isoformat(),
        },
    )
    await audit.record(
        db,
        workspace_id=workspace_id,
        actor_id=None,
        actor_type="system",
        action="document.processed",
        target_type="document",
        target_id=document_id,
        details={"chunks": chunks, "stats": stats, "seconds": round(seconds, 2)},
    )


async def _fail(db: Db, *, document_id: str, workspace_id: str, reason: str) -> None:
    """Mark the document failed with a readable reason and audit the failure.

    Passages already saved stay visible so the failure can be inspected; search
    ignores a failed document, and reprocessing clears them.
    """
    try:
        await _set_document(
            db,
            document_id,
            {"parsed_status": "failed", "processing_stage": None, "parse_error": reason},
        )
        await audit.record(
            db,
            workspace_id=workspace_id,
            actor_id=None,
            actor_type="system",
            action="document.failed",
            target_type="document",
            target_id=document_id,
            details={"reason": reason},
        )
    except Exception:  # noqa: BLE001 - the failure path must never raise
        log.exception("could not record ingestion failure for %s", document_id)


# PUBLIC_INTERFACE
async def process_document(*, document_id: str, workspace_id: str, file_name: str, doc_type: str, data: bytes) -> None:
    """Ingest one uploaded document in the background.

    Opens its own service-role connection, because the request's connection is
    gone by the time this runs.

    :param document_id: The ``documents`` row to fill in.
    :param workspace_id: The document's workspace, and its search namespace.
    :param file_name: Sanitised file name, used in each chunk's context line.
    :param doc_type: ``pdf`` or ``docx``.
    :param data: The complete file bytes.
    """
    async with open_service_db() as db:
        await _process(
            db,
            document_id=document_id,
            workspace_id=workspace_id,
            file_name=file_name,
            doc_type=doc_type,
            data=data,
        )


async def _process(db: Db, *, document_id: str, workspace_id: str, file_name: str, doc_type: str, data: bytes) -> None:
    """Run the ingestion stages, leaving the document in a terminal state either way."""
    started = time.perf_counter()
    try:
        await _begin(db, document_id)

        text, chunks, stats, pages = await _extract(document_id, file_name, doc_type, data)
        _require_chunks(chunks, stats)

        chunk_ids = await _save_chunks(
            db,
            document_id=document_id,
            workspace_id=workspace_id,
            chunks=chunks,
            text=text,
            stats=stats,
            pages=pages,
        )
        await _embed_chunks(
            db,
            document_id=document_id,
            workspace_id=workspace_id,
            chunks=chunks,
            chunk_ids=chunk_ids,
        )

        elapsed = time.perf_counter() - started
        await _finish(db, document_id=document_id, workspace_id=workspace_id, chunks=len(chunks), stats=stats, seconds=elapsed)
        log.info("ingested %s: %s chunks in %.2fs", document_id, len(chunks), elapsed)
    except Exception as exc:  # noqa: BLE001 - every failure must leave a clear state
        reason = str(exc) if isinstance(exc, IngestFailure) else _UNEXPECTED
        if not isinstance(exc, IngestFailure):
            log.exception("ingestion failed for %s", document_id)
        await _fail(db, document_id=document_id, workspace_id=workspace_id, reason=reason)
