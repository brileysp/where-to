// Commits one or many staged Gemini generations to `places` — the only
// script in this pipeline that writes live data. Deliberately separate from
// generation (gemini-author-batch.ts never writes) and review
// (pipeline-diff.ts never writes) — applying is its own explicit,
// id-scoped decision every time, never a side effect of an earlier step.
//
// Usage:
//   npm run pipeline:apply -- --generation-id=<uuid>
//   npm run pipeline:apply -- --batch-id=<uuid>     (applies every 'valid',
//     not-yet-applied generation in that batch)
//
// The `--` before the flags is required — without it, npm swallows them.

import { readFileSync } from 'fs';
import { join } from 'path';
import { eq } from 'drizzle-orm';
import { drizzle as drizzlePostgres } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import { contentGenerations } from '../src/lib/db/schema';
import { parseCliArgs, getString } from '../src/lib/gemini/cli';

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
  const generationId = getString(args, 'generation-id');
  const batchId = getString(args, 'batch-id');

  if (!generationId && !batchId) {
    console.error('Pass --generation-id=<uuid> or --batch-id=<uuid>.');
    process.exit(1);
  }

  const env = loadDotEnvLocal();
  if (!env.DATABASE_URL) {
    console.error('No DATABASE_URL in .env.local');
    process.exit(1);
  }
  // Set before dynamically importing anything that pulls in
  // src/lib/db/client.ts (applyGeneration does, transitively) — see the
  // "Known footgun" note in interest-content-authoring-playbook.md §4.
  process.env.DATABASE_URL = env.DATABASE_URL;

  const db = drizzlePostgres(postgres(env.DATABASE_URL, { prepare: false }));
  const { applyGeneration } = await import('../src/lib/gemini/apply');

  const ids: string[] = [];
  if (generationId) {
    ids.push(generationId);
  } else if (batchId) {
    const rows = await db
      .select()
      .from(contentGenerations)
      .where(eq(contentGenerations.batchId, batchId));
    const pending = rows.filter((r) => r.validationStatus === 'valid' && !r.appliedAt);
    console.log(`Batch ${batchId}: ${rows.length} generation(s) total, ${pending.length} valid and not yet applied.`);
    ids.push(...pending.map((r) => r.id));
  }

  if (ids.length === 0) {
    console.log('Nothing to apply.');
    process.exit(0);
  }

  const results: Array<{ generationId: string; outcome: string; detail: string }> = [];
  for (const id of ids) {
    const result = await applyGeneration(id);
    console.log(`${id}: ${result.outcome} — ${result.detail}`);
    results.push({ generationId: id, outcome: result.outcome, detail: result.detail });
  }

  console.log('\n=== Summary ===');
  console.table(results);
  const applied = results.filter((r) => r.outcome === 'applied').length;
  console.log(`${applied} of ${results.length} applied.`);
  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
