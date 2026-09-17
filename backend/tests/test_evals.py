"""The eval harness's offline logic: loading a golden set, resolving a quote to
a passage, and scoring a run. None of it touches Supabase or a model."""

from __future__ import annotations

import json

import pytest

from evals import corpus as corpus_mod
from evals import report
from evals.golden import GoldenError, find_quote, load

TEXT = (
    "Meridian answers from workspace documents.\n\n"
    "The gateway waits as long as the provider asks, up to five attempts.\n"
    "A daily quota error fails at once.\n\n"
    "Unrelated closing section about deployment.\n"
)


def _corpus(text: str = TEXT, boundary: int | None = None):
    """One document, split into two passages at `boundary` (default: halfway)."""
    split = boundary if boundary is not None else len(text) // 2
    chunks = [
        corpus_mod.Chunk("c1", "d1", 0, 0, split, "Intro", 1, text[:split]),
        corpus_mod.Chunk("c2", "d1", 1, split, len(text), "Rest", 2, text[split:]),
    ]
    document = corpus_mod.Document("d1", "runbook.docx", "ready", len(chunks), len(chunks), text, chunks)
    return corpus_mod.Corpus("ws", [document])


def _question(**overrides):
    raw = {
        "id": "G-01",
        "question": "How long does the gateway wait?",
        "document": "runbook.docx",
        "expected_quote": "waits as long as the provider asks",
        "expected_answer": "As long as the provider asks, up to five attempts.",
    }
    raw.update(overrides)
    return raw


def _load_one(tmp_path, raw):
    path = tmp_path / "golden.jsonl"
    path.write_text(json.dumps(raw) + "\n", encoding="utf-8")
    return load(path)[0]


# --- Loading ---------------------------------------------------------------


def test_answerable_question_needs_a_quote(tmp_path):
    with pytest.raises(GoldenError, match="expected_quote"):
        _load_one(tmp_path, _question(expected_quote=None))


def test_unanswerable_question_must_not_carry_a_quote(tmp_path):
    with pytest.raises(GoldenError, match="unanswerable"):
        _load_one(tmp_path, _question(answerable=False))


def test_unanswerable_question_is_not_scored_for_the_gate(tmp_path):
    question = _load_one(tmp_path, _question(answerable=False, expected_quote=None))
    assert question.scored_for_gate is False


def test_repeated_ids_are_rejected(tmp_path):
    path = tmp_path / "golden.jsonl"
    path.write_text(json.dumps(_question()) + "\n" + json.dumps(_question()) + "\n", encoding="utf-8")
    with pytest.raises(GoldenError, match="repeats the id"):
        load(path)


def test_unknown_profile_is_rejected(tmp_path):
    with pytest.raises(GoldenError, match="profile"):
        _load_one(tmp_path, _question(profile="deep"))


# --- Quote matching --------------------------------------------------------


def test_quote_matches_across_reflowed_whitespace():
    matches = find_quote(TEXT, "waits as long as\n   the provider   asks")
    assert len(matches) == 1
    assert TEXT[matches[0].char_start : matches[0].char_end] == "waits as long as the provider asks"


def test_quote_matches_through_curly_punctuation_and_case():
    text = "The report says “five attempts” and no more."
    matches = find_quote(text, '"FIVE ATTEMPTS"')
    assert len(matches) == 1


def test_offsets_are_exact_so_they_land_in_the_right_passage():
    matches = find_quote(TEXT, "up to five attempts")
    assert TEXT[matches[0].char_start : matches[0].char_end] == "up to five attempts"


def test_a_quote_absent_from_the_text_finds_nothing():
    assert find_quote(TEXT, "a sentence that is not there") == []


# --- Resolving against the corpus ------------------------------------------


def test_quote_resolves_to_the_passage_that_contains_it(tmp_path):
    resolved = corpus_mod.resolve(_corpus(), _load_one(tmp_path, _question()))
    assert resolved.ok
    assert resolved.expected_chunk_ids == ["c1"]


def test_a_missing_quote_is_reported_rather_than_guessed(tmp_path):
    question = _load_one(tmp_path, _question(expected_quote="cancels the request immediately"))
    resolved = corpus_mod.resolve(_corpus(), question)
    assert not resolved.ok
    assert "not found" in resolved.problem


def test_a_quote_straddling_a_passage_boundary_accepts_both_passages_with_a_warning(tmp_path):
    # Split the document mid-quote, so no single passage contains it. A person
    # copying a quote cannot see chunk boundaries, so both sides count (D-043).
    boundary = TEXT.index("waits as long as") + 5
    resolved = corpus_mod.resolve(_corpus(boundary=boundary), _load_one(tmp_path, _question()))
    assert resolved.ok
    assert set(resolved.expected_chunk_ids) == {"c1", "c2"}
    assert "spans passages 0, 1" in resolved.warnings[0]


