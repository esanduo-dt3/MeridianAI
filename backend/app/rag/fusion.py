"""Rank fusion and diversity selection. Pure functions, no I/O.

Reciprocal rank fusion merges the dense and keyword result lists by position
rather than score, because the two scales are not comparable: cosine similarity
lives in [0, 1] and ts_rank_cd is unbounded. A passage ranked first by either leg
is guaranteed to survive into the candidate set, which is the point of adding
keyword search.

Maximal marginal relevance then picks the final set, trading a little relevance
for coverage so the model does not read the same paragraph five times.
"""

from __future__ import annotations

from dataclasses import dataclass, replace

import numpy as np

RRF_K = 60  # from the original RRF paper; damps the gap between rank 1 and 2


@dataclass(frozen=True)
class Candidate:
    chunk_id: str
    document_id: str = ""
    score: float = 0.0
    dense_rank: int | None = None
    sparse_rank: int | None = None


def reciprocal_rank_fusion(
    dense: list[str], sparse: list[str], *, dense_weight: float = 1.0, sparse_weight: float = 1.0
) -> list[Candidate]:
    """Fuse two ranked lists of chunk ids, best first. Score is the fused RRF score."""
    fused: dict[str, float] = {}
    dense_rank: dict[str, int] = {}
    sparse_rank: dict[str, int] = {}
    for rank, chunk_id in enumerate(dense):
        fused[chunk_id] = fused.get(chunk_id, 0.0) + dense_weight / (RRF_K + rank + 1)
        dense_rank.setdefault(chunk_id, rank + 1)
    for rank, chunk_id in enumerate(sparse):
        fused[chunk_id] = fused.get(chunk_id, 0.0) + sparse_weight / (RRF_K + rank + 1)
        sparse_rank.setdefault(chunk_id, rank + 1)
    ordered = sorted(fused.items(), key=lambda kv: kv[1], reverse=True)
    return [
        Candidate(chunk_id=cid, score=score, dense_rank=dense_rank.get(cid), sparse_rank=sparse_rank.get(cid))
        for cid, score in ordered
    ]


def maximal_marginal_relevance(
    query_vector: list[float], candidate_vectors: list[list[float]], *, k: int, lambda_mult: float = 0.7
) -> list[int]:
    """Greedy MMR. Returns the indexes to keep, in selection order."""
    if not candidate_vectors or k <= 0:
        return []
    k = min(k, len(candidate_vectors))
    candidates = np.asarray(candidate_vectors, dtype=np.float32)
    norms = np.linalg.norm(candidates, axis=1, keepdims=True)
    candidates = candidates / np.where(norms == 0, 1.0, norms)
    query = np.asarray(query_vector, dtype=np.float32)
    query = query / (np.linalg.norm(query) or 1.0)

    to_query = candidates @ query
    pairwise = candidates @ candidates.T
    selected = [int(np.argmax(to_query))]
    remaining = [i for i in range(len(candidates)) if i != selected[0]]
    while len(selected) < k and remaining:
        redundancy = pairwise[np.ix_(remaining, selected)].max(axis=1)
        scores = lambda_mult * to_query[remaining] - (1.0 - lambda_mult) * redundancy
        pick = remaining[int(np.argmax(scores))]
        selected.append(pick)
        remaining.remove(pick)
    return selected


def cap_per_document(candidates: list[Candidate], limit: int) -> list[Candidate]:
    """At most `limit` chunks from any one document, preserving order."""
    if limit <= 0:
        return candidates
    kept: list[Candidate] = []
    counts: dict[str, int] = {}
    for candidate in candidates:
        key = candidate.document_id or candidate.chunk_id
        if counts.get(key, 0) >= limit:
            continue
        counts[key] = counts.get(key, 0) + 1
        kept.append(candidate)
    return kept


def with_score(candidate: Candidate, score: float) -> Candidate:
    return replace(candidate, score=score)
