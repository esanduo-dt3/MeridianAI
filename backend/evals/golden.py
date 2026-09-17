"""The golden set: loading it, and resolving each expected quote to a passage.

A golden question names the passage it expects by a verbatim quote, never by a
chunk id. Chunk ids are regenerated on every reprocess (D-034), so a set keyed
on them would rot the first time the corpus is re-ingested. Resolution happens
at run time against the stored document text, and costs no model calls.
"""

from __future__ import annotations

import json
import re
import unicodedata
from dataclasses import dataclass, field
from pathlib import Path

VALID_PROFILES = {"lookup", "explore", "summarize"}
VALID_KINDS = {
    # The first golden set (D-036).
    "single_passage", "multi_hop", "cross_doc", "table", "unanswerable",
    # The real-document set's case types (D-043).
    "paraphrased_lookup", "exact_term", "multi_passage", "lookalike_trap", "conflicting_versions", "summary",
    "vague_wording", "false_premise", "groundedness_trap", "out_of_scope",
}
VALID_TOOLS = {"lookup_fact", "explore_documents", "summarize_documents", "none"}


class GoldenError(Exception):
    """The dataset is unusable as written. Raised before any model call is made."""


@dataclass(frozen=True)
class GoldenQuestion:
    id: str
    question: str
    profile: str
    kind: str
    document: str | None
    expected_quote: str | None
    also_acceptable: list[str]
    expected_answer: str
    answerable: bool
    notes: str
    must_include: list[str] = field(default_factory=list)
    # Further passages that must ALSO be cited: the answer needs several (D-043).
    also_required: list[str] = field(default_factory=list)
    # A passage that looks right but is the trap; citing it is recorded.
    distractor_quotes: list[str] = field(default_factory=list)
    # Terms a correct answer must not contain, e.g. an invented algorithm.
    must_not_include: list[str] = field(default_factory=list)
    # Documents the answer draws on; several for a cross-document question.
    documents: list[str] = field(default_factory=list)
    # The document tools a well-routed agent may choose ("none" for no tool).
    expected_tools: list[str] = field(default_factory=list)
    type_label: str = ""
    gate: bool | None = None

    @property
    def scored_for_gate(self) -> bool:
        """G1 counts citations, so a behaviour case such as a false premise can opt out even when answerable."""
        return self.answerable if self.gate is None else self.gate and self.answerable


def load(path: Path) -> list[GoldenQuestion]:
    if not path.exists():
        raise GoldenError(f"No golden set at {path}")

    questions: list[GoldenQuestion] = []
    seen: set[str] = set()
    for number, line in enumerate(path.read_text(encoding="utf-8").splitlines(), start=1):
        line = line.strip()
        if not line or line.startswith("//"):
            continue
        try:
            raw = json.loads(line)
        except ValueError as exc:
            raise GoldenError(f"{path}:{number} is not valid JSON: {exc}") from exc

        question = _one(raw, path, number)
        if question.id in seen:
            raise GoldenError(f"{path}:{number} repeats the id {question.id!r}")
        seen.add(question.id)
        questions.append(question)

    if not questions:
        raise GoldenError(f"{path} has no questions")
    return questions


