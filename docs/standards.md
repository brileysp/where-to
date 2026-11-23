# Standards for content work

Generated from `src/lib/authoring/standards.ts` by `npx tsx scripts/build-standards-doc.ts`. Edit the registry, not this file (a test fails if they differ).

This is the one list of the owner's rules. Read it before authoring, reviewing or reporting on content. Each rule has her words and the date, the level she reads it at, and how it is enforced: named checks that exist in the repo, or JUDGEMENT, meaning no code can decide it and I must state evidence at every hand-off.

**Hand-off rule.** Before showing the owner anything, run `PLACE_ROWS_SNAPSHOT=1 npx tsx scripts/standards-report.ts --results=<file>`, paste what it finds worst-first, and answer every judgement standard it lists. Say what was not checked.

**Correction rule.** When the owner corrects something, in the same turn: add or change the standard here, add her example as a failing test, make a check fail on it, then fix it. If it cannot be a check, it is a judgement standard with the evidence I must give.

## A cell (one place, one interest)

Judged on each cell separately. A batch total can look fine while a single cell is wrong.

### S01. Last digits are used evenly, in each cell and in each batch on its own

Owner: "Each last digit should turn up about 10%... a string of .5s followed by a different string of .5s is what looks artificial" (3 Oct, 11 Oct 2026); "UGH why am I having to explain this over and over" (13 Nov 2026). A cell is clumped when more than 40% of its distinct runs end in .0 or .5 (confirmed 14 Nov 2026); a flat stretch is fine at any value; zeros and 10s do not count. Scope (14 Nov 2026): judge new Gemini batches; do not go repairing other live scores, especially for interests Gemini has not authored.

Enforced by checks: `src/lib/gemini/clump.ts::checkBatch`, `src/lib/gemini/clump.ts::cellClump`, `scripts/apply-family-text.ts::assertBatchAcceptable`, `tests/gemini/clump.test.ts::DOLOMITES`.

Story and reasons: memory note `feedback_even_tenths_and_liveaboard`.

### S03. A blurb groups only neighboring months, and its scores stay close

Owner: "Above .5 consider splitting, above 1.5 must split; decide based on how expected/natural the curve is" (13 Nov 2026); groups are runs of neighboring months only.

Enforced by scanner rules: `nonNeighbors`, `wideGroup`, `splitConsider`; checks: `src/lib/authoring/groups.ts::groupMonths`, `tests/authoring/rules.test.ts::splitConsider`.

Story and reasons: memory note `feedback_month_blurb_rules`.

### S04. The one-month test: a blurb never names a month it does not cover or calls out something true of only some of its months

Owner: (13 Nov 2026) A reader going in one month of a group must find a blurb that is fully true for that month.

Enforced by scanner rules: `otherMonth`, `partialMonths`, `disparateNamed`.

Story and reasons: memory note `feedback_month_blurb_rules`.

### S05. Month scores follow what a visitor can do; only flat or trough stretches are flat; identical text does not mean identical score

Owner: (9 Oct 2026, 13 Nov 2026) A gradual change shows as a gradual change; indoor interests barely swing; closed months are 0. On Scenic Landscapes (16-18 Nov 2026) she challenged every all-year-flat cell where the look or the comfort of seeing it changes: Algarve ("I would expect a modest swing"), Death Valley ("the weather is extreme, so there should be some seasonal variation"), Dubai ("still too hot to enjoy the scenery or views for part of the year"), Kruger ("greener and prettier right after the rainy season"), London ("more brown and dull in winter") and Churchill ("there must be a bit more of a curve").

Enforced by scanner rules: `severeScore`; checks: `tests/authoring/rules.test.ts::flatAllYear`, `scripts/standards-report.ts::flatAllYear`.

Judgement: For any cell whose scores look odd, say what the text says drives each stretch and whether the scores follow it.

Story and reasons: memory note `feedback_dont_ban_unasked_and_flat_troughs`.

### S10. A score reads as the place's rank among comparable places (a city is judged against cities)

Owner: "If Paris is a 5.5 or whatever, I would think Chicago should be a bit lower... I read 4.6 as middle of the pack when in fact Chicago is more like middle of the pack for cities" (14 Nov 2026).

Judgement: For each new peak, name the nearest already-scored places of the same kind and say where it ranks among them.

Story and reasons: memory note `feedback_prompt_for_review_steps`.

### S06. Ocean surf or beach places are considered for diving; N/A only for murky water or no diving, never "too far"