def test_an_unknown_document_name_lists_what_is_available(tmp_path):
    question = _load_one(tmp_path, _question(document="missing.pdf"))
    resolved = corpus_mod.resolve(_corpus(), question)
    assert not resolved.ok
    assert "runbook.docx" in resolved.problem


def test_a_document_that_is_not_ready_is_refused(tmp_path):
    corpus = _corpus()
    corpus.documents[0].parsed_status = "processing"
    resolved = corpus_mod.resolve(corpus, _load_one(tmp_path, _question()))
    assert not resolved.ok
    assert "not ready" in resolved.problem


def test_also_acceptable_quotes_add_further_valid_passages(tmp_path):
    question = _load_one(tmp_path, _question(also_acceptable=["Unrelated closing section"]))
    resolved = corpus_mod.resolve(_corpus(), question)
    assert set(resolved.expected_chunk_ids) == {"c1", "c2"}


# --- Scoring ---------------------------------------------------------------


def _record(cited: bool, *, acceptable=None):
    return {
        "answerable_expected": True,
        "auto_score": {"expected_chunk_cited": cited},
        "grading": {"citation_acceptable": acceptable},
    }


def test_a_reviewer_can_accept_a_different_but_valid_passage():
    assert report._cited(_record(False, acceptable=True)) is True


def test_a_reviewer_can_reject_a_passage_the_auto_score_accepted():
    assert report._cited(_record(True, acceptable=False)) is False


def test_an_ungraded_record_falls_back_to_the_auto_score():
    assert report._cited(_record(True)) is True
    assert report._cited(_record(False)) is False


def test_an_alternate_quote_is_found_in_another_document(tmp_path):
    """A fact stated in two documents is citable from either, so alternates are
    searched across the corpus rather than only in the document the question names."""
    corpus = _corpus()
    other_text = "A second document repeats it: the gateway waits up to five attempts before failing."
    corpus.documents.append(
        corpus_mod.Document(
            "d2", "summary.docx", "ready", 1, 1, other_text,
            [corpus_mod.Chunk("c3", "d2", 0, 0, len(other_text), "Summary", 1, other_text)],
        )
    )
    question = _load_one(tmp_path, _question(also_acceptable=["waits up to five attempts before failing"]))
    resolved = corpus_mod.resolve(corpus, question)
    assert resolved.ok
    assert set(resolved.expected_chunk_ids) == {"c1", "c3"}


# --- Extended metrics ------------------------------------------------------

from evals import metrics  # noqa: E402


def test_wilson_interval_is_wide_for_a_small_sample():
    low, high = metrics.wilson(15, 15)
    assert high == 1.0
    assert low < 0.85  # 15/15 does not mean "certainly 100%"


def test_a_key_fact_must_match_as_a_whole_token():
    assert metrics.fact_present("It has 5 workstations.", "5")
    assert not metrics.fact_present("It has 15 workstations.", "5")
    assert not metrics.fact_present("Firmware 11.8 is current.", "1.8")


def test_key_facts_fold_hyphens_case_and_curly_quotes():
    assert metrics.fact_present("It buffers a 96 hour design capacity", "96-hour")
    assert metrics.fact_present("POWER-CYCLE the gateway", "power-cycle")
    assert metrics.fact_present("DT3 gives 2 weeks’ notice", "2 weeks")


def test_missing_key_facts_are_named():
    coverage = metrics.key_fact_coverage("Paid on the 7th via timecard.", ["7th", "timecard", "100,000"])
    assert coverage["missing"] == ["100,000"]
    assert coverage["present"] == 2


def _full_record(qid, *, rank=1, cited=True, grounded=True, flagged=False, unknown=False):
    score = {"expected_chunk_cited": cited, "rank_of_expected": rank, "expected_chunk_retrieved": rank is not None or unknown}
    if unknown:
        score.update(rank_unknown=True, rank_of_expected=None)
    return {
        "id": qid, "kind": "single_passage", "profile": "lookup", "answerable_expected": True,
        "expected": {"chunk_ids": ["e"]},
        "result": {"answer": "x", "citations": [{"chunk_id": "e"}], "grounded": grounded, "flagged": flagged,
                   "confidence": 0.9, "latency_ms": 1000, "model": "m", "attempts": 1, "reranked": True},
        "auto_score": score,
        "grading": {"answer_correct": None, "citation_acceptable": None},
    }


def test_an_unknown_rank_is_excluded_from_recall_not_counted_as_a_miss():
    records = [_full_record("G-01"), _full_record("U-01", unknown=True)]
    m = metrics.compute({"mode": "full"}, records)
    assert m["retrieval"]["recall_at_1"]["n"] == 1
    assert m["retrieval"]["recall_at_1"]["hits"] == 1
    assert m["retrieval"]["rank_unknown"] == ["U-01"]


