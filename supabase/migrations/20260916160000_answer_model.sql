-- Record which model actually answered (docs/decisions.md D-031, D-032).
--
-- Both decisions state that `agent_answers.model` records the model that
-- answered, and D-032 requires golden-set runs to report it, because the
-- gateway falls back across models on the free tier and answer quality moves
-- with it. The column was never added, so fallbacks were invisible: the review
-- queue could not show them and the pipeline health view could not count them.
--
-- Rows written before this migration keep a null model, which is honest: the
-- model that answered them was not recorded and cannot be recovered.

alter table public.agent_answers
  add column model text;

comment on column public.agent_answers.model is
  'The model that produced this answer. Differs from the configured answer model when the gateway fell back (D-031). Null for answers recorded before the column existed.';

-- The review queue and pipeline health both group recent answers by model.
create index agent_answers_model_idx
  on public.agent_answers (workspace_id, model, created_at desc);
