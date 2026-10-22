# How a traveler's picks change a place's score

Decided with the owner on 21 Oct 2026. Proposal page with the worked examples: claude.ai/artifact/UaYfuVPE7y1vh8nUQ8sbeZ.

## The rule

A place keeps its original score. The chips and answers a traveler picks can only keep it or lower it, never raise it (the original score is the ceiling).
Whatever lowers it gets a reason chip, two at most per card, biggest first. Matches get a green "Matches" chip that changes no numbers.

For every check, what survives is `1 - (1 - keep) * (1 - fit)`: `keep` is what a complete miss leaves (a setting), `fit` is how well the place matches, 0 to 1.

- **Chips** are one check: the best 0 to 10 rating among the chips the traveler ticked (`fit = rating / 7`, capped at 1). Ticking no chips, or every chip, changes nothing. A chip is a wall: you came for it.
- **Questions**: each answered question that is currently asked is one check, a **Limit** (wall) or a **Lean** (wish).
  Limit = a miss would make the trip unsafe, impossible or against the rules (skill, health, rules, weather you cannot stand). Everything else is Lean.
- **No data is a pass.** A place with nothing recorded for a chip or question is never marked down for it.
- The checks multiply, and the interest never keeps less than the floor.
- The result replaces that interest's score **before** the existing blend across interests, so an interest the traveler cares little about barely moves the match. The weather, budget and other bands apply afterwards, unchanged.

## The numbers (admin: Matching tab, saved in `app_settings`, code in `src/lib/scoring/matchSettings.ts`)

| Setting | Default |
|---|---|
| A place has none of the chips you ticked keeps | 50% |
| A chip rating that counts as a full match | 7 of 10 |
| A missed Limit answer keeps | 65% (weakened from 50% on 22 Oct 2026: the first shadow run showed stacked Limits pushing most places to the floor) |
| A missed Lean answer keeps | 85% |
| An interest never keeps less than | 30% |
| Show a reason chip when a miss takes off at least | 15% |
| Most reason chips on a card | 2 |

## The code

- `matchInterest()` in `src/lib/scoring/personalMatch.ts` does it for one interest and place (and month). Tested in `tests/scoring/personalMatch.test.ts`.
- Which questions are asked comes from `src/lib/onboarding/question-rules.ts`; only asked questions are checks.
- Each question has a "reason chip" message (`interest_questions.miss_message`), edited in the question editor. Blank = no chip.

## Not built yet

1. Every chip needs its own trustworthy measure, written and checked. One column can serve many chips when it tells them apart (the wave-type options, one odds column per animal), so it is not one new column per chip. What is not allowed is a measure of something else: a chip must not reuse a field like "main draw" (the Red Sea reads as having no wrecks). A tick or option gives 10 or 0, which is right for "is it offered?" chips; add a 0-10 rating only where how good it is matters.
2. ~~A fit for each question from its columns~~ **Done for the seven interests with data (21 Oct 2026, owner-reviewed):** `src/lib/onboarding/question-fit.ts` (checks) and `question-fit-rules.ts` (the 28 rules), saved in `interest_questions.fit_rule` and shown read-only in the question editor. Other interests wait on their columns.
3. ~~Storing the traveler's answers~~ **Saved in the travel profile as `qa` (21 Oct 2026); `interestMatchFor` joins chips, questions and fits.** **Asked in the live flow and applied to the ranking (22 Oct 2026, behind the onboarding switch):** the server works out per-place tables (`src/lib/scoring/matchTable.ts`, checked equal to `interestMatchFor` on 22,548 real combinations), the browser combines a traveler's picks with them, and the ranking takes the result as `InterestFactors` (`scoreForMonth`, before the blend across interests). The old "styles" multiplier is untouched and still used by the old flow.
4. Shadow mode first: calculate it, record what would change, show nothing until the biggest drops have been read. **First offline run done:** `docs/shadow-match-report-2026-10-21.md`.
5. The reason chips and green match chips, **in the place's detail sheet only** (owner decision 21 Oct 2026; the card stays as it is today). The sheet's "adjusted lower because..." sentence gains the chips, the original and for-you scores, and a per-interest breakdown. Mockup: claude.ai/artifact/C8YqFKXEck6DufewouZyYt.
6. Reason-chip messages (`interest_questions.miss_message`): written for the 28 mapped questions (21 Oct 2026); the rest are written as their columns land.

## Trip settings (22 Oct 2026)

Separate from interests, chips and answers. **How long** (long weekend, 1 week, 2 weeks, 3+ weeks) counts the flights against the trip: round-trip flying hours plus `tripAirportHours` as a share of the trip's days. Up to `tripStretchShare` is fine; up to `tripFarShare` the place keeps `keepIfTripStretch` of its final score; above that it keeps `keepIfTripFar`. It needs the traveler's home (country, US state or Canadian province, or an airport). **Continents** leave out places in regions turned off (six regions; Russia and Turkey split by location, see `src/lib/onboarding/regions.ts`). Both live in `src/lib/onboarding/trip-adjust.ts` and feed `computeRankedDestinations` through `placeFactors`.

### Saved trips (22 Oct 2026)

A traveler can keep up to 20 trips (`user_trips` table, `src/lib/onboarding/trips.ts`, `src/app/onboarding-v2/trip-actions.ts`). **Per trip, always set for that trip:** month, week, year, trip length, continents, and the trip's name. **Inherited from the traveler's defaults but changeable for one trip** (only what differs is stored, in `overrides`): who is going, budget and climate bands, what else matters (dietary and so on), and the longest flight. **Never per trip, always shared:** interests, Travel DNA, and where you live. The year is the next time the chosen month comes round, and can be edited (it then stops following the month). The name starts as "[first name]'s [month] [year] trip" and follows the month and year until the traveler renames it. The most recently saved trip is the active one: saving it also copies its month and bands into the saved preferences, and the full results page (`/`) takes length, continents and longest flight from it (`tripEffectForProfile`). Travelers with no saved trips are unchanged (the profile's own values apply).

### Peak or off peak (22 Oct 2026)

Replaces the old "Deals" tick (which was saved but never used). A five-step scale, "Crowds & prices", from **Peak times** ("Go at the most popular time, even if busy and pricey.") to **Off peak** ("Less perfect weather in exchange for fewer crowds & off-season deals."); the middle step, **In between**, is where it starts. It is a trip setting with a default, like budget: stored in the profile (`peak`, 0 to 4) and overridable per trip (`overrides.peak`). Every place already has a 0 to 10 off-peak value for each month (`monthly.deals`: high = few visitors and off-season prices). The step decides how much of that value is mixed into the place's score for the month: `score x (1 - w) + offPeak x w`, with w = 0 / 10% / 20% / 35% / 50% (`peakLeanPeak`, `peakMiddle`, `peakLeanOff`, `peakOff` on the Matching tab). Unlike every other number there, this can move a place up as well as down. It needs a month; with no month chosen it does nothing; it never hides a place. Code: `src/lib/onboarding/peak.ts`, `blendOffPeak` in `src/lib/scoring/rank.ts`. Known gap: the place detail sheet's own month score does not include it (it also leaves out the trip-length factor).

