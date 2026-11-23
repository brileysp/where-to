# Cost seasonality card: draft tools (owner review stage)

Order: build_widgets_v4.py (writes .cache/cost-seasonality-drafts-v4.json) -> merge4.py (keeps reviewed cards, regenerates the rest) -> merge5.py (corrects reviewed cards' ratios) -> merge6.py (peak months) -> page_widgets.py (review page).
Checks, run before every hand-off: check_cards.py (blurb against chart: ratio, peak months, late-December rise, closures, events) and ratio_check.py (stated ratio against the rounded group ratio).
Standard D04 in src/lib/authoring/standards.ts. The scripts still read the stats files from the session scratchpad (stats/master.json, hs_summaries.json); move them in when the card moves into the app.
