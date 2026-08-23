# Cost & luxury-lodging scoring methodology

Ruleset for authoring the two cost-related fields this content pipeline will
eventually add per destination — `costRange` (a `$`–`$$$$$` floor–ceiling
span) and `luxuryLodging` (a 0–10 slider, same mechanism as every other
interest slider). Distilled from a long back-and-forth pressure-testing the
model against ~40 real destinations with actual searched hotel/tour pricing,
not estimates. Read this before authoring either field on any destination,
new or existing.

Neither field exists in the schema yet — this document is the design spec to
implement against, not a description of shipped behavior.

## Why two new fields, and what `budgetBands` still owns

`budgetBands` (existing, unchanged) answers "what *style* of lodging can I
find here" — basic/comfortable/highend/luxury as a multi-select array. It
does **not** answer "how much will this cost me," because the same band
label means wildly different absolute prices in different places: a
"comfortable" room in Chiapas and a "comfortable" room in Iceland are an
order of magnitude apart. Relabeling those buttons to `$` symbols was
considered and rejected — dollar-sign notation carries a strong, near-
universal promise of *cross-destination comparability* that a self-relative
style label was never built to keep. Renaming would make people trust a
comparison the field can't back up.

So the model is three fields, each answering one distinct question, none of
them redundant with the others:

1. **`budgetBands`** (existing) — which lodging *styles* exist here at all.
2. **`costRange`** (new) — how expensive is this *region*, period, regardless
   of which style a traveler picks. This is the field that gets `$`–`$$$$$`.
3. **`luxuryLodging`** (new, a normal interest slider) — conditional on
   wanting luxury, how *deep and good* is the top end specifically. A
   destination can have `luxury` present in `budgetBands` (one hotel exists)
   while scoring low here (that one hotel is the only option, nothing to
   compare it against) — see Uyuni vs. Atacama below, the case that
   motivated this field.

`budgetBands`' `luxury` membership should be **derived from `luxuryLodging`
at authoring time** (e.g. score ≥ 4 → include `luxury`), not hand-judged a
second time — authoring the same fact twice independently guarantees the two
will eventually contradict each other, which is worse than the redundancy it
replaces.

## The `$` scale

Anchored to one consistent, repeatable basket — **one night at a solid
3–4★/well-reviewed private room (never a shared dorm or campsite) + a full
realistic vacation day of spending**, not the cheapest theoretical bed a
person could survive in. See "Building the floor" below for exactly what
that basket contains.

| Tier | Range (PPPD, per person per day, USD) |
|---|---|
| `$` | up to $100 |
| `$$` | $100–200 |
| `$$$` | $200–400 |
| `$$$$` | $400–800 |
| `$$$$$` | $800+, open-ended |

