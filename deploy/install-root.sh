#!/usr/bin/env bash
set -euo pipefail

if [[ "${EUID}" -ne 0 ]]; then
  echo "Run this reviewed installer with sudo." >&2
  exit 1
fi

PROJECT_DIR="/home/mignon/apps/gtech/kinavela"
DOMAIN="kinavela.gestionatech.de"
SERVICE_TARGET="/etc/systemd/system/kinavela.service"
NGINX_TARGET="/etc/nginx/sites-available/kinavela"
NGINX_LINK="/etc/nginx/sites-enabled/kinavela"
STAMP="$(date -u +%Y%m%dT%H%M%SZ)"

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
backup_exact_target "$NGINX_TARGET"

install -m 0644 "$PROJECT_DIR/deploy/kinavela.service" "$SERVICE_TARGET"
systemctl daemon-reload
systemctl enable --now kinavela.service
curl --fail --silent --show-error --max-time 10 http://127.0.0.1:3020/api/health >/dev/null

install -d -m 0755 /var/www/kinavela-certbot
install -m 0644 "$PROJECT_DIR/deploy/nginx-http.conf" "$NGINX_TARGET"
ln -sfn "$NGINX_TARGET" "$NGINX_LINK"
nginx -t
systemctl reload nginx

if [[ ! -s "/etc/letsencrypt/live/$DOMAIN/fullchain.pem" ]]; then
  certbot certonly --webroot --webroot-path /var/www/kinavela-certbot \
    --domain "$DOMAIN" --email info@gestionatech.de --agree-tos --non-interactive
fi

install -m 0644 "$PROJECT_DIR/deploy/nginx.conf" "$NGINX_TARGET"
nginx -t
systemctl reload nginx

systemctl restart kinavela.service
curl --fail --silent --show-error --max-time 15 "https://$DOMAIN/api/readiness" >/dev/null

echo "Kinavela systemd, Nginx, and TLS installation completed."
