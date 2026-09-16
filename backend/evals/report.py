"""Turn a results file into the Gate G1 report, and into a readable grading view.

Writes `<results>.md` next to the JSON: every question with its answer, the
passages it cited and the passage it should have cited, laid out for reading
while filling in the `grading` blocks in the JSON.

Prints the metrics. Anything a person has not graded is counted as ungraded
rather than as a failure, so a partly graded file still reports honestly.

    .venv/bin/python -m evals.report --results evals/results/full-<stamp>.json
"""

from __future__ import annotations

import argparse
import json
from pathlib import Path
from typing import Any

from evals._cli import fail, say
from evals.golden import GoldenError, load
from evals.metrics import compute

GATE_REQUIRED = 12
GATE_TOTAL = 15


def main() -> int:
    parser = argparse.ArgumentParser(description="Report Gate G1 results from a run.")
    parser.add_argument("--results", required=True, type=Path)
    parser.add_argument("--no-markdown", action="store_true", help="print metrics only")
    parser.add_argument("--golden", type=Path, default=Path(__file__).parent / "golden.jsonl",
                        help="golden set, for its must_include key facts")
    args = parser.parse_args()

    if not args.results.exists():
        fail(f"no results file at {args.results}")
    payload = json.loads(args.results.read_text(encoding="utf-8"))
    run = payload.get("run", {})
    records = payload.get("questions", [])
    mode = run.get("mode", "full")

    if not args.no_markdown:
        markdown = args.results.with_suffix(".md")
        markdown.write_text(_markdown(run, records), encoding="utf-8")
        say(f"Wrote {markdown}")
        say()

    _print_metrics(run, records, mode)

    must_include: dict[str, list[str]] = {}
    if args.golden.exists():
        try:
            must_include = {q.id: q.must_include for q in load(args.golden) if q.must_include}
        except GoldenError as exc:
            say(f"(golden set unreadable, key facts skipped: {exc})")
    metrics = compute(run, records, must_include)
    _print_extended(metrics)
    sidecar = args.results.with_suffix(".metrics.json")
    sidecar.write_text(json.dumps(metrics, indent=2) + "\n", encoding="utf-8")
    say()
    say(f"Wrote {sidecar}")
    return 0


def _pct_ci(entry: dict | None) -> str:
    if not entry or not entry.get("n"):
        return "n/a"
    low, high = entry["ci95"]
    return f"{entry['hits']}/{entry['n']}  ({100 * entry['rate']:.0f}%, 95% CI {100 * low:.0f}-{100 * high:.0f}%)"


def _print_extended(m: dict) -> None:
    say()
    say("=" * 64)
    say("Extended metrics")
    say("=" * 64)
    r = m["retrieval"]
    say("Retrieval (rank of the expected passage after rerank and MMR)")
    for k in (1, 3, 5):
        say(f"  Recall@{k:<22} {_pct_ci(r[f'recall_at_{k}'])}")
    say(f"  Retrieved at any rank        {_pct_ci(r['recall_any'])}")
    if r.get("rank_unknown"):
        say(f"  Rank unknown, excluded above {r['rank_unknown']}")
    if "citations" not in m:
        return
    c = m["citations"]
    say()
    say("Citations")
    say(f"  Correct passage cited        {_pct_ci(c['correct_passage_cited'])}")
    say(f"  Strict citation precision    {c['strict_precision_mean']}  (extra valid passages count against it)")
    say(f"  Citations per answer         {c['mean_citations_per_answer']}")
    kf = m["key_facts"]
    say()
    say("Key facts (objective completeness, no model, no grader)")
    if kf["questions_with_facts"]:
        say(f"  Every key fact present       {_pct_ci(kf['fully_covered'])}")
        say(f"  Mean coverage                {kf['mean_coverage']}")
        for qid, missing in kf["incomplete"].items():
            say(f"  {qid} missing                {missing}")
    else:
        say("  No must_include facts in the golden set.")
    h = m["human_grading"]
    say()
    say(f"Human grading  graded {h['graded']}, ungraded {h['ungraded']}  "
        f"(correct {h['correct']}, partial {h['partial']}, incorrect {h['incorrect']})")
    conf = m["confidence"]
    say(f"Confidence     right {conf['mean_when_right']} (n={conf['n_right']}), "
        f"wrong {conf['mean_when_wrong']} (n={conf['n_wrong']}), missing {conf['missing_confidence']}")
    if not conf["can_validate_threshold"]:
        say("               No wrong answers with a confidence value, so the review threshold cannot be validated.")
    say()
    say("By question type        n   cited  rank-1  facts complete")
    for kind, v in sorted(m["by_kind"].items()):
        facts = f"{v['facts_complete']}/{v['facts_n']}" if v["facts_n"] else "-"
        say(f"  {kind:<20} {v['n']:>3} {v['cited']:>6} {v['rank_1']:>7}  {facts:>14}")
    say(f"Profiles used  {m['profiles_used']}")
    say()
    say("PRD evaluation targets")
    for t in m["prd_targets"]:
        say(f"  [{t['status'].upper():^14}] {t['target']}")
        say(f"  {'':16} actual: {t['actual']}")