Owner: "If a place is close enough to the ocean to have a beach or surf score, it is close enough to be considered for a diving score" (24 Oct 2026).

Enforced by checks: `src/lib/truths/truths.ts`.

Story and reasons: memory note `feedback_coast_rule_diving_na`.

### S07. When Gemini or data says N/A and the other says applicable, keep applicable

Owner: "If there is a conflict, always keep the one that isn't NA" (31 Oct 2026).

Judgement: List any cell where an N/A conflicted with applicable data and say I kept it applicable.

Story and reasons: memory note `feedback_na_conflict_keep_applicable`.

### W01. No filler about the year being even ("year-round", "all year", "every season")

Owner: (31 Oct 2026) Readers assume it; say only what is closed, seasonal or reduced.

Enforced by scanner rules: `filler`.

### W02. "Offers" is allowed occasionally but not leaned on; vary the verbs; "premier" is fine

Owner: "I'm ok with premiere, and even occasional offer depending on the interest" (13 Nov 2026).

Enforced by scanner rules: `offers`, `selfRating`.

Story and reasons: memory note `feedback_hiking_blurb_style`.

### W03. No promotional language, marketing claims or contrast framings

Owner: (Oct to Nov 2026) No "boasts", "stunning", "more than just".

Enforced by scanner rules: `promo`, `marketing`, `contrast`.

### W04. US units and spelling only

Owner: (Oct 2026) Miles, feet, degrees Fahrenheit; home country decides what the app shows.

Enforced by scanner rules: `units`.

Story and reasons: memory note `wheretoapp_units_setting`.

### W19. A blurb speaks as if written for the one month the visitor picked: no group talk

Owner: "Each blurb must stand alone, so when you say 'these are the wettest months' in a blurb, you immediately ruin the illusion that the text is tailored exactly to and only for the month that the user has picked" (14 Nov 2026). No plural "months", no month lists or names inside a grouped blurb, no "this stretch"; describe the conditions directly.

Enforced by scanner rules: `groupTalk`; checks: `tests/authoring/rules.test.ts::wettest months`.

Story and reasons: memory note `feedback_month_blurb_rules`.

### W20. Say only what a place IS known for, never what it is not

Owner: "You usually should not mention what a place ISN'T. Humans understand that Venice, like any city, is not known for natural landscapes. I keep what it IS known for only." (14 Nov 2026)

Enforced by scanner rules: `notKnownFor`; checks: `tests/authoring/rules.test.ts::rather than natural landscapes`.

Story and reasons: memory note `feedback_month_blurb_rules`.

### W21. Light interests are implied, never named: no "sunbathing" or "scenic landscapes" in the text

Owner: "In general, sunbathing is not a sport and barely even an interest. So let's not call it out so explicitly as if it's a serious thing. Sort of like scenic landscapes, let it be implied what we're talking about a bit more." (15 Nov 2026). Her Sedona, Aruba and Cape Cod edits cut "offers sunbathing primarily through", "Sunbathing is generally out of the question", "a premier destination for sunbathing", "too cold for sunbathing" and "marginal sunbathing weather".

Enforced by scanner rules: `interestNamed`; checks: `tests/authoring/rules.test.ts::light interests are implied`.

Story and reasons: memory note `feedback_light_interests_implied`.

### W22. Stargazing: a month with no star at all scores exactly 0 and is never grouped with a month where a few stars show

Owner: "If it NEVER gets dark and you cannot see a single star, I would think that would earn a zero. Isn't that true of some months in Finnish Lapland? You have April to August lumped together, but I would think June would actually be more like zero while April and August would just be low. There is a difference between 'you can only see a few stars' and 'you can not see a single star'." (15 Nov 2026)

Enforced by checks: `tests/astro/darkness.test.ts::no stars is not the same as a few stars`, `tests/authoring/scope-sheets.test.ts::no star shows at all`.

Judgement: For each stargazing cell at high latitude, list the months scored 0.0 and the months scored low, and say what the lowest point of the sun was in each (from the facts).

Story and reasons: memory note `feedback_no_stars_and_smooth_temperature`.

### W23. Sunbathing temperature is one smooth scale for every place, zero at 50 degrees, no cliff

Owner: "Is March in Algarve really a .9 for sunbathing? I would have thought higher... compare March in Algarve to September in Iceland. Weird that this place did not hit zero even in December." (15 Nov 2026). Sedona in November (highs in the 60s) scored 3.0 while Algarve in March (about 65 degrees) scored 0.9.

