# Privacy model

Children will never be standalone users or publicly searchable profiles. Guardians authorize all child resources. Exact home coordinates must never be returned to other families; discovery will expose deliberate distance buckets or approximate areas only.

Visibility defaults remain conservative. Connections require mutual consent before private communication. Private media must use signed URLs, and children’s media must never use permanent public URLs. Data minimization, consent, export, deletion, and retention controls are release gates rather than post-launch additions.

Phase 3 stores only a selected city/postcode result centre with `location_precision = city`; it never requests an address or device GPS. Other families receive only an approximate city label and a distance bucket. Geocoding queries are restricted to city/postcode syntax, cached by a one-way query hash, and sent through the server rather than directly from the browser.

Discovery child information is computed into broad age bands. Child nicknames, birth month/year rows, coordinates, contact details, and profile records remain unavailable to other families. Blocking removes both sides from discovery without revealing who initiated the block.

Phase 4 scoring uses only information families explicitly supplied for discovery. Component values stay inside the private database function; the client receives the final score and conservative explanation keys. No behavior, ethnicity, parenting judgment, safety inference, or opaque AI signal is used.

Phase 5 pending requests reveal no more than discovery: family name, approximate city, and country. Acceptance adds only the family bio and display names of active owners/guardians. Email addresses, authentication identifiers, contact details, exact coordinates, child rows, and avatars are absent from the RPC contract. Declines are not announced to the requester. Blocking immediately invalidates an accepted connection, removes its notifications, and hides it from the connection list; unblocking leaves the pair declined and never silently restores access.

Phase 6 message bodies are visible only to active members of the two currently connected families. Messages are plain text with no HTML, uploads, analytics, public links, or search indexing. Blocking makes the conversation and its history immediately unreadable to both sides through the application roles. Mute is per profile and suppresses message notifications without deleting unread state. Reports reference the original family/message in a private moderation record; audit events record only the report ID and never copy message content.

Phase 7 listed-Village discovery returns only name, description, city, cultural focus, type, and family counts to eligible nearby families. The stored Village center is copied from its creator family's approximate city location and never appears in an RPC projection. Overview, family roster, governance, reports, and chat require active membership. Removed or departed families immediately lose read access. Village reports preserve references without copying message text into audit metadata; moderated messages are tombstoned and hidden from member RLS while retained for later privileged review.

## Phase 8 events

Events are visible only inside an active Village. Exact addresses are separated from public-schema event data and remain hidden from ordinary families until the organizer explicitly shares with all members or the family holds an effective Going RSVP. Waitlisted and Maybe families receive only the public location description. Reminder records contain typed references and timing, never an address or event description.

## Phase 9 Village recommendations

Cluster detection runs entirely in a private database routine and considers only families that deliberately remain discoverable. Bidirectional blocks and each family's chosen radius are respected before aggregation. The client receives only an origin country, the requesting family's own city, a family count, broad child age bands, and the fixed 30 km threshold. It never receives candidate family IDs, names, profiles, child rows, distances, or coordinates.

Reading a recommendation has no side effects. Only a family owner can dismiss or explicitly start one, and the detector is re-run at action time. Dismissal and creation consent are retained in an RPC-only forced-RLS table and in minimal audit events.
