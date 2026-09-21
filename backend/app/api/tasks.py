"""Tasks for the List and Board views (docs/decisions.md D-006, D-020, D-021).

Admins create, edit and delete tasks. Members may change a task's status and
its order only; that is checked here and again by a database trigger.
"""

import time
from datetime import date
from typing import Annotated, Any, Literal

from fastapi import APIRouter, Depends, HTTPException, Response, status
from pydantic import BaseModel, Field, StringConstraints

from app.core.supabase import Db, user_db
from app.core.workspace import WorkspaceContext, get_workspace_context, require_admin

router = APIRouter(tags=["tasks"])

TaskStatus = Literal["todo", "in_progress", "done"]
Priority = Literal["none", "low", "medium", "high", "urgent"]
Title = Annotated[str, StringConstraints(strip_whitespace=True, min_length=1, max_length=200)]
Description = Annotated[str, StringConstraints(max_length=10000)]

MEMBER_EDITABLE = {"status", "position"}


class Person(BaseModel):
    id: str
    email: str
    full_name: str | None = None
    avatar_url: str | None = None


class Task(BaseModel):
    id: str
    title: str
    description: str
    status: TaskStatus
    priority: Priority
    position: float
    parent_task_id: str | None
    # Null means the task is in the backlog (D-048).
    sprint_id: str | None
    due_date: date | None
    source: Literal["manual", "agent"]
    created_at: str
    updated_at: str
    completed_at: str | None
    assignee: Person | None
    created_by: Person | None


class Proposal(BaseModel):
    id: str
    reasoning: str
    proposed_payload: dict[str, Any]
    created_at: str


class TaskBoard(BaseModel):
    tasks: list[Task]
    proposals: list[Proposal]
    """Agent-proposed tasks waiting for an Admin's decision (non-negotiable 1)."""


class TaskCreate(BaseModel):
    title: Title
    description: Description = ""
    status: TaskStatus = "todo"
    priority: Priority = "none"
    due_date: date | None = None
    assignee_id: str | None = None
    parent_task_id: str | None = None
    # Omit or send null to create the task in the backlog (D-048).
    sprint_id: str | None = None


class TaskUpdate(BaseModel):
    title: Title | None = None
    description: Description | None = None
    status: TaskStatus | None = None
    priority: Priority | None = None
    position: float | None = Field(default=None, allow_inf_nan=False)
    due_date: date | None = None
    assignee_id: str | None = None
    parent_task_id: str | None = None
    # Set to move the task into a sprint, null to send it back to the backlog.
    sprint_id: str | None = None


_TASK_SELECT = (
    "id,title,description,status,priority,position,parent_task_id,sprint_id,due_date,source,created_at,updated_at,completed_at,"
    "assignee:users!tasks_assignee_id_fkey(id,email,full_name,avatar_url),"
    "created_by:users!tasks_created_by_fkey(id,email,full_name,avatar_url)"
)


def _next_position() -> float:
    """New tasks go to the end of their column; milliseconds keep them in creation order."""
    return time.time() * 1000


async def _ensure_member(db: Db, workspace_id: str, user_id: str | None) -> None:
    if user_id is None:
        return
    rows = await db.select(
        "workspace_members", {"select": "id", "workspace_id": f"eq.{workspace_id}", "user_id": f"eq.{user_id}"}
    )
    if not rows:
        raise HTTPException(status.HTTP_422_UNPROCESSABLE_ENTITY, "The assignee must be a member of this workspace")


async def _ensure_sprint(db: Db, workspace_id: str, sprint_id: str) -> None:
    """A task can only join a sprint of its own workspace."""
    rows = await db.select("sprints", {"select": "id", "workspace_id": f"eq.{workspace_id}", "id": f"eq.{sprint_id}"})
    if not rows:
        raise HTTPException(status.HTTP_422_UNPROCESSABLE_ENTITY, "That sprint is not in this workspace")


@router.get("/tasks", response_model=TaskBoard)
async def list_tasks(context: WorkspaceContext = Depends(get_workspace_context), db: Db = Depends(user_db)):
    tasks = await db.select(
        "tasks", {"select": _TASK_SELECT, "workspace_id": f"eq.{context.workspace_id}", "order": "position.asc"}
    )
    proposals = await db.select(
        "agent_actions",
        {
            "select": "id,reasoning,proposed_payload,created_at",
            "workspace_id": f"eq.{context.workspace_id}",
            "status": "eq.pending",
            "action_type": "eq.create_task",
            "order": "created_at.asc",
        },
    )
    return TaskBoard(tasks=[Task(**row) for row in tasks], proposals=[Proposal(**row) for row in proposals])


@router.post("/tasks", response_model=Task, status_code=status.HTTP_201_CREATED)
async def create_task(body: TaskCreate, context: WorkspaceContext = Depends(require_admin), db: Db = Depends(user_db)):
    await _ensure_member(db, context.workspace_id, body.assignee_id)
    if body.sprint_id:
        await _ensure_sprint(db, context.workspace_id, body.sprint_id)
    row = await db.insert(
        "tasks",
        {
            **body.model_dump(mode="json"),
            "workspace_id": context.workspace_id,
            "created_by": context.user_id,
            "source": "manual",
            "position": _next_position(),
        },
        select=_TASK_SELECT,
    )
    return Task(**row)


@router.patch("/tasks/{task_id}", response_model=Task)
async def update_task(
    task_id: str,
    body: TaskUpdate,
    context: WorkspaceContext = Depends(get_workspace_context),
    db: Db = Depends(user_db),
):
    changes = body.model_dump(mode="json", exclude_unset=True)
    if not changes:
        raise HTTPException(status.HTTP_422_UNPROCESSABLE_ENTITY, "Nothing to update")
    if not context.is_admin and not set(changes) <= MEMBER_EDITABLE:
        raise HTTPException(status.HTTP_403_FORBIDDEN, "Members can only change a task's status and order")
    if "title" in changes and changes["title"] is None:
        raise HTTPException(status.HTTP_422_UNPROCESSABLE_ENTITY, "A task needs a title")
    if changes.get("parent_task_id") == task_id:
        raise HTTPException(status.HTTP_409_CONFLICT, "A task cannot be its own parent")
    if "assignee_id" in changes:
        await _ensure_member(db, context.workspace_id, changes["assignee_id"])
    if changes.get("sprint_id"):
        await _ensure_sprint(db, context.workspace_id, changes["sprint_id"])

    rows = await db.update(
        "tasks", {"id": f"eq.{task_id}", "workspace_id": f"eq.{context.workspace_id}"}, changes, select=_TASK_SELECT
    )
    if not rows:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Task not found")
    return Task(**rows[0])


@router.delete("/tasks/{task_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_task(task_id: str, context: WorkspaceContext = Depends(require_admin), db: Db = Depends(user_db)):
    # Subtasks are removed with their parent (on delete cascade).
    deleted = await db.delete("tasks", {"id": f"eq.{task_id}", "workspace_id": f"eq.{context.workspace_id}"})
    if not deleted:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Task not found")
    return Response(status_code=status.HTTP_204_NO_CONTENT)
