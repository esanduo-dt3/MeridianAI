"""Notes: block-based documents stored as a real block tree (PRD MUST).

`notes.content` holds the editor's JSON document, a tree of typed blocks
(headings, paragraphs, lists, to-dos, quotes, code), never a flattened string.
Any member can create and edit notes; the creator or an Admin can delete one
(D-006). Row-level security enforces the same rules.
"""

from __future__ import annotations

import json
from typing import Annotated, Any

from fastapi import APIRouter, Depends, HTTPException, Response, status
from pydantic import BaseModel, StringConstraints, field_validator

from app.core.supabase import Db, user_db
from app.core.workspace import WorkspaceContext, get_workspace_context

router = APIRouter(tags=["notes"])

MAX_CONTENT_BYTES = 512_000
MAX_DEPTH = 40
EMPTY_DOC: dict[str, Any] = {"type": "doc", "content": [{"type": "paragraph"}]}

Title = Annotated[str, StringConstraints(strip_whitespace=True, max_length=200)]


def _depth(node: Any, level: int = 0) -> int:
    if level > MAX_DEPTH:
        return level
    children = node.get("content") if isinstance(node, dict) else None
    if not isinstance(children, list) or not children:
        return level
    return max(_depth(child, level + 1) for child in children)


def validate_block_tree(content: Any) -> dict[str, Any]:
    """A note must be a document node whose content is a list of block nodes."""
    if not isinstance(content, dict) or content.get("type") != "doc":
        raise ValueError("Note content must be a document block tree")
    blocks = content.get("content", [])
    if not isinstance(blocks, list) or any(not isinstance(b, dict) or not isinstance(b.get("type"), str) for b in blocks):
        raise ValueError("Every top-level block needs a type")
    if len(json.dumps(content)) > MAX_CONTENT_BYTES:
        raise ValueError("This note is too large to save")
    if _depth(content) > MAX_DEPTH:
        raise ValueError("This note is nested too deeply")
    return content


def plain_text(node: Any) -> str:
    """Readable text of a block tree, for list previews."""
    if not isinstance(node, dict):
        return ""
    if node.get("type") == "text":
        return str(node.get("text", ""))
    parts = [plain_text(child) for child in node.get("content", []) or []]
    joiner = "\n" if node.get("type") in ("doc", "bulletList", "orderedList", "taskList", "blockquote") else " "
    return joiner.join(p for p in parts if p).strip()


class Author(BaseModel):
    id: str
    email: str
    full_name: str | None = None
    avatar_url: str | None = None


class NoteSummary(BaseModel):
    id: str
    title: str
    preview: str
    created_at: str
    updated_at: str
    created_by: Author | None


class Note(NoteSummary):
    content: dict[str, Any]


class NoteCreate(BaseModel):
    title: Title = ""
    content: dict[str, Any] | None = None

    @field_validator("content")
    @classmethod
    def _content(cls, value: dict[str, Any] | None) -> dict[str, Any] | None:
        return None if value is None else validate_block_tree(value)


class NoteUpdate(BaseModel):
    title: Title | None = None
    content: dict[str, Any] | None = None

    @field_validator("content")
    @classmethod
    def _content(cls, value: dict[str, Any] | None) -> dict[str, Any] | None:
        return None if value is None else validate_block_tree(value)


_SELECT = "id,title,content,created_at,updated_at,created_by:users!notes_created_by_fkey(id,email,full_name,avatar_url)"


def _note(row: dict[str, Any]) -> Note:
    return Note(**{**row, "preview": plain_text(row.get("content"))[:240]})


@router.get("/notes", response_model=list[NoteSummary])
async def list_notes(context: WorkspaceContext = Depends(get_workspace_context), db: Db = Depends(user_db)):
    rows = await db.select("notes", {"select": _SELECT, "workspace_id": f"eq.{context.workspace_id}", "order": "updated_at.desc"})
    return [NoteSummary(**_note(row).model_dump(exclude={"content"})) for row in rows]


@router.get("/notes/{note_id}", response_model=Note)
async def get_note(note_id: str, context: WorkspaceContext = Depends(get_workspace_context), db: Db = Depends(user_db)):
    rows = await db.select("notes", {"select": _SELECT, "id": f"eq.{note_id}", "workspace_id": f"eq.{context.workspace_id}"})
    if not rows:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Note not found")
    return _note(rows[0])


@router.post("/notes", response_model=Note, status_code=status.HTTP_201_CREATED)
async def create_note(body: NoteCreate, context: WorkspaceContext = Depends(get_workspace_context), db: Db = Depends(user_db)):
    row = await db.insert(
        "notes",
        {
            "workspace_id": context.workspace_id,
            "created_by": context.user_id,
            "title": body.title,
            "content": body.content or EMPTY_DOC,
        },
        select=_SELECT,
    )
    return _note(row)


@router.patch("/notes/{note_id}", response_model=Note)
async def update_note(
    note_id: str, body: NoteUpdate, context: WorkspaceContext = Depends(get_workspace_context), db: Db = Depends(user_db)
):
    changes = body.model_dump(exclude_unset=True, exclude_none=True)
    if not changes:
        raise HTTPException(status.HTTP_422_UNPROCESSABLE_ENTITY, "Nothing to update")
    rows = await db.update("notes", {"id": f"eq.{note_id}", "workspace_id": f"eq.{context.workspace_id}"}, changes, select=_SELECT)
    if not rows:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Note not found")
    return _note(rows[0])


@router.delete("/notes/{note_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_note(note_id: str, context: WorkspaceContext = Depends(get_workspace_context), db: Db = Depends(user_db)):
    deleted = await db.delete("notes", {"id": f"eq.{note_id}", "workspace_id": f"eq.{context.workspace_id}"})
    if not deleted:
        # Row-level security hides the row from anyone who may not delete it.
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Note not found, or only its author or an Admin can delete it")
    return Response(status_code=status.HTTP_204_NO_CONTENT)
