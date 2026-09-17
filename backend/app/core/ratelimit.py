"""Per-user rate limits for the endpoints that spend shared quota (docs/decisions.md D-041).

A sliding window per user and per bucket, held in this server process. Limits
are per user, not per workspace, because the model quota they protect is shared
by every workspace on the key.

The window lives in memory, so it resets when the process restarts and is not
shared between processes. That matches the single-process deployment; running
several processes would need a shared store, the same caveat as the embedding
limiter (D-033).
"""

from __future__ import annotations

import math
import time
from collections import deque
from collections.abc import Callable

from fastapi import Depends, HTTPException, status

from app.core.config import get_settings
from app.core.workspace import WorkspaceContext, get_workspace_context

BUCKET_LABEL = {"ask": "questions", "chat": "assistant messages", "upload": "uploads"}


class SlidingWindowLimiter:
    def __init__(self, clock: Callable[[], float] = time.monotonic):
        self._clock = clock
        self._hits: dict[tuple[str, str], deque[float]] = {}

    def hit(self, bucket: str, user_id: str, limits: list[tuple[int, float]]) -> float | None:
        """Record a request, or return seconds until one is allowed. A refused request is not recorded."""
        now = self._clock()
        window = max(seconds for _, seconds in limits)
        hits = self._hits.setdefault((bucket, user_id), deque())
        while hits and now - hits[0] >= window:
            hits.popleft()
        wait = 0.0
        for allowed, seconds in limits:
            recent = [t for t in hits if now - t < seconds]
            if len(recent) >= allowed:
                wait = max(wait, seconds - (now - recent[len(recent) - allowed]))
        if wait > 0:
            return wait
        hits.append(now)
        return None

    def reset(self) -> None:
        self._hits.clear()


limiter = SlidingWindowLimiter()


def _limits(bucket: str) -> list[tuple[int, float]]:
    s = get_settings()
    per_minute, per_hour = {
        "ask": (s.rate_limit_ask_per_minute, s.rate_limit_ask_per_hour),
        "chat": (s.rate_limit_chat_per_minute, s.rate_limit_chat_per_hour),
        "upload": (s.rate_limit_upload_per_minute, s.rate_limit_upload_per_hour),
    }[bucket]
    return [(per_minute, 60.0), (per_hour, 3600.0)]


def rate_limit(bucket: str):
    """FastAPI dependency: refuse with 429 and Retry-After once the user is over a limit."""

    async def dependency(context: WorkspaceContext = Depends(get_workspace_context)) -> None:
        wait = limiter.hit(bucket, context.user_id, _limits(bucket))
        if wait is not None:
            seconds = max(1, math.ceil(wait))
            raise HTTPException(
                status.HTTP_429_TOO_MANY_REQUESTS,
                f"Too many {BUCKET_LABEL[bucket]} in a short time. Try again in {seconds} seconds.",
                headers={"Retry-After": str(seconds)},
            )

    return dependency
