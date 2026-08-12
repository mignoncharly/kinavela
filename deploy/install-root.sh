#!/usr/bin/env bash
set -euo pipefail

if [[ "${EUID}" -ne 0 ]]; then
  echo "Run this reviewed installer with sudo." >&2
  exit 1
fi

PROJECT_DIR="/home/mignon/apps/kinavela"
DOMAIN="www.kinavela.com"
APEX_DOMAIN="kinavela.com"
CERTBOT_EMAIL="${CERTBOT_EMAIL:-admin@kinavela.com}"
SERVICE_TARGET="/etc/systemd/system/kinavela.service"
REMINDER_SERVICE_TARGET="/etc/systemd/system/kinavela-event-reminders.service"
REMINDER_TIMER_TARGET="/etc/systemd/system/kinavela-event-reminders.timer"
PRIVACY_SERVICE_TARGET="/etc/systemd/system/kinavela-privacy.service"
PRIVACY_TIMER_TARGET="/etc/systemd/system/kinavela-privacy.timer"
AI_SERVICE_TARGET="/etc/systemd/system/kinavela-ai-worker.service"
AI_TIMER_TARGET="/etc/systemd/system/kinavela-ai-worker.timer"
STORY_AI_SERVICE_TARGET="/etc/systemd/system/kinavela-story-ai-worker.service"
STORY_AI_TIMER_TARGET="/etc/systemd/system/kinavela-story-ai-worker.timer"
NGINX_TARGET="/etc/nginx/sites-available/kinavela"
NGINX_LINK="/etc/nginx/sites-enabled/kinavela"
STAMP="$(date -u +%Y%m%dT%H%M%SZ)"

wait_for_url() {
  local url="$1"
  local attempt
  for attempt in {1..30}; do
    if curl --fail --silent --max-time 10 "$url" >/dev/null; then
      return 0
    fi
    sleep 1
  done
  echo "Timed out waiting for $url" >&2
  return 1
}

backup_exact_target() {
  local target="$1"
  if [[ -e "$target" && ! -L "$target" ]]; then
    cp -p "$target" "${target}.backup-${STAMP}"
  fi
}

if ss -ltn | awk '{print $4}' | grep -Eq '(^|:)3020$'; then
  if ! systemctl is-active --quiet kinavela.service; then
    echo "Port 3020 is already occupied by a non-Kinavela process." >&2
    exit 1
  fi
fi

backup_exact_target "$SERVICE_TARGET"
backup_exact_target "$REMINDER_SERVICE_TARGET"
backup_exact_target "$REMINDER_TIMER_TARGET"
backup_exact_target "$PRIVACY_SERVICE_TARGET"
backup_exact_target "$PRIVACY_TIMER_TARGET"
backup_exact_target "$AI_SERVICE_TARGET"
backup_exact_target "$AI_TIMER_TARGET"
backup_exact_target "$STORY_AI_SERVICE_TARGET"
backup_exact_target "$STORY_AI_TIMER_TARGET"
backup_exact_target "$NGINX_TARGET"

install -m 0644 "$PROJECT_DIR/deploy/kinavela.service" "$SERVICE_TARGET"
install -m 0644 "$PROJECT_DIR/deploy/kinavela-event-reminders.service" "$REMINDER_SERVICE_TARGET"
install -m 0644 "$PROJECT_DIR/deploy/kinavela-event-reminders.timer" "$REMINDER_TIMER_TARGET"
install -m 0644 "$PROJECT_DIR/deploy/kinavela-privacy.service" "$PRIVACY_SERVICE_TARGET"
install -m 0644 "$PROJECT_DIR/deploy/kinavela-privacy.timer" "$PRIVACY_TIMER_TARGET"
install -m 0644 "$PROJECT_DIR/deploy/kinavela-ai-worker.service" "$AI_SERVICE_TARGET"
install -m 0644 "$PROJECT_DIR/deploy/kinavela-ai-worker.timer" "$AI_TIMER_TARGET"
install -m 0644 "$PROJECT_DIR/deploy/kinavela-story-ai-worker.service" "$STORY_AI_SERVICE_TARGET"
install -m 0644 "$PROJECT_DIR/deploy/kinavela-story-ai-worker.timer" "$STORY_AI_TIMER_TARGET"
install -d -o mignon -g mignon -m 0750 /var/log/kinavela
touch /var/log/kinavela/application.log /var/log/kinavela/error.log
chown mignon:mignon /var/log/kinavela/application.log /var/log/kinavela/error.log
chmod 0640 /var/log/kinavela/application.log /var/log/kinavela/error.log
systemctl daemon-reload
systemctl enable kinavela.service
systemctl enable --now kinavela-event-reminders.timer
systemctl enable --now kinavela-privacy.timer
if grep -Eq "^AI_PROVIDER=openai([[:space:]]|$)" "$PROJECT_DIR/.env.production"; then
  systemctl enable --now kinavela-ai-worker.timer
  systemctl enable --now kinavela-story-ai-worker.timer
else
  systemctl disable --now kinavela-ai-worker.timer 2>/dev/null || true
  systemctl disable --now kinavela-story-ai-worker.timer 2>/dev/null || true
fi
systemctl restart kinavela.service
wait_for_url "http://127.0.0.1:3020/api/health"

install -d -m 0755 /var/www/kinavela-certbot
if [[ ! -s "/etc/letsencrypt/live/$DOMAIN/fullchain.pem" ]]; then
  install -m 0644 "$PROJECT_DIR/deploy/nginx-http.conf" "$NGINX_TARGET"
  ln -sfn "$NGINX_TARGET" "$NGINX_LINK"
  nginx -t
  systemctl reload nginx
  certbot certonly --webroot --webroot-path /var/www/kinavela-certbot \
    --cert-name "$DOMAIN" --domain "$DOMAIN" --domain "$APEX_DOMAIN" --email "$CERTBOT_EMAIL" --agree-tos --non-interactive
fi

install -m 0644 "$PROJECT_DIR/deploy/nginx.conf" "$NGINX_TARGET"
ln -sfn "$NGINX_TARGET" "$NGINX_LINK"
nginx -t
systemctl reload nginx

systemctl restart kinavela.service
curl --fail --silent --show-error --max-time 10 --resolve "$DOMAIN:443:127.0.0.1" "https://$DOMAIN/api/readiness" >/dev/null

echo "Kinavela systemd, Nginx, and TLS installation completed."
