"""Documents: upload into a workspace, list, inspect chunks, reprocess, delete.

The workspace a document belongs to is the one named in X-Workspace-Id; the
uploader must be an Admin there (D-006). That workspace becomes the document's
search namespace (D-025).
"""

from __future__ import annotations

import hashlib
import uuid
from typing import Literal

from fastapi import APIRouter, BackgroundTasks, Depends, File, HTTPException, UploadFile, status
from pydantic import BaseModel

from app.core import audit, storage
from app.core.security import AuthenticatedUser, get_current_user
from app.core.supabase import Db, service_db, user_db
from app.core.workspace import WorkspaceContext, get_workspace_context, require_admin
from app.rag.ingest import process_document
from app.rag.parse import ALLOWED_MIME, MAX_UPLOAD_BYTES, UnsupportedDocument, detect_type

router = APIRouter(tags=["documents"])

ParsedStatus = Literal["pending", "processing", "ready", "failed"]


class Uploader(BaseModel):
    id: str
    email: str
    full_name: str | None = None


class DocumentSummary(BaseModel):
    id: str
    file_name: str
    doc_type: str | None
    mime_type: str
    size_bytes: int
    parsed_status: ParsedStatus
    processing_stage: Literal["parsing", "embedding"] | None = None
    parse_error: str | None
    page_count: int | None
    chunk_count: int
    embedded_count: int = 0
    parse_stats: dict
    created_at: str
    processed_at: str | None
    uploaded_by: Uploader | None


class ChunkInfo(BaseModel):
    id: str
    chunk_index: int
    char_start: int
    char_end: int
    page: int | None
    section: str
    kind: str
    token_count: int
    embedded: bool  # False while the document is still embedding


class DocumentDetail(DocumentSummary):
    content_text: str | None
    chunks: list[ChunkInfo]


_SUMMARY_SELECT = (
    "id,file_name,doc_type,mime_type,size_bytes,parsed_status,processing_stage,parse_error,page_count,chunk_count,"
    "embedded_count,parse_stats,"
    "created_at,processed_at,uploaded_by:users!documents_uploaded_by_fkey(id,email,full_name)"
)


@router.get("/documents", response_model=list[DocumentSummary])
async def list_documents(context: WorkspaceContext = Depends(get_workspace_context), db: Db = Depends(user_db)):
    rows = await db.select(
        "documents", {"select": _SUMMARY_SELECT, "workspace_id": f"eq.{context.workspace_id}", "order": "created_at.desc"}
    )
    return [DocumentSummary(**row) for row in rows]


@router.get("/documents/{document_id}", response_model=DocumentDetail)
async def get_document(document_id: str, context: WorkspaceContext = Depends(get_workspace_context), db: Db = Depends(user_db)):
    rows = await db.select(
        "documents",
        {"select": f"{_SUMMARY_SELECT},content_text", "id": f"eq.{document_id}", "workspace_id": f"eq.{context.workspace_id}"},
    )
    if not rows:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Document not found")
    chunks = await db.select(
        "chunks",
        {
            "select": "id,chunk_index,char_start,char_end,page,section,kind,token_count,embedding_ref",
            "document_id": f"eq.{document_id}",
            "order": "chunk_index.asc",
        },
    )
    infos = [ChunkInfo(**{k: v for k, v in c.items() if k != "embedding_ref"}, embedded=c["embedding_ref"] is not None) for c in chunks]
    return DocumentDetail(**rows[0], chunks=infos)


