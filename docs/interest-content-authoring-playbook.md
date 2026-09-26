# Interest content authoring playbook

How we've been authoring per-interest destination content this session (birding, whale
watching, wildlife viewing, diving/snorkeling — in that order), written up so the next
~47 interests don't need this re-explained from scratch. Follow this by default; deviate
when the interest genuinely calls for it, but say so.

## 0. What "authoring an interest" means

Every destination in `places` (200 rows) has ~51 interest sliders it's scored on
(`src/lib/scoring/constants.ts`'s `SLIDERS` array). The numeric score comes from a shared
formula family (`formula: 'wildlife' | 'swim' | 'hiking' | 'culture' | 'food' | 'snow' |
'sun' | 'luxury' | 'shopping' | 'deals' | 'crowds'`) plus per-destination `baseScores` and
optional `sliderEvents`. That's separate from the *content* — `sliderOverview` (one prose
paragraph per interest) and `sliderMonthlyWeather` (12 month-by-month blurbs per interest),
both jsonb columns on `places` keyed by slider id. Most interests currently have **zero**
authored content. The recurring job is: pick an interest, research it destination by
destination, write real content, and fix any scoring gaps that surface along the way.

Read `src/lib/scoring/destinations.ts` and `constants.ts` before starting a new interest —
confirm which formula it's on, whether that formula is shared with other interests already
authored (a formula bug fix affects every slider on it), and skim the formula's `case` in
`deriveDestinationScores` to understand what actually drives its monthly shape.

## 1. Standard workflow, per interest

**Step 1 — Survey.** Write a throwaway `scripts/survey-<interest>-full.ts`: for all 200
places, compute `isSliderNA(scoring, key)`, `base[key]`, `sliderEvents[key]`, the live
monthly array via `deriveDestinationScores(scoring, {skipHazards: true})`, and whether
`sliderOverview[key]` already exists. Report: how many are NA (skip — see §3), how many
need content, and the natural peak-score tiers. Delete the script once you've read the
output.

**Step 2 — Lock the voice with 3-5 samples.** Pick a small spread across the score range —
a couple of obvious 10s, one "just okay" destination in the 4-6 range, and (if genuinely
applicable) a flat/zero one. Draft overview + monthly as plain chat text, **not written to
the DB**. Expect several rounds of correction here — this is where tone, tiering, and
honesty calibrate. Don't batch-author the rest until the user has approved the sample
voice.

**Step 3 — Batch through the rest.** Group the remaining destinations into strategic
batches — usually by score tier (apex / strong / modest / low-incidental) or by geography,
whichever fits the interest better. Per batch:
  1. Research real, verifiable, *specific* facts per destination — named sites, records,
     exact season windows, closures, certification/access requirements. Don't rely on
     pattern-matched memory for anything with a specific date, record, or number; verify
     with WebSearch.
  2. Pull the real computed monthly array first (`deriveDestinationScores`) and write
     monthly text to match *that shape* — never invent a seasonal narrative the score
     doesn't support.
  3. Write `scripts/author-<interest>-blurbs-batchN-<name>.ts` (skeleton in §4).
  4. Run with `--dry-run`, then for real.
  5. Run `npx vitest run` and `npm run db:audit:anchors` — both must stay clean.
  6. Commit the batch script (message conventions in §4).
  7. Delete any one-off inspection scripts used for that batch.

**Step 4 — Confirm full coverage.** One throwaway `scripts/check-<interest>-coverage.ts`:
every non-NA place has both `sliderOverview[key]` and a 12-length
`sliderMonthlyWeather[key]`; every NA place has neither. Delete after confirming.

**Step 5 — Specialist-lens review** (do this proactively once, or when asked). Group
destinations by peak score and ask: would a real enthusiast for this interest co-sign these
tiers? Look specifically for: a destination topping a tier for the *wrong* discipline
within the interest (Bora Bora hit peak-10 diving on snorkeling merit, not scuba merit —
the interest can cover more than one discipline, so decide with the user which one a top
score should require), a destination badly undersold by a stale base score despite a
legendary specific site (North Island capped at 6 despite the Poor Knights being a
Cousteau top-10 site), and content that's flatly about the wrong thing (Azores was
originally written around whale migration, which is whaleWatching's story, not diving's).
Fix base-score problems with `scripts/fix-<interest>-base-scores.ts` (pattern in §5); fix
content problems by rewriting the specific destination's overview/monthly directly. Always
verify the target peak via the real pipeline before committing — never hand-compute it.

