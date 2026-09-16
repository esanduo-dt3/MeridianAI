"""Ask the agent a grounded question (PRD: POST /agent/ask).

Any member of the workspace may ask. The question searches only that workspace
(optionally only chosen documents), every run is recorded in retrieval_runs, and
the answer is stored with chunk-level citations and a labelled-uncalibrated
confidence value. Low-confidence, ungrounded or suspicious answers are flagged
for the admin review queue rather than hidden.
"""

from __future__ import annotations

import time
from typing import Annotated, Literal
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel, Field, StringConstraints

from app.core.supabase import Db, service_db, user_db
from app.core.workspace import WorkspaceContext, get_workspace_context
from app.llm.gateway import ModelError
from app.rag.answer import CONFIDENCE_BASIS, CONFIDENCE_LABEL, generate_answer, record_answer
from app.rag.guardrails import sanitise_input
from app.rag.retrieval import agentic_retrieve

router = APIRouter(tags=["agent"])

MAX_QUESTION_CHARS = 2000
Question = Annotated[str, StringConstraints(strip_whitespace=True, min_length=3, max_length=MAX_QUESTION_CHARS)]


class AskRequest(BaseModel):
    question: Question
    document_ids: list[UUID] | None = Field(default=None, max_length=50)
    profile: Literal["lookup", "explore", "summarize"] = "lookup"


class CitationOut(BaseModel):
    ordinal: int
    chunk_id: str
    document_id: str
    file_name: str
    char_start: int
    char_end: int
    page: int | None
    section: str
    excerpt: str


class Confidence(BaseModel):
    value: float | None
    label: Literal["uncalibrated"] = CONFIDENCE_LABEL
    basis: str = CONFIDENCE_BASIS


class RetrievalSummary(BaseModel):
    run_id: str
    attempts: int
    grade: str
    final_query: str
    top_score: float | None
    reranked: bool
    latency_ms: int


class AskResponse(BaseModel):
    answer_id: str
    question: str
    answer: str
    answerable: bool
    citations: list[CitationOut]
    confidence: Confidence
    grounded: bool
    flagged: bool
    flag_reasons: list[str]
    retrieval: RetrievalSummary
    model: str


@router.post("/agent/ask", response_model=AskResponse)
async def ask(
    body: AskRequest,
    context: WorkspaceContext = Depends(get_workspace_context),
    db: Db = Depends(user_db),
    service: Db = Depends(service_db),
):
    started = time.perf_counter()
    question = sanitise_input(body.question, limit=MAX_QUESTION_CHARS)
    if len(question) < 3:
        raise HTTPException(status.HTTP_422_UNPROCESSABLE_ENTITY, "Ask a question of at least a few words")

    try:
        retrieval = await agentic_retrieve(
            db,
            workspace_id=context.workspace_id,
            question=question,
            profile_name=body.profile,
            document_ids=[str(d) for d in body.document_ids] if body.document_ids else None,
        )
        outcome = await generate_answer(question, retrieval)
    except ModelError as exc:
        raise HTTPException(status.HTTP_503_SERVICE_UNAVAILABLE, "The model provider is unavailable. Try again shortly.") from exc

    run_id, answer_id, latency_ms = await record_answer(
        service,
        workspace_id=context.workspace_id,
        user_id=context.user_id,
        question=question,
        retrieval=retrieval,
        outcome=outcome,
        started=started,
    )
    best = retrieval.best
    return AskResponse(
        answer_id=answer_id,
        question=question,
        answer=outcome.answer,
        answerable=outcome.answerable,
        citations=[
            CitationOut(
                ordinal=c.ordinal,
                chunk_id=c.chunk.id,
                document_id=c.chunk.document_id,
                file_name=c.chunk.file_name,
                char_start=c.chunk.char_start,
                char_end=c.chunk.char_end,
                page=c.chunk.page,
                section=c.chunk.section,
                excerpt=c.chunk.content[:800],
            )
            for c in outcome.citations
        ],
        confidence=Confidence(value=outcome.confidence),
        grounded=outcome.grounded,
        flagged=outcome.flagged,
        flag_reasons=outcome.flag_reasons,
        retrieval=RetrievalSummary(
            run_id=run_id,
            attempts=len(retrieval.attempts),
            grade=best.grade,
            final_query=best.query,
            top_score=best.top_score,
            reranked=retrieval.reranked,
            latency_ms=latency_ms,
        ),
        model=outcome.model,
    )


class AnswerListItem(BaseModel):
    id: str
    question: str
    answer: str
    confidence: Confidence
    groundedness_pass: bool
    flagged: bool
    flag_reasons: list[str]
    created_at: str
    # Which model answered. Null for answers recorded before the column existed
    # (migration 20260916160000_answer_model); a fallback here means the answer
    # did not come from the configured answer model (D-031).
    model: str | None = None


@router.get("/agent/answers", response_model=list[AnswerListItem])
async def recent_answers(context: WorkspaceContext = Depends(get_workspace_context), db: Db = Depends(user_db)):
    rows = await db.select(
        "agent_answers",
        {
            "select": "id,question,answer,confidence,groundedness_pass,flagged,flag_reasons,created_at,model",
            "workspace_id": f"eq.{context.workspace_id}",
            "asked_by": f"eq.{context.user_id}",
            "order": "created_at.desc",
            "limit": "30",
        },
    )
    return [AnswerListItem(**{**r, "confidence": Confidence(value=r["confidence"])}) for r in rows]
