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
    parser.add_argument("--agent", action="store_true",
                        help="ask each question through the workspace agent end to end, as the app does (D-042, D-043)")
    parser.add_argument("--only", help="comma-separated question ids, to run part of the set")
    parser.add_argument(
        "--pace",
        type=float,
        default=0.0,
        help="seconds to wait between questions. The Voyage free tier without a payment method allows "
        "3 rerank requests a minute, so an unpaced run silently loses reranking; use 25 there.",
    )
    parser.add_argument("--out", type=Path, help="results file (default: evals/results/<mode>-<stamp>.json)")
    parser.add_argument("--note", default="", help="a caveat stored in the results file, e.g. why reranking was off")
    args = parser.parse_args()

    try:
        questions = load(args.golden)
    except GoldenError as exc:
        fail(str(exc))
    for line in args.golden.read_text(encoding="utf-8").splitlines():
        if line.strip() and not line.startswith("//"):
            row = json.loads(line)
            _RAW[row["id"]] = row

    if args.only:
        wanted = {q.strip() for q in args.only.split(",") if q.strip()}
        questions = [q for q in questions if q.id in wanted]
        missing = wanted - {q.id for q in questions}
        if missing:
            fail(f"no such question id(s): {', '.join(sorted(missing))}")

    settings = get_settings()
    mode = "retrieval" if args.retrieval_only else ("agent" if args.agent else "full")

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

        user_id = await admin_user_id(db, workspace_id) if mode in ("full", "agent") else None
        asker = None
        if mode == "agent":
            from app.core.workspace import WorkspaceContext

            email = (await db.select("users", {"select": "email", "id": f"eq.{user_id}"}))[0]["email"]
            asker = WorkspaceContext(user_id=user_id, email=email, workspace_id=workspace_id,
                                     workspace_name=workspace_name, auth_role="Admin")

        say(f"Workspace: {workspace_name}  ({workspace_id})")
        say(f"Corpus:    {len(corpus.ready)} documents, {corpus.total_chunks} passages")
        say(f"Mode:      {mode}" + ("  (no generation calls)" if mode == "retrieval" else ""))
        say(f"Questions: {len(questions)}")
        say()

        records: list[dict[str, Any]] = []
        for number, question in enumerate(questions, start=1):
            expected = resolutions[question.id]
            if args.pace and number > 1:
                await asyncio.sleep(args.pace)
            say(f"[{number}/{len(questions)}] {question.id}  {question.question[:70]}")
            try:
                if mode == "retrieval":
                    record = await _retrieval_only(db, workspace_id, question, expected)
                elif mode == "agent":
                    record = await _agent(db, asker, question, expected, settings.gemini_answer_model)
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

        unreranked = [r for r in records if r.get("result", {}).get("reranked") is False]
        if unreranked:
            say()
            say(f"WARNING: {len(unreranked)} of {len(records)} questions ran WITHOUT reranking.")
            say("The rerank score is the retrieval grade (D-030) and the basis of the confidence")
            say("value (D-027), so these results are not a valid measurement. Re-run with --pace 25.")

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
                "rerank_model": settings.voyage_rerank_model,
                "embed_model": settings.gemini_embed_model,
                "asked_as": asker.email if asker else None,
                "finished_at": datetime.now(timezone.utc).isoformat(),
                "pace_seconds": args.pace,
                "note": args.note,
                "questions_without_rerank": len(unreranked),
            },
            "questions": records,
        }
        out.write_text(json.dumps(payload, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")

    say()
    say(f"Wrote {out}")
    if mode in ("full", "agent"):
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
        "auto_score": {
            **_retrieval_score(chunks, expected.expected_chunk_ids),
            "required_groups": len(expected.required_groups),
            "required_groups_retrieved": sum(1 for g in expected.required_groups if set(g) & {c.id for c in chunks}),
        },
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
            # Kept so the expected passage can be re-scored later without a new run.
            "retrieved": [_chunk_brief(c, rank) for rank, c in enumerate(retrieval.best.chunks, start=1)],
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
    raw = _raw_rows().get(question.id, {})
    return {
        "id": question.id,
        "question": question.question,
        "type_label": question.type_label or question.kind,
        "profile": question.profile,
        "kind": question.kind,
        "gate": question.scored_for_gate,
        "answerable_expected": question.answerable,
        "expected_tools": question.expected_tools,
        "expected": {
            "document": question.document,
            "documents": question.documents,
            "quote": question.expected_quote,
            "also_required": question.also_required,
            "also_acceptable": question.also_acceptable,
            "distractor_quotes": question.distractor_quotes,
            "expected_answer": question.expected_answer,
            "must_include": question.must_include,
            "must_not_include": question.must_not_include,
            "chunk_ids": expected.expected_chunk_ids,
            "chunk_indexes": expected.expected_chunk_indexes,
            "required_groups": getattr(expected, "required_groups", []),
            "distractor_chunk_ids": getattr(expected, "distractor_chunk_ids", []),
            "resolution_notes": getattr(expected, "warnings", []),
            "quote_adjustments": raw.get("quote_adjustments", []),
            "facts_lost_in_extraction": raw.get("facts_lost_in_extraction", []),
        },
        "notes": question.notes,
        "source": raw.get("source"),
    }


_RAW: dict[str, dict] = {}


def _raw_rows() -> dict[str, dict]:
    """Fields the loader does not model (the spreadsheet row, quote adjustments), read from the golden file."""
    return _RAW


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


DOCUMENT_TOOLS = ("lookup_fact", "explore_documents", "summarize_documents")


async def _agent(db: Db, asker, question: GoldenQuestion, expected, answer_model: str) -> dict[str, Any]:
    """One question through the workspace agent, end to end, exactly as the app asks it.

    The agent chooses whether to use a document tool and which one. Every
    retrieval the tools run is observed, without changing product code, so the
    expected passage's rank can be scored as well as whether it was cited.
    """
    from datetime import date

    from app.agent.loop import run_agent
    from app.agent.tools import ToolContext, TurnState
    from app.rag import retrieval as retrieval_module
    from evals.metrics import fact_present

    captured: list = []
    original = retrieval_module.agentic_retrieve

    async def observed(*args, **kwargs):
        outcome = await original(*args, **kwargs)
        captured.append(outcome)
        return outcome

    retrieval_module.agentic_retrieve = observed
    state = TurnState(user_message=question.question)
    ctx = ToolContext(db=db, service=db, workspace=asker, today=date.today(), state=state)
    started = time.perf_counter()
    try:
        agent = await run_agent(ctx, [])
    finally:
        retrieval_module.agentic_retrieve = original
    total_ms = int((time.perf_counter() - started) * 1000)

    answers = state.answers
    expected_ids = set(expected.expected_chunk_ids)
    groups = [set(g) for g in getattr(expected, "required_groups", [])]
    distractors = set(getattr(expected, "distractor_chunk_ids", []))

    cited_ids: list[str] = []
    for answer in answers:
        cited_ids.extend(c["chunk_id"] for c in answer["citations"] if c["chunk_id"] not in cited_ids)

    retrieved: list[dict[str, Any]] = []
    seen: set[str] = set()
    best_rank = None
    for run_index, outcome in enumerate(captured, start=1):
        for rank, chunk in enumerate(outcome.best.chunks, start=1):
            if chunk.id in expected_ids and (best_rank is None or rank < best_rank):
                best_rank = rank
            if chunk.id not in seen:
                seen.add(chunk.id)
                retrieved.append({**_chunk_brief(chunk, rank), "retrieval_run": run_index})

    doc_tools = [s.tool for s in agent.steps if s.tool in DOCUMENT_TOOLS]
    first_tool = doc_tools[0] if doc_tools else "none"
    shown = "\n\n".join([agent.reply, *[a["answer"] for a in answers]])
    violations = [term for term in question.must_not_include if fact_present(shown, term)]
    refused = not any(a["answerable"] for a in answers)
    answer_models = [a["model"] for a in answers]

    return {
        **_base(question, expected),
        "result": {
            # What the person reads: the agent's reply and every checked answer under it.
            "answer": "\n\n".join(a["answer"] for a in answers) or agent.reply,
            "reply": agent.reply,
            "checked_answers": answers,
            "answerable": not refused,
            "citations": [c for a in answers for c in a["citations"]],
            "confidence": answers[0]["confidence"]["value"] if answers else None,
            "confidences": [a["confidence"]["value"] for a in answers],
            "confidence_label": "uncalibrated",
            "grounded": all(a["grounded"] for a in answers) if answers else None,
            "flagged": any(a["flagged"] for a in answers),
            "flag_reasons": sorted({r for a in answers for r in a["flag_reasons"]}),
            "model": answer_models[0] if answer_models else (agent.models[0] if agent.models else None),
            "answer_models": answer_models,
            "agent_models": agent.models,
            "tools_called": [{"tool": s.tool, "arguments": s.arguments, "ok": s.ok, "summary": s.summary} for s in agent.steps],
            "document_tools": doc_tools,
            "tool_errors": [s.summary for s in agent.steps if s.summary.startswith("ERROR")],
            "attempts": sum(a["retrieval"]["attempts"] for a in answers),
            "grade": [a["retrieval"]["grade"] for a in answers],
            "reranked": all(a["retrieval"]["reranked"] for a in answers) if answers else None,
            "top_scores": [a["retrieval"]["top_score"] for a in answers],
            "retrieved": retrieved,
            "latency_ms": total_ms,
            "answer_latency_ms": [a["retrieval"]["latency_ms"] for a in answers],
            "stopped_early": agent.stopped_early,
            "injection_detected": state.tainted,
            "answer_ids": [a["answer_id"] for a in answers],
            "run_ids": [a["retrieval"]["run_id"] for a in answers],
        },
        "auto_score": {
            "document_tool_chosen": first_tool,
            "routing_ok": (first_tool in question.expected_tools) if question.expected_tools else None,
            "expected_chunk_retrieved": bool(expected_ids & seen),
            "rank_of_expected": best_rank,
            "reciprocal_rank": round(1 / best_rank, 4) if best_rank else 0.0,
            "retrieved_count": len(retrieved),
            "expected_chunk_cited": bool(expected_ids & set(cited_ids)),
            "cited_position_of_expected": next((i for i, c in enumerate(cited_ids, 1) if c in expected_ids), None),
            "required_groups": len(groups),
            "required_groups_cited": sum(1 for g in groups if g & set(cited_ids)),
            "all_required_cited": bool(groups) and all(g & set(cited_ids) for g in groups),
            "cited_distractor": bool(distractors & set(cited_ids)),
            "must_not_include_violations": violations,
            "answered_by_fallback_model": any(m != answer_model for m in answer_models),
            "refused": refused,
            "refusal_correct": (refused and not violations) if not question.answerable else None,
        },
        "grading": _blank_grading(),
    }


def _error_record(question: GoldenQuestion, expected, message: str) -> dict[str, Any]:
    return {**_base(question, expected), "error": message, "auto_score": {}, "grading": _blank_grading()}


def _one_line(record: dict[str, Any], mode: str) -> str:
    score = record.get("auto_score", {})
    if mode == "retrieval":
        rank = score.get("rank_of_expected")
        return f"retrieved at rank {rank}" if rank else "expected passage NOT retrieved"
    if mode == "agent":
        result = record.get("result", {})
        cited = f"cited {score.get('required_groups_cited')}/{score.get('required_groups')}" if score.get("required_groups") else ("refused" if score.get("refused") else "answered")
        route = "route ok" if score.get("routing_ok") else f"ROUTE {score.get('document_tool_chosen')}"
        extras = []
        if score.get("cited_distractor"):
            extras.append("CITED TRAP")
        if score.get("must_not_include_violations"):
            extras.append(f"MUST-NOT {score['must_not_include_violations']}")
        if result.get("tool_errors"):
            extras.append(f"TOOL ERRORS {len(result['tool_errors'])}")
        if score.get("answered_by_fallback_model"):
            extras.append("fallback model")
        if result.get("reranked") is False:
            extras.append("NO RERANK")
        return (f"{route} ({score.get('document_tool_chosen')}), {cited}, rank {score.get('rank_of_expected')}, "
                f"confidence {result.get('confidences')}, grounded {result.get('grounded')}, "
                f"{(result.get('latency_ms') or 0) / 1000:.1f}s " + " ".join(extras))
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
