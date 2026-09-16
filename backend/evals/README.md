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
