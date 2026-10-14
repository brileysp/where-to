// One-off backfill for authoring passes (docs/authoring-passes-spec.md): groups the existing Gemini batches into passes, rebuilds each
// batch's token totals from its per-place rows, and links the two. Safe to re-run: it skips batches that already have a pass.
// Usage: PLACE_ROWS_SNAPSHOT=1 npx tsx scripts/backfill-authoring-passes.ts [--dry-run]
import { readFileSync } from 'fs';
import { join } from 'path';
import { eq, inArray } from 'drizzle-orm';
import { drizzle as drizzlePostgres } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import { authoringPasses, contentGenerationBatches, contentGenerations } from '../src/lib/db/schema';
import { baseVersion, planPasses, type BatchSummary } from '../src/lib/gemini/passes';
import { SLIDERS } from '../src/lib/scoring/constants';

function loadEnv(): Record<string, string> {
  const out: Record<string, string> = {};
  for (const line of readFileSync(join(__dirname, '..', '.env.local'), 'utf8').split('\n')) {
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
  const env = loadEnv();
  const dryRun = process.argv.includes('--dry-run');
  const db = drizzlePostgres(postgres(env.DATABASE_URL, { prepare: false }));
  const batches = await db.select().from(contentGenerationBatches);
  const gens = await db
    .select({ batchId: contentGenerations.batchId, placeId: contentGenerations.placeId, version: contentGenerations.promptVersion, model: contentGenerations.model, tIn: contentGenerations.tokensIn, tOut: contentGenerations.tokensOut, cost: contentGenerations.costUsd, appliedAt: contentGenerations.appliedAt, createdAt: contentGenerations.createdAt })
    .from(contentGenerations);
  const byBatch = new Map<string, typeof gens>();
  for (const g of gens) if (g.batchId) byBatch.set(g.batchId, [...(byBatch.get(g.batchId) ?? []), g]);
  const label = (key: string) => SLIDERS.find((s) => s.key === key)?.label ?? key;

  const todo = batches.filter((b) => !b.passId);
  const summaries: BatchSummary[] = todo.map((b) => {
    const g = byBatch.get(b.id) ?? [];
    const last = g.length ? new Date(Math.max(...g.map((x) => x.createdAt.getTime()))) : b.startedAt;
    return {
      id: b.id, interestKey: b.interestKey, startedAt: b.startedAt, finishedAt: b.finishedAt, generations: g.length,
      tokensIn: g.reduce((a, x) => a + x.tIn, 0), tokensOut: g.reduce((a, x) => a + x.tOut, 0), costUsd: g.reduce((a, x) => a + x.cost, 0),
      versions: [...new Set(g.map((x) => baseVersion(x.version)))], placeIds: [...new Set(g.map((x) => x.placeId))],
      appliedCount: g.filter((x) => x.appliedAt).length, lastActivity: b.finishedAt && b.finishedAt > last ? b.finishedAt : last,
    };
  });
  const plan = planPasses(summaries, label);
  console.log(`${todo.length} batches without a pass; ${summaries.filter((s) => s.generations === 0).length} empty (left out); ${plan.length} passes planned.`);
  for (const p of plan) {
    const sums = summaries.filter((s) => p.batchIds.includes(s.id));
    console.log(`${p.interestKey.padEnd(16)} ${p.kind.padEnd(9)} ${p.label.padEnd(34)} ${p.finishedAt ? p.finishedAt.toISOString().slice(0, 16) : 'in progress     '} batches ${String(p.batchIds.length).padStart(3)} places ${String(new Set(sums.flatMap((s) => s.placeIds)).size).padStart(3)} tokens ${sums.reduce((a, s) => a + s.tokensIn + s.tokensOut, 0)} cost $${sums.reduce((a, s) => a + s.costUsd, 0).toFixed(2)}`);
  }
  if (dryRun) { console.log('\ndry run, nothing written'); process.exit(0); }

  for (const p of plan) {
    const [row] = await db.insert(authoringPasses).values({ interestKey: p.interestKey, label: p.label, kind: p.kind, promptVersion: p.promptVersion, finishedAt: p.finishedAt, notes: 'Created by the 10 Oct 2026 backfill from the existing batches.' }).returning();
    for (const id of p.batchIds) {
      const s = summaries.find((x) => x.id === id)!;
      const g = byBatch.get(id) ?? [];
      const batch = batches.find((b) => b.id === id)!;
      await db.update(contentGenerationBatches).set({
        passId: row.id, promptVersion: s.versions[0] ?? null, model: g[0]?.model ?? null, tokensIn: s.tokensIn, tokensOut: s.tokensOut,
        totalCostUsd: batch.totalCostUsd > 0 ? batch.totalCostUsd : s.costUsd,
        finishedAt: batch.finishedAt ?? (g.length ? s.lastActivity : null), // a run that died before recording its end: use its last result
      }).where(eq(contentGenerationBatches.id, id));
    }
  }
  console.log('\nwritten');
  process.exit(0);
}
main().catch((e) => { console.error(e); process.exit(1); });
