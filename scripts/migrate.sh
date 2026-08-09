#!/usr/bin/env bash
set -euo pipefail

PROJECT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
ENV_FILE="${KINAVELA_ENV_FILE:-$PROJECT_DIR/.env.production}"

if [[ ! -r "$ENV_FILE" ]]; then
  echo "Environment file is not readable: $ENV_FILE" >&2
  exit 1
fi

set -a
# shellcheck disable=SC1090
source "$ENV_FILE"
set +a

node "$PROJECT_DIR/scripts/validate-env.mjs"

for migration in "$PROJECT_DIR"/supabase/migrations/*.sql; do
  version="$(basename "$migration" .sql)"
  applied="$(psql --no-psqlrc --tuples-only --no-align "$DATABASE_URL" \
    --command "select exists(select 1 from kinavela_private.schema_migrations where version = '$version')")"
  if [[ "$applied" == "t" ]]; then
    echo "Skipping applied migration: $version"
    continue
  fi
  psql --no-psqlrc --set ON_ERROR_STOP=1 "$DATABASE_URL" --file "$migration"
  echo "Applied migration: $version"
done
