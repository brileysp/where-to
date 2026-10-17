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
//   npx tsx scripts/gemini-author-batch.ts --interest=whaleWatching --reauthor --include-na --limit=5
//     Also include places currently marked N/A for this interest, so the model decides applicability (whaleWatching/v1).
//   npx tsx scripts/gemini-author-batch.ts --interest=whaleWatching --reauthor --include-na --skip-clear-na --limit=200
//     Same, but never sends the places in docs/whaleWatching-clear-na.json (no sea within a day trip). Prints the skipped ids.
//   npx tsx scripts/gemini-author-batch.ts --interest=wildlifeViewing --reauthor --limit=14
//     Generate for places REGARDLESS of existing content — for re-authoring
//     low-quality legacy content. (--force is accepted as an alias.)
//   npx tsx scripts/gemini-author-batch.ts --interest=kayakingRafting --limit=5 --preview
//     Show which places would be selected — no Gemini calls, no DB writes at all.
//   npx tsx scripts/gemini-author-batch.ts --interest=wildlifeViewing --reauthor --limit=14 --prompt-version=v2
//     Use a specific prompt version instead of the latest one found in
//     prompts/<interest>/ (which is the default — see resolvePromptVersion below).
//   npx tsx scripts/gemini-author-batch.ts --interest=birding --reauthor --prefix=g --limit=5 --model=gemini-3-flash-preview
//     Use a different Gemini model (must have an entry in prompts/_shared/pricing.json).
//   npx tsx scripts/gemini-author-batch.ts --interest=wildlifeViewing --reauthor --prefix=b --limit=50
//     Only consider places whose id starts with the given letter(s) — added
//     for "do the next batch alphabetically" requests, since candidates are
//     always sorted by id and there's no separate offset/skip flag: pass a
//     --limit comfortably above the actual count (use --preview first to see
//     how many actually match) rather than relying on the limit to trim it.
//
// Both `--flag value` and `--flag=value` work (see src/lib/gemini/cli.ts).

import { existsSync, readFileSync, readdirSync } from 'fs';
import { join } from 'path';
import { and, eq, isNull } from 'drizzle-orm';
import { SLIDERS } from '../src/lib/scoring/constants';
import { drizzle as drizzlePostgres } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import { places, contentGenerations, contentGenerationBatches, authoringPasses } from '../src/lib/db/schema';
import { hashObject, sha256 } from '../src/lib/gemini/hashing';
import { computeCost } from '../src/lib/gemini/cost';
import { parseCliArgs, getString, getFlag } from '../src/lib/gemini/cli';
import { decimalizeScores, flatScoresIfSingleBlurb, holdFlatBands, holdFlatMonths } from '../src/lib/gemini/decimalize';
import { flatBandMonths, isBlocky, smoothBlockyScores } from '../src/lib/gemini/smooth-scores';
import { avoidRoundScores } from '../src/lib/gemini/even-tenths';
import { convertTemperaturesToF } from '../src/lib/text/temperature';
import { convertMetersToFeet } from '../src/lib/text/length';
import { metricToImperial } from '../src/lib/text/units';
import { ownNameDistanceIssues } from '../src/lib/gemini/place-name-check';
import { usesMonthsNotSeasons } from '../src/lib/gemini/hemisphere';
import { loadSkipList } from '../src/lib/gemini/skip-list';
import type { GenerationContext } from '../src/lib/gemini/schema';

const DEFAULT_COST_CEILING_USD = 5; // per the user's confirmed Phase 0 guardrail — see plan doc §9
const ROLLOUT_PHASE = 0;
const KIND = 'author' as const;


// ---- Birding draw-bird list (docs/birding-draw-birds.json) ----
type DrawEntry = { id: string; drawBirds: string[]; sourceChecked: boolean; note: string };
let drawBirdIndex: Map<string, DrawEntry> | null = null;
function drawEntryFor(placeId: string): DrawEntry | undefined {
  if (!drawBirdIndex) {
    const raw = JSON.parse(readFileSync(join(__dirname, '..', 'docs', 'birding-draw-birds.json'), 'utf8')) as DrawEntry[];
    drawBirdIndex = new Map(raw.map((e) => [e.id, e]));
  }
  return drawBirdIndex.get(placeId);
}
// ---- Verified fact sheets (docs/<interest>-facts.json): sent to Gemini as ground truth, plus a post-check ----
type FactSheet = { forPlaceName?: string; scope: string; facts: string[]; avoid: string[]; season: string; mustMention: string[] };
function factSheetFor(interestKey: string, placeId: string): FactSheet | undefined {
  try {
    const raw = JSON.parse(readFileSync(join(__dirname, '..', 'docs', `${interestKey}-facts.json`), 'utf8')) as Record<string, FactSheet>;
    return raw[placeId];
  } catch { return undefined; }
}
const DRAW_STOPWORDS = new Set(['colonies', 'colony', 'passage', 'migration', 'winter', 'spring', 'summer', 'autumn', 'rare', 'with', 'luck', 'and', 'the', 'night', 'tours', 'species', 'specialties', 'lowland', 'pelagics', 'pelagic', 'trips', 'seawatching', 'fallouts', 'uncommon', 'occasional', 'breeding']);
/** Does the overview mention this draw bird? Fuzzy on purpose: every significant word of the
 * bird's name (parentheses and "/" alternatives removed) must appear, ignoring plural -s. */
