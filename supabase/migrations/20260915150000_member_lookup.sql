-- Look up a user id by email for adding people to a workspace (docs/decisions.md D-007).
-- Only the service role may call it: users must not be able to probe which emails
-- have accounts. The API calls it after confirming the caller is an Admin.

create or replace function public.find_user_id_by_email(lookup_email text)
returns uuid
language sql stable security definer set search_path = ''
as $$
  select id from public.users where lower(email) = lower(btrim(lookup_email)) limit 1;
$$;

revoke all on function public.find_user_id_by_email(text) from public, anon, authenticated;
grant execute on function public.find_user_id_by_email(text) to service_role;
