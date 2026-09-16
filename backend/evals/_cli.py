"""Small shared pieces for the eval command line."""

from __future__ import annotations

import sys
import uuid
from datetime import datetime, timezone

from app.core.supabase import Db


def say(message: str = "") -> None:
    print(message, flush=True)


def fail(message: str) -> None:
    print(f"error: {message}", file=sys.stderr, flush=True)
    raise SystemExit(1)


def now_stamp() -> str:
    return datetime.now(timezone.utc).strftime("%Y%m%dT%H%M%SZ")


def is_uuid(value: str) -> bool:
    try:
        uuid.UUID(value)
    except (ValueError, AttributeError):
        return False
    return True


async def resolve_workspace(db: Db, given: str | None) -> tuple[str, str]:
    """A workspace id, or a unique name match. With neither, list them and stop."""
    rows = await db.select("workspaces", {"select": "id,name", "order": "name.asc"})
    if not rows:
        fail("this Supabase project has no workspaces")

    if given and is_uuid(given):
        match = next((r for r in rows if r["id"] == given), None)
        if match is None:
            fail(f"no workspace with id {given}")
        return match["id"], match["name"]

    if given:
        hits = [r for r in rows if given.casefold() in r["name"].casefold()]
        if len(hits) == 1:
            return hits[0]["id"], hits[0]["name"]
        if not hits:
            fail(f"no workspace whose name contains {given!r}")
        fail(f"{given!r} matches {len(hits)} workspaces: " + ", ".join(r["name"] for r in hits))

    say("Pass --workspace with one of these ids or names:")
    for row in rows:
        say(f"  {row['id']}  {row['name']}")
    raise SystemExit(2)


async def admin_user_id(db: Db, workspace_id: str) -> str:
    """An Admin of the workspace, to own uploads and asked answers."""
    rows = await db.select(
        "workspace_members",
        {"select": "user_id", "workspace_id": f"eq.{workspace_id}", "auth_role": "eq.Admin", "limit": "1"},
    )
    if not rows:
        fail(f"workspace {workspace_id} has no Admin to attribute the run to")
    return rows[0]["user_id"]
