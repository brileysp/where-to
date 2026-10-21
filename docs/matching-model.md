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
| A missed Limit answer keeps | 50% |
| A missed Lean answer keeps | 85% |
| An interest never keeps less than | 30% |
| Show a reason chip when a miss takes off at least | 15% |
| Most reason chips on a card | 2 |

## The code

- `matchInterest()` in `src/lib/scoring/personalMatch.ts` does it for one interest and place (and month). Tested in `tests/scoring/personalMatch.test.ts`.
- Which questions are asked comes from `src/lib/onboarding/question-rules.ts`; only asked questions are checks.
- Each question has a "reason chip" message (`interest_questions.miss_message`), edited in the question editor. Blank = no chip.

## Not built yet

1. A rating column for every chip, written and checked (a chip's rating must not reuse a field like "main draw": the Red Sea reads as having no wrecks).
2. ~~A fit for each question from its columns~~ **Done for the seven interests with data (21 Oct 2026, owner-reviewed):** `src/lib/onboarding/question-fit.ts` (checks) and `question-fit-rules.ts` (the 28 rules), saved in `interest_questions.fit_rule` and shown read-only in the question editor. Other interests wait on their columns.
3. Storing the traveler's ticked chips and answers, and calling `matchInterest` from the scoring (replacing the old "styles" multiplier in `styleAdjustedScore`).
4. Shadow mode first: calculate it, record what would change, show nothing until the biggest drops have been read.
5. The reason chips and green match chips, **in the place's detail sheet only** (owner decision 21 Oct 2026; the card stays as it is today). The sheet's "adjusted lower because..." sentence gains the chips, the original and for-you scores, and a per-interest breakdown. Mockup: claude.ai/artifact/C8YqFKXEck6DufewouZyYt.
6. Reason-chip messages (`interest_questions.miss_message`): written for the 28 mapped questions (21 Oct 2026); the rest are written as their columns land.
