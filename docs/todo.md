# To do

Work we've decided on but not built. Newest items at the top of each section; move to
"Done" (or delete) when shipped.

## Gemini content-generation pipeline (added 2026-09-29)

**wildlifeViewing: COMPLETE — all ~200 places live (2026-10-01).** The full catalog has
been regenerated under the v5 directive and applied to `places`. This closes out the
multi-session effort tracked in this section; see git history / earlier revisions of this
file for the full batch-by-batch narrative (A through Z) if that detail is ever needed
again. Final two batches:

- **S-T batch (22 places: San Miguel de Allende through Texas Hill Country)** — batch ids
  `060a378d` (S, 17) + `b3cc041b`/`b45f600f`/`31669f94` (ta/tb/te, 5). Three editorial
  review rounds (host-word sweep, peak-score corrections, content fixes) before going
  live. Cost $0.35.
- **T-Z batch (22 places: Thailand through Zion & Bryce Canyon)** — batch ids `850d99ed`
  through `5b4125db` (th/ti/to/tu/u/v/w/y/z). Same review depth — Khao Sok NP added to
  Thailand's profile, Uganda's monkey roster expanded, several peak-score corrections from
  the user's own firsthand travel experience (Zermatt, Tasmania, Texas Hill Country,
  Torres del Paine, South Luangwa, Yellowstone), domestic/captive-species and jargon fixes
  (Dzheyran Ecocenter, Tbilisi). Cost $0.35.

Both batches' proactive fact-checks found only mechanical issues (banned jargon, causality
false-positives) — no real factual errors across either batch, an unusually clean finish
to the series.

