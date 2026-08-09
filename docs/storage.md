# Storage

No media buckets are provisioned in Phase 0 because no media feature exists yet. Future buckets are `avatars`, `family-media`, `roots-media`, `story-audio`, `event-media`, and `verification-private`.

All child/family media is private by default and accessed using short-lived signed URLs. `verification-private` must never be public. Storage policies must verify family/guardian membership and ship with authorization tests before a bucket is used.