Enforced by checks: `tests/authoring/scope-sheets.test.ts::at or below 50 the month is 0`.

Judgement: For each sunbathing cell, name the coldest month that scores above 0 and the warmest that scores 0, with their afternoon highs, and check that a warmer month never scores below a colder one in another place.

Story and reasons: memory note `feedback_no_stars_and_smooth_temperature`.

### W24. An overview never ends with a recap: no closing sentence that only restates what the overview already said

Owner: On Badlands & Black Hills: "The landscapes range from dry, colorful desert pinnacles to dense mountain forests. That last sentence is real garbage, just repeating what was already said. We don't need a recap after just a couple sentences. Remove that sentence, and look for others like it to remove as well." (16 Nov 2026)

Enforced by scanner rules: `recap`; checks: `tests/authoring/rules.test.ts::does not end with a recap sentence`.

Judgement: List every overview whose last sentence the scanner flags and say, per place, whether it was removed or why it adds a new fact. Also read the last sentence of every overview in the batch: the scanner only catches summary openers and heavy word overlap, not a recap in other words.

### W25. Spa and wellness texts cover day spas and massage, bathing culture and wellness retreats, not only hot-spring style bathing

Owner: "These spa and wellness blurbs lean pretty hot-spring heavy. I want to make sure we are also covering a nice day spa for a massage, and really nice spa retreats which are technically hotels but ok to have a bit of overlap." (15 Nov 2026)

Enforced by checks: `tests/authoring/scope-sheets.test.ts::cover all three kinds`.

Judgement: For each spa overview, name which of the three kinds it covers and which it leaves out because the place has none.

Story and reasons: memory note `feedback_no_stars_and_smooth_temperature`.

### W26. Stargazing: never talk about the length of the night for a place closer to the equator than Seattle

Owner: On Ladakh: "May-July since 'though nights are short' which feels like a weird thing to say for a place like India that isn't super high or low latitude. Can we just say any place that is further from a pole than, say, Seattle, does not need any callout about length of night?" (16 Nov 2026)

Enforced by scanner rules: `nightLengthNearEquator`; checks: `tests/authoring/rules.test.ts::closer to the equator than Seattle`, `tests/authoring/scope-sheets.test.ts::closer to the equator than Seattle`.

Story and reasons: memory note `feedback_stargazing_sky_wording`.

### W27. Stargazing: months with different skies get their own blurbs, and "never gets fully dark" is not said of a month where most stars still show

Owner: On Svalbard: "I feel like we need more broken out blurbs here. Feb sounds like peak polar night, then suddenly in March it says 'the sky never gets fully dark' - really? That's a dramatic shift. Plus, Apr and Aug (all night twilight?) MUST be different from June (all night sunshine?)" (16 Nov 2026)

Enforced by scanner rules: `skyBandMix`, `neverDarkOverstated`; checks: `tests/authoring/rules.test.ts::different skies in different blurbs`, `tests/authoring/scope-sheets.test.ts::its own blurb`.

Story and reasons: memory note `feedback_stargazing_sky_wording`.

### W28. Stargazing: the Milky Way is mentioned only as its bright core being well placed or not up, never when in the evening it can be seen

Owner: On Ladakh: "What does it mean to say the Milky Way is visible early in the evening?" (16 Nov 2026). She also found my five-phrase fix too much ("it will confuse Gemini"), so the instruction is the simple one: no times at all.

Enforced by scanner rules: `milkyWayTime`; checks: `tests/authoring/rules.test.ts::does not say when in the evening the Milky Way`, `tests/authoring/scope-sheets.test.ts::never say when in the evening`.

Story and reasons: memory note `feedback_stargazing_sky_wording`.

### W29. A blurb shared by several months states one condition that holds in every one of them: no words that describe a change across the months

Owner: On Bordeaux (April to October in one blurb: "fill in with green foliage, eventually turning gold and red by early autumn"): "Can you find what's wrong here? How did you miss it?" (17 Nov 2026). A visitor in April reads about autumn, and a visitor in October reads about the foliage filling in.

Enforced by scanner rules: `sequenceWords`; checks: `tests/authoring/rules.test.ts::eventually turning gold and red`.

Story and reasons: memory note `feedback_shared_blurbs_one_condition`.

### W30. The place is the subject, not its scenery: "Northern Ireland is known for its coastline", never "Northern Ireland's scenery is known for ..."