**Birding: all 200 places generated and applied (checked against `content_generations` on 2026-10-09).** 266 generation rows across prompt versions v1 to v8 (56 places on v1, 56 on v2, then v4 to v8; 70 places on v8); nothing is staged. Directive: `prompts/birding/v8.md` (v1 was adapted from wildlifeViewing v5: birds-only scope and birding's own anchor scoring model from `scripts/audit-birding-model.ts`). The 12 lessons approved at v4 live in the prompt files: score decimals via `src/lib/gemini/decimalize.ts`, shared blurbs only for stable conditions (the validator rejects transition verbs), "host" only for transient visitors, certainty-word variety, lead with the best birds, seasonal headline birds, subspecies called subspecies, counts only when impressive, no lodge names, sourced rarity and endemic claims, scores matching text severity, ceilings not targets. Process notes that still hold: pilot about 5 varied places before a full run, regenerate only failures, thinking tokens are about 70% of the cost (about $0.06 a place). Open birding items are on the birding interest page: five bird-name calls, six overviews over their length cap, Champagne's Lac du Der cranes, the "access counts" rule is not in v8, and the source checks.

See `docs/gemini-content-pipeline-plan.md`. `npm run gemini:author` stages generations
(never applies); `npm run pipeline:diff` / `pipeline:apply` review and commit one at a
time by id. Found and fixed a real bug during the first live pilot: applying a
generation didn't clear a pre-existing `scoreOverrides` entry, which silently masked the
new curve — fixed in `src/lib/gemini/apply.ts`.

**Standing rule — Claude must remind the user if this hasn't happened:** once every
place for an interest has been (re)generated, the user will ask Claude to run a full
specialist-lens/fact-check review (WebSearch-based, comparing destinations against each
other, prioritizing anything Gemini flagged low-confidence or anything the mechanical
validators warned on) before applying the rest — the same methodology as the old
playbook's Step 5/6, just re-pointed at Gemini's output. This does NOT happen
automatically per batch; it's a deliberate, user-requested pass once an interest is
fully generated, not built as an automatic pipeline step. If an interest's generation
looks complete and this review hasn't been asked for yet, bring it up.

Prompt versioning note (2026-09-29): the wire schema itself can change between prompt
versions now, not just wording — v1 used a nested `{overview, monthly:[{score,text}]}`
shape, v2+ use the user's own flat `score_jan`/`blurb_jan` JSON contract. `client.ts`'s
`generate()` takes a `schemaShape` param and always normalizes back to the same internal
`GenerationOutput`, so `validate.ts`/`apply.ts`/`pipeline-diff`/`pipeline-apply` never need
to know which wire shape a given generation actually used — a v1 and a v2 generation for
the same place stay directly comparable. `schemaShapeForVersion()` in
`gemini-author-batch.ts` is the (hand-maintained) map from version string to wire shape.

wildlifeViewing history: the batch-by-batch story of the run (14 places on 29 Sep to all ~200 live on 1 Oct, the review rounds, the v3 to v5 directive lessons, the Gemini billing hiccup) is in `docs/archive/todo-wildlife-pipeline-history-2026-09.md`. The durable lessons live in `prompts/wildlifeViewing/v5.md` and the pipeline note in project memory.

## Supabase egress (free plan over quota, noticed 2026-10-05)

Egress was 5.7 GB of the 5 GB allowance for the 14 Sep to 14 Oct cycle, and over in the cycle before; the
dashboard shows a grace period to 4 Nov 2026, after which an org still over quota gets restricted (requests
return 402). Most of it came 14-22 Sep (1.8 GB on the 16th); daily use since ~24 Sep is 0.05-0.2 GB. One full
read of the 200 places is about 5.8 MB over the wire (slider_curves, slider_monthly_weather and
slider_monthly_weather_meta are ~75% of it).

Done 2026-10-05: (1) interest-page saves no longer drop the in-memory place cache (`skipPlaceCache` on
`withAdminAudit`; before this, every save forced a 5.8 MB re-download); (2) the cache's full-refresh backstop is
12 hours, not 30 minutes (up to 48 re-downloads a day on a busy server); (3) scripts can keep a disk copy of the
place rows: set `PLACE_ROWS_SNAPSHOT=1` (the `db:audit:*` npm scripts already do), the copy lives in `.cache/`
and is verified with the cheap updatedAt check, so a second run takes ~2 s instead of ~55 s and downloads almost
nothing. Still to consider: `next build` starts ~15 workers that each download all the rows (avoid repeated
builds; use `tsc --noEmit` and the tests); the history pages read every audit row for a place with full
before/after snapshots (~35 KB each); upgrading to Pro if usage stays near the limit.

## Per-interest admin pages (built 2026-10-05)

One page per interest at `/admin/destinations/interests/<key>`, linked from an "Open page" column on
the Interests tab (which also now shows written-overview and N/A counts) and mentioned on the Admin
home list. Five sections: Rules & scoring (definition, the "ten", formula family, directive file;
Birding adds the score formula, a "Try it" calculator, ladder and writing rules), Outstanding items,
Future place ideas, Places & data, and Expert reviews (reviewer, date, whole interest or one place,
notes on what they did). Places & data has a two-place Compare view.

- New tables (migration 0028, RLS on): `interest_reviews`, `interest_todos`, `interest_place_ideas`,
  `place_interest_facts` (per place and interest, free-form jsonb). All edits go through
  `withAdminAudit`. Seeded for birding by `scripts/seed-interest-pages.ts` (re-runnable, never
  overwrites typed values).
- Safari columns added 2026-10-05: eleven-animal likelihood grid, style/rules, experience, malaria, draw,
  headline animals (config.ts `SAFARI_FACTS`; Rules tab content in `SAFARI_*` constants). Drafted for all 17
  places by `scripts/seed-safari-facts.ts` (not source-checked). Density, close-up ease and spectacle are
  blank for the owner to rate. Not yet seen in a browser (admin login); covered by tsc, eslint, vitest.
- Birding columns: species, endemic species, endemic families, charisma, views/photo, spectacle,
  draw, headline birds, source-checked, plus the planning columns (days needed, guide, self-drive,
  spread, accessibility) left empty. Which columns an interest has is set in
  `src/lib/admin/interest-pages/config.ts`; other interests show only the generic columns for now.
- Still to do (updated 2026-10-09): birding endemic species (38 cells blank where the definition or a source was unclear), about 100 city and region species counts that need eBird totals, the views/photo review, and source checks (55 of 200 birding places are source-checked; wildlife 0 of 200; safari 0 of 17); add columns for other interests as they get authored; moving rules and definitions from code into the database if wanted. (The Interests x Places grid links to the page from each interest name and from the interest filter.)
- This replaces the three "no home yet" items below (per-interest definition/anchors, authoring
  status, Catalog Wishlist tab). The old Catalog Wishlist artifact has not been imported; the
  birding ideas list is a nine-place seed marked "not yet researched".

Snorkeling & diving prep (9 Oct 2026, no Gemini calls yet): draft directive in `prompts/_drafts/diving-v1-draft.md` (revised after review: no caps for single-discipline places, whales and dolphins count when you can get in the water, 10s are the best of the best with a pool of 12 candidates). Built: three interest-page columns (`divingRating`, `snorkelingRating`, `bestFor`, in config.ts), a `flat-v2-fit` Gemini response shape chosen automatically when a prompt mentions `diving_rating`, validation (ratings 0-10, `bestFor` must follow the ratings with a 1.5 gap, better rating within 0.5 of the peak), and `writeExtraFacts` in apply.ts, which stores the three values when a generation is applied and clears them for N/A. Also built: format columns (how you do it, certification needed, typical depth, current, water temperature, signature animals, source-checked), and the directive's §2b: a typical day-boat dive gets no format wording, and an unusual format is called out in the overview. Done 9 Oct 2026: interest renamed to "Snorkeling & Diving" (constants.ts); fact sheet drafted for 75 places by `scripts/seed-diving-fill.ts` (data in `scripts/data/diving-fill.json`, 419 cells, NOT source-checked; ratings left for Gemini); skip list of 55 clear-N/A places in `docs/diving-clear-na.json` (test in tests/gemini/skip-list.test.ts), so 145 places would go to Gemini, 48 of them currently N/A. Still to do before a run: owner review of the fact sheet and skip list (published page "Diving Fact Sheet and Skip List"), five-place pilot, move the draft to prompts/diving/v1.md. PILOT run 9 Oct 2026 (batch de9c9175, Seychelles typical and Galápagos unusual, directive installed as prompts/diving/v1.md, fact sheets in docs/diving-facts.json, cost $0.058 total, STAGED ONLY): the typical place got no format wording and the unusual one had it called out. Found: Galápagos held 10.0 for four months (rule is 1-3), its overview was 534 of 550 characters, and Seychelles was rejected for a shared blurb with "arrive" (months 8-9). Proposed v2 changes (not made): check for more than three months at 10.0, warn when an overview is over 85% of its ceiling, hand-edit Seychelles September. Open question: keep the "best experience in the month" scoring (Galápagos warm months 8.4-8.7 vs 6.0 today). PILOT rounds 2-3 (9 Oct 2026, owner feedback: no 10.0 month cap, off-season discipline callout, animals-led places say so, penguins not headlined): prompts/diving/v2.md then v3.md (v3 is the latest and will be used), new `drawType` column ("What the draw is"), `scripts/build-diving-facts.ts` rebuilds docs/diving-facts.json from the interest page columns, validator warnings for 4+ months at 10.0, off-season months with no out-of-season wording at diving-led places, months above both ratings, and banned self-rating words. v3 pilot: Galápagos 450-char overview, off-season blurbs correct, scores 8.4-8.7 Jan-May/Dec, 10.0 Jul-Nov (owner to double-check November), leftover fluff words playful/excellent/ideal are hand fixes. Staged batches de9c9175 (v1), 51184443 (v2), 1ca70e72 (v3); none applied. 10 Oct 2026: the French Polynesia pilot was wrong-scope (described Bora Bora's lagoon) because the place was renamed and had no scope sheet; fixed with `docs/renamed-places.json`, `scripts/data/diving-scopes.json` (13 renamed places going to Gemini), a guard in gemini-author-batch.ts and tests/gemini/renamed-places.test.ts; corrected re-run batch fdac7173 (territory-wide, rejected for a shared "arrive" blurb and "guaranteed" overuse). Pilot spend so far about $0.30 across five runs. Before the full run: tighten "guaranteed" wording, vary the animals named across months, no format sentence for typical places (v4 proposals). 10 Oct 2026 (later): format callout is now CALCULATED from the interest page columns (`divingFormatCallouts` in config.ts, a read-only "Format callout (calculated)" column) and handed to Gemini as a "Format callout: NONE / say these" line (prompts/diving/v4.md, the latest; v3 and earlier stay as they were run). Run-readiness audit of all 145 places: every renamed place has a scope sheet, sheet place names match current names, nothing flagged; 25 typical, 58 with a callout, 62 with no sheet (Gemini judges). New safeguards: fact sheets record `forPlaceName` and a rename afterwards blocks the run; warning when generated text contains an old name (`oldNameIssues`); `--names="French Polynesia,Chicago"` selects places by current name. Open owner decisions: tighten "guaranteed" wording (not asked, not done); whether to renumber internal place ids (recommendation: no). Run command when approved: `npx tsx scripts/gemini-author-batch.ts --interest=diving --reauthor --include-na --skip-clear-na --limit=200`. Thinking is capped at low and a higher level now needs --allow-higher-thinking.

