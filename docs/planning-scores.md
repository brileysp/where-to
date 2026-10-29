# Planning scores (29 Oct 2026)

Four numbers on every interest (table `interest_meta`, edited on the Interests list and the interest page, never read by the scoring engine and never shown to travellers). All run 1 to 10; a person enters whole numbers.

| Score | Meaning | What it decides |
|---|---|---|
| Seasonal variance | How much the interest's score is expected to swing from month to month in a typical place. 10 = the season decides whether it works. | Seasonal-blurb effort: Very high (8-10) a blurb for every month, High (6-7) peak/shoulder/off, Medium (4-5) one overview, Low (1-3) one evergreen blurb plus notes for exceptions. |
| Evergreen | How long the data stays right unchecked. 10 = set it and forget it. | Review cadence: 1-2 weekly (nothing qualifies, that is the advisory layer), 3-4 monthly, 5-6 quarterly, 7-10 annually. Makes a repeating review to-do per interest. |
| Stakes | What a wrong fact costs a traveller: safety, a fine, money, a wasted trip. 10 = someone could be hurt. | How hard a fact is checked (second source, expert reviewer) and which stale items go first. |
| Refresh effort | Human time for one full refresh. 10 = every place is hand-researched, 1 = a script redoes it. | Turns the cadence into a time budget. (Direction chosen so a high number always means more work; the proposal artifact described it as "how much a script can redo", which is the reverse.) |

**Place exceptions.** An interest has one seasonal variance; a place whose own best-minus-worst-month swing is 4 or more points from the interest's median is flagged on the interest page (Planning card and the Swing column of Places & data). Resort towns that close for a season (Aspen, Zermatt, Santorini) are the usual ones.

**Review to-dos.** `scripts/make-review-todos.ts` makes one repeating to-do per interest (source "Review cadence"), with staggered check-on dates. Ticking it done creates the next one. The To do tab now repeats weekly, monthly, quarterly or annually. Truth A06 checks each interest has exactly one open review with the right cadence; A05 checks all four scores exist.

**How Stakes and Refresh effort were set (proposed, not yet approved by the owner).** Stakes: the columns an interest carries that touch safety, law or money (for example Mountaineering: climbing levels, guide rules, permits; Diving: certification, current; Fishing: catch-and-release and guide rules; Camping: wild camping law, dangerous wildlife), plus the cost of a wrong booking. Refresh effort: how each interest was built, from the repo and the evidence files: scripted from open data (Golf, Trail Running, Geology, Theme Parks), scripted with hand research for some columns (Camping, Fishing, Sailing, Kayaking, Wine), Gemini text plus fact-check (Hiking, Wildlife, Birding, Surfing, Diving), or judged place by place (Museums, Architecture, Luxury Hotels, Street Food). The reasons are stored with each score.

Data: `scripts/data/interest-planning.json`; logged by `scripts/seed-interest-planning.ts` (fills empty scores only; Seasonal variance and Evergreen carry the owner's approval from the proposal artifact, question 8). Design page: https://claude.ai/artifact/9FpVgTjwEpwMQgrXkRGEPJ.
