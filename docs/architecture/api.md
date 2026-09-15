# API reference

- **Base URL (local):** `http://localhost:8000`. Interactive docs are at `/docs` everywhere except production.
- **Authentication:** `Authorization: Bearer <Supabase access token>`.
- **Workspace scope:** workspace-scoped routes take `X-Workspace-Id: <uuid>`. The caller must be a member of that workspace.

## Errors

Errors return `{"detail": "<message>"}`.

| Status | Meaning |
| --- | --- |
| 401 | Missing, malformed, expired or wrongly signed token |
| 403 | Not a member of the workspace, or the role does not allow the action |
| 503 | A dependency (the workspace lookup) is unavailable. Never answered with unscoped data |

## Implemented

| Method and path | Auth | Returns |
| --- | --- | --- |
| `GET /health` | None | `{"status": "ok"}` |
| `GET /me` | Token and workspace membership | `user_id`, `email`, `workspace_id`, `workspace_name`, `auth_role` |

> `GET /me` will change shape when workspace endpoints land: it will return the user and a list of their workspaces, and stop requiring a membership. See [progress.md](../progress.md).

## Planned (MUST scope)

| Method and path | Role | Purpose |
| --- | --- | --- |
| `GET /workspaces` | Signed in | Workspaces the caller belongs to |
| `POST /workspaces` | Signed in | Create a workspace; caller becomes Admin |
| `POST /documents/upload` | Admin | Upload and parse a document |
| `POST /notes` | Member | Create or update a note |
| `POST /agent/ask` | Member | Ask a grounded question |
| `GET /tasks` | Member | Tasks, plus agent proposals awaiting approval |
| `PATCH /tasks/{id}` (status only) | Member | Change a task's status |
| `POST /agent/actions/{id}/approve` | Admin | Approve and write a proposed action; audit logged |
| `POST /agent/actions/{id}/reject` | Admin | Reject a proposal; nothing written; audit logged |
| `GET /admin/review-queue` | Admin | Flagged answers and pending actions |
| `POST /admin/reviews/{target_type}/{target_id}` | Admin | Record a review decision |
| `GET /admin/audit-log` | Admin | Audit trail |
| `GET /admin/pipeline-health` | Admin | Metrics computed from `retrieval_runs` |
| `POST /admin/members` | Admin | Add or invite a member with a role |

Two rows go beyond the PRD. `PATCH /tasks/{id}` is limited to status here because Members may change status ([D-006](../decisions.md#d-006)). The workspace routes are also new ([D-006](../decisions.md#d-006)).