Reference sites (built 9 Oct 2026): the Expert reviews tab of each interest page now has a "Reference sites" list above the reviewers: the few sites we come back to for quarterly fact checks, each with a 1-100 usefulness score (100 = best), last-used date, places checked, and a "Due for a check" flag after 90 days. Table `interest_reference_sites` (migration 0030, applied to the live database); first 17 entries seeded by `scripts/seed-reference-sites.ts` (whale watching 8, birding 6, safari, wind sports, wildflowers 1 each) with Claude's first-guess scores for the owner to edit. Each site also carries a "Who can check it" tag (AI can read it / AI via search only / Human check needed). Verified 9 Oct 2026: eBird's website and Merlin block automated reads (human only); BirdLife DataZone numbers do not load for AI; the IWC handbook pages return 403 directly but are quotable through search; 2seewhales.com is a single LA tour operator and was removed from the list (its 15 place links need review, see the whale to-do). Fact-check scripts can call `recordSiteUse(interestKey, siteUrl, placesChecked)` from `src/lib/admin/interest-pages/reference-sites.ts` to stamp a use. Not yet seen in a browser (admin login); covered by tsc, eslint and tests/admin. Still empty: diving, wildlife, beaches, surfing and the rest.

Future places status (9 Oct 2026): whale watching 26 (imported from the old Catalog Wishlist artifact, claude.ai/artifact/N8oEcWrwLCevwCK8PANdKA, plus 6 new), birding 57, wildlife viewing 44, safari 22, diving 38 (the 31 from the old artifact minus Jardines de la Reina, now inside Cuba, and Koh Tao, same as Koh Samui & Gulf Islands, plus 7 new; imported 11 Oct 2026). Still only in that old artifact, not yet in the database: surfing 12, windsports 10, wildflowers 7, aurora 6, beaches 6, climbing 39. When a place appears on more than one list it must carry the same name on every list and a note "Also on the X list (same name)" (names harmonized 9 Oct 2026: Península Valdés, Channel Islands & Santa Barbara Channel, Chiloé & the Gulf of Corcovado, Gabon: Loango and Lopé). Known pending cross-references when the old lists are imported: Tromsø & Skjervøy (aurora list calls it "Tromsø").

