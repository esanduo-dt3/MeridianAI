-- Post-migration checks. Run with:
--   psql "$DATABASE_URL" -X -f scripts/db/verify.sql
-- Every row in the first result must say rls_enabled = t.

select c.relname as table_name, c.relrowsecurity as rls_enabled,
       (select count(*) from pg_policies p where p.schemaname = 'public' and p.tablename = c.relname) as policies
from pg_class c
join pg_namespace n on n.oid = c.relnamespace
where n.nspname = 'public' and c.relkind = 'r'
order by c.relname;

select 'anon can read public tables' as check_name,
       count(*) = 0 as passed
from information_schema.role_table_grants
where grantee = 'anon' and table_schema = 'public';

select 'signup trigger installed' as check_name,
       exists (select 1 from pg_trigger where tgname = 'on_auth_user_created') as passed;

select 'documents bucket is private' as check_name,
       exists (select 1 from storage.buckets where id = 'documents' and public = false) as passed;
