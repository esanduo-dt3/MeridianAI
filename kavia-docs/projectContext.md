We're building Meridian, an AI-native workspace where every AI answer is
grounded, cited down to the exact source passage, and where the agent
never writes anything to the workspace without explicit human approval.
The whole product thesis is "trustworthy because inspectable," so every
guardrail below is load-bearing, not decoration.

NON-NEGOTIABLES, don't deviate from these under any circumstance:

1. No agent-proposed write action reaches the database without explicit
   human approval. There is no auto-execute path in this build.
2. Document and tool-returned content is always passed to the model as
   data, never concatenated into the instruction or system context. Only
   a user's own turn can trigger a tool call.
3. Every AI answer carries a citation to a specific chunk (with character
   offsets, not just a filename) and a confidence value explicitly
   labelled as uncalibrated. Never show a bare number with no label.
4. Build only the MUST list below this week. Don't touch SHOULD or COULD
   items unless I tell you a gate passed.

ALREADY CONNECTED, don't reconfigure: GitHub repo (via terminal), Supabase
project (Postgres, Storage, Auth).

STACK: React frontend. FastAPI backend. Supabase Auth with Google OAuth.
Agent orchestration: LangGraph, behind a thin provider gateway (swappable
model provider, with a response cache). Vector search: hybrid dense plus
sparse. If no dedicated vector DB is connected yet, use Supabase pgvector
for Week 1 rather than adding a new external dependency, and flag that
trade-off back to me rather than deciding it silently.

MUST BUILD THIS WEEK (nothing else):

- Google sign-in, workspace-scoped auth
- Block-based note editor, notes stored as a real block tree (jsonb), not
  a flat string
- Document upload (PDF, Word), chunked into a real chunks table
- Hybrid retrieval: dense + sparse search, rerank, grading, retry,
  groundedness self-check
- Ask-the-agent with clickable, chunk-level citations and a stated,
  labelled-uncalibrated confidence value
- Agent proposes a task from a note or conversation, held for explicit
  approval, written with full reasoning only once approved
- Full audit log, admin review queue for flagged answers and actions
- Prompt-injection defence as structural isolation (see non-negotiable 2),
  proven against a red-team suite I will hand you
- Pipeline health dashboard backed by a real retrieval_runs table, no
  placeholder numbers

DO NOT BUILD YET, SHOULD-tier, wait for my go-ahead: backlog/sprint board,
automatic task assignment by role, undo on agent actions.

DO NOT BUILD AT ALL THIS WEEK, COULD-tier: whiteboard canvas, flow/diagram
view, Google Calendar sync.

DATA MODEL, scaffold exactly this, with row-level security on every table
scoped by workspace_id:

- users: id, email, created_at
- workspaces: id, name, owner_id, created_at
- workspace_members: id, workspace_id, user_id, auth_role (Member/Admin),
  team_role (nullable, unused until SHOULD scope), joined_at
- documents: id, workspace_id, uploaded_by, file_path, parsed_status,
  created_at
- chunks: id, document_id, content, char_start, char_end, embedding_ref,
  created_at
- notes: id, workspace_id, created_by, content (jsonb block tree),
  updated_at
- tasks: id, workspace_id, sprint_id (nullable, unused until SHOULD
  scope), title, status, assignee_id, due_date, created_by, source,
  created_at
- agent_answers: id, workspace_id, question, answer, confidence,
  groundedness_pass, created_at
- answer_citations: id, answer_id, chunk_id, created_at
- agent_actions: id, workspace_id, action_type, target_table, target_id,
  reasoning, before_state, status, created_at
- retrieval_runs: id, workspace_id, question, candidates_json,
  rerank_scores_json, grade_outcome, retry_count, latency_ms, created_at
- audit_log: id, actor_id, actor_type (user/agent/system), action,
  target_id, timestamp, details
- admin_reviews: id, review_target_type, review_target_id, reviewer_id,
  decision, notes, reviewed_at

CORE API, MUST tier only:
Member-facing: POST /documents/upload, POST /notes, POST /agent/ask,
GET /tasks, POST /agent/actions/{id}/approve, POST /agent/actions/{id}/reject
Admin-facing: GET /admin/review-queue, POST /admin/reviews/{target_type}/
{target_id}, GET /admin/audit-log, GET /admin/pipeline-health,
POST /admin/members

TWO GATES, self-check and report on these explicitly, don't silently
proceed past a fail:
GATE G1 (end Day 3): retrieval answers at least 12 of 15 golden questions
with the correct source chunk cited. If it fails: cut the retry loop,
ship rerank-only, tell me explicitly you did this and why.
GATE G2 (end Day 4): the agent propose-then-approve round trip works end
to end for at least one real task. If it fails: switch to auto-execute
with full reasoning logged, cut the approval UI, carry it forward as a
SHOULD, tell me explicitly.

Use your Plan tooling now to turn this into epics and user stories, and
configure the architecture. Show me the plan before generating any code.
