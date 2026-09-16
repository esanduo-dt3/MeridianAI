# Decision log

Every decision that shapes Meridian and is not stated verbatim in `Meridian_PRD_v2.pdf` or the kickoff prompts is recorded here, at the time it is made. Entries are never edited after the fact: a reversed decision gets a new entry that supersedes the old one.

**Status values:** *Accepted*, meaning in force. *Superseded by D-xxx*, meaning replaced.
**Approval values:** *Owner*, meaning the product owner decided or explicitly approved it. *Engineering*, meaning it was decided during the build within the owner's constraints.

| ID | Decision | Status | Approval | Date |
| --- | --- | --- | --- | --- |
| [D-001](#d-001) | Take over the build from Kavia AI at its first completed step | Accepted | Owner | 2026-09-15 |
| [D-002](#d-002) | Repository, branch and commit rules | Accepted | Owner | 2026-09-15 |
| [D-003](#d-003) | Frontend stack | Accepted | Engineering | 2026-09-15 |
| [D-004](#d-004) | Add `workspace_id` to `audit_log` and `admin_reviews` | Accepted | Owner | 2026-09-15 |
| [D-005](#d-005) | Supabase pgvector and Postgres full-text search for Week 1 retrieval | Accepted | Owner | 2026-09-15 |
| [D-006](#d-006) | User-created workspaces with Admin and Member roles | Accepted | Owner | 2026-09-15 |
| [D-007](#d-007) | Pending email invites | Accepted | Owner | 2026-09-15 |
| [D-008](#d-008) | Denormalise `workspace_id` and add `chunk_index` on `chunks` | Accepted | Owner | 2026-09-15 |
| [D-009](#d-009) | Store the proposal and decision on `agent_actions` | Accepted | Owner | 2026-09-15 |
| [D-010](#d-010) | Do not create the `sprints` table yet | Accepted | Owner | 2026-09-15 |
| [D-011](#d-011) | Supporting columns beyond the PRD data model | Accepted | Owner | 2026-09-15 |
| [D-012](#d-012) | Database-enforced integrity rules | Accepted | Engineering | 2026-09-15 |
| [D-013](#d-013) | Backend verifies Supabase tokens with JWKS; service role stays server-side | Accepted | Engineering | 2026-09-15 |
| [D-014](#d-014) | Backend runs on Python 3.13 | Accepted | Engineering | 2026-09-15 |
| [D-015](#d-015) | Plain SQL migrations applied with psql, tested locally | Accepted | Engineering | 2026-09-15 |
| [D-016](#d-016) | Visual direction for the product UI | Accepted | Engineering | 2026-09-15 |
| [D-017](#d-017) | Light and dark themes with a system default | Accepted | Owner | 2026-09-15 |
| [D-018](#d-018) | API queries run as the signed-in user; service role only where required | Accepted | Engineering | 2026-09-15 |
| [D-019](#d-019) | Frontend data and interaction libraries | Accepted | Engineering | 2026-09-15 |
| [D-020](#d-020) | Task List and Board views with subtasks | Accepted | Owner | 2026-09-15 |
| [D-021](#d-021) | Members may reorder tasks as well as change status | Accepted | Engineering | 2026-09-15 |
| [D-022](#d-022) | Week 1 ingestion: PDF and Word, text only | Accepted | Owner | 2026-09-16 |
| [D-023](#d-023) | Chunks are exact spans of a canonical document text | Accepted | Engineering | 2026-09-16 |
| [D-024](#d-024) | PyMuPDF for PDF parsing, licence flagged | Accepted | Owner | 2026-09-16 |
| [D-025](#d-025) | The workspace is the search namespace | Accepted | Owner | 2026-09-16 |
| [D-026](#d-026) | Gemini behind a provider gateway, Voyage for reranking | Accepted | Owner | 2026-09-16 |
| [D-027](#d-027) | Confidence formula and review flags | Accepted | Engineering | 2026-09-16 |
| [D-028](#d-028) | LangChain, not LangGraph, for the agent | Accepted | Owner | 2026-09-16 |
| [D-029](#d-029) | Block note editor on Tiptap, stored as its JSON tree | Accepted | Engineering | 2026-09-16 |
| [D-030](#d-030) | Rewrite and grade only when retrieval is uncertain | Accepted | Owner | 2026-09-16 |
| [D-031](#d-031) | Fall back to the fast model when the answer model is unavailable | Superseded by D-032 | Engineering | 2026-09-16 |
| [D-032](#d-032) | Run on the Gemini free tier with a model chain and cooldowns | Accepted | Owner | 2026-09-16 |
| [D-033](#d-033) | Pace document embedding under the free-tier quota | Accepted | Engineering | 2026-09-16 |
| [D-034](#d-034) | Preview passages before embedding finishes | Accepted | Owner | 2026-09-16 |
| [D-035](#d-035) | The Ask page shows the whole reliability record of an answer | Accepted | Engineering | 2026-09-16 |
| [D-036](#d-036) | Golden set anchors on quotes, and the eval runs offline in two passes | Accepted | Engineering | 2026-09-16 |
| [D-037](#d-037) | Persist the answering model, and record what the free Voyage tier costs retrieval | Accepted | Engineering | 2026-09-16 |
| [D-038](#d-038) | Evaluation metrics beyond the gate, with intervals and objective key facts | Accepted | Engineering | 2026-09-16 |
| [D-039](#d-039) | The workspace agent: LangChain tools, a JSON tool loop through the gateway, and proposals that need the user's own words | Accepted | Engineering | 2026-09-16 |

---

## D-001

**Take over the build from Kavia AI at its first completed step**

- **Context.** Kavia AI ran for more than an hour and produced only STEP-01 of its own scaffold plan: `.gitignore`, `README.md`, and the `main` and `dev` branches. It also created an empty local `feature/frontend-scaffold` branch. No application code existed.
- **Decision.** Keep Kavia's git baseline and continue from STEP-02 (the frontend scaffold). `kavia-docs/` stays in the repository, unmodified going forward, as the record of the Kavia run: its plan, its PRD summary, the project context and the kickoff prompts. The maintained documentation is this `docs/` tree.
- **Also done.** The baseline commit had been authored by the owner's personal GitHub account. With owner approval it was re-authored to the DigitalT3 account (`esanduo-dt3`) and force-pushed to `main` and `dev`. The rewrite was guarded by `--force-with-lease`, and the only other commit is the GitHub-generated initial commit.
- **Consequences.** Git history on `main` starts at `bcaebb0` (initial commit) and `5766775` (baseline).

## D-002

**Repository, branch and commit rules**

- **Decision.**
  - `main` is releasable and never force-pushed after D-001.
  - `dev` is the integration branch.
  - Each piece of work gets a `feature/<slug>` branch cut from `dev`.
  - Commits follow Conventional Commits, scoped by area, for example `feat(frontend): …`.
  - A commit is made when a task or subtask is complete.
  - All commits use the DigitalT3 identity, set in the repository-local git config.
  - Commit messages and pull requests carry no AI co-author trailers.
  - Nothing is committed or pushed without the owner's go-ahead.
  - The local `claudeSkills/` folder (UI design guidance) is git-ignored and never committed.
- **Why.** The owner wants clean, attributable history under the company account.

## D-003

**Frontend stack**

- **Decision.** Vite 8, React 19, TypeScript 6.0, Tailwind CSS v4 (Vite plugin), React Router 7, Motion for animation, Phosphor icons, and self-hosted fonts via Fontsource. No component library for now.
- **Why TypeScript 6.0 and not 7.** `typescript-eslint` supports TypeScript below 6.1 only.
- **Why no component library yet.** The scaffold needs only a handful of primitives. Radix primitives can be added when dialogs and menus arrive, without restyling.
- **Consequences.** Upgrade TypeScript when `typescript-eslint` supports 7.

## D-004

**Add `workspace_id` to `audit_log` and `admin_reviews`**

- **Context.** The PRD requires row-level security scoped by `workspace_id` on every table, but its data model gives these two tables no `workspace_id`.
- **Decision.** Add the column.
  - It is nullable on `audit_log`, for system events that belong to no workspace.
  - It is required on `admin_reviews`.
- **Consequences.** Both tables can be restricted to Admins of the owning workspace.

## D-005

**Supabase pgvector and Postgres full-text search for Week 1 retrieval**

- **Context.**
  - The PRD names a managed vector database with hybrid dense and sparse support.
  - The kickoff prompt says to use Supabase pgvector if no vector database is connected, and to flag the trade-off.
  - No vector database is connected.
- **Decision.**
  - Dense vectors live in a new `chunk_embeddings` table: `vector(1536)` with an HNSW cosine index. `chunks.embedding_ref` points at it, so `chunks` keeps the PRD's columns.
  - The sparse (keyword) signal is a generated `tsvector` column on `chunks`, `content_tsv`, with a GIN index.
  - 1536 dimensions fits pgvector's 2,000-dimension limit for HNSW indexes. The Gemini embedding model can produce it through its output-dimensionality setting.
- **Trade-off.**
  - For: no extra service, credentials or network hop, and search runs inside the same row-level security as the rest of the data.
  - Against: dedicated vector databases scale further and offer better sparse models (for example BM25 or SPLADE) than Postgres full-text ranking. Beyond roughly hundreds of thousands of chunks, or if sparse recall misses Gate G1, revisit.
- **Consequences.** Changing the embedding size needs a migration and re-embedding.

## D-006

**User-created workspaces with Admin and Member roles**

- **Context.** The PRD demo uses a single active workspace per account. The owner wants Jira-like workspaces instead.
- **Decision.**
  - **New users.** A new user starts with no workspace.
  - **Creating workspaces.** Any signed-in user can create any number of workspaces and becomes Admin of each one they create. Creation goes through the `create_workspace` database function, so the workspace, the Admin membership and the audit entry are written together.
  - **Roles.** There are two roles, set per workspace on `workspace_members.auth_role`:
    - **Admin:** everything in the workspace. That includes uploading documents, creating and editing tasks, approving or rejecting agent actions, the review queue, the audit log, pipeline health and member management.
    - **Member:** can read the workspace, ask the agent, create and edit notes, and change a task's **status**. Nothing else.
  - **Not adopted.** A third "view only" role was considered and dropped by the owner.
- **Consequences.**
  - The PRD persona "Member creates tasks, uploads documents and approves actions" is narrowed. Those abilities are Admin-only.
  - A workspace switcher and a "create workspace" screen are needed in the frontend.
  - The backend resolves the active workspace per request (header `X-Workspace-Id`) rather than assuming one.

## D-007

**Pending email invites**

- **Decision.**
  - Admins add people by email and choose Admin or Member.
  - If the person has never signed in, the invite is stored in `workspace_invites`.
  - On their first Google sign-in, a database trigger adds them with the chosen role and marks the invite accepted. Email matching is case-insensitive.
- **Consequences.** Adding someone never requires them to sign in first.

## D-008

**Denormalise `workspace_id` and add `chunk_index` on `chunks`**

- **Decision.** `chunks` gains `workspace_id` (copied from its document) and `chunk_index` (its order within the document).
- **Why.**
  - Retrieval filters by workspace on every query, and row-level security can check the column directly instead of joining through `documents`.
  - `chunk_index` gives a stable reading order for the citation viewer.

## D-009

**Store the proposal and decision on `agent_actions`**

- **Context.** The PRD's `agent_actions` has `reasoning` and `before_state`, but nowhere to hold the task being proposed. Without that, nothing can be approved.
- **Decision.** Add three columns:
  - `proposed_payload` (jsonb)
  - `decided_by`
  - `decided_at`
- **Enforced by the database.** `decided_at` is empty exactly when the status is `pending`. `target_id` stays empty until approval writes the task.
- **Consequences.** Pending proposals live only in `agent_actions`. `tasks` never holds an unapproved row, which is non-negotiable 1.

## D-010

**Do not create the `sprints` table yet**

- **Decision.** `sprints` is SHOULD scope (backlog and sprint board). It is not created. `tasks.sprint_id` exists as a nullable column with no foreign key, and is added when a gate passes and the owner gives the go-ahead.

## D-011

**Supporting columns beyond the PRD data model**

Each of these closes a gap the UI or the guardrails need.

| Table | Added | Why |
| --- | --- | --- |
| `users` | `full_name`, `avatar_url` | Member lists and the audit log show people, not IDs |
| `documents` | `file_name`, `mime_type`, `size_bytes`, `parse_error` | The documents list and failed-parse state |
| `notes` | `title`, `created_at` | The notes list; ordering |
| `tasks` | status values `todo`, `in_progress`, `done` | Members change status (D-006); pending proposals are not tasks (D-009) |
| `retrieval_runs` | `asked_by` | Attribution in pipeline health and audit |
| `agent_answers` | `asked_by`, `retrieval_run_id` | Trace an answer to its run and asker |
| `answer_citations` | `ordinal` | The `[n]` marker shown in the answer text |
| `audit_log` | `target_type` | `target_id` alone is ambiguous across tables |

## D-012

**Database-enforced integrity rules**

- **Decision.** The following are enforced by triggers, not just application code:
  - `audit_log` is append-only. Updates and deletes are rejected for every role, including the service role.
  - A Member's update to a task may change `status` only.
  - A workspace must always keep at least one Admin.
  - `notes.updated_at` is maintained automatically.
- **Why.** The product thesis is "trustworthy because inspectable". An audit trail the application could rewrite would not support it.

## D-013

**Backend verifies Supabase tokens with JWKS; service role stays server-side**

- **Decision.**
  - FastAPI verifies each access token's signature against the project's published JSON Web Key Set, plus its issuer, audience (`authenticated`) and expiry. The project signs with ES256, so the backend holds no JWT secret.
  - Privileged database writes use the service-role key, only in the backend, and only after the backend's own role check.
  - Row-level security remains the second line of defence.
- **Consequences.** The frontend holds only the publishable key.

## D-014

**Backend runs on Python 3.13**

- **Decision.** Use the Homebrew Python 3.13 installation for the backend virtual environment, not the newer system Python 3.14.
- **Why.** The retrieval and agent libraries arriving from Day 1 onward (LangGraph and its dependencies) have the most mature wheel support on 3.13. Deployment should pin the same version.

## D-015

**Plain SQL migrations applied with psql, tested locally**

- **Decision.**
  - **Files.** Migrations are timestamped SQL files in `supabase/migrations/`, the layout the Supabase CLI expects, so the CLI can be adopted later without moving files.
  - **Applying.** `scripts/db/migrate.sh` applies pending files with `psql`, one transaction each, and records versions in `private.schema_migrations`.
  - **Testing.** `scripts/db/test-local.sh` applies all migrations to a throwaway local Postgres with stand-ins for Supabase's `auth` and `storage` schemas, then runs `supabase/tests/rls_behaviour.sh`.
- **Why.** No Supabase CLI or Docker dependency, and every access rule is proven before it reaches the hosted database.

## D-016

**Visual direction for the product UI**

- **Decision.** The UI reads as a precise instrument, not a chat toy.
  - **Palette.** Cool mineral paper (`#f4f5f2`), ink text, one cobalt accent (`#2743c9`) for action and location, and a highlighter yellow (`#ffe27a`) reserved exclusively for cited source passages.
  - **Type.** Bricolage Grotesque for display, Geist for text, Geist Mono for offsets and values.
  - **Signature.** The "meridian" line: a cobalt rule that marks the current page in navigation and connects an answer to its source.
  - **Enforced in code.** Confidence values can only be rendered through `ConfidenceLabel`, which always shows "uncalibrated" (non-negotiable 3).
- **Details.** See [design/design-system.md](design/design-system.md).

## D-017

**Light and dark themes with a system default**

- **Context.** The owner asked for both light and dark themes, with a toggle.
- **Decision.**
  - Both themes are built from the same colour tokens; dark redefines each one under `[data-theme='dark']`.
  - The default follows the operating system.
  - A three-way control (System, Light, Dark) is in the sidebar and on the sign-in page, and the choice is stored locally in the browser.
  - The theme is applied before the first paint, so there is no flash of the wrong theme.
- **Consequences.** Components must use theme tokens only. Colours are chosen to keep text at WCAG AA contrast in both themes. See [design/design-system.md](design/design-system.md#dark-theme).

## D-018

**API queries run as the signed-in user; service role only where required**

- **Context.** [D-013](#d-013) had the backend use the service-role key after its own role check. That makes the application code the only barrier, and leaves the tested row-level security policies unused by the API.
- **Decision.**
  - Handlers call PostgREST with the publishable key plus the **caller's own access token**, so every read and write is filtered by row-level security in addition to the API's role checks.
  - The service-role client is used only for:
    - writing `audit_log` entries, which users may not write;
    - `find_user_id_by_email`, which crosses workspaces and must not be callable by users;
    - agent writes after approval, when those land.
  - Database errors are mapped to HTTP responses. For example, violating the last-Admin rule returns 409, and a row-level security rejection returns 403.
- **Consequences.** A bug in an API role check cannot expose another workspace's data. This supersedes the "service role after role check" part of D-013 for user-initiated requests.

## D-019

**Frontend data and interaction libraries**

- **Decision.** Add four libraries:
  - **TanStack Query:** server state, caching, retries and invalidation. Workspace-scoped query keys start with `['ws', workspaceId]`, so switching workspace discards stale data.
  - **Radix UI Dialog and Dropdown Menu:** accessible dialogs and menus with focus management, styled with Meridian tokens.
  - **Sonner:** transient confirmation toasts.
  - **@dnd-kit:** drag and drop on the task board (added with the task views).
- **Why.** Accessible modals, menus and drag-and-drop are costly to get right by hand. These libraries are unstyled or lightly styled, so the design system stays in control.

## D-020

**Task List and Board views with subtasks**

- **Context.** The PRD's MUST scope asks for a task list that shows approved tasks and agent proposals awaiting approval. The backlog and sprint board is SHOULD scope. The owner asked for a List view and a Kanban board modelled on a reference screenshot, before the retrieval work.
- **Decision.**
  - **Data model.** Tasks gain `description`, `priority` (none, low, medium, high, urgent), `parent_task_id` for subtasks, `position` for ordering, `updated_at` and `completed_at`.
  - **List view.** A collapsible tree with subtask progress, due dates (overdue highlighted), priority and assignee.
  - **Board view.** Three status columns (To do, In progress, Done) with pointer and keyboard drag and drop.
  - **Task panel.** Edits every field and manages subtasks.
  - **Agent proposals.** Shown above both views, with Approve and Reject for Admins ([D-009](#d-009), non-negotiable 1).
- **Scope note.**
  - This is an owner-requested addition to the MUST scope.
  - There are no sprints: [D-010](#d-010) still stands, and `sprint_id` stays unused.
  - There is no automatic assignment and no undo; both remain SHOULD scope.
- **Consequences.**
  - Subtask trees are validated in the database: same workspace, no loops.
  - Deleting a task deletes its subtasks.
  - Projects inside workspaces were considered and deferred by the owner.

## D-021

**Members may reorder tasks as well as change status**

- **Context.** [D-006](#d-006) limits Members to changing a task's status. On a board, moving a card between columns changes both status and position.
- **Decision.** Members may change `status` and `position`, and nothing else. This is enforced by the API (403) and by the `tasks_member_update_guard` trigger.
- **Why.** Ordering carries no content. Without it, a Member could move a card to another column but not place it where they dropped it.

## D-022

**Week 1 ingestion: PDF and Word, text only**

- **Decision.** Only PDF and Word (.docx) documents are accepted, matching the PRD's MUST scope.
  - **Kept:** layout-aware parsing — tables as Markdown, reading order with two-column detection, heading levels from typography or styles, and removal of running headers and footers.
  - **Left out for Week 1:** OCR of scanned pages, captioning of figures, and model-written context sentences per chunk.
- **Why.** Faster and cheaper ingestion, and no model calls during parsing.
- **Consequences.** A scanned PDF yields no text. The upload fails with "No text was found. The PDF looks scanned", and the parse stats record `pages_without_text`. Excel, PowerPoint and images are rejected with 415.

## D-023

**Chunks are exact spans of a canonical document text**

- **Context.** Non-negotiable 3 requires citations with character offsets, so a citation must point at text that exists exactly as the model read it.
- **Decision.**
  - Each document stores `content_text`, built from the parsed elements joined by a blank line.
  - Every chunk's `content` equals `content_text[char_start:char_end]`, by construction:
    - splits happen on sentence, word, row or blank-line boundaries found in that text;
    - merges only extend spans.
  - The heading path, and a table's header row for continuation pieces, are stored separately as `context`. They are embedded and shown to the model, but never part of the cited passage.
  - Offsets count Unicode code points, as Python and Postgres do. The frontend must slice by code point, not UTF-16 unit.
- **Consequences.**
  - Citations highlight the extracted text, not a rendering of the original PDF page; the page number is shown alongside.
  - Tests assert the invariant on generated PDF and Word files.

## D-024

**PyMuPDF for PDF parsing, licence flagged**

- **Context.** PyMuPDF gives the best table and layout detection available, but it is dual-licensed AGPL-3.0 or commercial. Serving an AGPL component over a network can oblige the operator to publish the service's source.
- **Decision.** Use PyMuPDF for the Week 1 build.
- **Before production:** either obtain a commercial licence from Artifex, or replace it with an MIT-licensed parser such as pdfplumber and re-check table extraction quality. Parsing is isolated in `backend/app/rag/parsers/pdf.py`, so the swap is contained.

## D-025

**The workspace is the search namespace**

- **Decision.**
  - Documents are uploaded into a chosen workspace (the caller must be an Admin there).
  - Every document, chunk and embedding row carries that `workspace_id`.
  - Both search legs (`match_chunks_dense` and `match_chunks_sparse`) filter on `workspace_id` before ranking, and accept an optional list of document ids for narrower filtering.
  - The functions run as the caller, so row-level security enforces the same boundary.
  - Vectors stay in Supabase pgvector, confirming [D-005](#d-005). The dense leg uses pgvector 0.8 iterative index scans so filtering does not starve results.
- **Consequences.** A question never touches another workspace's chunks, even through a coding mistake in the API. A very large workspace can later be moved to a partition without changing the API.

## D-026

**Gemini behind a provider gateway, Voyage for reranking**

- **Decision.**
  - All model calls go through `app/llm/gateway.py`, a swappable provider interface with retries and an in-process response cache.
  - **Provider:** Gemini via `google-genai`:
    - `gemini-3.5-flash` for answers;
    - `gemini-3.5-flash-lite` for grading, query rewriting and groundedness checks;
    - both with thinking level `minimal`;
    - `gemini-embedding-001` at 1536 dimensions, normalised to unit length, with retrieval task types.
  - **Reranking:** Voyage `rerank-2.5`, whose [0, 1] scores drive the confidence gate.
  - Model names are configuration, not code. The 2.5 models are not available to new Gemini API keys; the 3.5 models were chosen by live latency on a JSON answer: flash with minimal thinking about 1.2 s, flash-lite about 1.0 s, 3.6-flash 2.8 to 11.6 s.
- **Why.** The PRD names a thin swappable gateway with a response cache. A cross-encoder reranker materially improves precision and gives a meaningful score to state confidence from.
- **Consequences.**
  - Requires `GEMINI_API_KEY` and `VOYAGE_API_KEY`.
  - Without Voyage, retrieval falls back to fusion order plus an LLM grade, and confidence is reported as unavailable.
  - The response cache is per process. A shared cache for demo pre-warming is Day 5 work.

## D-027

**Confidence formula and review flags**

- **Context.** The PRD defines confidence as a combination of the reranker score and the grading verdict, stated and uncalibrated.
- **Decision.**
  - **Formula:** `confidence = mean(rerank score of the cited passages) × (1.0 if the retrieval grade is good, else 0.6)`, rounded to 3 decimals.
  - **Returned with:** `label: "uncalibrated"` and a plain-language basis.
  - **Flag reasons.** An answer is flagged for the admin review queue when any of these apply:
    - confidence below 0.35 (`review_confidence_threshold`);
    - the groundedness check fails;
    - an answerable reply has no valid citations;
    - the documents cannot answer the question;
    - a retrieved passage matched an injection pattern.
- **Consequences.** Every flag reason is stored on `agent_answers.flag_reasons`, so the review queue can explain why an answer is there. The threshold is configuration and should be revisited once Gate G1 results exist.

## D-028

**LangChain, not LangGraph, for the agent**

- **Context.** The PRD and kickoff prompt name LangGraph for agent orchestration.
- **Decision.** The owner chose plain LangChain for the Week 1 agent, and will present the rationale.
  - The agent's job is small: search the workspace, read tasks, and propose a task that is held for approval. A single tool-calling loop covers it.
  - The retrieval loop (search, assess, rewrite once, retry) is plain Python with no orchestration framework.
- **Consequences.** No graph state or checkpointer. Approval is handled by `agent_actions` rows and the atomic approve and reject functions ([D-009](#d-009)), not by pausing an agent.

## D-029

**Block note editor on Tiptap, stored as its JSON tree**

- **Context.** The PRD requires a block-based note editor with notes stored as a real block tree, not a flat string.
- **Decision.**
  - The editor is Tiptap 3 (ProseMirror).
  - `notes.content` stores the editor's JSON document unchanged: a `doc` node whose children are typed blocks (paragraph, heading, bulletList, orderedList, taskList, blockquote, codeBlock, horizontalRule), with marks for bold, italic, strike, code and links.
  - The API rejects anything that is not such a tree, notes over 512 KB, and nesting deeper than 40 levels.
  - Editing autosaves after a 700 ms pause, and flushes pending changes when the note closes or the tab is hidden.
  - The API uses `POST /notes` to create and `PATCH /notes/{id}` to update, in place of the PRD's single `POST /notes`.
- **Why.** ProseMirror's document model is already a typed block tree, so storing its JSON satisfies the requirement with no conversion layer, and the agent can walk it on Day 4 to propose tasks from a note.

## D-030

**Rewrite and grade only when retrieval is uncertain**

- **Context.** PRD section 7.1 describes the pipeline as: rewrite the query, run hybrid retrieval, rerank, grade relevance, retry if weak, then check groundedness. Taken literally, that is two model calls before every search. Section 14 warns the full pipeline risks 10 to 20 seconds against a p50 target under 8 seconds.
- **Decision.** The owner chose this order:
  1. The first attempt searches with the user's own question, with no rewrite.
  2. Hybrid search, then the cross-encoder rerank, then MMR.
  3. The reranker's top score is the first grade:
     - at or above 0.50 counts as good, with no model call;
     - below 0.22 counts as weak;
     - only the band in between is graded by the fast model.
  4. A weak result triggers one query rewrite and a second attempt (two attempts at most), and the better attempt is used.
  5. The groundedness check always runs.
  6. The agent never asks the user a clarifying question.
- **Why.** Embeddings handle natural-language questions well, so a rewrite mainly helps a failed first attempt. The cross-encoder has already read the question and each passage together, so its score is a better and free relevance signal than an extra model call in the clear cases. The common path makes zero model calls before answer generation, which protects the latency budget without cutting the retry loop.
- **Consequences.**
  - Grading, retry and groundedness all still exist, as the PRD's MUST scope requires.
  - `retrieval_runs.candidates_json` records each attempt's query, grade and note, so the pipeline health view and Gate G1 can show which path each question took.
  - The demo narration should describe the pipeline in this order.

## D-031

**Fall back to the fast model when the answer model is unavailable**

- **Context.** During live testing on 2026-09-16, `gemini-3.5-flash` returned `504 DEADLINE_EXCEEDED` for every call while `gemini-3.5-flash-lite` answered in about a second. The gateway allowed 60 seconds per call and three attempts, so one question held the request open for minutes before failing.
- **Decision.**
  - Every model call has a hard deadline, 15 seconds since [D-032](#d-032) (`LLM_TIMEOUT_SECONDS`).
  - The answer model gets one try. If it fails or times out, the same call goes to the fast model, with the normal three attempts.
  - Calls that already use the fast model keep three attempts, with no fallback.
  - Fallback answers are not cached under the answer model's key, so the next question tries the answer model again.
- **Why.** A person waiting on an answer is better served by a slightly weaker model now than by an error after a minute. Citations, the groundedness check and the confidence label do not depend on which model wrote the answer.
- **Consequences.**
  - `agent_answers.model` records the model that actually answered, so fallbacks are visible in the review queue and in Gate G1 results.
  - Golden-set runs should check that model column: a run answered mostly by the fast model is not a fair measure of the answer model.

## D-032

**Run on the Gemini free tier with a model chain and cooldowns**

- **Context.** The owner is using a free Gemini API key. During live testing, `gemini-3.5-flash` hit its free-tier limit of 20 requests a day (`429 RESOURCE_EXHAUSTED`). The free-tier models also returned `504 DEADLINE_EXCEEDED` after about 20 seconds at busy times. One question makes one to four model calls, so a single model's free quota covers only a handful of questions a day. D-031's single fallback still waited on the failing model for every call.
- **Decision.**
  - Each generation call walks a chain of models: the requested model, then `GEMINI_FALLBACK_MODELS` (default `gemini-3-flash-preview`), then the other Week 1 model. Fallbacks come before the other model, so grading does not spend the answer model's quota and answers prefer a full model to the lite one.
  - Each model gets one try with a 15-second deadline.
  - A model that fails is skipped for a cooldown: the wait a quota error names, otherwise 120 seconds. If every model is cooling down, the one that recovers first is tried.
  - Only answers from the requested model are cached.
  - Embeddings keep a single model with retries, because a different embedding model would not match the stored vectors.
- **Why.** Free-tier limits are counted per model, so a chain multiplies the usable daily quota at no cost. The cooldown turns a 15-to-20-second wait on every call into a one-off cost.
- **Consequences.**
  - Answer quality can vary within a session. `agent_answers.model` records the model that answered.
  - Golden-set and Gate G1 runs should report the models used. Running the full golden set in one sitting may exhaust the free quota; spread it out, or use a paid key for the measured run.
  - The p50 target under 8 seconds is not reliable on the free tier, because Google deprioritises free traffic at busy times.

## D-033

**Pace document embedding under the free-tier quota**

- **Context.** A 6.8 MB Word document (`PowerProx_Documentation.docx`, 159 chunks) failed with "Embedding failed". The free Gemini tier allows 100 embedding requests a minute and counts every text in a batch as one request. The first batch of 100 used the whole minute, and the second batch was refused. The gateway retried after 0.8 and 1.6 seconds, which could never succeed. The error also wrongly pointed at the API key.
- **Decision.**
  - The gateway keeps a one-minute window of embedded texts (`EMBED_REQUESTS_PER_MINUTE`, default 100) and waits before a batch that would go over it. Document embedding leaves 10 of those free, so a question asked during a large ingestion is not held up.
  - A per-minute quota error waits as long as the provider asks, up to five attempts.
  - A daily quota error fails at once as `QuotaExceeded`, and the document shows "The daily Gemini embedding quota is used up".
  - Embedding never falls back to another model, because its vectors would not match the stored ones.
- **Why.** Ingestion runs in the background, so waiting a minute costs nothing a person sees, while failing loses the upload.
- **Consequences.**
  - A document of about 1,000 chunks takes about 10 minutes on the free tier. It stays in Processing meanwhile.
  - The window is per server process. Several processes sharing one key would need a shared limiter.
  - For a paid key, raise `EMBED_REQUESTS_PER_MINUTE`.
  - Verified live: the 159-chunk document was reprocessed to ready in 73 seconds with all 159 embeddings stored.

## D-034

**Preview passages before embedding finishes**

- **Context.** The owner wants to see the chunks a document was split into before vectorisation completes. On the free tier, embedding a large document takes a minute or more ([D-033](#d-033)), and until now passages were saved only after every embedding succeeded.
- **Decision.** The owner chose a live preview over a manual approval step:
  - Ingestion saves the canonical text and every chunk as soon as the document is chunked, then embeds in batches.
  - `documents.processing_stage` (`parsing`, `embedding`) and `documents.embedded_count` record progress. After each batch, `attach_chunk_embeddings` links the batch's chunks to their embeddings and refreshes the count.
  - The Documents list shows "Embedding 100/159" with a progress bar and a Preview link. The viewer lists every passage with a short preview, marks passages not yet embedded, and shows a progress banner.
  - Both search functions return passages only from documents whose status is `ready`, so a half-embedded document is never partly searchable.
  - A failed document keeps the passages saved before the failure, marked failed and not searchable, until it is reprocessed or deleted.
- **Why.** Showing the passages early lets an Admin check the chunking of a large file straight away without adding a step to every upload. Gating search on `ready` keeps retrieval results consistent.
- **Consequences.**
  - Migration `20260916130000_ingestion_progress` adds the two columns and the function, and redefines both search functions.
  - `GET /documents/{id}` returns chunks during processing, each with `embedded`.
  - Verified live on the 159-chunk document: passages were visible about 2 seconds after parsing, 100 embedded at 23 seconds, ready at 80 seconds.

## D-035

**The Ask page shows the whole reliability record of an answer**

- **Context.** `POST /agent/ask` already returns the answer, its citations, an uncalibrated confidence value, the groundedness result, the flag reasons and the retrieval run. The Ask surface was a placeholder, so none of it reached a person.
- **Decision.**
  - **Citation markers are links.** The backend writes `[n]` markers into the answer text and renumbers them 1..k, so each marker resolves to a citation on the same response. Each marker is a link to `/documents/{document_id}?chunk={chunk_id}`, the route the viewer already reads to highlight an exact passage. Hovering or focusing a marker outlines its passage card, and the passage cards link to the same place.
  - **Stored answers keep their markers as plain text.** `GET /agent/answers` returns the answer text but not its citation targets, so markers in the recent-answers list are shown as written and are not links, rather than inventing a target.
  - **Every answer carries its three signals together:** the confidence value through `ConfidenceLabel`, which always prints "uncalibrated"; the groundedness result as Grounded or Not grounded; and, when flagged, each flag reason written out in plain language.
  - **The retrieval run is on the page**, behind "How this answer was retrieved": model, attempts, grade, top rerank score, whether it reranked, latency and the run id. A rewritten query is stated as such.
  - **Asking is gated on a ready document.** With no document at status `ready`, the page keeps an empty state instead of a question box, because search returns passages only from ready documents ([D-034](#d-034)).
  - **The retrieval profile is a control on the page** (lookup, explore, summarize), because the profile changes how many passages are read and whether grading runs.
  - Enter asks and Shift+Enter starts a new line. A failed question is not retried automatically, because a question spends model quota ([D-032](#d-032)).
- **Why.** The PRD's reliability requirement is only met if a person can check an answer, and checking means reaching the passage. Naming the model that answered matters on the free tier, where the gateway falls back across models and answer quality changes with it ([D-031](#d-031), [D-032](#d-032)).
- **Consequences.**
  - `AskPage` moves out of `routes/surfaces.tsx` into `routes/AskPage.tsx`; `surfaces.tsx` now holds only the admin placeholders.
  - The review queue and audit views can reuse `AnswerSignals` and `AnswerText`, so a flagged answer reads the same in both places.
  - The Ask page does not yet filter by document, although `POST /agent/ask` accepts `document_ids`.

## D-036

**Golden set anchors on quotes, and the eval runs offline in two passes**

- **Context.** Gate G1 needs 15 owner-written questions run against the pipeline, with the correct-citation rate reported. The free Gemini tier allows roughly 20 requests a day per model ([D-032](#d-032)), and one question costs two to four generation calls, so a full run is close to a day's quota and can only be done once.
- **Decision.**
  - **A question names its expected passage by a verbatim quote, never a chunk id.** Chunk ids are regenerated on every reprocess ([D-034](#d-034)), so a set keyed on them would break the first time the corpus is re-ingested. `evals.validate` resolves each quote against the stored document text at run time, folding whitespace, case and curly punctuation so a pasted quote still matches, then maps the match back to real character offsets and finds the passages containing it. A quote that is missing, or that straddles a passage boundary and sits inside no single passage, fails the dataset before any model call.
  - **Two passes.** `--retrieval-only` embeds, searches and reranks with **no generation calls at all**, answering whether the expected passage was retrieved and at what rank. The full run is the measured one. A passage that is never retrieved cannot be cited, so retrieval is fixed for free before generation quota is spent.
  - **G1 is scored over answerable questions only.** An unanswerable question has no correct passage, so refusal questions are a separate set with their own metric. Over-refusal on the answerable set is reported too, because a refusal-only metric hides it.
  - **The harness runs offline with the service role**, calling `agentic_retrieve`, `generate_answer` and `record_answer` directly. No browser sign-in, and no `meridian-e2e-*` accounts to clean up afterwards. Rows still land in `retrieval_runs`, `agent_answers` and `answer_citations`, so Pipeline Health later reads real data.
  - **The machine scores what is mechanical; a person scores the prose.** Each result carries a `grading` block (`answer_correct`, `citation_acceptable`, `notes`) left null by the runner. `citation_acceptable` is an override in both directions: the model sometimes cites a different passage that genuinely supports the answer, and scoring against one expected quote would call that wrong. The report shows the auto figure and the override count separately, so the adjustment is visible.
  - **Ingestion is sequential and resumable.** A document already ready is skipped, so a run stopped by the daily embedding quota resumes the next day, and `ready` is only accepted when every passage is embedded.
  - `golden.jsonl` and `golden-docs/` are git-ignored, because their quotes are verbatim extracts from documents that may not be the owner's to commit.
- **Consequences.**
  - `storage.upload` accepts `user_token=None` and uses the service role, for ingestion with no caller to act for.
  - The report warns when any gate question was answered by a fallback model, and names the run unfair per [D-031](#d-031) rather than reporting the number quietly.
  - The harness does not write the questions. Per `docs/product/overview.md`, the golden set is authored by a person independently of the model under test.

## D-037

**Persist the answering model, and record what the free Voyage tier costs retrieval**

- **Context.** The first real Gate G1 run exposed two gaps between the decision log and the code.
  - [D-031](#d-031) and [D-032](#d-032) both state that `agent_answers.model` records the model that answered, and D-032 requires golden-set runs to report it. **The column was never created.** Eight of twenty answers in the run came from a fallback model, and none of that was visible in the database.
  - The Voyage reranker's free tier, with no payment method on the key, allows 3 requests a minute **and 10,000 tokens a minute**. A `lookup` request reranks 20 passages and fits. `explore` (40) and `summarize` (45) do not, so a single `summarize` question cannot rerank at all, even with no other traffic.
- **Decision.**
  - Migration `20260916160000_answer_model` adds `agent_answers.model`, and `record_answer` writes `outcome.model`. Rows written earlier keep a null model, which is honest: that value was never recorded and cannot be recovered. `GET /agent/answers` returns it and the Ask page shows it beside the confidence value.
  - The eval runner gains `--pace`, and **marks any run that lost reranking as not a valid measurement**. Without a rerank score the retrieval grade falls back to a model call ([D-030](#d-030)) and the confidence value is null ([D-027](#d-027)), so such a run measures a different, degraded pipeline.
  - The free-tier rerank limit is recorded as a **known constraint, not fixed here**. Pacing the product would add waits to a person's question; paying for the key would not. That is the owner's call.
- **Consequences.**
  - The review queue and pipeline health view can group answers by model, so a fallback-heavy period is visible rather than inferred.
  - **On the current Voyage key the `summarize` profile is unmeasurable**, and `explore` is unreliable under any concurrency. Only `lookup` reranks dependably. Gate G1 results should say which profiles were used.
  - In the product, four questions in a minute silently degrade the fourth: unreranked results, no confidence value, and an extra model call, with no error shown to the user.

## D-038

**Evaluation metrics beyond the gate, with intervals and objective key facts**

- **Context.** The first G1 report gave a pass rate and little else. Three problems showed up while checking it: a perfect score on 15 questions said nothing about uncertainty; completeness depended entirely on a person grading (U-02 omitted the salary figure and nothing automatic noticed); and a rank recorded before an expected passage was corrected showed up as a retrieval miss.
- **Decision.**
  - A pure `evals.metrics` module computes, from existing runs only: Recall@1/3/5, MRR, correct-citation rate, strict citation precision, key-fact coverage, groundedness, correct and false refusals, human-grade counts, latency p50/p95, model mix, runs without rerank, confidence when right versus wrong, a breakdown by question type, and a PRD target table.
  - Every rate carries a 95% Wilson interval.
  - Golden questions may carry `must_include` key facts, matched as whole tokens with case, hyphens and curly quotes folded. `evals.validate` rejects a fact absent from the source document.
  - A PRD rule that the run never exercised is reported as **not exercised**, not as a pass. A rank that cannot be recomputed is excluded from Recall@k and named, not counted as a miss.
  - Full runs now keep the retrieved list, so a later correction to an expected passage can be re-scored without a new run.
  - The report writes `<results>.metrics.json`, and results files only ever gain fields, so an external reviewer page keeps working.
- **Consequences.**
  - On the first run: Recall@1 16/16 (95% CI 81-100%), citations 17/17, key facts complete 16/17 with U-02 missing `100,000`, **p50 latency 10.1 s against the 8 s target (fail)**, the flagging rule not exercised, and the red-team suite not run.
  - Recall@1, @3 and @5 are identical, so the current set is too easy to separate retrieval quality. Harder questions are needed before the metrics can show a regression.

## D-039

**The workspace agent: LangChain tools, a JSON tool loop through the gateway, and proposals that need the user's own words**

- **Context.** Day 4 needs an agent that answers "what do I have to do" and can create tasks, without ever writing a task itself (non-negotiable 1), with plain LangChain rather than LangGraph ([D-028](#d-028)). The PRD also requires that only the user's own turns can trigger a write, proven rather than asserted.
- **Decision.**
  - **Tools** are `langchain_core` structured tools, bound per request to the person asking: `list_tasks` (mine, all or unassigned, by status), `get_task` (with subtasks), `list_members`, `search_workspace` (hybrid retrieval, passages wrapped as untrusted) and `propose_task`. Reads use the caller's own database client, so row-level security limits the agent to what that person can see.
  - **The loop** asks the model for one JSON decision per step, a tool call or a reply, for at most six tool steps; the last step can only reply. Tool arguments are validated by the tool's schema, and invalid JSON, unknown tools, bad arguments and failing tools are reported back to the model instead of raised. The model is reached **through the existing gateway**, not a LangChain Gemini client, so the agent keeps the free-tier model chain, cooldowns and deadlines ([D-032](#d-032)). It uses the fast model: tool routing is simple, and the answer model's daily quota is the scarcer one.
  - **`propose_task` writes a pending `agent_actions` row and an `agent_action.proposed` audit entry with `actor_type` agent,** never a task. Approval stays in the existing atomic `approve_agent_action` function.
  - **Two structural guards on proposals:** the call must carry `user_request_quote`, which must be an excerpt of at least three words of the user's *current* message; and once any retrieved passage matches the injection scanner, proposals are refused for the rest of that turn. At most five proposals per message. Assignees must be workspace members; parent tasks must be in the workspace.
  - `POST /agent/chat` is stateless: the client sends the recent conversation. Every turn is audit-logged as `agent.chat` with the tools used, their arguments, any proposal ids, whether injection was detected and the models that answered.
  - The Assistant page shows what the agent did for each reply, proposals with a link to the Tasks page, and citations from document searches. It states that replies are not groundedness-checked and points to Ask for checked document answers.
- **Why.** The quote rule turns "only the user can ask for a write" into something a unit test can check: text arriving through a tool is not in the user's message and cannot satisfy it. The taint rule covers the case where a poisoned passage and a genuine request arrive in the same turn.
- **Consequences.**
  - Verified live on the E2E workspace: "What do I have to do?" returned exactly the member's four open tasks, overdue first; a workspace-wide overdue question matched the database; a task request produced a proposal, and approving it through `approve_agent_action` created the task with `source` agent and a two-entry audit trail, proposed by the agent then approved by the Admin. **Gate G2 passes.**
  - "Next Friday" on a Wednesday resolved to the Friday of the following week, not the same week. Reasonable, but worth knowing.
  - Agent replies about documents are not groundedness-checked or confidence-scored; `/agent/ask` remains the checked path.
  - The PRD's 8-document injection red-team suite still has to be run against this agent before Day 5.