**Step 6 — Decimal & consistency audit.** A dedicated pass, run once Steps 1-5 are done
and the interest's numbers and text both already exist — not blended into authoring, and
not a replacement for keeping scores and text coupled while you write (§2's rule on that
still applies, and if it's genuinely internalized during authoring this step should find
less each time — that's a sign it's working, not a reason to skip it). Its job is
specifically the bug class Step 5's specialist-lens review is *not* scoped to catch: month-
by-month contradictions between a destination's own score curve and its own words, plus
catalog-wide over-claiming of the literal maximum. (This is exactly how whaleWatching's
Svalbard/Southeast Alaska bugs survived an honest Step 5 review earlier — that review
checks cross-destination tier fairness and discipline attribution, never a single
destination's own internal month-to-month consistency.) Check for:

- **Same text, different score.** Two or more months sharing verbatim (or near-verbatim)
  blurb text should carry the same or nearly the same score — the destination's own words
  are asserting those months are equivalent. A real gap is a bug, not a judgment call.
- **Distinct text, identical score, one side is honestly lesser.** A month whose own text
  signals something short of the surrounding peak ("easing," "beginning," "not yet as
  reliable as August," "winding down") tied to the exact same score as the true peak
  months is the same bug from the other direction — the text already told you it should
  be lower.
- **Wide literal-max plateaus.** Reserve a literal 10 (or whatever the interest's ceiling
  is) for the narrowest, most genuinely exceptional peak — usually 1-3 months, occasionally
  4 for a globally elite, well-researched destination. A run of 5+ months at the literal
  cap needs real-world caliber research (how many *other* destinations in this same
  interest could defensibly make the same claim?) and, usually, tapering. Do this last and
  holistically across the whole interest, not destination by destination — the answer only
  makes sense compared against everyone else making a similar claim.
- **Isolated cliffs.** A single month differing sharply (2+ points) from both neighbors,
  when the neighbors are close to each other, with no textual justification. Almost always
  a curve-fitting artifact, not an authored choice.
- **Flat-everywhere text with unexplained score wobble.** When a full year (or nearly)
  shares one line of text that explicitly claims no seasonal difference ("present year-
  round," "nothing tied to a specific season"), any real score spread is itself the bug —
  flatten to one honest value rather than inventing texture the text doesn't support.
- **Content-completeness across overlapping sliders.** Check for headline-level content
  that exists richly in a related, deeper slider (birding, whaleWatching, diving) but is
  entirely absent from a general slider a non-specialist would also expect it in. The split
  between a general and a specialist slider is depth/angle, not exclusive ownership of a
  species or experience — the fix is additive content on the general slider, not leaving it
  out because the specialist slider already "has" it. (Costa Rica's wildlifeViewing named
  only sloths and monkeys while its birding content already had a full quetzal/macaw
  treatment — a real miss, not appropriate restraint.)

- **Resolution check (added Sep 2026 after a miss).** The checks above find *bugs*; they do
  not prove the interest's rank list has usable resolution. The eight retrofit interests
  (wildlife, birding, diving, beaches, surfing, windSports, hotSprings, wildflowers) each
  passed every check here and still shipped 85-100% whole/half-number monthly scores, so the
  by-interest list showed a wall of ties (four places at 9.0, five at 8.0). Fixing flagged
  months does not decimalize an interest. Run `npx tsx scripts/audit-score-resolution.ts` and
  treat an interest as done only when `coarsePct` is below ~30% and `top20distinct` is 14 or
  more. A place's month scores must be decimals from its own text groups *and* a caliber
  ordering against the other places sharing its tier (e.g. rank every 9.x wildlife place
  against the others before assigning decimals).
- **How to decimalize an existing interest (wildlife, Sep 2026 — the reference run).** Use
  `scripts/decimalize-wildlife.ts` (config-driven; `--redo` re-derives from the pre-pass scores
  instead of compounding). Rules the user set while doing it: (1) *10s are per place, not per
  catalog* — an anchor may hold the literal 10 for its narrowest best 1-3 months (4 for a
  two-season place); a peak whose text repeats over 4+ months gets 9.x, or its text is split so the
  10 sits on 3 months (Okavango, Serengeti). (2) *Caliber, not just shape* — rank places against
  each other within a tier and give each its own peak decimal; keep shifts to about +/-1 of the
  old peak so no earlier tier judgement is overturned. (3) *Land beats sea* — marine life (reefs,
  mantas, whales) earns wildlife credit but below big land animals, because diving, snorkeling and
  whale watching are separate interests; the same goes for birds. A place already a 10 in another
  interest for a marine reason (Raja Ampat) doesn't also get one here. (4) *Regional pinnacles are not
  global ones* — Yellowstone and Denali are the top of North American wildlife but not comparable
  to a peak African safari, so neither holds a 10. Remove a place from `anchors.ts` when its 10 is
  no longer defensible.
- **Anchor ceiling.** `src/lib/scoring/anchors.ts` holds, per interest, the closed list of
  destinations allowed to hold a 10 plus a one-line definition of what a 10 asserts. Run
  `npm run db:audit:anchors` after every batch: any `OVER` (a non-anchor peaking at 10) is a
  blocking error — lower it, or make a deliberate case to add it to the list. `UNDER` (an
  anchor peaking below 10) is informational but must be a decision, not an accident: an anchor
  is *permitted* a 10 for its best 1-3 months, so either give it one or tell the user the
  anchor list looks out of date. Check the anchor list *before* assigning caliber tiers, so the
  ceiling you author matches the ceiling the catalog already declares.

Execution: for catalogs of ~100+ destinations, don't manually re-read every entry — write
a throwaway `scripts/_diag-<interest>.ts` that automatically flags same-text-score-spread,
runs of 4+ months at the literal max, and isolated cliffs, then triage only what it
surfaces. Pull exact current text/scores for flagged destinations via a targeted query
before drafting a fix — never guess at what's already there. Ground any caliber/rarity
judgment in real research (WebSearch a "best in the world" ranking for that activity)
rather than assumption, and say so when a category's rankings are less stable or
authoritative than others (specialist consensus like diving or birding tends to be far
more stable year to year than something like general "best beaches" lists). Dry-run every
fix, verify against the live pipeline (`scorePlace` / `deriveDestinationScoresFromCurves`)
before writing, then write via `scoreOverrides` (never hand-edit `sliderCurves` anchors
directly — see §0) plus `sliderMonthlyWeather` / `sliderOverview` as needed. Typecheck
after writing. Delete the throwaway `_diag-*.ts` script; keep the `author-<interest>-
decimals.ts` (or similarly named) fix script permanently, same as any other `author-*.ts`.

**Step 7 — Extend the Catalog Wishlist artifact.** See §6.

## 2. Voice and content rules

These held across all four interests done so far; treat them as defaults for every future
one.

- **Enthusiast lens, not specialist/technical.** Exciting, recognizable, real. No filler
  that a domain expert cares about but a general interested traveler doesn't (birding's
  "common pigeons," wildlife's squirrels, diving's algae-covered rubble). No unexplained
  jargon.
- **A species belongs in `wildlifeViewing` if it's a headline, general-audience draw —
  even when `birding` (or `whaleWatching`) also covers it.** The split between these
  sliders is depth/specialist-level, not category. `birding`'s job is the checklist
  species a dedicated birder travels for (Costa Rica: trogons, tanagers, bellbirds,
  antbirds, ground-cuckoos); `wildlifeViewing`'s job is what a general "I want to see
  cool animals" traveler pictures (Costa Rica: sloths, monkeys, toucans, scarlet macaws,
  resplendent quetzal). A `wildlifeViewing` blurb that lists only mammals for a
  destination whose bird life is a major, widely-marketed part of its wildlife draw is a
  miss, not appropriate restraint — the two sliders describing the same animal from a
  different angle (general vs. specialist) is expected and fine, not redundant. Don't
  swing the other way either: a destination's actual "specialist checklist" birds (the
  ones only `birding` content should carry) still don't belong in `wildlifeViewing`, and
  a place without a genuine headline-bird draw shouldn't have one invented for it. Same
  logic applies to `whaleWatching` overlap (e.g. Vancouver Island's orcas are `wildlife
  Viewing`-worthy too, alongside its black bears, not exclusively `whaleWatching`'s).
- **Tier multi-feature destinations explicitly, never blend them into one narrative:**
  near-universal (most itineraries) → site-specific (depends where you go) → seasonal
  bonus (depends when). State every presence claim scoped to *where and when together* —
  something that's both site-specific and seasonal can never read as a "daily" sighting.
- **State real odds honestly, not just presence.** "A matter of luck," "genuinely elusive
  even at the best odds," "not much to see at that depth" — never oversell a famous
  thing that's actually rare or hard. If the famous claim doesn't hold up, say so instead
  of softening it into ambiguity.
- **Verify seasonal claims against real research; report the actual shape**, even if it's
  flat, bimodal, or dominated by a hard cutoff (a park's exact closure dates) rather than
  a clean single-peak-season narrative.
- **No comparisons between different catalog destinations by name** in any content text.
  Internal comparisons within *one* destination's own two seasons are fine.
- **Balance overview length against monthly length.** Don't front-load every specific fact
  into the overview and leave monthly as generic "conditions good/bad" restated five ways.
  If a real seasonal specific exists (an animal's exact timing, a closure date), put it in
  the monthly bucket it belongs to. If nothing seasonal genuinely varies beyond generic
  conditions, say that plainly — "this doesn't really have a season for X, only access/
  conditions change" is a legitimate, honest answer, not a cop-out.
- **Never refer to a bundled multi-site catalog entry with singular language** ("the
  park") when it's actually two or more distinct places.
- **State the practical seasonal reality explicitly, per destination, verified — not
  assumed from the activity's general pattern.** "Baseline, lighter wind" doesn't tell a
  reader whether people actually do the activity that month or not. For every month, know
  and say which of three things is true: year-round (no real dead season, just a peak),
  long-season-with-a-real-dip (a genuine but short quiet stretch), or a narrow window with
  a real dead off-season (say so plainly — "outside March-September, this isn't a realistic
  time to plan a trip around it"). Research this per destination (found while authoring
  windSports: Barbados and Jamaica were each modeled with too-narrow a season, Dubai's
  summer wind was wrongly assumed absent when it's actually just too hot to enjoy).
- **Every monthly blurb must name the actual site or mechanism and stand alone.** A reader
  jumping straight to one month, with no access to the overview or neighboring months,
  should understand exactly what's being described. "Essentially closed" reads as the whole
  destination shutting down; "outside the wind season at Viganj, kitesurfing here is
  essentially on hold" doesn't have that problem.
- **A stored score event's label can target a different specific mechanism** than the
  content you're pinning to it, as long as the *timing* stays honestly compatible — flag
  the mismatch (in the commit message is fine) rather than blocking on it.
- **When you find real seasonality the current score doesn't capture** (a legendary
  single site, a rut/hibernation cycle, a closure), fix the score *before or alongside*
  writing content that describes it. Never let score and content drift apart.
- **Decimal-precision scores must be derived from the blurb text, not from the old
  integer score's shape — check both directions before touching a number.** Caught on
  whaleWatching (Sep 2026): a purely geometric smoothing pass (taper by position within
  a run of months that shared the same *old integer* value) produced real violations once
  checked against already-authored monthly text — Vancouver Island's May-October blurb is
  the literal same sentence six times over ("Peak season — humpback and gray whales..."),
  yet the geometric pass invented a 9.8-10.0 gradient across those six months anyway.
  Azores' April/May share one identical "peak" sentence but got different scores; its June
  blurb explicitly describes the season *declining* ("most blue whales have moved on") yet
  got tied with the actual peak months. The old integer tier a month happens to share with
  its neighbors is a coincidence of a coarse legacy formula — it is never the right
  grouping key.
  - **Fixing an already-authored interest:** read every month's blurb first. Group months
    by identical/paraphrased text — each group gets one score, not fine-grained texture
    invented from curve position, rank, or anything else disconnected from the prose. Give
    adjacent DISTINCT-text groups a score gap sized to what the text actually describes
    ("still a strong presence" → a small step; "none present"/"essentially closed" → a
    cliff). Re-derive the curve from these text-defined groups, discarding whatever
    grouping the old integer score implied.
  - **Authoring an interest that has no monthly text yet:** write the monthly blurb and
    that month's decimal score in the same pass, for the same destination — never score a
    full 12-month curve ahead of writing the prose that justifies it, and never leave a
    month with genuinely distinct real content tied to a neighbor's score just because
    they used to share an old integer tier. Where there's honestly nothing seasonal to
    say (a real flat season), the flat score is correct — say so in the blurb instead of
    inventing a distinction, exactly per the "state the practical seasonal reality
    honestly" rule above.
  - This check is cheap and mechanical (diff month-groups-by-score against month-groups-
    by-text) — run it as a step, not a one-off catch, on every destination touched.
  - **The same "don't invent fake distinction" rule applies to WORDING, not just numbers.**
    Caught on auroraChasing (Sep 2026), immediately after the rule above was written and
    applied: a genuinely flat "no signal" block (three consecutive no-aurora summer
    months) got three different sentences with solstice narration, plus three slightly
    different scores to avoid literal repetition — the exact mistake the rule above
    exists to prevent, just committed against prose instead of numbers. The established
    catalog convention for a real "nothing to say" month is short and flat and REUSED
    verbatim across the whole block ("Nights are too light for a realistic look.", "Days
    are too long for a realistic look.", "Midnight sun — no darkness, so no aurora." —
    all ~7 words, all shared across 3-6 months at a stretch with zero variation). Reusing
    the same short sentence for a genuinely identical situation is correct, not lazy;
    manufacturing scene-setting or micro-variation to avoid repeating it is the bug. Only
    write a distinct sentence for a month that is ACTUALLY different (a transition, a
    named mechanism, a building/easing edge) — never to make an unremarkable month feel
    less repetitive.
- **Keep the cross-cutting "current conditions" boundary.** Security, political
  instability, active environmental crises (reef bleaching, a population collapse), armed
  conflict — none of that belongs woven into per-interest content. That's what the
  `travelAdvisories` field (shipped this session, admin UI at `/admin/destinations/
  advisories`) is for: destination-level, not slider-level, and never read by scoring. If
  research surfaces something like this, don't feature the affected claim as a confident
  current headline (e.g. don't sell Palau's Jellyfish Lake as a reliable swim-with-
  jellyfish experience given its currently depleted population) — hedge honestly or omit
  it, and consider flagging it as a candidate advisory entry instead of writing around it
  in the slider text.
- **Check for overlap with already-authored interests before claiming an animal/site/
  fact.** If another interest already owns a specific claim for a destination (grep
  `scripts/author-<other-interest>-blurbs-*.ts`), don't restate it — find the genuinely
  distinct complementary angle, or skip it.

## 3. NA sliders — check before you write anything

`naSliders` (text array on `places`) marks an interest as *structurally absent* for a
destination — not merely low-scoring. `isSliderNA(scoring, key)` in
`src/lib/scoring/destinations.ts` is the check. **Confirmed convention: NA destinations
get zero content** — no `sliderOverview` entry, no `sliderMonthlyWeather` entry, not even
a "not applicable here" sentence. Verify this against the current data before assuming
(`naSliders` is already populated for many interests, e.g. `diving` was already NA for 102
of 200 places before this session touched it — Dolomites among them). Don't write "no X
here" content for something that's already correctly NA; that's redundant with the NA flag
and inconsistent with every other NA entry in the catalog.

## 4. Batch script skeleton

Every `author-<interest>-blurbs-batchN-*.ts` follows this shape (copy the most recent one,
e.g. `scripts/author-diving-blurbs-batch1-apex.ts`, rather than retyping):

```ts
import { readFileSync } from 'fs';
import { join } from 'path';
import { eq } from 'drizzle-orm';
import { drizzle as drizzlePostgres } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import { places, adminAuditLog } from '../src/lib/db/schema';

const KEY = '<interestKey>';

const OVERVIEWS: Record<string, string> = { /* id: 2-3 sentence paragraph */ };

// Shared bucket-text constants, reused by name across destinations/months to avoid
// retyping the same sentence — keeps the file scannable and diffable.
const SOME_BUCKET = '...';

const MONTHLY: Record<string, string[]> = { /* id: exactly 12 strings, matching the real computed shape */ };

function loadDotEnvLocal(): Record<string, string> { /* reads .env.local, never trust process.env directly under plain tsx */ }

async function main() {
  const env = loadDotEnvLocal();
  if (!env.DATABASE_URL) { console.error('No DATABASE_URL'); process.exit(1); }
  const dryRun = process.argv.includes('--dry-run');
  const db = drizzlePostgres(postgres(env.DATABASE_URL, { prepare: false }));

  for (const id of Object.keys(OVERVIEWS)) {
    const [row] = await db.select().from(places).where(eq(places.id, id));
    if (!row) { console.error(`${id}: not found`); process.exit(1); }
    if (MONTHLY[id].length !== 12) { console.error(`${id}: monthly array is not length 12`); process.exit(1); }
    const patch = {
      sliderOverview: { ...(row.sliderOverview as Record<string, string>), [KEY]: OVERVIEWS[id] },
      sliderMonthlyWeather: { ...(row.sliderMonthlyWeather as Record<string, (string | null)[]>), [KEY]: MONTHLY[id] },
    };
    if (!dryRun) {
      const after = { ...row, ...patch };
      await db.transaction(async (tx) => {
        await tx.update(places).set({ ...patch, updatedAt: new Date() }).where(eq(places.id, id));
        await tx.insert(adminAuditLog).values({ actorId: '00000000-0000-0000-0000-000000000000', entityType: 'destination', entityId: id, action: 'update', beforeValue: row, afterValue: after });
      });
    }
    console.log(`  ${id}`);
  }
  console.log(dryRun ? '\ndry run — nothing written.' : '\ndone.');
  process.exit(0);
}

main().catch((err) => { console.error(err); process.exit(1); });
```

**A `fix-<interest>-*.ts` script** (for a real scoring gap — a missing event, a wrong base
score) follows the same shape but patches `sliderEvents` or `baseScores` instead, and
*always* prints the before/after peak via the real pipeline first:

```ts
const patchedScoring = { ...scoring, base: { ...scoring.base, [KEY]: newBase } };
const monthly = deriveDestinationScores(patchedScoring, { skipHazards: true }).monthly[KEY];
console.log(`before: peak=${Math.max(...before)}  after: peak=${Math.max(...monthly)}`);
```
Never hand-compute an expected peak — the formula has enough branching (event weights,
sign flips, hazard floors) that it's easy to be wrong by exactly the amount that matters.

**Every batch, without exception:** `npx vitest run` (304 tests as of this writing) and
`npm run db:audit:anchors` ("0 bad, 0 over, 0 under") must both stay clean. For anything
touching `baseScores` or `sliderEvents`, also run `npm run db:audit:scoring` as a sanity
check — it reports a large baseline of pre-existing, unrelated content-quality findings
(don't be alarmed by a nonzero count), you're only checking that your change didn't
introduce a *new* structural error (e.g. a Postgres `errorMissingColumn`).

**Known footgun:** `npm run db:migrate` and anything importing `src/lib/db/client.ts`
read `process.env.DATABASE_URL` at import time. Plain `tsx` doesn't auto-load `.env.local`
the way Next.js does, so a script that statically imports `db/client.ts` before loading
`.env.local` silently falls back to a local throwaway PGlite sandbox — it'll report
success while writing to nothing that matters. Every script here self-loads `.env.local`
and sets `process.env.DATABASE_URL` before touching anything that reads it. This was
already fixed at the source in `migrate.ts` this session; if you ever write a new script
that imports `db/client.ts`, either load env first or use a dynamic `await import()`
after loading it.

**Cleanup discipline:** delete every `inspect-*.ts` / `survey-*.ts` / `tmp-*.ts` /
`check-*.ts` once it's served its purpose — check `git status` before committing a batch.
Only `author-*-blurbsN-*.ts` and `fix-*.ts` scripts get committed permanently; they're the
audit trail for what was authored and why.

**Commit convention:** one commit per batch. Message explains *what* was authored and
*why* specific non-obvious choices were made (which real facts drove which content
decisions, any label/timing mismatches flagged, any destinations skipped as already-NA).
End every commit with `Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>`.

## 5. Base-score / event fixes

Two flavors, both via the same "patch → recompute via the real pipeline → verify the
target → commit" discipline, never hand-computed:

- **Missing event** (a real seasonal phenomenon the score doesn't reflect at all — e.g.
  Zion & Bryce's bighorn rut, Redwood's elk rut, Seychelles' year-round Aldabra tortoises):
  add a `sliderEvents[key]` entry, refit the curve with `fitMonthlyToCurve`, verify the new
  monthly shape matches the real phenomenon's timing.
- **Wrong base score** (the destination's overall reputation for this interest is too high
  or too low relative to its peers — e.g. Bora Bora overrated for scuba, North Island
  underrated relative to the Poor Knights' actual reputation): patch `baseScores[key]`
  directly. This is a flatter, non-seasonal fix — use it when the problem is "how good is
  this place overall," not "when is the good season."

## 6. The Catalog Wishlist artifact

A single persistent Artifact ("Catalog Wishlist" — look it up via `Artifact({action:
"list"})` if the URL is lost; don't assume it's stable across sessions) holds one list per
interest that's been through this workflow: real, well-known destinations for that
interest that are **not anywhere in the 200-place catalog**. Do this after finishing the
interest's main content (§1), not before — you need the full picture of what's already
covered to know what's genuinely missing.

- **Scale constraint (explicit user correction, keep this default):** entries should be
  broad enough to be an actual "spend a week or two" vacation destination — a country,
  island, archipelago, or substantial region — not a single narrow site (one lake, one
  viewpoint, one trail). A genuinely single-site entry is fine *only* when that site
  functions as a complete standalone trip in practice (a liveaboard, a remote dedicated
  resort) — say so explicitly in the entry's `card-why` if you include one.
- Every entry needs a real, specific, fact-checked claim — a species, a record, a named
  site, a real season window — verified via WebSearch, not assumed. Tag each `tag-
  established` / `tag-niche` / `tag-emerging` for how mainstream vs. specialist vs. still-
  developing it is.
- **Cross-check overlaps every time you add a new list**, two kinds:
  1. *Same exact place already on another wishlist* — add a `.shared-note` on **every**
     appearance, and confirm the claim is genuinely different each time (a different
     animal, site, or season), not the same fact restated. If it would be the same fact,
     don't duplicate it — pick the destination up on whichever list it fits best.
  2. *Same country as an existing catalog entry, different region/experience* — a lighter
     overlap, still worth a `.shared-note`, e.g. "same country as the catalog's existing
     X entry — a different island/coast/season."
- Update the running footer note's total count and multi-listed-entries summary
  *precisely* — recount by hand, don't estimate. (A miscount here needed a follow-up fix
  this session; it's an easy place to be sloppy.)
- **Publish workflow:** read the artifact first (`action: "read"`, or reuse your own
  locally-saved source file from the last publish in the same session if you're confident
  nothing else has touched it since — verify the file still exists before trusting it).
  Edit that same file — don't reconstruct from scratch. Update the TOC, the intro's list
  count, and the footer. Republish with the **same `url`** so the link doesn't change.
- The artifact is explicitly a content backlog, not wired into scoring — say so in its own
  intro text.

**`mountaineering` (Sep 2026, first interest authored with the Step 6 workflow) — done for 73 places.**
Scores were written as text-derived decimals from the start via `scripts/mountaineering-batch-runner.ts`
(shared runner: mechanical self-check for same-text/different-score and literal-cap plateaus, `clearNA`
option, dry-run first). Lessons: (1) the NA survey only covered places already flagged applicable, so pure
rock-climbing destinations (Krabi, Fontainebleau, Squamish, Indian Creek) were missed until a second sweep —
for an interest that spans disciplines, survey NA flags against *every* discipline, not just the headline
one. (2) Step 5 found trek-style peaks (Kilimanjaro, Aconcagua, Cotopaxi/Cayambe) topping tiers that real
alpinists would give to technical ranges — trim non-technical objectives below the Alps/Dolomites tier
(`fix-mountaineering-step5-tiers.ts`). (3) Never name a specific cliff/route in a closure note unless the
research names it (Cornwall's "Bishop's Buttress" was an invented detail, since removed). (4) Anchor list is
deliberately short: only chamonix/nepal/pakistan/yosemite/el-chalten hit 10; Fontainebleau tops the rest at 9.6.
Step 7 done: 39 climbing places added to the Catalog Wishlist (Sep 2026), which also brought its total to 237 places. While in there, fixed two unclosed `list-block` divs (wildflowers, aurora) that had nested later lists inside them. When the catalog already covers a candidate under another entry (e.g. Mexico's volcanoes inside Mexico City), drop it rather than list it.

## 7. What's left (as of this doc)

Done: `wildlifeViewing`, `birding`, `whaleWatching`, `diving`, `surfing`, `windSports`, `safari`,
`wildflowerBlooms`, `hotSprings` (Sep 2026: 27 places authored across 3 batches; no per-slider sources
logged yet — the research trail wasn't captured, see the hotSprings note in `docs/todo.md`),
`beachesSwimming` (Sep 2026: 129 non-NA places, 4 batches by tier — apex/strong/modest/low. By far the
largest interest authored to date; found and fixed real scoring bugs at every stage, all verified against
the live pipeline before writing content:
- 10 temperate/cold-water destinations (Cornwall, Nova Scotia, Cape Cod & the Islands, Ireland, Scottish
  Highlands & Skye, Vancouver Island, Snowdonia, Lake District, Belfast & the Giant's Causeway, Basque
  Country) scored flat across nearly the whole year because they had no sliderEvents. Found a real formula
  gotcha along the way: once a slider has ANY sliderEvents, every month switches branches and the old
  cold/hazard/dry fallback checks silently stop applying everywhere, not just for the targeted months —
  every fix has to cover all 12 months explicitly, not just the "bad" ones.
- 3 destinations (Rio, Sydney, Galápagos) had their real seasonal pattern **inverted** — e.g. Galápagos's
  genuinely warm, calm Dec-May season was scored lower than the cold, rough Jun-Nov Garua season. Caught
  by checking real sea-temperature sources before trusting an odd-looking existing shape, not by assuming
  a Southern Hemisphere destination's data was automatically hemisphere-corrected already.
**Steps 5-6, done.** Step 5 focused on the highest-risk error class rather than re-verifying all 129
places individually: checked every destination where content named a specific real place for whether that
place is actually in scope for the catalog entry (the exact fjords/Milford-Sound mistake). Two came back
clean on inspection — Morocco's Essaouira/Taghazout Atlantic-coast claims and Jordan's Aqaba claim are
BOTH already established precedent from the already-authored `windSports`/`surfing`/`diving` scripts, not
an overreach — and cross-checked hazard-season claims (Fiji, Okinawa, Sri Lanka) against those same
already-authored interests for consistency; none contradicted. Step 6 added a 6-place Beaches list to the
Catalog Wishlist (Anguilla, Varadero, Grand Cayman — cross-referenced from the existing diving-list entry
for a different reason — Formentera, Boracay, Phu Quoc).
`auroraChasing` (Sep 2026: 22 non-NA places, single batch — small enough not to need tiering. Found and
fixed two real scoring bugs before writing content, per §5: Svalbard was scoring its own midnight-sun
months, when the aurora is physically unviewable, as high as its actual dark season; Southeast Alaska's
generic dry/wet fallback was scoring its near-continuous-light summer higher than its real Sep-Mar
season. Both fixed with a real event, verified via the live pipeline, in
`fix-aurorachasing-svalbard-alaska-events.ts`. Voice note: keep the obvious mechanic — "the sun doesn't
set, so there's no dark sky" — to one short clause; don't over-explain it.
**Post-commit correction (user-caught):** batch1's `fjords` content was written around Tromsø
(~70°N, Arctic Norway) — a real place, but not part of this destination. The "Norwegian Fjords" entry
is Geiranger/Sognefjord/Ålesund/Bergen, ~60-62°N, per its own `about` field and every other slider's
content — a genuinely different, much less reliable aurora story (needs a real storm, a handful of
times a year). The score was wrong too (apex tier; corrected to Faroe/Scottish-Highlands tier). Fixed
in `fix-aurorachasing-fjords-latitude.ts`. **Lesson: when a destination's own name suggests one place
but its actual scope (check the `about` field and its OTHER sliders' content) is a different, specific
region, don't substitute in a more convenient real place for content just because it shares the same
country — verify what the destination's existing content actually already covers first.**
Off-season copy also went through a correction: the shared "outside the dark season" line was applied
to genuine midnight-sun months (Lofoten in June, etc.) as if they merely had short nights, when there is
no night at all — factually wrong, not just verbose. Split into two lines (`NORTH_NO_DARK` vs
`OFF_SEASON`) and cut both down hard — the "even during a strong storm" hedge was pure noise once it's
obviously daylight out. **Steps 5 and 6, done properly** (not skipped, unlike earlier interests in this
list): the specialist-lens review caught a second wrong-place error of the same shape as the fjords one
— `milford-sound-fiordland`'s framing had implicitly borrowed easier viewing odds from Stewart Island
research (a genuinely different, better-suited island), when Milford Sound's own fjord-and-mountain
geography actually blocks the southern horizon the aurora needs — plus three "name the real site" gaps
(Juneau, Waterton-Glacier's actual Dark Sky Park status, Stowe/Green Mountains), fixed in
`fix-aurorachasing-specialist-review.ts`. The Catalog Wishlist got a 6-place Aurora list, led by Tromsø
— the direct fix for the fjords gap this interest surfaced.).

`windSports` was the first interest with zero pre-existing scores (added to the taxonomy
unauthored earlier this session) — it needed a "Phase A" scoring-foundation pass (NA
determination + baseScores + sliderEvents + a new anchors.ts entry, all from scratch) before
the standard §1 content workflow could even start. See
`scripts/set-windsports-foundation.ts` for that pattern if another zero-data interest ever
comes up. It also produced a hard rule for every interest from now on: **every monthly blurb
must (a) state plainly whether the destination is year-round, long-season-with-a-real-dip, or
a genuine narrow window with a dead off-season — verified per destination, not assumed from
the general pattern — and (b) name the actual site/mechanism in the text itself, so it reads
correctly in isolation** (a bare "essentially closed" misreads as the whole country being
shut, not one specific spot's wind).

`wildflowerBlooms` (Sep 2026 pass) added another rule, prompted by a real miss: Iceland's
lupine bloom was dismissed in `anchors.ts` as "not a real bloom destination" — wrong, and only
caught because the user had personally been there and noticed the gap. **Do a deliberate sweep
for plausible-but-missed destinations before considering an interest done**, not just the
obvious/anchor-tier ones — narrow, well-documented named events (a festival, a specific valley)
are easy to miss if you only work from the existing base-score list. It also reinforced the
narrow-window rule above: a single-month or even single-week event (Istanbul's tulips: ~Apr
10-20; Seoul's cherry blossom: first half of April) needs monthly text that says so explicitly
— "peak in April" alone can send someone on Apr 25 to nothing. And: irregular, non-annual blooms
(Atacama's Desierto Florido, roughly once every 5-8 years) don't fit the model's assumption of an
annually-recurring season — give them a small score bump only in the window they *could* occur,
with text that states the rarity plainly, rather than either a full seasonal score or leaving
them NA.

**Interest-count correction:** earlier in this session I told the user "51 interests," then
later "50," neither backed by actually counting `SLIDERS`. The real number, counted directly
from `src/lib/scoring/constants.ts`: `SLIDERS.length` = 54, `VISIBLE_SLIDERS.length` = 52
(hides `familyFun`, `spectatorSports` — still in the array, not deleted), and excluding the 3
practical/logistical sliders (`deals`, `crowds`, `roadtrip`, scored from peak/low flags only,
never content-authored) leaves **49 visible domain interests**. Always run an actual count
against the source array before citing this number — don't echo a remembered figure.

8 of 49 domain interests done (listed above). Natural formula-family groupings below sum to 44
items — 3 more than the 41 that "49 total − 8 done" implies, because the list below still
includes `roadtrip` (practical, no content needed) and the 2 hidden interests (`familyFun`,
`spectatorSports`) for completeness. Shared formula ⇒ shared tooling/research, but avoid running
two from the same family back-to-back — it reads as repetitive:

- **`swim` formula:** `sailing`, `kayakingRafting`, `hotSprings`,
  `beachesSwimming`
- **`hiking` formula (large — 15):** `hiking`, `mountaineering`, `cyclingRoad`,
  `mountainBiking`, `adventureSports`, `golf`, `fishing`, `horsebackRiding`,
  `trailRunning`, `scenicLandscapes`, `landscapePhotography`, `nationalParks`,
  `campingBackcountry`, `geologyVolcanoes`, `roadtrip`
- **`culture` formula (large — 12):** `historyArchaeology`, `museumsArt`, `architecture`,
  `cityExploration`, `indigenousCultures`, `religiousSites`, `festivals`,
  `traditionalCrafts`, `stargazing`, `auroraChasing`, `familyFun`, `spectatorSports`
- **`food` formula:** `streetFood`, `fineDining`, `wineSpirits`, `coffeeTea`,
  `spaWellness`, `yogaRetreats`, `nightlife`
- **Singletons:** `skiingSnowboarding` (`snow`), `sunbathing` (`sun`), `shopping`
  (`shopping`)
- **`luxury` formula:** `luxuryHotels`, `allInclusive`, `themeParks`
- **`deals` / `crowds`:** computed purely from peak/low flags, no per-destination base —
  check whether these even need §1-style prose content before starting, they may be
  structurally different from every interest done so far.

Recommendation standing from earlier: pick one interest at a time rather than committing
to a whole formula family upfront, so sample-round voice calibration stays matched to
actual feedback rather than assumed in bulk.