@router.post("/documents/upload", response_model=DocumentSummary, status_code=status.HTTP_202_ACCEPTED)
async def upload_document(
    background: BackgroundTasks,
    file: UploadFile = File(...),
    context: WorkspaceContext = Depends(require_admin),
    user: AuthenticatedUser = Depends(get_current_user),
    db: Db = Depends(user_db),
    service: Db = Depends(service_db),
):
    file_name = storage.safe_filename(file.filename or "document")
    try:
        doc_type = detect_type(file_name, file.content_type)
    except UnsupportedDocument as exc:
        raise HTTPException(status.HTTP_415_UNSUPPORTED_MEDIA_TYPE, str(exc)) from exc

    data = await file.read(MAX_UPLOAD_BYTES + 1)
    if len(data) > MAX_UPLOAD_BYTES:
        raise HTTPException(status.HTTP_413_REQUEST_ENTITY_TOO_LARGE, "The file is larger than 25 MB")
    if not data:
        raise HTTPException(status.HTTP_422_UNPROCESSABLE_ENTITY, "The file is empty")

    content_hash = hashlib.sha256(data).hexdigest()
    duplicate = await db.select(
        "documents",
        {"select": "id,file_name", "workspace_id": f"eq.{context.workspace_id}", "content_hash": f"eq.{content_hash}"},
    )
    if duplicate:
        raise HTTPException(
            status.HTTP_409_CONFLICT, f"This file is already in the workspace as \"{duplicate[0]['file_name']}\""
        )

    document_id = str(uuid.uuid4())
    path = f"{context.workspace_id}/{document_id}/{file_name}"
    mime = ALLOWED_MIME[doc_type]
    await storage.upload(path, data, mime, user_token=user.token)
    try:
        row = await db.insert(
            "documents",
            {
                "id": document_id,
                "workspace_id": context.workspace_id,
                "uploaded_by": context.user_id,
                "file_path": path,
                "file_name": file_name,
                "mime_type": mime,
                "size_bytes": len(data),
                "doc_type": doc_type,
                "content_hash": content_hash,
                "parsed_status": "pending",
            },
            select=_SUMMARY_SELECT,
        )
    except HTTPException:
        await storage.remove(path)
        raise

    await audit.record(
        service,
        workspace_id=context.workspace_id,
        actor_id=context.user_id,
        actor_type="user",
        action="document.uploaded",
        target_type="document",
        target_id=document_id,
        details={"file_name": file_name, "size_bytes": len(data), "doc_type": doc_type},
    )
    background.add_task(
        process_document,
        document_id=document_id,
        workspace_id=context.workspace_id,
        file_name=file_name,
        doc_type=doc_type,
        data=data,
    )
    return DocumentSummary(**row)


@router.post("/documents/{document_id}/reprocess", response_model=DocumentSummary, status_code=status.HTTP_202_ACCEPTED)
async def reprocess_document(
    document_id: str,
    background: BackgroundTasks,
    context: WorkspaceContext = Depends(require_admin),
    db: Db = Depends(user_db),
):
    rows = await db.select(
        "documents", {"select": f"{_SUMMARY_SELECT},file_path", "id": f"eq.{document_id}", "workspace_id": f"eq.{context.workspace_id}"}
    )
    if not rows:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Document not found")
    row = rows[0]
    if row["parsed_status"] in ("pending", "processing"):
        raise HTTPException(status.HTTP_409_CONFLICT, "This document is already being processed")
    data = await storage.download(row.pop("file_path"))
    background.add_task(
        process_document,
        document_id=document_id,
        workspace_id=context.workspace_id,
        file_name=row["file_name"],
        doc_type=row["doc_type"],
        data=data,
    )
    return DocumentSummary(**{**row, "parsed_status": "pending", "parse_error": None})


@router.delete("/documents/{document_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_document(
    document_id: str,
    context: WorkspaceContext = Depends(require_admin),
    db: Db = Depends(user_db),
    service: Db = Depends(service_db),
):
    rows = await db.select(
        "documents", {"select": "id,file_path,file_name", "id": f"eq.{document_id}", "workspace_id": f"eq.{context.workspace_id}"}
    )
    if not rows:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Document not found")
    # Chunks and embeddings are removed with the document (on delete cascade).
    await db.delete("documents", {"id": f"eq.{document_id}", "workspace_id": f"eq.{context.workspace_id}"})
    await storage.remove(rows[0]["file_path"])
    await audit.record(
        service,
        workspace_id=context.workspace_id,
        actor_id=context.user_id,
        actor_type="user",
        action="document.deleted",
        target_type="document",
        target_id=document_id,
        details={"file_name": rows[0]["file_name"]},
    )
