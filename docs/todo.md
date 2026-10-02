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

**Next interest: birding.** `prompts/birding/v1.md` is written (2026-10-01), adapted from
wildlifeViewing v5 — see the file's own header comment for the full list of what changed
(scope inverts to birds-only, scoring model replaced with birding's existing
first-principles anchor model from `scripts/audit-birding-model.ts`, jargon line
recalibrated for birding's specialist audience tier, new worked example). Birding already
has an anchor "ten" list and extensive content from the old pre-Gemini manual authoring
scripts (`scripts/author-birding-blurbs-batch*.ts`) — this directive is meant to replace
that content through the same pipeline, not start from nothing. Not yet run.

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

Current status (updated 2026-09-30): `wildlifeViewing` — v1 batch of 14 (Acadia-Azores)
produced 12 valid/2 rejected, only Andalucía and Acadia applied (v1). **Superseded by
v2** (`prompts/wildlifeViewing/v2.md`, the user's own "Wildlife Viewing Authoring
Directive") — re-ran the same 14 places under v2 on 2026-09-29: 14/14 valid. User
reviewed all 14 via a published artifact (full old-vs-new content, not a chat summary —
see the standing content-review preference below), requested hand-edits to 8
overview/intro blurbs, and asked for Azores' score curve to be rescaled down. **All 14
are now LIVE** (applied 2026-09-30):
- 8 with hand-edited overviews (Acadia, Antarctic Peninsula, Arches & Canyonlands,
  Algarve, Amsterdam, Angkor Wat & Siem Reap, Argentine Lake District, Atacama Desert) —
  applied via `applyGeneration` (curve/monthly content from Gemini) then a follow-up
  human-edit patch for just `sliderOverview` (via `applyAdminEdits` with the real admin
  actor, not `SYSTEM_ACTOR`), so provenance correctly shows "written by Gemini, then
  edited by [human]" for these 8 overviews.
- 5 applied exactly as generated, no edits (Amalfi Coast, Andalucía, Aruba, Aspen,
  Athens).
- Azores applied with every month's score scaled down (peak 8.2 → 6.5, same shape) per
  the user: whale-watching-specific destinations shouldn't peak this high on the general
  `wildlifeViewing` interest — that's what the dedicated whale-watching interest is for.
  Text unchanged. Built by hand-fitting `fitMonthlyToCurve` on the rescaled array rather
  than Gemini's raw output — see the (deleted) `scripts/_tmp-apply-remaining-six.ts` for
  the pattern if this needs repeating for other over-peaked destinations.

Also fixed while building v2 support: `anchors.ts`'s wildlifeViewing `ten` list still
allowed Pantanal a literal 10, conflicting with v2's explicit placement of it in the
8.5-9.0 tier — removed. 14 (batch A) + 24 (batch B) = 38 of ~200 places done. ~162 still
need (re-)generation for this interest before it's "fully generated" and the standing
review above should happen.

Third v3 batch — 18 places whose id starts with "c" (`--prefix=c`), batch id
`78f6ef3d-9839-4cda-bda3-afd39effe0cb`, cost $0.23. Went through three review rounds
before going live, each via the full-content artifact:
1. Overview tightening pass across most places, plus rule fixes: Copenhagen's
   fallow/sika deer marked introduced (red deer stays native), Cotswolds' muntjac
   flagged introduced (it's a UK invasive, was breaking the native/reintroduced honesty
   rule), Cornwall's red-billed chough cut entirely (not a marquee bird, doesn't belong
   outside the birding slider), Chiang Mai's captive-elephant-sanctuary mention removed
   entirely. Cape Cod's and Cape Town's peaks trimmed (6.5→5.3, 7.5→6.8) for being
   overscored relative to their tier; Cape Town gained Cape Point's bontebok/eland/
   ostrich. Costa Rica's peak raised 8.6→9.1 (underscored for a top-tier destination)
   and gained the Osa's tapir superlative, Corcovado pumas, and a bird mention.
2. A real fact-check pass caught three errors Claude introduced in round 1: Chiang
   Mai's "night spotting reveals flying lizards" is wrong (Draco lizards are diurnal
   baskers, not a night-walk species — fixed to civets/flying squirrels only). Costa
   Rica's "squirrel monkey... across both coasts" is wrong (it's a Pacific-only
   near-endemic, restricted to Manuel Antonio/Osa) — reworded to state the total monkey
   count and name-check only the squirrel monkey. Chiapas' jaguar/tapir mentions were
   struck entirely, not softened — Montes Azules' population density doesn't support
   "ask a guide, get a decent shot" the way Osa does; this is a stricter bar than the
   "naturally elusive" framing used elsewhere (e.g. Belize), worth keeping in mind for
   future places with genuinely low-density megafauna.