Owner: "It is so weird how gemini keeps saying 'northern ireland's scenery is known for its...' as if 'northern ireland scenery' were an entity with its own reputation. But in reality, when we think of a place, we think of its scenery, hence the edits I have been making" (18 Nov 2026). Her edits for Lisbon, Mallorca, Ghana and Hong Kong all dropped the word "scenery" and made the place the subject.

Enforced by scanner rules: `sceneryKnownFor`; checks: `tests/authoring/rules.test.ts::Northern Ireland`, `tests/authoring/scope-sheets.test.ts::the place is the subject`.

Story and reasons: memory note `feedback_place_is_the_subject`.

### W31. Read each sentence back for sense: nothing on the coast is inland, nothing is described with a feature it does not have

Owner: On Monterey & Big Sur ("Inland, the scenery shifts to dense groves of coastal redwoods and the rocky coves of Point Lobos"): "what's wrong with the last sentence? did you read it before?" (18 Nov 2026). Point Lobos is on the shore, so it cannot be inland; the same cell also put McWay Falls, which drops onto a beach, in the redwood canyons.

Enforced by scanner rules: `inlandCoast`; checks: `tests/authoring/rules.test.ts::rocky coves of Point Lobos`.

Judgement: For every overview I touch, read each sentence as a visitor would and say what I checked: that places named together are really in the place the sentence says, and that a feature is not given to the wrong spot.

Story and reasons: memory note `feedback_place_is_the_subject`.

### W32. Each overview sentence covers one subject; do not make every sentence try to cover the full range

Owner: On the North Island: "this is one of those ones where each line tries to cover the full range, instead of just talking about one thing and then talking about the other thing. it's annoying, please rewrite." (18 Nov 2026)

Judgement: For each overview I write or fix, say what each sentence is about, and that no sentence lists both ends of the place (for example forests and coast and volcanoes) at once.

Story and reasons: memory note `feedback_place_is_the_subject`.

### W33. Name ancient monuments and ruins that are part of a place's signature view (Bagan, Angkor, Tikal, Teotihuacan), not only the natural landscape

Owner: On Myanmar: "ok great, you called out the temples here (and for Angkor Wat). So why not Tikal, Aztec pyramids of mexico city, etc?" and on Mexico City: "weird to not mention the pyramids, or seeing them from a balloon?" (18 Nov 2026). Teotihuacan is older than the Aztecs; the Aztec temple in the city is the Templo Mayor.

Judgement: For each overview, say whether a famous ancient site is part of the view and, if it is, whether it is named. List any place where one exists and I left it out.

Story and reasons: memory note `feedback_place_is_the_subject`.

### W34. A month with real typhoon or hurricane risk is not described as a clear-sky peak month, and a text never claims something the place does not do (the Amazon flood does not reach the canopy)

Owner: On Okinawa: "Typhoon season is still pretty high, still a pretty good Time to enjoy the landscapes?" and on the Peruvian Amazon: "Reword Dec - Apr - it doesn't flood to the canopy lol. But it allows easier navigation by boat on channels through the flooded forest." (19 Nov 2026). The Japan Meteorological Agency's 1991 to 2020 averages for typhoons within 300 km of Okinawa are 2.2 in August, 1.9 in September, 1.1 in October and 0.3 in November, so October is not a clear-sky month.

Judgement: For every place with a storm season (typhoon, hurricane, cyclone, monsoon), give the agency's monthly frequency, say which months the text groups as clear or peak, and list any month in a peak group that has more than half the frequency of the worst month. For any physical claim about water, ice or weather, say what the source says.

Story and reasons: memory note `feedback_storm_months_not_clear`.

### W05. Never write "this interest" in a text

Owner: (31 Oct 2026) Name the thing itself.

Enforced by scanner rules: `thisInterest`.

### W06. Do not state the obvious, do not spell out what a place lacks, never say something "remains accessible"

Owner: (13 Nov 2026) Say the one thing that changes.

Enforced by scanner rules: `lacks`, `accessibleFiller`, `negativeFraming`.

Story and reasons: memory note `feedback_month_blurb_rules`.

### W07. Call out what is unusual about doing the interest in that place (customs, rules)

Owner: (13 Nov 2026) Nude mixed saunas in Germany, the naked pre-shower in Icelandic pools, say it once near the top.

Judgement: For spa, bathing and similar cells, say which custom each overview calls out, or that none applies.

Story and reasons: memory note `feedback_month_blurb_rules`.

### W08. Keep a place's seasons consistent across texts; southern-hemisphere and equatorial places use months, not seasons

Owner: (13 Nov, 14 Oct 2026) Use the place's dry and wet months from the facts.

