"""The model provider gateway (PRD: a thin, swappable provider gateway with a
response cache; docs/decisions.md D-026).

Everything that calls a model goes through `ModelGateway`, so the provider can be
swapped in one place and every call gets the same caching, timeouts and error
type. Gemini is the provider for Week 1.

The response cache is in-process and keyed on the exact request, so repeating an
identical question (demo pre-warming, a retry after a network blip) costs no model
call. Embeddings are cached the same way because they are deterministic.

Generation walks a chain of models: the requested one, then the other Week 1
model, then the configured fallbacks. A model that fails (a quota 429, a 504, a
timeout) is put on a cooldown, so later calls go straight to a model that is
working instead of waiting on the failing one again (D-031, D-032).

Content isolation (non-negotiable 2) is enforced by the call shape, not by
convention: `generate` takes the system instruction and the user-turn parts as
separate arguments. Callers pass document text only inside the user-turn data
part, never in `system`. See app/rag/answer.py.
"""

from __future__ import annotations

import asyncio
import hashlib
import json
import logging
import math
import re
import time
from collections import OrderedDict, deque
from dataclasses import dataclass
from functools import lru_cache
from typing import Any, Literal, Protocol

from app.core.config import get_settings

log = logging.getLogger(__name__)

EmbedTask = Literal["document", "query"]


class ModelError(RuntimeError):
    """A model call failed after retries, or the provider is not configured."""


class QuotaExceeded(ModelError):
    """The provider refused the call for quota. `daily` when waiting a minute will not help."""

    def __init__(self, message: str, *, daily: bool):
        super().__init__(message)
        self.daily = daily


def _is_quota_error(exc: BaseException) -> bool:
    text = str(exc)
    return "RESOURCE_EXHAUSTED" in text or text.startswith("429")


def _retry_after(exc: BaseException) -> float | None:
    """The wait a quota error names ("Please retry in 33.5s"), if any."""
    match = re.search(r"retry in ([\d.]+)s", str(exc))
    return float(match.group(1)) if match else None


class _RateWindow:
    """Items sent in the last minute, to stay under a per-minute request quota.

    The free Gemini tier counts every text in an embedding batch as one request,
    100 a minute (D-033). `reserve` keeps headroom so that a question asked while a
    large document is ingesting does not wait for the whole window.
    """

    def __init__(self, per_minute: int, clock=time.monotonic, sleep=asyncio.sleep):
        self.per_minute = per_minute
        self._sent: deque[tuple[float, int]] = deque()
        self._clock = clock
        self._sleep = sleep

    def _used(self, now: float) -> int:
        while self._sent and now - self._sent[0][0] >= 60:
            self._sent.popleft()
        return sum(count for _, count in self._sent)

    async def acquire(self, count: int, reserve: int = 0) -> None:
        limit = max(self.per_minute - reserve, 1)
        while self._sent and self._used(self._clock()) + count > limit:
            await self._sleep(60 - (self._clock() - self._sent[0][0]) + 0.5)
        self._sent.append((self._clock(), count))


@dataclass(frozen=True)
class Generation:
    text: str
    model: str
    cached: bool = False


class _LRU:
    def __init__(self, size: int):
        self.size = size
        self._data: OrderedDict[str, Any] = OrderedDict()

    def get(self, key: str) -> Any | None:
        if key not in self._data:
            return None
        self._data.move_to_end(key)
        return self._data[key]

    def put(self, key: str, value: Any) -> None:
        self._data[key] = value
        self._data.move_to_end(key)
        while len(self._data) > self.size:
            self._data.popitem(last=False)


def _key(*parts: Any) -> str:
    return hashlib.sha256(json.dumps(parts, sort_keys=True, default=str).encode()).hexdigest()


def _normalise(vector: list[float]) -> list[float]:
    """Unit length, so cosine distance in pgvector equals dot product ranking.
    Reduced-dimension Gemini embeddings are not normalised by the API."""
    norm = math.sqrt(sum(v * v for v in vector)) or 1.0
    return [v / norm for v in vector]


class Provider(Protocol):
    async def generate(
        self, *, model: str, system: str, parts: list[str], max_tokens: int, temperature: float, json_schema: dict | None
    ) -> str: ...

    async def embed(self, *, model: str, texts: list[str], task: EmbedTask, dimensions: int) -> list[list[float]]: ...


