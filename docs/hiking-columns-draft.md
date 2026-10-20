# Hiking & Trekking: column list (DRAFT, 13 Oct 2026)

Nine core columns (owner decision 13 Oct 2026: the original eight plus Crowds) plus three optional ones, then the usual source-checked flag and the three planning notes. Same method as surfing: Claude drafts every cell from the three best web sources, you check, then the columns are sent to Gemini as notes with each place.

| Group | Key | Label | Type | Values or format | Core? |
|---|---|---|---|---|---|
| Trails | topTrails | Signature trails | text (wide) | 3 to 5 as "Route (type, length, difficulty, months)", e.g. "Alta Via 1 (hut-to-hut trek, about 75 miles, 10 days, trek, Jul-Sep); Tre Cime loop (day hike, about 6 miles, moderate, Jun-Oct)" | core |
| Trails | ways | What you can do | multi | Easy walks, Day hikes, Hut-to-hut or lodge treks, Camping treks, Walk-up summits | core |
| Trails | longestTrekDays | Longest trek (days) | whole number | 0 = no multi-day route | optional |
| Experience | dayHikeRating | Day-hike rating | rating 0-10 | Quality of easy walks and day hikes at the best time of year | core |
| Experience | trekRating | Trek rating | rating 0-10 | Quality of multi-day trekking; 0 to 1 when there is none | core |
| Style and rules | season | Walking season | text | e.g. "Jun-Sep; passes hold snow until early July" | core |
| Style and rules | altitude | Altitude | choice | Low (under 5,000 ft), Moderate (5,000 to 9,000 ft), High (9,000 to 14,000 ft, altitude sickness possible), Very high (over 14,000 ft, acclimatize) | core |
| Style and rules | permits | Permits, fees or guide rules | text (wide) | Timed permits, park fees, guide rules; blank when there is nothing | core |
| Style and rules | guides | Guide needed | choice | Not needed, Recommended on some routes, Required on the main routes | optional |
| Style and rules | crowds | Crowds on the headline trails | choice | Quiet, Moderate, Crowded at the headline trails | core |
| Style and rules | hazards | Main hazards | text | One to three things, plain words, e.g. "Altitude sickness, river crossings, sudden storms" | core |
| Practicalities | access | How you reach the trails | choice | From town (on foot or local transport), Short drive or shuttle, Long drive or flight to a remote trailhead | optional |
| Draw | drawSourceChecked | Source-checked | yes/no | Whether the entries were checked against a source | always |
| Planning | scopeNote, mustMention, extraAvoid | Notes for Gemini | text, list, list | The same three as every interest | always |
