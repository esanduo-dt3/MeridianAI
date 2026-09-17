"""Retrieval profiles: one pipeline, different settings per job.

candidates      How wide the net is before reranking.
keep            How many chunks reach the model.
mmr_pool        How many the reranker keeps before MMR selects from them.
lambda_mult     1.0 is pure relevance, 0.0 is pure diversity.
dense_weight /  Relative pull of the two legs in rank fusion.
sparse_weight
per_doc_cap     Ceiling on chunks from one document. 0 disables it.
grade / rewrite Whether a borderline result gets an LLM grade and a retry.
"""

from __future__ import annotations

from dataclasses import dataclass


@dataclass(frozen=True)
class RetrievalProfile:
    name: str
    candidates: int = 20
    keep: int = 5
    mmr_pool: int = 10
    lambda_mult: float = 0.7
    dense_weight: float = 1.0
    sparse_weight: float = 1.0
    per_doc_cap: int = 0
    grade: bool = True
    rewrite: bool = True


# A question with one specific answer: precision first, and the keyword leg
# weighted up because such questions carry names, codes and figures.
LOOKUP = RetrievalProfile(name="lookup", candidates=20, keep=5, mmr_pool=10, lambda_mult=0.82, sparse_weight=1.2)

# Open or comparative questions: a wider net, diversity favoured.
EXPLORE = RetrievalProfile(name="explore", candidates=40, keep=8, mmr_pool=18, lambda_mult=0.55, per_doc_cap=3)

# Broad coverage for summaries: no single right answer to grade against.
SUMMARIZE = RetrievalProfile(
    name="summarize", candidates=45, keep=12, mmr_pool=24, lambda_mult=0.45, sparse_weight=0.7, per_doc_cap=3, grade=False
)

PROFILES = {p.name: p for p in (LOOKUP, EXPLORE, SUMMARIZE)}


def get_profile(name: str | None) -> RetrievalProfile:
    return PROFILES.get((name or "").lower(), LOOKUP)
