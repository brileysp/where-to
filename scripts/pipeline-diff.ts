// Side-by-side comparison of a staged Gemini generation against what's
// currently live on `places` — the review step between gemini-author-batch
// (always stages, never writes) and pipeline-apply (writes, by id).
//
// Usage:
//   npm run pipeline:diff -- --generation-id=<uuid>
//   npm run pipeline:diff -- --place-id=<id> --interest=<key>   (picks that
//     place/interest's most recent generation if more than one exists)
//
// The `--` before the flags is required — without it, npm swallows them
// instead of passing them through to this script.

import { readFileSync } from 'fs';
import { join } from 'path';
import { eq, and, desc } from 'drizzle-orm';
import { drizzle as drizzlePostgres } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import { places, contentGenerations } from '../src/lib/db/schema';
import { parseCliArgs, getString } from '../src/lib/gemini/cli';
import type { GenerationOutput } from '../src/lib/gemini/schema';

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

const MONTH_ABBR = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

function truncate(s: string, n = 90): string {
  return s.length > n ? s.slice(0, n - 1) + '…' : s;
}

async function main() {
  const args = parseCliArgs(process.argv.slice(2));
  const generationId = getString(args, 'generation-id');
  const placeId = getString(args, 'place-id');
  const interestKey = getString(args, 'interest');

  const env = loadDotEnvLocal();
  if (!env.DATABASE_URL) {
    console.error('No DATABASE_URL in .env.local');
    process.exit(1);
  }
  const db = drizzlePostgres(postgres(env.DATABASE_URL, { prepare: false }));

  let generation;
  if (generationId) {
    [generation] = await db.select().from(contentGenerations).where(eq(contentGenerations.id, generationId));
  } else if (placeId) {
    const where = interestKey ? and(eq(contentGenerations.placeId, placeId), eq(contentGenerations.interestKey, interestKey)) : eq(contentGenerations.placeId, placeId);
    const rows = await db.select().from(contentGenerations).where(where).orderBy(desc(contentGenerations.createdAt)).limit(1);
    generation = rows[0];
    if (!generation) {
      console.error(`No generation found for place "${placeId}"${interestKey ? ` / interest "${interestKey}"` : ' — pass --interest to narrow if this place has generations for more than one interest'}.`);
      process.exit(1);
    }
  } else {
    console.error('Pass --generation-id=<uuid> or --place-id=<id> (optionally with --interest=<key>).');
    process.exit(1);
  }

  if (!generation) {
    console.error(`No generation found${generationId ? ` with id ${generationId}` : ''}.`);
    process.exit(1);
  }

  const [place] = await db.select().from(places).where(eq(places.id, generation.placeId));
  if (!place) {
    console.error(`Generation references place "${generation.placeId}", which no longer exists.`);
    process.exit(1);
  }

  const { scorePlace } = await import('../src/lib/db/queries/places');
  const scored = scorePlace(place as Parameters<typeof scorePlace>[0]);

  const oldScores = scored.monthly[generation.interestKey] ?? new Array(12).fill(null);
  const oldOverview = (place.sliderOverview as Record<string, string>)?.[generation.interestKey] ?? '(none)';
  const oldMonthly = (place.sliderMonthlyWeather as Record<string, (string | null)[]>)?.[generation.interestKey] ?? new Array(12).fill(null);

  const output = generation.parsedOutput as GenerationOutput | null;

  console.log(`\n=== ${place.name} (${place.id}) — ${generation.interestKey} ===`);
  console.log(`Generation ${generation.id} | status: ${generation.validationStatus} | created: ${generation.createdAt.toISOString()}${generation.appliedAt ? ` | APPLIED: ${generation.appliedAt.toISOString()}` : ''}`);
  const errors = (generation.validationErrors as Array<{ layer: string; severity: string; message: string }>) ?? [];
  if (errors.length > 0) {
    console.log(`\nValidation issues (${errors.length}):`);
    errors.forEach((e) => console.log(`  [${e.severity}/${e.layer}] ${e.message}`));
  }

  if (!output) {
    console.log('\nNo parsed_output on this generation (schema parse failed) — nothing to diff.');
    process.exit(0);
  }

  console.log(`\n--- Overview ---`);
  console.log(`OLD: ${truncate(oldOverview, 200)}`);
  console.log(`NEW: ${truncate(output.overview, 200)}`);

  console.log(`\n--- Monthly (score, then blurb) ---`);
  const rows = MONTH_ABBR.map((m, i) => ({
    month: m,
    oldScore: oldScores[i] ?? '—',
    newScore: output.monthly[i]?.score ?? '—',
    'Δ': typeof oldScores[i] === 'number' && typeof output.monthly[i]?.score === 'number' ? (output.monthly[i].score - oldScores[i]).toFixed(1) : '—',
  }));
  console.table(rows);

  for (let i = 0; i < 12; i++) {
    console.log(`\n${MONTH_ABBR[i]}:`);
    console.log(`  OLD: ${truncate(oldMonthly[i] ?? '(none)')}`);
    console.log(`  NEW: ${truncate(output.monthly[i]?.text ?? '(none)')}`);
  }

  console.log(`\nconfidence: ${output.confidence}${output.flags.length ? ` | flags: ${output.flags.join('; ')}` : ''}`);
  if (output.sources.length > 0) {
    console.log(`sources: ${output.sources.map((s) => s.url).join(', ')}`);
  }

  console.log(`\nTo commit this generation: npm run pipeline:apply -- --generation-id=${generation.id}`);
  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
