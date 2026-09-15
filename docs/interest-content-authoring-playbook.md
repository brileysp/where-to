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

**Step 6 — Extend the Catalog Wishlist artifact.** See §6.

## 2. Voice and content rules

These held across all four interests done so far; treat them as defaults for every future
one.

- **Enthusiast lens, not specialist/technical.** Exciting, recognizable, real. No filler
  that a domain expert cares about but a general interested traveler doesn't (birding's
  "common pigeons," wildlife's squirrels, diving's algae-covered rubble). No unexplained
  jargon.
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
- **A stored score event's label can target a different specific mechanism** than the
  content you're pinning to it, as long as the *timing* stays honestly compatible — flag
  the mismatch (in the commit message is fine) rather than blocking on it.
- **When you find real seasonality the current score doesn't capture** (a legendary
  single site, a rut/hibernation cycle, a closure), fix the score *before or alongside*
  writing content that describes it. Never let score and content drift apart.
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

## 7. What's left (as of this doc)

Done: `wildlifeViewing`, `birding`, `whaleWatching`, `diving`, `surfing`.

46 remain. Natural formula-family groupings (shared formula ⇒ shared tooling/research, but
avoid running two from the same family back-to-back — it reads as repetitive):

- **`wildlife` formula:** `safari`, `wildflowerBlooms`
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
