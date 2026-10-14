# Fact-checking Gemini text (hardwired 14 Oct 2026)

Why: the first Sedona hiking overview described "easy 2-mile loops around Bell Rock", a Cathedral Rock "climb" with no reason it was hard, and "highs near 100°F" in June. None of it was caught until the owner read it. Mechanical validation (lengths, scores, banned words) cannot catch a wrong fact.

## What is enforced in code
- `src/lib/gemini/claims.ts` finds every risky sentence in a generation: a named place or route, a number with a unit, an access or closure claim (permit, fee, huts, lifts, shuttle), a count or plural claim ("several", "loops", "network"), a hard superlative ("only", "longest"), a climate figure ("highs in the 70s", "wettest month").
- `src/lib/gemini/fact-check.ts` stores one row per sentence in `content_fact_checks` (verdict `unchecked`, `verified`, `wrong`, `owner_accepted`). A row is keyed by place, interest and a hash of the sentence, so an unchanged sentence keeps its verdict when text is edited, and an edited sentence starts again as `unchecked`.
- `applyGeneration` (`src/lib/gemini/apply.ts`) refuses to apply a generation while any risky sentence is not `verified` or `owner_accepted`. N/A drafts are exempt. The admin Apply button and `npm run pipeline:apply` both go through it. The only override is `pipeline:apply -- --skip-fact-check`, for the owner to use knowingly; it prints a warning.
- `verified` needs a source URL and a note saying what the source says; the code refuses it otherwise.

## Steps after Gemini returns text
1. Mechanical validator (existing: scores, lengths, banned words, v3 warnings).
2. `npx tsx scripts/fact-check.ts list --generation-id=<id> --out=file.json` lists the claims still to check and writes a skeleton.
3. Check every claim against a source, best first: official (park service, Forest Service, SANParks, NOAA normals) > guidebook or tourism board > reputable outfitter > blog. Use two sources when numbers conflict. For temperature claims, use climate normals for the nearest station.
4. A claim that is wrong, or that sources contradict, is rewritten to what the best source supports, or removed. Text never says "sources disagree". The rewrite goes in as a hand edit (`scripts/surfing-hand-edits.ts`, `INTEREST=<key>`), and its new sentences are checked like any others.
5. `npx tsx scripts/fact-check.ts set --place=<id> --interest=<key> --file=verdicts.json` records the verdicts. `... status --interest=<key>` shows progress per staged place.
6. A skeptical read by a person (Claude) of what the code cannot judge: level words against the numbers (a "strenuous" route that is 1 mile must say why), plural against singular, the overview against the months, two blurbs stating different facts about one route, a hike that belongs to another place in the catalog.
7. The review page leads with what the fact-check found and fixed, lists any claim that could not be verified, and links the sources.

## Averages do not disprove frequency claims
A monthly average cannot show that "regularly tops 100°F" is wrong: Sedona's June average high is 94°F and it still reaches 100°F about weekly in summer (about 20 days a year, one source). Before calling a "regularly", "often" or "rarely" claim wrong, look for counts (days above a threshold, days of rain). If only averages exist, mark it unverified and ask the owner; use `owner_accepted` with the reasoning when the owner decides.

## Before Gemini
Where an interest has a facts sheet (`docs/<interest>-facts.json`, the interest-page columns), fill and source-check it first, so Gemini starts from checked facts.

## Known limits
Sources are mostly tourism and hiking sites; some conflict. Claims are checked against what sources say, not against the ground. eBird, Avibase and some park sites block automated reads. 2026 access rules (permits, fees, reservation systems) change often; keep them out of text unless an official page confirms them.
