"""Admin surfaces: who may reach them, and the pipeline health arithmetic."""

from __future__ import annotations

from datetime import date

import pytest

from app.admin.health import summarise

TODAY = date(2026, 9, 16)


def run(day: str, *, grade="good", retry=0, latency=4000, top=0.8, reranked=True, profile="lookup"):
    return {"created_at": f"{day}T10:00:00+00:00", "grade_outcome": grade, "retry_count": retry,
            "latency_ms": latency, "top_score": top if reranked else None, "profile": profile,
            "rerank_scores_json": [{"chunk_id": "c", "rerank_score": top if reranked else None}]}


def answer(day: str, *, grounded=True, flagged=False, reasons=(), model="gemini-3.5-flash"):
    return {"created_at": f"{day}T10:00:05+00:00", "groundedness_pass": grounded, "flagged": flagged,
            "flag_reasons": list(reasons), "model": model}


def test_rates_are_counts_over_counts_in_the_window():
    runs = [run("2026-09-16"), run("2026-09-16", grade="weak", retry=1, latency=12000),
            run("2026-09-15", reranked=False, latency=9000), run("2026-08-01")]
    answers = [answer("2026-09-16"), answer("2026-09-16", grounded=False, flagged=True, reasons=["groundedness_failed"]),
               answer("2026-09-15", model=None), answer("2026-08-01", flagged=True)]
    h = summarise(runs, answers, today=TODAY, days=7)

    assert h["questions"] == 3  # the August run is outside the window
    assert h["retrieval_graded_good"] == {"hits": 2, "n": 3, "rate": 0.6667}
    assert h["groundedness_passed"] == {"hits": 2, "n": 3, "rate": 0.6667}
    assert h["flagged"]["hits"] == 1
    assert h["retried"]["hits"] == 1
    assert h["rerank_unavailable"]["hits"] == 1
    assert h["latency_ms"]["p50"] == 9000
    assert h["flag_reasons"] == {"groundedness_failed": 1}
    assert h["models"] == {"gemini-3.5-flash": 2, "not recorded": 1}


def test_an_empty_window_reports_nothing_rather_than_zero():
    h = summarise([], [], today=TODAY, days=7)
    assert h["retrieval_graded_good"]["rate"] is None
    assert h["latency_ms"]["p50"] is None
    assert len(h["by_day"]) == 7
    assert all(d["questions"] == 0 and d["graded_good"]["rate"] is None for d in h["by_day"])


def test_daily_series_puts_each_run_on_its_own_day():
    h = summarise([run("2026-09-14"), run("2026-09-16"), run("2026-09-16")], [], today=TODAY, days=3)
    assert [(d["date"], d["questions"]) for d in h["by_day"]] == [("2026-09-14", 1), ("2026-09-15", 0), ("2026-09-16", 2)]


@pytest.mark.parametrize("method, path", [
    ("get", "/admin/review"),
    ("post", "/admin/review/answers/00000000-0000-0000-0000-000000000001"),
    ("get", "/admin/audit"),
    ("get", "/admin/pipeline-health"),
])
def test_members_are_refused_before_the_database_is_touched(client, as_member, method, path):
    kwargs = {"json": {"decision": "confirmed"}} if method == "post" else {}
    response = getattr(client, method)(path, **kwargs)
    assert response.status_code == 403


def test_a_correction_decision_is_validated_before_reaching_the_database(client, as_admin):
    response = client.post("/admin/review/answers/x", json={"decision": "approved"})
    assert response.status_code == 422
