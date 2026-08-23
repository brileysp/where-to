# Adding a batch of destinations

Checklist for adding new rows to the `destinations` table (source: one JSON
file per destination under `content/destinations/`, imported via
`npm run db:import:destinations` into Postgres — see Part 4). Distilled from
two passes over the existing 100-destination set: a systematic audit that
fixed flat/wrong seasonality on ~60 destinations, and a naming audit that
fixed 5 destinations whose `name`/`region` didn't hold up. Apply both halves —
content correctness and naming — to every new destination, not just old ones
being revisited.

Many of the rules below (every required `base` key present, no typo'd slider
keys, valid enums, month numbers in range) are now mechanically enforced by
`scripts/content/destination-schema.ts` — the importer will refuse to write
anything that violates them. The naming rules (Part 1) and the scoring-
seasonality judgment calls (Part 3) are still on you; no schema can catch
"this curve doesn't match the destination's real biology."

## Part 1 — Naming & identity

Before writing any scores, get `id` / `name` / `region` / `emoji` right. These
are cheap to fix before a destination ships and annoying to fix after (they
touch `about`, base scores, and searchAliases too — see the Tasmania case
below).

### Rule 1 — the name must stand on its own to an American with no geography background

Cover the `region` field and read the `name` alone. If it wouldn't mean
anything — or would actively mislead — on its own, it's wrong.

- **Bad:** `name: 'South & West Coast'`, `region: 'Sri Lanka'` — the name is a
  compass direction with zero content. Sri Lanka isn't Brazil- or
  Australia-sized; it doesn't need to be split into unlabeled fragments.
  **Fixed to:** `name: 'Sri Lanka'`.
- **Bad:** `name: 'Andaman Coast'`, `region: 'Thailand (Phuket/Krabi)'` — most
  Americans don't know what the Andaman Sea is. Use the actual resort names
  people recognize. **Fixed to:** `name: 'Thailand — Phuket & Islands'`
  (explicit `Thailand —` prefix since this deliberately isn't the whole
  country — `bangkok` is already its own separate entry, and more Thailand
  destinations are expected in future batches).
- **Fine as-is:** `Golden Triangle (Delhi–Agra–Jaipur)` — this is a real,
  industry-standard named circuit, not an invented label. `Petra & Wadi Rum`,
  `Samarkand & Bukhara` — established, coherent single-trip pairings.

### Rule 2 — no jargon, acronyms, or embellishments the rest of the dataset doesn't use

- **Bad:** `Vietnam (Hanoi–Hoi An–HCMC)` — "HCMC" is airport-code-tier jargon,
  and no other destination lists its constituent cities in the name.
  **Fixed to:** `Vietnam` (keep the cities in `searchAliases` instead, where
  `'Hanoi'`, `'Hoi An'`, `'Ho Chi Minh City'`, `'Saigon'` already lived).
- **Bad:** `Alaska (summer wildlife season)` — no other destination encodes a
  season into its name, and this one became actively wrong once winter
  aurora content (`sliderEvents.stargazing`) was added — the name advertised
  one season while the data described two. **Fixed to:** `Alaska`. Seasonal
  nuance belongs in `sliderEvents`/`specialSeasons`, never in the name.

### Rule 3 — a specific place shouldn't wear the name of a bigger place it's part of, unless the content backs it up

Check whether `about` (and the rest of the content) actually represents the
broader place the name claims, or whether the broader half is empty.

- **Bad:** `Ranthambore & Rajasthan` — `about` is 100% about the tiger
  reserve; zero content about Jaipur, forts, or the rest of the state (a huge
  region). **Fixed to:** `Ranthambore National Park`, matching the
  single-park convention used by Kruger, Yellowstone, Kaziranga, Banff.
- **Passes:** `Maasai Mara & Coast` (Kenya), `Serengeti & Zanzibar`
  (Tanzania) — look like the same problem at a glance, but both destinations
  carry real, differentiated coastal content (`searchAliases`, coastal lines
  in `monthlyWeather`, `activityStyleTiers.scenic.coastlines`), and
  safari-plus-beach is a standard, deliberately-sold itinerary for both
  countries — not an arbitrary bundle. If you're unsure whether a pairing is
  "real," check for this kind of independent evidence before flagging it.
- **Watch for drift:** even where the pairing is legitimate, make sure
  `about` actually mentions both halves. Kenya and Tanzania's `about` lines
  don't mention the coast/Zanzibar at all despite the data supporting it —
  a minor gap worth closing when you're in that file anyway.

