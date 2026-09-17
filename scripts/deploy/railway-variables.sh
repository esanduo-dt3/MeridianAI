#!/usr/bin/env bash
# Sets the Railway variables for the backend and frontend services from the local
# .env files. Values are passed on stdin, so they never appear on a command line
# or in this script's output; only variable names are printed. Setting variables
# does not trigger deploys.
#
#   scripts/deploy/railway-variables.sh <backend-domain> <frontend-domain>
#
# Run from a directory linked to the Railway project (railway init or railway link).
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
BACKEND_DOMAIN="${1:?usage: railway-variables.sh <backend-domain> <frontend-domain>}"
FRONTEND_DOMAIN="${2:?usage: railway-variables.sh <backend-domain> <frontend-domain>}"

set_var() { # service key value
  printf '%s' "$3" | railway variable set --service "$1" --skip-deploys --stdin "$2" >/dev/null
  echo "  $1: $2"
}

# Local-only settings: DATABASE_URL is used only by scripts/db/migrate.sh, and the
# origin and environment are set for Railway below.
from_env_file() { # service file skip-regex
  local key value
  while IFS= read -r line || [[ -n "$line" ]]; do
    [[ "$line" =~ ^([A-Z_][A-Z0-9_]*)=(.*)$ ]] || continue
    key="${BASH_REMATCH[1]}"
    value="${BASH_REMATCH[2]}"
    value="${value%\"}"; value="${value#\"}"
    [[ -z "$value" || "$key" =~ $3 ]] && continue
    set_var "$1" "$key" "$value"
  done < "$2"
}

echo "backend"
from_env_file backend "$ROOT/backend/.env" '^(DATABASE_URL|FRONTEND_ORIGIN|ENVIRONMENT|PORT)$'
set_var backend ENVIRONMENT production
set_var backend FRONTEND_ORIGIN "https://$FRONTEND_DOMAIN"
set_var backend PORT 8080

echo "frontend"
# Vite reads these at build time, so a change needs a redeploy of the frontend.
from_env_file frontend "$ROOT/frontend/.env" '^(VITE_API_BASE_URL|PORT)$'
set_var frontend VITE_API_BASE_URL "https://$BACKEND_DOMAIN"
set_var frontend PORT 8080
