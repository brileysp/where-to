# Authoring handoff: decimalizing the remaining interests

Written 2026-09-24 for a fresh session (intended for an Opus authoring chat) so it can pick this
work up without the previous conversation. Read this first, then
`docs/interest-content-authoring-playbook.md` §1 Step 6 (the "Decimal & consistency audit",
"Resolution check" and "How to decimalize" bullets).

## 1. Why this work exists

The user's goal is a **useful ranked list per interest**. In the app, choosing an interest and a
month shows every destination ranked by that interest's monthly score. An earlier "retrofit"
fixed text/score contradictions but left ~85-100% of monthly scores as whole or half numbers, so
those lists were walls of ties (four places at 9.0, five at 8.0). The user's words:

> "looks like you did a bad job at the primary goal of that last big review, which was to get
> away from only whole numbers which result in a useless 'rank' list by interest."

Text does **not** need redoing. Only the numbers do. Fixing flagged months does not decimalize an
interest; the resolution check does (see section 5).

## 2. Status

Measured with `npx tsx scripts/audit-score-resolution.ts` (coarsePct = share of monthly scores
that are whole/half numbers; top20distinct = distinct values among the top 20 places in an average
month, max 20; targets: coarsePct under ~30%, top20distinct at least 14).

| Interest | Places | Before | After | State |
|---|---|---|---|---|
| wildlifeViewing | 200 | 94% / 6.8 | 27% / 13.5 | **done** (`decimalize-wildlife.ts`) |
| wildflowerBlooms | 40 | 100% / 6.8 | 47% / 12.0 | **done** (floor is legit flat 2.0 off-season) |
| windSports | 42 | 95% / 7.6 | 37% / 15.9 | **done** |
| surfing | 89 | 91% / 5.4 | | **todo** |
| hotSprings | 27 | 90% / 7.3 | | **todo** |
| birding | 200 | 90% / 5.3 | | **todo** (28 places already have full overrides) |
| beachesSwimming | 129 | 87% / 5.9 | | **todo** |
| diving | 98 | 85% / 7.8 | | **todo** |

Optional later: whaleWatching (64% coarse, 96 places) and the ~30 interests that were never in the
retrofit (fishing, food, hiking, etc., all 76-99% coarse). Mountaineering, aurora and safari are
already decimal-rich; leave them.

## 3. The user's rules (learned by being corrected; follow all of them)

1. **10s are per place, not per catalog.** The rule (playbook Step 6) is: a literal 10 goes to a
   place's narrowest best 1-3 months (4 for a two-season place like Uganda). I first made only one
   10 in the whole catalog and was corrected: *"Why would there be only 1 10? What did I say before
   about how many 10s felt right?"* Each interest's anchor list (`src/lib/scoring/anchors.ts`, the
   closed list of places allowed to hold a 10; `npm run db:audit:anchors` blocks any non-anchor at
   10) is the pool. A peak whose text repeats over 4+ months gets 9.x instead, or split the text so
   the 10 sits on 3 months (done for Okavango: see `decimalize-wildlife.ts` `text`).
2. **Caliber, not just shape.** Rank places against each other within a tier and give each its own
   peak decimal. Keep shifts to about +/-1 of the old peak so no earlier tier judgement is
   overturned, unless the user asks for more.
3. **Do not double-credit one claim across interests.** Wildlife: land beats sea, because diving,
   snorkeling and whale watching are their own interests (the same goes for birds). The user:
   *"land wildlife should rate higher than marine life since we have snorkeling and diving, and
   whale watching, as well. Sort of like birds, marine life counts but not as high as land animals.
   ... [Raja Ampat is] already a 10 in another one."* This is a wildlife-only rule. It does **not**
   lower diving or beaches (an earlier message of mine implied it did; that was wrong). In diving,
   marine life gets full credit.
4. **Regional pinnacles are not global ones.** *"Yellowstone and Denali may be the pinnacle of
   wildlife viewing in North America but they are not really comparable to peak Africa safari
   wildlife."* Apply the same lens elsewhere: judge every place against the global reference for
   that interest, not against its region.
5. **Off-season means low.** If a blurb says "outside the season", the score must be low, not 6.
6. **Same text, same score.** Identical blurbs carry identical scores; a distinct, lesser blurb
   must not be tied to the peak.
7. **Voice/content rules** (from earlier work, still binding): overviews short with few place names;
   no travel advisories in slider text; hedge unverified facts; do not invent specifics (a Cornwall
   blurb once named a specific buttress the research never supported).
