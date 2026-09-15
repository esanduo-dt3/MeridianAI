"""Supabase Storage for uploaded documents.

Uploads run with the caller's token, so the bucket's policies (Admins upload to
their own workspace's folder) apply on top of the API's role check. Background
processing reads and cleans up with the service role.
"""

from __future__ import annotations

import re
from urllib.parse import quote

import httpx
from fastapi import HTTPException, status

from app.core.config import get_settings

BUCKET = "documents"


def safe_filename(name: str) -> str:
    """Keep a readable name but only path-safe characters."""
    base = name.replace("\\", "/").rsplit("/", 1)[-1].strip() or "document"
    cleaned = re.sub(r"[^A-Za-z0-9._ -]+", "_", base).strip(" .") or "document"
    return cleaned[:120]


def _headers(token: str) -> dict[str, str]:
    settings = get_settings()
    return {"apikey": settings.supabase_publishable_key.get_secret_value(), "Authorization": f"Bearer {token}"}


def _service_headers() -> dict[str, str]:
    key = get_settings().supabase_service_role_key.get_secret_value()
    return {"apikey": key, "Authorization": f"Bearer {key}"}


def _object_url(path: str) -> str:
    return f"{get_settings().supabase_storage_url}/object/{BUCKET}/{quote(path)}"


async def upload(path: str, data: bytes, content_type: str, *, user_token: str) -> None:
    async with httpx.AsyncClient(timeout=60) as client:
        response = await client.post(
            _object_url(path),
            content=data,
            headers={**_headers(user_token), "Content-Type": content_type, "x-upsert": "false"},
        )
    if response.status_code in (401, 403):
        raise HTTPException(status.HTTP_403_FORBIDDEN, "You can't upload to this workspace")
    if response.status_code == 413:
        raise HTTPException(status.HTTP_413_REQUEST_ENTITY_TOO_LARGE, "The file is larger than 25 MB")
    if response.status_code >= 400:
        raise HTTPException(status.HTTP_502_BAD_GATEWAY, "The file couldn't be stored. Try again.")


async def download(path: str) -> bytes:
    async with httpx.AsyncClient(timeout=60) as client:
        response = await client.get(_object_url(path), headers=_service_headers())
    response.raise_for_status()
    return response.content


async def remove(path: str) -> None:
    async with httpx.AsyncClient(timeout=30) as client:
        await client.request(
            "DELETE",
            f"{get_settings().supabase_storage_url}/object/{BUCKET}",
            headers={**_service_headers(), "Content-Type": "application/json"},
            json={"prefixes": [path]},
        )
