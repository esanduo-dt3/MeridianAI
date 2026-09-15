# Roles and permissions

Roles belong to a person **within a workspace**, stored on `workspace_members.auth_role`. The same person can be an Admin in one workspace and a Member in another. The owner decisions behind this page are [D-006](../decisions.md#d-006) and [D-007](../decisions.md#d-007).

## Joining and workspaces

- Signing in for the first time creates the person's profile. They start with **no workspace**.
- Anyone signed in can **create a workspace** and becomes its **Admin**.
- An Admin adds people by email and chooses **Admin** or **Member**.
  - If the person has never signed in, the invite waits and applies automatically on their first Google sign-in.
- A workspace always keeps **at least one Admin**. The last Admin cannot be removed or demoted.
- Anyone can leave a workspace, unless they are its last Admin.

## What each role can do

| Capability | Admin | Member | Not a member |
| --- | :---: | :---: | :---: |
| See the workspace, its notes, documents and tasks | ✓ | ✓ | – |
| Ask the agent and read cited answers | ✓ | ✓ | – |
| Create and edit notes | ✓ | ✓ | – |
| Delete a note | ✓ | Own notes | – |
| Change a task's status | ✓ | ✓ | – |
| Create a task, or edit its title, assignee or due date | ✓ | – | – |
| Delete a task | ✓ | – | – |
| Upload or delete documents | ✓ | – | – |
| See agent-proposed tasks | ✓ | ✓ | – |
| Approve or reject agent-proposed tasks | ✓ | – | – |
| Review queue: confirm, correct or dismiss | ✓ | – | – |
| Audit log | ✓ | – | – |
| Pipeline health | ✓ | – | – |
| Add, invite or remove members; change roles | ✓ | – | – |
| Rename the workspace | ✓ | – | – |

## Where each rule is enforced

The backend checks the role before every action. The database enforces the same rules again with row-level security, so a mistake in one layer does not open access.

| Rule | Backend | Database |
| --- | --- | --- |
| Only members can read a workspace | `get_workspace_context` | RLS `*: members read` policies |
| Admin-only actions | `require_admin` | RLS `admins …` policies |
| Members change task status only | Endpoint validation | `tasks_member_update_guard` trigger |
| Agent writes need approval | Approve endpoint (Admin) | Users cannot write `agent_actions`; tasks from the agent are written only by the service role |
| Audit log cannot be altered | No update or delete paths | `audit_log_no_update` trigger, for every role |
| Last Admin stays | Endpoint validation | `workspace_members_keep_one_admin` trigger |

These rules are exercised by `supabase/tests/rls_behaviour.sh` (36 checks). See [guides/database.md](../guides/database.md#testing-access-rules).
