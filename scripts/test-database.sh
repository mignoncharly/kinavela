#!/usr/bin/env bash
set -euo pipefail

PROJECT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
ENV_FILE="${KINAVELA_ENV_FILE:-$PROJECT_DIR/.env.production}"

set -a
# shellcheck disable=SC1090
source "$ENV_FILE"
set +a

for test_file in "$PROJECT_DIR"/supabase/tests/*.sql; do
  psql --no-psqlrc --set ON_ERROR_STOP=1 "$DATABASE_URL" --file "$test_file"
done

echo "Kinavela database assertions passed."
