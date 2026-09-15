-- =============================================================================
-- Meridian core schema
--
-- Tables from Meridian_PRD_v2 (MUST scope) plus the owner-approved changes
-- recorded in docs/decisions.md (D-004 to D-012). Every table has row-level
-- security enabled and is scoped to a workspace.
--
-- Access model (D-006):
--   Admin  - everything in the workspace, including uploads, member management,
--            approving agent actions and the review queue.
--   Member - read the workspace, ask the agent, create and edit notes, and
--            change the status of a task. Nothing else.
--
-- The backend performs privileged writes with the service role after its own
-- role checks. The policies below are the second line of defence for anything
-- that reaches PostgREST with a user token.
-- =============================================================================

create extension if not exists vector with schema extensions;

create schema if not exists private;
revoke all on schema private from public;
grant usage on schema private to authenticated, service_role;

-- -----------------------------------------------------------------------------
-- Identity and workspaces
-- -----------------------------------------------------------------------------

create table public.users (
  id          uuid primary key references auth.users (id) on delete cascade,
  email       text not null,
  full_name   text,
  avatar_url  text,
  created_at  timestamptz not null default now()
);
create unique index users_email_lower_idx on public.users (lower(email));

create table public.workspaces (
  id          uuid primary key default gen_random_uuid(),
  name        text not null check (char_length(btrim(name)) between 1 and 80),
  owner_id    uuid not null references public.users (id),
  created_at  timestamptz not null default now()
);

create table public.workspace_members (
  id            uuid primary key default gen_random_uuid(),
  workspace_id  uuid not null references public.workspaces (id) on delete cascade,
  user_id       uuid not null references public.users (id) on delete cascade,
  auth_role     text not null check (auth_role in ('Admin', 'Member')),
  team_role     text,  -- SHOULD scope (automatic assignment); unused in Week 1
  joined_at     timestamptz not null default now(),
  unique (workspace_id, user_id)
);
create index workspace_members_user_idx on public.workspace_members (user_id);

-- D-007: people can be added before they have ever signed in.
create table public.workspace_invites (
  id            uuid primary key default gen_random_uuid(),
  workspace_id  uuid not null references public.workspaces (id) on delete cascade,
  email         text not null check (position('@' in email) > 1),
  auth_role     text not null check (auth_role in ('Admin', 'Member')),
  invited_by    uuid not null references public.users (id),
  created_at    timestamptz not null default now(),
  accepted_at   timestamptz
);
create unique index workspace_invites_pending_idx
  on public.workspace_invites (workspace_id, lower(email))
  where accepted_at is null;

-- -----------------------------------------------------------------------------
-- Role helpers. SECURITY DEFINER so policies on workspace_members can call them
-- without recursing into their own RLS. They only ever answer for auth.uid().
-- -----------------------------------------------------------------------------

create or replace function private.is_member(ws uuid)
returns boolean
language sql stable security definer set search_path = ''
as $$
  select exists (
    select 1 from public.workspace_members m
    where m.workspace_id = ws and m.user_id = (select auth.uid())
  );
$$;

create or replace function private.is_admin(ws uuid)
returns boolean
language sql stable security definer set search_path = ''
as $$
  select exists (
    select 1 from public.workspace_members m
    where m.workspace_id = ws and m.user_id = (select auth.uid()) and m.auth_role = 'Admin'
  );
$$;

create or replace function private.shares_workspace(other_user uuid)
returns boolean
language sql stable security definer set search_path = ''
as $$
  select exists (
    select 1
    from public.workspace_members mine
    join public.workspace_members theirs on theirs.workspace_id = mine.workspace_id
    where mine.user_id = (select auth.uid()) and theirs.user_id = other_user
  );
$$;

create or replace function private.is_service_role()
returns boolean
language sql stable set search_path = ''
as $$
  select coalesce((select auth.jwt()) ->> 'role', '') = 'service_role'
      or current_user in ('postgres', 'service_role', 'supabase_admin');
$$;

grant execute on all functions in schema private to authenticated, service_role;

-- -----------------------------------------------------------------------------
-- Content
-- -----------------------------------------------------------------------------

