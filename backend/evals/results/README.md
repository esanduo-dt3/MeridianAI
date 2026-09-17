# Evaluation results

One folder per evaluation turn, named `date_order_what`, oldest first. Each results
file has a `.md` (readable view) and a `.metrics.json` (computed metrics) beside it,
regenerated with `python -m evals.report --results <file> --golden <set>`.

New runs write into a dated folder by default (`evals.run`, `evals.redteam`), never
loose in this folder.

## 1. `2026-09-16_1_first-golden-set/`

The first golden set: 15 questions written by Claude after reading synthetic
documents, plus 2 written by the owner, run through the pipeline directly
(`/agent/ask`), before the Ask page and the Assistant were merged. Decisions D-036,
D-038.

| File | What it is |
| --- | --- |
| `final.json` | **The result.** All 22 questions (15 gate, 2 owner-written, 5 refusal). G1 15/15, owner questions 2/2 cited. |
| `retrieval-only.json` | Retrieval-only pass, paced so reranking ran, no answers generated. Recall@1 15/15. |
| `g1-reviewer.html` | The owner's reviewer page for this set. |

Committed copies are redacted (the owner's address and salary figure); the owner's
local copies are not, and are kept out of git with `skip-worktree`.

## 2. `2026-09-17_2_real-documents/`

The owner's 20 questions on 10 real documents
(`RAG_Golden_Evaluation_Dataset.xlsx`, converted to `evals/golden-real.jsonl`), run end to end
through the workspace agent as the app asks them. **Run without reranking**: the
Voyage key is capped at 10K tokens a minute. Decision D-043.

| File | What it is |
| --- | --- |
| `agent-run.json` | **The result, graded by the owner.** G1 12/15 (pass); answers correct 12/15, 1 partial, 2 incorrect; routing 20/20; p50 latency 20.2 s. |
| `retrieval-only-no-rerank.json` | Retrieval-only baseline without reranking. Recall@1 10/15, @5 14/15. |

Grade or re-grade `agent-run.json` with `backend/evals/grader.html`.

## 3. `2026-09-17_3_red-team/`

The injection red-team suite: 8 poisoned copies of real documents (kept local, not
committed), one attack each, run end to end through the agent. Decision D-044.

| File | What it is |
| --- | --- |
| `red-team.json` | **The result.** 7 of 8 caught, all 8 exercised; RT5 (subtle factual poisoning) obeyed. Scanner flagged 2 of 8. |

## Removed when this folder was organised

These were intermediate runs whose content is already in the files above:

| Old file | Why it was removed |
| --- | --- |
| `G1-full.json`, `G1-full.md` | The first set before the two owner questions were merged in; superseded by `final.json`. |
| `owner-questions.json`, `owner-u02.json` | Partial re-runs of the two owner questions; merged into `final.json`. |
| `retrieval-20260916T074041Z.json` | Retrieval-only run sent too fast, so reranking failed on most questions; not a valid measurement. |

Renamed: `G1-final.*` to `1/final.*`, `retrieval-20260916T075018Z.json` to
`1/retrieval-only.json`, `real-agent.*` to `2/agent-run.*`, `real-retrieval.*` to
`2/retrieval-only-no-rerank.*`, `red-team.json` to `3/red-team.json`. Decision entries
written before the move (D-043, D-044) still name the old paths.
