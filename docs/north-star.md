# North Star card

Read this at the start of every session and give the owner the daily brief (see the bottom). Keep it to one page. The long version is the strategy memo: https://claude.ai/artifact/3v1rPdnNK5HdVJG6rfo2qP (refreshed monthly). The focus system and the adjacent-markets list: https://claude.ai/artifact/6TKsrWnSNDX6KXtcaiGPkf.

**Last reviewed:** 22 Oct 2026. Update this date whenever the card changes.

## North Star
Where To? gives a trusted, checked, personal answer to "where and when should I go for what I love?" People and AI assistants call it by name. We are not competing on screens, prose or booking.

## Three bets
1. Be the trusted layer that assistants and apps call, with the consumer app as the high-intent front door (read-only, keyed, rate-limited connector; no traveler data behind it).
2. Make verification visible (checked-on dates, sources) and turn the owner's decisions into tests that every data change must pass.
3. Collect the preference and correction data nobody else has: Travel DNA answers, saved places, trips taken, and every correction the owner makes.

## Priority order
Personal-fit loop and known truths first (run `npm run truths` before and after any data or code change; a FAIL means stop); verification of the facts that decide a trip next; distribution and real-user experiments after; polish last.

## Time budget (a guide, not a rule)
40% data and tests, 30% core loop, 15% distribution and real-user experiments, 15% play and exploration. Polish counts only in the 15%.

## The one-hour test
Score a task 0 to 2 on each: (1) compounds, (2) checkable, (3) reduces the biggest risk or teaches something from real people, (4) hard to copy, (5) gives the owner energy. 7 or more: do it. 4 or less: park it. A task that scores high only on energy goes in the play slot.

## Tripwires (stop and rethink if)
- Google or an assistant ships "best month for what I love" with real personalization.
- A competitor adds interest-based matching (watch WhenVerdict).
- A traveler is sent somewhere wrong because of our data.
- Fewer than 15 of 50 real users return within 30 days (once there are 50).

## Proof milestones
M1 100+ known truths holding (50 written by 22 Oct 2026; `npm run truths` checks them against the live data, list in `docs/known-truths.md`). M2 five friendly users finish onboarding. M3 an assistant can call the connector. M4 fifty saved profiles. M5 30-day return rate measured.

## Two month-long experiments (play budget)
- A "live here" lens on 20 places, shown to ten people considering a move.
- A one-page shoulder-season report for three destinations, sent to ten tourism boards.
Travel stays the main project.

## Daily brief (what to give, in about five lines)
1. Read this card, `docs/todo.md`, and the last few days of commits (`git log --oneline -15`). Run `npm run truths` first; if anything FAILS, that is item one for the day.
2. Give the top 3 things for today, each with its one-hour-test score and why.
3. Drift flag: if the last week's work was mostly low-scoring (polish, screens) against the budget above, say so plainly and ask if the owner wants to rebalance. The owner can overrule; note that they did.
4. Radar: one line on anything new since the last monthly refresh (or "nothing new").
5. Remind of the Friday scorecard on Fridays: what shipped, time by bucket (an estimate from commits and to-dos), one thing to stop, next week's top 3, parking lot.

The owner is non-technical and gets bored easily: keep it short, plain, and kind. Never lecture.