8. **Show the ranking before writing** for the first interest at least. The user corrected the
   direction three times on wildlife (10s, marine, Serengeti/Okavango/Svalbard), so present a
   `--dry-run` summary (top-30 for two contrasting months, the literal-10 holders, and the calls
   you are unsure about) and wait for a go before the real run. After that direction is confirmed,
   the user is fine with "apply, then report the real calls at the end".

## 4. Tools

| File | Purpose |
|---|---|
| `scripts/decimalize-runner.ts` | Shared engine. Takes a config; harmonizes tight identical-text groups, scales each place to its caliber, sets literal 10s, optional off-season mapping and text rewrites; prints top-30 for a month and the 10-holders; writes `scoreOverrides[key]` in a transaction with an `adminAuditLog` row. Flags: `--dry-run`, `--redo` (undo this script's previous write first so scaling never compounds), `--month N` (1-12, which month's top-30 to print). Also prints how many places differ from what is currently written. |
| `scripts/decimalize-wildlife.ts`, `-wildflowers.ts`, `-windsports.ts` | Finished examples. Copy the shape: a `caliber` map (one target peak per non-NA place), optional `tens`, `custom`, `flat`, `set`, `text`, `offSeason`, `skip`. Every non-NA place must be in `caliber` or the run stops and lists the missing ids. |
| `scripts/dump-interest-scores.ts <key> [--text]` | Every non-NA place for one interest, ranked by peak, with 12 live monthly scores; `--text` also lists each distinct blurb and the months sharing it. This is your input for deciding calibers. |
| `scripts/audit-score-resolution.ts` | The measure of done. |
| `npm run db:audit:anchors` | 0 `over` required (a non-anchor at 10 blocks). `under` lines are informational. |
| `npx vitest run` | Must stay at 304 passing. |

Math, for reference: `new = old + (target - oldPeak) * (old / oldPeak)^2`, rounded to 0.1 and capped
at 9.9 (literal 10s only via `tens`). Identical old scores stay identical; the peak lands on the
target; weak months barely move. Antarctica-style hard-10 seasons with closed months go in `skip`.

Workflow per interest:
1. `npx tsx scripts/dump-interest-scores.ts <key> --text` and read the anchors entry for the interest.
2. Write `scripts/decimalize-<interest>.ts`: rank places within each old-peak tier, assign each a
   caliber decimal (unique to 0.1 where you can; ties are acceptable in low tiers), choose `tens`
   for anchors only, fix any text/score contradiction the dump reveals (rewrite the text in `text`,
   with its score in `set`), and use `offSeason` if off-season months score well above zero.
3. `--dry-run --month <a>` and `--dry-run --month <b>` for two contrasting months; sanity-check the
   ranking against what an enthusiast would say. Show the user (see rule 8).
4. Real run, then `npm run db:audit:anchors`, `audit-score-resolution.ts`, `npx vitest run`.
5. Add an anchor only if a place is clearly the reference for that interest (Amsterdam for
   wildflowers was added this way, with a comment). Remove an anchor when its 10 is no longer
   defensible (Raja Ampat and Denali were removed from wildlife).
6. Update `docs/interest-content-authoring-playbook.md` if a new rule emerges, and the memory note
   `wheretoapp_decimalization_pass.md` with the new coarse/distinct numbers.

## 5. The remaining five: what to know for each

Anchors are the only places allowed a literal 10.

- **surfing** (89 places). Anchors: bali, maui, lisbon. Definition: "A world-reference wave."
  Caliber should reflect named-wave world status (Pipeline-class, J-Bay-class) over "good beginner
  beach". Surf is spot-specific like windSports; expect single-spot blurbs.
- **hotSprings** (27 places). Anchors: iceland, budapest, hokkaido. Definition: "A world bathing
  culture." Small set, so this one can go quickly.
- **birding** (200 places; 28 already have full 12-month overrides from `author-birding-*.ts`).
  Anchors: colombian-andes, peru, ecuadorian-andes, peruvian-amazon, papua-new-guinea, madagascar,
  kenya, uganda, tanzania. Definition: "A destination birders travel across the world for: top-tier
  species counts, endemism, or a bird nobody sees anywhere else." Use the birders' lens (the user:
  *"keep in mind the birds that birders care about"*, e.g. antpittas, mountain toucans, not just
  toucans and quetzals). `scripts/audit-birding-model.ts` holds a first-principles model (species
  count, endemism, charisma, spectacle); use it as an input for caliber but not the only one.
  Because 28 places already have overrides, the first run of the decimalize script reads those as
  the "old" values, which is what you want.
