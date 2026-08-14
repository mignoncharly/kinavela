# Product decisions

- The public name is Kinavela; the product loop and domain language retain Roots and Village.
- Phase 0 is deployed independently before authentication or MVP features are attempted.
- German, French, and English are first-class from the first public page.
- Community density and real-world cultural experiences matter more than social-feed engagement.
- The platform begins with Cameroonian families in Germany while the data model remains multi-country and multi-culture.
- Pilot-era waitlist identifiers remain only in private rollback storage for 180 days; outreach analytics use de-identified city totals, and optional migration email/push follows existing consent.
- Every valid geocoded German municipality and postcode-derived place is immediately eligible; regional density, historical pilot status, and family count are analytics and never admission controls.
- Post-onboarding family profile management is owner-only and atomic. Guardians and members receive read-only access appropriate to their role; child deletion is refused when it would cascade into cultural memories or stories.
- Profile city is never free text. Only a validated geocoder place may update family geography and its synchronized owner-profile display city.
- Cultural missions distinguish country-, community- and family-level context.
  A named tradition is presented through a consented family or community
  source, never as a universal claim about Cameroon or an ethnic community.
  Only explicitly reviewed content may be published.
- Phase 3 uses explicit, user-triggered city/postcode search rather than autocomplete or precise device GPS. The small pilot may use the public Nominatim endpoint behind server caching and strict limits; `GEOCODING_BASE_URL` allows migration to a dedicated/commercial provider without a client release.
- Discovery explanations remain factual shared attributes derived from the documented score components.
- Phase 4 compatibility is a normalized deterministic score using documented weights and the requester's explicit priorities. It does not learn from behavior, infer identity, or call AI. Stable ties resolve by distance and UUID.
- Phase 5 models mutual consent as one directed request plus an explicit recipient acceptance, not two independent requests. A pending request exposes discovery-safe data; acceptance exposes only family bio and guardian display names. Declines remain quiet, and unblocking never restores a previous acceptance.
- Basic notifications are typed database events with no free-form body. Messaging is intentionally deferred to Phase 6 and must be authorized by the accepted-connection predicate.
- Phase 6 messaging is family-to-family plain text only. There are no attachments, reactions, typing indicators, global chat, GIFs, or stories. A conversation exists only for an accepted family connection and becomes inaccessible immediately after a block.
- Realtime uses filtered Postgres Changes at the initial operating scale. The client ignores row payload content and refreshes the authorized server projection. Move to private Broadcast if measured concurrent subscription volume outgrows Postgres Changes.
- Mute is a per-profile notification preference; it does not hide unread messages. Reports use fixed safety reasons and preserve a moderation reference without copying private message text into analytics or audit logs.
- A Phase 7 Village is a family-level private community, not a public group or social feed. Listed Villages expose a deliberately small nearby discovery card; their roster, content, reports, and chat remain member-only.
- Invitations are limited to mutually connected families. Listed-Village join requests require approximate-radius eligibility. Village activation rechecks blocks and capacity under a row lock.
- Village ownership is singular and transferable. Organizers and moderators may manage requests and ordinary members, but role assignment and ownership transfer remain owner-only. Events and cultural-content creation stay deferred to their dedicated phases.

## Phase 8 decisions

- Events are private Village coordination objects, not public Meetup-style listings.
- Capacity counts families rather than individuals. Adult/child totals support planning but do not determine capacity.
- Going reserves capacity; Maybe does not. Full Going requests enter a deterministic FIFO waitlist.
- Exact addresses default to Going families only. Organizers may deliberately share them with all active Village members.
- Phase 8 reminders are typed in-app deliveries; event email and push channels remain later notification-phase work.

## Phase 9 decisions

- A Village recommendation requires seven origin-linked, mutually discoverable families within 30 km and at least three represented child age bands. Candidate child ages must be within three years of one of the requesting family's children.
- Clusters are grouped by origin country so a Bamiléké and a Cameroon country-level selection can contribute to the same Cameroon opportunity without exposing a family's more specific culture.
- Detection is deterministic database logic, not AI or behavioral ranking. Blocked, private, inactive, childless, out-of-radius, and culturally unrelated families are excluded.
- Recommendations expose aggregates only. They never reveal who the nearby families are.
- Kinavela never auto-creates a Village. A family owner must explicitly start it; dismissals are respected, and the recommendation is revalidated under a transaction lock before creation.
