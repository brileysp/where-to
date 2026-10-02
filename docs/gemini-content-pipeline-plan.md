# Gemini content-generation pipeline — architecture plan

Charter: Gemini 2.5 Pro is the destination researcher and content author. Claude builds
and owns everything around it — orchestration, validation, storage, cost tracking,
versioning, and quality control. Claude never authors destination content itself in this
pipeline; it builds the system that gets Gemini's content in, checked, and stored
correctly. Priority order for every architectural decision: accuracy, reproducibility,
traceability, scalability, cost efficiency — in that order.

This supersedes the CSV/Sheets workflow as the long-term target (direct API integration,
no manual copy-paste through a spreadsheet), but doesn't throw that work away — see §7.

## 1. Pipeline shape

```
for each (place, interest) needing work:
  1. Build context   — existing score data, naSliders, anchors, related-interest
                        content (to avoid duplicate claims), the playbook's voice rules
  2. Call Gemini      — structured JSON output, versioned prompt, logged verbatim
  3. Validate         — schema, then content rules, then plausibility
  4. Log generation   — content_generations row, always, regardless of outcome
  5. Apply (if valid, and current rollout phase allows) — via existing
     applyAdminEdits/entity-registry.ts write path
  6. Track cost       — tokens + $ per call, per batch
```

Every generation is logged in step 4 before step 5 is even attempted — a rejected or
never-applied generation is not lost, it's a row with `validation_status: 'invalid'` or
`'pending'`.

## 2. Data model additions

### `content_generations` (new table)

One row per Gemini call, independent of whether it was ever applied to `places`.

