// Batch runner for the Gemini content-generation pipeline
// (docs/gemini-content-pipeline-plan.md). Generates content for a batch of
// (place, interest) pairs, validates it, and logs every attempt to
// content_generations. Per the user's staged-write-path decision
// (2026-09-28): this script NEVER writes to `places` — that's the whole
// point of the staging design. Generation is always "dry-run" in the sense
// that matters (nothing live changes); --dry-run is accepted as an explicit,
// documented no-op for anyone who wants to say so. Committing a specific
// generation (or a whole batch) is a separate, deliberate, id-scoped step —
// see scripts/pipeline-apply.ts — reached only after reviewing it with
// scripts/pipeline-diff.ts.
//
// Usage:
//   npx tsx scripts/gemini-author-batch.ts --interest=kayakingRafting --limit=5
//     Generate for places with no existing content yet (first-time authoring).
//   npx tsx scripts/gemini-author-batch.ts --interest=wildlifeViewing --reauthor --limit=14
//     Generate for places REGARDLESS of existing content — for re-authoring
//     low-quality legacy content. (--force is accepted as an alias.)
//   npx tsx scripts/gemini-author-batch.ts --interest=kayakingRafting --limit=5 --preview
//     Show which places would be selected — no Gemini calls, no DB writes at all.
//   npx tsx scripts/gemini-author-batch.ts --interest=wildlifeViewing --reauthor --limit=14 --prompt-version=v2
//     Use a specific prompt version instead of the latest one found in
//     prompts/<interest>/ (which is the default — see resolvePromptVersion below).
//   npx tsx scripts/gemini-author-batch.ts --interest=wildlifeViewing --reauthor --prefix=b --limit=50
//     Only consider places whose id starts with the given letter(s) — added
//     for "do the next batch alphabetically" requests, since candidates are
//     always sorted by id and there's no separate offset/skip flag: pass a
//     --limit comfortably above the actual count (use --preview first to see
//     how many actually match) rather than relying on the limit to trim it.
//
// Both `--flag value` and `--flag=value` work (see src/lib/gemini/cli.ts).

import { readFileSync, readdirSync } from 'fs';
import { join } from 'path';
import { eq } from 'drizzle-orm';
import { drizzle as drizzlePostgres } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import { places, contentGenerations, contentGenerationBatches } from '../src/lib/db/schema';
import { hashObject, sha256 } from '../src/lib/gemini/hashing';
import { computeCost } from '../src/lib/gemini/cost';
import { parseCliArgs, getString, getFlag } from '../src/lib/gemini/cli';
import type { GenerationContext } from '../src/lib/gemini/schema';

const DEFAULT_COST_CEILING_USD = 5; // per the user's confirmed Phase 0 guardrail — see plan doc §9
const ROLLOUT_PHASE = 0;
const KIND = 'author' as const;

/** v1 prompts use the original nested {overview, monthly:[{score,text}]}
 * wire schema; v2 and every version after it use the flat score_jan/
 * blurb_jan wire schema (the user's own JSON Output Contract directive,
 * 2026-09-29 — see schema.ts's generationOutputSchemaFlatV2). A hand-
 * maintained rule, not derived from the prompt file itself, matching the
 * same hand-sync discipline client.ts's RESPONSE_SCHEMA already uses
 * against schema.ts's Zod schema — update this if a future version ever
 * needs to go back to the nested shape for some reason. */
function schemaShapeForVersion(version: string): 'nested' | 'flat-v2' {
  return version === 'v1' ? 'nested' : 'flat-v2';
}

/** Prompt files are prompts/<interestKey>/v<N>.md, never edited in place
 * once real generations exist against them (see the plan doc §3) — bumping
 * means adding a new vN+1.md file. Defaults to the HIGHEST version present
 * so a freshly-added v2.md is picked up automatically on the next run with
 * no flag needed; --prompt-version=v1 (or any specific vN) pins an older
 * one explicitly, e.g. to reproduce or compare against a past result. */
function resolvePromptVersion(interestKey: string, override: string | undefined): string {
  const dir = join(__dirname, '..', 'prompts', interestKey);
  const files = readdirSync(dir).filter((f) => /^v\d+\.md$/.test(f));
  if (files.length === 0) throw new Error(`No prompt files found in prompts/${interestKey}/`);
  if (override) {
    const name = override.endsWith('.md') ? override : `${override}.md`;
    if (!files.includes(name)) throw new Error(`prompts/${interestKey}/${name} doesn't exist. Found: ${files.join(', ')}`);
    return override.replace(/\.md$/, '');
  }
  const highest = files.map((f) => Number(f.match(/^v(\d+)\.md$/)![1])).sort((a, b) => b - a)[0];
  return `v${highest}`;
}

