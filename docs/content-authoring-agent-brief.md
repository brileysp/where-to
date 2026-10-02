# Content authoring brief — for the agent doing this work in Sheets

You're being handed spreadsheet exports from a travel app called **"Where To?"** and asked
to research and write destination content into them. This doc is everything you need:
what the app is, the exact data you're working with, the full list of places and
interests, the existing wishlist of researched-but-not-yet-added destinations, and the
voice/quality rules this catalogue has been held to so far. Read this whole thing before
touching a cell — a lot of the rules here exist because an earlier pass got them wrong
first.

## 1. What the app is, and what you're actually doing

"Where To?" recommends travel destinations by matching a traveler's stated interests
(51 of them — surfing, museums, wildlife viewing, fine dining, etc.) against 200
destinations, **scored month-by-month, 0–10, per interest**. A destination isn't just
"good for hiking" — it's "7.2 for hiking in March, 9.1 in July." The whole app is built
on that per-month granularity, so the content has to earn it: real seasonal research, not
a flat score with generic text bolted on.

Most of the 51 interests have **never been written** — they exist as scoring formulas
with no prose at all. Your job, interest by interest, is:

1. Research each non-N/A destination for that interest, specifically and seasonally.
2. Write a short overall summary (`blurb_overall`) and 12 month-by-month blurbs
   (`blurb_jan`…`blurb_dec`) per destination.
3. Where the existing score doesn't match what you find in real research, flag or correct
   it (`score_jan`…`score_dec`, or the tier column — see §3).
4. Extend the **Catalog Wishlist** (§7) with real destinations for that interest that
   aren't in the 200-place catalogue at all.

You're working in a CSV exported from the app's admin screens, opened in Google Sheets.
**You do not have direct database access** — your edited sheet gets reviewed (a diff
against current values, checked for sanity) before anything is written back. So: be
accurate and be honest about uncertainty, but don't worry about "breaking" anything by
writing into a cell.

## 2. The place catalogue — 200 destinations

