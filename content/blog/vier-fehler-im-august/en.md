---
title: Four mistakes families should never have encountered
excerpt: On 14 August, we fixed four mistakes. What they meant for families and why we speak openly about them at Kinavela.
author: admin
published: 2026-08-15
originalLocale: de
tags: [family, trust, behind-the-scenes]
---

On 14 August, we fixed four mistakes. One of them should never have happened:
submitting the signup form twice could make a newly created account disappear.

Clicking twice is not unusual. People try again when a page is slow or they
cannot tell whether the first click worked. At Kinavela, that second click
could delete an account that had not yet been confirmed. Not lock it. Delete
it.

The cause sounds ordinary, which makes it all the more frustrating. When an
email address had not been confirmed, our signup service created a new
confirmation link instead of rejecting the request. The request then
continued, ran into a uniqueness rule in the consent table, and triggered a
rollback. That rollback took an account with it that the second request had
never created.

We do not know how many people were affected. That is not an easy sentence for
me to write. A platform for families cannot pretend that something like this
was only a minor technical problem.

## Some towns were left outside

Kinavela had a pilot limit: a cap on active families and a list of approved
places. Anyone living in Schrobenhausen, Aresing, Manching, or Karlskron could
not finish signing up. There was nothing wrong with their address; their town
had simply not been added to the list one by one.

The rule was meant to help us start carefully. It felt like rejection instead.
That does not fit Kinavela. Diaspora families do not live only in Berlin or
Munich. They also live in smaller towns and communities, and they should be
able to find one another where everyday life happens.

The rule is now simple: anyone who selects a valid address in Germany can join.
The database trigger that blocked them has been removed.

## The slider lied

During signup, people choose how far away other families may live. Anyone who
paused and returned later always saw “40 km” beside the slider, regardless of
where the slider was actually set.

The display stayed at its starting value even though something else was stored
in the background. People did not necessarily submit what they had read on the
screen. For a decision about how close other families may be, their choice has
to be visible and dependable.

## The field that said nothing

In the location search, people have to type and then choose a result from the
list. Many typed a place and continued. The field looked complete.

It now says: “Search, then choose your city from the list.” We should have
written those words from the beginning.

## Why we are sharing this publicly

Kinavela should help families build trusted connections nearby and pass their
cultural roots on to their children. Before a meeting can happen, the first
steps must already be fair, clear, and dependable.

I cannot promise that we will never make another mistake. I can promise that
we will not hide mistakes behind technical language. We will say what went
wrong for people, fix it, and share what we learned.