### Rule 4 — `region` shouldn't just repeat `name`

When `name` is a whole country (`Vietnam`, `Sri Lanka`, `Rwanda`, `Costa
Rica`, `Iceland`, `Namibia`, `Madagascar`, `Japan`...), `region` should be a
*broader* geographic descriptor — continent or subregion — not the same
string again. `region` always renders as a subtitle directly under `name` in
both the results card and the search dropdown (unconditionally, no
dedup logic), so `name: 'Vietnam'` / `region: 'Vietnam'` visibly repeats
itself on screen. Use `'Southeast Asia'`, `'South Asia'`, `'East Africa'`,
`'Central America'`, `'Nordic'`, etc. — match the pattern of existing
country-named entries.

### Rule 5 — emoji and `about` must match the actual content, not an assumption

The original sin this whole audit traces back to: `'Great Ocean Road &
Tasmania'` used a koala emoji, but koalas aren't native to Tasmania — a real
factual error that only surfaced because the pairing itself (mainland
Victoria road trip + separate island state) was already wrong. When you
touch a destination's identity fields, sanity-check the emoji and `about`
against the destination's real geography/wildlife/culture, not against
whatever the previous author assumed.

### Naming self-check before saving a new destination

1. Cover `region` — does `name` alone mean something to a geography-agnostic
   American? If not, fix it.
2. Any acronym, jargon, or season/timing word in the name that no sibling
   destination uses? Move it out (searchAliases / sliderEvents / about).
3. If the name pairs a specific place with a broader one, does `about`
   actually cover the broader half — or is it dead weight?
4. If `name` is a bare country, does `region` say something *different* and
   broader, not the same string?
5. Does the emoji match the real place, not an assumption?

## Part 2 — Content completeness

Every field below comes from `ScoringDestination` (`src/lib/scoring/types.ts`)
/ the `destinations` table (`src/lib/db/schema.ts`). Required fields must be
present for scoring to work at all; optional ones are sparse by design — only
fill them in where they're actually true for that destination.

**Required:**
- `id` (slug), `name`, `region`, `emoji`, `climate` (one of `tropical`,
  `desert`, `mediterranean`, `temperate`, `highland`, `polar`), `about`
  (one-line seasonal summary)
- `base` — all 27 slider keys from `SLIDERS` in `src/lib/scoring/constants.ts`
  (`birding`, `wildlife`, `hiking`, `scenic`, `stargazing`, `fishing`,
  `sunbathing`, `swimming`, `diving`, `surfing`, `sailing`, `spa`, `museums`,
  `architecture`, `festivals`, `finedining`, `streetfood`, `nightlife`,
  `winetasting`, `shopping`, `cycling`, `snowsports`, `adventure`,
  `roadtrip`, `golf`, `deals`, `crowds` — the last two are computed, not
  hand-set)
- `dry` / `wet` / `hot` / `cold` / `peak` / `low` — month-number arrays (1-12)
- `budgetBands` / `vibeBands` / `physicalBands` — from `BAND_DIMENSIONS` in
  the same constants file

**Conditional (fill in only where genuinely true):**
- `peakIntensity` (`'mild' | 'moderate' | 'extreme'`) — drives both the peak
  badge text and the `deals`/`crowds` score, so pick the tier the real-world
  overtourism situation supports, not a default.
- `wildlifePeak`, `wildlifeClosed`, `birdingPeak` — for wildlife/safari-type
  destinations only.
- `hikingBest`, `hikingWorst` — overrides the `dry`/`wet`+`hot`+`cold`
  fallback for the seven sliders that share the hiking formula (`hiking`,
  `scenic`, `fishing`, `cycling`, `adventure`, `roadtrip`, `golf`). Needed
  when a destination's trail access doesn't track its general weather flags
  (e.g. a ski town's trails literally close in winter regardless of whether
  winter is flagged `cold`).
- `inaccessible`, `swimHazard`, `noSnow` — hard floors, not soft penalties.
  `noSnow` exists specifically because a ski town's own summer often isn't
  flagged `hot`/`dry` by its own climate norms (see the comment in
  `destinations.ts`), so don't rely on `snow`'s formula alone.
- `shopClosures` (boolean, not a month array — this bit someone once) — set
  true only when there's a real, stated low-season closure (Thailand's own
  `about` says "closed island services"; ski towns' shoulder "mud season").