Enforced by scanner rules: `monthsNotSeasons`.

### W09. Stargazing wording: no moon, no figures for darkness or cloud, plain words first ("true night" is not a defined term)

Owner: (9 Nov, 13 Nov 2026) The moon is the same everywhere; plain words first, "astronomical darkness" once if needed.

Enforced by scanner rules: `moon`, `bortle`, `figures`, `trueNight`.

### W10. Drink overviews: biggest draw first, one topic per sentence, extras last, no season clause on the wrong topic

Owner: (6 Nov 2026) No range-summary opener.

Enforced by scanner rules: `rangeOpener`, `mixedSentence`.

Story and reasons: memory note `feedback_overview_structure`.

### W11. No company or venue names in texts (restaurants, hotels, clubs, spas, ranches, lodges, cafes, centres)

Owner: "We aren't really going to be naming restaurants/hotels/clubs here" (3 Nov, 14 Nov 2026). Keep and flag only where the name is the point (Guinness).

Judgement: List any business name left in a text and why, and check staleness reasons and how-to-check lines also stay at place and scene level.

Story and reasons: memory note `feedback_no_company_names`.

### W12. After a rename, the old name must not survive in texts, scope sheets or the place's own overview

Owner: (7 Oct 2026) The Punta Cana case.

Enforced by scanner rules: `oldName`.

Story and reasons: memory note `feedback_renamed_place_old_names`.

### W13. Shared blurbs describe stable conditions: no transitions, no visitor-only verbs for residents

Owner: (old pipeline rules, ported 13 Nov 2026)

Enforced by scanner rules: `transitionShared`, `residentVerb`.

### W14. Spell out acronyms on first use

Owner: (old pipeline rule, ported 13 Nov 2026)

Enforced by scanner rules: `acronym`.

### W15. Species names follow the eBird style, emphasis markers are balanced, bird names Title Case

Owner: (19 Oct 2026)

Enforced by checks: `src/lib/gemini/validate.ts::emphasisIsBalanced`.

Story and reasons: memory note `wheretoapp_species_name_review`.

### W16. Hiking: leave out the obvious season, vary the opening verb, hikers not walkers for rugged ground

Owner: (15 Oct 2026)

Enforced by checks: `src/lib/gemini/validate.ts::walkers`.

Story and reasons: memory note `feedback_hiking_blurb_style`.

### W18. Character limits are maximums: judge length against the max, not the soft target

Owner: (14 Oct 2026) A place like the Dolomites should be at or near the max.

Judgement: Show length as n / max only, and only flag exceeding the max or the too-short warning.

Story and reasons: memory note `feedback_max_not_target`.

## A batch

Judged on the new batch by itself, not inside the catalog.

### F01. Every risky claim in Gemini text is source-checked before it is shown or applied

Owner: (14 Oct 2026) After the Sedona hiking errors the owner caught: never present or apply Gemini text without a source-checked pass.

Enforced by checks: `docs/fact-check-process.md`, `scripts/fact-check.ts`.

Judgement: State which claims I checked, with what sources, and which I could not check.

Story and reasons: memory note `feedback_fact_check_gemini_text`.

### F02. When research disagrees with Gemini, search again with different wording (twice) before overruling it

Owner: (Oct 2026) Six of my first-pass whale corrections were wrong.

Judgement: For each text I changed against Gemini, say what the second and third searches found.

Story and reasons: memory note `feedback_triple_check_contradictions`.

### F03. Read rejected texts and judge each one; never present counts or trust a keyword check

Owner: (7 Oct 2026)

Judgement: For each rejection I report, say what the text actually says.

Story and reasons: memory note `feedback_read_rejections`.

## An interest

Judged across the places of one interest.

### S02. Every rating column has a handful of 10s for the few best places in the world, and only listed places may score 10

Owner: "There should be at least a handful of 'among the few best places in the world for x' that earn a 10" (28 Oct 2026).

Enforced by scanner rules: `tenOffAnchor`; checks: `scripts/audit-anchors.ts::INTEREST_ANCHORS`.

Judgement: Name any 10 outside the interest's anchor list and say whether I moved it or left it for the owner.

Story and reasons: memory note `feedback_tens_in_every_column`.

### S08. Places named for a whole country, island or state count their whole outline, not a 100 km circle

Owner: (28 Oct 2026) A 100 km circle makes sense for Paris, not for Costa Rica or Nepal.

Judgement: For any data column built from a place's area, say which outline was used.