## Admin screens: attributes with no home yet

Items 1-3 from the first version of this section (anchors, audience tier and formula on the Interests tab; authoring status; the Catalog Wishlist tab) shipped as the per-interest pages and the Interests tab columns (2026-10-05) and were removed on 2026-10-09.

Runners-up:
- Curve source pill on the matrix curve column (hand-authored via `authoredCurves` vs auto-fitted).
- `isPublished` as a column on the Places tab.
- Not shown anywhere yet: `scoreStatus` / `scoreInheritedFrom`, `seasonalHazards`,
  latitude/longitude, `stampDesign`, `parentPlaceId`.

## Other open items (already discussed this session)

- hotSprings wrap-up: playbook §7 marked done (2026-09-21). Still open:
  - Source logging: 27 places have hotSprings content and none have `sliderSources` entries.
    The research trail wasn't captured (old session transcripts show only 3 web searches, no
    URLs), so sources can't be logged retroactively without inventing them. Either re-verify
    with real sources and log those, or leave hotSprings unlogged.
  - Extend the Catalog Wishlist artifact with a hot-springs list (verified candidates only).
- beachesSwimming: fully done (Sep 2026) — content (129 places, 4 batches), specialist review, and a
  6-place Catalog Wishlist beaches list. See playbook §7 for details.
- Remaining swim-formula interests to author: sailing, kayakingRafting (no generation run for either yet; `prompts/kayakingRafting/v1.md` exists). Each Gemini call is standalone, so the old "do not run same-family interests back to back" rule no longer applies to generated interests.
- nationalParks: not an interest. Revisit as a tag / type of place.

## Cost-item tracking follow-ups (added 2026-09-21)
- Visually verify the Cost Items screen (new Last updated / By / What changed columns, "Never edited by a human" filter) — needs a signed-in browser session.
- Build the cost-checking agent: it should save edits with kind `'agent'` (see `src/lib/admin/cost-item-stamp.ts`); the grid already shows a 🤖 for agent edits.
- Only edits made through the admin panel are tracked; script-authored items show "Never edited".


