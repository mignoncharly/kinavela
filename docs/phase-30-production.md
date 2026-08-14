# Phase 30 — Complete family profile management

## Family settings contract

Family owners can keep the information used by discovery and deterministic
matching current after onboarding. The settings editor manages:

- family name, biography and discoverability;
- children, including nickname, birth year/month, optional gender and a
  guardian/connection profile preference;
- cultures, relationship to each culture and cultural priority;
- preservation goals and family interests;
- multiple cultural languages, proficiency and transmission goals;
- up to 21 weekday/period availability slots;
- all six deterministic matching priorities, compatible child ages and
  openness to other African or diaspora families.

Cultural languages remain independent from the German/French/English
interface setting.

## Authorization and child safety

`update_my_family_settings(jsonb)` is the only browser-accessible mutation for
the family profile collections. It derives the acting profile and family from
the authenticated session and requires an active owner membership. Guardians
and ordinary members receive an explicit read-only explanation in the UI;
they cannot call the mutation successfully.

Children remain rows belonging to a family and never receive authentication
accounts. At least one child must remain. Removal requires browser
confirmation and the database refuses `child_has_cultural_history` whenever a
Roots entry/export, story request or family story would otherwise cascade.
Child rows remain readable only to owners and guardians under forced RLS.

The child `visibility` value controls whether an approved family connection
receives a minimal child summary. `list_connection_child_summaries()` returns
only the opted-in nickname and a broad age range while the families remain
connected and unblocked. It never returns a child identifier, birth date,
gender, coordinates or contact details. Discovery and matching expose only
derived age ranges, never nicknames or exact child data.

## Location consistency

Free-text city editing was removed from account settings and its API schema.
Authenticated roles can no longer directly update profile city/country. A
location change must use `set_family_location` with an opaque, unexpired
geocoder place ID; the RPC updates family geography, displayed city, radius
and owner profile city in one transaction. Germany remains the launch-country
boundary.

## Database hardening

Migration `202608130002_family_profile_management.sql`:

- adds the atomic owner-only settings RPC;
- validates every nested collection and rejects duplicates;
- revokes direct browser writes to families, children, cultures, languages,
  interests, availability and discovery preferences;
- revokes direct profile city/country updates;
- retains existing RLS and service-role access for protected workflows;
- records a minimized audit event containing counts, never child details.

Migration `202608130003_child_connection_visibility.sql` adds the
accepted-connection-only child summary projection and explicitly denies it to
anonymous callers.

## Release verification

1. Apply migrations through `202608130003_child_connection_visibility`.
2. Run `supabase/tests/0024_family_profile_management.sql` and
   `supabase/tests/0026_child_connection_visibility.sql` in transactions.
3. Verify an owner can add/edit/remove an unprotected child and manage every
   discovery field.
4. Verify a child with Roots history cannot be deleted.
5. Verify guardians can read children but cannot mutate settings, while
   ordinary members cannot read child rows or mutate settings.
6. Change family matching inputs and confirm deterministic scores update.
7. Change location through the geocoder and confirm family/profile cities and
   PostGIS location remain synchronized.
8. Verify only opted-in child summaries appear for accepted, unblocked family
   connections, and that the projection contains no exact child data.
9. Run lint, TypeScript, unit tests and a production build.
