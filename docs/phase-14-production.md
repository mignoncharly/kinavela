# Phase 14 — PWA production handoff

Phase 14 adds an installable PWA shell without automatically caching authenticated family data.

- `app/manifest.ts` declares the standalone application, stable scope, theme and portrait orientation.
- `public/sw.js` provides a network-first navigation strategy with `/offline` fallback, static asset caching, and push notification click handling.
- `components/pwa/pwa-runtime.tsx` registers the worker and exposes the Android/Chrome install prompt when the browser supports it.
- Passport and Missions are saved only after an explicit user action, in IndexedDB on the current device. The snapshots contain the existing privacy-safe DTOs, never database rows or storage paths.
- Sign-out clears the local snapshots before the Supabase session is closed.

## Manual device matrix

### Android Chrome

1. Open Kinavela over HTTPS, sign in, and confirm the install prompt appears after the browser installability criteria are met.
2. Install the app, open it from the launcher, and confirm standalone display and portrait layout.
3. While online, save a Passport and Missions snapshot; switch to airplane mode; open `/offline`; confirm both snapshots render.
4. Confirm authenticated application navigations do not show stale HTML and fall back only to the offline shell.
5. Restore connectivity, sign out, return to `/offline`, and confirm the saved private snapshots are gone.
6. Send a test push only after explicit notification consent is implemented in Phase 15; the worker already handles display and click routing.

### iOS Safari / Home Screen

1. Add the site to the Home Screen from Safari and confirm the standalone shell opens where supported.
2. Save Passport/Missions snapshots before suspending Safari, then reopen `/offline` and confirm IndexedDB persistence.
3. Verify the app still offers the normal web experience when install prompts and background push are unavailable.
4. Treat iOS background execution, push permission and storage eviction as platform limitations; do not promise offline sync or background notifications.

The PWA does not cache audio, signed URLs, authenticated HTML, API responses or service-role data. Offline snapshots are device-local convenience copies and must be cleared when a user signs out or shares the device.
