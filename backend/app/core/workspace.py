"""Workspace scoping.

Every protected route depends on get_workspace_context, so a handler cannot run
without a resolved workspace and the caller's role in it. Roles live on
workspace_members, never on the user.
"""

from dataclasses import dataclass
from typing import Literal

import httpx
from fastapi import Depends, Header, HTTPException, status

from app.core.security import AuthenticatedUser, get_current_user
from app.core.supabase import service_client

AuthRole = Literal["Member", "Admin"]


@dataclass(frozen=True)
class WorkspaceContext:
    user_id: str
    email: str | None
    workspace_id: str
    workspace_name: str
    auth_role: AuthRole


async def get_workspace_context(
    user: AuthenticatedUser = Depends(get_current_user),
    x_workspace_id: str | None = Header(default=None),
    db: httpx.AsyncClient = Depends(service_client),
) -> WorkspaceContext:
    params = {
        "select": "workspace_id,auth_role,workspaces(name)",
        "user_id": f"eq.{user.id}",
        "order": "joined_at.asc",
        "limit": "1",
    }
    if x_workspace_id:
        params["workspace_id"] = f"eq.{x_workspace_id}"

    try:
        response = await db.get("/workspace_members", params=params)
    except httpx.HTTPError as exc:
        raise HTTPException(status.HTTP_503_SERVICE_UNAVAILABLE, "Workspace lookup is unavailable") from exc

    if response.status_code != 200:
        # e.g. the schema has not been migrated yet. Never fall back to an unscoped request.
        raise HTTPException(status.HTTP_503_SERVICE_UNAVAILABLE, "Workspace lookup failed")

    rows = response.json()
    if not rows:
        raise HTTPException(status.HTTP_403_FORBIDDEN, "You are not a member of this workspace")

    row = rows[0]
    return WorkspaceContext(
        user_id=user.id,
        email=user.email,
        workspace_id=row["workspace_id"],
        workspace_name=(row.get("workspaces") or {}).get("name", ""),
        auth_role=row["auth_role"],
    )


def require_admin(context: WorkspaceContext = Depends(get_workspace_context)) -> WorkspaceContext:
    if context.auth_role != "Admin":
        raise HTTPException(status.HTTP_403_FORBIDDEN, "Admin role required in this workspace")
    return context