- **beachesSwimming** (129 places). Anchors: turks-caicos, maldives, borabora, seychelles, bahamas,
  barbados, palawan, fiji, maui, mauritius. Definition: "Among the best beaches on earth to
  actually swim from." Beaches are swim-quality, so cold-water and temperate places sit low even
  when scenic; the retrofit already fixed several inverted seasons (Galapagos, Rio, Sydney), so
  trust the shape and rank on caliber. Large set, so plan for a long caliber table.
- **diving** (98 places). Anchors: rajaampat, palau, gbr, galapagos, egypt, maldives, komodo,
  borneo, belize, fiji. Definition: "Among the best reefs or marine encounters on the planet."
  This is the home for marine life, so give it full credit here. Just check a place is not
  riding on a claim another interest already tops (e.g. Raja Ampat and Komodo are 10-class here
  and deliberately moderated in wildlife).

## 6. Judgment calls made without explicit sign-off (the user has not reviewed these)

Review these if the user raises them; each is easy to change and reapply with `--redo`.
- Wildflowers: Amsterdam added to the wildflower anchors and given a 10 (April); Tokyo & Kyoto,
  Cape Town, Canaries and Glacier each hold a single-month 10; Provence 9.6, Hokkaido 9.0.
- Wildflowers off-season baselines for 15 places were compressed toward 2 (was 4-6 in months the
  blurb calls "outside season"). Formula in `decimalize-wildflowers.ts` (`offSeason`).
- Wind sports: Aruba's Oct-Dec blurb was rewritten ("Lighter trade winds ... just short of the
  year's best.") because those months shared one blurb with Jan-Apr but scored 7 vs 9. Aruba,
  Le Morne and Essaouira stay just under 10 as originally authored; Tarifa, Ho'okipa, Sotavento
  hold 10 for June-August and Cape Town for Dec-Feb.
- Wildlife: Galapagos flattened to 9.7 (its 12 months share one blurb); Kenya's off-migration months
  hand-set to 9.5 (custom curve); Okavango June and October blurbs rewritten (scores 9.5) so its 10
  sits on Jul-Sep; Svalbard 8.8 (cruise-based, bears not guaranteed); Raja Ampat and Denali removed
  from the wildlife anchor list; Komodo 9.0 with no 10.
- Wildlife/wildflowers only merge identical-text groups of up to 4 months spreading at most 0.55;
  larger groups are treated as generic baseline text and left alone.

## 6b. Carried-over open decisions from mountaineering (not part of this task, but pending)

- Joshua Tree and Kilimanjaro were lowered (9.0, 8.9); Mendoza 9.1, Ecuadorian Andes 8.7,
  Barcelona 9.0, Thailand 8.6 (Step 5 review). Kilimanjaro might still look high next to Ecuador's
  real glacier climbs; the user said "sure" to 8.9.
- Mountaineering is finished (Steps 1-7; Catalog Wishlist has a 39-place climbing list).

## 7. Two-chat workflow (user's idea)

The user may run a second chat on a cheaper model for engineering work in the same repo. The two
chats share the repo, the database and the memory folder, but not conversation history. To avoid
collisions:
- One chat owns one interest at a time. Never have both write `scoreOverrides` for the same key.
- `--redo` finds this script's previous write by looking at the place's **latest** audit-log row.
  If anyone else wrote to a place after the decimalize run, `--redo` will not find it and will
  re-scale on top of the current values. Do not run other writers between a decimalize run and
  its `--redo`.
- Commit nothing unless the user asks (the repo is not a git repository right now).
- Keep decisions in files (this doc, the playbook, memory), not only in chat.

## 8. Kickoff prompt to paste into the Opus chat

> You are continuing a decimalization pass in the Where To? app at
> `/Users/brendansalant-pearce/Desktop/Claude Code/where-to-app`. Read
> `docs/authoring-handoff-decimalization.md` fully, then
> `docs/interest-content-authoring-playbook.md` §1 Step 6, then the memory note
> `wheretoapp_decimalization_pass.md`. Do the interests in this order: surfing, hotSprings,
> birding, beachesSwimming, diving. For each: dump the data, write
> `scripts/decimalize-<interest>.ts` following the finished examples, dry-run two contrasting
> months, show me the ranking and the literal-10 holders and your unsure calls, and wait for my go
> before the real run. Keep 10s per place (1-3 best months), never lower diving/beaches for the
> land-over-sea rule (wildlife only), and do not invent facts in any blurb you rewrite. After each
> interest, run the anchor audit, the resolution audit and vitest, and update the memory note.