# --- Metrics ---------------------------------------------------------------


def _print_metrics(run: dict, records: list[dict], mode: str) -> None:
    gate = [r for r in records if r.get("answerable_expected", True) and "error" not in r]
    refusals = [r for r in records if not r.get("answerable_expected", True) and "error" not in r]
    errors = [r for r in records if "error" in r]

    say(f"Run:     {mode}  ·  {run.get('started_at', '?')}")
    say(f"Corpus:  {run.get('corpus', {}).get('documents')} documents, "
        f"{run.get('corpus', {}).get('passages')} passages")
    say(f"Scored:  {len(gate)} gate questions, {len(refusals)} refusal questions")
    if errors:
        say(f"Errors:  {len(errors)} question(s) did not complete")
    say()

    say("Retrieval")
    say(f"  Expected passage retrieved   {_rate(gate, lambda r: r['auto_score'].get('expected_chunk_retrieved'))}")
    say(f"  Mean reciprocal rank         {_mean(gate, lambda r: r['auto_score'].get('reciprocal_rank')):.3f}")
    say()

    if mode != "full":
        say("Retrieval-only run: no answers were generated, so G1 is not scored here.")
        say("If the retrieved rate above is poor, fix retrieval before spending generation quota.")
        return

    cited = [r for r in gate if _cited(r)]
    say("Gate G1 — correct passage cited")
    say(f"  Cited correctly              {len(cited)}/{len(gate)}  "
        f"(auto {sum(1 for r in gate if r['auto_score'].get('expected_chunk_cited'))}, "
        f"+{sum(1 for r in gate if _override(r))} accepted on review)")
    if len(gate) == GATE_TOTAL:
        verdict = "PASS" if len(cited) >= GATE_REQUIRED else "FAIL"
        say(f"  G1 ({GATE_REQUIRED} of {GATE_TOTAL})              {verdict}")
    else:
        say(f"  G1 is defined over {GATE_TOTAL} questions; this run scored {len(gate)}.")
    say(f"  Correct passage cited first  {_rate(gate, lambda r: r['auto_score'].get('cited_position_of_expected') == 1)}")
    say()

    say("Answer quality")
    say(f"  Groundedness passed          {_rate(gate, lambda r: r['result'].get('grounded'))}")
    graded = [r for r in gate if r["grading"].get("answer_correct") is not None]
    if graded:
        correct = sum(1 for r in graded if r["grading"]["answer_correct"] is True)
        partial = sum(1 for r in graded if r["grading"]["answer_correct"] == "partial")
        say(f"  Answer correct (graded)      {correct}/{len(graded)}  ({partial} partial)")
    say(f"  Ungraded                     {len(gate) - len(graded)}/{len(gate)}")
    if refusals:
        correct_refusals = sum(1 for r in refusals if r["auto_score"].get("refusal_correct"))
        say(f"  Correct refusals             {correct_refusals}/{len(refusals)}")
    over = sum(1 for r in gate if r["auto_score"].get("refused"))
    say(f"  Refused an answerable question {over}/{len(gate)}")
    say()

    say("Operational")
    models: dict[str, int] = {}
    for record in gate + refusals:
        models[record["result"].get("model", "?")] = models.get(record["result"].get("model", "?"), 0) + 1
    for model, count in sorted(models.items(), key=lambda kv: -kv[1]):
        say(f"  {model:<28} {count}")
    fallbacks = sum(1 for r in gate if r["auto_score"].get("answered_by_fallback_model"))
    latencies = sorted((r["result"].get("latency_ms") or 0) / 1000 for r in gate + refusals)
    if latencies:
        say(f"  Latency p50 / p95            {_pct(latencies, 50):.1f}s / {_pct(latencies, 95):.1f}s")
    say(f"  Retried retrieval            {_rate(gate, lambda r: (r['result'].get('attempts') or 1) > 1)}")
    say()

    say("Confidence (uncalibrated)")
    right = [r["result"]["confidence"] for r in gate if _cited(r) and r["result"].get("confidence") is not None]
    wrong = [r["result"]["confidence"] for r in gate if not _cited(r) and r["result"].get("confidence") is not None]
    if right:
        say(f"  Mean when correct            {sum(right) / len(right):.3f}  (n={len(right)})")
    if wrong:
        say(f"  Mean when wrong              {sum(wrong) / len(wrong):.3f}  (n={len(wrong)})")
    if right and wrong:
        say(f"  Separation                   {sum(right) / len(right) - sum(wrong) / len(wrong):+.3f}")

    if fallbacks:
        say()
        say(f"WARNING: {fallbacks} gate question(s) were answered by a fallback model, not "
            f"{run.get('configured_answer_model')}.")
        say("Per D-031 this run is not a fair measure of the answer model. Re-run those questions")
        say("with --only once quota resets, or use a paid key.")


