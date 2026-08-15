# Blog editorial standard

The blog exists so that kinavela.com is something search engines and
assistants have seen **a person** write about. That only works if a person
actually wrote it. This document is the standard; `scripts/check-blog-voice.mjs`
catches the part of it a script can catch.

Run `npm run blog:check` before opening a pull request.

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

Set `originalLocale` on every file. On a translated file, also set
`translator`. The page then says so, and the structured data declares a
`translator` on the article.

**Never publish an unedited machine translation.** A large share of this
audience are native French speakers. They will notice within a sentence, and
the credibility cost lands on the whole site, not just that post.

Machine-drafted and then genuinely edited by a person is fine — name that
person as the translator.

---

## Author bios

In `content/blog/authors.ts`. First person, written by the author about
themselves. A bio written _about_ someone in the third person reads as brand
copy, which is the register the blog exists to avoid.

Bios ship with `placeholderBio: true` until their subject rewrites them. The
voice check reports it until the flag is gone.

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
- [ ] The post contains something only a human here could know — name it in the PR description
- [ ] The opening is a scene or a claim, not a definition
- [ ] Paragraph lengths vary because the thoughts did
- [ ] `originalLocale` is right; `translator` set if this is a translation
- [ ] No unedited machine translation
- [ ] If a real family appears: consent recorded, no identifiable children, no precise locations
- [ ] Read it out loud once. If you would not say it, do not publish it.
