# Swipe card writing guidelines

Rules for writing/editing rows in the `cards` table (source: `scripts/legacy/cards.js`,
live copy: Postgres `cards`). Distilled from repeated editing passes on the existing
293-card set — apply these both when auditing old cards and when authoring new ones
for Phase 7 domain expansion.

## The two fields and what each one is for

`SwipeCard.tsx` renders exactly two pieces of card copy:

- **`title`** → bold `<h2>`. This is what the reader sees and reacts to first.
- **`description`** → plain `<p>` below it. Supporting detail, texture, payoff.

Everything below is about how to divide the content between these two fields.

## Rule 1 — the title must give the gist immediately

A reader should understand *what this card is describing* from the title alone,
without needing the description to make sense of it. Don't structure a title so the
payoff or the subject only lands in the final clause, and don't structure it so the
description has to name the actual activity that the title left unstated.

- Bad: *"Finning through a rusted engine-room corridor with one flashlight beam and a
  hand on the wall"* — never says this is a dive, underwater, or a shipwreck. The
  reader has to reach the description ("thirty meters below the surface") to find out.
- Good: *"Diving into a sunken ship's rusted engine room, one flashlight beam the only
  light."* — the scene is legible on its own.

Same failure mode, different shape: *"An impulsive, slightly-too-expensive spree
because the flight is delayed two hours"* never once says *what kind* of spree. Name
the thing (`duty-free spree`) in the title — don't make the reader guess from the
category icon.

## Rule 2 — jargon is fine, but it belongs in the description, not the title

Domain-specific language (singletrack, berms, pelagic, lifer, mixed flock, cross-
stepping, star tracker, galactic core) is good — it signals real fluency in the
subject to a reader who knows the term, and it's part of what makes deep/sub-domain
cards feel authentic rather than generic. The problem isn't the jargon; it's making
it load-bearing for basic comprehension.

**Pattern: plain-language gist in the title, jargon in the description.** A reader
who doesn't know the term still gets what the card is about from the title; a reader
who does know it gets the specific, textured version in the description.

| | Before | After |
|---|---|---|
| Title | *"Singletrack, loaded, no shuttle back."* | **"Loaded up, riding into the backcountry for days."** |
| Description | "Camping gear on the bike, remote trail systems, days without pavement." | "Remote singletrack, camping gear on the bike, no shuttle back." |

Don't over-correct into defining every term inline ("singletrack, a narrow dirt
trail,") — that reads like a glossary entry and kills the voice. Relocating is
usually enough; only add a plain-language cue if the term is genuinely opaque out of
context (e.g. "pelagic" got "a rough boat ride out to sea" in the title precisely
because there's no everyday synonym to fall back on).

**Special case — deep/sub-domain cards have no other framing to lean on.** The swipe
UI shows only `card.category` (e.g. "Cycling"), which is identical for a casual
city-riding card and a hardcore mountain-biking card. There's no subdimension label
shown anywhere on the card itself. That means deep cards can't rely on surrounding UI
context to disambiguate what specialty they're testing — the title is the *only*
place that context can come from. Weigh this rule more heavily for `stage: 'deep'`
cards than for `stage: 'broad'` ones.

## Rule 3 — keep it tight; length limits by tier

Measured as `title.length + description.length` combined. These ceilings come from
an audit of the existing set — the longest cards were consistently the ones that
needed a second full sentence's worth of scene-setting where one beat would do:

- **Broad cards** (`stage: 'broad'`, shown during general swiping): keep combined
  length **under ~170 characters**. The worst offenders in the original set ran
  190–208; trimmed versions of the same cards land 136–167 without losing the beat.
- **Deep cards** (`stage: 'deep'`, shown during a domain deep-dive): keep combined
  length **under ~140 characters**. These are meant to be clipped and specific — most
  of the existing set already sits in the 70–135 range; that's the target, not the
  exception.

If a title needs two independent clauses to make its point, that's usually a sign
the second clause belongs in the description instead.

## Rule 4 — one scene, one beat

Each card should land a single concrete moment, not a itinerary. Title sets the
scene/action; description adds the sensory detail, contrast, or payoff that makes it
specific. If the description is just restating the title in different words, cut one
of them. If the title is trying to hold two separate ideas, split the weaker one out.

## Rule 5 — specificity over vagueness, but let numbers do the work

Concrete numbers ("four hours," "8-kilogram pack," "thirty meters," "200-species")
make a card feel real without adding length or jargon. Prefer a specific number over
a vague intensifier ("a long time," "very heavy," "deep").

## Rule 6 — no place names in card copy

Cards are meant to surface a *style* of experience, independent of destination —
matching happens later via `preferenceSignals`/`sampleDestinations`, not by the
reader recognizing a place. Never name a specific city, country, or landmark in
`title` or `description`.

## Rule 7 — present-tense, sensory, second-person-implied

Match the existing voice: short declarative fragments or clipped sentences, active
voice, no explicit "you," present tense. Avoid throat-clearing openers ("Imagine...",
"There's nothing like...").

## Quick self-check before saving a card

1. Read only the title. Do you know what activity/scene this is? If not, fix it.
2. Is there a term in the title an outsider to this domain wouldn't know? Move it to
   the description.
3. Combined length under the tier ceiling (170 broad / 140 deep)?
4. Any place names? Remove them.
5. Does the description add something the title didn't already say?
