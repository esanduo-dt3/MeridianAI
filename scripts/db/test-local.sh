#!/usr/bin/env bash
# Applies every migration to a throwaway local Postgres (with Supabase stand-ins)
# and runs the row-level security behaviour checks. Touches nothing remote.
#
# Requires a local PostgreSQL 15+ (psql, initdb, pg_ctl). pgvector is not
# required: the vector column is swapped for float4[] in the local copy only.
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
PORT="${PGTEST_PORT:-54329}"
WORK="$(mktemp -d)"
trap 'pg_ctl -D "$WORK/data" stop -m immediate >/dev/null 2>&1 || true; rm -rf "$WORK"' EXIT

initdb -D "$WORK/data" -U postgres --auth=trust >/dev/null
pg_ctl -D "$WORK/data" -o "-p $PORT -k '' -c listen_addresses=127.0.0.1" -l "$WORK/log" start >/dev/null
for _ in $(seq 1 20); do pg_isready -h 127.0.0.1 -p "$PORT" >/dev/null 2>&1 && break; sleep 0.5; done

psql_local() { psql -h 127.0.0.1 -p "$PORT" -U postgres -X -q -v ON_ERROR_STOP=1 "$@"; }
psql_local -c "create database meridian_test"
psql_local -d meridian_test -f "$ROOT/supabase/tests/local-stubs.sql" >/dev/null

for file in "$ROOT"/supabase/migrations/*.sql; do
  echo "applying $(basename "$file")"
  sed -E -e 's/^create extension if not exists vector.*$//' \
      -e 's/extensions\.vector(\([0-9]+\))?/float4[]/g' \
      -e '/^set hnsw\./d' \
      -e '/using hnsw/d' -e '/chunk_embeddings_hnsw_idx/d' \
      "$file" | psql_local -d meridian_test --single-transaction >/dev/null
done

echo
PGTEST_PORT="$PORT" bash "$ROOT/supabase/tests/rls_behaviour.sh"
