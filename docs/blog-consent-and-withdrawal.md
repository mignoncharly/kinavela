# Consent, child safety and withdrawal

Applies to any blog post that quotes, names or photographs a real person.
Founder posts about your own life need none of this; the moment a second person
appears, all of it applies.

The rules here are not a formality. Kinavela's public promise is that families,
children and precise places are never published. A blog is the one surface
where that promise can be broken by hand, permanently, and in public.

---

## Before you write

Get consent **before** publication, never after. Consent is specific:

- **This post.** Not "the blog" in general.
- **This scope.** A quote, a photograph, or both — recorded as `quote`,
  `photo`, `quote_and_photo` or `interview`.
- **These languages.** Someone who agreed to a German post has not agreed to an
  English one. Record every locale it will appear in, and go back if you add
  another later.

Show people the actual paragraph they appear in before you publish. "You said
something nice about the community" is not informed consent; the sentence as it
will be printed is.

---

## Where the record lives

In `kinavela_private.blog_consents`, created by
`supabase/migrations/202608150001_blog_community_voice_consents.sql`.

**Never in git.** The repository carries only an opaque pointer:

```markdown
---
consentRef: c_7f2a91
---
```

The table has forced row-level security and every grant revoked, **including
`service_role`**. No application code can read it, by design — nothing the site
renders needs the identity behind a `consentRef`. The only way in is a direct
database connection: the same `DATABASE_URL` that `npm run db:migrate` uses.

```sql
insert into kinavela_private.blog_consents (
  consent_ref, post_slug, subject_name, subject_contact,
  scope, locales, evidence_path
) values (
  'c_7f2a91', 'ein-abend-in-muenchen', '<name>', '<email>',
  'quote_and_photo', array['de','fr'], 'consent/2026/c_7f2a91.pdf'
);
```

`depicts_identifiable_minor` exists and is constrained to `false`. The schema
will reject the row rather than store it: there is no guardian permission that
makes an identifiable child acceptable on this site, so it is a constraint, not
a checkbox.

---

## Hard rules

These are enforced in review, and partly by `npm run blog:check`.

| Rule                                               | Checked                   |
| -------------------------------------------------- | ------------------------- |
| No identifiable children — no faces, no full names | reviewer                  |
| No school, Kita or nursery names                   | `child-institution`       |
| No street-level addresses                          | `street-address`          |
| A quote with no `consentRef`                       | `missing-consent`         |
| Photos carrying GPS metadata                       | `image-location-metadata` |
| Adults: first name and city only, unless they ask  | reviewer                  |

Adults get a first name and a city. Not a surname, not a neighbourhood, not an
employer — unless they specifically ask for more and you have recorded that.

### Photographs

Strip EXIF before committing. A photo taken in someone's kitchen carries the
coordinates of that kitchen, and the picture looks identical either way, so no
reviewer will catch it by eye.

```bash
exiftool -all= photo.jpg      # strips everything
npm run blog:check            # confirms nothing is left
```

The check parses the JPEG APP1 and PNG `eXIf` blocks directly, so it does not
depend on `exiftool` being installed on the machine that runs CI.

---

## Withdrawal

Anyone featured can withdraw at any time, for any reason, without explaining
themselves. Treat a withdrawal as urgent.

1. **Record it.** Do not delete the row — the record of having withdrawn is
   what proves the request was honoured.

   ```sql
   update kinavela_private.blog_consents
   set withdrawn_at = now(), withdrawal_note = '<how they asked>'
   where consent_ref = 'c_7f2a91';
   ```

2. **Remove it from the post.** Delete the quote or photograph, or unpublish the
   post by setting `published` to a future date. Commit and deploy.

3. **Push the change out.** The post is already indexed and possibly cached by
   assistants:

   ```bash
   npm run seo:indexnow -- /de/blog/<slug>
   ```

   If the content was sensitive, also file a Google removal request for the
   URL, and check the Wayback Machine.

4. **Tell them it is done**, and say what you removed.

Retention policy `blog_consent_review` schedules an annual re-check that
featured people still consent and that withdrawals have been honoured in the
published post.

---

## Still to do — not code

The privacy policy in `components/legal/legal-page.tsx` does not currently
mention the blog. Whether it needs to is a question for whoever advises
Gestiona Tech on data protection, not something to guess at: the site names a
controller and a supervisory authority, and the wording of a published privacy
notice is legal text.

Bring them: the processing activity `blog_community_voices` registered by the
migration above, this document, and the withdrawal path. Then link the result
from `/[locale]/privacy`.