Story and reasons: memory note `feedback_whole_outline_for_country_places`.

### W17. Mentioning something another interest also covers is fine and wanted; the scope boundaries stay

Owner: (17 Oct 2026) Lofoten scenic text may mention the hikes.

Judgement: When a text mentions another interest's topic, do not strip it; keep each interest's scope table in the prompt.

Story and reasons: memory note `feedback_overlap_is_good`.

## A review page

How a page for the owner is built.

### D02. In every report, name a place as the app names it today, and say where the hotels or other samples actually are when the place was widened

Owner: On my Agoda report, which called Myanmar "Bagan" and measured three Bagan hotels: "why do you keep calling it bagan? we really didnt fix that did we?" (17 Nov 2026). The id is still "bagan" and all three booking sites sampled only that town, although the place is now all of Myanmar.

Judgement: Use the current name from the place list (never the internal id or the old name). For any place in docs/renamed-places.json, say which town or hotels were sampled and whether they cover the widened scope, and flag the estimate as covering only that town when they do not. Of the 20 renamed places, the hotel samples are in a single town for Myanmar, Cambodia, Laos, Wales, Northern Ireland, French Polynesia, Aspen Snowmass, Banff and Jasper, Napa and Sonoma, Northern Tanzania, Komodo and Flores, Kruger and Sabi Sands, Vancouver and Whistler, and El Chaltén and El Calafate; not yet audited for the rest.

Story and reasons: memory note `feedback_report_current_place_names`.

### D04. On the cost seasonality card the sentence and the chart say the same thing: the ratio is the named peak months against the named comparison months, every peak month the chart shows is named, nothing is named that the chart does not show

Owner: "ok i just looked at borneo and it mentions an april spike that does not appear on the chart. so please do a compare check of every blurb vs every chart, and where there is a discrepancy, do a fact check to find the truth." (18 Nov 2026); "ok, this is good enough for now. Please go ahead and build this into the cost tab in the live app, below the cost items." (19 Nov 2026). Found: old reviewed numbers were the peak month against the single cheapest month (Banff "3x" is 2x against the rest of the year), peaks that were only a plateau (Borneo April), a December peak hiding a separate holiday spike, and "winter months" used while a peak month sat in winter.

Enforced by checks: `scripts/cost-seasonality/check_cards.py::stated ratio differs from the chart`, `scripts/cost-seasonality/ratio_check.py::def group_ratio`, `tests/cost-seasonality/card.test.ts::every card is well formed`, `tests/cost-seasonality/card.test.ts::shows the card below the cost items`.

Judgement: Before showing the cost seasonality page, run scripts/cost-seasonality/check_cards.py and ratio_check.py and list what each still flags, with the reason it is acceptable (a plateau, a ramp into a peak) or the fix. Where chart and sentence disagree, say what the data or an outside source shows (Dubai: Wego puts December as the priciest month, our December point is a single mid-December date).

Story and reasons: memory note `feedback_blurb_matches_chart`.

### P01. Review material goes in a full artifact with every text and score, never a chat summary

Owner: "I am expecting an artifact with all authored content for me to review. Not summaries." (Oct 2026)

Judgement: The page lists every place and every month; the chat message only points to it.

Story and reasons: memory note `feedback_artifacts_not_summaries`.

### P02. A page covering several interests is grouped by interest, never mixed alphabetically

Owner: "I always want interests together." (9 to 10 Nov 2026)

Enforced by checks: `scripts/build-review-page.ts::grp`.

Story and reasons: memory note `feedback_group_by_interest`.

### P03. Changed words show in subtle blue only, no red strikeouts; the original sits beside

Owner: "Hard to look at" (14 Oct 2026)

Judgement: Use the soft blue mark for changes and keep the original in its own column.

Story and reasons: memory note `feedback_diff_style`.

### P04. Month-score curves use a fixed 0 to 10 axis

Owner: (11 Oct 2026) An auto-scaled chart made 1 to 3 look like 8 to 10.

Judgement: Any new chart uses 0 to 10 with ticks at 0, 2, 4, 6, 8, 10.

Story and reasons: memory note `feedback_fixed_chart_axis`.

### P06. Group or filter places by setting tags, never by the birding place types

Owner: (10 Nov 2026) Algarve is not first a "seabird coast".

Judgement: Use places.settingTags (first = primary).

Story and reasons: memory note `feedback_place_grouping_setting_tags`.

## How we work

Not about any one cell: the habits that stop the same mistakes coming back.

