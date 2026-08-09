# Security

- Service-role, database, and SMTP credentials are server-only and never use `NEXT_PUBLIC_`.
- `.env*`, the supplied credential inventory, keys, and certificates are ignored by Git.
- Production runs as the unprivileged `mignon` account with systemd hardening and a read-only filesystem except for the Next cache and dedicated logs.
- Port 3020 binds to `127.0.0.1`; only Nginx is Internet-facing.
- TLS, HSTS, frame denial, content-type protection, referrer policy, permissions policy, and a restrictive CSP are applied at Nginx.
- Health responses contain no credentials or exception details.
- Sentry PII transmission is disabled and remains inactive until a DSN is explicitly configured.

Before later phases launch, perform the blueprint's RLS, IDOR, upload, CSRF, XSS, rate-limit, signed-URL, admin-authorization, and secret-scanning gates.
