# Data model

Defined in [`supabase/migrations/20260915120000_core_schema.sql`](../../supabase/migrations/20260915120000_core_schema.sql). Row-level security is enabled on every table. Columns that go beyond the PRD are marked with the decision that added them.

```mermaid
erDiagram
    users ||--o{ workspace_members : "belongs to"
    workspaces ||--o{ workspace_members : has
    workspaces ||--o{ workspace_invites : has
    workspaces ||--o{ documents : holds
    documents ||--o{ chunks : "split into"
    chunk_embeddings |o--o| chunks : "embedding_ref"
    workspaces ||--o{ notes : holds
    workspaces ||--o{ tasks : holds
    workspaces ||--o{ retrieval_runs : records
    retrieval_runs |o--o{ agent_answers : produces
    agent_answers ||--o{ answer_citations : cites
    chunks ||--o{ answer_citations : "cited by"
    workspaces ||--o{ agent_actions : proposes
    workspaces ||--o{ audit_log : records
    workspaces ||--o{ admin_reviews : records
```

## Identity and workspaces

**`users`** mirrors `auth.users`. It is created by the sign-up trigger.
`id` (= auth user id) · `email` · `full_name`, `avatar_url` ([D-011](../decisions.md#d-011)) · `created_at`

**`workspaces`**. Created only through `create_workspace(name)`, which also makes the caller Admin ([D-006](../decisions.md#d-006)).
`id` · `name` (1–80 chars) · `owner_id` · `created_at`

**`workspace_members`**. One row per person per workspace.
`id` · `workspace_id` · `user_id` · `auth_role` (`Admin` or `Member`) · `team_role` (nullable, 1–80 chars, free text; what the person does on the team, read by the agent when proposing an assignee, [D-047](../decisions.md#d-047)) · `joined_at`

**`workspace_invites`** ([D-007](../decisions.md#d-007)). At most one pending invite per email per workspace.
`id` · `workspace_id` · `email` · `auth_role` · `invited_by` · `created_at` · `accepted_at`

## Content

**`documents`**
`id` · `workspace_id` · `uploaded_by` · `file_path` (storage path `{workspace_id}/{document_id}/{file_name}`) · `file_name`, `mime_type`, `size_bytes`, `parse_error` ([D-011](../decisions.md#d-011)) · `parsed_status` (`pending`, `processing`, `ready`, `failed`) · `created_at` · `doc_type` (`pdf`, `docx`), `content_text` (canonical extracted text; chunk offsets index into it), `page_count`, `chunk_count`, `parse_stats`, `content_hash` (unique per workspace), `processed_at` ([D-023](../decisions.md#d-023)) · `processing_stage` (`parsing`, `embedding`, or null when not processing), `embedded_count` ([D-034](../decisions.md#d-034))

**`chunks`**
`id` · `document_id` · `workspace_id`, `chunk_index` ([D-008](../decisions.md#d-008)) · `content` (always `documents.content_text[char_start:char_end]`) · `char_start`, `char_end` · `embedding_ref` → `chunk_embeddings` (null until the chunk is embedded; chunks are saved before embedding, [D-034](../decisions.md#d-034)) · `created_at` · `kind` (`text`, `table`, `code`), `section`, `page`, `token_count`, `context` (heading path and table header; embedded but not cited) · `search_tsv` (generated, weighted `context` + `content`, the keyword signal) ([D-023](../decisions.md#d-023), [D-025](../decisions.md#d-025))

**`chunk_embeddings`** ([D-005](../decisions.md#d-005))
`id` · `workspace_id` · `document_id` (cascade delete) · `model` (e.g. `gemini-embedding-001@1536`) · `embedding vector(1536)`, unit length, HNSW cosine index · `created_at`

**`notes`**
`id` · `workspace_id` · `created_by` · `title`, `created_at` ([D-011](../decisions.md#d-011)) · `content` (jsonb block tree, must be an object) · `updated_at` (maintained by trigger)

**`tasks`**
`id` · `workspace_id` · `sprint_id` (nullable, no foreign key, [D-010](../decisions.md#d-010)) · `title` · `status` (`todo`, `in_progress`, `done`) · `assignee_id` · `due_date` · `created_by` · `source` (`manual` or `agent`) · `created_at` · `description`, `priority` (`none` … `urgent`), `parent_task_id` (subtasks, same workspace, no loops, cascade delete), `position` (ordering), `updated_at`, `completed_at` (set when done) ([D-020](../decisions.md#d-020))

## Agent, retrieval and oversight

**`retrieval_runs`**. One row per question asked.
`id` · `workspace_id` · `asked_by` ([D-011](../decisions.md#d-011)) · `question` · `candidates_json` (per attempt: query, grade, and every candidate's dense rank and similarity, keyword rank and score, fused and rerank scores) · `rerank_scores_json` (final passages) · `grade_outcome` · `retry_count` · `latency_ms` · `final_query`, `profile`, `top_score` · `created_at`

**`agent_answers`**
`id` · `workspace_id` · `asked_by`, `retrieval_run_id` ([D-011](../decisions.md#d-011)) · `question` · `answer` · `confidence` (0–1, **uncalibrated**, [D-027](../decisions.md#d-027)) · `groundedness_pass` · `created_at` · `flagged`, `flag_reasons`, `general_knowledge`

**`answer_citations`**
`id` · `answer_id` · `chunk_id` · `ordinal` (the `[n]` marker, [D-011](../decisions.md#d-011)) · `created_at`

**`agent_actions`**. Proposals held for approval (non-negotiable 1).
`id` · `workspace_id` · `action_type` (`create_task`) · `target_table` (`tasks`) · `target_id` (null until approved) · `proposed_payload`, `decided_by`, `decided_at` ([D-009](../decisions.md#d-009)) · `reasoning` · `before_state` · `status` (`pending`, `approved`, `rejected`) · `created_at`

**`audit_log`**. Append-only for every role ([D-012](../decisions.md#d-012)).
`id` · `workspace_id` ([D-004](../decisions.md#d-004)) · `actor_id` · `actor_type` (`user`, `agent`, `system`) · `action` · `target_type` ([D-011](../decisions.md#d-011)) · `target_id` · `timestamp` · `details`

**`admin_reviews`**
`id` · `workspace_id` ([D-004](../decisions.md#d-004)) · `review_target_type` (`agent_answer` or `agent_action`) · `review_target_id` · `reviewer_id` · `decision` (`confirmed`, `corrected`, `dismissed`) · `notes` · `reviewed_at`

## Database functions and triggers

| Name | Kind | Purpose |
| --- | --- | --- |
| `public.create_workspace(name)` | Function | Creates a workspace, makes the caller Admin and writes an audit entry, atomically |
| `private.is_member(ws)`, `private.is_admin(ws)` | Function | Role checks used by RLS policies; they only answer for the current user |
| `private.shares_workspace(user)` | Function | Lets people see profiles of co-members only |
| `on_auth_user_created` | Trigger on `auth.users` | Creates the profile and accepts pending invites |
| `tasks_member_update_guard` | Trigger | Members may change `status` and `position` only ([D-021](../decisions.md#d-021)) |
| `tasks_validate_parent` | Trigger | A subtask's parent is in the same workspace, and the tree has no loops |
| `tasks_touch` | Trigger | Maintains `updated_at` and `completed_at` |
| `public.approve_agent_action(action, approver)` | Function (service role only) | Re-checks Admin, writes the task as `source = 'agent'`, records the decision and audit entry in one transaction |
| `public.reject_agent_action(action, approver)` | Function (service role only) | Re-checks Admin, records the rejection and audit entry; writes no task |
| `public.find_user_id_by_email(email)` | Function (service role only) | Finds an account for adding a member by email |
| `public.match_chunks_dense(workspace, embedding, count, document_ids)` | Function (runs as caller) | Cosine search over the workspace's embeddings, optional document filter |
| `public.match_chunks_sparse(workspace, query, count, document_ids)` | Function (runs as caller) | Full-text search (any term) over the workspace's chunks, ranked by cover density |
| `audit_log_no_update` | Trigger | Rejects updates and deletes on `audit_log` |
| `workspace_members_keep_one_admin` | Trigger | A workspace keeps at least one Admin |
| `notes_touch_updated_at` | Trigger | Maintains `notes.updated_at` |

## Storage

The `documents` bucket is private, limited to 25 MB, and accepts PDF and DOCX only. Object paths start with the workspace id. Members of that workspace can read objects; Admins can upload and delete them.

### `sprints`

`id` · `workspace_id` · `name` (1–80 chars) · `start_date` · `end_date` · `status` (`planned`, `active`, `completed`) · `created_at`

A task with `sprint_id is null` is in the **backlog**; there is no backlog table ([D-048](../decisions.md#d-048)). A partial unique index allows at most one `active` sprint per workspace. Deleting a sprint sets its tasks' `sprint_id` to null, returning them to the backlog rather than deleting work. Members read; only Admins write, and `sprint_id` is not a column a Member may change.
