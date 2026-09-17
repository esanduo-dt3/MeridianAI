-- Review decisions on flagged answers (docs/decisions.md D-040).
--
-- The review queue holds answers that were flagged (low confidence, no
-- citations, failed groundedness, suspected injection). An Admin confirms,
-- corrects or dismisses each one. Like approving an agent action (D-009), the
-- decision and its audit entry are written in one transaction by a function
-- that re-checks the reviewer is an Admin of the answer's workspace.
--
-- A correction is kept as text so it can inform retrieval tuning later
-- (PRD 8.2: "corrections are available to inform future retrieval tuning").

alter table public.admin_reviews
  add column correction text;

-- One decision per reviewed thing: the queue shows an item until it is decided.
create unique index admin_reviews_one_decision_idx
  on public.admin_reviews (review_target_type, review_target_id);

create or replace function public.review_agent_answer(
  answer_id uuid, reviewer_id uuid, decision text, notes text default null, correction text default null
)
returns public.admin_reviews
language plpgsql security definer set search_path = ''
as $$
declare
  answer public.agent_answers;
  review public.admin_reviews;
begin
  select * into answer from public.agent_answers where id = answer_id;
  if not found then
    raise exception 'Answer not found' using errcode = 'P0002';
  end if;
  if not exists (
    select 1 from public.workspace_members
    where workspace_id = answer.workspace_id and user_id = reviewer_id and auth_role = 'Admin'
  ) then
    raise exception 'Only Admins of this workspace can review answers' using errcode = '42501';
  end if;
  if decision not in ('confirmed', 'corrected', 'dismissed') then
    raise exception 'Unknown decision %', decision using errcode = '22023';
  end if;
  if decision = 'corrected' and coalesce(btrim(correction), '') = '' then
    raise exception 'A correction needs the corrected answer' using errcode = '22023';
  end if;
  if exists (
    select 1 from public.admin_reviews
    where review_target_type = 'agent_answer' and review_target_id = answer_id
  ) then
    raise exception 'This answer was already reviewed' using errcode = '23505';
  end if;

  insert into public.admin_reviews (
    workspace_id, review_target_type, review_target_id, reviewer_id, decision, notes, correction
  )
  values (
    answer.workspace_id, 'agent_answer', answer_id, reviewer_id, decision,
    nullif(btrim(notes), ''), case when decision = 'corrected' then btrim(correction) end
  )
  returning * into review;

  insert into public.audit_log (workspace_id, actor_id, actor_type, action, target_type, target_id, details)
  values (
    answer.workspace_id, reviewer_id, 'user', 'answer.reviewed', 'agent_answer', answer_id,
    jsonb_build_object(
      'review_id', review.id, 'decision', decision, 'notes', review.notes, 'correction', review.correction,
      'flag_reasons', to_jsonb(answer.flag_reasons), 'confidence', answer.confidence
    )
  );

  return review;
end;
$$;

revoke all on function public.review_agent_answer(uuid, uuid, text, text, text) from public, anon, authenticated;
grant execute on function public.review_agent_answer(uuid, uuid, text, text, text) to service_role;