### S09. Retired interests never appear in any list, count or report; the active list comes from getActiveInterests()

Owner: "I will keep adding or removing interests from the list, so a note about these 6 in particular will go stale" (13 Nov 2026).

Enforced by checks: `src/lib/scoring/active-interests.ts::getActiveInterests`, `tests/scripts/no-raw-interest-list.test.ts`.

Story and reasons: memory note `feedback_retired_interests`.

### D05. A renamed or widened place is never sent to Gemini with ratings, signature views or facts written for its old name or narrower scope; its scope is confirmed first

Owner: "you repeatedly used the old names, then told me you'd solved the problem, and then made the same mistake again. Over and over. So you once again using the old names, this time to draft the signature views, is yet another example of this." (20 Nov 2026). Found: all 20 renames were already in docs/renamed-places.json on 14 Oct 2026, the Scenic ratings and signature views were written for the old names on 23 Oct, and the 16 Nov Scenic batch went through gemini-batch.ts, which had no check for renamed places (only gemini-author-batch.ts did). Quebec City & Montreal was sent facts that named only Old Quebec; Piedmont was sent mountains 2 and no Alps.

Enforced by checks: `tests/places/gemini-scope-guard.test.ts::renamed and widened places are not sent to Gemini until the owner has confirmed their scope`, `src/lib/places/gemini-scope-guard.ts::renamedWithoutConfirmedScope`, `scripts/gemini-batch.ts::renamedWithoutConfirmedScope`, `scripts/gemini-author-batch.ts::scopeConfirmed`.

Judgement: Before any Gemini batch or any facts, ratings or signature views are written, list every place in it that was renamed or widened, say whether its scope is confirmed, and say what name and scope each fact was written for. Never say the old-name problem is solved; say which checks ran and on what.

Story and reasons: memory note `feedback_old_names_again`.

### D03. A place has an unchanging key, an editable label and a tracked scope; nothing is identified by a word that can go out of date

Owner: "I think your solutions to the naming issue are bullshit. they have failed over and over again" and "what if each place only has a numerical string as primary key, and then we have an editable place label field that we can change as many times as we want to without creating trouble?" (18 Nov 2026). Decided: p0012 format, alphabetical, steps 1 and 2 of docs/place-naming-plan.md first.

Enforced by checks: `scripts/check-place-identity.ts::Place identity is complete and consistent`, `tests/places/identity.test.ts::never change once assigned`, `tests/places/resolve.test.ts::finds Myanmar by key, slug, old slug and old id`, `tests/places/no-typed-keys.test.ts::no source or test file types a place key`, `tests/admin/create-place.test.ts::gives the first new place the next key`, `tests/admin/identity-edit.test.ts::renames a place`, `tests/admin/identity-pages.test.ts::lists every place`, `tests/places/resolve.test.ts::replaces keys with labels and leaves everything else alone`, `tests/places/label-filter-installed.test.ts::installs the label filter`, `tests/places/resolve.test.ts::lists the latest retired label as "was"`, `tests/admin/scope-version.test.ts::lists nothing while the scope is unchanged`, `src/lib/places/scope-stale.ts::staleScopeRows`, `scripts/check-place-keys-in-files.ts::Every checked data file uses place keys only`.

Judgement: Use the label from place_identity (never the old id, a slug or a key) in anything shown to the owner: reports, review pages, chat. Code refers to a place as PLACE.name (src/lib/places/keys.generated.ts), scripts take a slug, an old id or a key (--only=myanmar), and a new place gets the next key automatically. Say which places a report covered by label, and list any script I ran that still prints keys.

Story and reasons: memory note `feedback_report_current_place_names`.

### D01. Hotel price seasonality is stored as a small summary plus admin-only evidence; thin data is flagged and the sample is counted; nothing the traveler sees reads it yet

Owner: "Capture as many as you can and say in the data how many you were able to sample or how else you got the data." (14 Nov 2026); "For places with thin data, say the data is thin, and always show both [the app's label and the measured number] regardless." (14 Nov 2026); "Do not build any of the user-viewed stuff yet. I'm not sure how I will want to do that. For now, build just the storage and the back-end part of this." (15 Nov 2026)

Enforced by checks: `tests/hotel-season/summary.test.ts::recomputes from its raw quotes`, `tests/hotel-season/storage.test.ts::the traveler screens never read the hotel season tables`, `scripts/check-hotel-season.ts::All summaries match their current runs`.