function mentionsDrawBird(overview: string, entry: string): boolean {
  const text = overview.toLowerCase().replace(/geese/g, 'goose').replace(/mice/g, 'mouse');
  return entry.split(' / ').some((alt) => {
    const tokens = alt.replace(/\(.*?\)/g, ' ').toLowerCase().replace(/geese/g, 'goose').split(/[^a-zàâçéèêëîïôûùüÿñæœ'-]+/).filter((t) => t.length >= 4 && !DRAW_STOPWORDS.has(t));
    return tokens.length > 0 && tokens.every((t) => text.includes(t.replace(/s$/, '')));
  });
}

/** v1 prompts use the original nested {overview, monthly:[{score,text}]}
 * wire schema; v2 and every version after it use the flat score_jan/
 * blurb_jan wire schema (the user's own JSON Output Contract directive,
 * 2026-09-29 — see schema.ts's generationOutputSchemaFlatV2). A hand-
 * maintained rule, not derived from the prompt file itself, matching the
 * same hand-sync discipline client.ts's RESPONSE_SCHEMA already uses
 * against schema.ts's Zod schema — update this if a future version ever
 * needs to go back to the nested shape for some reason. */
function schemaShapeForVersion(version: string, promptTemplate: string): 'nested' | 'flat-v2' | 'flat-v2-fit' | 'flat-v2-surf' | 'flat-v2-hike' {
  // hiking also returns day_hike_rating and trek_rating.
  if (promptTemplate.includes('day_hike_rating')) return 'flat-v2-hike';
  // surfing also returns beginner_rating and advanced_rating.
  if (promptTemplate.includes('beginner_rating')) return 'flat-v2-surf';
  // snorkeling & diving also returns diving_rating, snorkeling_rating and best_for.
  if (promptTemplate.includes('diving_rating')) return 'flat-v2-fit';
  // A prompt that spells out the flat score_jan/blurb_jan contract is flat-v2
  // regardless of its version number (birding/v1 is the first v1 that is).
  if (promptTemplate.includes('score_jan')) return 'flat-v2';
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
  const idsArg = getString(args, 'ids')?.split(',').map((x) => x.trim()).filter(Boolean); // exact place ids, e.g. --ids=kruger,kenya
  // --names takes CURRENT place names (e.g. --names="French Polynesia,Chicago") so nobody has to read a name off an internal id.
  const namesArg = getString(args, 'names')?.split(',').map((x) => x.trim().toLowerCase()).filter(Boolean);
  const costCeiling = Number(getString(args, 'cost-ceiling') ?? String(DEFAULT_COST_CEILING_USD));
  // Thinking is always capped (client.ts DEFAULT_THINKING_LEVEL, currently low). --thinking only picks a different level,
  // and anything above the default also needs --allow-higher-thinking.
  const thinkingArg = getString(args, 'thinking');
  const modelOverride = getString(args, 'model'); // e.g. --model=gemini-3-flash-preview; default is client.ts's MODEL
  const preview = getFlag(args, 'preview');
  const smoothBlockyFlag = getFlag(args, 'smooth-blocky');
  const runDigitCounts: number[] = new Array(10).fill(0);
  // Places renamed or broadened in Oct 2026 must have a scope sheet (see docs/renamed-places.json); --allow-unscoped-renamed overrides.
  const allowUnscopedRenamed = getFlag(args, 'allow-unscoped-renamed');
  const renamedPlaces = new Map<string, string>(Object.entries((JSON.parse(readFileSync(join(__dirname, '..', 'docs', 'renamed-places.json'), 'utf8')) as { ids: Record<string, string> }).ids));
  const reauthor = getFlag(args, 'reauthor') || getFlag(args, 'force');
  // --include-na: also generate for places currently marked N/A, so the model decides applicability itself (whaleWatching/v1 §1).
  const includeNa = getFlag(args, 'include-na');
  // --skip-clear-na: never send the places listed in docs/<interest>-clear-na.json (clear N/A: no sea within a day trip).
  const skipClearNa = getFlag(args, 'skip-clear-na');
  const skipList = skipClearNa ? loadSkipList(interestKey) : new Map<string, string>();
  // --dry-run is accepted but changes nothing — see the file header. It
  // exists so a command copy-pasted with it stays valid, not because it
  // does anything --dry-run's absence wouldn't already do.
  void getFlag(args, 'dry-run');

  console.log(`Gemini batch — interest=${interestKey} limit=${limit} costCeiling=$${costCeiling} phase=${ROLLOUT_PHASE}${reauthor ? ' [REAUTHOR]' : ''}${includeNa ? ' [INCLUDE-NA]' : ''}${skipClearNa ? ` [SKIP-CLEAR-NA: ${skipList.size}]` : ''}${preview ? ' [PREVIEW]' : ''}`);

  const env = loadDotEnvLocal();
  process.env.DATABASE_URL ??= env.DATABASE_URL; // the shared db client (used by loadAnchorOverrides) reads process.env, and falls back to an empty local database without it
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
  if (namesArg) {
    const known = new Set(allPlaces.map((p) => p.name.toLowerCase()));
    const unknown = namesArg.filter((n) => !known.has(n));
    if (unknown.length) { console.error(`Unknown place name(s): ${unknown.join(', ')}. Use the current name shown in the admin (an old name will not match).`); process.exit(1); }
  }
  const candidates = allPlaces
    .filter((p) => includeNa || !(p.naSliders ?? []).includes(interestKey))
    .filter((p) => reauthor || !((p.sliderOverview as Record<string, string>)?.[interestKey]))
    .filter((p) => !prefix || p.id.toLowerCase().startsWith(prefix))
    .filter((p) => !idsArg || idsArg.includes(p.id))
    .filter((p) => !namesArg || namesArg.includes(p.name.toLowerCase()))
    .filter((p) => !skipList.has(p.id))
    .sort((a, b) => a.id.localeCompare(b.id))
    .slice(0, limit);

  if (skipClearNa) {
    const skipped = allPlaces.filter((p) => skipList.has(p.id)).map((p) => p.id).sort();
    console.log(`Skipping ${skipped.length} clear N/A place(s), never sent to Gemini: ${skipped.join(', ')}`);
  }
  console.log(`Found ${candidates.length} candidate place(s) for "${interestKey}"${reauthor ? ' (re-authoring existing content)' : ' (missing content)'}.`);
  // Rough guide from past capped runs (whale watching $0.034, birding v8 $0.039, safari $0.038 a place); the real cost is tracked per call.
  console.log(`Rough cost at thinking level "${thinkingArg ?? 'low'}" (capped): ${candidates.length} places x about $0.035-0.04 = about $${(candidates.length * 0.035).toFixed(2)}-${(candidates.length * 0.04).toFixed(2)}.`);
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

  const { generate, MODEL, resolveThinkingLevel, assertThinkingLevelAllowed } = await import('../src/lib/gemini/client');
  const thinkingLevel = resolveThinkingLevel(thinkingArg);
  assertThinkingLevelAllowed(thinkingLevel, getFlag(args, 'allow-higher-thinking'));
  console.log(`Thinking level: ${thinkingLevel} (capped; the cap is hard-wired in client.ts)`);
  const { validateContent, validatePlausibility, overallStatus, isNotApplicable, bestForFromRatings } = await import('../src/lib/gemini/validate');
  // Anchors edited on the admin Rules tab (the places allowed a 10) override the built-in list for the validator.
  await (await import('../src/lib/scoring/anchorOverrides')).loadAnchorOverrides(true);

  const { unverified: pricingUnverified } = computeCost(MODEL, 0, 0);
  if (pricingUnverified) {
    console.log(`\n⚠️  ${MODEL}'s pricing is UNVERIFIED (see prompts/_shared/pricing.json) — cost figures below are a placeholder estimate, not a confirmed rate. The --cost-ceiling guardrail is advisory only until this is fixed.\n`);
  }

  const resolvedVersion = resolvePromptVersion(interestKey, getString(args, 'prompt-version'));
  const promptTemplate = readFileSync(join(__dirname, '..', 'prompts', interestKey, `${resolvedVersion}.md`), 'utf8');
  const voiceRules = readFileSync(join(__dirname, '..', 'prompts', '_shared', 'voice-rules.md'), 'utf8');
  // {{VOICE_RULES_OPEN_TOP}}: the shared rules without the "a literal maximum score is rare" bullet, for interests where the owner wants the model's own view of what a 10 is (surfing v4).
  const voiceRulesOpenTop = voiceRules.replace(/- \*\*A literal maximum score[\s\S]*?(?=\n- \*\*|\s*$)/, '').replace(/\n{3,}/g, '\n\n');
  const promptVersion = `${interestKey}/${resolvedVersion}`;
  // {{ON_FOOT_CORE}}: the shared rules of the on-foot family (hiking, scenic landscapes, camping, trail running), one file for all of them.
  const onFootCorePath = join(__dirname, '..', 'prompts', '_shared', 'on-foot-core.md');
  const onFootCore = existsSync(onFootCorePath) ? readFileSync(onFootCorePath, 'utf8').replace(/<!--[\s\S]*?-->/g, '').trim() : '';
  if (promptTemplate.includes('{{ON_FOOT_CORE}}') && !onFootCore) throw new Error('prompts/_shared/on-foot-core.md is missing but this prompt includes {{ON_FOOT_CORE}}');
  const promptHash = sha256(promptTemplate + voiceRules + onFootCore); // both together, since voiceRules is inlined into the final prompt
  console.log(`Using prompt: ${promptVersion}`);

  // Authoring passes (docs/authoring-passes-spec.md): attach this batch to the open pass for this interest and prompt version, or start one.
  // --pass="Name" picks or creates a named pass instead; --finish-pass marks the pass finished when this batch ends.
  const passLabelArg = getString(args, 'pass');
  const finishPass = getFlag(args, 'finish-pass');
  const interestLabelText = SLIDERS.find((sl) => sl.key === interestKey)?.label ?? interestKey;
  const defaultPassLabel = `${interestLabelText} · ${resolvedVersion}`;
  const openPasses = await db.select().from(authoringPasses).where(and(eq(authoringPasses.interestKey, interestKey), isNull(authoringPasses.finishedAt)));
  let pass = openPasses.find((p) => (passLabelArg ? p.label === passLabelArg : p.promptVersion === promptVersion));
  if (!pass) {
    const earlier = await db.select({ id: authoringPasses.id, label: authoringPasses.label, kind: authoringPasses.kind }).from(authoringPasses).where(eq(authoringPasses.interestKey, interestKey));
    const label = passLabelArg ?? (earlier.some((p) => p.label === defaultPassLabel) ? `${defaultPassLabel} (${new Date().toISOString().slice(0, 10)})` : defaultPassLabel);
    [pass] = await db
      .insert(authoringPasses)
      .values({ interestKey, label, kind: earlier.length === 0 ? 'initial' : candidates.length < 15 ? 'pilot' : 'redo', promptVersion })
      .returning();
  }
  console.log(`Pass: ${pass.label}${finishPass ? ' (will be marked finished at the end)' : ''}`);

  const [batch] = await db
    .insert(contentGenerationBatches)
    .values({ interestKey, kind: KIND, rolloutPhase: ROLLOUT_PHASE, placeCount: candidates.length, passId: pass.id, promptVersion, model: modelOverride ?? MODEL, thinkingLevel: thinkingArg ?? 'low' })
    .returning();

  let totalCost = 0;
  let tokensInTotal = 0;
  let tokensOutTotal = 0;
  let anyUnverified = false;
  const summary: Array<{ place: string; status: string; cost: number; rejects: number; warnings: number; generationId: string }> = [];

  for (const place of candidates) {
    if (totalCost >= costCeiling) {
      console.log(`\nCost ceiling ($${costCeiling}) reached — stopping before ${place.name}. Raise --cost-ceiling to continue.`);
      break;
    }

    const factSheet = factSheetFor(interestKey, place.id);
    // Renamed or broadened places (docs/renamed-places.json): their old name and narrower scope survive in other interests' text
    // and in a careless fact sheet, so they need a scope sheet, 
    // A fact sheet records the place name it was written for. If the place has been renamed or re-scoped since, the sheet is stale.
    if (factSheet?.forPlaceName && factSheet.forPlaceName !== place.name) {
      console.error(`\n-- ${place.name} (${place.id}) -- SKIPPED: its fact sheet was written for "${factSheet.forPlaceName}" but the place is now "${place.name}". Rebuild the sheet.`);
      summary.push({ place: place.name, status: 'api_error', cost: 0, rejects: 0, warnings: 0, generationId: '—' });
      continue;
    }
    const renamedNote = renamedPlaces.get(place.id);
    if (renamedNote && !factSheet?.scope?.trim() && !allowUnscopedRenamed) {
      console.error(`\n-- ${place.name} (${place.id}) -- SKIPPED: renamed place (${renamedNote}) with no scope sheet in docs/${interestKey}-facts.json. Add one, or pass --allow-unscoped-renamed.`);
      summary.push({ place: place.name, status: 'api_error', cost: 0, rejects: 0, warnings: 0, generationId: '—' });
      continue;
    }
    // Hiking only: the other places in the catalog, so a city can claim a great hike an hour out unless another listed place already owns it.
    const otherPlaces = interestKey === 'hiking' ? allPlaces.filter((p) => p.isPrimaryDestination && p.id !== place.id).map((p) => p.name).sort() : null;
    // Hiking only: Southern Hemisphere and equatorial places name months, not seasons (owner rule, 14 Oct 2026).
    const monthsOnly = interestKey === 'hiking' && usesMonthsNotSeasons(place.countryCode);
    const context: GenerationContext & { verifiedFacts?: Omit<FactSheet, 'mustMention'>; otherPlacesInCatalog?: string[]; seasonWording?: string } = {
      placeId: place.id,
      placeName: place.name,
      region: place.region,
      about: place.about ?? null,
      interestKey,
      interestLabel: interestKey,
      ...(otherPlaces ? { otherPlacesInCatalog: otherPlaces } : {}),
      ...(monthsOnly ? { seasonWording: 'Name months, never seasons (summer, winter, spring, autumn), because most readers live in the Northern Hemisphere.' } : {}),
      ...(factSheet ? { verifiedFacts: { scope: factSheet.scope, facts: factSheet.facts, avoid: factSheet.avoid, season: factSheet.season } } : {}),
    };
    const contextHash = hashObject(context);

    // The directive file's leading HTML comment is the owner's change log (it names scoring words and stock phrases): never send it to Gemini.
    const stripComments = (t: string) => t.replace(/<!--[\s\S]*?-->/g, '').trim();
    const prompt = promptTemplate.replace(/<!--[\s\S]*?-->/g, '').trimStart().replace('{{VOICE_RULES}}', stripComments(voiceRules)).replace('{{VOICE_RULES_OPEN_TOP}}', stripComments(voiceRulesOpenTop)).replace('{{ON_FOOT_CORE}}', onFootCore).replace('{{CONTEXT_JSON}}', JSON.stringify(context, null, 2));

    console.log(`\n-- ${place.name} (${place.id}) --`);
    let result;
    try {
      result = await generate(prompt, schemaShapeForVersion(resolvedVersion, promptTemplate), modelOverride, thinkingLevel);
    } catch (err) {
      console.error(`  API call failed: ${err instanceof Error ? err.message : String(err)}`);
      summary.push({ place: place.name, status: 'api_error', cost: 0, rejects: 0, warnings: 0, generationId: '—' });
      continue;
    }

    const { costUsd: cost, unverified } = computeCost(result.model, result.tokensIn, result.tokensOut);
    totalCost += cost;
    tokensInTotal += result.tokensIn;
    tokensOutTotal += result.tokensOut;
    anyUnverified ||= unverified;
    // Record as we go, so a run that dies half way still shows what it spent.
    await db.update(contentGenerationBatches).set({ totalCostUsd: totalCost, tokensIn: tokensInTotal, tokensOut: tokensOutTotal }).where(eq(contentGenerationBatches.id, batch.id));
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
      // best_for is pure arithmetic on the two ratings (within 1.5 = both), so the pipeline sets it rather than rejecting Gemini's slip.
      if (result.parsed.extras && typeof result.parsed.extras.diving_rating === 'number' && typeof result.parsed.extras.snorkeling_rating === 'number') {
        result.parsed.extras.best_for = bestForFromRatings(result.parsed.extras.diving_rating, result.parsed.extras.snorkeling_rating);
      }
      // Owner decision 11 Oct 2026: temperatures in blurbs are always Fahrenheit (a display setting for Celsius comes later).
      if (!isNotApplicable(result.parsed)) {
        result.parsed.overview = convertTemperaturesToF(result.parsed.overview);
        result.parsed.monthly.forEach((m) => (m.text = convertTemperaturesToF(m.text)));
        // Diving blurbs give depth, visibility and distances in feet too (owner decision 11 Oct 2026).
        if (interestKey === 'diving') {
          result.parsed.overview = convertMetersToFeet(result.parsed.overview);
          result.parsed.monthly.forEach((m) => (m.text = convertMetersToFeet(m.text)));
        }
        // Every interest: kilometres, metres and km/h become miles, feet and mph (owner decision 13 Oct 2026; text is stored in US units and shown in the visitor's).
        result.parsed.overview = metricToImperial(result.parsed.overview);
        result.parsed.monthly.forEach((m) => (m.text = metricToImperial(m.text)));
      }
      // Break up whole-number/.5 clustering and repeated pairs before validating (see decimalize.ts).
      if (!isNotApplicable(result.parsed)) {
        const scoresNow = result.parsed.monthly.map((m) => m.score);
        const textsNow = result.parsed.monthly.map((m) => m.text);
        // Blocky scores (repeated values on a slope) are eased by smooth-scores.ts. On by default for diving, surfing and hiking (owner, 13 Oct 2026); --smooth-blocky turns it on elsewhere.
        const useSmoother = (interestKey === 'diving' || interestKey === 'surfing' || interestKey === 'hiking' || smoothBlockyFlag) && isBlocky(scoresNow);
        const spread = flatScoresIfSingleBlurb(textsNow, scoresNow) ?? (useSmoother ? smoothBlockyScores(scoresNow, textsNow) : holdFlatBands(scoresNow, holdFlatMonths(textsNow, scoresNow, decimalizeScores(scoresNow, place.id)), flatBandMonths(scoresNow)));
        if (useSmoother) console.log(`  smoothed blocky scores: ${scoresNow.join(' ')}  ->  ${spread.join(' ')}`);
        // Last step, all interests: no strings of x.0 / x.5 (owner rule, see even-tenths.ts). The digit counts are shared across this run's places.
        const finalScores = avoidRoundScores(spread, place.id, runDigitCounts);
        result.parsed.monthly.forEach((m, i) => (m.score = finalScores[i]));
      }
      for (const msg of result.selfCheckIssues) issues.push({ layer: 'schema', severity: 'reject', message: msg });
      // Hiking: the crowding count comes from the notes sent to Gemini; no notes means no documented evidence, so no crowd mention.
      const crowding = interestKey === 'hiking' ? Number(((factSheet?.facts ?? []).join(' ').match(/Crowding: (\d) of 5/) ?? [])[1] ?? 0) : undefined;
      issues.push(...validateContent(result.parsed, interestKey, place.id, { monthsNotSeasons: interestKey === 'hiking' && usesMonthsNotSeasons(place.countryCode), crowding }));
      if (!isNotApplicable(result.parsed)) for (const msg of ownNameDistanceIssues(place.name, [result.parsed.overview, ...result.parsed.monthly.map((m) => m.text)])) issues.push({ layer: 'content', severity: 'warning', message: msg });
      if (!includeNa) issues.push(...validatePlausibility(place.naSliders ?? [], interestKey));
      const drawEntry = interestKey === 'birding' ? drawEntryFor(place.id) : undefined;
      if (drawEntry && drawEntry.drawBirds.length > 0) {
        const missing = drawEntry.drawBirds.filter((b) => !mentionsDrawBird(result.parsed!.overview, b));
        if (missing.length > Math.floor(drawEntry.drawBirds.length / 2)) {
          issues.push({
            layer: 'content',
            severity: 'warning',
            message: `Overview does not mention ${missing.length} of ${drawEntry.drawBirds.length} draw birds: ${missing.join('; ')}. Intentional if Gemini could not confirm them; otherwise add the star birds.`,
          });
        }
      }
      if (factSheet && factSheet.mustMention?.length) {
        const missing = factSheet.mustMention.filter((t) => !result.parsed!.overview.toLowerCase().includes(t.toLowerCase()));
        if (missing.length > 0) {
          issues.push({ layer: 'content', severity: 'warning', message: `Overview does not mention: ${missing.join('; ')} (from the verified fact sheet). Intentional only if space forced a cut.` });
        }
      }
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
    .set({ totalCostUsd: totalCost, tokensIn: tokensInTotal, tokensOut: tokensOutTotal, finishedAt: new Date() })
    .where(eq(contentGenerationBatches.id, batch.id));
  if (finishPass) await db.update(authoringPasses).set({ finishedAt: new Date() }).where(eq(authoringPasses.id, pass.id));

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
