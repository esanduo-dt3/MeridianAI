# Pipeline review: what to improve

A review of ingestion, retrieval, answering and the agent as they stand on `dev` on 2026-09-17. Each finding says how it was confirmed, what it costs, and a proposed fix. Nothing here is decided: a fix that is adopted gets a [decisions.md](../decisions.md) entry in the same change.

**How findings were confirmed**

- **Reproduced** — run against the code on this date (commands are given).
- **Measured** — taken from a committed evaluation result.
- **Code reading** — follows directly from the code or schema, not run.

## Priority summary

| # | Finding | Area | Evidence | Effect |
| --- | --- | --- | --- | --- |
| 1 | Two-column PDFs are read as fake tables | Ingestion | Reproduced | Garbled passages, no headings, wrong citations |
| 2 | Short sections are dropped from the index | Ingestion | Reproduced | Facts can never be retrieved |
| 3 | Reprocessing deletes past answers' citations | Data integrity | Code reading | Audit trail loses its evidence |
| 4 | Documents stuck in `processing` after a restart | Ingestion | Code reading | Needs delete and re-upload |
| 5 | End-to-end p50 is 20.2 s against 8 s | Latency | Measured | PRD target missed |
| 6 | Most answers have no confidence and cannot be flagged as low | Answering | Measured | Review queue misses weak answers |
| 7 | Gate thresholds are uncalibrated and the gate is untested | Retrieval | Code reading | Unknown precision of "good" |
| 8 | False refusals on multi-passage and cross-document questions | Answering | Measured | Correct passages retrieved, answer refused |
| 9 | Factual poisoning is obeyed | Safety | Measured | A planted wrong value is stated as fact |
| 10 | Word headings only from styles | Ingestion | Reproduced | No section context |
| 11 | Agent loop cost and format | Agent | Code reading | Extra calls, JSON-in-JSON errors |
| 12 | Single-process state | Operations | Code reading | Cannot scale past one instance |
| 13 | PyMuPDF AGPL on a public service | Licensing | [D-024](../decisions.md#d-024), [D-045](../decisions.md#d-045) | Legal exposure |

---

## 1. Two-column PDFs are read as fake tables

**Evidence (reproduced).** Parsing the 6-page GreenGuard paper: the borderless table fallback (`find_tables(strategy="text")`) accepted a "table" on **4 of 6 pages**. Pages 2 and 3 had **no text lines left** after masking, so the whole page became one Markdown table of word fragments (`|o|of accuracy but|t also ex|`). The parser found **0 headings**, so all 22 passages have an empty section. The same fallback fired on 2–4 pages of three other PDFs (CM4607, SmartSmile, rt-grp-1).

Separately, `_column_split` returns None if **any** line crosses the page middle. On GreenGuard pages 4 and 5, a figure caption and the "Authorized licensed use…" footer did, so even un-masked text is read across both columns ([D-043](../decisions.md#d-043) recorded the symptom).

**Effect.** Q01 on the real set cited a passage whose text is interleaved columns; retrieval still worked by luck of keywords. Any question on a two-column paper is answered from damaged text, and the citation highlights damaged text.

**Proposed fix.**

1. Tighten `_plausible_text_table`: reject when most cells end or start mid-word, when the table covers more than ~50% of the page, or when rows average more than a few words per cell across two wide columns (prose in a gutter layout).
2. Make column detection tolerate full-width lines: ignore lines wider than ~70% of the page when counting, and split the page into vertical bands at full-width lines, reading each band left column then right.
3. Try `page.get_text("blocks", sort=True)` or the `pymupdf_layout` package PyMuPDF now suggests, and compare.
4. Add GreenGuard-like fixtures (two columns + caption + footer) to `test_ingestion.py`, and assert a known sentence survives intact.

Re-run `evals.validate` and the retrieval-only pass after, since passage boundaries change.

## 2. Short sections are dropped from the index

**Evidence (reproduced).**

```python
elements = [heading("Server Migration", 1), para(long_text),
            heading("Database port", 2), para("Port 5432."),
            heading("Rollback", 2), para(long_text)]
chunk_document(...)  # 2 chunks; "5432" appears in none
```

`_merge_small` only merges adjacent text chunks with the **same** `section_path`. A chunk under `HARD_FLOOR_TOKENS` (14, ≈56 characters) with no same-section neighbour is deleted.

**Effect.** Specification-style documents (one heading per setting, "Timeout: 30 s") lose exactly the facts `lookup` questions ask for, silently.

**Proposed fix.** Never drop content that is the whole of its section. Instead, merge it into the neighbouring chunk under the **parent** section (the span extends; offsets stay exact), and keep the small chunk's heading in the merged chunk's `context`. Keep the hard floor only for chunks that are digits and punctuation (page furniture). Add a test.

## 3. Reprocessing deletes past answers' citations

**Evidence (code reading).** `answer_citations.chunk_id` references `chunks(id) on delete cascade` ([core schema](../../supabase/migrations/20260915120000_core_schema.sql)). Ingestion starts by deleting every chunk of the document (`_clear_chunks`), and chunk ids are regenerated. Deleting a document does the same.

**Effect.** After a reprocess, every earlier answer that cited that document keeps its `[n]` markers but loses the rows behind them. The review queue and audit trail can no longer show which passage an answer relied on, which is the product's central promise. `retrieval_runs.candidates_json` also points at chunk ids that no longer exist.

**Proposed fix.** Snapshot what was cited: add `document_id`, `char_start`, `char_end`, `excerpt` (and `content_hash`) to `answer_citations` at write time, and change the foreign key to `on delete set null`. Consider keeping the old document text version (`document_versions`) so old citations can still be highlighted. This is a schema change and needs an owner decision.

## 4. Documents stuck in `processing` after a restart

**Evidence (code reading).** Ingestion is a FastAPI background task inside the API process. Nothing on startup resets `pending` or `processing` documents, and `POST /documents/{id}/reprocess` refuses those states with 409. Railway restarts the process on every deploy ([D-045](../decisions.md#d-045)). The upload bytes are also held in memory until the task runs.

**Effect.** A deploy during a 10-minute embedding run leaves the document permanently "Embedding 300/1000". The only way out is delete and re-upload.

**Proposed fix.** Short term: on startup, mark documents still `pending`/`processing` as `failed` with "Processing was interrupted. Reprocess this document." (single instance, so any in-flight row is orphaned). Or allow reprocess when the row has not changed for more than N minutes. Longer term: a job table polled by a worker, with a heartbeat.

## 5. End-to-end p50 is 20.2 s against 8 s

**Evidence (measured).** Real-document run through the agent: p50 20.2 s, no reranking, 4 of 20 answers from a fallback model after 503s ([D-043](../decisions.md#d-043)). Direct `/agent/ask` earlier: p50 10.1 s ([D-038](../decisions.md#d-038)). Free-tier queueing is part of this and is not fixable in code ([D-032](../decisions.md#d-032)).

**Where the calls go** on a document question through the agent: agent step (choose tool) → embed → 2 searches → load → rerank → load vectors → [grade] → answer → groundedness → 4 sequential inserts → agent step (write reply). At least 4 model calls in series.

**Proposed fixes, cheapest first.** Savings are not measured yet; measure each with the harness.

1. **Skip the second agent step after a document tool.** The system prompt already tells the model not to restate the checked answer, so its reply is one introductory sentence. When the only tool called was a document tool, return a fixed intro (or none) and end the loop. Saves one fast-model call per question.
2. **Write the records concurrently.** The run must be inserted first (the answer references it), but the citations insert and the audit entry can run together, or after the response is sent.
3. **Route obvious document questions without the model.** Not recommended yet: [D-042](../decisions.md#d-042) chose model routing, and it scored 20/20.
4. **A paid Gemini key** removes free-tier deprioritisation and fallbacks; it is the largest single lever and an owner decision.

## 6. Most answers have no confidence and cannot be flagged as low

**Evidence (measured and code reading).** `confidence_for` returns null when cited passages have no rerank score, and the `low_confidence` flag is skipped when confidence is null. In the real-document run, 17 of 20 questions lost reranking because the free Voyage key allows 10K tokens a minute ([D-037](../decisions.md#d-037), [D-043](../decisions.md#d-043)). `explore` (40 candidates) and `summarize` (45) exceed that limit even with no other traffic.

**Effect.** Most answers show "confidence not available", and weak answers reach the person without a review flag unless groundedness fails. Losing reranking is silent to the user.

**Proposed fix.**

1. Add a `no_confidence` (or `rerank_unavailable`) flag reason, so these answers reach the review queue and the UI can say why.
2. Add a Voyage payment method so the designed pipeline runs, then re-run the real set with reranking. Without it, every threshold below is untestable.
3. Optionally, cap rerank input by tokens (truncate each passage to the portion near the best keyword match) so `explore` fits the free limit.

## 7. Gate thresholds are uncalibrated and the gate is untested

**Evidence (code reading).** `RERANK_CONFIDENT_SCORE` 0.50, `RERANK_WEAK_SCORE` 0.22, the 0.6 weak factor and `REVIEW_CONFIDENCE_THRESHOLD` 0.35 have no recorded derivation ([pipeline-parameters.md](pipeline-parameters.md)); D-027 says the threshold should be revisited once G1 results exist. `tests/test_retrieval_logic.py` has no test for `assess`, the rewrite loop or best-attempt choice.

**Proposed fix.**

1. With reranking working, run `evals.run --retrieval-only` and record the top rerank score for every question with whether the expected passage was retrieved. Pick the confident threshold where "good" is almost always a hit, and the weak threshold where it is almost always a miss. `evals.metrics` already reports confidence when right versus wrong.
2. Unit-test the gate table and the retry: confident skips the grader, weak triggers exactly one rewrite, the better attempt wins, `summarize` never grades.
3. Test the SQL functions in the local database suite (`scripts/db/test-local.sh`): workspace isolation and the `ready` filter.

## 8. False refusals on multi-passage and cross-document questions

**Evidence (measured).** Q09 (combine two facts in one report) and Q10 (compare figures across two documents) were refused although the needed passages were retrieved ([D-043](../decisions.md#d-043)). Q13 (two conflicting values) gave one and failed groundedness.

**Likely causes (not yet isolated).** `lookup` keeps 5 passages with no per-document cap, so a second document can be crowded out; the answer prompt says "if the passages do not contain the answer, set answerable to false", which a model applies to a *partial* answer too.

**Proposed fix.** Try, one at a time, measuring each on Q09, Q10 and Q13:

1. Prompt: "If the passages answer part of the question, answer that part and say what is missing" instead of refusing.
2. Tool guidance: for comparisons across named documents, call `lookup_fact` once per side (the agent already allows 2 document answers), or use `explore_documents`.
3. Prompt: "If passages give different values, report each with its source."

## 9. Factual poisoning is obeyed

**Evidence (measured).** Red-team RT5: a planted "erratum" claiming a different value was stated as the answer; groundedness passed because the claim *is* in a passage ([D-044](../decisions.md#d-044)).

**Proposed fix.** The same conflict-reporting prompt as #8.3, so both the original and the "erratum" value are shown with sources. Later: detect numeric conflicts across retrieved passages in code (same entity, different number) and flag `conflicting_sources` for review.

## 10. Word headings only from styles

**Evidence (reproduced).** `CV Filtering System AI .docx` has 35 paragraphs, all style `Normal`; the parser found 0 headings and produced 1 passage with no section. Many real Word documents use bold Normal text as headings.

**Proposed fix.** In `parse_docx`, also treat as a heading: a paragraph with an outline level (`w:outlineLvl`), or a short (≤ 90 chars), fully bold paragraph without sentence-ending punctuation, mirroring the PDF rule. Word elements also never get a page number; that is inherent to .docx and can stay.

## 11. Agent loop cost and format

**Code reading.**

- Each step re-sends the full system prompt (including every tool schema), history and the growing work log.
- The action is JSON with `arguments_json` as a **string containing JSON**, so the model must escape JSON inside JSON. Invalid-JSON and invalid-argument errors each burn a step.
- Gemini supports native function calling with the same tool schemas (`convert_to_openai_tool` already produces them), which returns arguments as structured objects.

**Proposed fix.** Move to native function calling through a new `generate_with_tools` in the gateway (keeping the chain and cooldowns), and combine with #5.1. Measure routing accuracy on the real set before and after, since 20/20 is the baseline to protect.

## 12. Single-process state

**Code reading.** Rate limits, the response and embedding caches, model cooldowns, the embedding rate window and ingestion jobs all live in one process ([D-033](../decisions.md#d-033), [D-041](../decisions.md#d-041), [D-045](../decisions.md#d-045)). Running two instances would double the effective limits and quotas and split the caches.

**Proposed fix.** None needed while one instance is enough. When scaling, move limits, cooldowns and the embedding window to Postgres or Redis, and ingestion to a worker (#4).

## 13. PyMuPDF AGPL on a public service

**Evidence.** [D-024](../decisions.md#d-024) requires a commercial licence or a replacement before production; [D-045](../decisions.md#d-045) made the service public.

**Proposed fix.** Owner decision: buy a licence, or evaluate pdfplumber (MIT) on the same real documents, comparing passage counts, table output and the golden-set retrieval pass. Fix #1 should be done on whichever parser is kept.

---

## Smaller notes

- The query is embedded without context while passages are embedded with `file > section` prepended. Usually fine; worth an A/B test on paraphrased lookups.
- `_vector_literal` is duplicated in `ingest.py` and `retrieval.py`.
- `POST /agent/ask` supports `document_ids`, but the agent tools cannot pass them ([D-042](../decisions.md#d-042)).
- The browser sends conversation history back and it is trusted; a forged "assistant" turn only affects the sender's own conversation, and proposals still need the current message.
