"""Run the golden set and record what the pipeline answered.

Two modes, because Gemini's free tier is the binding constraint (D-032):

``--retrieval-only``
    Embeds each question, searches, reranks and stops. **No generation calls at
    all**, so it can be re-run freely. It answers the question that decides
    whether G1 is reachable: was the expected passage retrieved, and at what
    rank? A question whose passage is never retrieved cannot be fixed by the
    answer model.

full (the default)
    The measured run: retrieval, answer, citations, groundedness. About three
    generation calls per question.

Everything mechanical is scored here. Whether the prose is actually correct is
left blank for a person, in the ``grading`` block of each result.

    .venv/bin/python -m evals.run --workspace <id> --retrieval-only
    .venv/bin/python -m evals.run --workspace <id>
"""

from __future__ import annotations

import argparse
import asyncio
import json
import time
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

from app.core.config import get_settings
from app.core.supabase import Db, open_service_db
from app.llm.gateway import ModelError
from app.rag.answer import generate_answer, record_answer
from app.rag.profiles import get_profile
from app.rag.retrieval import RetrievedChunk, agentic_retrieve, hybrid_search
from evals import corpus as corpus_mod
from evals._cli import admin_user_id, fail, now_stamp, resolve_workspace, say
from evals.golden import GoldenError, GoldenQuestion, load

DEFAULT_GOLDEN = Path(__file__).parent / "golden.jsonl"
RESULTS_DIR = Path(__file__).parent / "results"
SCHEMA_VERSION = 1