| column | type | notes |
|---|---|---|
| `id` | uuid pk | |
| `batch_id` | uuid, nullable | groups one run together for cost/status reporting |
| `place_id` | text | FK-ish to `places.id` (text ids, same convention as elsewhere) |
| `interest_key` | text | one of `SLIDERS` |
| `kind` | enum | `'author'` (first-time, feeds the curve-fitter) \| `'correct'` (spot-fix, feeds `scoreOverrides`) \| `'wishlist'` (candidate destinations, doesn't touch `places` at all) |
| `prompt_version` | text | e.g. `"scenicLandscapes/v2"` |
| `prompt_hash` | text | sha256 of the exact prompt file content used |
| `input_context_hash` | text | sha256 of the exact context payload sent (existing scores, related content, etc.) — lets you prove what Gemini actually saw |
| `model` | text | e.g. `"gemini-2.5-pro"` |
| `temperature` | numeric | |
| `raw_response` | jsonb | the literal API response, untouched |
| `parsed_output` | jsonb | after Zod parsing, before content validation |
| `validation_status` | enum | `pending` \| `valid` \| `invalid` \| `applied` \| `superseded` |
| `validation_errors` | jsonb | structured list, not just a string blob |
| `tokens_in` / `tokens_out` | int | |
| `cost_usd` | numeric | computed at call time from a versioned pricing table (see §5) |
| `created_at` | timestamptz | |
| `applied_at` | timestamptz, nullable | |

Index on `(place_id, interest_key, created_at)` for "show me every attempt at this
place/interest over time" — the comparison/audit use case named in the charter.

### `content_generation_batches` (new table, optional but recommended)

`id, interest_key, kind, started_at, finished_at, place_count, total_cost_usd,
rollout_phase`. Exists purely for run-level reporting (§6) without aggregating
`content_generations` by hand every time.

## 3. Prompt versioning

Plain files, git-tracked: `prompts/<interest_key>/v<N>.md`. Front-matter block per file:
version, target model, a pointer to the output schema it expects (§4). Bumping the prompt
means a new file, never editing one in place — old generations stay attributable to the
exact text that produced them (`prompt_version` + `prompt_hash` together, so even an
accidental in-place edit to an old version file is still detectable).

A shared `prompts/_shared/voice-rules.md` holds the playbook's non-negotiable content
rules (§2 of `interest-content-authoring-playbook.md`) once, included by reference into
every interest's prompt — so a rule correction updates every prompt at once instead of
needing to be copy-pasted into 40+ files.

## 4. Structured output contract

Per (place, interest) call, Gemini returns (enforced via Gemini's native JSON-schema
response mode, not just asked for in prose):

```ts
{
  overview: string,               // blurb_overall
  monthly: Array<{                // exactly 12, Jan..Dec
    score: number,                 // 0-10, one decimal
    text: string,
  }>,
  sources: Array<{ url: string, note?: string }>,
  confidence: 'high' | 'medium' | 'low',
  flags: string[],                // e.g. "no reliable source for peak month"
}
```

This is deliberately the same shape as the Matrix CSV export's columns
(`score_jan`…`dec`, `blurb_jan`…`dec`, `blurb_overall`) — that work already proved out the
right column/field granularity; this just moves the same contract from "a human pastes
into a spreadsheet cell" to "the API returns it directly."

`confidence`/`flags` exist so Gemini can self-report uncertainty — a `low`-confidence or
flagged generation should route to human review even in a later, mostly-unattended rollout
phase (see §8), rather than being silently trusted at the same rate as everything else.

## 5. Validation (three layers, all must pass before `applied`)

1. **Schema.** Zod parse of the structured output — 12 months present, scores in [0,10],
   non-empty strings, etc. Purely mechanical.
2. **Content rules**, made executable from the playbook's own §1 Step 6 checklist:
   - same/near-identical text across months implies same-or-near score
   - a literal-max (10, or the interest's defined ceiling) run of 5+ months flagged for
     review
   - an isolated single-month cliff (2+ points from both neighbors, no textual reason)
     flagged
   - `INTEREST_ANCHORS` ceiling respected — a non-anchor place hitting 10 is a hard
     rejection, matching `db:audit:anchors`'s existing "OVER" gate
3. **Plausibility.** Cross-check against `naSliders` (an interest generated for a place
   that's flagged N/A for it is an immediate reject — context-building in step 1 should
   prevent this being sent at all, but validate anyway) and against already-authored
   sibling interests for the same place (e.g. a `wildlifeViewing` claim that exactly
   duplicates a `birding`-only species is flagged, per the playbook's overlap rule).

A pricing table (`prompts/_shared/pricing.json` — model → $/1M input tokens, $/1M output
tokens) is itself version-controlled, so a Gemini price change is a traceable diff, not a
silent recalculation.

## 6. Cost tracking

Every `content_generations` row carries its own `cost_usd`, computed at call time from the
pricing table above. A batch's `total_cost_usd` is just a sum. A CLI report
(`scripts/gemini-batch-report.ts`) reads `content_generation_batches` for a
per-interest-per-run cost/accuracy breakdown — needed before scaling to "hundreds or
thousands of destinations" so cost isn't discovered after the fact.

## 7. Relationship to the CSV/Sheets workflow already built

Not wasted, and not immediately deleted:

- The Matrix/Cost-Items CSV exports remain the **manual fallback** — for edge cases this
  pipeline handles badly (a genuinely ambiguous destination, Catalog Wishlist curation,
  which is inherently more editorial than mechanical), and as a way to manually inspect
  or correct a generation before/after the fact.
- The CSV column schema directly became this plan's structured-output contract (§4) — the
  work of deciding exactly what "score_jan" and "blurb_overall" should mean was already
  done building the export, not redone here.
- The `applyAdminEdits` write path, `entity-registry.ts` validators, and
  `fitMonthlyToCurve` curve-fitting are all pre-existing, already-tested code this
  pipeline reuses rather than forks.

## 8. Rollout — a trust ladder, not one leap to unattended

| Phase | Scope | Review |
|---|---|---|
| 0 — Pilot | 1 interest, ~10 places | every generation reviewed before apply |
| 1 — Full interest | same interest, all non-N/A places (~150-200) | spot-check a sample (~15-20%) |
| 2 — Expand | additional interests | spot-check rate tapers as measured agreement (human corrections vs. Gemini's raw output) earns trust per interest |
| 3 — Steady state | well-proven interests | unattended by default; a `low`-confidence or flagged generation (§4) still always routes to review |

"Runs against thousands of destinations without manual intervention" (the charter's
stated end-state) is Phase 3, earned per-interest by measured accuracy — not the starting
configuration.

## 9. What Claude needs from the user before building any of this

1. **Gemini API access** — a Google AI Studio API key, or a Vertex AI project? Whichever
   it is determines the SDK (`@google/genai` either way, but Vertex needs a GCP project +
   service account instead of a bare key) and where the credential lives
   (`GEMINI_API_KEY` in `.env.local`, matching the existing `ADMIN_EMAIL`/`SITE_PASSCODE`
   convention, if it's the AI Studio path).
2. **A cost ceiling** — a hard stop this pipeline should never exceed per batch run
   without an explicit override, so a bug can't produce a surprise bill.
3. **The Phase 0 pilot interest** — recommended default: `scenicLandscapes` (0 N/A places,
   so no edge cases to handle in the very first run; large formula family already well
   understood from `hiking`-formula work elsewhere). Confirm or override.
