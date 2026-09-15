# Kavia Kickoff Prompts — Meridian, Week 1

How to use this: paste Phase 0 into Kavia first, on its own, before anything
else. Let Kavia's own Plan/Spec tooling break it into epics and configure
the architecture, don't pre-chunk it further yourself. Then paste each day's
phase at the start of that day, not before. The gates only work if Kavia
doesn't already know it's allowed to build SHOULD-tier scope.

One tooling note before you start: your own onboarding deck flags Opus as
credit-heavy for routine work. Scaffolding, CRUD, the note editor, the
board UI, this is all fine on a lighter model. Save Opus for Day 3's
retrieval pipeline and Day 4's guardrail logic, where the reasoning
actually matters.

---

## Phase 0 — Project context (paste once, before Day 1)

```
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
```

---

## Phase 1 (Day 1) — Land & launch

```
1. Confirm the GitHub and Supabase connections are live in this project.
2. Scaffold the repo: React frontend, FastAPI backend, both wired to
   Supabase.
3. Implement Google sign-in via Supabase Auth, single-workspace flow for
   now.
4. Create the full schema from the project context, all MUST tables,
   with row-level security scoping every table by workspace_id.
5. Spike: stand up hybrid dense-plus-sparse search (pgvector or the
   connected vector DB) and confirm a real query returns results against
   a test document. Don't wait until Day 3 to find out this doesn't work.
6. Spike: parse one real PDF and one real Word document through your
   chosen library, check chunk quality by eye, tell me if anything about
   the chunking approach needs to change.
7. I'm handing you a hand-labelled golden set of 15 questions and 8
   red-team documents separately today. Do not generate these yourself,
   they need to be authored independently of the model being tested.
8. End of day: show me what's scaffolded and flag anything from the
   spikes that should change the plan.
```

---

## Phase 2 (Day 2) — Note editor and ingestion

```
1. Build the block-based note editor on the frontend, real block-tree
   storage in notes.content, not a flat string.
2. Build document upload end to end: upload to Supabase Storage, parse,
   chunk, embed, write to the chunks table with correct char_start and
   char_end.
3. Build the task list view, read-only for now, showing pending-approval
   and approved tasks.
4. Handle empty, loading and error states on every screen you touch
   today, not just the happy path.
5. End of day: I should be able to upload a real document and see it
   chunked correctly in the chunks table.
```

---

## Phase 3 (Day 3) — Retrieval pipeline and Gate G1

```
1. Build the full retrieval pipeline: query rewrite, hybrid retrieve,
   rerank, grade, retry if the first pass is weak, groundedness
   self-check.
2. Every run writes a row to retrieval_runs: candidates, rerank scores,
   grade outcome, retry count, latency.
3. Wire POST /agent/ask end to end, returning an answer with citations
   via answer_citations (not a JSON blob) and a stated confidence value
   explicitly labelled uncalibrated.
4. Run the pipeline against the 15-question golden set from Day 1.
5. Report the score against Gate G1 by name: 12 or more of 15 with the
   correct source cited is a pass. If it's fewer, cut the retry loop,
   ship rerank-only, and tell me explicitly that you did this and why.
6. Report p50 latency across the golden set against the 8-second target
   from the risk section.
```

---

## Phase 4 (Day 4) — Agent actions and Gate G2

```
1. Build the agent's task-proposal flow: agent reads a note or
   conversation, proposes a task via a tool call, writes nothing yet.
2. Build the approval path: POST /agent/actions/{id}/approve and
   /reject. Approve writes the task and logs to audit_log. Reject writes
   nothing and logs the rejection.
3. Wire role scoping end to end. Test with two accounts that a Member
   cannot perform an Admin-only action.
4. Test the full propose, hold, approve, write round trip for at least
   one real task, end to end.
5. Report against Gate G2 by name: did the round trip work end to end?
   If not, switch to auto-execute with full reasoning logged, cut the
   approval UI, tell me explicitly.
6. Show me in the actual code, not a comment, where document content is
   kept as data rather than being concatenated into the instruction or
   system context, and where a tool call is gated on a user turn.
```

---

## Phase 5 (Day 5) — Guardrail surfaces, harden, deploy

```
1. Build the admin review queue (flagged answers plus pending actions)
   and the audit log view.
2. Build the pipeline health dashboard, reading real numbers from
   retrieval_runs. No placeholder numbers anywhere on this screen.
3. Run the 8-document red-team suite from Day 1 against the injection
   defence. Report the pass rate honestly, whatever it comes out to.
4. Bug bash: walk the full journey as a brand-new user, three times.
5. Seed realistic demo data. No lorem ipsum, no "test test test".
6. Deploy: frontend and backend to real hosts, reachable on a URL, not
   localhost.
7. Pre-warm any response cache on the exact questions I'll ask in the
   demo.
8. Write the README: what's built, the Gate G1 and G2 outcomes and why,
   the red-team pass rate, the disclaimer text, and what's explicitly
   not built this week (the SHOULD/COULD list) and why.
```