create table public.documents (
  id             uuid primary key default gen_random_uuid(),
  workspace_id   uuid not null references public.workspaces (id) on delete cascade,
  uploaded_by    uuid not null references public.users (id),
  file_path      text not null unique,  -- storage object path: {workspace_id}/{document_id}/{file_name}
  file_name      text not null,
  mime_type      text not null,
  size_bytes     bigint not null check (size_bytes >= 0),
  parsed_status  text not null default 'pending'
                 check (parsed_status in ('pending', 'processing', 'ready', 'failed')),
  parse_error    text,
  created_at     timestamptz not null default now()
);
create index documents_workspace_idx on public.documents (workspace_id, created_at desc);

-- D-005: embeddings live in pgvector for Week 1.
create table public.chunk_embeddings (
  id            uuid primary key default gen_random_uuid(),
  workspace_id  uuid not null references public.workspaces (id) on delete cascade,
  model         text not null,
  embedding     extensions.vector(1536) not null,
  created_at    timestamptz not null default now()
);
create index chunk_embeddings_hnsw_idx
  on public.chunk_embeddings using hnsw (embedding extensions.vector_cosine_ops);
create index chunk_embeddings_workspace_idx on public.chunk_embeddings (workspace_id);

create table public.chunks (
  id             uuid primary key default gen_random_uuid(),
  document_id    uuid not null references public.documents (id) on delete cascade,
  workspace_id   uuid not null references public.workspaces (id) on delete cascade,  -- D-008
  chunk_index    integer not null check (chunk_index >= 0),
  content        text not null,
  char_start     integer not null check (char_start >= 0),
  char_end       integer not null,
  embedding_ref  uuid references public.chunk_embeddings (id) on delete set null,
  content_tsv    tsvector generated always as (to_tsvector('english', content)) stored,  -- sparse signal
  created_at     timestamptz not null default now(),
  check (char_end > char_start),
  unique (document_id, chunk_index)
);
create index chunks_document_idx on public.chunks (document_id, chunk_index);
create index chunks_workspace_idx on public.chunks (workspace_id);
create index chunks_tsv_idx on public.chunks using gin (content_tsv);

create table public.notes (
  id            uuid primary key default gen_random_uuid(),
  workspace_id  uuid not null references public.workspaces (id) on delete cascade,
  created_by    uuid not null references public.users (id),
  title         text not null default '',
  content       jsonb not null default '{"type": "doc", "content": []}'::jsonb
                check (jsonb_typeof(content) = 'object'),  -- block tree, never a flat string
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);
create index notes_workspace_idx on public.notes (workspace_id, updated_at desc);

create table public.tasks (
  id            uuid primary key default gen_random_uuid(),
  workspace_id  uuid not null references public.workspaces (id) on delete cascade,
  sprint_id     uuid,  -- SHOULD scope; no sprints table yet (D-010)
  title         text not null check (char_length(btrim(title)) between 1 and 200),
  status        text not null default 'todo' check (status in ('todo', 'in_progress', 'done')),
  assignee_id   uuid references public.users (id) on delete set null,
  due_date      date,
  created_by    uuid not null references public.users (id),
  source        text not null default 'manual' check (source in ('manual', 'agent')),
  created_at    timestamptz not null default now()
);
create index tasks_workspace_idx on public.tasks (workspace_id, created_at desc);

-- -----------------------------------------------------------------------------
-- Agent, retrieval and guardrails
-- -----------------------------------------------------------------------------

create table public.retrieval_runs (
  id                  uuid primary key default gen_random_uuid(),
  workspace_id        uuid not null references public.workspaces (id) on delete cascade,
  asked_by            uuid references public.users (id) on delete set null,
  question            text not null,
  candidates_json     jsonb not null default '[]'::jsonb,
  rerank_scores_json  jsonb not null default '[]'::jsonb,
  grade_outcome       text,
  retry_count         integer not null default 0 check (retry_count >= 0),
  latency_ms          integer check (latency_ms >= 0),
  created_at          timestamptz not null default now()
);
create index retrieval_runs_workspace_idx on public.retrieval_runs (workspace_id, created_at desc);

create table public.agent_answers (
  id                 uuid primary key default gen_random_uuid(),
  workspace_id       uuid not null references public.workspaces (id) on delete cascade,
  asked_by           uuid references public.users (id) on delete set null,
  retrieval_run_id   uuid references public.retrieval_runs (id) on delete set null,
  question           text not null,
  answer             text not null,
  confidence         numeric(4, 3) check (confidence between 0 and 1),  -- uncalibrated (non-negotiable 3)
  groundedness_pass  boolean not null,
  created_at         timestamptz not null default now()
);
create index agent_answers_workspace_idx on public.agent_answers (workspace_id, created_at desc);

