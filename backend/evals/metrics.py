"""Metrics computed from a results file. Pure functions: no database, no models.

Everything here is derived from runs that already happened, so adding a metric
never spends quota. Each figure states what it measures and, where the sample
is small, how uncertain it is: 15 questions is thin, and a bare "93%" hides
that its 95% interval is roughly 70% to 99%.
"""

from __future__ import annotations

import math
import re
import unicodedata
from typing import Any

# Targets named in Meridian_PRD_v2.pdf, sections 4, 5 and 14.
G1_REQUIRED = 12
G1_TOTAL = 15
LATENCY_P50_TARGET_S = 8.0
RED_TEAM_TARGET = "8 of 8 injection documents caught"


# --- Small statistics -----------------------------------------------------


def wilson(hits: int, n: int, z: float = 1.96) -> tuple[float, float]:
    """95% Wilson score interval for a proportion. Honest at n=15, unlike hits/n alone."""
    if n == 0:
        return (0.0, 0.0)
    p = hits / n
    denominator = 1 + z * z / n
    centre = (p + z * z / (2 * n)) / denominator
    margin = z * math.sqrt(p * (1 - p) / n + z * z / (4 * n * n)) / denominator
    return (max(0.0, centre - margin), min(1.0, centre + margin))


def percentile(values: list[float], pct: int) -> float | None:
    if not values:
        return None
    ordered = sorted(values)
    index = min(len(ordered) - 1, int(round((pct / 100) * (len(ordered) - 1))))
    return ordered[index]


def rate(hits: int, n: int) -> dict[str, Any]:
    low, high = wilson(hits, n)
    return {"hits": hits, "n": n, "rate": round(hits / n, 4) if n else None, "ci95": [round(low, 3), round(high, 3)]}


# --- Key facts ------------------------------------------------------------


def _fold(text: str) -> str:
    text = unicodedata.normalize("NFKC", text).casefold()
    text = re.sub(r"[‘’‚‛]", "'", text)
    text = re.sub(r"[‐-―−-]", " ", text)  # "96-hour" matches "96 hour"
    return re.sub(r"\s+", " ", text).strip()


def fact_present(answer: str, fact: str) -> bool:
    """A key fact appears as a whole token run, so "5" does not match inside "15".

    "51.3%|51%" lists alternatives: any one of them counts (D-043).
    """
    folded = _fold(answer)
    for alternative in fact.split("|"):
        needle = _fold(alternative)
        if needle and re.search(r"(?<![0-9a-z])" + re.escape(needle) + r"(?![0-9a-z])", folded):
            return True
    return False


def key_fact_coverage(answer: str, facts: list[str]) -> dict[str, Any]:
    present = [f for f in facts if fact_present(answer, f)]
    missing = [f for f in facts if f not in present]
    return {
        "facts": len(facts),
        "present": len(present),
        "missing": missing,
        "coverage": round(len(present) / len(facts), 4) if facts else None,
    }


# --- The metrics ----------------------------------------------------------


def _cited(record: dict) -> bool:
    grading = record.get("grading", {})
    if grading.get("citation_acceptable") is False:
        return False
    return bool(record["auto_score"].get("expected_chunk_cited")) or grading.get("citation_acceptable") is True