- `sliderCaps` — sparse per-slider ceiling. Add one when a destination's peak
  score for an interest would otherwise overstate how genuinely
  world-class it is (a beach island with incidental birdlife shouldn't score
  identically to the Serengeti in its best month).
- `sliderEvents` — see Part 3, this is the mechanism for real multi-tier
  seasonality.
- `specialSeasons` — `{ months: number[], text: string }[]`, the "why now"
  callout under the year strip. Keep this and `monthlyWeather` from saying
  the same thing twice (see Part 3's duplication note).
- `monthlyWeather` — 12 hand-written entries, index 0 = January. Every
  existing destination has these; a new one should too.
- `naSliders` — sliders that are structurally never a reason to visit this
  destination in any month (not just "scores low sometimes"), e.g.
  `snowsports` for a tropical island.
- `searchAliases` — alternate names, neighborhoods, nearby landmarks. This is
  where jargon/acronyms/city-lists that don't belong in `name` should live
  instead (see Rule 2 above).
- `activityStyleTiers` — per-slider sub-style quality
  (`'signature' | 'strong' | 'casual' | 'none'`), keyed by the style option
  keys in `DOMAIN_CORE_AXES` (`src/lib/dna/domains.ts`): for `cycling` —
  `scenicRoadCycling`, `gravelRiding`, `mountainBiking`; for `scenic` —
  `deserts`, `mountains`, `forests`, `coastlines`, plus `astrophotography`.
  Leave a slider/style out entirely if you haven't actually researched it —
  an absent entry reads as neutral, not as a penalty; only set `'none'` when
  you've checked and it's genuinely a poor fit (a soft penalty, not a hard
  zero).

## Part 3 — Scoring quality (avoiding the flat-score bug)

The most common bug found across ~150 audited slider/destination
combinations this project has gone through: a `base + flatBonus`-style
formula (used by the `wildlife`, `birding`, `hiking`/`scenic`/etc., `culture`,
and `food` formulas) clamps at 10 either way once `base` is already high,
producing a flat or near-flat curve with no real month-to-month texture —
even when the destination has genuine, describable seasonality.

**When authoring a new destination, check each of these formula groups for
whether the flat legacy formula is actually correct, or whether it needs
`sliderEvents`:**

- **`wildlife` / `birding`** — does this destination have a real narrow
  peak, a shoulder season, or two independently-timed draws (e.g. a
  migration plus a separate bird-arrival window)? If `base` is already 8-10
  and the legacy peak-flag formula would just clamp flat, author
  `sliderEvents.wildlife` / `sliderEvents.birding` instead. Ground the curve
  in real biology — e.g. wet-season Palearctic bird migrants arriving
  opposite the dry-season wildlife peak in East African safari destinations
  is real ecology, not an invented shape to copy from another destination.
- **`hiking` / `scenic` / `fishing` / `cycling` / `adventure` / `roadtrip` /
  `golf`** (shared formula, keyed per-slider via `sliderEvents[s.key]` — see
  the code comment in `destinations.ts` for why this must never be
  hardcoded to one slider) — for mountain/ski destinations specifically,
  `hiking` should swing hard (trails literally close) while `scenic` often
  should stay much flatter (snow-capped peaks can be genuinely "year-round"
  scenery) — don't give every slider on a shared formula the same curve
  shape by default.
- **`culture`** (`stargazing`, `museums`, `architecture`, `festivals`) —
  museums and architecture are *usually* correctly flat; don't invent
  seasonality where a world monument genuinely has none. Festivals are the
  real exception (spiky, narrow-window peaks tied to actual dates) and
  stargazing at extreme latitudes is darkness-driven (check whether the
  destination's own `about` text names an aurora/dark-sky season — Alaska
  and Norwegian Fjords both had this backwards at one point, with the score
  flat-to-higher in summer despite their own copy naming winter as the
  aurora season).
- **`food`** (`spa`, `finedining`, `streetfood`, `nightlife`, `winetasting`)
  — the highest false-positive-for-a-fix rate of any formula. A good wine
  region should stay high/flat year-round unless it genuinely closes — don't
  manufacture a harvest-season dip; harvest is at most a small bump, and
  more traffic is arguably a downside, not an upside. Spa should only get
  the `shopClosures` treatment (not `sliderEvents`) where a destination has
  a real full off-season, not just a slower one — check beyond the obvious
  ski towns.

**Before authoring any `sliderEvents`, check the destination's own `about` /
`specialSeasons` text and real-world geography first** — don't copy another
destination's curve shape by default. Most flat scores across `museums`,
`architecture`, and `shopping` are *correctly* flat (a world-city's shopping
scene, or a monument that's simply always there, doesn't have a season) —
the goal is finding real, describable seasonality, not adding drama for its
own sake.

**Duplication check:** `sliderEvents` never touch displayed text —
`generateMonthlyBlurb` (in `blurb.ts`) and `deriveDestinationScores` (in
`destinations.ts`) are fully separate. If you add a `specialSeasons` callout
naming an event ("prime jaguar season"), check the hand-written
`monthlyWeather` text for that same month doesn't already say the same thing
— it's easy to end up with both saying the same claim back to back.

## Part 4 — Sync & verify workflow

Destinations are authored as one JSON file per destination under
`content/destinations/<id>.json`, validated against
`scripts/content/destination-schema.ts` (a zod schema, deriving valid slider/
band keys from the app's own constants — see that file's comments for exactly
what it checks: every real base slider key present, no typo'd keys anywhere,
`climate`/`peakIntensity` are real enum values, all month numbers are 1-12,
`shopClosures` is a strict boolean not an array, etc.). This replaced hand-
editing `scripts/legacy/data.js` plus a throwaway `scripts/tmp-sync-*.ts`
script per batch — that workflow is retired; `data.js` stays in the repo only
as historical/legacy reference and is no longer the place to add or edit
destinations.

1. Add or edit files under `content/destinations/`. Filename must be
   `<id>.json` and its `id` field must match. Use an existing file (e.g.
   `content/destinations/alaska.json`) as a template for field shape — the
   schema omits empty/default fields on export, so real files read as
   fairly short, showing only what's actually authored.
2. Validate without touching either database:
   ```bash
   npm run db:import:destinations -- --dry-run
   ```
   Fix everything it reports — it collects every error across every file
   before failing, so one run surfaces the whole batch's problems at once,
   not just the first.
3. `npx tsc --noEmit` and `npx vitest run` — both must be clean. Add cases to
   `tests/content/destination-schema.test.ts` if you're adding a new kind of
   validation rule; add cases to `tests/scoring/destinations.test.ts` if
   you're touching a formula's `sliderEvents` wiring for the first time on a
   slider that hasn't had it before (see that file for the pattern — each
   formula has dedicated regression tests, including one that proves a
   sibling slider's events don't leak in).
