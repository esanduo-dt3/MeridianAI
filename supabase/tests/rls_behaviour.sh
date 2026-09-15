#!/usr/bin/env bash
# Behaviour checks for the access model in docs/product/roles-and-permissions.md.
# Runs against the throwaway database created by scripts/db/test-local.sh.
set -uo pipefail

PORT="${PGTEST_PORT:-54329}"
A=aaaaaaaa-0000-0000-0000-000000000001  # creates the workspace (Admin)
B=bbbbbbbb-0000-0000-0000-000000000002  # invited as Member
C=cccccccc-0000-0000-0000-000000000003  # outsider
PASS=0
FAIL=0

db() { psql -h 127.0.0.1 -p "$PORT" -U postgres -d meridian_test -X -q -At -v ON_ERROR_STOP=1 "$@"; }

session() {
  case "$1" in
    anon)    echo "set role anon; select set_config('request.jwt.claims', '{\"role\":\"anon\"}', false);" ;;
    service) echo "set role service_role; select set_config('request.jwt.claims', '{\"role\":\"service_role\"}', false);" ;;
    *)       echo "set role authenticated; select set_config('request.jwt.claims', '{\"sub\":\"$1\",\"role\":\"authenticated\"}', false);" ;;
  esac
}

# check <label> <who> <ok|fail|=value> <sql>
check() {
  local label="$1" who="$2" expect="$3" sql="$4" out rc passed=0
  out="$(db -c "$(session "$who")" -c "$sql" 2>&1)"
  rc=$?
  out="$(printf '%s\n' "$out" | grep -v '^{' | tail -1)"
  case "$expect" in
    ok)   [[ $rc -eq 0 ]] && passed=1 ;;
    fail) [[ $rc -ne 0 ]] && passed=1 ;;
    =*)   [[ $rc -eq 0 && "$out" == "${expect#=}" ]] && passed=1 ;;
  esac
  if [[ $passed -eq 1 ]]; then
    PASS=$((PASS + 1)); echo "  pass  $label"
  else
    FAIL=$((FAIL + 1)); echo "  FAIL  $label (exit=$rc, output=$out)"
  fi
}

value_as() { db -c "$(session "$1")" -c "$2" | tail -1; }

echo "Sign-up and workspaces"
db -c "insert into auth.users (id, email, raw_user_meta_data) values ('$A', 'alice@digitalt3.com', '{\"full_name\":\"Alice\"}')" >/dev/null
check "new user starts with no workspace" "$A" "=0" "select count(*) from public.workspaces"
W="$(value_as "$A" "select id from public.create_workspace('Meridian Demo')")"
check "creator becomes Admin" "$A" "=Admin" "select auth_role from public.workspace_members where workspace_id = '$W' and user_id = '$A'"
check "admin invites by email" "$A" ok "insert into public.workspace_invites (workspace_id, email, auth_role, invited_by) values ('$W', 'bob@digitalt3.com', 'Member', '$A')"
db -c "insert into auth.users (id, email) values ('$B', 'BOB@DigitalT3.com')" >/dev/null
db -c "insert into auth.users (id, email) values ('$C', 'carol@example.com')" >/dev/null
check "invite applies on first sign-in, email case-insensitive" "$B" "=Member" "select auth_role from public.workspace_members where user_id = '$B'"
check "invite is marked accepted" "$A" "=1" "select count(*) from public.workspace_invites where accepted_at is not null"
check "member cannot invite" "$B" fail "insert into public.workspace_invites (workspace_id, email, auth_role, invited_by) values ('$W', 'eve@example.com', 'Admin', '$B')"

