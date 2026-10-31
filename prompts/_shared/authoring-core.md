<!--
  version: authoring-core/v1 (31 Oct 2026). Shared by every family directive in the family authoring plan (artifact "Gemini Authoring Plan", approved 31 Oct 2026).
  Built from voice-rules.md, the Diving directive that produced the approved text, and the two pilots: the pilot found the units rule missing and promotional words creeping in.
  Update here, not in each family file.
-->
## How to decide whether the interest applies
The interest applies when a visitor can reasonably do or see it on a trip to the place, even modestly or only in one season. "Not applicable" means nothing worth doing exists within a day trip: never use it because the place is small, remote or known for something else. If it does not apply, set applicable to false, give a reason of ten words or fewer in na_reason, leave the other fields empty, and stop. When you are unsure whether anything exists, say it applies and set confidence to low.

## How much to write
Write only as many month blurbs as this interest really needs in this place.
- If the time of year barely changes what a visitor can do or enjoy, write a single blurb for the whole year (depth "year"), and add a month blurb only where something real changes: a closure season, a festival that takes over the place, heat or cold that changes how visitors spend their time.
- If the seasons change things in clear stages, write blurbs for groups of months (depth "groups").
- If each month is genuinely different, cover every month with its own blurb (depth "months").
Never write a different blurb for months that are the same in reality: cover them together. Say in one line which depth you chose and why (depth_why).

## What to write
- overview: two or three sentences, at most 450 characters. What makes this place worth it for this interest, what a visitor will actually see or do, and when it is best. Every sentence tells the reader something new: mention each site, dish or fact once.
- blurbs: each covers one or more months (months, as numbers 1 to 12) and stands alone, so a reader who jumps straight to it understands exactly what is described. Name the actual site, street, dish or mechanism. At most 300 characters each. Every month is covered by exactly one blurb, unless the depth is "year", where one blurb covers all twelve. Give each blurb a level word for how good this interest is in those months relative to the best time in this place: peak, good, fair, poor or closed.
- best_months: the months, as numbers, when it is best (all twelve if the year is even).
- named_things: every specific named place, building, route, dish, venue, event or species your text relies on, so they can be checked.
- flags: anything you are not sure is accurate. Say so here rather than asserting it.
- confidence: high, medium or low, for how well you know this place for this interest.

## Rules
- Write the way a knowledgeable friend would describe the place to someone deciding whether to go: plain, specific, honest. Not a specialist, and no unexplained jargon.
- Every claim must be real and specific. Never invent or pattern-match a fact; never name a building, dish or venue unless you are sure it exists. State real odds honestly and never oversell something that is rare or hard to experience.
- No promotional language. Do not use words such as boasts, world-class, unparalleled, stunning, incredible, spectacular, breathtaking, paradise, unforgettable, legendary, teeming, thriving, must-see, hidden gem or bucket-list.
- Do not compare this place with other named destinations. Comparing its own seasons with each other is fine.
- Name no tour companies, operators or hotels. A museum, market, church or restaurant is named only when it is the reason to go and you are sure of it.
- Say nothing about politics, security or environmental crises.
- US units and spelling only: miles and feet, degrees Fahrenheit, American spelling. Never kilometers, meters, degrees Celsius or British spellings (color, center, neighbor).
