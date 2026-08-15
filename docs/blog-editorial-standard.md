# Blog editorial standard

The blog exists so families, search engines and assistants can find useful,
first-hand information from Kinavela. That only works when the content owner
approves the facts, judgment and voice. This document is the standard;
`scripts/check-blog-voice.mjs` catches the part a script can catch.

Run `npm run blog:check:strict` before opening a pull request.

---

## The one rule

**Every post contains at least one thing only a human at Kinavela could know.**

A date. A place. A conversation you actually had. A mistake you made. A number
from your own data. A price you paid. What someone said to you in a kitchen in
Mainz.

If you removed the Kinavela name from a post and it could have been published
by any family-tech company anywhere, the post is not finished. Everything below
is downstream of this.

The linter cannot check this — it only checks that the post names _something_
concrete. A reviewer checks the rest.

## The reader outcome

Every post must leave a family with something they can understand, decide, or
do. Search visibility is a result of being genuinely useful, not a reason to
pad an article with keywords.

A finished post does at least one of these things:

- answers a concrete question a family might search for;
- teaches a practice a family can use in everyday life;
- explains a Kinavela decision and its practical effect; or
- documents a first-hand lesson with enough context to apply elsewhere.

State the main answer plainly. Use descriptive headings and self-contained
paragraphs that remain understandable when quoted outside the page. If a claim
comes from law, health guidance, research or another external authority, link
to the primary source and record when it was checked. Distinguish verified fact
from Kinavela’s judgment.

Do not create near-duplicate posts for keyword variations. Do not add FAQ
sections merely for search markup. A useful guide, written for one real family
question, is also the easiest kind of page for a search engine or assistant to
understand and cite.

---

## Openings

Open with a specific scene or a specific claim.

Never open by defining the topic:

- ✗ "In der heutigen schnelllebigen Zeit ist Gemeinschaft wichtiger denn je."
- ✗ "Community is important for immigrant families."
- ✓ "Meine Tochter hat mich letzten Herbst gefragt, warum Oma anders spricht."

The reader already knows community matters. They came for what you know.

---

## Language

Write German first. French and English are translations, and they are
translations **by a person** — see below.

Keep the words that are actually the words. Ndolé is Ndolé, not "a traditional
stew". Anmeldung, Kita-Platz, Aufenthaltstitel, quartier — these are what the
things are called, and flattening them into generic English-shaped prose
removes the only evidence that the writer lives here.

Length is whatever the story needs. There is no word count. A good 400-word
post beats a padded 1,200-word one, and padding is itself a tell.

---

## Banned phrases

Enforced by `scripts/check-blog-voice.mjs`, per language.

**German** — "in der heutigen schnelllebigen Zeit", "es ist wichtig zu
beachten", "es sei darauf hingewiesen", "zusammenfassend lässt sich sagen", "in
diesem Artikel werden wir", "tauchen wir ein", "spielt eine wichtige Rolle",
"nahtlos", "eine Vielfalt an", "nicht zuletzt".

**French** — "dans le monde d'aujourd'hui", "à l'ère du numérique", "il est
important de noter", "il convient de souligner", "en conclusion", "plongeons
dans", "joue un rôle crucial", "une riche tapisserie".

**English** — delve, leverage, seamless, robust, "navigate the complexities",
"in today's fast-paced", "it's not just X, it's Y", "let's dive in", "at the
end of the day", "unlock the", "empower families", "a testament to", "it is
important to note", "in conclusion".

**Any language** — game-changer, tapestry, holistic.

The list is deliberately short. It is not a vocabulary ban; it is a list of
constructions that have become reliable signatures. If a banned phrase is
genuinely the right words, say so in review and we will cut the rule.

> Note on German and French: "nicht nur … sondern auch" and "non seulement …
> mais aussi" are **not** banned. They are ordinary, natural constructions in
> those languages. Only the English "it's not just X, it's Y" rhetorical beat
> is flagged, because only there is it a tell rather than grammar.

---

## Structural tells

These are what make prose feel generated even when every sentence is fine.

| Tell                                   | Checked  |
| -------------------------------------- | -------- |
| Every list has exactly three items     | yes      |
| All paragraphs the same length         | yes      |
| A "Fazit" / "Conclusion" heading       | yes      |
| A rhetorical question as a heading     | yes      |
| Em dashes on every other line          | yes      |
| Every section built to the same shape  | reviewer |
| A bolded takeaway closing each section | reviewer |
| Symmetry for its own sake              | reviewer |

Real writing is lumpy. One paragraph runs long because the thought did; the
next is four words. A list has two items because there were two. Stop when you
are finished — a summary heading is a confession that the piece did not end on
its own.

---

## Translation honesty

Set `originalLocale` on every file. When someone other than the author
translates a post, set `translator`; the page and structured data then credit
that person. When the author owns every language version, omit `translator` and
keep the byline unchanged.

**Never publish an unedited machine translation.** A large share of this
audience are native French speakers. They will notice within a sentence, and
the credibility cost lands on the whole site, not just that post.

Machine-drafted and then genuinely edited by the author is fine; the existing
byline owns that language version. If someone else edits or translates it, name
that person as the translator.

---

## Author bios

The public identity lives in `content/blog/authors.ts`. Its label and short
first-person bio must be approved by the content owner. Do not publish personal
details merely to strengthen an author signal.

Bios can ship with `placeholderBio: true` until the wording is approved. The
voice check reports the flag until it is removed.

---

## Community voices

Posts that quote or photograph a real family have their own requirements —
consent, child safety and PII — in Phase 5 of
`docs/blog-implementation-plan.md`. That is not optional and not negotiable:
no identifiable children, no street-level locations, written consent stored
outside git.

---

## Review checklist

Before merging a post:

- [ ] `npm run blog:check` reports nothing, or every finding is argued in the PR
- [ ] A family can say what it learned, decided or can now do after reading
- [ ] The main answer is stated plainly under a descriptive title or heading
- [ ] External factual claims link to a current primary source
- [ ] The post contains something only a human here could know — name it in the PR description
- [ ] The opening is a scene or a claim, not a definition
- [ ] `originalLocale` is right; a different translator is credited when one exists
- [ ] No unedited machine translation
- [ ] If a real family appears: consent recorded, no identifiable children, no precise locations
- [ ] Read it out loud once. If you would not say it, do not publish it.
