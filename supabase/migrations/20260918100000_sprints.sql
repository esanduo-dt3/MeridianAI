-- Backlog and sprint board (docs/decisions.md D-048, PRD SHOULD scope).
--
-- The PRD's data model has carried `tasks.sprint_id` since the core schema with
-- no table behind it (D-010). This creates that table and the foreign key.
--
-- The backlog is not a table: a task with `sprint_id is null` is in the backlog.
-- That way a task is never in two places, and moving it in or out is one column
-- write rather than a row that has to be kept in step.

create table public.sprints (
  id            uuid primary key default gen_random_uuid(),
  workspace_id  uuid not null references public.workspaces (id) on delete cascade,
  name          text not null check (char_length(btrim(name)) between 1 and 80),
  start_date    date,
  end_date      date,
  status        text not null default 'planned' check (status in ('planned', 'active', 'completed')),
  created_at    timestamptz not null default now(),
  -- A sprint that ends before it starts is a typing mistake, not a plan.
  check (start_date is null or end_date is null or end_date >= start_date)
);

create index sprints_workspace_idx on public.sprints (workspace_id, created_at desc);

-- "Which sprint is active" has to have one answer, so the database holds the rule
-- rather than the API trying to keep it.
create unique index sprints_one_active_per_workspace_idx
  on public.sprints (workspace_id)
  where status = 'active';

-- Deleting a sprint returns its tasks to the backlog instead of deleting work.
alter table public.tasks
  add constraint tasks_sprint_id_fkey
  foreign key (sprint_id) references public.sprints (id) on delete set null;

create index tasks_sprint_idx on public.tasks (workspace_id, sprint_id);

comment on column public.tasks.sprint_id is
  'The sprint this task is in. Null means the backlog (D-048). Members cannot change it: the task update guard treats it like any other content column.';

-- Row-level security: the same shape as tasks. Members see the plan; only Admins
-- change it. `tasks_member_update_guard` already refuses a Member changing
-- sprint_id, so moving work in or out of a sprint is Admin-only without any
-- change to that trigger.
alter table public.sprints enable row level security;

create policy "sprints: members read" on public.sprints for select to authenticated
  using (private.is_member(workspace_id));
create policy "sprints: admins create" on public.sprints for insert to authenticated
  with check (private.is_admin(workspace_id));
create policy "sprints: admins update" on public.sprints for update to authenticated
  using (private.is_admin(workspace_id)) with check (private.is_admin(workspace_id));
create policy "sprints: admins delete" on public.sprints for delete to authenticated
  using (private.is_admin(workspace_id));
