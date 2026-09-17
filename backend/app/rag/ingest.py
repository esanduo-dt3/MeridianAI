"""Ingestion: parse, chunk, embed, store (docs/decisions.md D-022, D-023, D-025).

Runs in the background after the upload request returns, and reports progress
through documents.parsed_status (pending, processing, ready, failed), with
processing_stage (parsing, embedding) and embedded_count while it runs, so the
Documents page can show it.

Passages are saved as soon as the document is chunked, before embedding, so they
can be previewed while embeddings are written batch by batch (D-034).

Every row written carries the document's workspace_id: the workspace is the
search namespace. Writes use the service role because users may not write
chunks directly; the API has already checked the uploader is an Admin.

A failure never leaves a half-indexed document searchable: search only reads
documents marked ready. The document is marked failed with a readable reason, and
its saved passages stay visible until it is reprocessed or deleted.
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


class IngestFailure(Exception):
    """A reason safe to show to the uploader."""


def _vector_literal(vector: list[float]) -> str:
    return "[" + ",".join(f"{v:.7f}" for v in vector) + "]"


def _parse_and_chunk(doc_type: str, data: bytes, file_name: str) -> tuple[str, list[Chunk], dict[str, int], int]:
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
    await db.delete("chunks", {"document_id": f"eq.{document_id}"})
    await db.delete("chunk_embeddings", {"document_id": f"eq.{document_id}"})


async def process_document(*, document_id: str, workspace_id: str, file_name: str, doc_type: str, data: bytes) -> None:
    """Background task with its own service-role connection."""
    async with open_service_db() as db:
        await _process(db, document_id=document_id, workspace_id=workspace_id, file_name=file_name, doc_type=doc_type, data=data)


async def _process(db: Db, *, document_id: str, workspace_id: str, file_name: str, doc_type: str, data: bytes) -> None:
    started = time.perf_counter()
    try:
        await db.update(
            "documents",
            {"id": f"eq.{document_id}"},
            {"parsed_status": "processing", "processing_stage": "parsing", "parse_error": None, "embedded_count": 0, "chunk_count": 0},
            select="id",
        )
        await _clear_chunks(db, document_id)
        try:
            text, chunks, stats, pages = await to_thread.run_sync(_parse_and_chunk, doc_type, data, file_name)
        except UnsupportedDocument as exc:
            raise IngestFailure(str(exc)) from exc
        except Exception as exc:  # noqa: BLE001 - malformed files raise many exception types
            log.warning("parsing failed for %s", document_id, exc_info=True)
            raise IngestFailure("The file couldn't be read. It may be damaged or password-protected.") from exc

        if not chunks:
            if stats.get("pages_without_text"):
                raise IngestFailure("No text was found. The PDF looks scanned, and scanned pages aren't supported yet.")
            raise IngestFailure("No readable text was found in this document.")

        # Save the passages before embedding so they can be previewed while it runs
        # (D-034). Search ignores the document until it is ready.
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
            batch=200,
        )
        await db.update(
            "documents",
            {"id": f"eq.{document_id}"},
            {
                "content_text": text,
                "page_count": pages or None,
                "chunk_count": len(chunks),
                "parse_stats": stats,
                "processing_stage": "embedding",
            },
            select="id",
        )

        settings = get_settings()
        gateway = get_gateway()
        model_label = f"{settings.gemini_embed_model}@{settings.embed_dim}"
        batch_size = max(1, min(settings.embed_batch_size, settings.embed_requests_per_minute))
        for first in range(0, len(chunks), batch_size):
            indexes = range(first, min(first + batch_size, len(chunks)))
            try:
                vectors = await gateway.embed([chunks[i].embed_text for i in indexes], "document")
            except QuotaExceeded as exc:
                if exc.daily:
                    raise IngestFailure("The daily Gemini embedding quota is used up. Reprocess this document tomorrow, or use a paid key.") from exc
                raise IngestFailure("The Gemini embedding quota was busy. Wait a minute, then reprocess this document.") from exc
            except ModelError as exc:
                raise IngestFailure("Embedding failed because the model provider returned an error. Try reprocessing.") from exc
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
                batch=40,
            )
            await db.rpc(
                "attach_chunk_embeddings",
                {
                    "p_document_id": document_id,
                    "p_pairs": [{"chunk_id": chunk_ids[i], "embedding_id": e} for i, e in zip(indexes, embedding_ids)],
                },
            )

        await db.update(
            "documents",
            {"id": f"eq.{document_id}"},
            {
                "parsed_status": "ready",
                "processing_stage": None,
                "parse_error": None,
                "processed_at": datetime.now(timezone.utc).isoformat(),
            },
            select="id",
        )
        await audit.record(
            db,
            workspace_id=workspace_id,
            actor_id=None,
            actor_type="system",
            action="document.processed",
            target_type="document",
            target_id=document_id,
            details={"chunks": len(chunks), "stats": stats, "seconds": round(time.perf_counter() - started, 2)},
        )
        log.info("ingested %s: %s chunks in %.2fs", document_id, len(chunks), time.perf_counter() - started)
    except Exception as exc:  # noqa: BLE001 - every failure must leave the document in a clear state
        reason = str(exc) if isinstance(exc, IngestFailure) else "Processing failed unexpectedly. Try again."
        if not isinstance(exc, IngestFailure):
            log.exception("ingestion failed for %s", document_id)
        try:
            # Passages already saved stay visible so the failure can be inspected;
            # search ignores a failed document, and reprocessing clears them.
            await db.update(
                "documents",
                {"id": f"eq.{document_id}"},
                {"parsed_status": "failed", "processing_stage": None, "parse_error": reason},
                select="id",
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
        except Exception:  # noqa: BLE001
            log.exception("could not record ingestion failure for %s", document_id)
