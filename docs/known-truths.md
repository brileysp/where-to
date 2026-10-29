# Known truths

Checked 2026-10-29. Each line is something that must always be true of Where To?, written as a test that can fail. Run `npm run truths` to check them against the live data.

**52 truths: 51 hold, 0 fail, 1 pending.** Pending means we know it does not hold yet and what will close it.

## Matching

| | Truth | Note |
|---|---|---|
| holds | M01: A missed answer or chip can only lower a place's score, never raise it. |  |
| holds | M02: However much is missed, an interest keeps at least the floor (30% by default) of its original score. |  |
| holds | M03: A place with nothing recorded for a chip or a question is never marked down for it. |  |
| holds | M04: Ticking no chips, or every chip, asks for nothing in particular and changes nothing. |  |
| holds | M05: A question that chips open is ignored until one of those chips is ticked, then it counts. |  |
| holds | M06: A chip that is still a draft can never be ticked or counted. |  |
| holds | M07: At most two reason chips show for a place, the biggest loss first, and none for a loss under the threshold. |  |
| holds | M08: Missing a Limit answer costs more than missing a Lean answer, and a missed chip costs at least as much as a missed Limit. |  |
| holds | M09: Answers are kept while a chip is unticked and count again the moment it is ticked again. |  |
| holds | M10: The built-in matching numbers are all inside their allowed ranges, and the floor sits below what a miss keeps. |  |
| holds | M11: An unanswered question never lowers a score. |  |
| holds | M12: The matching numbers saved in the admin are valid, and any left over from the defaults are listed. |  |

## Chips and questions

| | Truth | Note |
|---|---|---|
| holds | C01: Every chip in the admin is one the owner approved. |  |
| holds | C02: Every question in the admin is one the owner approved. |  |
| holds | C03: No chip the owner rejected or left undecided exists anywhere in the admin. |  |
| holds | C04: No answer the owner removed from a question has come back. |  |
| holds | C05: Every live chip has a measure of its own, and no live chip is still waiting on a column. |  |
| holds | C06: Every chip measure points at a real column of its own interest that can measure a chip. |  |
| holds | C07: No interest has more than 5 live chips. |  |
| holds | C08: Every question's column rule has exactly one entry per answer, so a reworded or reordered answer list cannot silently shift the checks. |  |
| holds | C09: No question lets a traveler pick more answers than it has. |  |
| holds | C10: Every link between a chip and a question joins a chip and a question of the same interest that both exist. |  |
| holds | C11: No question can be stranded: every question that chips open has at least one live chip that opens it. |  |
| holds | C12: Every question that is checked against place columns has a short reason-chip message (40 characters or less). |  |
| holds | C13: Every question's column rule reads columns that really exist for its interest. |  |
| holds | C14: No answer is checked against a rating or choice column that is mostly blank (at least 70% of the interest's places have a value). |  |
| holds | C14b: The text column that a question reads and that should be filled everywhere (Whale "Boat style") is filled for at least 70% of its places. Diving "Signature animals" is left blank on purpose where nothing is worth building a trip around (owner, 24 Oct 2026). |  |
| holds | C15: Every live chip measured on a rating or choice has a value for at least half of the interest's places. |  |

## Places and scores

| | Truth | Note |
|---|---|---|
| holds | P01: Every place has a name, a region and an emoji. |  |
| holds | P02: Every score is between 0 and 10, and every curve point is in a month from 1 to 12. |  |
| holds | P03: Every place marked not applicable for Safari, Diving, Surfing or Whale Watching has a stored reason. |  |
| holds | P04: No place, score or flag mentions an interest that was removed (Spectator Sports is now part of Festivals). |  |
| holds | P05: Hidden interests (Landscape Photography) are never offered in the interest picker, and removed ones are gone from it. |  |
| holds | P06: The Wildflowers interest is called "Blooms and Fall Colors", shown as "Blooms & Colors" on the pill. |  |
| holds | P07: The Red Sea & Nile is among the ten best places for diving. |  |
| holds | P09: The coast rule holds: a place scored for Surfing also has Beaches & Swimming switched on, and a place close enough to the ocean to have a surf or beach score is close enough to be considered for diving. It can be not applicable for murky water or no diving, but never for being "too far from the coast". (River and city swimming that has nothing to do with the ocean is not covered.) |  |
| holds | P10: Every place has both its peak crowd intensity and its seasonal price swing set (Crowds & prices reads them separately). |  |
| holds | P08: The Red Sea & Nile counts as a wreck-diving destination (its famous wrecks are recorded). |  |

## Facts

| | Truth | Note |
|---|---|---|
| holds | F01: Every stored fact is a legal value for its column: ratings 0 to 10, choices and lists from the allowed options. |  |
| holds | F02: No fact is stored under a column name that does not exist for its interest. |  |
| holds | F03: Water temperatures for Diving and Surfing are written so a number can be read from them (for example "54-79 F"). |  |
| pending | F04: Every safari place has an odds entry for "Great herds" (the migration chip measures it). | Safari to-do: Great herds is filled for 15 of 17 places (28 Oct 2026, sources in docs/evidence/safari-great-herds-evidence.json); Nepal and Uganda stay blank until a herd-size source is found (chip measures audit, item L5). |

## Text

| | Truth | Note |
|---|---|---|
| holds | T01: Every bird we name is written in Title Case in the live text ("Atlantic Puffin", not "atlantic puffin"). |  |
| holds | T02: Species-name markers (**) are balanced in every live text. |  |
| holds | T03: Live texts use US units (miles, feet, degrees F), never kilometers, meters or degrees C on their own. |  |
| holds | T04: Live texts use US spelling (color, center, neighbor), not UK spelling. Proper names such as "Wetland Centre" are left alone. |  |
| holds | T05: Animal names use American spelling ("gray seal", "Gray Heron"), the way eBird and NOAA write them. |  |
| holds | T06: Bird names are the eBird names: a name swept out on 22 Oct 2026 (Common Starling, Griffon Vulture, Little Auk and the rest) never comes back. |  |

## Admin

| | Truth | Note |
|---|---|---|
| holds | A01: Everything the owner approved records who approved it and when. |  |
| holds | A02: Every to-do marked done has a done date. |  |
| holds | A03: Every question's fit rule that is saved was written for the answers it has now (a rule never outlives a change to the answer list). |  |
| holds | A04: The code's own list of column rules and the saved rules agree (nothing was edited in one place only). |  |
