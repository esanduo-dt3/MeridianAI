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


def test_a_quote_straddling_a_passage_boundary_is_reported(tmp_path):
    # Split the document mid-quote, so no single passage contains it.
    boundary = TEXT.index("waits as long as") + 5
    resolved = corpus_mod.resolve(_corpus(boundary=boundary), _load_one(tmp_path, _question()))
    assert not resolved.ok
    assert "spans a passage boundary" in resolved.problem


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