def _cited(record: dict) -> bool:
    override = _override(record)
    if record["grading"].get("citation_acceptable") is False:
        return False
    return bool(record["auto_score"].get("expected_chunk_cited")) or override


def _override(record: dict) -> bool:
    return (
        record["grading"].get("citation_acceptable") is True
        and not record["auto_score"].get("expected_chunk_cited")
    )


def _rate(records: list[dict], predicate) -> str:
    if not records:
        return "n/a"
    hits = sum(1 for r in records if predicate(r))
    return f"{hits}/{len(records)}  ({100 * hits / len(records):.0f}%)"


def _mean(records: list[dict], pick) -> float:
    values = [pick(r) or 0.0 for r in records]
    return sum(values) / len(values) if values else 0.0


def _pct(sorted_values: list[float], percentile: int) -> float:
    if not sorted_values:
        return 0.0
    index = min(len(sorted_values) - 1, int(round((percentile / 100) * (len(sorted_values) - 1))))
    return sorted_values[index]


# --- The grading view ------------------------------------------------------


def _markdown(run: dict, records: list[dict]) -> str:
    out: list[str] = []
    out.append("# Golden set run\n")
    out.append(f"- Mode: `{run.get('mode')}`")
    out.append(f"- Started: {run.get('started_at')}")
    out.append(f"- Workspace: {run.get('workspace_name')}")
    out.append(f"- Corpus: {run.get('corpus', {}).get('documents')} documents, "
               f"{run.get('corpus', {}).get('passages')} passages")
    out.append(f"- Answer model configured: `{run.get('configured_answer_model')}`\n")
    out.append("Fill in `grading` in the JSON file: `answer_correct` as `true`, `false` or `\"partial\"`, "
               "and `citation_acceptable` as `true` only when the model cited a different passage that genuinely "
               "supports the answer.\n")
    out.append("---\n")

    for record in records:
        auto = record.get("auto_score", {})
        result = record.get("result", {})
        out.append(f"## {record['id']} · {record['kind']} · `{record['profile']}`\n")
        out.append(f"**Q.** {record['question']}\n")

        if "error" in record:
            out.append(f"> Did not complete: {record['error']}\n")
            continue

        expected = record.get("expected", {})
        if record.get("answerable_expected", True):
            out.append(f"**Expected passage.** {expected.get('document') or 'any document'}, "
                       f"passage {', '.join(str(i) for i in expected.get('chunk_indexes', [])) or '?'}")
            out.append(f"> {expected.get('quote')}\n")
            if expected.get("expected_answer"):
                out.append(f"**Expected answer.** {expected['expected_answer']}\n")
        else:
            out.append("**Expected.** A refusal: the corpus does not answer this.\n")

        if "answer" not in result:  # retrieval-only
            out.append(f"**Retrieved** ({auto.get('retrieved_count')} passages), "
                       f"expected at rank **{auto.get('rank_of_expected') or 'not retrieved'}**\n")
            for chunk in result.get("retrieved", [])[:5]:
                out.append(f"{chunk['rank']}. `{chunk['file_name']}` "
                           f"{chunk.get('section') or ''} (score {chunk.get('rerank_score')})")
                out.append(f"   > {_flatten(chunk.get('excerpt', ''))}\n")
            out.append("---\n")
            continue

        out.append(f"**Answer** ({result.get('model')}, {(result.get('latency_ms') or 0) / 1000:.1f}s)\n")
        out.append(f"{result.get('answer')}\n")

        citations = result.get("citations", [])
        if citations:
            out.append(f"**Cited {len(citations)} passage(s):**\n")
            for citation in citations:
                mark = " ← expected" if citation["chunk_id"] in expected.get("chunk_ids", []) else ""
                out.append(f"- **[{citation['ordinal']}]** `{citation['file_name']}` "
                           f"{citation.get('section') or ''} chars {citation['char_start']}–{citation['char_end']}{mark}")
                out.append(f"  > {_flatten(citation.get('excerpt', ''))}\n")
        else:
            out.append("**No citations.**\n")

        verdict = "correct passage cited" if auto.get("expected_chunk_cited") else "expected passage NOT cited"
        out.append(f"**Auto:** {verdict} · retrieved at rank {auto.get('rank_of_expected') or '—'} · "
                   f"confidence {result.get('confidence')} (uncalibrated) · "
                   f"grounded {result.get('grounded')} · flagged {result.get('flagged')}"
                   + (f" ({', '.join(result.get('flag_reasons', []))})" if result.get("flagged") else ""))
        if auto.get("answered_by_fallback_model"):
            out.append(f"\n**Note:** answered by `{result.get('model')}`, a fallback, not the configured answer model.")
        out.append("\n---\n")

    return "\n".join(out)


def _flatten(text: str) -> str:
    return " ".join(text.split())


if __name__ == "__main__":
    raise SystemExit(main())
