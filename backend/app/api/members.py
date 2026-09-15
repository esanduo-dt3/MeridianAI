"""Workspace roster and invitations (docs/decisions.md D-006, D-007)."""

import re
from typing import Annotated, Literal

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import AfterValidator, BaseModel

from app.core import audit
from app.core.supabase import Db, service_db, user_db
from app.core.workspace import AuthRole, WorkspaceContext, get_workspace_context, require_admin

router = APIRouter(tags=["members"])

_EMAIL = re.compile(r"^[^@\s]+@[^@\s]+\.[^@\s]+$")


def _normalise_email(value: str) -> str:
    email = value.strip().lower()
    if len(email) > 254 or not _EMAIL.match(email):
        raise ValueError("Enter a valid email address")
    return email


Email = Annotated[str, AfterValidator(_normalise_email)]


class MemberProfile(BaseModel):
    email: str
    full_name: str | None = None
    avatar_url: str | None = None


class Member(BaseModel):
    id: str
    user_id: str
    auth_role: AuthRole
    joined_at: str
    profile: MemberProfile


class Invite(BaseModel):
    id: str
    email: str
    auth_role: AuthRole
    created_at: str


class Roster(BaseModel):
    members: list[Member]
    invites: list[Invite]
    """Pending invites. Only returned to Admins."""


class AddMember(BaseModel):
    email: Email
    auth_role: AuthRole = "Member"


class AddMemberResult(BaseModel):
    outcome: Literal["added", "invited"]
    member: Member | None = None
    invite: Invite | None = None


class ChangeRole(BaseModel):
    auth_role: AuthRole


_MEMBER_SELECT = "id,user_id,auth_role,joined_at,users(email,full_name,avatar_url)"


def _member(row: dict) -> Member:
    return Member(
        id=row["id"],
        user_id=row["user_id"],
        auth_role=row["auth_role"],
        joined_at=row["joined_at"],
        profile=MemberProfile(**(row.get("users") or {"email": ""})),
    )


@router.get("/members", response_model=Roster)
async def list_members(context: WorkspaceContext = Depends(get_workspace_context), db: Db = Depends(user_db)):
    rows = await db.select(
        "workspace_members",
        {"select": _MEMBER_SELECT, "workspace_id": f"eq.{context.workspace_id}", "order": "joined_at.asc"},
    )
    invites: list[Invite] = []
    if context.is_admin:
        invite_rows = await db.select(
            "workspace_invites",
            {
                "select": "id,email,auth_role,created_at",
                "workspace_id": f"eq.{context.workspace_id}",
                "accepted_at": "is.null",
                "order": "created_at.desc",
            },
        )
        invites = [Invite(**row) for row in invite_rows]
    return Roster(members=[_member(row) for row in rows], invites=invites)


@router.post("/admin/members", response_model=AddMemberResult, status_code=status.HTTP_201_CREATED)
async def add_member(
    body: AddMember,
    context: WorkspaceContext = Depends(require_admin),
    db: Db = Depends(user_db),
    service: Db = Depends(service_db),
):
    # Finding someone by email crosses workspaces, so it needs the service role.
    user_id = await service.rpc("find_user_id_by_email", {"lookup_email": body.email})

    if user_id:
        existing = await db.select(
            "workspace_members",
            {"select": "id", "workspace_id": f"eq.{context.workspace_id}", "user_id": f"eq.{user_id}"},
        )
        if existing:
            raise HTTPException(status.HTTP_409_CONFLICT, f"{body.email} is already in this workspace")
        row = await db.insert(
            "workspace_members",
            {"workspace_id": context.workspace_id, "user_id": user_id, "auth_role": body.auth_role},
            select=_MEMBER_SELECT,
        )
        await audit.record(
            service,
            workspace_id=context.workspace_id,
            actor_id=context.user_id,
            actor_type="user",
            action="member.added",
            target_type="user",
            target_id=user_id,
            details={"email": body.email, "auth_role": body.auth_role},
        )
        return AddMemberResult(outcome="added", member=_member(row))

    try:
        row = await db.insert(
            "workspace_invites",
            {
                "workspace_id": context.workspace_id,
                "email": body.email,
                "auth_role": body.auth_role,
                "invited_by": context.user_id,
            },
            select="id,email,auth_role,created_at",
        )
    except HTTPException as exc:
        if exc.status_code == status.HTTP_409_CONFLICT:
            raise HTTPException(status.HTTP_409_CONFLICT, f"{body.email} already has a pending invite") from exc
        raise
    await audit.record(
        service,
        workspace_id=context.workspace_id,
        actor_id=context.user_id,
        actor_type="user",
        action="member.invited",
        target_type="invite",
        target_id=row["id"],
        details={"email": body.email, "auth_role": body.auth_role},
    )
    return AddMemberResult(outcome="invited", invite=Invite(**row))


@router.patch("/admin/members/{member_id}", response_model=Member)
async def change_role(
    member_id: str,
    body: ChangeRole,
    context: WorkspaceContext = Depends(require_admin),
    db: Db = Depends(user_db),
    service: Db = Depends(service_db),
):
    rows = await db.update(
        "workspace_members",
        {"id": f"eq.{member_id}", "workspace_id": f"eq.{context.workspace_id}"},
        {"auth_role": body.auth_role},
        select=_MEMBER_SELECT,
    )
    if not rows:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Member not found")
    member = _member(rows[0])
    await audit.record(
        service,
        workspace_id=context.workspace_id,
        actor_id=context.user_id,
        actor_type="user",
        action="member.role_changed",
        target_type="user",
        target_id=member.user_id,
        details={"auth_role": body.auth_role},
    )
    return member


@router.delete("/admin/members/{member_id}", status_code=status.HTTP_204_NO_CONTENT)
async def remove_member(
    member_id: str,
    context: WorkspaceContext = Depends(require_admin),
    db: Db = Depends(user_db),
    service: Db = Depends(service_db),
):
    rows = await db.select(
        "workspace_members", {"select": "user_id", "id": f"eq.{member_id}", "workspace_id": f"eq.{context.workspace_id}"}
    )
    if not rows:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Member not found")
    await db.delete("workspace_members", {"id": f"eq.{member_id}", "workspace_id": f"eq.{context.workspace_id}"})
    await audit.record(
        service,
        workspace_id=context.workspace_id,
        actor_id=context.user_id,
        actor_type="user",
        action="member.removed",
        target_type="user",
        target_id=rows[0]["user_id"],
    )


@router.delete("/admin/invites/{invite_id}", status_code=status.HTTP_204_NO_CONTENT)
async def revoke_invite(
    invite_id: str,
    context: WorkspaceContext = Depends(require_admin),
    db: Db = Depends(user_db),
    service: Db = Depends(service_db),
):
    deleted = await db.delete(
        "workspace_invites",
        {"id": f"eq.{invite_id}", "workspace_id": f"eq.{context.workspace_id}", "accepted_at": "is.null"},
    )
    if not deleted:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Invite not found")
    await audit.record(
        service,
        workspace_id=context.workspace_id,
        actor_id=context.user_id,
        actor_type="user",
        action="member.invite_revoked",
        target_type="invite",
        target_id=invite_id,
    )