echo "Notes, documents and tasks"
check "member creates a note" "$B" ok "insert into public.notes (workspace_id, created_by, title) values ('$W', '$B', 'Kickoff')"
check "member edits a note" "$B" "=Kickoff v2" "update public.notes set title = 'Kickoff v2' where workspace_id = '$W' returning title"
check "member cannot register a document" "$B" fail "insert into public.documents (workspace_id, uploaded_by, file_path, file_name, mime_type, size_bytes) values ('$W', '$B', '$W/x/a.pdf', 'a.pdf', 'application/pdf', 1)"
check "admin registers a document" "$A" ok "insert into public.documents (workspace_id, uploaded_by, file_path, file_name, mime_type, size_bytes) values ('$W', '$A', '$W/d/a.pdf', 'a.pdf', 'application/pdf', 1)"
check "member cannot create a task" "$B" fail "insert into public.tasks (workspace_id, title, created_by) values ('$W', 'Nope', '$B')"
T="$(value_as "$A" "insert into public.tasks (workspace_id, title, created_by) values ('$W', 'Draft plan', '$A') returning id")"
check "member changes task status" "$B" "=in_progress" "update public.tasks set status = 'in_progress' where id = '$T' returning status"
check "member cannot change task title" "$B" fail "update public.tasks set title = 'Hijacked' where id = '$T'"
check "member cannot change task assignee" "$B" fail "update public.tasks set assignee_id = '$B' where id = '$T'"
check "admin edits task fields" "$A" "=Draft plan v2" "update public.tasks set title = 'Draft plan v2' where id = '$T' returning title"

echo "Isolation between workspaces"
check "outsider sees no workspaces" "$C" "=0" "select count(*) from public.workspaces"
check "outsider sees no tasks" "$C" "=0" "select count(*) from public.tasks"
check "outsider sees only themselves in users" "$C" "=1" "select count(*) from public.users"
check "member sees co-members in users" "$B" "=2" "select count(*) from public.users"
check "outsider cannot write a note into the workspace" "$C" fail "insert into public.notes (workspace_id, created_by) values ('$W', '$C')"
db -c "$(session "$C")" -c "update public.tasks set status = 'done' where id = '$T'" >/dev/null 2>&1
check "outsider's task update changes nothing" "$A" "=in_progress" "select status from public.tasks where id = '$T'"

echo "Oversight and guardrails"
check "member cannot read the audit log" "$B" "=0" "select count(*) from public.audit_log"
check "admin reads the audit log" "$A" "=t" "select count(*) >= 2 from public.audit_log"
check "member cannot read retrieval runs" "$B" "=0" "select count(*) from public.retrieval_runs"
check "users cannot write agent actions directly" "$B" fail "insert into public.agent_actions (workspace_id, action_type, target_table, proposed_payload, reasoning) values ('$W', 'create_task', 'tasks', '{}', 'x')"
check "audit log rejects updates, even from the service role" service fail "update public.audit_log set action = 'tampered'"
check "audit log rejects deletes" service fail "delete from public.audit_log"
check "anonymous access is denied" anon fail "select * from public.tasks"
check "users cannot look up accounts by email" "$A" fail "select public.find_user_id_by_email('bob@digitalt3.com')"
check "service role looks up an account by email" service "=$B" "select public.find_user_id_by_email(' BOB@digitalt3.com ')"
check "last admin cannot be removed" "$A" fail "delete from public.workspace_members where user_id = '$A' and workspace_id = '$W'"
check "admin promotes a member" "$A" ok "update public.workspace_members set auth_role = 'Admin' where user_id = '$B' and workspace_id = '$W'"
check "admin can leave once another admin exists" "$A" ok "delete from public.workspace_members where user_id = '$A' and workspace_id = '$W'"

echo "Storage"
E=eeeeeeee-0000-0000-0000-000000000005
db -c "insert into auth.users (id, email) values ('$E', 'erin@example.com')" >/dev/null
db -c "insert into public.workspace_members (workspace_id, user_id, auth_role) values ('$W', '$E', 'Member')" >/dev/null
check "admin uploads a file" "$B" ok "insert into storage.objects (bucket_id, name) values ('documents', '$W/doc1/file.pdf')"
check "member cannot upload a file" "$E" fail "insert into storage.objects (bucket_id, name) values ('documents', '$W/doc2/file.pdf')"
check "outsider cannot upload a file" "$C" fail "insert into storage.objects (bucket_id, name) values ('documents', '$W/doc3/file.pdf')"
check "member lists workspace files" "$E" "=1" "select count(*) from storage.objects"
check "outsider lists no files" "$C" "=0" "select count(*) from storage.objects"

