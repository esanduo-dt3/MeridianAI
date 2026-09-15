# Working with the database

Approach: [D-015](../decisions.md#d-015). Schema reference: [architecture/data-model.md](../architecture/data-model.md).

## Layout

| Path | Contents |
| --- | --- |
| `supabase/migrations/` | Timestamped SQL files, applied in filename order, never edited once applied |
| `supabase/tests/local-stubs.sql` | Stand-ins for Supabase's `auth`, `storage` and roles, for local testing only |
| `supabase/tests/rls_behaviour.sh` | Access-rule checks for Admin, Member, outsider, anonymous and service role |
| `scripts/db/test-local.sh` | Creates a throwaway local Postgres, applies all migrations, runs the checks |
| `scripts/db/migrate.sh` | Applies pending migrations to the database in `DATABASE_URL` |
| `scripts/db/verify.sql` | Post-migration checks against Supabase |

## Making a schema change

1. Create a new file. Never modify an applied one.
   ```bash
   touch supabase/migrations/$(date +%Y%m%d%H%M%S)_short_description.sql
   ```
2. **Every new table** must have:
   - `workspace_id`, or a documented path to one;
   - `enable row level security`;
   - explicit policies for `authenticated`.

   `anon` has no table privileges.
3. If the change departs from the PRD, add an entry to [decisions.md](../decisions.md) in the same change.
4. Add checks for the new rules to `supabase/tests/rls_behaviour.sh`.
5. Prove it locally, then apply it:
   ```bash
   scripts/db/test-local.sh
   scripts/db/migrate.sh --status
   scripts/db/migrate.sh
   psql "$DATABASE_URL" -X -f scripts/db/verify.sql
   ```
6. Update [architecture/data-model.md](../architecture/data-model.md).

## Testing access rules

`scripts/db/test-local.sh` needs only a local PostgreSQL (`initdb`, `pg_ctl`, `psql`).

- **What it does.** It runs the migrations on a temporary cluster, swapping `vector` columns for `float4[]` in the local copy because pgvector isn't needed to test access rules. Then it signs in as different users by setting `request.jwt.claims`, the same mechanism Supabase uses.
- **When to run it.** Before every migration is applied.
- **Last result.** 36 passed, 0 failed (2026-09-15).

## Connection strings

- Use the **Session pooler** string from Supabase → **Connect**. The direct `db.<ref>.supabase.co` host is IPv6-only and fails on many networks.
- The string contains the database password. It belongs only in `backend/.env` and deployment secrets.
