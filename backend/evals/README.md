# Golden set and Gate G1

Gate G1 (`docs/product/overview.md`): **at least 12 of 15 golden questions answered with the
correct source chunk cited.**

Everything here runs from `backend/` with the project virtualenv and the service role, so no
browser sign-in is needed. Nothing here invents questions: the golden set is authored by a
person, independently of the model under test.

## The order to run things

```sh
# 1. Ingest the corpus. Sequential and resumable; safe to re-run.
.venv/bin/python -m evals.ingest --folder ../golden-docs --workspace "My Workspace"

# 2. Check every expected quote resolves to a passage. No model calls.
.venv/bin/python -m evals.validate --workspace "My Workspace"

# 3. Retrieval only. NO generation calls, so re-run this as often as you like.
.venv/bin/python -m evals.run --workspace "My Workspace" --retrieval-only
.venv/bin/python -m evals.report --results evals/results/retrieval-<stamp>.json

# 4. The measured run. About 3 generation calls per question.
.venv/bin/python -m evals.run --workspace "My Workspace"

# 5. Grade, then report.
.venv/bin/python -m evals.report --results evals/results/full-<stamp>.json
```

Step 3 exists because of the free-tier limits (D-032). If the expected passage is not
retrieved, no answer model can cite it, and G1 cannot pass. Fix retrieval first, for free,
and only then spend generation quota.

## Writing the dataset

Copy `golden.example.jsonl` to `golden.jsonl`. It is git-ignored by default, because its
quotes are verbatim extracts from the source documents and those may not be yours to commit.
If the corpus is all your own material, commit it — as a regression set it is worth keeping.
Drop the `backend/evals/golden.jsonl` line from `.gitignore` to do that.

A question names its expected passage by a **verbatim quote**, never a chunk id — chunk ids
are regenerated on every reprocess (D-034), so a set keyed on them breaks the first time the
corpus is re-ingested. `evals.validate` resolves each quote and refuses to continue if one is
missing or straddles a passage boundary.

Corpus advice: 4-6 documents from at least 3 unrelated projects, 200-350 passages in total.
Below roughly 150 passages, `lookup` keeps 5 of 20 candidates and G1 passes almost by
construction.

## Grading

The runner scores everything mechanical: whether the expected passage was retrieved, at what
rank, and whether it was cited. It leaves a `grading` block per question for a person:

```json
"grading": {
  "answer_correct": null,
  "citation_acceptable": null,
  "notes": ""
}
```

- `answer_correct` — `true`, `false`, or `"partial"`. Is the prose actually right?
- `citation_acceptable` — leave `null` normally. Set `true` when the model cited a
  *different* passage that genuinely supports the answer, and `false` to reject a passage the
  auto-score accepted. The reported G1 number uses the auto-score plus these overrides, and
  shows both, so the adjustment is visible rather than hidden.

`evals.report` writes a `.md` beside the results with each answer and its cited passages laid
out for reading while you fill the JSON in.

## Reading the report

Two things decide whether a run is worth reporting at all:

- **Model mix.** The report warns when any gate question was answered by a fallback model.
  Per D-031 such a run is not a fair measure of the answer model; re-run those questions with
  `--only G-03,G-07` once quota resets.
- **Cache.** The gateway keeps an in-process response cache, so **restart the backend before a
  measured run** or repeated questions return cached answers with fabricated latency.

## Metrics

`evals.report` prints the metrics and writes `<results>.metrics.json` beside the results file, for
any UI that wants them. Every metric is computed from an existing run, so adding one costs no quota.

| Group | Metric | What it tells you |
| --- | --- | --- |
| Retrieval | Recall@1, @3, @5 | Was the expected passage in the top k after rerank and MMR |
| Retrieval | Retrieved at any rank, MRR | Whether and how high the passage surfaced at all |
| Citations | Correct passage cited | **Gate G1** |
| Citations | Strict citation precision | Share of cited passages that were expected; extra valid sources count against it |
| Key facts | Every key fact present | Objective completeness from `must_include`, no model and no grader |
| Answer quality | Groundedness passed, correct refusals, false refusals | The guardrails behaving |
| Human grading | Correct / partial / incorrect | Whether the prose is right |
| Operational | Latency p50/p95, model mix, fallbacks, runs without rerank | Whether the run is a fair measurement |
| Confidence | Mean when right vs wrong | Whether the uncalibrated value separates good answers from bad |
| PRD targets | G1, p50 latency, flagging rule, hand labelling, red team | Pass, fail, partial, not exercised or not run |

Rates carry a 95% Wilson interval. At 15 questions, 15/15 has an interval of roughly 80-100%, so
read the interval, not the point.

**Key facts.** Add `"must_include": ["62", "5"]` to a question: short tokens a complete answer
must contain. They match as whole tokens, so `5` does not match inside `15`, and they fold case,
hyphens and curly quotes. `evals.validate` refuses a fact that is not in the source document, since
no model could ever supply it.

**When to run what.**

- After any change to chunking, retrieval or reranking: `evals.run --retrieval-only` and the report.
  No generation calls.
- Before a gate or a demo: the full run, then grading, then the report.
- Before Day 5: the injection red-team suite (PRD section 5), which this harness does not yet run.