create table public.answer_citations (
  id          uuid primary key default gen_random_uuid(),
  answer_id   uuid not null references public.agent_answers (id) on delete cascade,
  chunk_id    uuid not null references public.chunks (id) on delete cascade,
  ordinal     integer not null check (ordinal >= 1),  -- the [n] shown in the answer
  created_at  timestamptz not null default now(),
  unique (answer_id, ordinal)
);
create index answer_citations_chunk_idx on public.answer_citations (chunk_id);

-- Non-negotiable 1: proposals live here until a person approves them.
create table public.agent_actions (
  id                uuid primary key default gen_random_uuid(),
  workspace_id      uuid not null references public.workspaces (id) on delete cascade,
  action_type       text not null check (action_type in ('create_task')),
  target_table      text not null check (target_table in ('tasks')),
  target_id         uuid,  -- null until approved and written
  proposed_payload  jsonb not null,  -- D-009
  reasoning         text not null,
  before_state      jsonb,
  status            text not null default 'pending' check (status in ('pending', 'approved', 'rejected')),
  decided_by        uuid references public.users (id) on delete set null,
  decided_at        timestamptz,
  created_at        timestamptz not null default now(),
  check ((status = 'pending') = (decided_at is null))
);
create index agent_actions_workspace_idx on public.agent_actions (workspace_id, status, created_at desc);

create table public.audit_log (
  id            uuid primary key default gen_random_uuid(),
  workspace_id  uuid references public.workspaces (id) on delete cascade,  -- D-004
  actor_id      uuid references public.users (id) on delete set null,
  actor_type    text not null check (actor_type in ('user', 'agent', 'system')),
  action        text not null,
  target_type   text,
  target_id     uuid,
  timestamp     timestamptz not null default now(),
  details       jsonb not null default '{}'::jsonb
);
create index audit_log_workspace_idx on public.audit_log (workspace_id, timestamp desc);

create table public.admin_reviews (
  id                  uuid primary key default gen_random_uuid(),
  workspace_id        uuid not null references public.workspaces (id) on delete cascade,  -- D-004
  review_target_type  text not null check (review_target_type in ('agent_answer', 'agent_action')),
  review_target_id    uuid not null,
  reviewer_id         uuid not null references public.users (id),
  decision            text not null check (decision in ('confirmed', 'corrected', 'dismissed')),
  notes               text,
  reviewed_at         timestamptz not null default now()
);
create index admin_reviews_target_idx on public.admin_reviews (review_target_type, review_target_id);

-- -----------------------------------------------------------------------------
-- Integrity triggers
-- -----------------------------------------------------------------------------

-- The audit log is append-only for everyone, including the service role.
create or replace function private.audit_log_append_only()
returns trigger language plpgsql set search_path = ''
as $$
begin
  raise exception 'audit_log is append-only';
end;
$$;

create trigger audit_log_no_update before update or delete on public.audit_log
  for each row execute function private.audit_log_append_only();

-- Members may change a task's status and nothing else (D-006).
create or replace function private.tasks_member_update_guard()
returns trigger language plpgsql set search_path = ''
as $$
begin
  if private.is_service_role() or private.is_admin(old.workspace_id) then
    return new;
  end if;
  if (new.workspace_id, new.sprint_id, new.title, new.assignee_id, new.due_date, new.created_by, new.source, new.created_at)
     is distinct from
     (old.workspace_id, old.sprint_id, old.title, old.assignee_id, old.due_date, old.created_by, old.source, old.created_at) then
    raise exception 'Members can only change a task''s status' using errcode = '42501';
  end if;
  return new;
end;
$$;

create trigger tasks_member_update_guard before update on public.tasks
  for each row execute function private.tasks_member_update_guard();

create or replace function private.touch_updated_at()
returns trigger language plpgsql set search_path = ''
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

create trigger notes_touch_updated_at before update on public.notes
  for each row execute function private.touch_updated_at();

-- A workspace always keeps at least one Admin.
create or replace function private.keep_one_admin()
returns trigger language plpgsql set search_path = ''
as $$
declare
  ws uuid := old.workspace_id;
