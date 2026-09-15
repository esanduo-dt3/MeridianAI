from fastapi import APIRouter, Depends
from pydantic import BaseModel

from app.api.workspaces import WorkspaceSummary, list_my_workspaces
from app.core.security import AuthenticatedUser, get_current_user
from app.core.supabase import Db, user_db

router = APIRouter(tags=["me"])


class Profile(BaseModel):
    id: str
    email: str | None
    full_name: str | None = None
    avatar_url: str | None = None


class MeResponse(BaseModel):
    user: Profile
    workspaces: list[WorkspaceSummary]


@router.get("/me", response_model=MeResponse)
async def me(user: AuthenticatedUser = Depends(get_current_user), db: Db = Depends(user_db)) -> MeResponse:
    rows = await db.select("users", {"select": "id,email,full_name,avatar_url", "id": f"eq.{user.id}"})
    # The profile row is created by the sign-up trigger; fall back to token claims if it is missing.
    profile = Profile(**rows[0]) if rows else Profile(id=user.id, email=user.email)
    return MeResponse(user=profile, workspaces=await list_my_workspaces(user.id, db))
