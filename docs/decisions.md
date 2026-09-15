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
| [D-029](#d-029) | Block note editor on Tiptap, stored as its JSON tree | Accepted | Engineering | 2026-09-16 |

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
