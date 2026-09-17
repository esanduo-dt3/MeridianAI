"""Audit trail writes.

audit_log is append-only and only writable with the service role, so users
cannot create, alter or remove entries themselves (docs/decisions.md D-012).
"""

from typing import Any, Literal

from app.core.supabase import Db

ActorType = Literal["user", "agent", "system"]


async def record(
    db: Db,
    *,
    workspace_id: str | None,
    actor_id: str | None,
    actor_type: ActorType,
    action: str,
    target_type: str | None = None,
    target_id: str | None = None,
    details: dict[str, Any] | None = None,
) -> None:
    await db.insert(
        "audit_log",
        {
            "workspace_id": workspace_id,
            "actor_id": actor_id,
            "actor_type": actor_type,
            "action": action,
            "target_type": target_type,
            "target_id": target_id,
            "details": details or {},
        },
        select="id",
    )