3. Final round: Costa Rica's monkey count hedged to "four commonly seen" (real count is
   5, arguably 6) and gained a toucan mention (6 species, Caribbean-slope lodges/photo
   hides). Colombian Caribbean's peak raised 4.8→6.2 to sit above Chiapas' 5.8, given
   its critically-endangered cotton-top tamarin is a stronger draw than Chiapas' more
   generic monkey/crocodile profile.

All 18 now LIVE (applied 2026-09-30). 14 (A) + 24 (B) + 18 (C) = 56 of ~200 places done
for this interest.

v4 batch — 5 places whose id starts with "d" (`--prefix=d`), batch id
`05d57cf9-0623-4661-983e-be521a1fa87a`, cost $0.06. All 5 valid on the first pass. All 5
now LIVE (applied 2026-09-30) — Denali & the Interior, Dolomites, Douro Valley & Porto,
Death Valley, Dubai. 61 of ~200 places done.

**v4 -> v5**: user asked to loosen the length budget after Death Valley's first draft cut
a real viewing tactic (the dawn/dusk instruction) just to hit the 220-char cap — the
budget was too tight, not wrong in principle. Loosened ~25-30% across every tier (see
validate.ts's `LENGTH_TIERS` and `prompts/wildlifeViewing/v5.md` §5) and added an
explicit rule: never cut a §2 "Viewing Requirement" to save characters. Also fixed a real
gap in the causality checker found via Falklands: "molt" wasn't a recognized
seasonal-driver keyword — added to `CAUSALITY_MARKERS`.

A full audit of the then-56 live A/B/C places against the new budget is saved as two
artifact versions (loosen-then-recheck) — **held, not applied**: the user disliked
several of the draft fixes and asked to hold them for later review rather than lock
anything in. Revisit when asked; don't retrofit A/B/C on your own initiative.

v4/v5 batch — 10 places whose id starts with "e" or "f" (run as two separate
`--prefix` batches, reviewed together in one combined artifact per the user's
"do 1 or 2 next letters depending on group size" instruction): batch ids
`8503239e-3321-460d-881a-6b1305672990` (E, 6 places) and
`88a0a4f3-d16f-471e-a971-c93615b318f2` (F, 4 places), cost $0.14 combined. Went through
several real review rounds before going live — content is NOT yet applied, still staged:
- Round 1 (Claude's proactive fact-check, before showing the user anything): all content
  checked out except Faroe Islands' peak (6.8, later confirmed by the user as too high for
  a single-marquee-species profile) — no factual errors caught here, a genuinely clean
  batch.
- Round 2 (user review): Ecuadorian Andes reordered to lead with Andean bear/mountain
  tapir over condors (per the user: Ecuador + Colombia are the two best places on Earth
  for both), "reintroduced" trimmed from every repeated vicuña mention down to once,
  real wild-avocado/spectacled-bear seasonality added to Aug-Sep (verified via web
  search: aguacatillo fruits Aug-Sep, sometimes into Dec, and reliably draws bears down
  from the cloud forest — see Maquipucuna-area sources). Edinburgh's introduced grey
  squirrels cut entirely ("common squirrel species are boring enough, but reintroduced
  ones? double boring"). Red Sea & Nile's crocodiles lost an unnecessary "wild" qualifier
  — species are assumed wild unless flagged otherwise, "wild" only earns its place for
  something commonly seen domesticated/working (camels, horses, elephants). Ethiopia's
  "gelada monkey" -> "gelada baboon" (the actual common/tourism name). Falklands' overview
  trimmed (a seasonality sentence that duplicated what the months already say). Faroe
  Islands rescaled 6.8 -> 5.0 peak and tightened. Fiji's crested iguana initially struck
  entirely (Yadua Taba turned out, per web search, to be closed to all but permitted
  researchers on a ~1-year application process — not tourist-visitable). Norwegian Fjords
  gained musk oxen at Dovrefjell (verified: a real, ~99%-reliable guided safari, Europe's
  only population outside the Arctic) alongside/ahead of harbor seals.
- Round 3 (user pushed back on two of Claude's round-2 calls): striking the Fiji iguana
  was WRONG — distinguished from Chiapas' jaguar because the iguana is Fiji's own
  namesake, found nowhere else on Earth, so it must be addressed even though unreachable,
  with the real access situation stated plainly. Restored with that framing. Also: the
  Ecuador rewrite was too close to the user's own literal phrasing from their feedback —
  "I didn't mean for you to just use my words," asked for genuinely fresh synthesis. Redid
  it, and separately fixed a real clunky-writing bug: the draft implied toucans and
  hummingbirds (day-active) were found on "night walks" alongside kinkajous and olingos
  (night-active) — split day/night species into separate clauses. Folded both lessons into
  **v5** as a new §2 exception (marquee namesake species always addressed, honestly, even
  if unreachable) and a new §5 rule (never blur day/night species together).
- Round 4 (more user edits, all applied to the staged drafts, not yet live): the user
  wrote the Ecuadorian Andes overview by hand and said to use it as the model for future
  blurbs — added verbatim as a new §8 "Worked Example" in v5.md, with notes on what makes
  it work (honest odds framing, a concrete viewing mechanism, clean day/night separation,
  and that running ~30% over its own length budget is fine here since every clause earns
  its place). Ethiopia reorganized so Walia ibex sits with gelada baboon (both Simien
  Mountains) and the Ethiopian wolf gets its own sentence (Bale Mountains, a different
  range) — also fixed a real bug: an earlier find-and-replace ("gelada monkey" ->
  "gelada baboon") had clobbered the capitalization of a sentence-initial "Gelada".
  **Lesson: a case-insensitive regex replace on prose needs to preserve the original
  capitalization, not just substitute a fixed-case string.** Fiji's Yadua Taba and
  Norway's Runde were both renamed to "Yadua Taba Island" / "Runde Island" — don't assume
  the reader has heard of an obscure place name; ground it with what it physically is.

G batch: generation failed twice with a Gemini API billing error ("prepayment credits
depleted") — the user's key ran out mid-project. User topped up credits but the retry hit
the identical error again (likely a propagation delay on Google's side, or credits added
to the wrong project) — **not yet resolved, G has not been generated**. Retry
`--prefix=g --limit=15 --prompt-version=v5` once the user confirms the balance actually
shows at ai.studio/projects.

Gemini billing resolved same session (credits took a moment to propagate on Google's
side — first retry after topping up hit the identical error, second retry went
through). v5 batch — G through M, done as three review rounds since the user reviews
in batches without necessarily applying each one immediately:

- **G** (9 places, batch `2c40ac42`) + **H/I/J/K** (16 places, batches `01eca358`/
  `7d1184f5`/`74f17a3a`/`f2a47893`), reviewed together in one combined artifact per the
  user's "do 1 or 2 next letters depending on group size" instruction. Real catch:
  Guilin & Yangshuo's draft built its entire profile around domestic water buffalo and
  captive fishing cormorants — neither is wildlife, a direct violation of §4's own
  "no domestic/captive distractions" rule that slipped past every mechanical check
  (nothing currently flags "is this species domestic/captive" automatically). Rebuilt
  around what's actually wild there (egrets, herons, bats). Two follow-up review rounds
  fixed word-economy issues (Galápagos overusing "virtually guaranteed", GBR/Great Smoky
  wordiness, Hokkaido's mammal-bird-whale-bird-mammal ordering), one geography-grounding
  fix pattern (don't name an obscure island — Yadua Taba, Runde — without saying what it
  is), a peak rebalance (Iceland 6.2→6.5, Ireland 5.2→5.0, richer destination should
  score higher), and two Sabi Sands/Kruger-style "here vs. the place next door" honesty
  additions. **All 25 (G-K) are now LIVE** (applied 2026-09-30, after being staged for
  a few turns while the user reviewed L+M first — a reminder that "reviewed" and
  "live" are separate states here and the user tracks them separately per batch).
- **L + M** (21 places, batches `7d92a8af`/`36b91749`) — combined per the "~20-25 without
  splitting a letter" instruction. Remarkably clean fact-check pass, only the mechanical
  causality gap 3 times (Lofoten, Madeira, Maui). One more review round: Los Cabos'
  peak trimmed 7.4→7.1, Madagascar's overview generalized "vangas" to "five entirely
  endemic bird families" (real, verifiable fact) and its peak raised 9.0→9.4, Madeira's
  Trocaz pigeon and Marlborough's king shag both cut (birding-section species, not
  general wildlife — the user's call, not a directive violation). **All 21 are LIVE**
  (applied 2026-09-30).

Running total: 156 of ~200 places live (A 14 + B 24 + C 18 + D 5 + E 6 + F 4 + G 9 + H 4
+ I 3 + J 3 + K 6 + L 8 + M 13 + N 10 + O 3 + P 15 + Q 2 + R 9). Worth remembering for
future batches: verify any
specific, checkable claim Gemini makes (a species' actual range, whether an animal is
genuinely nocturnal, whether a rare species is honestly "occasionally seen" vs.
oversold) rather than trusting fluent-sounding text — round 1 of this batch alone had
three real factual errors that read as completely plausible until checked.

**N-R batch (39 places) — all LIVE (applied 2026-09-30).** User asked for N through R
specifically (an explicit override of the usual ~20-25-place sizing convention, not a new
default). Five separate `--prefix` generation runs, one combined review artifact: batch
ids `d3bf6d1e` (N, 10 places), `adf6eca9` (O, 3), `1e94547a` (P, 15), `2d12bf52` (Q, 2),
`981e4793` (R, 9) — 39 total, cost $0.42 combined. Note the usual id/name mismatch:
`peru` → "Cusco & Sacred Valley".

Claude's proactive fact-check pass (all 39, before showing the user anything) found two
real issues and fixed both directly in the staged generation:
- **Provence**: a mechanical causality-checker false positive (Oct→Nov swing driven by
  falling temperatures triggering reptile brumation — a real, correct driver, but
  "temperature" itself was never stated as a word, so the keyword checker couldn't see
  it). Fixed by adding "As cooling temperatures deepen" to the November text; no content
  meaning changed.
- **Punta Cana**: a genuine content bug, the same domestic/captive-species violation
  caught in Guilin earlier this session. The draft presented rhinoceros iguanas as
  freely roaming residents of the "Indigenous Eyes Ecological Reserve" — but that
  reserve's iguanas are actually a captive breeding/reintroduction program (16 enclosed
  animals, verified via web search), not wild animals visitors encounter on trails.
  Rewrote around the real wild population at Parque Nacional del Este / Saona Island, a
  well-known Punta Cana day-trip — verified via web search that a genuine wild
  rhinoceros iguana population exists there. Also had to adjust the Aug-Oct
  hurricane-season fallback logic, since Saona (a boat trip) can't serve as the
  "still-accessible-when-boats-can't-run" backup the way a land-based reserve could —
  reworded those months to note both dolphin tours and Saona access are disrupted, with
  coastal birds as the remaining fallback.

User review, round 1 (9 places): Namibia/Nepal/New Orleans — dialed back "virtually
guaranteed" to reliable/regular/plentiful framing. Okinawa — cut the Okinawa rail
entirely (birding-slider material, not enough of a general draw). Palau — cut the
Micronesian megapode, rescaled the whole curve so peak lands at 7.0 not 7.4. Palawan —
swapped the peacock-pheasant for Palawan hornbill + white-collared/stork-billed
kingfishers, more recognizable to a general audience (verified the hornbill is real but
uncommon/vulnerable, worded as "occasionally spotted" rather than oversold). Panama — cut
the Darién jaguar/tapir line nobody realistically sees, added Geoffroy's tamarin and the
lesser capybara (verified: Central America's only capybara species, concentrated right
around Gamboa/the Canal zone, even timed its "more conspicuous" mention to the real rainy
season when that's actually true). Pantanal — verified current tour-operator data
supports 95%+ peak-season jaguar encounter rates; raised Jul/Aug/Sep/Oct accordingly and
sharpened the odds language. Papua New Guinea — rescaled down to a 7.0 peak (it's
primarily a birding destination, was scored too high).

User review, round 2 (9 more places): Peruvian Amazon — swapped "basic" monkeys
(howler/spider/squirrel) for brown capuchin/woolly monkey/emperor & saddleback tamarin;
cut vague tapir/peccary "elusive encounters" line for capybaras (genuinely common);
fixed the night-walk wording close to the user's own phrasing. Piedmont — user asked
whether Gran Paradiso is really part of Piedmont; verified yes, the park genuinely
straddles Piedmont and Aosta Valley roughly 50/50, no change needed. Puerto Rico — peak
5.2→4.9, dropped the verb "hosts" per user's note it sounds odd. Queenstown — cut the
longfin eel content entirely (nobody travels to see eels), replaced with an honest
"quietest stretch of the year" line rather than inventing a replacement species.
Raja Ampat — reordered overview and 7 identical months to lead marine-first,
birds-of-paradise last, since it's primarily a marine destination. Rajasthan/Ranthambore
— named the actual high-density tiger zones (2, 3, and 4, around Padam Talab and Rajbagh
Lake — verified). Redwood — moved marbled murrelets to birding-slider material; caught a
real taxonomy error Gemini made and Claude missed on first pass (the draft called a
banana slug an amphibian — it's a mollusk), fixed with the Pacific giant salamander
(verified present) plus a river otter mention (verified present). Rocky Mountain NP —
elevated bighorn sheep to a real headline detail (verified May-Aug Sheep Lakes
mineral-lick season is a genuine, well-documented spectacle), cut the black
bear/mountain-lion mention since nobody realistically sees them there. Rwanda — cut the
birding-endemics sentence (overview was long enough), gave golden monkeys their own
"shorter, cheaper, less strict permit" framing instead of bundling them with gorillas in
one breath.

Two patterns flagged to the user as possibly worth a broader sweep later (not acted on
beyond the specific instances above): the verb "hosts" ("X hosts Y") appears constantly
across nearly every place in this pipeline, and "virtually guaranteed" is still used a
lot outside the three places flagged this round. Revisit if asked.

Everything re-validated clean after every edit. **All 39 applied to `places`
2026-09-30** after the two review rounds above. Next batch after this one: continue
alphabetically from S.

**v3 directive shipped and already used for a real batch (2026-09-30).** All five fixes
below are live in `prompts/wildlifeViewing/v3.md`. Two are also hard-enforced by
`validate.ts`'s `BANNED_JARGON_WORDS` check ("cetacean", "ungulate"), not just requested
in the prompt text. `scripts/gemini-author-batch.ts` also gained a `--prefix` flag (filter
candidates by the start of their id) specifically to support "do the next batch
alphabetically" requests, since the script had no offset/skip option before — only ever
"the first N places by id".

First v3 batch — 24 places whose id starts with "b" (`--prefix=b`), batch id
`6c10bf1f-1848-4582-aa69-3fefbd5efa86`, cost $0.31 (unverified pricing). Reviewed via
artifact (full old-vs-new content), user asked for a general overview-tightening pass
plus specific fixes (Barbados species name + introduced-status honesty, Belize's
marine/land/marine structure and "jungles host" phrasing, Bend & Crater Lake's species
lead order, Bhutan's tiger/snow-leopard mentions with no real sighting chance, Bahamas'
scores rescaled from a 7.4 peak down to 5.1 to match its actual secondary-destination
tier) — Claude rewrote all 24 overviews directly (stamped as a Claude edit on top of
Gemini's draft, not a human hand-edit, since the user gave direction rather than exact
wording). **All 24 are now LIVE** (applied 2026-09-30), including the 3 that were
flagged invalid (Basque Country, Bavaria & Munich, Bordeaux) — all three were the
score-swing-without-a-cited-driver heuristic; Basque Country's curve was genuinely
smoothed (three separate jumps compressed into one real step-change matching where the
text actually describes calmer seas), the other two only needed a small wording tweak
("peak summer", "during the grape harvest") since their curves were already fine and the
checker's keyword list just didn't recognize the phrasing used. No banned-jargon or
fluff-phrase rejects across the whole batch — a good sign for the v3 wording changes.

Original patterns behind the v3 fixes, identified from a real word-for-word diff of
Gemini's draft vs. the user's edit for all 7 hand-edited overviews in batch A:
1. **Drop self-rating language from overviews.** Gemini keeps grading the destination in
   its own prose even though the score already does that job: "Arches and Canyonlands
   *offer modest* desert wildlife viewing", "The Algarve is *a secondary* wildlife
   destination", "The Antarctic Peninsula is *a globally elite* wildlife destination".
   Every one of these got cut or softened by the user (to a plain factual opener, or in
   Antarctica's case "iconic" instead of "globally elite"). v3 should explicitly ban
   tier-labeling adjectives in the overview ("modest", "secondary", "world-class",
   "elite", etc.) — state what's there, let the score carry the tier.
2. **Simplify jargon that slipped past the "zero fluff" rule.** "Cetacean sightings...
   during the operating window" → user's edit: "Whale sightings... on expedition
   cruises". "Native ungulates" → "Native deer species". Neither word is wrong, but
   both read like a field guide instead of a travel app. Add these as named examples of
   words to avoid, alongside the existing banned-phrase list.
3. **"Virtually guaranteed" is being used too loosely.** Angkor's long-tailed macaques
   went from Gemini's "virtually guaranteed year-round" to the user's "common
   year-round" — macaques being everywhere isn't the same as a can't-miss marquee
   sighting. v2 §2 needs a tighter line between "virtually guaranteed" (reserve for
   genuine signature encounters) and "common"/"reliably seen" (present but not the
   draw).
4. **Cut throat-clearing topic sentences.** The user deleted the Argentine Lake
   District's entire opening line — "offers a mix of native Andean-Patagonian fauna and
   introduced European species across its forests and eastern steppe margins" — before
   getting to any actual species. Add a rule: open the overview with the first named
   species, never a scene-setting sentence about the mix of fauna in general.
5. **No tier example for a single-species specialist.** Azores needed a manual rescale
   (peak 8.2 → 6.5) because its overview whale-watching draw got scored like a
   megafauna hub. v2's tier table has examples for generalist hubs (Denali, Pantanal)
   and clear secondary destinations (Acadia, Algarve) but nothing for "one excellent,
   narrow draw and not much else" — add "Azores whales" (or similar) as a named
   6.0-6.9 example.

## Admin screens: attributes with no home yet

Found by comparing the `places` columns and scoring code against what the admin reads/writes.

1. **Anchors, audience tier and formula on the Interests tab.**
   Columns: "Audience tier", "Formula", "Anchor destinations" (+ the anchor set's
   one-line definition). Today these live only in code (`SLIDERS` in
   `src/lib/scoring/constants.ts`, `INTEREST_ANCHORS` in `src/lib/scoring/anchors.ts`,
   `SWIM_SIGN_FLIPS` in `destinations.ts`), yet the anchors drive the
   `db:audit:anchors` gate and the formula family tells you how many interests a fix
   touches. Read-only display can ship first; editing means moving them into
   `interest_meta` (needs a migration).

2. **Authoring and audit status on the Interests tab and the Interests × Places grid.**
   - Interests tab: "Authored N of M places" plus count of N/A places.
   - Grid: status pill per row (authored / partial / empty / N/A) and a "Needs content" filter.
   - "Last audited" can be derived from the newest `addedAt` in `sliderSources`.
   - No new columns needed. Replaces the manual "Done" list in
     `interest-content-authoring-playbook.md` §7.

3. **Catalog Wishlist as a new tab next to Places.**
   Columns: candidate destination, interest(s), why it matters, overlap notes against
   existing catalog entries. Needs one new table. Today it lives only in a Claude
   artifact ("Catalog Wishlist"), separate from the catalog it feeds.

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
- Remaining swim-formula interests to author: sailing, kayakingRafting.
  (Note: beachesSwimming and hotSprings, both swim-formula, and auroraChasing, culture-formula, are
  all now done — don't run sailing/kayakingRafting immediately back to back with each other either,
  per the playbook's repetition rule.)
- nationalParks: not an interest. Revisit as a tag / type of place.

## Cost-item tracking follow-ups (added 2026-09-21)
- Visually verify the Cost Items screen (new Last updated / By / What changed columns, "Never edited by a human" filter) — needs a signed-in browser session.
- Build the cost-checking agent: it should save edits with kind `'agent'` (see `src/lib/admin/cost-item-stamp.ts`); the grid already shows a 🤖 for agent edits.
- Only edits made through the admin panel are tracked; script-authored items show "Never edited".