class GeminiProvider:
    """Gemini via the google-genai SDK."""

    _EMBED_BATCH = 100

    def __init__(self, api_key: str, timeout_seconds: float, thinking_level: str):
        from google import genai
        from google.genai import types

        self._types = types
        self._thinking_level = thinking_level
        self._client = genai.Client(
            api_key=api_key,
            # The gateway enforces the real deadlines; this only stops a hung socket.
            http_options=types.HttpOptions(timeout=int(timeout_seconds * 4000)),
        )

    async def generate(
        self, *, model: str, system: str, parts: list[str], max_tokens: int, temperature: float, json_schema: dict | None
    ) -> str:
        types = self._types
        config: dict[str, Any] = {
            "system_instruction": system,
            "max_output_tokens": max_tokens,
            "temperature": temperature,
            # Short, structured calls gain little from hidden reasoning, and it
            # counts against max_output_tokens. Gemini 3 takes a thinking level;
            # older models take a token budget.
            "thinking_config": (
                types.ThinkingConfig(thinking_level=self._thinking_level)
                if model.startswith("gemini-3")
                else types.ThinkingConfig(thinking_budget=0)
            ),
        }
        if json_schema is not None:
            config["response_mime_type"] = "application/json"
            config["response_json_schema"] = json_schema
        response = await self._client.aio.models.generate_content(
            model=model,
            contents=[types.Content(role="user", parts=[types.Part.from_text(text=p) for p in parts])],
            config=types.GenerateContentConfig(**config),
        )
        return (response.text or "").strip()

    async def embed(self, *, model: str, texts: list[str], task: EmbedTask, dimensions: int) -> list[list[float]]:
        types = self._types
        task_type = "RETRIEVAL_DOCUMENT" if task == "document" else "RETRIEVAL_QUERY"
        vectors: list[list[float]] = []
        for start in range(0, len(texts), self._EMBED_BATCH):
            batch = texts[start : start + self._EMBED_BATCH]
            response = await self._client.aio.models.embed_content(
                model=model,
                contents=batch,
                config=types.EmbedContentConfig(task_type=task_type, output_dimensionality=dimensions),
            )
            vectors.extend(list(e.values or []) for e in response.embeddings or [])
        return vectors


