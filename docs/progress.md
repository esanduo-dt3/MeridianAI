# Build progress

Newest first. Each entry states what exists, the verification recorded when that work was completed, and what is blocked. Gate results are reported here by name. Unless an entry explicitly says a check was rerun, recorded test, live API, and browser results are historical rather than a result of the current source-control review.

## Current source-control status

`dev` is at `818206c` (`Merge feature/ask-page into dev`), which is **2 commits ahead of `origin/dev`**: the push was blocked locally and is still pending. The Ask page is merged; the golden-set eval harness is on `feature/golden-eval`, not merged. It carries the free-tier embedding pacing ([D-033](decisions.md#d-033)), the ingestion passage preview ([D-034](decisions.md#d-034)) and the Ask page ([D-035](decisions.md#d-035)) on top of the earlier retrieval, notes, documents, tasks and workspace work. The `main` branch remains at the initial repository baseline commit, `5766775`.

## Day 3 (2026-09-17)

### One Assistant with document tools (committed on `feature/unified-assistant`)

- **Built.** The Ask page is merged into the Assistant ([D-042](decisions.md#d-042)). `/ask` redirects to `/assistant`. The agent decides whether a message needs a tool, and for document questions picks `lookup_fact`, `explore_documents` or `summarize_documents`, which replace `search_workspace`. Each runs the full checked pipeline and records the answer, and the Assistant page shows the checked answer with its passages, confidence and groundedness under the reply.
- **Verified.** `pytest`: **134 passed**, including new agent tests for the three tools, answering with no tool, the per-message cap and the injection taint. Frontend `tsc`, `eslint` and `vite build` pass.
- **Not yet verified.** A live run against Gemini to see how reliably the fast model chooses the right document tool, and the added latency.

## Gate status

| Gate | Due | Status |
| --- | --- | --- |
| G1: 12 of 15 golden questions cite the correct chunk | End of Day 3 | **Passed** 15/15 ([D-036](decisions.md#d-036), [D-038](decisions.md#d-038)); p50 latency 10.1 s misses the 8 s target |
| G2: propose, approve and write round trip | End of Day 4 | **Passed** 2026-09-16 on the E2E workspace ([D-039](decisions.md#d-039)) |

## Day 2 (2026-09-16)

### Part 11: Golden set eval harness (committed on `feature/golden-eval`)

- **Built.** `backend/evals/`, run from `backend/` with the service role, so no browser sign-in and no test accounts ([D-036](decisions.md#d-036)).
  - `evals.ingest` — ingests a folder into a workspace one document at a time, skips documents already ready so a run stopped by the daily embedding quota resumes the next day, and only accepts `ready` when every passage is embedded. Warns when the corpus is under ~150 passages, where `lookup` keeping 5 of 20 candidates makes G1 pass almost by construction.
  - `evals.validate` — resolves every expected quote to a passage with **no model calls**, folding whitespace, case and curly punctuation, and refuses the dataset if a quote is missing or straddles a passage boundary.
  - `evals.run` — `--retrieval-only` (no generation calls at all) and the full measured run. Scores retrieval rank, reciprocal rank and whether the expected passage was cited; leaves a `grading` block per question for a person.
  - `evals.report` — the G1 verdict plus retrieval, answer-quality, operational and confidence-separation metrics, and a markdown view of every answer with its cited passages for grading against. Warns when any gate question was answered by a fallback model.
- **Verified.** `pytest`: **81 passed** (63 existing + 18 new covering quote folding, exact offsets, straddled boundaries, missing quotes, unready documents, dataset validation and the reviewer override). The report and markdown view were smoke-tested end to end on a synthetic 15-question run, including the override path and the fallback-model warning. Workspace resolution was checked live against Supabase through the service role.
- **Not yet run.** No corpus and no golden set yet; both come from the owner. No Gemini quota has been spent.

### Part 10: Ask page (committed on `feature/ask-page`)

- **Built.** `/ask` is a working surface instead of a placeholder ([D-035](decisions.md#d-035)).
  - A question box with the retrieval profile (lookup, explore, summarize); Enter asks, Shift+Enter starts a new line.
  - The answer with its `[n]` markers as links into `/documents/{id}?chunk={chunk_id}`, which highlights the exact passage in the viewer. Hovering a marker outlines its passage card.
  - The cited passages listed under the answer, each with file name, page, section, character range and excerpt.
  - The three reliability signals together: the confidence value always labelled uncalibrated, the groundedness result, and each flag reason written out in plain language.
  - "How this answer was retrieved": the model that actually answered, attempts, grade, top rerank score, latency and the run id, all read off the recorded run.
  - Recent answers from `GET /agent/answers`, expandable. Their markers are plain text, because that endpoint does not return citation targets.
  - The question box is withheld until a document reaches `ready`, since search only returns passages from ready documents.
- **Verified.** `tsc --noEmit` clean, `eslint` clean, `vite build` succeeds. The TypeScript types were checked field by field against the live `/openapi.json` for `AskRequest`, `AskResponse`, `CitationOut`, `Confidence`, `RetrievalSummary` and `AnswerListItem`, and match. The citation-marker splitter was round-trip checked against six answer shapes, including repeated calls, a leading marker, a trailing marker, adjacent markers and bracketed prose that is not a marker.
- **Not yet verified.** No browser run and no live question: signing in needs Google OAuth, and a measured run spends free-tier quota. The owner should ask one real question and click a citation through to the passage.
- **Bug found and fixed during the build.** The marker splitter held a module-level `/g` regex, so `lastIndex` carried between renders and a second answer on the same page would have lost its first markers. The regex is now built per call, and the pure helpers moved to `agent/answerModel.ts`.

### Part 9: Merged the embedding and preview branches into `dev`

- `fix/embedding-rate-limit` then `feature/ingestion-preview` merged into `dev` and pushed as `e9818ce`.
- **Verified after merging.** `pytest`: 63 passed. `vite build` succeeds.

### Part 8: Block note editor (committed on `feature/notes`)

- **Built.**
  - **Notes API:** block-tree content validated server-side; any member creates and edits; the author or an Admin deletes.
  - **Notes page:** list with search and relative times; a Tiptap editor with a `/` block menu (headings, bulleted, numbered and to-do lists, quote, code, divider) and a bubble menu (bold, italic, strike, code, link); autosave with a Saving and Saved indicator; delete with confirmation; a mobile layout.
- **Verified.**
  - `pytest`: 46 passed.
  - Live notes API run: 8 passed.
  - Browser run (slash menu, bubble menu, autosave to a real block tree, reload, Member edit, delete rules, dark and mobile): 15 passed.
- **Bug found and fixed.** Enter in the title moved focus to the body one animation frame late, so fast typing landed in the title.

### Part 7: Ingestion and Documents page (committed on `feature/ingestion`)

- **Built.**
  - PDF and Word parsing: layout, tables, headings, and headers and footers removed.
  - Section-aware chunking where every chunk is an exact span of the stored document text.
  - Gemini embeddings behind the provider gateway; background processing with status; workspace-scoped storage; duplicate detection.
  - Documents page with a workspace picker for uploads, live status, retry and delete, and a passage inspector that highlights exact character spans.
- **Verified.**
  - Database access suite: 65 passed.
  - `pytest` (including offset invariants on generated PDF and Word files): 38 passed on this branch.
  - Live upload run: 11 passed. Browser run: 11 passed.
- **Blocked on.** `GEMINI_API_KEY` for real embeddings. Without it, uploads correctly end in Failed with "Embedding failed".

### Retrieval pipeline (committed on `feature/retrieval`, built on ingestion)

- **Built.**
  - Hybrid dense and keyword search, reciprocal rank fusion, Voyage cross-encoder rerank, MMR.
  - A confidence gate with one rewrite and retry (two attempts at most).
  - Grounded answers with renumbered chunk citations, a groundedness check, uncalibrated confidence and review flags.
  - `POST /agent/ask` records `retrieval_runs`, answers and citations.
- **Verified.** Unit tests for fusion, MMR, citations, the confidence formula and prompt isolation.
- **Blocked on.** `GEMINI_API_KEY` and `VOYAGE_API_KEY` for a live run and for Gate G1.

## Day 1 (2026-09-15)

### Part 6: Tasks, List and Board views (committed on `feature/tasks`)

- **Built.**
  - **Database:** subtasks, priority, description, ordering and completion time; loop and cross-workspace protection; atomic `approve_agent_action` and `reject_agent_action`.
  - **API:** list, create, update, delete tasks; approve and reject proposals.
  - **List view:** collapsible subtask tree, progress bars, overdue dates, priority bars, assignee avatars, filter (`/`), Show completed, inline add (`N`).
  - **Board view:** To do, In progress and Done columns with drag and drop by pointer or keyboard, and per-column add.
  - **Task panel:** edit every field, subtasks, delete with confirmation. Members get a read-only panel apart from status.
  - **Proposals:** agent proposals with the agent's reasoning, Approve and Reject for Admins, and an Agent badge on approved tasks.
- **Verified.**
  - Database access suite: 56 passed.
  - `pytest`: 30 passed.
  - Live API run: 20 passed.
  - Browser run (Admin, Member, light and dark, mobile, pointer and keyboard drag): 25 passed.
- **Bug found and fixed during testing.** Cross-column drops failed once a column was taller than the screen: corner-distance collision detection preferred cards in the starting column. The board now uses what is under the pointer first.
- **Integrated and pushed.** Merged into `dev` by `4122c79` and present on `origin/dev`.

### Part 5: Workspaces and members (committed on `feature/workspaces`)

- **Built.**
  - **API:** `/me` with workspaces; create, list, rename and leave workspaces; roster, add or invite by email, change role, remove, revoke invite. Every change is audit-logged.
  - **Database:** `find_user_id_by_email`, callable by the service role only.
  - **Frontend:** first-run "Create your first workspace" page; workspace switcher with role badges and "Create workspace"; Members page (invite form, roster with role controls, pending invites, leave workspace); Admin navigation and pages hidden from Members.
- **Verified.**
  - `pytest`: 17 passed.
  - Database access suite: 38 passed.
  - Live API run against Supabase with test accounts: 21 passed.
  - Browser run (new user, Admin, Member, light and dark, mobile): all checks passed after fixing the test's invite assertion.
- **Integrated and pushed.** Merged into `dev` by `d46b20b` and included in the current `origin/dev` history.

### Part 4: Dark theme and sign-in fixes (committed on `feature/theme-toggle` and `fix/signin-back-navigation`)

- Light and dark themes with a System, Light and Dark control ([D-017](decisions.md#d-017)).
- Sign-in:
  - failures are now visible, with the exact reason under the button;
  - Back from Google no longer freezes the button;
  - a blocked redirect is explained.
- **Owner action pending:** Google sign-in fails with "Unable to exchange external code", because the Client Secret saved in Supabase does not match the Google OAuth client. The secret the owner has was verified as valid against Google.

### Part 3: Database schema (merged to `dev`, not yet applied to Supabase)

- **Written.**
  - The core schema: all MUST tables, invites, row-level security on every table, sign-up and invite trigger, `create_workspace`, integrity triggers, and the private `documents` storage bucket.
  - Migration tooling: `migrate.sh`, `verify.sql`, `test-local.sh`.
- **Verified.** Local access-rule suite passes on a throwaway Postgres: **36 passed, 0 failed**. It covers the full permission matrix, including isolation between workspaces, the Member status-only rule, append-only audit, last-Admin protection and storage.
- **Blocked on.** `DATABASE_URL` (Supabase session pooler string) to apply the migration to the hosted project.
- **Next.**
  - Apply the migration, then run `verify.sql`.
  - Change `GET /me` to return the user plus their workspaces.
  - Add `GET` and `POST /workspaces`.
  - Frontend: workspace switcher and "create workspace".

### Part 2: Backend scaffold (done, merged to `dev`)

- **Built.**
  - FastAPI app with settings validation and CORS for `http://localhost:5173`.
  - JWKS token verification (ES256), workspace-scoping dependencies (`get_workspace_context`, `require_admin`).
  - `GET /health` and `GET /me`.
- **Verified.**
  - `pytest`: 3 passed.
  - Live: `/health` returns 200; `/me` returns 401 with no token and with a forged token.
  - CORS preflight from `localhost:5173` returns 200.
- **Known.** A signed-in `GET /me` returns 503 until the schema is applied, because `workspace_members` does not exist yet. That is the intended fail-closed behaviour.

### Part 1: Frontend scaffold (done, merged to `dev`)

- **Built.**
  - Vite, React and TypeScript app with a single Supabase client and PKCE Google sign-in.
  - Session guard and bearer-token API helper.
  - Sign-in screen with a citation example built from real project text.
  - Workspace shell: sidebar, mobile drawer, eight MUST surfaces with honest empty states.
  - Reliability note and `ConfidenceLabel`.
- **Verified.** `npm run build` and `npm run lint` pass. The dev server serves `/signin`.
- **Google sign-in.**
  - Supabase's Google provider is enabled and sends client `984237745523-…` with the correct callback.
  - The owner added the callback to the Google OAuth client after a `redirect_uri_mismatch`.
  - An end-to-end sign-in has not yet been confirmed.

### Part 0: Handover from Kavia AI

- Kavia completed only its git baseline ([D-001](decisions.md#d-001)). History was re-authored to the DigitalT3 account and force-pushed with owner approval.

## Still to do on Day 1

- Hybrid search spike: pgvector plus full-text search returning results for a real test document. Needs `GEMINI_API_KEY`.
- Parsing spike: one real PDF and one real Word document, with chunk quality checked by eye.
- The golden set (15 questions) and red-team documents (8) are **supplied by the owner**. They are not generated by the build.
