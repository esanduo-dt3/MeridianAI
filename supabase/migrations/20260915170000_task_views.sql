-- =============================================================================
-- Tasks for the List and Board views (docs/decisions.md D-020, D-021)
--
-- Adds subtasks, priority, description, ordering and completion time, widens
-- the Member rule to allow reordering, and adds atomic approve and reject
-- functions for agent-proposed tasks (non-negotiable 1).
-- =============================================================================

alter table public.tasks
  add column description     text not null default '' check (char_length(description) <= 10000),
  add column priority        text not null default 'none'
                             check (priority in ('none', 'low', 'medium', 'high', 'urgent')),
  add column parent_task_id  uuid references public.tasks (id) on delete cascade,
  add column position        double precision not null default 0,
  add column updated_at      timestamptz not null default now(),
  add column completed_at    timestamptz,
  add constraint tasks_not_own_parent check (parent_task_id is distinct from id);

create index tasks_parent_idx on public.tasks (parent_task_id);
create index tasks_board_idx on public.tasks (workspace_id, status, position);

-- -----------------------------------------------------------------------------
-- A subtask must share its parent's workspace, and the tree may not loop.
-- -----------------------------------------------------------------------------
create or replace function private.tasks_validate_parent()
returns trigger language plpgsql set search_path = ''
as $$
begin
  if new.parent_task_id is null then
    return new;
  end if;

  if not exists (
    select 1 from public.tasks p where p.id = new.parent_task_id and p.workspace_id = new.workspace_id
  ) then
    raise exception 'The parent task must be in the same workspace' using errcode = '23514';
  end if;

  if tg_op = 'UPDATE' and exists (
    with recursive ancestors as (
      select id, parent_task_id from public.tasks where id = new.parent_task_id
      union all
      select t.id, t.parent_task_id from public.tasks t join ancestors a on t.id = a.parent_task_id
    )
    select 1 from ancestors where id = new.id
  ) then
    raise exception 'A task cannot be moved under one of its own subtasks' using errcode = '23514';
  end if;

  return new;
end;
$$;

create trigger tasks_validate_parent before insert or update of parent_task_id, workspace_id on public.tasks
  for each row execute function private.tasks_validate_parent();

-- Maintain updated_at and completed_at.
create or replace function private.tasks_touch()
returns trigger language plpgsql set search_path = ''
as $$
begin
  if tg_op = 'UPDATE' then
    new.updated_at := now();
  end if;
  if new.status = 'done' and (tg_op = 'INSERT' or old.status is distinct from 'done') then
    new.completed_at := now();
  elsif new.status <> 'done' then
    new.completed_at := null;
  end if;
  return new;
end;
$$;

create trigger tasks_touch before insert or update on public.tasks
  for each row execute function private.tasks_touch();

-- -----------------------------------------------------------------------------
-- Members may change status and ordering only (D-006, widened by D-021).
-- -----------------------------------------------------------------------------
create or replace function private.tasks_member_update_guard()
returns trigger language plpgsql set search_path = ''
as $$
begin
  if private.is_service_role() or private.is_admin(old.workspace_id) then
    return new;
  end if;
  if (new.workspace_id, new.sprint_id, new.title, new.assignee_id, new.due_date, new.created_by, new.source,
      new.created_at, new.description, new.priority, new.parent_task_id)
     is distinct from
     (old.workspace_id, old.sprint_id, old.title, old.assignee_id, old.due_date, old.created_by, old.source,
      old.created_at, old.description, old.priority, old.parent_task_id) then
    raise exception 'Members can only change a task''s status and order' using errcode = '42501';
  end if;
  return new;
end;
$$;

-- -----------------------------------------------------------------------------
-- Agent proposals: approve writes the task, the decision and the audit entry in
-- one transaction; reject writes only the decision and the audit entry.
-- Called by the API with the service role after it verified the caller.
-- The Admin check is repeated here so the functions are safe on their own.
-- -----------------------------------------------------------------------------
create or replace function public.approve_agent_action(action_id uuid, approver_id uuid)
returns public.tasks
language plpgsql security definer set search_path = ''
as $$
declare
  action public.agent_actions;
  payload jsonb;
  created public.tasks;
begin
  select * into action from public.agent_actions where id = action_id for update;
  if not found then
    raise exception 'Proposal not found' using errcode = 'P0002';
  end if;
  if action.status <> 'pending' then
    raise exception 'This proposal was already %', action.status using errcode = '23514';
  end if;
  if not exists (
    select 1 from public.workspace_members
    where workspace_id = action.workspace_id and user_id = approver_id and auth_role = 'Admin'
  ) then
    raise exception 'Only Admins of this workspace can approve proposals' using errcode = '42501';
  end if;
  if action.action_type <> 'create_task' then
    raise exception 'Unsupported action type %', action.action_type using errcode = '22023';
  end if;

  payload := action.proposed_payload;
  if coalesce(btrim(payload ->> 'title'), '') = '' then
    raise exception 'The proposal has no task title' using errcode = '22023';
  end if;

  insert into public.tasks (
    workspace_id, title, description, priority, due_date, assignee_id, parent_task_id,
    status, position, created_by, source
  )
  values (
    action.workspace_id,
    btrim(payload ->> 'title'),
    coalesce(payload ->> 'description', ''),
    coalesce(payload ->> 'priority', 'none'),
    (payload ->> 'due_date')::date,
    (payload ->> 'assignee_id')::uuid,
    (payload ->> 'parent_task_id')::uuid,
    'todo',
    extract(epoch from now()) * 1000,
    approver_id,
    'agent'
  )
  returning * into created;

  update public.agent_actions
     set status = 'approved', target_id = created.id, decided_by = approver_id, decided_at = now()
   where id = action.id;

  insert into public.audit_log (workspace_id, actor_id, actor_type, action, target_type, target_id, details)
  values (
    action.workspace_id, approver_id, 'user', 'agent_action.approved', 'task', created.id,
    jsonb_build_object('agent_action_id', action.id, 'reasoning', action.reasoning, 'proposed_payload', payload)
  );

  return created;
end;
$$;

create or replace function public.reject_agent_action(action_id uuid, approver_id uuid)
returns public.agent_actions
language plpgsql security definer set search_path = ''
as $$
declare
  action public.agent_actions;
begin
  select * into action from public.agent_actions where id = action_id for update;
  if not found then
    raise exception 'Proposal not found' using errcode = 'P0002';
  end if;
  if action.status <> 'pending' then
    raise exception 'This proposal was already %', action.status using errcode = '23514';
  end if;
  if not exists (
    select 1 from public.workspace_members
    where workspace_id = action.workspace_id and user_id = approver_id and auth_role = 'Admin'
  ) then
    raise exception 'Only Admins of this workspace can reject proposals' using errcode = '42501';
  end if;

  update public.agent_actions
     set status = 'rejected', decided_by = approver_id, decided_at = now()
   where id = action.id
  returning * into action;

  insert into public.audit_log (workspace_id, actor_id, actor_type, action, target_type, target_id, details)
  values (
    action.workspace_id, approver_id, 'user', 'agent_action.rejected', 'agent_action', action.id,
    jsonb_build_object('reasoning', action.reasoning, 'proposed_payload', action.proposed_payload)
  );

  return action;
end;
$$;

revoke all on function public.approve_agent_action(uuid, uuid) from public, anon, authenticated;
revoke all on function public.reject_agent_action(uuid, uuid) from public, anon, authenticated;
grant execute on function public.approve_agent_action(uuid, uuid) to service_role;
grant execute on function public.reject_agent_action(uuid, uuid) to service_role;
