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

- hotSprings wrap-up: log sources (`scripts/log-hotsprings-sources.ts`), extend the
  Catalog Wishlist, mark hotSprings done in the playbook §7.
- Remaining swim-formula interests to author: sailing, kayakingRafting, beachesSwimming.
- nationalParks: not an interest. Revisit as a tag / type of place.
- Uncommitted: grouped monthly-blurb slideout, admin load-speed cache
  (`primary-place-rows.ts`), Advisories-tab and Sources-column reorder.