Judgement: Before the scoring reads hotel season data, show the owner a before-and-after report, with the old label beside the measured numbers and each thin-data flag worded in plain words. (19 Nov 2026: she approved the Cost tab card, which reads its own generated file from the reviewed drafts, not these tables.)

Story and reasons: memory note `wheretoapp_hotel_season_prices`.

### F04. A fact-check log is one dated note with sources plus corrected results, not a source per sentence

Owner: "I only need to see the corrected results of the fact checks, and one place that says fact check done on this date, these sources used" (31 Oct 2026).

Judgement: Log exactly one dated whole-interest note and a short note per corrected text.

Story and reasons: memory note `feedback_factcheck_record_light`.

### F05. Never quote a progress or status figure from notes without checking the live database first

Owner: (Oct 2026) The 144-places birding mistake.

Judgement: Any figure I quote about what is done or remaining comes from a query run in the same turn.

Story and reasons: memory note `feedback_verify_status_before_quoting`.

### P05. Anything the owner did not select stays out of every database, script, doc and page

Owner: "Fix this for good, I already asked you once" (21 Oct 2026)

Judgement: Build pages from the database only; say where I checked for leftovers.

Story and reasons: memory note `feedback_unselected_stays_gone`.

### P07. Before proposing future places, check the old wishlist and every other list; duplicates share one name and an "Also on" note

Owner: (9 Oct 2026)

Judgement: Say which lists I checked before proposing places.

Story and reasons: memory note `feedback_future_places_cross_lists`.

### H01. Every Gemini call caps hidden thinking

Owner: (7 Oct 2026) Thinking tokens were 70 to 85% of each call's cost.

Enforced by checks: `tests/gemini/thinking.test.ts`.

Story and reasons: memory note `feedback_gemini_thinking_capped`.

### H02. Never run Gemini unasked; show the places and a measured cost first

Owner: "I didn't ask you to use Gemini for that, how much did we pay?" (23 Oct 2026); "I didn't give you permission to do something that would double my cost" (13 Nov 2026).

Enforced by checks: `scripts/gemini-batch.ts::ESTIMATED COST`.

Judgement: Put any change in cost on its own line, measured, and wait for an explicit yes.

Story and reasons: memory note `feedback_ask_before_gemini`.

### H03. After saving, I raise the review steps myself: reviewed mark, rank checks, authoring pass, fact-check note

Owner: (2 Nov 2026) She should never have to look at the tracker to find out what is missing.

Judgement: End every save with the list of steps raised and done.

Story and reasons: memory note `feedback_prompt_for_review_steps`.

### H04. A pass going live is logged on the to-do list and the to-dos it fixed are closed

Owner: (11 Oct 2026)

Enforced by checks: `src/lib/gemini/todo-sync.ts::closeTodosForApplied`.

Story and reasons: memory note `feedback_todos_follow_passes`.

### H05. A review to-do cannot be ticked done until every staleness reason has a result

Owner: (13 Nov 2026) Hardwire the checking process.

Enforced by checks: `src/lib/admin/stale-checks.ts::reviewGateMessage`.

Story and reasons: memory note `wheretoapp_staleness_checks`.

### H06. Plain language: the owner is not a developer; run commands myself and report in plain terms

Owner: "Please never talk to me like I'm a developer... so lame!"

Judgement: No command lines, flags or code in what I tell her unless she asks.

Story and reasons: memory note `feedback_plain_language`.

### H07. Give a real assessment and a position; "good as is" is allowed; no padded lists; change an answer only for a reason

Owner: (28 Oct 2026)

Judgement: Lead with the recommendation.

Story and reasons: memory note `feedback_real_assessment`.

### H08. New tables enable row-level security; scripts do not read whole tables

Owner: (13 Oct, 9 Nov 2026)

Enforced by checks: `scripts/check-rls.ts`, `tests/scripts/no-full-table-reads.test.ts`.

Story and reasons: memory note `wheretoapp_rls_every_table`.

### H09. Hand-offs report at the level the owner reads: each cell, each batch on its own, worst cells first, and what was not checked

Owner: "I measured the wrong thing, and then reported even without looking at the cell you read" (14 Nov 2026).

Enforced by checks: `scripts/standards-report.ts::worst`.

Judgement: Paste the acceptance report and answer each judgement standard it lists, with evidence.

### H10. A correction becomes a standard, a failing test and a check in the same turn

Owner: "We should start over in how we work together because these things keep happening over and over" (14 Nov 2026).

Judgement: Show the standard, the test that fails on the owner's example, and the fix.