## Completeness score (built 2026-10-06)

One 0-100 score per interest, computed in `src/lib/admin/interest-pages/completeness.ts` (pure functions, tested in
`tests/admin/completeness.test.ts`) and loaded by `getInterestCompleteness` in `src/lib/db/queries/interest-pages.ts`.
Shown on the Interests tab (sortable "Completeness" column) and in a strip at the top of each interest page (the number,
the three things that would raise it most, and a collapsed "How this is scored").

Weights: content 50, data columns 20, scoring quality 10, verification 10, scope and rules 10. An interest with no
special columns scores on the other four. Open to-do items never change the score.

- Content: per place, live overview, 12 blurbs, authored curve, within length caps, nothing staged waiting. A place with no live text earns 0.
- Scoring quality: at most 4 of 12 scores whole or half numbers; a flat run of 3+ months within 0.3 must be a ceiling or floor (or share a blurb); a jump of 1.5+ needs a cause word in a blurb or an event.
- Verification: a place review in the last 12 months or the source-checked flag counts fully, a whole-interest review counts half.
- Scope and rules: definition, "ten" list, directive file, rules tab (`RULES_TAB_KEYS` in config.ts), future-places list.

Not built yet: the ranked "lowest completeness" list on the admin home, the per-place score and "check scores" flag in
the Places & data table, and a weekly snapshot for a trend line. The score refreshes on page reload, not live as you edit.

## Place grain changes (started 2026-10-07)

Proposal artifact: "Place Fold Proposal" (claude.ai/artifact/GLHW9sNpsqnebzqxL8NxKS). Ids are kept on every rename.

Done 2026-10-07 (name, region where needed, short overview, search aliases only, via `scripts/rename-seven-places.ts`):
bagan -> Myanmar; kaziranga -> Assam & Northeast India; komodo -> Komodo & Flores; joshua-tree -> Palm Springs & Joshua Tree;
punta-cana -> Dominican Republic; whistler -> Vancouver & Whistler; el-chalten -> El Chaltén & El Calafate.

Still to do for those seven: the interest texts (overviews and monthly blurbs), monthly scores, costs and climate still describe the
old, narrower area (they remain true, but do not cover the added places). Rewrite and re-fit per place, one review each.
Havana -> Cuba is approved but not done. Not yet decided: Champagne into Paris, St Andrews into Edinburgh, Rioja into Basque Country,
Aspen to Colorado ski country. Also: the safari idea "Sundarbans" still says nearest existing "Kaziranga National Park";
scoring lists name whistler and komodo (ids unchanged); set travel advisories for Myanmar and Cuba before their broader text goes live.

Update 2026-10-07: Havana renamed to Cuba. Myanmar (id bagan: birding, wildlifeViewing) and Assam & Northeast India (id kaziranga: safari,
birding, wildlifeViewing) interest texts, monthly text and scores rewritten for the wider scope by Claude (`scripts/rewrite-myanmar-assam.ts`,
curves refit with errorTolerance 0.06 so decimals land; review page "Myanmar and Assam Rewrite", claude.ai/artifact/Uc8uK5fhjt4EYcTPuARR45).
Open: Myanmar travel advisory (US Level 4 as of May 2026) not yet entered; user to confirm Myanmar score changes; other interests' curves for
those two places still describe Bagan/Kaziranga only. Still to rewrite for scope: Komodo & Flores (6 interests), Palm Springs & Joshua Tree (4),
Dominican Republic (6), Vancouver & Whistler (4), El Chaltén & El Calafate (3), Cuba (6).

Update 2026-10-07 (second batch of broadenings, names only, `scripts/rename-six-places.ts`): angkor -> Cambodia, luangprabang -> Laos,
belfast-giants-causeway -> Northern Ireland, snowdonia -> Wales, banff -> Banff & Jasper National Parks, quebec-city -> Quebec City & Montreal.
Only name and search terms changed (old names kept as search terms). 52 to-dos were added across 37 interest pages (source "Place rename,
7 Oct 2026"): one "Rewrite <place> for its wider scope" per written interest (overview, 12 blurbs, 12 scores) and one "Re-check <interest> scores
for broadened places" per interest where these places only have scores. Place-level fields still describing the old, narrower scope, for all six
and for the earlier renames: the one-line overview, the seasons summary (about), costOverview and cost items, the 12 monthly weather lines,
special-season notes, setting tags / place type, and region wording. Not yet to-do'd on the interest pages: the earlier renames (Komodo & Flores,
Palm Springs & Joshua Tree, Dominican Republic, Vancouver & Whistler, El Chaltén & El Calafate, Cuba, and the non-rewritten interests of Myanmar and
Assam & Northeast India).

