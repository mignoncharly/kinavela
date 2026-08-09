# Backup and recovery

Supabase production backups and point-in-time capabilities must be confirmed in the Supabase project plan before user data is accepted. Application source is recoverable from GitHub; build artifacts and dependencies are regenerated from the locked commit and `package-lock.json`.

The production environment file is not in Git and must be held in an approved encrypted secret backup. Never put it in a normal archive. Nginx, systemd, and migration source are versioned under `deploy/` and `supabase/`.

Recovery order: restore secrets securely, restore/verify Supabase, check out the release commit, `npm ci`, build, install only Kinavela service/vhost assets, start the service, and run health/readiness plus RLS assertions.