begin
  if old.auth_role <> 'Admin' then
    return coalesce(new, old);
  end if;
  if tg_op = 'UPDATE' and new.auth_role = 'Admin' then
    return new;
  end if;
  if not exists (
    select 1 from public.workspace_members
    where workspace_id = ws and auth_role = 'Admin' and id <> old.id
  ) and exists (select 1 from public.workspaces where id = ws) then
    raise exception 'A workspace must keep at least one Admin' using errcode = '23514';
  end if;
  return coalesce(new, old);
end;
$$;

create trigger workspace_members_keep_one_admin before update or delete on public.workspace_members
  for each row execute function private.keep_one_admin();

-- -----------------------------------------------------------------------------
-- Sign-up: mirror the auth user and accept any pending invites (D-007).
-- A new user starts with no workspace (D-006).
-- -----------------------------------------------------------------------------

create or replace function private.handle_new_auth_user()
returns trigger language plpgsql security definer set search_path = ''
as $$
begin
  insert into public.users (id, email, full_name, avatar_url)
  values (
    new.id,
    new.email,
    new.raw_user_meta_data ->> 'full_name',
    new.raw_user_meta_data ->> 'avatar_url'
  )
  on conflict (id) do nothing;

  with accepted as (
    update public.workspace_invites i
       set accepted_at = now()
     where lower(i.email) = lower(new.email) and i.accepted_at is null
    returning i.workspace_id, i.auth_role, i.id
  ), joined as (
    insert into public.workspace_members (workspace_id, user_id, auth_role)
    select workspace_id, new.id, auth_role from accepted
    on conflict (workspace_id, user_id) do nothing
    returning workspace_id, auth_role
  )
  insert into public.audit_log (workspace_id, actor_id, actor_type, action, target_type, target_id, details)
  select workspace_id, new.id, 'system', 'member.joined_from_invite', 'user', new.id,
         jsonb_build_object('auth_role', auth_role)
  from joined;

  return new;
end;
$$;

create trigger on_auth_user_created after insert on auth.users
  for each row execute function private.handle_new_auth_user();

-- Creating a workspace makes the creator its Admin in the same transaction.
create or replace function public.create_workspace(workspace_name text)
returns public.workspaces
language plpgsql security definer set search_path = ''
as $$
declare
  uid uuid := (select auth.uid());
  created public.workspaces;
begin
  if uid is null then
    raise exception 'Not signed in' using errcode = '42501';
  end if;

  insert into public.workspaces (name, owner_id)
  values (btrim(workspace_name), uid)
  returning * into created;

  insert into public.workspace_members (workspace_id, user_id, auth_role)
  values (created.id, uid, 'Admin');

  insert into public.audit_log (workspace_id, actor_id, actor_type, action, target_type, target_id, details)
  values (created.id, uid, 'user', 'workspace.created', 'workspace', created.id,
          jsonb_build_object('name', created.name));

  return created;
end;
$$;

revoke all on function public.create_workspace(text) from public, anon;
grant execute on function public.create_workspace(text) to authenticated, service_role;

-- -----------------------------------------------------------------------------
-- Row-level security
-- -----------------------------------------------------------------------------

alter table public.users              enable row level security;
alter table public.workspaces         enable row level security;
alter table public.workspace_members  enable row level security;
alter table public.workspace_invites  enable row level security;
alter table public.documents          enable row level security;
alter table public.chunk_embeddings   enable row level security;
alter table public.chunks             enable row level security;
alter table public.notes              enable row level security;
alter table public.tasks              enable row level security;
alter table public.retrieval_runs     enable row level security;
alter table public.agent_answers      enable row level security;
alter table public.answer_citations   enable row level security;
alter table public.agent_actions      enable row level security;
alter table public.audit_log          enable row level security;
alter table public.admin_reviews      enable row level security;

-- Nothing in this schema is readable without signing in, including future tables.
revoke all on all tables in schema public from anon;
alter default privileges for role postgres in schema public revoke all on tables from anon;

-- users
create policy "users: read self and co-members" on public.users for select to authenticated
  using (id = (select auth.uid()) or private.shares_workspace(id));
create policy "users: update self" on public.users for update to authenticated
  using (id = (select auth.uid())) with check (id = (select auth.uid()));

-- workspaces (created only through create_workspace)
create policy "workspaces: members read" on public.workspaces for select to authenticated
  using (private.is_member(id));
create policy "workspaces: admins rename" on public.workspaces for update to authenticated
  using (private.is_admin(id)) with check (private.is_admin(id));