Whale watching setup (7 Oct 2026, finished): `prompts/whaleWatching/v1.md` (now v3) with the applicability decision first, whale-led scoring with a dolphin cap and the NOT_APPLICABLE output form; pipeline support (`--include-na`, `isNotApplicable` in `validate.ts`, N/A handling in `apply.ts`); interest page columns in `config.ts` (`WHALE_FACTS`); columns drafted by `scripts/seed-whale-fill.ts` and later source-checked for all 124 places (see "Whale source-check pass").

Whale watching skip list (2026-10-07; now 74 ids after Marrakech & Atlas and New Orleans were added): 71 places were first listed as never sent to Gemini (`docs/whaleWatching-clear-na.json`, used by `gemini-author-batch.ts --skip-clear-na`):
57 with no sea within about a day trip, plus 14 borderline places the owner chose to skip (Atacama, Beijing, Bend & Crater Lake, Berlin, Champagne, Denali & the Interior,
Dolomites, North Cascades, Palm Springs & Joshua Tree, Paris, Petra & Wadi Rum, Piedmont, Queenstown, Rioja). All are already N/A. Full run command:
`npx tsx scripts/gemini-author-batch.ts --interest=whaleWatching --reauthor --include-na --skip-clear-na --limit=200` (129 places; thinking capped at low by default).

Place grain decisions (2026-10-07): keep as is: Champagne, Rioja, Arches & Canyonlands, Zion & Bryce Canyon. Napa Valley will become Napa & Sonoma; Bora Bora likely
becomes French Polynesia; Hawaii keeps Big Island and Maui and gains Kauai and Oahu as separate places; San Francisco is its own place (not merged with Napa & Sonoma).
Botswana is NOT one place (Delta and Chobe peak May-Oct, Makgadikgadi and Central Kalahari peak Nov-Mar): keep Okavango Delta, add Makgadikgadi & Central Kalahari.
South Luangwa stays as is (Lower Zambezi and Kafue later as their own places). Name options pending for Kruger (Greater Kruger / Kruger & Sabi Sands / Kruger & the
Lowveld) and Aspen (Aspen & the Roaring Fork Valley / Aspen Snowmass / Colorado High Country). Proposed grain rule (five tests, three kinds of city) is in the "Place Grain
Rule" artifact (claude.ai/artifact/7viW7qQ93mesWeQ7ucR4RG); it would reverse Vancouver & Whistler and Quebec City & Montreal. It answers open product decision #1 in
docs/final-architecture-plan.md (which compound-name places to decompose). Next if approved: run the tests across the 42 compound-name places. Related places and
place_relationships exist in the schema but the app does not use them yet (only isPrimaryDestination places show), so do not demote places until Explore exists.
Wishlist additions: San Francisco, Kauai, Oahu, Makgadikgadi & Central Kalahari, Lower Zambezi, Kafue.

Place grain update (2026-10-07, later): renamed Kruger & Sabi Sands, Aspen Snowmass, Napa & Sonoma, French Polynesia (`scripts/rename-batch3.ts`; 16 rewrite to-dos and 26 score
re-check items logged). Vancouver & Whistler and Quebec City & Montreal stay as they are for now (owner decision; the grain rule's season test should be read per interest,
"do the two halves contradict on the same interest", so a place with a summer and a winter peak is fine). Splits agreed in principle: Egypt into Cairo & the Nile and Red Sea;
Tanzania into a northern place (Serengeti, Ngorongoro and probably Kilimanjaro) and Zanzibar (Serengeti, Kilimanjaro and Zanzibar all avoid the March to May rains, so the split rests
on base and decision, not season). Pending: Thailand (Andaman coast with Khao Sok vs Gulf islands with Surat Thani; Andaman best Nov-Apr, Gulf Jan-Sep), Vietnam (two-way: North vs Central & South,
then Central vs South). Nothing created yet; each split needs a new place row and per-interest authoring.

