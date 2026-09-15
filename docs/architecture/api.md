# API reference

- **Base URL (local):** `http://localhost:8000`. Interactive docs are at `/docs` everywhere except production.
- **Authentication:** `Authorization: Bearer <Supabase access token>`.
- **Workspace scope:** workspace-scoped routes take `X-Workspace-Id: <uuid>`. The caller must be a member of that workspace.

## Errors

Errors return `{"detail": "<message>"}`.

| Status | Meaning |
| --- | --- |
| 401 | Missing, malformed, expired or wrongly signed token |
| 400 | A workspace-scoped route was called without `X-Workspace-Id` |
| 403 | Not a member of the workspace, or the role does not allow the action |
| 404 | The member, invite or task does not exist in this workspace |
| 409 | Conflicts with current state: already a member, already invited, or the last Admin |
| 422 | Invalid input, such as a bad email, blank name or malformed id |
| 503 | A dependency (the workspace lookup) is unavailable. Never answered with unscoped data |

## Implemented

| Method and path | Scope | Role | Returns |
| --- | --- | --- | --- |
| `GET /health` | None | Public | `{"status": "ok"}` |
| `GET /me` | Signed in | Any | `user` (id, email, full_name, avatar_url) and `workspaces` (id, name, auth_role, created_at) |
| `GET /workspaces` | Signed in | Any | Workspaces the caller belongs to |
| `POST /workspaces` | Signed in | Any | Creates a workspace; caller becomes Admin. Body `{name}` (1–80 chars, trimmed) |
| `PATCH /workspace` | Workspace | Admin | Renames the workspace. Body `{name}` |
| `DELETE /members/me` | Workspace | Any | Leaves the workspace. 409 if the caller is its last Admin |
| `GET /members` | Workspace | Any | `members` with profiles; `invites` (pending) for Admins only |
| `POST /admin/members` | Workspace | Admin | Body `{email, auth_role}`. Adds an existing account (`outcome: "added"`) or stores a pending invite (`"invited"`). 409 if already a member or already invited |
| `PATCH /admin/members/{id}` | Workspace | Admin | Body `{auth_role}`. 409 if it would leave no Admin |
| `DELETE /admin/members/{id}` | Workspace | Admin | Removes a member. 409 if it would leave no Admin |
| `DELETE /admin/invites/{id}` | Workspace | Admin | Revokes a pending invite |
| `GET /tasks` | Workspace | Any | `tasks` (with assignee and creator profiles) and `proposals` (pending agent actions) |
| `POST /tasks` | Workspace | Admin | Body `{title, description?, status?, priority?, due_date?, assignee_id?, parent_task_id?}`. Assignee must be a member |
| `PATCH /tasks/{id}` | Workspace | Admin: any field. Member: `status`, `position` only | Returns the updated task. 409 for a loop in the subtask tree |
| `DELETE /tasks/{id}` | Workspace | Admin | Deletes the task and its subtasks |
| `POST /agent/actions/{id}/approve` | Workspace | Admin | Writes the proposed task (`source: "agent"`), records the decision and audit entry atomically. 409 if already decided |
| `POST /agent/actions/{id}/reject` | Workspace | Admin | Records the rejection and audit entry; writes no task. 409 if already decided |
| `GET /documents` | Workspace | Any | Documents with status (`pending`, `processing`, `ready`, `failed`), parse error, page and chunk counts, parse stats, uploader |
| `GET /documents/{id}` | Workspace | Any | The document plus `content_text` and every chunk's `char_start`, `char_end`, page, section, kind and token count |
| `POST /documents/upload` | Workspace | Admin | Multipart `file` (PDF or DOCX, ≤ 25 MB). Returns 202 with `parsed_status: "pending"`; processing continues in the background. 409 duplicate, 413 too large, 415 unsupported type |
| `POST /documents/{id}/reprocess` | Workspace | Admin | Re-runs parsing and embedding. 409 while already processing |
| `DELETE /documents/{id}` | Workspace | Admin | Deletes the document, its chunks, embeddings and stored file |

"Workspace" scope means the request carries `X-Workspace-Id`, and the caller must be a member of that workspace. All handlers query the database as the caller, so row-level security applies ([D-018](../decisions.md#d-018)). Member changes, invites and renames are written to the audit log.

## Planned (MUST scope)

| Method and path | Role | Purpose |
| --- | --- | --- |
| `POST /notes` | Member | Create or update a note |
| `POST /agent/ask` | Member | Ask a grounded question |
| `GET /admin/review-queue` | Admin | Flagged answers and pending actions |
| `POST /admin/reviews/{target_type}/{target_id}` | Admin | Record a review decision |
| `GET /admin/audit-log` | Admin | Audit trail |
| `GET /admin/pipeline-health` | Admin | Metrics computed from `retrieval_runs` |

Beyond the PRD: the workspace and member routes ([D-006](../decisions.md#d-006), [D-007](../decisions.md#d-007)), and `POST`, `PATCH` and `DELETE /tasks` for the task views ([D-020](../decisions.md#d-020), [D-021](../decisions.md#d-021)).
