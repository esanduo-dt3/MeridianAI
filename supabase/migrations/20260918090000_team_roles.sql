-- Team roles on workspace members (docs/decisions.md D-047, PRD SHOULD scope).
--
-- `team_role` has existed since the core schema as a nullable column reserved
-- for this feature. It is what a person does on the team ("Backend engineer",
-- "QA", "Designer"), separate from `auth_role`, which is what they may do in
-- Meridian. Only `auth_role` grants permissions; `team_role` never does.
--
-- It is free text rather than an enum: every team names its roles differently,
-- and the agent matches it against a task's wording semantically, so a fixed
-- list would only get in the way.

alter table public.workspace_members
  add constraint workspace_members_team_role_length
  check (team_role is null or char_length(btrim(team_role)) between 1 and 80);

comment on column public.workspace_members.team_role is
  'Job function on the team, e.g. "Backend engineer". Set by an Admin, read by the agent when it proposes an assignee (D-047). Never grants permissions: that is auth_role.';
