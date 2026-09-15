#!/usr/bin/env bash
# Applies supabase/migrations/*.sql in filename order, each in its own
# transaction, and records applied versions in private.schema_migrations.
# Reads DATABASE_URL from the environment or backend/.env.
#
#   scripts/db/migrate.sh            apply pending migrations
#   scripts/db/migrate.sh --status   list applied and pending migrations
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
MIGRATIONS_DIR="$ROOT/supabase/migrations"

if [[ -z "${DATABASE_URL:-}" && -f "$ROOT/backend/.env" ]]; then
  DATABASE_URL="$(grep -E '^DATABASE_URL=' "$ROOT/backend/.env" | head -1 | cut -d= -f2-)"
fi
if [[ -z "${DATABASE_URL:-}" ]]; then
  echo "DATABASE_URL is not set. Add the Supabase session pooler connection string to backend/.env." >&2
  exit 1
fi

PSQL=(psql "$DATABASE_URL" -X -q -v ON_ERROR_STOP=1)

"${PSQL[@]}" -c "create schema if not exists private;
  create table if not exists private.schema_migrations (
    version text primary key,
    applied_at timestamptz not null default now()
  );" >/dev/null

applied="$("${PSQL[@]}" -At -c "select version from private.schema_migrations order by version")"

pending=0
for file in "$MIGRATIONS_DIR"/*.sql; do
  version="$(basename "$file" .sql)"
  if grep -qx "$version" <<<"$applied"; then
    [[ "${1:-}" == "--status" ]] && echo "applied  $version"
    continue
  fi
  pending=$((pending + 1))
  if [[ "${1:-}" == "--status" ]]; then
    echo "pending  $version"
    continue
  fi
  echo "applying $version"
  {
    cat "$file"
    printf "\ninsert into private.schema_migrations (version) values ('%s');\n" "$version"
  } | "${PSQL[@]}" --single-transaction >/dev/null
done

if [[ "${1:-}" != "--status" ]]; then
  echo "done ($pending applied)"
fi