Top tier is deliberately open-ended (Michelin's €–€€€€ convention) rather
than adding a 6th symbol — true ultra-luxury has no real ceiling, and a
6-glyph `$$$$$$` stops being legible in a UI chip. A destination that clears
$800 by a little (Iceland, Tokyo) and one that clears it by 3x (Bora Bora,
Serengeti) both just read `$$$$$`; the `luxuryLodging` score and a short
cost-driver note (see below) are what carry that further distinction, not a
6th tier.

Early drafts of this scale used $75/$150/$250/$400/$700+ breakpoints and
were wrong on both ends — too low a floor (a genuinely modest vacation day
easily clears $100 almost everywhere) and a `$$$$$` threshold so low that it
couldn't tell a $700/day "nice trip" apart from a $1,200+/day Andrew
Harper–tier splurge. The $100/$200/$400/$800 spacing is intentionally
non-linear (roughly doubling each step) because cost differences compound
faster at the top of the market than at the bottom.

## Building the floor

**Unit:** one lodging night, private room only (a hostel dorm bed or a
campsite never counts, even if it's the cheapest listing found), halved for
double occupancy when the source quotes a per-room rate, left as-is when a
source already quotes per-person (see "Halving" below).

**Add the realistic-vacationer basket, not a backpacker-survival basket:**
3 meals, 1 specialty coffee, 2 beers/glasses of wine (or 1 cocktail),
some local transport (rideshare/public transit), **the destination-
appropriate activity cost** (see next section — this is not a flat line
item), and some shopping. Every early floor estimate in this exercise that
skipped straight to "cheapest hotel + minimal food" was wrong by roughly
50–100%; almost nothing survives contact with a real vacation day and stays
at `$` — `$` should be understood as genuinely rare, not the default guess
for anywhere with a reputation for being cheap.

### The activity-cost line is destination-type-dependent — this is the rule most likely to be gotten wrong

Don't apply one flat "$15–30 guided activity" assumption everywhere. Three
distinct cases:

1. **Walkable cities and self-drive nature destinations** — the activity
   line drops to near-zero most days. Wandering *is* the core experience:
   free temples, free parks, free coastal walks, free medina/market
   browsing. A paid, ticketed thing (a museum, a specific monument) is an
   occasional add, not a daily assumption. Applies to essentially every
   city in this exercise (Bangkok, Mexico City, Istanbul, Paris, NYC,
   Copenhagen, Cape Town, Singapore, Buenos Aires, Vienna, Lisbon, Taipei,
   Prague, Oaxaca, Marrakech, Antigua, San Cristóbal) and to self-drive
   nature destinations with a car (Iceland, Yosemite, Namibia's Etosha,
   Kruger's self-drive circuit).
2. **Destinations where a guide/vehicle is structurally mandatory** — no
   self-drive option exists, so the "activity" (game drives, boat access)
   is bundled into the lodging rate itself and should be counted at full
   bundled cost, every day. Applies to Serengeti, Okavango Delta — water-
   access only, no road network for self-drive — and any destination where
   the accommodation literally cannot be booked without the guided
   component attached.
3. **A genuine one-time "must-do," amortized, not charged daily** — some
   destinations have a real, near-mandatory core-experience cost that isn't
   a daily recurring thing: the Machu Picchu entrance+train+bus (Cusco), the
   Uyuni salt-flat day tour, the Galápagos park entrance fee + day tours,
   the Torres del Paine park entrance (Patagonia), the Matterhorn cable car
   (Zermatt). Compute the real one-time cost, divide by a realistic trip
   length (5–7 days is a reasonable default), and add that amortized
   daily figure — not the full one-time cost applied to every day.

Getting the type wrong produces a real, confirmed error, not a rounding
difference: Galápagos was originally floored at $8–27/night (a hostel bed
in the gateway town) before the park-fee-plus-tours correction moved it to
~$190pp/day — a 7–10x miss, because the actual reason to be in the
Galápagos was left out entirely. Kruger moved the other direction: treating
it like Serengeti (bundled guide cost) put its floor at `$$`; recognizing
that Kruger is genuinely self-drive-able (unlike Serengeti or Okavango)
dropped it to `$`, a real one-tier change driven entirely by whether a car
replaces a guide.

**Mandatory structural costs still apply even when self-driving is
possible** — Serengeti/Kruger-style park or conservancy fees, where they
exist, get added regardless of lodging choice, because they're not
avoidable by picking a cheaper room the way a guided tour might be
skippable.

## Building the ceiling

**Anchor to a real flagship property, not a made-up number.** Search for
it; don't estimate from priors. Use the property's **non-peak, standard-
room rate** — never the highest headline figure a listing site surfaces
(that's routinely a holiday-peak or a specialty suite, e.g. a plunge-pool
overwater bungalow instead of the standard one). Halve per-room rates for
double occupancy; leave per-person rates as-is (safari lodges, eco-lodges
like Explora/Awasi, and some all-inclusive resorts are conventionally
quoted per person sharing already — halving those would be wrong). Add
realistic top-tier food (a genuine tasting-menu dinner, not the absolute
most expensive pairing option a restaurant offers).

**Single-outlier exclusion:** if one property is far above every comparable
option in the same destination (Kachi Lodge in Uyuni, Deplar Farm in
Iceland, a plunge-pool suite at Four Seasons Bora Bora), exclude it and use
the property/properties that "most trip options" would actually book. A
destination doesn't earn a higher ceiling tier just because one single
extreme listing exists somewhere.

**The boundary-case tiebreaker** — when the ceiling estimate lands close to
a tier line, don't resolve it by re-arguing the exact dollar figure. Ask
instead: *does one side of the line depend on a single hotel, while the
other side is where multiple comparable properties actually cluster?*
Prefer the tier with more supporting properties. This is a stronger and
simpler test than fighting over whether a number is $780 or $820.

- **Yosemite**: The Ahwahnee alone edges into `$$$$`, but the Yosemite
  Valley Lodge and other in-park options cluster in `$$$` — `$$$` is the
  representative ceiling; Ahwahnee is one property pulling upward, not a
  cluster.
- **Lisbon**: only one flagship (Four Seasons Ritz Lisbon) was actually
  found and confirmed, with no seasonal breakdown and no second comparable
  property to cross-check against — a single, thin data point sitting
  almost exactly on the `$$$$`/`$$$$$` line is not sufficient evidence to
  claim the higher tier. Caps at `$$$$` until a second flagship or a real
  seasonal rate is confirmed.
- **Los Cabos**, by contrast, is a case where the higher tier *is* well
  supported — One&Only Palmilla gave an explicit low/average/peak
  breakdown, so the low-season anchor is trustworthy on its own, no second
  property needed to believe it.

When a ceiling search only turns up one property and one number, treat the
resulting tier call as provisional and say so, rather than presenting it
with the same confidence as a destination where multiple sources converged.

## Scoring `luxuryLodging`

**Grade each destination on its own merits — never curve against the single
most extreme global example.** Early passes implicitly used Bora Bora's
overwater bungalow as a ceiling everyone else was measured against, which
wrongly penalized Atacama, Zermatt, and the Cotswolds for not being Bora
Bora. A world-class alpine ski chalet, a world-class desert eco-lodge, and a
world-class English country-house hotel are all just *excellent, each in
their own idiom* — multiple destinations can legitimately score 9 or 10 at
once, the same non-competitive-curve principle already used for
`winetasting` elsewhere in this dataset (Napa, Tuscany, and Mendoza can all
sit near-max without one dragging the others down).

**What separates a 9–10 from a 5–6 from a 2–3:** genuine international
name-recognition and depth of selection at the top (multiple internationally
recognized flagship properties, not just one), vs. one solid boutique
option that's good but not competing on a global stage, vs. real but thin —
a boutique hotel or two exists, nothing approaching international luxury
standard. Worked examples from this pass: Bora Bora/Amalfi/Paris = 10
(the archetype for their category, genuinely no ceiling above them);
Atacama/Zermatt/Cotswolds/Kruger/Patagonia = 9 (multiple legendary
properties, own-merits excellent); Antigua/Chiapas = 4–5 (one real
boutique-tier property, nowhere near international-luxury depth); Yosemite
= 6 (a beloved historic lodge, not a service-level match for its price —
see the cost/quality divergence note below).

**Cost and quality can and do diverge — don't assume a high `costRange`
ceiling implies a high `luxuryLodging` score, or vice versa.** Yosemite is
the clearest case: its ceiling lands in real `$$$`/`$$$$` territory purely
from lodging *scarcity* (very limited in-park supply, no competition), not
from The Ahwahnee matching the service level of anything else at that price
point — hence the modest 6, well below other `$$$$`-tier destinations. Keep
the two numbers visually paired wherever they're surfaced, precisely so a
user doesn't read a high price as a guarantee of high quality.

## Sourcing discipline

Search for real current pricing rather than estimate from general
knowledge — this was the single biggest source of correction throughout
this exercise (Bali and Chiang Mai were both wrongly called `$$$$$` before
real numbers, split by the room-rate-vs-per-person halving error, pulled
them back to `$$$$`). When search results disagree, prefer figures with an
explicit non-peak/seasonal breakdown over a single "average" or "starting
from" headline number, and note when a ceiling rests on only one source —
that's a real confidence difference worth stating, not smoothing over.
