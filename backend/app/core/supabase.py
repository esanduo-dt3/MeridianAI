"""Privileged PostgREST access with the service-role key.

The service role bypasses row-level security, so every query made through this
client must filter by the caller's workspace explicitly. Handlers never get this
client directly; they go through scoped helpers.
"""

from collections.abc import AsyncIterator

import httpx

from app.core.config import get_settings


async def service_client() -> AsyncIterator[httpx.AsyncClient]:
    settings = get_settings()
    key = settings.supabase_service_role_key.get_secret_value()
    async with httpx.AsyncClient(
        base_url=settings.supabase_rest_url,
        headers={"apikey": key, "Authorization": f"Bearer {key}"},
        timeout=10.0,
    ) as client:
        yield client
