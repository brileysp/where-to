# To do

Work we've decided on but not built. Newest items at the top of each section; move to
"Done" (or delete) when shipped.

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
- beachesSwimming: content done (129 places, 4 batches, Sep 2026). Still open:
  - Specialist-lens review (playbook §1 Step 5) not done — skipped given the scale (129 places).
    Real bugs were still found and fixed along the way (10 temperate-water destinations scored flat
    year-round; Rio/Sydney/Galápagos had their real season inverted), so a review pass may well
    surface more — worth doing before calling this interest fully closed.
  - Extend the Catalog Wishlist artifact with a beaches list — not done.
- Remaining swim-formula interests to author: sailing, kayakingRafting.
  (Note: beachesSwimming and hotSprings, both swim-formula, and auroraChasing, culture-formula, are
  all now done — don't run sailing/kayakingRafting immediately back to back with each other either,
  per the playbook's repetition rule.)
- nationalParks: not an interest. Revisit as a tag / type of place.

## Cost-item tracking follow-ups (added 2026-09-21)
- Visually verify the Cost Items screen (new Last updated / By / What changed columns, "Never edited by a human" filter) — needs a signed-in browser session.
- Build the cost-checking agent: it should save edits with kind `'agent'` (see `src/lib/admin/cost-item-stamp.ts`); the grid already shows a 🤖 for agent edits.
- Only edits made through the admin panel are tracked; script-authored items show "Never edited".