Batch 4 (2026-10-07, `scripts/rename-batch4.ts`): thailand renamed "Phuket & the Andaman Coast" (includes Khao Sok); tanzania renamed "Northern Tanzania" (scope: full Arusha safari
circuit; safari focuses on Serengeti and Ngorongoro; landscape includes Lake Manyara and Tarangire; birding includes Tarangire and Arusha National Park; Zanzibar removed). Future places added to the
diving and snorkeling list: Koh Samui & Gulf Islands, Zanzibar. 19 to-dos created and 27 re-check items updated. Heads-up: Northern Tanzania still carries Zanzibar-based beach, diving,
whale, surfing and wind scores until those interests are rewritten or set N/A. Specialist ("gated") places BUILT (12 Oct 2026) as two columns on the admin Places tab (Gated = Y, Gated for = interest chips); results list hides a gated place
unless the traveller's weight for one of its interests is >= 7 (GATE_MIN_WEIGHT in src/lib/scoring/gating.ts). Search still finds it. Not built from the proposal: teaser line,
"Unlocked by" badge, interest-page tab, preview-as tool, naming. No place is gated yet.

Whale watching run (7-8 Oct 2026), now complete: directive `prompts/whaleWatching/v3.md`; batch one (64 places, $2.20) and batch two generated, reviewed by the owner and applied; 124 places are live and the rest are N/A (74 ids on the skip list). Details of the individual rounds are in the sections below and in the review artifacts.


