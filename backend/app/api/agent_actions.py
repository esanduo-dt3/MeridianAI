"""Approve or reject agent-proposed actions (non-negotiable 1).

Nothing the agent proposes is written until an Admin approves it here. The
database functions do the write, the decision and the audit entry in one
transaction and re-check that the approver is an Admin.
"""

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel

from app.api.tasks import _TASK_SELECT, Task
from app.core.supabase import Db, service_db, user_db
from app.core.workspace import WorkspaceContext, require_admin

router = APIRouter(tags=["agent actions"])


class RejectResult(BaseModel):
    id: str
    status: str


async def _load_pending(db: Db, context: WorkspaceContext, action_id: str) -> None:
    rows = await db.select(
        "agent_actions",
        {"select": "id,status", "id": f"eq.{action_id}", "workspace_id": f"eq.{context.workspace_id}"},
    )
    if not rows:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Proposal not found")
    if rows[0]["status"] != "pending":
        raise HTTPException(status.HTTP_409_CONFLICT, f"This proposal was already {rows[0]['status']}")


@router.post("/agent/actions/{action_id}/approve", response_model=Task)
async def approve(
    action_id: str,
    context: WorkspaceContext = Depends(require_admin),
    db: Db = Depends(user_db),
    service: Db = Depends(service_db),
):
    await _load_pending(db, context, action_id)
    created = await service.rpc("approve_agent_action", {"action_id": action_id, "approver_id": context.user_id})
    rows = await db.select("tasks", {"select": _TASK_SELECT, "id": f"eq.{created['id']}"})
    return Task(**rows[0])


@router.post("/agent/actions/{action_id}/reject", response_model=RejectResult)
async def reject(
    action_id: str,
    context: WorkspaceContext = Depends(require_admin),
    db: Db = Depends(user_db),
    service: Db = Depends(service_db),
):
    await _load_pending(db, context, action_id)
    result = await service.rpc("reject_agent_action", {"action_id": action_id, "approver_id": context.user_id})
    return RejectResult(id=result["id"], status=result["status"])