def test_the_flagging_rule_is_not_exercised_when_nothing_was_ungrounded():
    m = metrics.compute({"mode": "full"}, [_full_record("G-01")])
    rule = next(t for t in m["prd_targets"] if "ungrounded" in t["target"])
    assert rule["status"] == "not exercised"


def test_an_ungrounded_answer_that_was_not_flagged_fails_the_rule():
    m = metrics.compute({"mode": "full"}, [_full_record("G-01", grounded=False, flagged=False)])
    rule = next(t for t in m["prd_targets"] if "ungrounded" in t["target"])
    assert rule["status"] == "fail"


def test_quotes_match_through_table_cell_line_breaks_and_zero_width_characters():
    """Extracted table cells carry "<br>" and some documents carry invisible characters;
    a person copying the same text sees neither (D-043)."""
    text = "|**Task 1**<br>Collected a large dataset<br>from which a diverse<br>subset of at least 15,000|\nparameter\u200b store"
    assert find_quote(text, "Collected a large dataset from which a diverse subset of at least 15,000")
    assert find_quote(text, "parameter store")
    match = find_quote(text, "subset of at least 15,000")[0]
    assert text[match.char_start:match.char_end] == "subset of at least 15,000"


def test_a_second_required_quote_makes_its_own_group(tmp_path):
    question = _load_one(tmp_path, _question(also_required=["Unrelated closing section"]))
    resolved = corpus_mod.resolve(_corpus(), question)
    assert resolved.ok
    assert resolved.required_groups == [["c1"], ["c2"]]


def test_a_distractor_is_recorded_separately_from_the_answer(tmp_path):
    question = _load_one(tmp_path, _question(distractor_quotes=["Unrelated closing section"]))
    resolved = corpus_mod.resolve(_corpus(), question)
    assert resolved.distractor_chunk_ids == ["c2"]
    assert resolved.expected_chunk_ids == ["c1"]


def test_document_names_match_despite_underscores_and_spaces(tmp_path):
    corpus = _corpus()
    corpus.documents[0].file_name = "SLT PowerProx solution architecture.docx"
    assert corpus.find_document("SLT_PowerProx_solution_architecture.docx") is corpus.documents[0]


def test_a_key_fact_accepts_any_listed_alternative():
    assert metrics.fact_present("a 51% improvement", "51.3%|51%")
    assert not metrics.fact_present("a 15% improvement", "51.3%|51%")


def test_an_answerable_behaviour_case_is_left_out_of_the_gate(tmp_path):
    question = _load_one(tmp_path, _question(gate=False))
    assert question.answerable and not question.scored_for_gate


@pytest.mark.anyio
async def test_agent_mode_scores_routing_citations_traps_and_must_not_terms(monkeypatch, tmp_path):
    """The whole evals.run agent path, with a scripted model and faked retrieval (D-043)."""
    from app.agent import loop as loop_module
    from evals import run as run_module
    from tests.test_agent import FakeDb, ScriptedGateway, _chunk, _script_documents, call, make_ctx, respond

    chunk = _chunk("The CNN model reached 94% accuracy.")
    answer_gateway = ScriptedGateway([
        {"answerable": True, "sentences": [{"text": "It reached 94% accuracy, not AES.", "sources": [1]}]},
        {"grounded": True, "unsupported": []},
    ])
    _script_documents(monkeypatch, chunk, answer_gateway)
    agent_gateway = ScriptedGateway([call("lookup_fact", question="How accurate is the CNN?"), respond("See below.")])
    monkeypatch.setattr(loop_module, "get_gateway", lambda: agent_gateway)

    question = _load_one(tmp_path, _question(id="Q01", question="How accurate is the CNN?", expected_tools=["lookup_fact"],
                                             must_not_include=["AES"]))
    expected = corpus_mod.Resolved(question=question, document=None, expected_chunk_ids=["c1"], expected_chunk_indexes=[0],
                                   required_groups=[["c1"], ["c9"]], distractor_chunk_ids=[])
    db = FakeDb()
    record = await run_module._agent(db, make_ctx("x").workspace, question, expected, answer_model="fake-model")

    score = record["auto_score"]
    assert score["document_tool_chosen"] == "lookup_fact" and score["routing_ok"] is True
    assert score["expected_chunk_retrieved"] and score["rank_of_expected"] == 1
    assert score["expected_chunk_cited"] is True
    assert score["required_groups_cited"] == 1 and score["all_required_cited"] is False
    assert score["must_not_include_violations"] == ["AES"]
    assert record["result"]["checked_answers"][0]["citations"][0]["chunk_id"] == "c1"
    assert record["result"]["latency_ms"] >= 0 and record["grading"]["answer_correct"] is None