Grouped by continent (id in parentheses — this is the stable key, don't alter it):

**Africa (17):** Cape Town (cape-town), Ethiopia (ethiopia), Ghana (ghana), Kruger
National Park (kruger), Maasai Mara & Amboseli (kenya), Madagascar (madagascar),
Marrakech & Atlas (morocco), Mauritius (mauritius), Namibia (namibia), Okavango Delta
(botswana), Red Sea & Nile (egypt), Rwanda (rwanda), Serengeti & Zanzibar (tanzania),
Seychelles (seychelles), South Luangwa (zambia), Uganda (uganda), Victoria Falls & Hwange
(zimbabwe)

**Antarctica (1):** Antarctic Peninsula (antarctica)

**Asia (35):** Angkor Wat & Siem Reap (angkor), Bagan (bagan), Bali (bali), Bangkok
(bangkok), Beijing & Great Wall (beijing), Bhutan (bhutan), Chiang Mai & Northern Thailand
(chiang-mai), Dubai (dubai), Guilin & Yangshuo (guilin-yangshuo), Hokkaido (hokkaido),
Hong Kong (hongkong), Kaziranga National Park (kaziranga), Kerala (kerala), Komodo Island
(komodo), Kyrgyzstan (kyrgyzstan), Ladakh (ladakh), Luang Prabang (luangprabang),
Malaysian Borneo (borneo), Maldives (maldives), Mongolia (mongolia), Nepal (nepal),
Okinawa (okinawa), Pakistan (pakistan), Palawan (palawan), Petra & Wadi Rum (jordan),
Raja Ampat (rajaampat), Rajasthan & the Golden Triangle (rajasthan-golden-triangle),
Samarkand & Bukhara (uzbekistan), Seoul (seoul), Singapore (singapore), Sri Lanka
(srilanka), Taiwan (taiwan), Thailand — Phuket & Islands (thailand), Tokyo & Kyoto
(tokyo-kyoto), Vietnam (vietnam)

**Europe (57):** Algarve (algarve), Amalfi Coast (amalfi), Amsterdam (amsterdam),
Andalucía (andalucia), Athens (athens), Azores (azores), Barcelona (barcelona), Basque
Country (basque-country), Bavaria & Munich (bavaria-munich), Belfast & the Giant's
Causeway (belfast-giants-causeway), Berlin (berlin), Black Forest (black-forest),
Bordeaux (bordeaux), Budapest (budapest), Canary Islands (canaries), Chamonix & the
French Alps (chamonix), Champagne (champagne), Copenhagen (copenhagen), Cornwall
(cornwall), Cotswolds (cotswolds), Dalmatian Coast (croatia), Dolomites (dolomites),
Douro Valley & Porto (douro-valley-porto), Edinburgh (edinburgh), Faroe Islands
(faroe-islands), Finnish Lapland (lapland), Greenland (greenland), Iceland (iceland),
Ireland (ireland), Istanbul (istanbul), Lake District (lake-district), Lisbon (lisbon),
Lofoten Islands (lofoten), London (london), Madeira (madeira), Mallorca (mallorca), Nice
& the French Riviera (nice-riviera), Norwegian Fjords (fjords), Paris (paris), Piedmont
(piedmont), Prague (prague), Provence (provence), Puglia (puglia), Rioja (rioja), Rome
(rome), Santorini & Cyclades (santorini), Sardinia (sardinia), Scottish Highlands & Isle
of Skye (scottish-highlands-skye), Sicily (sicily), Snowdonia (snowdonia), St Andrews &
Fife (st-andrews-fife), Svalbard (svalbard), Tbilisi & the Caucasus (tbilisi-caucasus),
Tuscany (tuscany), Venice (venice), Vienna (vienna), Zermatt & the Swiss Alps (swissalps)

**North America (60):** Acadia National Park (acadia), Arches & Canyonlands
(arches-canyonlands), Aruba (aruba), Aspen (aspen), Badlands & Black Hills
(badlands-black-hills), Bahamas (bahamas), Banff National Park (banff), Barbados
(barbados), Belize (belize), Bend & Crater Lake (bend-crater-lake), Big Island
(big-island), Cape Cod & the Islands (cape-cod-islands), Charleston & Savannah
(charleston-savannah), Chiapas (chiapas), Chicago (chicago), Churchill (churchill), Costa
Rica (costa-rica), Death Valley National Park (death-valley), Denali & the Interior
(denali-interior), Everglades National Park (everglades), Glacier & Waterton Lakes
(glacier-waterton), Grand Canyon (grandcanyon), Great Smoky Mountains National Park
(great-smoky-mountains), Guatemala (guatemala), Havana (havana), Hudson Valley
(hudson-valley), Jamaica (jamaica), Joshua Tree National Park (joshua-tree), Los Cabos
(los-cabos), Maui (maui), Mexico City (mexicocity), Monterey & Big Sur
(monterey-big-sur), Napa Valley (napa), New Orleans (new-orleans), New York City (nyc),
Nicaragua (nicaragua), North Cascades (north-cascades), Nova Scotia (nova-scotia), Oaxaca
(oaxaca), Olympic National Park (olympic), Panama (panama), Puerto Rico (puerto-rico),
Punta Cana (punta-cana), Quebec City (quebec-city), Redwood National and State Parks
(redwood), Riviera Maya (rivieramaya), Rocky Mountain National Park (rocky-mountain), San
Miguel de Allende & Guanajuato (san-miguel-guanajuato), Sedona (sedona), Sequoia & Kings
Canyon (sequoia-kings-canyon), Southeast Alaska & the Inside Passage
(southeast-alaska), Texas Hill Country (texas-hill-country), Turks & Caicos
(turks-caicos), Upper Peninsula (upper-peninsula), Vancouver Island (vancouver-island),
Vermont (vermont), Whistler (whistler), Yellowstone National Park (yellowstone),
Yosemite National Park (yosemite), Zion & Bryce Canyon (zion-bryce)

**Oceania (12):** Bora Bora (borabora), Fiji (fiji), Great Barrier Reef (gbr), Marlborough
& Abel Tasman (marlborough-abel-tasman), Milford Sound & Fiordland
(milford-sound-fiordland), North Island (north-island), Palau (palau), Papua New Guinea
(papua-new-guinea), Queenstown (queenstown), Sydney (sydney), Tasmania (tasmania), Uluru
& the Outback (uluru)

**South America (18):** Argentine Lake District (argentine-lake-district), Atacama Desert
(atacama), Buenos Aires (buenosaires), Chilean Lake District (chilean-lake-district),
Colombian Andes (colombian-andes), Colombian Caribbean (colombian-caribbean), Cusco &
Sacred Valley (peru), Ecuadorian Andes (ecuadorian-andes), El Chaltén & Fitz Roy
(el-chalten), Falkland Islands (falklands), Galápagos Islands (galapagos), Mendoza
(mendoza), Pantanal (pantanal), Peruvian Amazon (peruvian-amazon), Rio de Janeiro (rio),
Salar de Uyuni (uyuni), Tierra del Fuego (tierra-del-fuego), Torres del Paine
(torres-del-paine)

Some of these are single cities, some are whole countries or multi-site regions
("Great Smoky Mountains National Park," "Petra & Wadi Rum") — always research and write
for the *actual scope* of the entry (check its `about`/overview text if unsure), not a
more convenient nearby place that happens to share a name or country. This has bitten a
previous pass twice (see §5 and §8).

## 3. The interests — 51, grouped, with which "formula family" each is on

The formula family matters: interests sharing one (e.g. all the `swim`-formula ones) are
scored by the same underlying shape logic, so a scoring bug or fix on one may apply to its
siblings too.

**Nature & Wildlife (11):** Wildlife Viewing `wildlifeViewing`, Birding `birding`, Safari
`safari`, Whale Watching `whaleWatching` *(wildlife formula)* · Scenic Landscapes
`scenicLandscapes`, Landscape Photography `landscapePhotography`, Camping & Backcountry
`campingBackcountry`, Geology & Volcanoes `geologyVolcanoes` *(hiking formula)* ·
Stargazing `stargazing`, Northern Lights/Aurora `auroraChasing` *(culture formula)* ·
Wildflowers & Seasonal Blooms `wildflowerBlooms` *(wildlife formula)*

**Sports & Recreation (15):** Hiking & Trekking `hiking`, Mountaineering & Rock Climbing
`mountaineering`, Cycling `cyclingRoad`, Mountain Biking `mountainBiking`, Adventure
Sports `adventureSports`, Golf `golf`, Fishing `fishing`, Horseback Riding
`horsebackRiding`, Trail Running `trailRunning` *(hiking formula)* · Skiing &
Snowboarding `skiingSnowboarding` *(snow formula)* · Surfing `surfing`, Diving/Snorkeling
`diving`, Windsurfing/Kitesurfing `windSports`, Sailing & Boating `sailing`,
Kayaking & Rafting `kayakingRafting` *(swim formula)*

**Culture & Discovery (12):** History & Archaeology `historyArchaeology`, Museums & Art
`museumsArt`, Architecture `architecture`, Local Culture & City Exploration
`cityExploration`, Indigenous Cultures `indigenousCultures`, Religious & Spiritual Sites
`religiousSites`, Festivals & Live Events `festivals`, Traditional Arts & Crafts
`traditionalCrafts` *(culture formula)* · Street Food & Markets `streetFood`, Fine Dining
`fineDining`, Wine & Spirits Tasting `wineSpirits`, Specialty Coffee & Tea `coffeeTea`
*(food formula)*

**Relaxation & Leisure (10):** Beaches & Swimming `beachesSwimming`, Hot Springs
`hotSprings` *(swim formula)* · Sunbathing `sunbathing` *(sun formula)* · Luxury Hotels
`luxuryHotels`, All-inclusive Resorts `allInclusive`, Theme Parks `themeParks` *(luxury
formula)* · Spa & Wellness `spaWellness`, Yoga & Wellness Retreats `yogaRetreats`,
Nightlife `nightlife` *(food formula)* · Shopping `shopping` *(shopping formula)*

**Value (3, no content needed):** Low-Season Deals `deals`, Avoiding Crowds `crowds`,
Road-Tripping `roadtrip` — these are computed purely from other data, not authored.

## 4. Current authoring status (live count, as of this brief)

**Done (12 of 51):** `wildlifeViewing`, `birding`, `safari`, `whaleWatching`,
`auroraChasing`, `wildflowerBlooms`, `mountaineering`, `surfing`, `diving`, `windSports`,
`beachesSwimming`, `hotSprings`

**Not started (36 real content interests — everything else above, minus the 3 Value
sliders which never need content.)**

Within the 12 "done" interests, a separate **decimal-precision pass** has so far
completed on `wildlifeViewing`, `wildflowerBlooms`, and `windSports` — the other 9 done
interests may still have coarser, more tied scores than they should (see §6). If you're
asked to work on an already-"done" interest, ask which mode you're in: fresh authoring
vs. decimal-precision pass.

## 5. Voice and content rules (non-negotiable — condensed from the full playbook)

The full detail lives in `docs/interest-content-authoring-playbook.md` in this repo —
read it if anything below is ambiguous. The essentials:

- **Enthusiast lens, not technical/specialist.** Write for a general interested
  traveler, not a domain expert. No filler a specialist cares about but a normal person
  doesn't.
- **Real, specific, verified facts only** — named sites, exact season windows, real
  records, closures. Never invent or pattern-match a specific claim; verify it.
- **Write monthly text and that month's score together, from the same research pass.**
  Never author a full 12-month score curve first and backfill prose, and never let a
  score imply something the words don't support (or vice versa).
- **State real odds honestly.** "A matter of luck," "genuinely elusive" — don't oversell
  a famous thing that's actually rare.
- **No comparisons between different catalogue destinations by name** in the text.
  Comparing one destination's own two seasons to each other is fine.
- **Say plainly whether a destination is year-round, long-season-with-a-dip, or a narrow
  window with a real dead season** — verified per destination, never assumed from the
  activity's general pattern.
- **Every monthly blurb must name the actual site/mechanism and stand alone** — a reader
  jumping straight to one month, with no other context, should understand exactly what's
  being described.
- **Don't invent fake distinction.** If three months are genuinely identical, reuse the
  same short sentence and the same score for all three — manufacturing slightly different
  wording or scores to "avoid repetition" is the bug, not a fix.
- **Keep security/political/environmental-crisis content out of interest text
  entirely** — that belongs in the separate destination-level `travelAdvisories` field,
  not woven into a slider's blurb.
- **Check for overlap with already-authored interests before claiming an animal/site/
  fact** (e.g. `wildlifeViewing` vs. `birding` vs. `whaleWatching` — the split is
  depth/specialist-level, not exclusive ownership of the same animal; both can legitimately
  cover it from a different angle, but don't just restate the other's exact claim).

## 6. Decimal-precision rules (once basic content exists for an interest)

- **Derive the score's precision from the blurb text, never from the old integer score's
  shape.** Group months by identical/near-identical text; each group gets one score. A
  score gap between two DISTINCT-text groups should be sized to what the text actually
  describes (a small step for "still strong, just easing"; a real cliff for "essentially
  closed").
- **Reserve a literal 10 for the narrowest, most exceptional peak** — usually 1–3 months
  (occasionally 4). A run of 5+ months at the literal max needs real justification against
  every other place making a similar claim for that interest.
- **A single isolated month differing sharply (2+ points) from both close neighbors, with
  no textual reason, is almost always a bug**, not an authored choice.
- Check `src/lib/scoring/anchors.ts` for the interest's current "who's allowed a 10 and
  what it asserts" list before assigning top scores — the ceiling you write should match
  what the catalogue already declares.

## 7. The Catalog Wishlist

A running list of **real, well-researched destinations not currently in the 200-place
catalogue**, organized by interest. Currently: <https://claude.ai/artifact/N8oEcWrwLCevwCK8PANdKA>
(ask if that link goes stale — it's a Claude Artifact, look it up by name if so).

As of this brief it holds 11 lists: Whale watching (20), Birding (50), Wildlife viewing
(44), Diving & snorkeling (31), Surfing (12), Windsurfing & kitesurfing (10), Safari (12),
Wildflower blooms (7), Aurora (6), Beaches (6), Mountaineering & climbing (39) — roughly
237 candidate places total, cross-referenced against each other for overlap.

When you finish authoring an interest, add a list for it there:

- **Scale:** entries should be broad enough to be an actual week-plus vacation
  destination (a country, island, archipelago, region) — not one narrow trail or
  viewpoint, unless that single site really is a complete standalone trip (a liveaboard, a
  remote dedicated resort).
- **Every entry needs a real, specific, verified claim** (a species, record, named site,
  season) — tag it established / niche-specialist / emerging.
- **Cross-check for overlap** every time: the same place already on another list (note
  it on both, make sure the claim is genuinely different each time) and the same country
  as an existing catalogue entry but a different region/experience.
- This is a content backlog, not wired into scoring — it doesn't affect the live app.

## 8. Known traps (things that have already gone wrong once)

- **A destination's name can be misleading about its actual scope.** "Norwegian Fjords"
  in this catalogue is specifically Geiranger/Sognefjord/Ålesund/Bergen (~60–62°N) — a
  past pass wrote content around Tromsø (~70°N, Arctic Norway), a real place but not this
  one, because it was a more convenient/famous fit for the topic. Always check a
  destination's own `about`/overview text and its other interests' existing content to
  confirm actual scope before researching.
- **Borrowing another destination's viewing conditions is a similar trap** — Milford
  Sound's aurora content once implicitly borrowed Stewart Island's (much better) viewing
  odds, when Milford Sound's own geography actually blocks the aurora's horizon. Research
  the destination itself, not a better-known neighbor.
- **A species/experience covered by a specialist interest (birding, whaleWatching, diving)
  should still get its due on a general interest (wildlifeViewing) if it's a genuine
  headline, general-audience draw** — leaving it out because "the specialist slider
  already has it" is a real miss, caught more than once.

## 9. What to hand back, and what happens to it

You'll get a CSV per interest (or a filtered slice of one). Edit these columns freely:
`score_jan`…`score_dec`, `blurb_jan`…`blurb_dec`, `blurb_overall`, and — for the Cost
Items sheet if you're asked to work on that instead — `label`, `price`, `unit`, `emoji`,
`cost_floor`, `cost_ceiling`, `cost_overview`.

**Don't alter:** `place_id`, `interest_key`, `item_id`, `updated_at` / `item_updated_at`,
`updated_by`, `editor_kind`, `last_change`, `na`, `tier` (tier is editable in principle but
ask first — it's a separate judgment call from the month-by-month content). These are
either stable keys used to match your edits back to the right row, or auto-derived
tracking fields that get overwritten on save regardless of what's in them.

Leave a cell exactly as exported if you're not changing it — the import only treats a
genuinely *changed* cell as an edit. There's no way yet to delete a cost item through the
sheet (that's a planned addition); flag anything you think should be removed instead of
blanking it.

When you're done, hand the file back — it goes through a dry-run diff review before
anything is written to the live database, so don't worry about causing damage by writing
into a cell; the worst case is a change gets caught and asked about before it lands.
