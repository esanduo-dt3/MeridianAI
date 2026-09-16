"""Ingest a folder of documents into a workspace, one at a time, and confirm
every passage was embedded.

Sequential on purpose. The free Gemini tier counts each embedded text as a
request and allows 100 a minute (D-033), so the gateway paces itself; running
documents in parallel would only make them queue behind each other while
making failures harder to attribute.

Re-running is safe: a document already ingested and ready is skipped, so a run
stopped by the daily quota can be resumed the next day.

    .venv/bin/python -m evals.ingest --folder ../golden-docs --workspace <id>
"""

from __future__ import annotations

import argparse
import asyncio
import hashlib
import time
import uuid
from pathlib import Path

from app.core import storage
from app.core.supabase import Db, open_service_db
from app.rag.ingest import process_document
from app.rag.parse import ALLOWED_MIME, MAX_UPLOAD_BYTES, UnsupportedDocument, detect_type
from evals._cli import admin_user_id, fail, resolve_workspace, say

SUFFIXES = {".pdf", ".docx"}


async def main() -> int:
    parser = argparse.ArgumentParser(description="Ingest a folder of documents into a workspace.")
    parser.add_argument("--folder", required=True, type=Path, help="folder of .pdf and .docx files")
    parser.add_argument("--workspace", help="workspace id or a unique part of its name")
    parser.add_argument("--dry-run", action="store_true", help="list what would be ingested and stop")
    args = parser.parse_args()

    folder: Path = args.folder.expanduser()
    if not folder.is_dir():
        fail(f"{folder} is not a folder")
    files = sorted(p for p in folder.iterdir() if p.suffix.lower() in SUFFIXES and p.is_file())
    if not files:
        fail(f"{folder} has no .pdf or .docx files")

    async with open_service_db() as db:
        workspace_id, workspace_name = await resolve_workspace(db, args.workspace)
        say(f"Workspace: {workspace_name}  ({workspace_id})")
        say(f"Folder:    {folder}  ({len(files)} files)")
        say()

        if args.dry_run:
            for path in files:
                say(f"  would ingest {path.name}  ({path.stat().st_size / 1024:.0f} KB)")
            return 0

        owner = await admin_user_id(db, workspace_id)
        results: list[tuple[str, str, int, int, float]] = []
        stopped_early = False

        for number, path in enumerate(files, start=1):
            say(f"[{number}/{len(files)}] {path.name}")
            try:
                status, chunks, embedded, seconds = await _ingest_one(db, workspace_id, owner, path)
            except UnsupportedDocument as exc:
                say(f"    skipped: {exc}")
                results.append((path.name, "unsupported", 0, 0, 0.0))
                continue

            results.append((path.name, status, chunks, embedded, seconds))
            if status == "ready":
                say(f"    ready: {chunks} passages, all embedded, {seconds:.0f}s")
            elif status == "skipped":
                say(f"    already ingested and ready: {chunks} passages")
            else:
                detail = await _error_of(db, workspace_id, path.name)
                say(f"    FAILED after {seconds:.0f}s: {detail}")
                if detail and "daily" in detail.casefold():
                    say()
                    say("    The daily embedding quota is gone. Re-run this exact command tomorrow;")
                    say("    documents already ready are skipped and this one resumes from the start.")
                    stopped_early = True
                    break

        say()
        _summary(results)
        not_ready = [r for r in results if r[1] not in ("ready", "skipped")]
        if stopped_early or not_ready:
            say()
            say(f"{len(not_ready)} document(s) are not ready. The corpus is incomplete; do not run the eval yet.")
            return 1
        say()
        say("Every document is ready and fully embedded.")
        return 0


async def _ingest_one(db: Db, workspace_id: str, owner: str, path: Path) -> tuple[str, int, int, float]:
    data = path.read_bytes()
    if not data:
        return "empty", 0, 0, 0.0
    if len(data) > MAX_UPLOAD_BYTES:
        return "too_large", 0, 0, 0.0

    file_name = storage.safe_filename(path.name)
    doc_type = detect_type(file_name, None)  # raises UnsupportedDocument
    content_hash = hashlib.sha256(data).hexdigest()

    existing = await db.select(
        "documents",
        {
            "select": "id,parsed_status,chunk_count,embedded_count",
            "workspace_id": f"eq.{workspace_id}",
            "content_hash": f"eq.{content_hash}",
            "limit": "1",
        },
    )
    if existing and existing[0]["parsed_status"] == "ready":
        row = existing[0]
        return "skipped", row.get("chunk_count") or 0, row.get("embedded_count") or 0, 0.0

    if existing:
        document_id = existing[0]["id"]  # reprocess in place; ingestion clears old passages
        say("    retrying a document that did not finish")
    else:
        document_id = str(uuid.uuid4())
        object_path = f"{workspace_id}/{document_id}/{file_name}"
        await storage.upload(object_path, data, ALLOWED_MIME[doc_type], user_token=None)
        await db.insert(
            "documents",
            {
                "id": document_id,
                "workspace_id": workspace_id,
                "uploaded_by": owner,
                "file_path": object_path,
                "file_name": file_name,
                "mime_type": ALLOWED_MIME[doc_type],
                "size_bytes": len(data),
                "doc_type": doc_type,
                "content_hash": content_hash,
                "parsed_status": "pending",
            },
            select="id",
        )

    started = time.perf_counter()
    # Records its own failure on the document row rather than raising.
    await process_document(
        document_id=document_id, workspace_id=workspace_id, file_name=file_name, doc_type=doc_type, data=data
    )
    seconds = time.perf_counter() - started

    row = await db.select_one(
        "documents", {"select": "parsed_status,chunk_count,embedded_count", "id": f"eq.{document_id}"}
    )
    chunks = row.get("chunk_count") or 0
    embedded = row.get("embedded_count") or 0
    status = row["parsed_status"]
    if status == "ready" and embedded != chunks:
        # Belt and braces: ready must mean every passage is searchable.
        return "incomplete", chunks, embedded, seconds
    return status, chunks, embedded, seconds


async def _error_of(db: Db, workspace_id: str, file_name: str) -> str:
    rows = await db.select(
        "documents",
        {
            "select": "parse_error",
            "workspace_id": f"eq.{workspace_id}",
            "file_name": f"eq.{storage.safe_filename(file_name)}",
            "limit": "1",
        },
    )
    return (rows[0].get("parse_error") if rows else None) or "no reason recorded"


def _summary(results: list[tuple[str, str, int, int, float]]) -> None:
    width = max((len(r[0]) for r in results), default=10)
    say(f"{'document'.ljust(width)}  {'status':<11} {'passages':>8} {'embedded':>8}")
    say(f"{'-' * width}  {'-' * 11} {'-' * 8} {'-' * 8}")
    for name, status, chunks, embedded, _ in results:
        say(f"{name.ljust(width)}  {status:<11} {chunks:>8} {embedded:>8}")
    total = sum(r[2] for r in results if r[1] in ("ready", "skipped"))
    say(f"{'total'.ljust(width)}  {'':<11} {total:>8}")
    if 0 < total < 150:
        say()
        say(f"Note: {total} passages is a small corpus. `lookup` keeps 5 of 20 candidates, so G1 can pass")
        say("almost by construction below roughly 150 passages. Consider adding more documents.")


if __name__ == "__main__":
    raise SystemExit(asyncio.run(main()))
