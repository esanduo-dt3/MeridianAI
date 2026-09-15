from fastapi import APIRouter, Depends
from pydantic import BaseModel

from app.core.workspace import AuthRole, WorkspaceContext, get_workspace_context

router = APIRouter(tags=["me"])


class MeResponse(BaseModel):
    user_id: str
    email: str | None
    workspace_id: str
    workspace_name: str
    auth_role: AuthRole


@router.get("/me", response_model=MeResponse)
async def me(context: WorkspaceContext = Depends(get_workspace_context)) -> MeResponse:
    return MeResponse(
        user_id=context.user_id,
        email=context.email,
        workspace_id=context.workspace_id,
        workspace_name=context.workspace_name,
        auth_role=context.auth_role,
    )
