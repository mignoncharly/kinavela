# Privacy model

Children will never be standalone users or publicly searchable profiles. Guardians authorize all child resources. Exact home coordinates must never be returned to other families; discovery will expose deliberate distance buckets or approximate areas only.

Visibility defaults remain conservative. Connections require mutual consent before private communication. Private media must use signed URLs, and children’s media must never use permanent public URLs. Data minimization, consent, export, deletion, and retention controls are release gates rather than post-launch additions.

Cultural mission content is public-to-authenticated catalogue material, not a
place to store a family's story. Source prompts ask families to preserve
recording, naming and sharing consent. Catalogue projections contain no child,
contact, location or family-progress identity; completed reflections enter the
existing private Roots Passport flow only through an explicit guardian action.

Roots Passport media is served only after live entry authorization through a
five-minute signed URL. Replacing or deleting media removes the superseded
private object. Village visibility applies to one entry and one explicitly
selected active Village; it does not reveal the child's profile or other
Passport entries. Export archives are private, expire after seven days and
contain a path-free media manifest rather than permanent media links.

Phase 3 stores only a selected city/postcode result centre with `location_precision = city`; it never requests an address or device GPS. Other families receive only an approximate city label and a distance bucket. Geocoding queries are restricted to city/postcode syntax, cached by a one-way query hash, and sent through the server rather than directly from the browser.

Discovery child information is computed into broad age bands. Child nicknames, birth month/year rows, coordinates, contact details, and profile records remain unavailable to other families. Blocking removes both sides from discovery without revealing who initiated the block.

Phase 4 scoring uses only information families explicitly supplied for discovery. Component values stay inside the private database function; the client receives the final score and conservative explanation keys. No behavior, ethnicity, parenting judgment, safety inference, or opaque AI signal is used.

Phase 5 pending requests reveal no more than discovery: family name, approximate city, and country. Acceptance adds only the family bio and display names of active owners/guardians. Email addresses, authentication identifiers, contact details, exact coordinates, child rows, and avatars are absent from the RPC contract. Declines are not announced to the requester. Blocking immediately invalidates an accepted connection, removes its notifications, and hides it from the connection list; unblocking leaves the pair declined and never silently restores access.

Phase 6 message bodies are visible only to active members of the two currently connected families. Messages are plain text with no HTML, uploads, analytics, public links, or search indexing. Blocking makes the conversation and its history immediately unreadable to both sides through the application roles. Mute is per profile and suppresses message notifications without deleting unread state. Reports reference the original family/message in a private moderation record; audit events record only the report ID and never copy message content.

Phase 7 listed-Village discovery returns only name, description, city, cultural focus, type, and family counts to eligible nearby families. The stored Village center is copied from its creator family's approximate city location and never appears in an RPC projection. Overview, family roster, governance, reports, and chat require active membership. Removed or departed families immediately lose read access. Village reports preserve references without copying message text into audit metadata; moderated messages are tombstoned and hidden from member RLS while retained for later privileged review.

The structured Village support board is also active-members-only and has no public projection. Posts and replies require an explicit no-private-data confirmation; obvious email and phone patterns are rejected, uploads are unavailable, and fixed privacy/safety reports feed the existing moderation system. Notification and audit metadata contain identifiers and category/type codes only, never support text. Personal-data exports include authored support content, and account deletion tombstones and replaces it.

## Phase 8 events

Events are visible only inside an active Village. Exact addresses are separated from public-schema event data and remain hidden from ordinary families until the organizer explicitly shares with all members or the family holds an effective Going RSVP. Waitlisted and Maybe families receive only the public location description. Reminder records contain typed references and timing, never an address or event description.

## Phase 9 Village recommendations

Cluster detection runs entirely in a private database routine and considers only families that deliberately remain discoverable. Bidirectional blocks and each family's chosen radius are respected before aggregation. The client receives only an origin country, the requesting family's own city, a family count, broad child age bands, and the fixed 30 km threshold. It never receives candidate family IDs, names, profiles, child rows, distances, or coordinates.

Reading a recommendation has no side effects. Only a family owner can dismiss or explicitly start one, and the detector is re-run at action time. Dismissal and creation consent are retained in an RPC-only forced-RLS table and in minimal audit events.

## Phase 14 legacy access data

Pilot-era waitlist rows are copied to a private rollback archive before their active status is migrated. Browser roles have no table access. The archive is deleted after 180 days by the privacy cron, and logical account deletion removes a profile's archived rows immediately. Only de-identified city-level interest totals remain for reviewed outreach analytics.

The Germany-wide access notice contains only a country code and fixed availability state. In-app delivery is an essential service notice; optional email and push continue to require the existing preferences, consent, feature flags, and device registration. No child, address, message, transcript, contact, or precise-location data enters the notification.
