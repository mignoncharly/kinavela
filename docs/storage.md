# Storage

The deployed product uses three private Supabase Storage buckets:

- `roots-media` stores guardian-managed Roots Passport media.
- `story-audio` stores private original and derived story audio.
- `privacy-exports` stores short-lived personal-data export artifacts.

All buckets are non-public and enforce object-level policies. Application clients receive only short-lived signed access where a feature requires it; the privacy export endpoint authenticates the owner and streams the file as a private attachment. Child and family media remains private by default. Future buckets require a reviewed migration, explicit policies, MIME and size limits, and authorization tests before use.
