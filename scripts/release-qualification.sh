#!/usr/bin/env bash
set -euo pipefail

PROJECT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$PROJECT_DIR"

step() {
  local label="$1"
  shift
  printf '\n==> %s\n' "$label"
  "$@"
}

step "environment contract" npm run env:check
step "secret scan" npm run security:scan
step "production dependency audit" npm audit --omit=dev --audit-level=high
step "application checks" env -u NODE_ENV npm run check
step "remote database migrations" npm run db:migrate
step "remote database assertions" npm run db:test

if [[ -n "${SMOKE_BASE_URL:-}" ]]; then
  step "public HTTPS smoke" env SMOKE_BASE_URL="$SMOKE_BASE_URL" npm run smoke:production
else
  echo
  echo "SMOKE_BASE_URL is not set; public HTTPS smoke was not run."
fi

echo
echo "Kinavela release qualification passed."