-- workspace_members
create policy "members: members read roster" on public.workspace_members for select to authenticated
  using (private.is_member(workspace_id));
create policy "members: admins add" on public.workspace_members for insert to authenticated
  with check (private.is_admin(workspace_id));
create policy "members: admins change role" on public.workspace_members for update to authenticated
  using (private.is_admin(workspace_id)) with check (private.is_admin(workspace_id));
create policy "members: admins remove, anyone leaves" on public.workspace_members for delete to authenticated
  using (private.is_admin(workspace_id) or user_id = (select auth.uid()));

-- workspace_invites
create policy "invites: admins manage" on public.workspace_invites for all to authenticated
  using (private.is_admin(workspace_id)) with check (private.is_admin(workspace_id));

-- documents: members read, admins upload and manage
create policy "documents: members read" on public.documents for select to authenticated
  using (private.is_member(workspace_id));
create policy "documents: admins insert" on public.documents for insert to authenticated
  with check (private.is_admin(workspace_id) and uploaded_by = (select auth.uid()));
create policy "documents: admins delete" on public.documents for delete to authenticated
  using (private.is_admin(workspace_id));

-- chunks and embeddings: read by members, written only by the ingestion service
create policy "chunks: members read" on public.chunks for select to authenticated
  using (private.is_member(workspace_id));
create policy "chunk_embeddings: members read" on public.chunk_embeddings for select to authenticated
  using (private.is_member(workspace_id));

-- notes: any member creates and edits; creator or admin deletes
create policy "notes: members read" on public.notes for select to authenticated
  using (private.is_member(workspace_id));
create policy "notes: members create" on public.notes for insert to authenticated
  with check (private.is_member(workspace_id) and created_by = (select auth.uid()));
create policy "notes: members edit" on public.notes for update to authenticated
  using (private.is_member(workspace_id)) with check (private.is_member(workspace_id));
create policy "notes: creator or admin deletes" on public.notes for delete to authenticated
  using (private.is_admin(workspace_id) or created_by = (select auth.uid()));

-- tasks: members read and change status (column guard trigger); admins do the rest
create policy "tasks: members read" on public.tasks for select to authenticated
  using (private.is_member(workspace_id));
create policy "tasks: admins create" on public.tasks for insert to authenticated
  with check (private.is_admin(workspace_id) and created_by = (select auth.uid()) and source = 'manual');
create policy "tasks: members update status" on public.tasks for update to authenticated
  using (private.is_member(workspace_id)) with check (private.is_member(workspace_id));
create policy "tasks: admins delete" on public.tasks for delete to authenticated
  using (private.is_admin(workspace_id));

-- agent outputs: members read answers, citations and proposals; writes are service-only
create policy "agent_answers: members read" on public.agent_answers for select to authenticated
  using (private.is_member(workspace_id));
create policy "answer_citations: members read" on public.answer_citations for select to authenticated
  using (exists (
    select 1 from public.agent_answers a
    where a.id = answer_id and private.is_member(a.workspace_id)
  ));
create policy "agent_actions: members read" on public.agent_actions for select to authenticated
  using (private.is_member(workspace_id));

-- oversight data: admins only
create policy "retrieval_runs: admins read" on public.retrieval_runs for select to authenticated
  using (private.is_admin(workspace_id));
create policy "audit_log: admins read" on public.audit_log for select to authenticated
  using (private.is_admin(workspace_id));
create policy "admin_reviews: admins read" on public.admin_reviews for select to authenticated
  using (private.is_admin(workspace_id));

-- -----------------------------------------------------------------------------
-- Storage: private bucket, objects keyed by workspace id as the first path part
-- -----------------------------------------------------------------------------

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'documents', 'documents', false, 26214400,
  array[
    'application/pdf',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
  ]
)
on conflict (id) do nothing;

create policy "documents bucket: members read" on storage.objects for select to authenticated
  using (bucket_id = 'documents' and private.is_member(((storage.foldername(name))[1])::uuid));
create policy "documents bucket: admins upload" on storage.objects for insert to authenticated
  with check (bucket_id = 'documents' and private.is_admin(((storage.foldername(name))[1])::uuid));
create policy "documents bucket: admins delete" on storage.objects for delete to authenticated
  using (bucket_id = 'documents' and private.is_admin(((storage.foldername(name))[1])::uuid));
