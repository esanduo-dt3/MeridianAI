"""Cross-encoder reranking with Voyage rerank-2.5.

Hybrid search casts a wide net quickly; the reranker reads each (query, passage)
pair together and scores true relevance in [0, 1]. It is the largest precision
lever in the pipeline, and its score feeds the confidence gate and the stated
(uncalibrated) confidence value.
"""

from __future__ import annotations

from functools import lru_cache

from app.core.config import get_settings
from app.llm.gateway import ModelError


@lru_cache
def _client():
    import voyageai

    settings = get_settings()
    if settings.voyage_api_key is None or not settings.voyage_api_key.get_secret_value():
        raise ModelError("VOYAGE_API_KEY is not set. Add it to backend/.env.")
    return voyageai.AsyncClient(api_key=settings.voyage_api_key.get_secret_value(), max_retries=2, timeout=30)


async def rerank(query: str, documents: list[str], top_k: int) -> list[tuple[int, float]]:
    """(original index, relevance score) pairs, best first, at most top_k."""
    if not documents:
        return []
    result = await _client().rerank(
        query=query,
        documents=documents,
        model=get_settings().voyage_rerank_model,
        top_k=min(top_k, len(documents)),
        truncation=True,
    )
    return [(int(item.index), float(item.relevance_score)) for item in result.results]