function loadDotEnvLocal(): Record<string, string> {
  const out: Record<string, string> = {};
  const raw = readFileSync(join(__dirname, '..', '.env.local'), 'utf8');
  for (const line of raw.split('\n')) {
    const t = line.trim();
    if (!t || t.startsWith('#')) continue;
    const i = t.indexOf('=');
    if (i === -1) continue;
    let v = t.slice(i + 1).trim();
    if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) v = v.slice(1, -1);
    out[t.slice(0, i).trim()] = v;
  }
  return out;
}

async function main() {
  const args = parseCliArgs(process.argv.slice(2));
  const interestKey = getString(args, 'interest') ?? 'kayakingRafting';
  const limit = Number(getString(args, 'limit') ?? '5');
  const prefix = getString(args, 'prefix')?.toLowerCase();
  const costCeiling = Number(getString(args, 'cost-ceiling') ?? String(DEFAULT_COST_CEILING_USD));
  const preview = getFlag(args, 'preview');
  const reauthor = getFlag(args, 'reauthor') || getFlag(args, 'force');
  // --dry-run is accepted but changes nothing — see the file header. It
  // exists so a command copy-pasted with it stays valid, not because it
  // does anything --dry-run's absence wouldn't already do.
  void getFlag(args, 'dry-run');

  console.log(`Gemini batch — interest=${interestKey} limit=${limit} costCeiling=$${costCeiling} phase=${ROLLOUT_PHASE}${reauthor ? ' [REAUTHOR]' : ''}${preview ? ' [PREVIEW]' : ''}`);

  const env = loadDotEnvLocal();
  if (!env.DATABASE_URL) {
    console.error('No DATABASE_URL in .env.local');
    process.exit(1);
  }
  const db = drizzlePostgres(postgres(env.DATABASE_URL, { prepare: false }));

  // Candidates: always excludes real N/A places (a structural fact, not a
  // content gap). Without --reauthor: only places missing content entirely
  // (first-time authoring). With --reauthor: every non-N/A place, regardless
  // of what's already there — for replacing low-quality legacy content.
  const allPlaces = await db.select().from(places);
  const candidates = allPlaces
    .filter((p) => !(p.naSliders ?? []).includes(interestKey))
    .filter((p) => reauthor || !((p.sliderOverview as Record<string, string>)?.[interestKey]))
    .filter((p) => !prefix || p.id.toLowerCase().startsWith(prefix))
    .sort((a, b) => a.id.localeCompare(b.id))
    .slice(0, limit);

  console.log(`Found ${candidates.length} candidate place(s) for "${interestKey}"${reauthor ? ' (re-authoring existing content)' : ' (missing content)'}.`);
  candidates.forEach((p) => console.log(`  - ${p.name} (${p.id})`));

  if (preview) {
    console.log('\nPreview only — no Gemini calls made, nothing written.');
    process.exit(0);
  }
  if (candidates.length === 0) {
    console.log('Nothing to do.');
    process.exit(0);
  }
  if (!env.GEMINI_API_KEY) {
    console.error('\nNo GEMINI_API_KEY in .env.local — add one (see .env.example) before running for real.');
    process.exit(1);
  }
  process.env.GEMINI_API_KEY = env.GEMINI_API_KEY; // client.ts reads process.env directly

  const { generate, MODEL } = await import('../src/lib/gemini/client');
  const { validateContent, validatePlausibility, overallStatus } = await import('../src/lib/gemini/validate');

  const { unverified: pricingUnverified } = computeCost(MODEL, 0, 0);
  if (pricingUnverified) {
    console.log(`\n⚠️  ${MODEL}'s pricing is UNVERIFIED (see prompts/_shared/pricing.json) — cost figures below are a placeholder estimate, not a confirmed rate. The --cost-ceiling guardrail is advisory only until this is fixed.\n`);
  }

  const resolvedVersion = resolvePromptVersion(interestKey, getString(args, 'prompt-version'));
  const promptTemplate = readFileSync(join(__dirname, '..', 'prompts', interestKey, `${resolvedVersion}.md`), 'utf8');
  const voiceRules = readFileSync(join(__dirname, '..', 'prompts', '_shared', 'voice-rules.md'), 'utf8');
  const promptVersion = `${interestKey}/${resolvedVersion}`;
  const promptHash = sha256(promptTemplate + voiceRules); // both together, since voiceRules is inlined into the final prompt
  console.log(`Using prompt: ${promptVersion}`);

  const [batch] = await db
    .insert(contentGenerationBatches)
    .values({ interestKey, kind: KIND, rolloutPhase: ROLLOUT_PHASE, placeCount: candidates.length })
    .returning();

  let totalCost = 0;
  let anyUnverified = false;
  const summary: Array<{ place: string; status: string; cost: number; rejects: number; warnings: number; generationId: string }> = [];

  for (const place of candidates) {
    if (totalCost >= costCeiling) {
      console.log(`\nCost ceiling ($${costCeiling}) reached — stopping before ${place.name}. Raise --cost-ceiling to continue.`);
      break;
    }

    // Related-interest summaries: already-authored content for OTHER
    // interests at this place, so Gemini doesn't restate a claim another
    // slider already owns (playbook §2's overlap rule) — first sentence
    // only, kept short.
    const overviews = (place.sliderOverview as Record<string, string>) ?? {};
    const relatedInterestSummaries = Object.entries(overviews)
      .filter(([key]) => key !== interestKey)
      .map(([key, text]) => ({ interestKey: key, label: key, firstSentence: text.split(/(?<=[.!?])\s/)[0] ?? text }));

    const context: GenerationContext = {
      placeId: place.id,
      placeName: place.name,
      region: place.region,
      about: place.about ?? null,
      interestKey,
      interestLabel: interestKey,
      relatedInterestSummaries,
    };
    const contextHash = hashObject(context);

    const prompt = promptTemplate.replace('{{VOICE_RULES}}', voiceRules).replace('{{CONTEXT_JSON}}', JSON.stringify(context, null, 2));

    console.log(`\n-- ${place.name} (${place.id}) --`);
    let result;
    try {
      result = await generate(prompt, schemaShapeForVersion(resolvedVersion));
    } catch (err) {
      console.error(`  API call failed: ${err instanceof Error ? err.message : String(err)}`);
      summary.push({ place: place.name, status: 'api_error', cost: 0, rejects: 0, warnings: 0, generationId: '—' });
      continue;
    }

    const { costUsd: cost, unverified } = computeCost(result.model, result.tokensIn, result.tokensOut);
    totalCost += cost;
    anyUnverified ||= unverified;
    console.log(`  tokens in=${result.tokensIn} out=${result.tokensOut} cost=$${cost.toFixed(4)}${unverified ? ' [UNVERIFIED PRICE]' : ''} (running total $${totalCost.toFixed(4)})`);

    let status: 'valid' | 'invalid' = 'invalid';
    const issues: Array<{ layer: 'schema' | 'content' | 'plausibility'; severity: 'reject' | 'warning'; message: string }> = [];

    if (!result.parsed) {
      issues.push({ layer: 'schema', severity: 'reject', message: result.parseError ?? 'unknown parse failure' });
    } else {
      // Self-consistency issues from normalizeFlatOutput (flat-v2 only —
      // does Gemini's own declared score_max/score_min match its actual
      // 12 scores) — a real internal-arithmetic mistake, not a judgment
      // call, so these are rejects same as any other content-layer issue.
      for (const msg of result.selfCheckIssues) issues.push({ layer: 'schema', severity: 'reject', message: msg });
      issues.push(...validateContent(result.parsed, interestKey, place.id));
      issues.push(...validatePlausibility(place.naSliders ?? [], interestKey));
      status = overallStatus(issues);
    }

    const rejects = issues.filter((i) => i.severity === 'reject').length;
    const warnings = issues.filter((i) => i.severity === 'warning').length;
    if (issues.length > 0) {
      console.log(`  ${rejects} reject(s), ${warnings} warning(s):`);
      issues.forEach((i) => console.log(`    [${i.severity}/${i.layer}] ${i.message}`));
    } else {
      console.log('  clean — no issues found.');
    }

    const [genRow] = await db
      .insert(contentGenerations)
      .values({
        batchId: batch.id,
        placeId: place.id,
        interestKey,
        kind: KIND,
        promptVersion,
        promptHash,
        inputContextHash: contextHash,
        model: result.model,
        temperature: result.temperature,
        rawResponse: result.raw as object,
        parsedOutput: result.parsed as object | undefined,
        validationStatus: status,
        validationErrors: issues,
        tokensIn: result.tokensIn,
        tokensOut: result.tokensOut,
        costUsd: cost,
      })
      .returning();

    summary.push({ place: place.name, status, cost, rejects, warnings, generationId: genRow.id });
  }

  await db
    .update(contentGenerationBatches)
    .set({ totalCostUsd: totalCost, finishedAt: new Date() })
    .where(eq(contentGenerationBatches.id, batch.id));

  console.log(`\n=== Batch ${batch.id} done ===`);
  console.log(`Total cost: $${totalCost.toFixed(4)}${anyUnverified ? '  ⚠️  UNVERIFIED PRICING — this model\'s rate is a placeholder, not a confirmed number (see prompts/_shared/pricing.json). Treat this total as directional only.' : ''}`);
  console.table(summary);
  console.log(`\nNothing was applied to places — that never happens here. Review with:`);
  console.log(`  npm run pipeline:diff -- --generation-id=<id>`);
  console.log(`Then commit a reviewed generation with:`);
  console.log(`  npm run pipeline:apply -- --generation-id=<id>`);
  console.log(`Or the whole batch at once: npm run pipeline:apply -- --batch-id=${batch.id}`);
  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
