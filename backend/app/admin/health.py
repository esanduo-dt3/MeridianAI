"""Pipeline health figures, calculated from recorded runs only (docs/decisions.md D-040).

Nothing here is estimated. Every rate is a count of rows over a count of rows in
the window, returned with both counts so the page can say "7 of 9" rather than
a bare percentage. A figure with no rows behind it is null, never zero.

Definitions, because a dashboard is only honest if its words are:

- **Retrieval graded good**: the retrieval grade recorded on the run was "good"
  (D-030). There is no ground truth in live traffic, so this is the pipeline's
  own verdict, not a measured hit rate. The measured hit rate is Gate G1's
  Recall@k on the golden set.
- **Groundedness passed**: the answer passed the groundedness self-check.
- **Flagged**: the answer was routed to the review queue for any reason.
- **Retried**: retrieval rewrote the query and searched again.
- **Rerank unavailable**: the run found candidates but has no rerank score,
  which means the reranker was down or rate-limited and results fell back to
  fusion order (D-037).
"""

from __future__ import annotations

from collections import Counter
from datetime import date, datetime, timedelta
from typing import Any


def _rate(hits: int, n: int) -> dict[str, Any]:
    return {"hits": hits, "n": n, "rate": round(hits / n, 4) if n else None}


def _percentile(values: list[int], pct: int) -> int | None:
    if not values:
        return None
    ordered = sorted(values)
    return ordered[min(len(ordered) - 1, int(round((pct / 100) * (len(ordered) - 1))))]


def _day(timestamp: str) -> date:
    return datetime.fromisoformat(timestamp.replace("Z", "+00:00")).date()


def summarise(runs: list[dict], answers: list[dict], *, today: date, days: int) -> dict[str, Any]:
    start = today - timedelta(days=days - 1)
    runs = [r for r in runs if _day(r["created_at"]) >= start]
    answers = [a for a in answers if _day(a["created_at"]) >= start]

    def rerank_unavailable(run: dict) -> bool:
        return run.get("top_score") is None and bool(run.get("rerank_scores_json"))

    latencies = [r["latency_ms"] for r in runs if r.get("latency_ms") is not None]
    reasons: Counter[str] = Counter()
    for answer in answers:
        reasons.update(answer.get("flag_reasons") or [])

    by_day = []
    for offset in range(days):
        day = start + timedelta(days=offset)
        day_runs = [r for r in runs if _day(r["created_at"]) == day]
        day_answers = [a for a in answers if _day(a["created_at"]) == day]
        by_day.append({
            "date": day.isoformat(),
            "questions": len(day_runs),
            "graded_good": _rate(sum(r.get("grade_outcome") == "good" for r in day_runs), len(day_runs)),
            "groundedness_passed": _rate(sum(bool(a.get("groundedness_pass")) for a in day_answers), len(day_answers)),
            "flagged": _rate(sum(bool(a.get("flagged")) for a in day_answers), len(day_answers)),
            "latency_p50_ms": _percentile([r["latency_ms"] for r in day_runs if r.get("latency_ms") is not None], 50),
        })

    return {
        "window": {"days": days, "from": start.isoformat(), "to": today.isoformat()},
        "questions": len(runs),
        "answers": len(answers),
        "retrieval_graded_good": _rate(sum(r.get("grade_outcome") == "good" for r in runs), len(runs)),
        "groundedness_passed": _rate(sum(bool(a.get("groundedness_pass")) for a in answers), len(answers)),
        "flagged": _rate(sum(bool(a.get("flagged")) for a in answers), len(answers)),
        "retried": _rate(sum((r.get("retry_count") or 0) > 0 for r in runs), len(runs)),
        "rerank_unavailable": _rate(sum(rerank_unavailable(r) for r in runs), len(runs)),
        "latency_ms": {
            "p50": _percentile(latencies, 50),
            "p95": _percentile(latencies, 95),
            "max": max(latencies) if latencies else None,
            "n": len(latencies),
            "target_p50": 8000,
        },
        "flag_reasons": dict(reasons.most_common()),
        "models": dict(Counter(a.get("model") or "not recorded" for a in answers).most_common()),
        "profiles": dict(Counter(r.get("profile") or "lookup" for r in runs).most_common()),
        "by_day": by_day,
    }
