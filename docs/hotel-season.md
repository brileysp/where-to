# Hotel price seasonality: storage and back end

Built 15 Nov 2026 at the owner's request: storage and back end only. Nothing a traveler sees reads this data, and nothing in scoring does (a test enforces the first). Design page and review page: see the memory note `wheretoapp_hotel_season_prices`.

## What is stored

- `place_hotel_quote_runs` (evidence, admin only). One row per place, kind of hotel and collection run: the search term, how the panel was chosen, the 14 stay dates, how many hotel-type properties Booking.com listed each night, and every panel hotel with its 14 prices (null = no price that night). A new run is a new row; at most one run per place and kind is `is_current`.
- `place_hotel_season` (summary). One row per place and kind, computed from the current run: `summary` (jsonb, about 350 bytes), plus `flags`, `swing` and `as_of` copied out for listing, and `overrides` for a hand-set flag. It is in its own table, not on `places`, so it stays out of the place-row download and the disk snapshots.
- Both tables have row-level security on and no public read.

## The summary (`HotelSeasonSummary`, `src/lib/hotel-season/types.ts`)

`months` (Jan to Dec index, 100 = a typical month for the place's luxury hotels, null when fewer than 3 hotels had a price), `monthsN` (hotels behind each month), `holiday` (29 and 31 Dec index and counts), `thinMonths`, `closedMonths`, `flags`, `panelHotels`, `listedHotels`, `levelUsd` (typical nightly price, rounded to $10, not shown anywhere), `area` (what was searched), `asOf`, `source`, `note`, `events` (reserved, empty).

Computed by `summariseRun` in `src/lib/hotel-season/summary.ts`. Each hotel's own typical price is the median of its prices on the 12 monthly dates (the two holiday dates are left out); a month's index is the median across hotels of price over that hotel's typical price, times 100.

Flags: `thin` (fewer than 5 hotels priced in two or more months, or a median under 8 hotels, or Booking.com lists under 30 hotel-type properties), `thin-holidays` (fewer than 5 hotels priced on 29 or 31 Dec, only when not already thin), `closed-months` (three or more neighbouring months where listings are under half of a later month, in a market of at least 60 listings), `flat` (most expensive month over cheapest 1.12 or less, not closed), `small-market` (30 to 59 listings, so the panel is most of them rather than a true top 10%).

## Scripts

- `scripts/import-hotel-season.ts`: loads the 195 places collected on 14 and 15 Nov 2026 (the other 5 of the 200 have no hotel market on Booking.com: Antarctica, Churchill, Denali, the Falkland Islands and Cuba/Havana) (`scripts/data/hotel-quote-panel-nov14-part*.json`, mapped to places by `hotel-place-map-nov15.json`). Dry run by default; `--apply` writes; re-running skips places already loaded.
- `scripts/check-hotel-season.ts`: every summary must equal what the quotes give today, point at a current run, and have one current run only. Run it after any rule change or hand edit.
- `src/lib/db/queries/hotel-season.ts`: reads for admin tools and scripts.

## Not built

Admin panel, traveler display, scoring from the measured curve, the stale-quote reminder, the other hotel kinds (budget, mid-range), event weeks. Re-quoting is a new run per place (the collection was done by hand in a browser; there is no automatic collector).
