"""Sprints and the backlog (docs/decisions.md D-048, PRD SHOULD scope).

The backlog is not a table: a task whose `sprint_id` is null is in the backlog.
Moving work in or out of a sprint is therefore one column write on the task, and
a task can never be in two places at once.

Members read the plan. Only Admins create a sprint, change its dates or state,
or delete it, matching how tasks already work (D-006, D-021). At most one sprint
per workspace is active, which a unique index enforces rather than this code.
"""

from __future__ import annotations

from datetime import date
from typing import Annotated, Literal

from fastapi import APIRouter, Depends, HTTPException, Response, status
from pydantic import BaseModel, StringConstraints, model_validator

from app.core import audit
from app.core.supabase import Db, service_db, user_db
from app.core.workspace import WorkspaceContext, get_workspace_context, require_admin

router = APIRouter(tags=["sprints"])

SprintStatus = Literal["planned", "active", "completed"]
SprintName = Annotated[str, StringConstraints(strip_whitespace=True, min_length=1, max_length=80)]

_SPRINT_SELECT = "id,name,start_date,end_date,status,created_at"


class Sprint(BaseModel):
    id: str
    name: str
    start_date: date | None
    end_date: date | None
    status: SprintStatus
    created_at: str


class SprintBoard(BaseModel):
    sprints: list[Sprint]
    # The one active sprint, if there is one. The board opens on it.
    active_sprint_id: str | None = None


class SprintCreate(BaseModel):
    name: SprintName
    start_date: date | None = None
    end_date: date | None = None
    status: SprintStatus = "planned"

    @model_validator(mode="after")
    def _dates_in_order(self):
        if self.start_date and self.end_date and self.end_date < self.start_date:
            raise ValueError("A sprint cannot end before it starts")
        return self


class SprintUpdate(BaseModel):
    name: SprintName | None = None
    start_date: date | None = None
    end_date: date | None = None
    status: SprintStatus | None = None


def _conflict_if_already_active(error: HTTPException) -> HTTPException:
    """The unique index is the rule; this turns it into something readable."""
    detail = str(error.detail)
    if error.status_code == status.HTTP_409_CONFLICT or "sprints_one_active_per_workspace" in detail:
        return HTTPException(
            status.HTTP_409_CONFLICT,
            "This workspace already has an active sprint. Complete it before starting another.",
        )
    return error


@router.get("/sprints", response_model=SprintBoard)
async def list_sprints(context: WorkspaceContext = Depends(get_workspace_context), db: Db = Depends(user_db)):
    rows = await db.select(
        "sprints",
        {"select": _SPRINT_SELECT, "workspace_id": f"eq.{context.workspace_id}", "order": "created_at.desc"},
    )
    sprints = [Sprint(**row) for row in rows]
    active = next((s.id for s in sprints if s.status == "active"), None)
    return SprintBoard(sprints=sprints, active_sprint_id=active)


@router.post("/admin/sprints", response_model=Sprint, status_code=status.HTTP_201_CREATED)
async def create_sprint(
    body: SprintCreate,
    context: WorkspaceContext = Depends(require_admin),
    db: Db = Depends(user_db),
    service: Db = Depends(service_db),
):
    try:
        row = await db.insert(
            "sprints",
            {**body.model_dump(mode="json"), "workspace_id": context.workspace_id},
            select=_SPRINT_SELECT,
        )
    except HTTPException as exc:
        raise _conflict_if_already_active(exc) from exc
    await audit.record(
        service,
        workspace_id=context.workspace_id,
        actor_id=context.user_id,
        actor_type="user",
        action="sprint.created",
        target_type="sprint",
        target_id=row["id"],
        details={"name": row["name"], "status": row["status"]},
    )
    return Sprint(**row)


@router.patch("/admin/sprints/{sprint_id}", response_model=Sprint)
async def update_sprint(
    sprint_id: str,
    body: SprintUpdate,
    context: WorkspaceContext = Depends(require_admin),
    db: Db = Depends(user_db),
    service: Db = Depends(service_db),
):
    changes = body.model_dump(mode="json", exclude_unset=True)
    if not changes:
        raise HTTPException(status.HTTP_422_UNPROCESSABLE_ENTITY, "Nothing to update")
    if changes.get("name") is None and "name" in changes:
        raise HTTPException(status.HTTP_422_UNPROCESSABLE_ENTITY, "A sprint needs a name")
    try:
        rows = await db.update(
            "sprints",
            {"id": f"eq.{sprint_id}", "workspace_id": f"eq.{context.workspace_id}"},
            changes,
            select=_SPRINT_SELECT,
        )
    except HTTPException as exc:
        raise _conflict_if_already_active(exc) from exc
    if not rows:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Sprint not found")
    if "status" in changes:
        await audit.record(
            service,
            workspace_id=context.workspace_id,
            actor_id=context.user_id,
            actor_type="user",
            action="sprint.status_changed",
            target_type="sprint",
            target_id=sprint_id,
            details={"status": changes["status"]},
        )
    return Sprint(**rows[0])


@router.delete("/admin/sprints/{sprint_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_sprint(
    sprint_id: str,
    context: WorkspaceContext = Depends(require_admin),
    db: Db = Depends(user_db),
    service: Db = Depends(service_db),
):
    # Its tasks return to the backlog rather than being deleted (on delete set null).
    deleted = await db.delete("sprints", {"id": f"eq.{sprint_id}", "workspace_id": f"eq.{context.workspace_id}"})
    if not deleted:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Sprint not found")
    await audit.record(
        service,
        workspace_id=context.workspace_id,
        actor_id=context.user_id,
        actor_type="user",
        action="sprint.deleted",
        target_type="sprint",
        target_id=sprint_id,
    )
    return Response(status_code=status.HTTP_204_NO_CONTENT)
