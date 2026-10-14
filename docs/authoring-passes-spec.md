# Authoring passes: when each Gemini run finished and what it cost

Spec written and built 10 Oct 2026.

## What the owner asked for
Record, for every interest, **when each Gemini authoring pass finished** and **how much each batch cost in total tokens**, show it on the admin screens, and keep recording future passes automatically.

## What existed before
- Every Gemini run already created a row in `content_generation_batches` with a start time, a finish time (blank if the run died), a place count and a total dollar cost. Nothing on any admin screen showed it.
- Token counts existed only per place (`content_generations.tokens_in/out`), never added up per batch.
- There was no notion of a "pass". Birding was re-run over the same 200 places with prompt versions v1, v2, v4, v5, v6, v7, v8, so the history was 113 loose batches.

## Definitions
- **Batch**: one run of `gemini-author-batch.ts` over some places. Already exists.
- **Pass**: a named round of authoring for one interest, normally one prompt version over the catalog, made of one or more batches (for example "Birding, v8" or "Diving, v7: initial 200 places"). **New.**
- **Finished date of a pass**: set when the pass is marked finished. Until then the screen shows the date of its latest batch and the label "in progress".
- **Tokens**: input tokens, and output tokens (Gemini counts its hidden reasoning as output, so this is the number that is billed). Shown as in / out / total.

## Data
New table `authoring_passes`: `id`, `interest_key`, `label`, `kind` (initial, redo, targeted, pilot), `prompt_version`, `notes`, `finished_at` (empty while in progress), `created_at`.
New columns on `content_generation_batches`: `pass_id`, `prompt_version`, `model`, `thinking_level`, `tokens_in`, `tokens_out`.

## Behaviour
1. **Recording is automatic.** When the batch script starts a batch it finds the open pass for that interest and prompt version, or creates one named "<Interest> · <version>", and attaches the batch. When the batch ends it writes the finish time, total cost, token totals, model, prompt version and thinking level. `--pass="Name"` picks or creates a named pass instead.
2. **Finishing a pass is a deliberate act**, because only the owner knows when a round is really done: a button on the admin screen, or `--finish-pass` on the last batch. It can be reopened.
3. **Backfill.** The 113 existing batches are grouped into passes by interest and prompt version, token totals are rebuilt from the per-place rows, and each finished pass takes its last batch's finish time. The current diving pass (v7) stays open. Empty or crashed runs with no results are left out of the screens. Hand-edit batches (whale source checks) become a "targeted" pass.
4. **Where it shows.**
   - New **Authoring** tab on every interest page: one row per pass (label, kind, finished date or in progress, places, prompt version, model, tokens in/out/total, cost) that opens to its batches (date and time, places, valid / invalid / not applicable / applied, tokens, cost). The label, kind and notes can be edited; Mark finished and Reopen are buttons there.
   - The interest page header shows "Last Gemini pass finished <date>".
   - The Interests list gets a "Last Gemini pass" column.
   - Hand-edit passes (kind "targeted") are listed on the tab but never counted as the last Gemini pass.
5. Every admin write goes through the audit log like all other admin edits.

## Not in scope
- Authoring done by Claude scripts rather than Gemini (for example the older `author-*.ts` scripts) is not recorded here.
- Changing the cost figures themselves (pricing is the table in `prompts/_shared/pricing.json`).
