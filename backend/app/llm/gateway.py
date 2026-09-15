"""The model provider gateway (PRD: a thin, swappable provider gateway with a
response cache; docs/decisions.md D-026).

Everything that calls a model goes through `ModelGateway`, so the provider can be
swapped in one place and every call gets the same caching, timeouts and error
type. Gemini is the provider for Week 1.

The response cache is in-process and keyed on the exact request, so repeating an
identical question (demo pre-warming, a retry after a network blip) costs no model
call. Embeddings are cached the same way because they are deterministic.

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
from collections import OrderedDict
from dataclasses import dataclass
from functools import lru_cache
from typing import Any, Literal, Protocol

from app.core.config import get_settings

log = logging.getLogger(__name__)

EmbedTask = Literal["document", "query"]


class ModelError(RuntimeError):
    """A model call failed after retries, or the provider is not configured."""


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
            http_options=types.HttpOptions(timeout=int(timeout_seconds * 1000)),
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
    def __init__(self, provider: Provider):
        settings = get_settings()
        self._provider = provider
        self._settings = settings
        self._responses = _LRU(settings.response_cache_entries)
        self._embeddings = _LRU(settings.response_cache_entries * 4)

    async def _with_retry(self, label: str, call):
        delay = 0.8
        for attempt in range(3):
            try:
                return await call()
            except Exception as exc:  # noqa: BLE001 - provider errors vary by SDK version
                if attempt == 2:
                    log.warning("%s failed after retries", label, exc_info=True)
                    raise ModelError(f"{label} failed: {exc}") from exc
                await asyncio.sleep(delay)
                delay *= 2

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
        model = self._settings.gemini_fast_model if fast else self._settings.gemini_answer_model
        key = _key("generate", model, system, parts, max_tokens, temperature, json_schema)
        cached = self._responses.get(key)
        if cached is not None:
            return Generation(text=cached, model=model, cached=True)
        text = await self._with_retry(
            f"generate:{model}",
            lambda: self._provider.generate(
                model=model, system=system, parts=parts, max_tokens=max_tokens, temperature=temperature, json_schema=json_schema
            ),
        )
        self._responses.put(key, text)
        return Generation(text=text, model=model)

    async def embed(self, texts: list[str], task: EmbedTask) -> list[list[float]]:
        if not texts:
            return []
        model = self._settings.gemini_embed_model
        dims = self._settings.embed_dim
        keys = [_key("embed", model, task, dims, t) for t in texts]
        results: list[list[float] | None] = [self._embeddings.get(k) for k in keys]
        missing = [i for i, r in enumerate(results) if r is None]
        if missing:
            fresh = await self._with_retry(
                f"embed:{model}",
                lambda: self._provider.embed(model=model, texts=[texts[i] for i in missing], task=task, dimensions=dims),
            )
            if len(fresh) != len(missing):
                raise ModelError(f"embed:{model} returned {len(fresh)} vectors for {len(missing)} inputs")
            for i, vector in zip(missing, fresh):
                if len(vector) != dims:
                    raise ModelError(f"embed:{model} returned {len(vector)} dimensions, expected {dims}")
                unit = _normalise(vector)
                results[i] = unit
                self._embeddings.put(keys[i], unit)
        return [r for r in results if r is not None]


@lru_cache
def get_gateway() -> ModelGateway:
    settings = get_settings()
    if settings.gemini_api_key is None or not settings.gemini_api_key.get_secret_value():
        raise ModelError("GEMINI_API_KEY is not set. Add it to backend/.env.")
    return ModelGateway(
        GeminiProvider(settings.gemini_api_key.get_secret_value(), settings.llm_timeout_seconds, settings.gemini_thinking_level)
    )
