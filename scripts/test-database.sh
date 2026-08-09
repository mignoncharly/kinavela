#!/usr/bin/env bash
set -euo pipefail

PROJECT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
ENV_FILE="${KINAVELA_ENV_FILE:-$PROJECT_DIR/.env.production}"

set -a
# shellcheck disable=SC1090
source "$ENV_FILE"
set +a

psql --no-psqlrc --set ON_ERROR_STOP=1 "$DATABASE_URL" \
  --file "$PROJECT_DIR/supabase/tests/0001_foundation.sql"

echo "Kinavela database assertions passed."
