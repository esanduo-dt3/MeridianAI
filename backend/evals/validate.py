"""Check the golden set against the ingested corpus, spending no model quota.

Every expected quote must resolve to exactly the passage the answer should rest
on. Running this to a clean bill before `evals.run` is what keeps a dataset
mistake from being discovered halfway through a day's Gemini quota.

    .venv/bin/python -m evals.validate --workspace <id>
"""

from __future__ import annotations

import argparse
import asyncio
from pathlib import Path

from app.core.supabase import open_service_db
from evals import corpus as corpus_mod
from evals._cli import fail, resolve_workspace, say
from evals.golden import GoldenError, load

DEFAULT_GOLDEN = Path(__file__).parent / "golden.jsonl"


async def main() -> int:
    parser = argparse.ArgumentParser(description="Validate the golden set against the corpus.")
    parser.add_argument("--golden", type=Path, default=DEFAULT_GOLDEN)
    parser.add_argument("--workspace", help="workspace id or a unique part of its name")
    args = parser.parse_args()

    try:
        questions = load(args.golden)
    except GoldenError as exc:
        fail(str(exc))

    async with open_service_db() as db:
        workspace_id, workspace_name = await resolve_workspace(db, args.workspace)
        corpus = await corpus_mod.load(db, workspace_id)

    say(f"Workspace: {workspace_name}  ({workspace_id})")
    say(f"Corpus:    {len(corpus.ready)} ready documents, {corpus.total_chunks} passages")
    say(f"Golden:    {args.golden} ({len(questions)} questions)")
    say()

    not_ready = [d for d in corpus.documents if d.parsed_status != "ready"]
    for document in not_ready:
        say(f"  ! {document.file_name} is {document.parsed_status} and will not be searched")
    if not_ready:
        say()

    problems = 0
    for question in questions:
        resolved = corpus_mod.resolve(corpus, question)
        if not question.answerable:
            say(f"  {question.id}  refusal question, no expected passage")
            continue
        if resolved.ok:
            where = resolved.document.file_name if resolved.document else "corpus"
            passages = ", ".join(str(i) for i in resolved.expected_chunk_indexes)
            say(f"  {question.id}  -> {where} passage {passages}")
        else:
            problems += 1
            say(f"  {question.id}  PROBLEM: {resolved.problem}")

    say()
    gate = [q for q in questions if q.scored_for_gate]
    refusals = [q for q in questions if not q.scored_for_gate]
    say(f"{len(gate)} gate questions, {len(refusals)} refusal questions")
    if len(gate) != 15:
        say(f"Note: Gate G1 is defined over 15 answerable questions; this set has {len(gate)}.")
    if problems:
        say()
        fail(f"{problems} question(s) could not be resolved. Fix the dataset before running the eval.")
    say("Every question resolves. Safe to run.")
    return 0


if __name__ == "__main__":
    raise SystemExit(asyncio.run(main()))