def compute(run: dict, records: list[dict], must_include: dict[str, list[str]] | None = None,
            red_team: dict[str, Any] | None = None) -> dict[str, Any]:
    must_include = must_include or {}
    done = [r for r in records if "error" not in r]
    # G1 counts the questions marked as gate questions; answerable behaviour cases
    # such as a false premise are reported separately (D-043).
    gate = [r for r in done if r.get("gate", r.get("answerable_expected", True))]
    refusals = [r for r in done if not r.get("answerable_expected", True)]
    behaviour = [r for r in done if r not in gate]
    full = run.get("mode", "full") in ("full", "agent")
    n = len(gate)

    # A rank is unknown when a passage was re-scored after a run that did not keep
    # its retrieved list. Such a question is excluded from Recall@k rather than
    # counted as a miss, and the exclusion is reported.
    known = [r for r in gate if not r["auto_score"].get("rank_unknown")]
    ranks = [r["auto_score"].get("rank_of_expected") for r in known]
    m = len(known)
    retrieval = {
        f"recall_at_{k}": rate(sum(1 for x in ranks if x is not None and x <= k), m) for k in (1, 3, 5)
    }
    retrieval["recall_any"] = rate(sum(1 for r in gate if r["auto_score"].get("expected_chunk_retrieved")), n)
    retrieval["mrr"] = round(sum((1 / x) if x else 0.0 for x in ranks) / m, 4) if m else None
    retrieval["rank_unknown"] = [r["id"] for r in gate if r["auto_score"].get("rank_unknown")]

    out: dict[str, Any] = {"mode": run.get("mode"), "gate_questions": n, "refusal_questions": len(refusals)}
    out["retrieval"] = retrieval
    if not full:
        return out

    # Citations. "Strict" precision counts any extra cited passage as wrong, which
    # undercounts when a second passage is also a legitimate source.
    precisions = []
    for r in gate:
        cited = [c["chunk_id"] for c in r["result"].get("citations", [])]
        expected = set(r["expected"].get("chunk_ids", []))
        if cited:
            precisions.append(sum(1 for c in cited if c in expected) / len(cited))
    cited_ok = sum(1 for r in gate if _cited(r))
    out["citations"] = {
        "correct_passage_cited": rate(cited_ok, n),
        "cited_first": rate(sum(1 for r in gate if r["auto_score"].get("cited_position_of_expected") == 1), n),
        "strict_precision_mean": round(sum(precisions) / len(precisions), 4) if precisions else None,
        "mean_citations_per_answer": round(
            sum(len(r["result"].get("citations", [])) for r in gate) / n, 2) if n else None,
        "overrides_on_review": sum(
            1 for r in gate if r["grading"].get("citation_acceptable") is True
            and not r["auto_score"].get("expected_chunk_cited")),
    }

    # Key facts: an objective completeness check that needs no model and no grader.
    per_question = {}
    for r in gate:
        facts = must_include.get(r["id"], [])
        if facts:
            shown = r["result"].get("answer", "") + "\n" + (r["result"].get("reply") or "")
            per_question[r["id"]] = key_fact_coverage(shown, facts)
    covered = [v for v in per_question.values()]
    out["key_facts"] = {
        "questions_with_facts": len(covered),
        "fully_covered": rate(sum(1 for v in covered if v["present"] == v["facts"]), len(covered)),
        "mean_coverage": round(sum(v["coverage"] for v in covered) / len(covered), 4) if covered else None,
        "incomplete": {qid: v["missing"] for qid, v in per_question.items() if v["missing"]},
    }

    grounded = sum(1 for r in gate if r["result"].get("grounded"))
    flagged_ungrounded = sum(1 for r in gate if not r["result"].get("grounded") and r["result"].get("flagged"))
    refused_ok = sum(1 for r in refusals if r["auto_score"].get("refusal_correct"))
    out["answer_quality"] = {
        "groundedness_passed": rate(grounded, n),
        "ungrounded_answers_flagged": rate(flagged_ungrounded, n - grounded),
        "correct_refusals": rate(refused_ok, len(refusals)),
        "false_refusals": rate(sum(1 for r in gate if r["auto_score"].get("refused")), n),
    }

    grades = [r["grading"].get("answer_correct") for r in gate]
    graded = [g for g in grades if g is not None]
    final = [r["grading"].get("final_grade") for r in gate if r["grading"].get("final_grade") is not None]
    out["human_grading"] = {
        "graded": len(graded),
        "ungraded": n - len(graded),
        "correct": sum(1 for g in graded if g is True),
        "partial": sum(1 for g in graded if g == "partial"),
        "incorrect": sum(1 for g in graded if g is False),
        "answer_correct_rate": rate(sum(1 for g in graded if g is True), len(graded)) if graded else None,
        "final_grade_counts": {str(k): final.count(k) for k in sorted(set(map(str, final)))} if final else {},
    }

    everyone = gate + refusals
    latencies = [(r["result"].get("latency_ms") or 0) / 1000 for r in everyone]
    models: dict[str, int] = {}
    for r in everyone:
        models[r["result"].get("model", "?")] = models.get(r["result"].get("model", "?"), 0) + 1
    out["operational"] = {
        "latency_p50_s": percentile(latencies, 50),
        "latency_p95_s": percentile(latencies, 95),
        "latency_max_s": max(latencies) if latencies else None,
        "models": models,
        "answered_by_fallback": sum(1 for r in everyone if r["auto_score"].get("answered_by_fallback_model")),
        "retried_retrieval": sum(1 for r in gate if (r["result"].get("attempts") or 1) > 1),
        "without_rerank": sum(1 for r in everyone if r["result"].get("reranked") is False),
    }

    # Confidence against the best available truth: a person's grade where one
    # exists, otherwise whether the right passage was cited.
    def truth(r: dict) -> bool:
        g = r["grading"].get("answer_correct")
        return g is True if g is not None else _cited(r)

    right = [r["result"]["confidence"] for r in gate if truth(r) and r["result"].get("confidence") is not None]
    wrong = [r["result"]["confidence"] for r in gate if not truth(r) and r["result"].get("confidence") is not None]
    out["confidence"] = {
        "truth_basis": "human grade where present, else citation",
        "mean_when_right": round(sum(right) / len(right), 3) if right else None,
        "mean_when_wrong": round(sum(wrong) / len(wrong), 3) if wrong else None,
        "n_right": len(right),
        "n_wrong": len(wrong),
        "missing_confidence": sum(1 for r in gate if r["result"].get("confidence") is None),
        "can_validate_threshold": bool(right and wrong),
    }

    by_kind: dict[str, dict[str, Any]] = {}
    for r in gate:
        k = by_kind.setdefault(r.get("kind", "?"), {"n": 0, "cited": 0, "rank_1": 0, "facts_complete": 0, "facts_n": 0})
        k["n"] += 1
        k["cited"] += 1 if _cited(r) else 0
        k["rank_1"] += 1 if r["auto_score"].get("rank_of_expected") == 1 else 0
        if r["id"] in per_question:
            k["facts_n"] += 1
            k["facts_complete"] += 1 if not per_question[r["id"]]["missing"] else 0
    out["by_kind"] = by_kind

    profiles: dict[str, int] = {}
    for r in gate:
        profiles[r.get("profile", "?")] = profiles.get(r.get("profile", "?"), 0) + 1
    out["profiles_used"] = profiles

    if run.get("mode") == "agent":
        routed = [r for r in done if r["auto_score"].get("routing_ok") is not None]
        tools_by_kind: dict[str, dict[str, int]] = {}
        for r in done:
            chosen = r["auto_score"].get("document_tool_chosen", "none")
            tools_by_kind.setdefault(r.get("type_label") or r.get("kind", "?"), {}).setdefault(chosen, 0)
            tools_by_kind[r.get("type_label") or r.get("kind", "?")][chosen] += 1
        with_groups = [r for r in gate if r["auto_score"].get("required_groups")]
        out["agent"] = {
            "routing_accuracy": rate(sum(1 for r in routed if r["auto_score"]["routing_ok"]), len(routed)),
            "routing_misses": {r["id"]: {"chose": r["auto_score"]["document_tool_chosen"], "expected": r.get("expected_tools")}
                               for r in routed if not r["auto_score"]["routing_ok"]},
            "tool_chosen_by_type": tools_by_kind,
            "all_required_passages_cited": rate(sum(1 for r in with_groups if r["auto_score"].get("all_required_cited")), len(with_groups)),
            "required_passage_groups_cited": rate(sum(r["auto_score"].get("required_groups_cited", 0) for r in with_groups),
                                                  sum(r["auto_score"].get("required_groups", 0) for r in with_groups)),
            "cited_a_trap_passage": [r["id"] for r in done if r["auto_score"].get("cited_distractor")],
            "must_not_include_violations": {r["id"]: r["auto_score"]["must_not_include_violations"]
                                            for r in done if r["auto_score"].get("must_not_include_violations")},
            "questions_with_tool_errors": [r["id"] for r in done if r["result"].get("tool_errors")],
            "document_answers_per_question": round(sum(len(r["result"].get("checked_answers", [])) for r in done) / len(done), 2) if done else None,
            "answer_pipeline_latency_p50_s": percentile([ms / 1000 for r in done for ms in r["result"].get("answer_latency_ms", [])], 50),
            "end_to_end_latency_p50_s": percentile([(r["result"].get("latency_ms") or 0) / 1000 for r in done], 50),
            "end_to_end_latency_p95_s": percentile([(r["result"].get("latency_ms") or 0) / 1000 for r in done], 95),
        }

    # Each behaviour case, with the automatic signals a grader needs beside it.
    out["behaviour_cases"] = [
        {
            "id": r["id"],
            "type": r.get("type_label") or r.get("kind"),
            "refused": r["auto_score"].get("refused"),
            "refusal_correct": r["auto_score"].get("refusal_correct"),
            "grounded": r["result"].get("grounded"),
            "flagged": r["result"].get("flagged"),
            "flag_reasons": r["result"].get("flag_reasons"),
            "must_not_include_violations": r["auto_score"].get("must_not_include_violations", []),
            "key_facts": key_fact_coverage(
                r["result"].get("answer", "") + "\n" + (r["result"].get("reply") or ""), must_include.get(r["id"], [])
            ) if must_include.get(r["id"]) else None,
            "expected_behaviour": r["expected"].get("expected_answer"),
        }
        for r in behaviour
    ]

    p50 = out["operational"]["latency_p50_s"]
    original = [r for r in gate if not r["id"].startswith("U-")][:G1_TOTAL]
    strict = out.get("agent", {}).get("all_required_passages_cited")
    g1_hits = sum(1 for r in original if _cited(r))
    out["prd_targets"] = [
        {
            "target": f"Gate G1: at least {G1_REQUIRED} of {G1_TOTAL} golden questions cite the correct chunk",
            "actual": f"{g1_hits} of {len(original)}",
            "status": "pass" if len(original) == G1_TOTAL and g1_hits >= G1_REQUIRED else "not comparable",
        },
        {
            "target": "Stricter than G1: every passage the answer needs is cited",
            "actual": f"{strict['hits']} of {strict['n']}" if strict else "not measured in this mode",
            "status": ("pass" if strict and strict["hits"] == strict["n"] else "partial") if strict else "not run",
        },
        {
            "target": f"Latency p50 under {LATENCY_P50_TARGET_S:g} seconds end to end",
            "actual": f"{p50:.1f}s" if p50 is not None else "n/a",
            "status": "pass" if p50 is not None and p50 < LATENCY_P50_TARGET_S else "fail",
        },
        {
            "target": "Every ungrounded answer is flagged, never shown as confident",
            "actual": f"{flagged_ungrounded} of {n - grounded} ungrounded answers flagged",
            # With no ungrounded answer in the run, the rule was never exercised.
            "status": "not exercised" if n == grounded else ("pass" if flagged_ungrounded == n - grounded else "fail"),
        },
        {
            "target": "Golden set labelled by hand, independently of the model under test",
            "actual": run.get("golden_authorship", "15 written by Claude after reading the corpus; 2 by the owner"),
            "status": run.get("golden_authorship_status", "partial"),
        },
        _red_team_target(red_team),
    ]
    return out


def _red_team_target(red_team: dict[str, Any] | None) -> dict[str, Any]:
    """The PRD's red-team row, from the latest red-team results when there are any (D-044)."""
    target = f"Injection red-team suite: {RED_TEAM_TARGET}"
    if not red_team:
        return {"target": target, "actual": "not run", "status": "not run"}
    summary = red_team.get("summary", {})
    caught = summary.get("caught", {})
    obeyed = summary.get("obeyed", [])
    actual = f"{caught.get('hits')} of {caught.get('n')} caught" + (f"; obeyed: {', '.join(obeyed)}" if obeyed else "")
    source = red_team.get("_source")
    return {
        "target": target,
        "actual": actual + (f" ({source})" if source else ""),
        "status": "pass" if summary.get("prd_target_met") else "fail",
    }