def _one(raw: dict, path: Path, number: int) -> GoldenQuestion:
    def require(key: str) -> str:
        value = raw.get(key)
        if not isinstance(value, str) or not value.strip():
            raise GoldenError(f"{path}:{number} needs a non-empty {key!r}")
        return value.strip()

    identifier = require("id")
    profile = raw.get("profile", "lookup")
    if profile not in VALID_PROFILES:
        raise GoldenError(f"{path}:{number} ({identifier}) has profile {profile!r}, not one of {sorted(VALID_PROFILES)}")

    kind = raw.get("kind", "single_passage")
    if kind not in VALID_KINDS:
        raise GoldenError(f"{path}:{number} ({identifier}) has kind {kind!r}, not one of {sorted(VALID_KINDS)}")

    answerable = bool(raw.get("answerable", True))
    quote = raw.get("expected_quote")
    document = raw.get("document")
    if answerable and not (isinstance(quote, str) and quote.strip()):
        raise GoldenError(
            f"{path}:{number} ({identifier}) is answerable, so it needs an 'expected_quote' naming the passage "
            "that must be cited"
        )
    if not answerable and quote:
        raise GoldenError(
            f"{path}:{number} ({identifier}) is marked unanswerable but carries an expected_quote. An unanswerable "
            "question has no correct passage; drop the quote or set answerable to true."
        )

    tools = [t for t in raw.get("expected_tools", []) if isinstance(t, str)]
    unknown_tools = set(tools) - VALID_TOOLS
    if unknown_tools:
        raise GoldenError(f"{path}:{number} ({identifier}) has unknown expected_tools {sorted(unknown_tools)}")

    def strings(key: str) -> list[str]:
        return [v.strip() for v in raw.get(key, []) if isinstance(v, str) and v.strip()]

    documents = strings("documents") or ([document.strip()] if isinstance(document, str) and document.strip() else [])

    return GoldenQuestion(
        id=identifier,
        question=require("question"),
        profile=profile,
        kind=kind,
        document=documents[0] if documents else None,
        expected_quote=quote.strip() if isinstance(quote, str) else None,
        also_acceptable=[q.strip() for q in raw.get("also_acceptable", []) if isinstance(q, str) and q.strip()],
        expected_answer=str(raw.get("expected_answer", "")).strip(),
        answerable=answerable,
        notes=str(raw.get("notes", "")).strip(),
        must_include=strings("must_include"),
        also_required=strings("also_required"),
        distractor_quotes=strings("distractor_quotes"),
        must_not_include=strings("must_not_include"),
        documents=documents,
        expected_tools=tools,
        type_label=str(raw.get("type_label", "")).strip(),
        gate=raw.get("gate") if isinstance(raw.get("gate"), bool) else None,
    )


# --- Resolving a quote to the passages that contain it ---------------------


def _normalise(text: str) -> tuple[str, list[int]]:
    """Fold whitespace and unicode punctuation, keeping a map back to the original offsets.

    A quote is typed or pasted by a person, so its line breaks, double spaces and
    curly quotes rarely match the extracted text exactly. Comparing folded text
    finds the passage anyway, and the offset map turns the match back into the
    real character span the chunk ranges are expressed in.
    """
    folded: list[str] = []
    offsets: list[int] = []
    previous_was_space = True  # strips leading whitespace
    skip_to = 0
    for index, character in enumerate(text):
        if index < skip_to:
            continue
        # Invisible characters are formatting, not words.
        if character in _ZERO_WIDTH:
            continue
        # A line break inside an extracted table cell is written "<br>"; a person
        # copying the cell sees a space.
        br = _BR.match(text, index)
        if br:
            skip_to = br.end()
            character = " "
        # Table cells are extracted as "| a | b |"; a person copying a row types
        # "a b", so a pipe counts as a space (D-043).
        if character.isspace() or character == "|":
            if previous_was_space:
                continue
            folded.append(" ")
            offsets.append(index)
            previous_was_space = True
            continue
        previous_was_space = False
        for piece in _fold_char(character):
            folded.append(piece)
            offsets.append(index)
    return "".join(folded).rstrip(), offsets


_PUNCTUATION = {
    "‘": "'", "’": "'", "‚": "'", "‛": "'",
    "“": '"', "”": '"', "„": '"',
    "‐": "-", "‑": "-", "‒": "-", "–": "-", "—": "-", "−": "-",
    " ": " ",
    "→": "->", "⟶": "->", "➔": "->",
    "…": "...",
}


_ZERO_WIDTH = {"\u200b", "\u200c", "\u200d", "\u2060", "\ufeff"}
_BR = re.compile(r"<br\s*/?>", re.IGNORECASE)


def _fold_char(character: str) -> str:
    replacement = _PUNCTUATION.get(character)
    if replacement is not None:
        return replacement
    return unicodedata.normalize("NFKC", character).casefold()


@dataclass
class QuoteMatch:
    char_start: int
    char_end: int
    chunk_ids: list[str] = field(default_factory=list)
    chunk_indexes: list[int] = field(default_factory=list)


def find_quote(content_text: str, quote: str) -> list[QuoteMatch]:
    """Every place the quote appears in the document, as real character offsets."""
    haystack, offsets = _normalise(content_text)
    needle, _ = _normalise(quote)
    if not needle:
        return []

    matches: list[QuoteMatch] = []
    position = haystack.find(needle)
    while position != -1:
        start = offsets[position]
        last = offsets[position + len(needle) - 1]
        matches.append(QuoteMatch(char_start=start, char_end=last + 1))
        position = haystack.find(needle, position + 1)
    return matches
