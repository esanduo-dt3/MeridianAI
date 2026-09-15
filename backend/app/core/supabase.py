"""PostgREST access.

Two clients, deliberately different (docs/decisions.md D-018):

- ``user_db``: acts as the signed-in user by forwarding their access token, so
  every query is filtered by row-level security. This is the default for
  handlers.
- ``service_db``: uses the service-role key and bypasses row-level security.
  Only for writes users are not allowed to make themselves (audit log entries,
  agent-approved tasks) and for lookups across workspaces (finding a user by
  email). Callers must already have checked the caller's role.
"""

from collections.abc import AsyncIterator
from typing import Any

import httpx
from fastapi import Depends, HTTPException, status

from app.core.config import get_settings
from app.core.security import AuthenticatedUser, get_current_user

# Postgres error codes surfaced by PostgREST, mapped to HTTP responses.
_PG_STATUS = {
    "42501": status.HTTP_403_FORBIDDEN,  # insufficient privilege / RLS rejection
    "23505": status.HTTP_409_CONFLICT,  # unique violation
    "23514": status.HTTP_409_CONFLICT,  # check violation (e.g. last Admin)
    "23503": status.HTTP_422_UNPROCESSABLE_ENTITY,  # foreign key violation
    "22P02": status.HTTP_422_UNPROCESSABLE_ENTITY,  # invalid input (e.g. bad uuid)
    "22023": status.HTTP_422_UNPROCESSABLE_ENTITY,  # invalid parameter value
    "P0002": status.HTTP_404_NOT_FOUND,  # raised "not found"
}


class Db:
    """Thin PostgREST client that raises HTTPException on database errors."""

    def __init__(self, client: httpx.AsyncClient):
        self._client = client

    async def _send(self, method: str, path: str, **kwargs: Any) -> Any:
        try:
            response = await self._client.request(method, path, **kwargs)
        except httpx.HTTPError as exc:
            raise HTTPException(status.HTTP_503_SERVICE_UNAVAILABLE, "The database is unavailable") from exc

        if response.status_code >= 400:
            try:
                body = response.json()
            except ValueError:
                body = {}
            code = str(body.get("code", ""))
            message = body.get("message") or "Database request failed"
            if code == "PGRST116":  # .single() found no rows
                raise HTTPException(status.HTTP_404_NOT_FOUND, "Not found")
            mapped = _PG_STATUS.get(code)
            if mapped is None:
                raise HTTPException(status.HTTP_502_BAD_GATEWAY, "Database request failed")
            raise HTTPException(mapped, message)

        if response.status_code == 204 or not response.content:
            return None
        return response.json()

    async def select(self, table: str, params: dict[str, str]) -> list[dict[str, Any]]:
        return await self._send("GET", f"/{table}", params=params)

    async def select_one(self, table: str, params: dict[str, str]) -> dict[str, Any]:
        rows = await self.select(table, {**params, "limit": "1"})
        if not rows:
            raise HTTPException(status.HTTP_404_NOT_FOUND, "Not found")
        return rows[0]

    async def insert(self, table: str, row: dict[str, Any], select: str = "*") -> dict[str, Any]:
        rows = await self._send(
            "POST", f"/{table}", params={"select": select}, json=row, headers={"Prefer": "return=representation"}
        )
        return rows[0]

    async def update(self, table: str, match: dict[str, str], values: dict[str, Any], select: str = "*") -> list[dict[str, Any]]:
        return await self._send(
            "PATCH",
            f"/{table}",
            params={**match, "select": select},
            json=values,
            headers={"Prefer": "return=representation"},
        )

    async def delete(self, table: str, match: dict[str, str]) -> list[dict[str, Any]]:
        return await self._send("DELETE", f"/{table}", params={**match, "select": "id"}, headers={"Prefer": "return=representation"})

    async def rpc(self, function: str, args: dict[str, Any]) -> Any:
        return await self._send("POST", f"/rpc/{function}", json=args)


def _client(authorization: str) -> httpx.AsyncClient:
    settings = get_settings()
    return httpx.AsyncClient(
        base_url=settings.supabase_rest_url,
        headers={
            "apikey": settings.supabase_publishable_key.get_secret_value(),
            "Authorization": authorization,
        },
        timeout=10.0,
    )


async def user_db(user: AuthenticatedUser = Depends(get_current_user)) -> AsyncIterator[Db]:
    async with _client(f"Bearer {user.token}") as client:
        yield Db(client)


async def service_db() -> AsyncIterator[Db]:
    settings = get_settings()
    key = settings.supabase_service_role_key.get_secret_value()
    async with httpx.AsyncClient(
        base_url=settings.supabase_rest_url,
        headers={"apikey": key, "Authorization": f"Bearer {key}"},
        timeout=10.0,
    ) as client:
        yield Db(client)
