# Phase 8 production qualification

Phase 8 adds complete Village event coordination: organizer creation/edit/cancellation, family RSVP, capacity and FIFO waitlisting, private exact addresses, reminders, and attendance confirmation. Events remain Village-only; public event discovery and event media are out of scope.

## Authorization and privacy

- Only active Village owners and organizers can create, edit, cancel, remind, or confirm attendance. Moderators and ordinary members cannot manage events.
- Every family-level RSVP requires an active family owner. A row lock serializes capacity decisions; a full event converts a `going` request to `waitlisted` and the earliest waiting family is promoted when capacity opens.
- Exact addresses live only in `kinavela_private.event_locations`, which has no API-role grants. The authorized event projection reveals the address to event managers, all members when explicitly configured, or a family with an effective `going` RSVP.
- Non-members cannot list events, attendees, reminders, or addresses through RPC or direct RLS reads. Cancellation and Village removal immediately preserve that boundary.
- Event inputs are bounded in the browser, route handler, database constraints, and RPC guards. Event creation is limited to ten per organizing family per 24 hours; organizer reminders are limited to one per event per hour.

## Reminders and attendance

Going families receive one scheduled in-app reminder within 24 hours of the event. Updates, cancellations, organizer reminders, and waitlist promotion create typed event deliveries without copying private addresses into notification payloads.

`kinavela-event-reminders.timer` invokes the loopback-only application endpoint every 15 minutes. The endpoint requires the server-only `EVENT_REMINDER_CRON_SECRET`, compares it in constant time, and calls the service-role-only dispatcher. Attendance can be confirmed no earlier than two hours before the event and is recorded with the confirming organizer profile in the private audit trail.

## Qualification commands

```bash
cd /home/mignon/apps/kinavela
npm run db:migrate
npm run db:test
npm run check
PLAYWRIGHT_BASE_URL=http://127.0.0.1:3021 npm run test:e2e
```

After all gates pass, install/update the reviewed systemd units, restart only `kinavela.service`, and confirm `kinavela-event-reminders.timer` is active. Verify organizer creation/edit/cancel, a one-place event with two family RSVPs, FIFO promotion, address visibility before and after RSVP, reminder delivery, and attendance confirmation. Confirm a non-member and an ordinary member cannot perform organizer actions.
