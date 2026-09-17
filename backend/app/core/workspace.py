"""Workspace scoping.

Every workspace-scoped route depends on get_workspace_context, so a handler
cannot run without a resolved workspace and the caller's role in it. Roles live
on workspace_members, never on the user (docs/decisions.md D-006).
"""

from dataclasses import dataclass
from typing import Literal
from uuid import UUID

from fastapi import Depends, Header, HTTPException, status

from app.core.security import AuthenticatedUser, get_current_user
from app.core.supabase import Db, user_db

AuthRole = Literal["Admin", "Member"]


@dataclass(frozen=True)
class WorkspaceContext:
    user_id: str
    email: str | None
    workspace_id: str
    workspace_name: str
    auth_role: AuthRole

    @property
    def is_admin(self) -> bool:
        return self.auth_role == "Admin"


async def get_workspace_context(
    x_workspace_id: UUID | None = Header(default=None),
    user: AuthenticatedUser = Depends(get_current_user),
    db: Db = Depends(user_db),
) -> WorkspaceContext:
    if x_workspace_id is None:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "X-Workspace-Id header is required")

    # Queried with the caller's own token, so row-level security applies as well.
    rows = await db.select(
        "workspace_members",
        {
            "select": "auth_role,workspaces(name)",
            "user_id": f"eq.{user.id}",
            "workspace_id": f"eq.{x_workspace_id}",
            "limit": "1",
        },
    )
    if not rows:
        raise HTTPException(status.HTTP_403_FORBIDDEN, "You are not a member of this workspace")

    row = rows[0]
    return WorkspaceContext(
        user_id=user.id,
        email=user.email,
        workspace_id=str(x_workspace_id),
        workspace_name=(row.get("workspaces") or {}).get("name", ""),
        auth_role=row["auth_role"],
    )


def require_admin(context: WorkspaceContext = Depends(get_workspace_context)) -> WorkspaceContext:
    if not context.is_admin:
        raise HTTPException(status.HTTP_403_FORBIDDEN, "Only Admins of this workspace can do this")
    return context