async def main() -> int:
    parser = argparse.ArgumentParser(description="Run the golden set against the pipeline.")
    parser.add_argument("--golden", type=Path, default=DEFAULT_GOLDEN)
    parser.add_argument("--workspace", help="workspace id or a unique part of its name")
    parser.add_argument("--retrieval-only", action="store_true", help="no generation calls; spends no answer quota")
    parser.add_argument("--only", help="comma-separated question ids, to run part of the set")
    parser.add_argument("--out", type=Path, help="results file (default: evals/results/<mode>-<stamp>.json)")
    args = parser.parse_args()

    try:
        questions = load(args.golden)
    except GoldenError as exc:
        fail(str(exc))

    if args.only:
        wanted = {q.strip() for q in args.only.split(",") if q.strip()}
        questions = [q for q in questions if q.id in wanted]
        missing = wanted - {q.id for q in questions}
        if missing:
            fail(f"no such question id(s): {', '.join(sorted(missing))}")

    settings = get_settings()
    mode = "retrieval" if args.retrieval_only else "full"

    async with open_service_db() as db:
        workspace_id, workspace_name = await resolve_workspace(db, args.workspace)
        corpus = await corpus_mod.load(db, workspace_id)
        if not corpus.ready:
            fail("no document in this workspace is ready; run evals.ingest first")

        resolutions = {q.id: corpus_mod.resolve(corpus, q) for q in questions}
        broken = [r for r in resolutions.values() if not r.ok]
        if broken:
            for resolution in broken:
                say(f"  {resolution.question.id}  PROBLEM: {resolution.problem}")
            fail(f"{len(broken)} question(s) do not resolve. Run evals.validate and fix the dataset first.")

        user_id = await admin_user_id(db, workspace_id) if mode == "full" else None

        say(f"Workspace: {workspace_name}  ({workspace_id})")
        say(f"Corpus:    {len(corpus.ready)} documents, {corpus.total_chunks} passages")
        say(f"Mode:      {mode}" + ("  (no generation calls)" if mode == "retrieval" else ""))
        say(f"Questions: {len(questions)}")
        say()

        records: list[dict[str, Any]] = []
        for number, question in enumerate(questions, start=1):
            expected = resolutions[question.id]
            say(f"[{number}/{len(questions)}] {question.id}  {question.question[:70]}")
            try:
                if mode == "retrieval":
                    record = await _retrieval_only(db, workspace_id, question, expected)
                else:
                    record = await _full(db, workspace_id, user_id, question, expected, settings.gemini_answer_model)
            except ModelError as exc:
                say(f"    MODEL ERROR: {exc}")
                say("    Stopping so the remaining quota is not spent on a broken run.")
                say("    Re-run later with --only for the questions still missing.")
                records.append(_error_record(question, expected, str(exc)))
                break
            records.append(record)
            say("    " + _one_line(record, mode))

        out = args.out or (RESULTS_DIR / f"{mode}-{now_stamp()}.json")
        out.parent.mkdir(parents=True, exist_ok=True)
        payload = {
            "schema_version": SCHEMA_VERSION,
            "run": {
                "mode": mode,
                "started_at": datetime.now(timezone.utc).isoformat(),
                "workspace_id": workspace_id,
                "workspace_name": workspace_name,
                "golden_file": str(args.golden),
                "corpus": {
                    "documents": len(corpus.ready),
                    "passages": corpus.total_chunks,
                    "file_names": [d.file_name for d in corpus.ready],
                },
                "configured_answer_model": settings.gemini_answer_model,
                "configured_fast_model": settings.gemini_fast_model,
            },
            "questions": records,
        }
        out.write_text(json.dumps(payload, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")

    say()
    say(f"Wrote {out}")
    if mode == "full":
        say("Fill in each question's \"grading\" block, then run evals.report.")
    return 0


# --- The two modes ---------------------------------------------------------


async def _retrieval_only(db: Db, workspace_id: str, question: GoldenQuestion, expected) -> dict[str, Any]:
    """One search pass. Embeds the query and reranks; makes no generation call."""
    started = time.perf_counter()
    chunks, candidates, reranked = await hybrid_search(
        db, workspace_id=workspace_id, query=question.question, profile=get_profile(question.profile), document_ids=None
    )
    latency_ms = int((time.perf_counter() - started) * 1000)

    return {
        **_base(question, expected),
        "result": {
            "retrieved": [_chunk_brief(c, rank) for rank, c in enumerate(chunks, start=1)],
            "reranked": reranked,
            "top_score": max((c.rerank_score for c in chunks if c.rerank_score is not None), default=None),
            "candidate_count": len(candidates),
            "latency_ms": latency_ms,
        },
        "auto_score": _retrieval_score(chunks, expected.expected_chunk_ids),
        "grading": _blank_grading(),
    }


async def _full(
    db: Db, workspace_id: str, user_id: str, question: GoldenQuestion, expected, answer_model: str
) -> dict[str, Any]:
    started = time.perf_counter()
    retrieval = await agentic_retrieve(
        db, workspace_id=workspace_id, question=question.question, profile_name=question.profile, document_ids=None
    )
    outcome = await generate_answer(question.question, retrieval)
    run_id, answer_id, latency_ms = await record_answer(
        db,
        workspace_id=workspace_id,
        user_id=user_id,
        question=question.question,
        retrieval=retrieval,
        outcome=outcome,
        started=started,
    )

    cited_ids = [c.chunk.id for c in outcome.citations]
    score = _retrieval_score(retrieval.best.chunks, expected.expected_chunk_ids)
    score["expected_chunk_cited"] = any(cid in expected.expected_chunk_ids for cid in cited_ids)
    score["cited_position_of_expected"] = next(
        (i for i, cid in enumerate(cited_ids, start=1) if cid in expected.expected_chunk_ids), None
    )
    score["answered_by_fallback_model"] = outcome.model != answer_model
    score["refused"] = not outcome.answerable
    score["refusal_correct"] = (not outcome.answerable) if not question.answerable else None

    return {
        **_base(question, expected),
        "result": {
            "answer": outcome.answer,
            "answerable": outcome.answerable,
            "citations": [
                {
                    "ordinal": c.ordinal,
                    "chunk_id": c.chunk.id,
                    "file_name": c.chunk.file_name,
                    "section": c.chunk.section,
                    "page": c.chunk.page,
                    "char_start": c.chunk.char_start,
                    "char_end": c.chunk.char_end,
                    "rerank_score": c.chunk.rerank_score,
                    "excerpt": c.chunk.content[:600],
                }
                for c in outcome.citations
            ],
            "confidence": outcome.confidence,
            "confidence_label": "uncalibrated",
            "grounded": outcome.grounded,
            "unsupported": outcome.unsupported,
            "flagged": outcome.flagged,
            "flag_reasons": outcome.flag_reasons,
            "model": outcome.model,
            "attempts": len(retrieval.attempts),
            "grade": retrieval.best.grade,
            "grade_note": retrieval.best.note,
            "final_query": retrieval.best.query,
            "reranked": retrieval.reranked,
            "latency_ms": latency_ms,
            "run_id": run_id,
            "answer_id": answer_id,
        },
        "auto_score": score,
        "grading": _blank_grading(),
    }


# --- Shared shaping --------------------------------------------------------


def _base(question: GoldenQuestion, expected) -> dict[str, Any]:
    return {
        "id": question.id,
        "question": question.question,
        "profile": question.profile,
        "kind": question.kind,
        "answerable_expected": question.answerable,
        "expected": {
            "document": question.document,
            "quote": question.expected_quote,
            "expected_answer": question.expected_answer,
            "chunk_ids": expected.expected_chunk_ids,
            "chunk_indexes": expected.expected_chunk_indexes,
        },
        "notes": question.notes,
    }


def _blank_grading() -> dict[str, Any]:
    """Left for a person. `null` means ungraded; report.py counts those separately."""
    return {
        "answer_correct": None,       # true | false | "partial"
        "citation_acceptable": None,  # true overrides a false auto-score when another passage was legitimately right
        "notes": "",
    }


def _chunk_brief(chunk: RetrievedChunk, rank: int) -> dict[str, Any]:
    return {
        "rank": rank,
        "chunk_id": chunk.id,
        "file_name": chunk.file_name,
        "section": chunk.section,
        "page": chunk.page,
        "rerank_score": chunk.rerank_score,
        "excerpt": chunk.content[:300],
    }


def _retrieval_score(chunks: list[RetrievedChunk], expected_ids: list[str]) -> dict[str, Any]:
    rank = next((i for i, c in enumerate(chunks, start=1) if c.id in expected_ids), None)
    return {
        "expected_chunk_retrieved": rank is not None,
        "rank_of_expected": rank,
        "reciprocal_rank": round(1 / rank, 4) if rank else 0.0,
        "retrieved_count": len(chunks),
    }


def _error_record(question: GoldenQuestion, expected, message: str) -> dict[str, Any]:
    return {**_base(question, expected), "error": message, "auto_score": {}, "grading": _blank_grading()}


def _one_line(record: dict[str, Any], mode: str) -> str:
    score = record.get("auto_score", {})
    if mode == "retrieval":
        rank = score.get("rank_of_expected")
        return f"retrieved at rank {rank}" if rank else "expected passage NOT retrieved"
    result = record.get("result", {})
    hit = "cited" if score.get("expected_chunk_cited") else "NOT cited"
    fallback = "  [fallback model]" if score.get("answered_by_fallback_model") else ""
    return (
        f"{hit}, confidence {result.get('confidence')}, "
        f"grounded {result.get('grounded')}, {result.get('model')}, "
        f"{(result.get('latency_ms') or 0) / 1000:.1f}s{fallback}"
    )


if __name__ == "__main__":
    raise SystemExit(asyncio.run(main()))