4. Push to **both** databases in one command:
   ```bash
   npm run db:import:destinations
   ```
   This reads `.env.local` itself and always upserts to Supabase and the
   local PGlite copy in the same run — there's no separate "remember to
   toggle `DATABASE_URL` and run it twice" step anymore, which was the exact
   failure mode the old per-batch script invited.
5. Restart the dev server so PGlite reloads its in-memory copy — it won't
   pick up external writes otherwise (the importer prints this same
   reminder after a successful run):
   ```bash
   lsof -i :3000 -sTCP:LISTEN -t | xargs kill
   nohup npm run dev > /tmp/dev-server.log 2>&1 & disown
   ```
6. Spot-check a handful of the new destinations in the browser: search for
   them, check the year strip actually shows the texture you authored (not a
   flat bar), and check the card renders cleanly (name/region don't wrap or
   truncate — the results-card CSS has a container-query safety net for this
   down to any width, but a genuinely wild outlier name is still worth an
   eyeball).

If you ever need to regenerate `content/destinations/*.json` from scratch
(e.g. after a manual DB edit you want reflected back into files), the one-time
migration script that originally produced them is still there:
`npm run db:export:destinations` reads `scripts/legacy/data.js`, not the
database — it's a one-way historical export, not a DB-to-files sync.

## Before calling a batch done

- [ ] Every new destination passes the 5-point naming self-check (Part 1)
- [ ] Every required field is set; conditional fields are set only where
      true, not defaulted in out of habit
- [ ] Each formula group's flatness has been considered against the
      destination's real seasonality (Part 3) — not every slider needs
      `sliderEvents`, but every slider should have been *checked*
- [ ] `about` and `specialSeasons` don't restate each other verbatim in
      `monthlyWeather`
- [ ] `tsc` and `vitest` clean, both DBs synced, dev server restarted,
      `scripts/tmp-*` empty
- [ ] A few new cards spot-checked live in the browser
