---
name: research-a-column
description: Research and score the data columns of a "Where To?" interest (golf, camping, mountain biking and the like) so every value is a formula on published data or a sourced fact, with an evidence line per cell. Use when asked to research, fill, score, check or redo columns for an interest or place set, before any seeding or wiring. Not for writing place text (that is the Gemini pipeline) and not for wiring chips or questions (use wire-up-a-column).
---

# Research a column

The owner is non-technical and has rejected made-up numbers more than once. Everything below follows from one rule: **a cell is a formula on published data, a quoted fact with a source, or blank. Never memory, never judgment.**

Read `docs/matching-model.md` once if you have not seen how columns feed chips and questions. The FactDef shapes are in `src/lib/admin/interest-pages/config.ts` (see THEME_PARKS_FACTS and GOLF_FACTS as models).

## 1. Before touching data

- Name every column the interest needs and which chip or question reads it. Columns that nothing reads are not built.
- For each rating write a **scoring rule** first: the stated formula, the tier table, and 3 to 5 **anchor places** with the value they must get. Anchors go in the column hint and in a test.
- Standard tables (reuse them, do not invent new ones):
  - Counts: 0 gives 0, 1 gives 2, 2-3 gives 3, 4-6 gives 4, 7-10 gives 6, 11-20 gives 8, 21 or more gives 10.
  - Kilometres: none 0, under 20 gives 2, 20-50 gives 4, 50-150 gives 6, 150-400 gives 8, over 400 gives 10.
  - Show the owner the table in plain words; they review rules, not code.
- Say what is **not** measurable and propose blank or a hand-research column, never a guess.

## 2. Which places and where "inside the place" ends

- Use `scripts/dump-places-geo.ts` to write `places.json` and `lat.json` (see data-sources.md). Skip places where the interest is N/A (`naSliders`).
- **Own-area rule (owner, 26 Oct 2026):** a facility counts only if it belongs to the place. Radius from the centre point by place type: city 35 km, region and coastal area 60, national park and wilderness area 40, state, island and country 100. Never across a border or water.
- **Named second hubs:** when a place's name lists another location outside that radius (Vancouver & Whistler, Banff & Jasper, Quebec City & Montreal), add it as an extra base (`BASES` in `scripts/geo.py`), as for Tokyo & Kyoto (120 km from two bases) and Taiwan (a whole country). Flag it to the owner; this was a question to them, not a silent choice.
- Look at the place's name, not just its centre point: several centres are midpoints in empty country.

## 3. Sources, in order of preference

See `reference/data-sources.md` for the commands that work. In short: Overture Maps (DuckDB) for places and land use, OpenStreetMap through the QLever planet service for tagged features (the Overpass servers are often down), Wikidata/Wikipedia for lists and events, GeoNames, Natural Earth, Open-Meteo for climate and elevation.

Hand research (park, government or operator pages) for anything legal or practical: one source per place, a quoted fact, a confidence tag (high = official page, medium = several agreeing non-official, low = single or unclear).

- Prefer the authority's own domain (`allowed_domains` on a search, or WebFetch the page and quote the sentence). A blog result alone is "low" or blank.
- Check that a cited URL loads (curl with a browser User-Agent; 403 is usually a bot block, 404 is a real problem).
- Leave a cell blank when only blogs and forums turn up. Say so in the evidence line.

## 4. Thin data means blank, not zero

Mapping coverage is uneven (rich in Europe and North America, thin in much of Africa and Asia, habit-driven for tags such as backcountry=yes). Rules used so far:
- Fewer than about 10 mapped sites, or under 20 km of graded trail: leave the columns blank ("too few to trust").
- Zero is allowed only where absence is reliable (for example no lifts mapped at all, lifts being thoroughly mapped).
- A positive count is always real evidence; a low count in a thin region only lowers a rating.
- Cross-check against one known truth (for example Denali has six campgrounds on nps.gov, the map shows two). Put such cases in the outliers.

## 5. Evidence line per cell

For every place and column write one sentence: the count or figure, the source, the tier it gives, and any caveat. Join them as `Label: sentence` lines in an `evidence` text column (max length 4000; a `drawSourceChecked` tick stays false). Write the same data to `docs/evidence/<interest>-evidence.json` and the flat values to `scripts/data/<interest>-facts-draft.json`.

Deviations from what the owner approved (a tighter radius, a coarser source, a changed meaning) are stated in the column hint and listed for the owner. Examples already made: scenic courses use a 1 km coast line, not 500 m; How remote is straight-line distance to a town, not from a road.

## 6. Checks before anything is saved

Write `tests/data/<interest>-evidence.test.ts` (copy `golf-evidence.test.ts`): no gaps (every place and column has an evidence line, left-blank cells say "Left blank"), the saved file matches, the anchors hold, tiers match the counts parsed from the evidence text, and sourced choice values match the research file. Then run `npx vitest run tests/data` and `PLACE_ROWS_SNAPSHOT=1 npm run truths`.

## 7. Outliers first

Before showing the owner anything, list the surprising cells: the highest-scoring places with blank or tiny values, places that tie at the cap, ratings that contradict a known fact, and counts that look inflated. Put them first on the review page (see the review-artifact practice: a full artifact with complete text and a decision button per item, never a chat summary).

## Do not

- Run Gemini or any paid service without telling the owner the places and cost first.
- Fill from memory "to get a first draft". If a source cannot be found, the answer is blank plus a to-do.
- Push to the remote. Commit locally with the trailer `Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>`.
- Leave `scripts/_*.ts` or `public/_*.html` temp files behind.

When the research is done, continue with the `wire-up-a-column` skill.
