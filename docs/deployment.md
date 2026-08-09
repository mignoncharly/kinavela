# Production deployment

## Topology

- Project: `/home/mignon/apps/gtech/kinavela`
- Process: `kinavela.service`
- Loopback listener: `127.0.0.1:3020`
- Hostname: `kinavela.gestionatech.de`
- Nginx site: `/etc/nginx/sites-available/kinavela`
- Logs: `/var/log/kinavela/`, Nginx logs prefixed `kinavela`
- Secrets: `.env.production` mode `0600`, never committed

## First install

Run quality gates and migration as the application user, then execute `sudo ./deploy/install-root.sh`. The installer is limited to Kinavela targets. It backs up an existing exact service/site file, checks port 3020, installs the service and HTTP challenge vhost, validates Nginx, obtains a hostname-specific Certbot certificate, installs the TLS vhost, validates again, and performs a readiness request.

## Update

Fetch reviewed source, run `npm ci`, `npm run db:migrate`, `npm run check`, and `npm run build`; then run `sudo systemctl restart kinavela.service`. Validate `/api/health`, `/api/readiness`, service status, logs, and HTTPS. Never restart unrelated units.

## Rollback

Check out the previous Kinavela commit, run `npm ci` and `npm run build`, then restart only `kinavela.service`. Database migrations are forward-only; write a reviewed compensating migration instead of resetting production.
