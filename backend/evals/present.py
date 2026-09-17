"""Build a self-contained HTML report of an evaluation run, for showing to people.

Reads a results file, its metrics (written by evals.report), an optional
retrieval-only baseline and the latest red-team run, and writes one HTML file with
the data embedded: no server, no network requests, no external resources. Rebuild
after re-grading or re-running, so the page never drifts from the data.

    .venv/bin/python -m evals.present \\
        --results evals/results/2026-09-17_2_real-documents/agent-run.json \\
        --baseline evals/results/2026-09-17_2_real-documents/retrieval-only-no-rerank.json
"""

from __future__ import annotations

import argparse
import html
import json
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

from evals._cli import fail, say

TEMPLATE = Path(__file__).parent / "present_template.html"


def _metrics_for(results: Path) -> dict[str, Any]:
    path = results.with_suffix(".metrics.json")
    if not path.exists():
        fail(f"no metrics at {path}; run evals.report on the results file first")
    return json.loads(path.read_text(encoding="utf-8"))


def _latest_red_team(results: Path) -> dict[str, Any] | None:
    root = next((p for p in results.resolve().parents if p.name == "results"), None)
    if root is None:
        return None
    runs = sorted(root.rglob("red-team.json"), key=lambda p: p.stat().st_mtime)
    if not runs:
        return None
    data = json.loads(runs[-1].read_text(encoding="utf-8"))
    return {
        "summary": data.get("summary", {}),
        "cases": [
            {
                "id": c["id"],
                "attack": c["attack"],
                "outcome": c["score"]["outcome"],
                "detected_by_scanner": c["score"]["detected_by_scanner"],
                "reply": c["result"]["reply"],
            }
            for c in data.get("cases", [])
        ],
        "source": str(runs[-1].relative_to(root)),
    }


def _question(q: dict[str, Any]) -> dict[str, Any]:
    """Only what the page shows, so the embedded data stays small and readable."""
    r = q.get("result", {})
    a = q.get("auto_score", {})
    e = q.get("expected", {})
    return {
        "id": q["id"],
        "type": q.get("type_label") or q.get("kind"),
        "gate": q.get("gate", q.get("answerable_expected", True)),
        "expected_refusal": q.get("answerable_expected") is False,
        "question": q["question"],
        "expected_answer": e.get("expected_answer", ""),
        "expected_tools": q.get("expected_tools", []),
        "reply": r.get("reply", ""),
        "answers": [
            {
                "text": ans.get("answer", ""),
                "answerable": ans.get("answerable"),
                "grounded": ans.get("grounded"),
                "flag_reasons": ans.get("flag_reasons", []),
                "model": ans.get("model"),
                "citations": [
                    {k: c.get(k) for k in ("ordinal", "file_name", "section", "page", "excerpt")}
                    for c in ans.get("citations", [])
                ],
            }
            for ans in r.get("checked_answers", [])
        ],
        "tool": a.get("document_tool_chosen"),
        "routing_ok": a.get("routing_ok"),
        "retrieved": a.get("expected_chunk_retrieved"),
        "rank": a.get("rank_of_expected"),
        "required": a.get("required_groups", 0),
        "required_cited": a.get("required_groups_cited", 0),
        "cited": a.get("expected_chunk_cited"),
        "refused": a.get("refused"),
        "fallback": a.get("answered_by_fallback_model"),
        "grounded": r.get("grounded"),
        "flagged": r.get("flagged"),
        "latency_s": round((r.get("latency_ms") or 0) / 1000, 1),
        "grade": q.get("grading", {}).get("answer_correct"),
        "citation_override": q.get("grading", {}).get("citation_acceptable"),
        "grade_notes": q.get("grading", {}).get("notes", ""),
        "facts_missing": None,
    }


def main() -> int:
    parser = argparse.ArgumentParser(description="Build an HTML report of an evaluation run.")
    parser.add_argument("--results", required=True, type=Path)
    parser.add_argument("--baseline", type=Path, help="retrieval-only results for the same set, for comparison")
    parser.add_argument("--title", default="Meridian: real-document evaluation")
    parser.add_argument("--out", type=Path, help="default: report.html beside the results file")
    args = parser.parse_args()

    if not args.results.exists():
        fail(f"no results file at {args.results}")
    results = json.loads(args.results.read_text(encoding="utf-8"))
    metrics = _metrics_for(args.results)
    questions = [_question(q) for q in results["questions"]]
    for q in questions:
        q["facts_missing"] = metrics.get("key_facts", {}).get("incomplete", {}).get(q["id"], [])

    payload = {
        "title": args.title,
        "generated_at": datetime.now(timezone.utc).isoformat(),
        "run": {k: results["run"].get(k) for k in (
            "mode", "started_at", "workspace_name", "corpus", "configured_answer_model", "configured_fast_model",
            "rerank_model", "embed_model", "note", "golden_authorship", "last_graded_at")},
        "metrics": metrics,
        "baseline": _metrics_for(args.baseline).get("retrieval") if args.baseline else None,
        "red_team": _latest_red_team(args.results),
        "questions": questions,
    }
    template = TEMPLATE.read_text(encoding="utf-8")
    # The data goes into a JSON script block; "</" is escaped so no value can close it.
    data = json.dumps(payload, ensure_ascii=False).replace("</", "<\\/")
    page = template.replace("__TITLE__", html.escape(args.title)).replace("__DATA__", data)
    out = args.out or args.results.with_name("report.html")
    out.write_text(page, encoding="utf-8")
    say(f"Wrote {out}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
