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

echo "Documents, chunks and workspace-scoped search"
D1="$(value_as service "insert into public.documents (workspace_id, uploaded_by, file_path, file_name, mime_type, size_bytes, doc_type, content_text, parsed_status) values ('$W', '$B', '$W/doc-a/rectifiers.pdf', 'rectifiers.pdf', 'application/pdf', 10, 'pdf', 'Rectifier maintenance interval is six months.', 'ready') returning id")"
D2="$(value_as service "insert into public.documents (workspace_id, uploaded_by, file_path, file_name, mime_type, size_bytes, doc_type, content_text, parsed_status) values ('$W', '$B', '$W/doc-b/battery.docx', 'battery.docx', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', 10, 'docx', 'Battery rectifier replacement policy.', 'ready') returning id")"
D3="$(value_as service "insert into public.documents (workspace_id, uploaded_by, file_path, file_name, mime_type, size_bytes, doc_type, content_text, parsed_status) values ('$W2', '$C', '$W2/doc-c/other.pdf', 'other.pdf', 'application/pdf', 10, 'pdf', 'Rectifier notes in another workspace.', 'ready') returning id")"
db -c "insert into public.chunks (document_id, workspace_id, chunk_index, content, char_start, char_end, section, context) values
  ('$D1', '$W', 0, 'Rectifier maintenance interval is six months.', 0, 45, 'Maintenance', 'rectifiers.pdf > Maintenance'),
  ('$D2', '$W', 0, 'Battery rectifier replacement policy.', 0, 37, 'Policy', 'battery.docx > Policy'),
  ('$D3', '$W2', 0, 'Rectifier notes in another workspace.', 0, 37, '', 'other.pdf')" >/dev/null
check "member keyword search finds both documents in the workspace" "$E" "=2" "select count(*) from public.match_chunks_sparse('$W', 'rectifier')"
check "search never returns another workspace's chunks" "$E" "=0" "select count(*) from public.match_chunks_sparse('$W2', 'rectifier')"
check "outsider searching this workspace gets nothing" "$C" "=0" "select count(*) from public.match_chunks_sparse('$W', 'rectifier')"
check "document filter narrows the search" "$E" "=1" "select count(*) from public.match_chunks_sparse('$W', 'rectifier', 20, array['$D2']::uuid[])"
check "section and context are searchable too" "$E" "=1" "select count(*) from public.match_chunks_sparse('$W', 'maintenance')"
check "stopword-only query returns nothing instead of failing" "$E" "=0" "select count(*) from public.match_chunks_sparse('$W', 'the and of')"
check "anonymous users cannot run search" anon fail "select * from public.match_chunks_sparse('$W', 'rectifier')"
check "members cannot write chunks directly" "$E" fail "insert into public.chunks (document_id, workspace_id, chunk_index, content, char_start, char_end) values ('$D1', '$W', 9, 'x', 0, 1)"
check "members read the extracted document text" "$E" "=45" "select length(content_text) from public.documents where id = '$D1'"

echo "Ingestion progress: passages preview before embedding, search waits for ready"
check "a document still embedding is not searchable" service "=1" "update public.documents set parsed_status = 'processing', processing_stage = 'embedding' where id = '$D2' returning 1"
check "keyword search skips the document that is still embedding" "$E" "=1" "select count(*) from public.match_chunks_sparse('$W', 'rectifier')"
check "members still preview its passages" "$E" "=1" "select count(*) from public.chunks where document_id = '$D2'"
EMB="$(value_as service "insert into public.chunk_embeddings (workspace_id, document_id, model, embedding) values ('$W', '$D2', 'test@3', '{0,0,1}') returning id")"
CH2="$(value_as service "select id from public.chunks where document_id = '$D2'")"
check "members cannot attach embeddings" "$E" fail "select public.attach_chunk_embeddings('$D2', '[{\"chunk_id\": \"$CH2\", \"embedding_id\": \"$EMB\"}]')"
check "attaching a batch returns the embedded count" service "=1" "select public.attach_chunk_embeddings('$D2', '[{\"chunk_id\": \"$CH2\", \"embedding_id\": \"$EMB\"}]')"
check "the document records its embedded count" "$E" "=1|true" "select d.embedded_count || '|' || (c.embedding_ref = '$EMB') from public.documents d join public.chunks c on c.document_id = d.id where d.id = '$D2'"
check "attach ignores chunks of another document" service "=0" "select public.attach_chunk_embeddings('$D1', '[{\"chunk_id\": \"$CH2\", \"embedding_id\": \"$EMB\"}]')"
check "the document is marked ready" service "=ready" "update public.documents set parsed_status = 'ready', processing_stage = null where id = '$D2' returning parsed_status"
check "the document is searchable once ready" "$E" "=2" "select count(*) from public.match_chunks_sparse('$W', 'rectifier')"

echo "Review decisions on flagged answers"
ANS="$(value_as service "insert into public.agent_answers (workspace_id, asked_by, question, answer, confidence, groundedness_pass, flagged, flag_reasons) values ('$W', '$E', 'How often are rectifiers serviced?', 'Every year [1].', 0.21, false, true, '{low_confidence,groundedness_failed}') returning id")"
ANS2="$(value_as service "insert into public.agent_answers (workspace_id, asked_by, question, answer, confidence, groundedness_pass, flagged) values ('$W', '$E', 'Second', 'Answer', 0.2, true, true) returning id")"
check "users cannot call review directly" "$B" fail "select public.review_agent_answer('$ANS', '$B', 'confirmed')"
check "review refuses a non-admin reviewer" service fail "select public.review_agent_answer('$ANS', '$E', 'confirmed')"
check "review refuses an admin of another workspace" service fail "select public.review_agent_answer('$ANS', '$C', 'confirmed')"
check "a correction needs the corrected answer" service fail "select public.review_agent_answer('$ANS', '$B', 'corrected', 'wrong interval')"
check "admin corrects a flagged answer" service "=corrected|Every six months." "select decision || '|' || correction from public.review_agent_answer('$ANS', '$B', 'corrected', 'wrong interval', 'Every six months.')"
check "the review is audit-logged with the flag reasons" service "=t" "select exists (select 1 from public.audit_log where action = 'answer.reviewed' and target_id = '$ANS' and details -> 'flag_reasons' ? 'groundedness_failed')"
check "an answer cannot be reviewed twice" service fail "select public.review_agent_answer('$ANS', '$B', 'dismissed')"
check "dismissal stores no correction" service "=dismissed|true" "select decision || '|' || (correction is null) from public.review_agent_answer('$ANS2', '$B', 'dismissed', null, 'ignored text')"
check "admins read review decisions" "$B" "=2" "select count(*) from public.admin_reviews where workspace_id = '$W'"
check "members cannot read review decisions" "$E" "=0" "select count(*) from public.admin_reviews"
check "members cannot write review decisions" "$E" fail "insert into public.admin_reviews (workspace_id, review_target_type, review_target_id, reviewer_id, decision) values ('$W', 'agent_answer', '$ANS', '$E', 'confirmed')"

echo
echo "$PASS passed, $FAIL failed"
[[ $FAIL -eq 0 ]]
