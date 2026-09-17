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
from evals.metrics import fact_present

DEFAULT_GOLDEN = Path(__file__).parent / "golden.jsonl"


def _raw_field(path: Path, question_id: str, key: str) -> list[str]:
    """A field the loader does not model, read straight from the golden file."""
    import json

    for line in path.read_text(encoding="utf-8").splitlines():
        if line.strip() and not line.startswith("//"):
            row = json.loads(line)
            if row.get("id") == question_id:
                return [v for v in row.get(key, []) if isinstance(v, str)]
    return []


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
            corpus_text = " ".join(d.content_text for d in corpus.ready)
            leaked = [f for f in question.must_not_include if fact_present(corpus_text, f)]
            say(f"  {question.id}  refusal case, no expected passage" + (f"  (note: {leaked} appear in the corpus)" if leaked else ""))
            continue
        if resolved.ok:
            passages = ", ".join(str(i) for i in resolved.expected_chunk_indexes)
            groups = len(resolved.required_groups)
            where = ", ".join(question.documents) if question.documents else "corpus"
            say(f"  {question.id}  -> {groups} required passage group(s), passages {passages} ({where})")
            for warning in resolved.warnings:
                say(f"        note: {warning}")
            # Facts are checked against every document the question names, since a
            # cross-document answer draws its facts from several (D-043).
            named = [corpus.find_document(n) for n in question.documents]
            source = " ".join(d.content_text for d in named if d) or " ".join(d.content_text for d in corpus.ready)
            lost = set(_raw_field(args.golden, question.id, "facts_lost_in_extraction"))
            absent = [f for f in question.must_include if not fact_present(source, f) and f not in lost]
            for fact in sorted(lost):
                say(f"        note: key fact {fact!r} is recorded as lost in extraction; it stays required")
            if absent:
                problems += 1
                say(f"  {question.id}  PROBLEM: must_include not in the source text: {absent}")
            present = [f for f in question.must_not_include if fact_present(source, f)]
            if present:
                problems += 1
                say(f"  {question.id}  PROBLEM: must_not_include terms DO appear in the source, so using them is not an error: {present}")
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
