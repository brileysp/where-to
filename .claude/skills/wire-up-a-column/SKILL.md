---
name: wire-up-a-column
description: Turn researched interest columns into the live app: define the columns, seed the database, connect the chips, save the question rules, add notes and to-dos, run the checks and commit. Use after research-a-column has produced the draft data and evidence files for an interest, or when asked to connect chips, map questions or make columns live.
---

# Wire up a column

Prerequisite: `scripts/data/<interest>-facts-draft.json` and `docs/evidence/<interest>-evidence.json` exist and their evidence test passes (skill `research-a-column`). Work in `where-to-app/`. Use `PLACE_ROWS_SNAPSHOT=1` for scripts (the Supabase plan is over quota; avoid repeated builds and large reads).

## 1. Define the columns
Add a `FactDef` array in `src/lib/admin/interest-pages/config.ts` and register it in `FACTS_BY_INTEREST` (see GOLF_FACTS, MOUNTAIN_BIKING_FACTS, CAMPING_FACTS). Put the formula, tier table and anchors in each hint. Use `rate()` for 0-10 ratings, `choice`/`multi` with `options` for lists, `text` (maxLength 4000, `wide`, group `draw`) for `evidence` and a `bool` `drawSourceChecked`. Run `npx tsc --noEmit -p .`.

## 2. Seed
Dry run, then apply:
```
PLACE_ROWS_SNAPSHOT=1 npx tsx scripts/seed-columns-oct24.ts --interest=<key> --file=scripts/data/<slug>-facts-draft.json [--overwrite=col1,col2] [--apply]
```
It fills only empty cells and skips N/A places. After the data changes, re-run with `--overwrite` listing the columns that changed (it is idempotent for the rest). Check the "would write" counts match the file.

## 3. Chips
Add one line per approved chip to MAP in `scripts/connect-chips-oct24.ts`: `['<interest>', '<chip-key>', [{ column: 'x' }]]`; for a choice value use `{ column, option }`. A chip must already be approved (the script leaves unapproved ones alone). Dry run, then `--apply`. Truth C15: a live chip's column must have a value for at least half of the interest's places.

## 4. Question rules
Rules live in `src/lib/onboarding/question-fit-rules.ts` as `'interest.qN': R(answer1, answer2, ...)` with one entry per answer option in the DB order (null = this answer asks for nothing). Read the questions and their options from the database before writing. Helpers: `has`, `within` (ordered choice, one step over loses half), `atLeast`, `atMost`, `range`, `count`, `warmest`, `onMonth`, `any`/`all` with `kHas`/`kAtLeast`; see `src/lib/onboarding/question-fit.ts`.
- **Do not read a mostly blank column** (truth C14: at least 70% of the interest's places must have a value). Leave that question unmapped, remove the rule, and add a to-do.
- Add a reason-chip message of 40 characters or fewer to `PROPOSED_MISS_MESSAGES`.
- Save: `PLACE_ROWS_SNAPSHOT=1 npx tsx scripts/apply-question-fit-oct21.ts` (dry) then `--apply`. This does not clear a removed rule: set `fit_rule` null and `miss_message` '' on that question with a small throwaway script and delete the script.
- Truth A04 requires the saved rules to equal the code's.

## 5. Tests
Add a `describe` block per interest to `tests/onboarding/question-fit.test.ts` (use `questionFit(rule, [pickedIndex], defs, facts)`; cover each answer, a half-credit step, and the null case, and assert unmapped questions have no rule). Evidence tests come from the research skill. Run `npx vitest run tests/data tests/onboarding`, then the full `npx vitest run`. The full run has timing flakes (for example `tests/scoring/curve.test.ts`): rerun that file alone before treating it as a failure.

## 6. Notes and to-dos
In `scripts/notes-oct24.ts` add `NOTES.<interest>` (what was built, counts, deviations, "nothing is marked source-checked", where the evidence is) and `TODOS` entries for every gap (unmapped questions, blank columns, soft numbers, deviations). Escape apostrophes in those single-quoted strings, then run the script. If counts change later, update both the script and the stored rows. Add a dated line to `docs/todo.md`.

## 7. Checks and commit
`npx tsc --noEmit -p .`, `npx vitest run`, `PLACE_ROWS_SNAPSHOT=1 npm run truths` (no FAIL; pending is fine). Commit locally with the trailer `Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>`. Never push. Delete any `scripts/_*.ts` and `public/_*.html` temp files. Update the project memory note for the interest.

## 8. Tell the owner
Plain language: what is filled and live, what is blank and why, what differs from what they approved (each with a yes/no decision), and what you need from them. Content for review goes into a published artifact with the full text and approve/change buttons, never a chat summary.
