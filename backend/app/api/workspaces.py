"""Workspaces: list the caller's, create one, rename, leave (docs/decisions.md D-006)."""

from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel, StringConstraints

from app.core import audit
from app.core.security import AuthenticatedUser, get_current_user
from app.core.supabase import Db, service_db, user_db
from app.core.workspace import AuthRole, WorkspaceContext, get_workspace_context, require_admin

router = APIRouter(tags=["workspaces"])

WorkspaceName = Annotated[str, StringConstraints(strip_whitespace=True, min_length=1, max_length=80)]


class WorkspaceSummary(BaseModel):
    id: str
    name: str
    auth_role: AuthRole
    created_at: str


class WorkspaceCreate(BaseModel):
    name: WorkspaceName


class WorkspaceRename(BaseModel):
    name: WorkspaceName


async def list_my_workspaces(user_id: str, db: Db) -> list[WorkspaceSummary]:
    rows = await db.select(
        "workspace_members",
        {
            "select": "auth_role,joined_at,workspaces(id,name,created_at)",
            "user_id": f"eq.{user_id}",
            "order": "joined_at.asc",
        },
    )
    return [
        WorkspaceSummary(
            id=row["workspaces"]["id"],
            name=row["workspaces"]["name"],
            created_at=row["workspaces"]["created_at"],
            auth_role=row["auth_role"],
        )
        for row in rows
        if row.get("workspaces")
    ]


@router.get("/workspaces", response_model=list[WorkspaceSummary])
async def list_workspaces(user: AuthenticatedUser = Depends(get_current_user), db: Db = Depends(user_db)):
    return await list_my_workspaces(user.id, db)


@router.post("/workspaces", response_model=WorkspaceSummary, status_code=status.HTTP_201_CREATED)
async def create_workspace(body: WorkspaceCreate, db: Db = Depends(user_db)):
    # create_workspace() makes the caller Admin and writes the audit entry in one transaction.
    created = await db.rpc("create_workspace", {"workspace_name": body.name})
    return WorkspaceSummary(id=created["id"], name=created["name"], created_at=created["created_at"], auth_role="Admin")


@router.patch("/workspace", response_model=WorkspaceSummary)
async def rename_workspace(
    body: WorkspaceRename,
    context: WorkspaceContext = Depends(require_admin),
    db: Db = Depends(user_db),
    service: Db = Depends(service_db),
):
    rows = await db.update("workspaces", {"id": f"eq.{context.workspace_id}"}, {"name": body.name})
    if not rows:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Workspace not found")
    await audit.record(
        service,
        workspace_id=context.workspace_id,
        actor_id=context.user_id,
        actor_type="user",
        action="workspace.renamed",
        target_type="workspace",
        target_id=context.workspace_id,
        details={"from": context.workspace_name, "to": body.name},
    )
    row = rows[0]
    return WorkspaceSummary(id=row["id"], name=row["name"], created_at=row["created_at"], auth_role=context.auth_role)


@router.delete("/members/me", status_code=status.HTTP_204_NO_CONTENT)
async def leave_workspace(
    context: WorkspaceContext = Depends(get_workspace_context),
    db: Db = Depends(user_db),
    service: Db = Depends(service_db),
):
    # The database refuses if this would remove the last Admin (409).
    await db.delete("workspace_members", {"workspace_id": f"eq.{context.workspace_id}", "user_id": f"eq.{context.user_id}"})
    await audit.record(
        service,
        workspace_id=context.workspace_id,
        actor_id=context.user_id,
        actor_type="user",
        action="member.left",
        target_type="user",
        target_id=context.user_id,
    )