echo "Subtasks, ordering and agent proposals"
W2="$(value_as "$C" "select id from public.create_workspace('Carol Space')")"
C_TASK="$(value_as "$C" "insert into public.tasks (workspace_id, title, created_by) values ('$W2', 'Carol task', '$C') returning id")"
SUB="$(value_as "$B" "insert into public.tasks (workspace_id, title, created_by, parent_task_id) values ('$W', 'Subtask', '$B', '$T') returning id")"
check "admin creates a subtask" "$B" "=$T" "select parent_task_id from public.tasks where id = '$SUB'"
check "subtask cannot point at another workspace's task" service fail "insert into public.tasks (workspace_id, title, created_by, parent_task_id) values ('$W', 'Cross', '$B', '$C_TASK')"
check "a task cannot move under its own subtask" service fail "update public.tasks set parent_task_id = '$SUB' where id = '$T'"
check "a task cannot be its own parent" service fail "update public.tasks set parent_task_id = id where id = '$T'"
check "member reorders a task" "$E" "=42" "update public.tasks set position = 42 where id = '$T' returning position"
check "member cannot change priority" "$E" fail "update public.tasks set priority = 'urgent' where id = '$T'"
check "member cannot re-parent a task" "$E" fail "update public.tasks set parent_task_id = null where id = '$SUB'"
check "done sets completed_at" "$E" "=t" "update public.tasks set status = 'done' where id = '$SUB' returning completed_at is not null"
check "reopening clears completed_at" "$E" "=t" "update public.tasks set status = 'todo' where id = '$SUB' returning completed_at is null"
db -c "delete from public.tasks where id = '$T'" >/dev/null
check "deleting a parent removes its subtasks" service "=0" "select count(*) from public.tasks where id = '$SUB'"

ACT="$(value_as service "insert into public.agent_actions (workspace_id, action_type, target_table, proposed_payload, reasoning) values ('$W', 'create_task', 'tasks', '{\"title\": \"Draft the Q3 plan\", \"priority\": \"high\"}', 'The kickoff note lists a Q3 plan with no owner') returning id")"
ACT2="$(value_as service "insert into public.agent_actions (workspace_id, action_type, target_table, proposed_payload, reasoning) values ('$W', 'create_task', 'tasks', '{\"title\": \"Unwanted\"}', 'Guessing') returning id")"
check "users cannot call approve directly" "$B" fail "select public.approve_agent_action('$ACT', '$B')"
check "approve refuses a non-admin approver" service fail "select public.approve_agent_action('$ACT', '$E')"
check "admin approval writes the task as an agent task" service "=agent|high|Draft the Q3 plan" "select source || '|' || priority || '|' || title from public.approve_agent_action('$ACT', '$B')"
check "approval records the decision and target" service "=approved|true" "select status || '|' || (target_id is not null) from public.agent_actions where id = '$ACT'"
check "approval is audit-logged with reasoning" service "=t" "select exists (select 1 from public.audit_log where action = 'agent_action.approved' and details ->> 'reasoning' like 'The kickoff note%')"
check "a proposal cannot be approved twice" service fail "select public.approve_agent_action('$ACT', '$B')"
check "rejection writes no task" service "=rejected|0" "select r.status || '|' || (select count(*) from public.tasks where title = 'Unwanted') from public.reject_agent_action('$ACT2', '$B') r"
check "rejection is audit-logged" service "=t" "select exists (select 1 from public.audit_log where action = 'agent_action.rejected' and target_id = '$ACT2')"

echo
echo "$PASS passed, $FAIL failed"
[[ $FAIL -eq 0 ]]
