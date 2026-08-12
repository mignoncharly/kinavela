# Phase 5 production qualification

Phase 5 adds family connections only. Messaging remains disabled until Phase 6.

## State and authorization

- One canonical row exists for each unordered family pair.
- An active family owner may request only a mutually discoverable family within both configured radii.
- A family can initiate at most ten request operations in 24 hours.
- Only the recipient family owner may accept or decline a pending request.
- A declined pair cannot be requested again for 30 days.
- Blocking changes any existing pair to `blocked`, clears connection notifications, and makes the accepted-connection predicate false.
- Unblocking changes a solely blocked pair to `declined`; it never restores acceptance.

## Privacy contract

Before acceptance, `list_family_connections()` returns family name, approximate city, country, direction, status, and timestamps. `bio` is null and `guardian_names` is empty.

After acceptance, it may additionally return the other family's bio and active owner/guardian display names. The return signature contains no email, authentication ID, exact location, child field, avatar, or contact field. Notifications contain a fixed type and references only; users cannot submit notification text.

## Qualification commands

```bash
cd /home/mignon/apps/gtech/kinavela
npm run db:migrate
npm run db:test
npm run check
PLAYWRIGHT_BASE_URL=http://127.0.0.1:3021 npm run test:e2e
```

Build and run the isolated Playwright server on port 3021 before the E2E command. After all gates pass, restart only `kinavela.service`, then verify health, readiness, and unauthenticated redirect behavior over HTTPS.