## Species-name emphasis (added 7 Oct 2026)
- Done first for safari text (whale watching since added, see the updates below). Names are stored as `**Name**`; the public card shows them semibold and a touch darker (option 1). Rule: bold a specific species name only when it is written with a capital letter (African wild dog, Grant's gazelle, Bengal tigers); not lowercase names (lions, elephants), groups (raptors, dolphins) or place names.
- Code: `src/lib/text/emphasis.ts`, `EmphasisText` in `ForYouTab.tsx`, `.species-name` in `results.css`; the checker ignores markers and rejects unbalanced ones. Marking is done by a fixed word list, no AI: `src/lib/text/species-marker.ts` (rule: bold a name when a reader would picture one kind of animal, lowercase included: lions, elephants, hippos; not groups like monkeys, antelope, big cats, predators). `scripts/mark-species-names.ts` runs it and prints what it marked and left. Judgement calls currently bold: rhinos, orangutans, crocodiles, caimans, zebra.
- Update 9 Oct 2026: new text for safari and whale watching is marked automatically on apply (see the evening update below). Live marker counts: safari 17 of 17 places, whale watching 120 of 124, birding, wildlife, diving and beaches 0. Still to do: word lists for birding, wildlife and the other animal interests; the admin screens and exports show the raw `**` (fine for editing, but decide if the admin should render it).

## Whale batch two review follow-ups (7 Oct 2026)
- Place redo after the primary pass: fold Kaikoura into Marlborough & Abel Tasman (under 2 hours from Blenheim). Rename and rewrite all interests for the wider scope.
- Marrakech & Atlas is N/A for whale watching (on the skip list).
- DECIDED and done: the score decimalizer no longer runs when all twelve months share one blurb (flat score instead). Buenos Aires and Colombian Caribbean (whale watching) are now flat too (checked 9 Oct 2026).
- DECIDED and done (prompts/whaleWatching/v3.md): weather rule for the whale directive: ordinary rain costs nothing; a season where trips run but conditions are clearly poor scores 10 to 30% below a calm month and says so; trips stopped stays at 40% or less.
- DECIDED and done: Milford Sound flat 3.5, 3.2 in Dec and Jan.
- Quebec City & Montreal and Tokyo & Kyoto give a distance from a city in the place name to a spot outside it. Left as is; the new joined-name check flags them.

## Species-name emphasis, update (7 Oct 2026, evening)
- Rule added: each animal is bold once per blurb (first mention only), whatever name it appears under: "Greater one-horned rhinos ... rhinos" bolds only the first. Different kinds stay separate (black rhinos, white rhinos).
- Whale watching is now marked too (111 places live), including lists like "humpback, minke, and fin whales". Bare "whales", "dolphins", "porpoises" stay plain.
- New text is marked automatically when a generation is applied, for the interests in `EMPHASIS_INTERESTS` (src/lib/text/species-marker.ts): safari and whaleWatching. Add an interest there once its word list is ready.
- Still to do: birding, wildlife and the other animal interests (each needs its word list); show the bold in the admin screens.

## Whale columns, second fill (7 Oct 2026, evening)
- Drafted species, boat style and draw for 41 places that had gaps, and a 0-10 seasickness rating for all 124 whale places that are not N/A (scripts/seed-whale-fill-2.ts, data in scripts/data/whale-fill-2.json and whale-seasick.json). Not source-checked. Completeness 68 to 80.
- Still blank: Encounter closeness (all 124 places, worth 4 points) and source checks (10 points).
- Cambodia's species was researched in the whale source check (Kratie on the Mekong, Kampot). Myanmar and Phuket may still say "Dolphin, species not confirmed" (not re-checked 9 Oct 2026).
- The 52 stale birding and wildlife staged rows were discarded (marked invalid) on the owner's say-so.

## Whale source-check pass (7-8 Oct 2026) - fixes applied, rest pending
- All 124 places checked online (47 confirmed, 48 partly, 18 corrected, 11 not verified). 95 column cells set, every place ticked source-checked, sources and review entries saved (scripts/apply-whale-check.ts).
- 8 Oct: owner approved the callout lists. 31 places rewritten or fixed live (scripts/whale-source-edits.ts, edits in the session scratchpad), New Orleans marked N/A and added to docs/whaleWatching-clear-na.json (74 ids). Second look overruled the first pass for Okinawa (Naha tours exist), Hokkaido (Muroran trips exist), Cape Town (Heaviside's real), Sardinia (Alghero trip exists), Puglia (Taranto departure real), NYC; corrections logged as review entries (scripts/whale-source-check-followup.ts). Cambodia now covers Kratie (Mekong) and Kampot. Nicaragua has both seasons (northern Jan-Apr peak, southern Jul-Oct peak Aug). Tierra del Fuego scoped to Ushuaia only.
- 8 Oct round two: Antarctica, Monterey, Svalbard, Nice, Mauritius, Greenland, Tuscany, Mallorca rewritten after a second search; Skye, Palawan, Bali, Belize left as written because the second look supported them (review entries logged, scripts/whale-source-check-followup2.ts).
- 8 Oct round three: Azores (sei Apr-May, summer led by sperm whales), French Polynesia (Jul-Nov, Oct peak), GBR wording, Falklands (Stanley boats real; orcas at Sea Lion Island), Komodo, Charleston, Croatia, Maldives, Okinawa edge months fixed; Taiwan left as written (scripts/whale-source-check-followup3.ts). The whale source check is finished. Remaining: Kaikoura fold-in into Marlborough & Abel Tasman; optional Skye winter humpbacks.

## A vs B onboarding questions (7-9 Oct 2026)
- Done: plan and 51-interest worksheet; 5 pilot questions each for wildlife, birding, whales and safari (artifact "A vs B Pilot Questions"); a branching whale tree; question-tree and admin mockups ("Question Tree Mockup": storage as one row per question plus a frozen publication, a Questions tab on each interest page, a global style-questions page); the onboarding prototype uses the real questions and a pick animation (the sphere versions are separate artifacts).
- Decisions needed: approve the method and the "no column, no question" rule; the question budget (5) and lean steps; skip routing; who publishes; whether Claude drafts questions; move the five repeating style lines to be asked once; must-haves as tick-boxes; strength of the ranking nudge. Not built in the real app yet.


## Admin editing build (13 Oct 2026)
Made editable (all untested on screen; type-check, lint and 466 tests pass, public page verified in the browser): Places grid (name, primary and published switches, parent, summary, country, continent, region label, lat/long, stamp design; retired places under "Show retired"; /admin/destinations/new for new place and merge), place profile (seasonal hazards, tier, N/A with required reason), Interests x Places and interest page N/A reason box, seasonal flags copy and bulk, cost item columns (category, top of range, season, currency, source, verified), advisories (source link, re-check date, reviewed today), Interests list (name, domain, shown or hidden, audience tier, order), interest page (place link, overview and monthly text, apply or discard staged draft, mark N/A, scope and Gemini notes columns, Rules tab lists, the places allowed a 10), Future places (inline stage, grain, place type; order; promote to place), to-dos (place link, close on apply, priority, bulk actions), pass prompt version, reference-site auto count, Cards list inline, /admin/dna (domains, subdimensions, dimensions, insights), /admin/personas. Migrations 0037 to 0041.
Not built: cell states (waiting on a choice between the two mockups), a to-do "owner" field (status already says who), moving content when merging places.