class ModelGateway:
    def __init__(self, provider: Provider, *, clock=time.monotonic, sleep=asyncio.sleep):
        settings = get_settings()
        self._sleep = sleep
        self._provider = provider
        self._settings = settings
        self._responses = _LRU(settings.response_cache_entries)
        self._embeddings = _LRU(settings.response_cache_entries * 4)
        self._cooling: dict[str, float] = {}
        self._embed_window = _RateWindow(settings.embed_requests_per_minute, clock=clock, sleep=sleep)

    async def _with_retry(self, label: str, call, attempts: int = 3):
        delay = 0.8
        timeout = self._settings.llm_timeout_seconds
        for attempt in range(attempts):
            try:
                return await asyncio.wait_for(call(), timeout)
            except Exception as exc:  # noqa: BLE001 - provider errors vary by SDK version
                if attempt == attempts - 1:
                    log.warning("%s failed after %d attempt(s): %r", label, attempts, exc)
                    raise ModelError(f"{label} failed: {exc!r}") from exc
                await asyncio.sleep(delay)
                delay *= 2

    def _chain(self, primary: str) -> list[str]:
        """The requested model, then the fallbacks, then the other Week 1 model.

        Fallbacks come before the other model so that grading calls do not spend
        the answer model's quota, and answers prefer a full model to the lite one.
        """
        s = self._settings
        fallbacks = [m.strip() for m in s.gemini_fallback_models.split(",")]
        other = s.gemini_answer_model if primary == s.gemini_fast_model else s.gemini_fast_model
        return list(dict.fromkeys(m for m in [primary, *fallbacks, other] if m))

    def _cool_down(self, model: str, exc: BaseException) -> None:
        # Quota errors say how long to wait ("retry in 46.08s"); use that when given.
        seconds = _retry_after(exc) or self._settings.model_cooldown_seconds
        self._cooling[model] = time.monotonic() + min(seconds, 3600)

    async def generate(
        self,
        *,
        system: str,
        parts: list[str],
        fast: bool = False,
        max_tokens: int = 1024,
        temperature: float = 0.2,
        json_schema: dict | None = None,
    ) -> Generation:
        primary = self._settings.gemini_fast_model if fast else self._settings.gemini_answer_model
        key = _key("generate", primary, system, parts, max_tokens, temperature, json_schema)
        cached = self._responses.get(key)
        if cached is not None:
            return Generation(text=cached, model=primary, cached=True)

        now = time.monotonic()
        chain = self._chain(primary)
        ready = [m for m in chain if self._cooling.get(m, 0) <= now]
        # If every model is cooling down, try the one that recovers first.
        order = ready or [min(chain, key=lambda m: self._cooling.get(m, 0))]
        error: ModelError | None = None
        for model in order:
            try:
                text = await self._with_retry(
                    f"generate:{model}",
                    lambda model=model: self._provider.generate(
                        model=model, system=system, parts=parts, max_tokens=max_tokens, temperature=temperature, json_schema=json_schema
                    ),
                    attempts=1,
                )
            except ModelError as exc:
                self._cool_down(model, exc.__cause__ or exc)
                error = exc
                continue
            self._cooling.pop(model, None)
            if model == primary:
                self._responses.put(key, text)
            else:
                log.warning("generate:%s unavailable, answered by %s", primary, model)
            return Generation(text=text, model=model)
        raise error or ModelError(f"generate:{primary} failed")

    async def embed(self, texts: list[str], task: EmbedTask) -> list[list[float]]:
        if not texts:
            return []
        model = self._settings.gemini_embed_model
        dims = self._settings.embed_dim
        keys = [_key("embed", model, task, dims, t) for t in texts]
        results: list[list[float] | None] = [self._embeddings.get(k) for k in keys]
        missing = [i for i, r in enumerate(results) if r is None]
        batch_size = max(1, min(self._settings.embed_batch_size, self._embed_window.per_minute))
        # Documents leave headroom in the window so questions are not held up.
        reserve = min(10, self._embed_window.per_minute // 10) if task == "document" else 0
        for start in range(0, len(missing), batch_size):
            batch = missing[start : start + batch_size]
            await self._embed_window.acquire(len(batch), reserve=reserve)
            fresh = await self._embed_batch(model, [texts[i] for i in batch], task, dims)
            if len(fresh) != len(batch):
                raise ModelError(f"embed:{model} returned {len(fresh)} vectors for {len(batch)} inputs")
            for i, vector in zip(batch, fresh):
                if len(vector) != dims:
                    raise ModelError(f"embed:{model} returned {len(vector)} dimensions, expected {dims}")
                unit = _normalise(vector)
                results[i] = unit
                self._embeddings.put(keys[i], unit)
        return [r for r in results if r is not None]

    async def _embed_batch(self, model: str, texts: list[str], task: EmbedTask, dims: int) -> list[list[float]]:
        """One batch, retried. A per-minute quota error waits as long as the provider asks.

        There is no model fallback here: vectors from another embedding model would
        not be comparable with the ones already stored.
        """
        attempts = 5
        delay = 0.8
        for attempt in range(attempts):
            try:
                return await asyncio.wait_for(
                    self._provider.embed(model=model, texts=texts, task=task, dimensions=dims),
                    self._settings.llm_timeout_seconds * 4,
                )
            except Exception as exc:  # noqa: BLE001 - provider errors vary by SDK version
                quota = _is_quota_error(exc)
                wait = _retry_after(exc)
                daily = quota and ("PerDay" in str(exc) or (wait or 0) > 120)
                if daily or attempt == attempts - 1:
                    log.warning("embed:%s failed after %d attempt(s): %r", model, attempt + 1, exc)
                    if quota:
                        raise QuotaExceeded(f"embed:{model} quota exceeded: {exc!r}", daily=daily) from exc
                    raise ModelError(f"embed:{model} failed: {exc!r}") from exc
                if quota:
                    log.info("embed:%s hit the per-minute quota, waiting %.0fs", model, (wait or 30) + 1)
                    await self._sleep((wait or 30) + 1)
                else:
                    await self._sleep(delay)
                    delay *= 2
        raise ModelError(f"embed:{model} failed")


@lru_cache
def get_gateway() -> ModelGateway:
    settings = get_settings()
    if settings.gemini_api_key is None or not settings.gemini_api_key.get_secret_value():
        raise ModelError("GEMINI_API_KEY is not set. Add it to backend/.env.")
    return ModelGateway(
        GeminiProvider(settings.gemini_api_key.get_secret_value(), settings.llm_timeout_seconds, settings.gemini_thinking_level)
    )
