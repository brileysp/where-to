// 2 Nov 2026: the family authoring runner (apply-family-text.ts) saved texts without recording an authoring pass, so Museums & Art, Architecture and Fine Dining showed "pass finished" as empty.
// This creates one finished pass per interest, attaches that interest's batches that have no pass, and finishes it at the last batch's finish time. Safe to re-run (skips interests that already have a pass).
// Usage: npx tsx scripts/close-family-passes-nov2.ts museumsArt,architecture,fineDining [--apply]
import { readFileSync } from 'fs'; import { join } from 'path';
for (const line of readFileSync(join(__dirname, '..', '.env.local'), 'utf8').split('\n')) { const t = line.trim(); if (!t || t.startsWith('#')) continue; const i = t.indexOf('='); if (i === -1) continue; let v = t.slice(i + 1).trim(); if (/^["'].*["']$/.test(v)) v = v.slice(1, -1); if (process.env[t.slice(0, i).trim()] === undefined) process.env[t.slice(0, i).trim()] = v; }
const LABELS: Record<string, string> = { museumsArt: 'Museums & Art', architecture: 'Architecture', fineDining: 'Fine Dining', streetFood: 'Street Food & Markets', coffeeTea: 'Specialty Coffee & Tea', wineSpirits: 'Wine, Beer & Spirits' };
(async () => {
  const apply = process.argv.includes('--apply'); const keys = (process.argv[2] ?? '').split(',').filter(Boolean);
  const { db } = await import('../src/lib/db/client'); const { authoringPasses, contentGenerationBatches } = await import('../src/lib/db/schema'); const { and, eq, isNull } = await import('drizzle-orm');
  for (const k of keys) {
    const have = await db.select().from(authoringPasses).where(eq(authoringPasses.interestKey, k));
    const batches = await db.select().from(contentGenerationBatches).where(and(eq(contentGenerationBatches.interestKey, k), isNull(contentGenerationBatches.passId)));
    if (have.length || !batches.length) { console.log(`${k}: skipped (${have.length} passes already, ${batches.length} batches without a pass)`); continue; }
    const finished = batches.map((b: any) => b.finishedAt).filter(Boolean).sort().pop() ?? new Date();
    console.log(`${k}: ${apply ? 'creating' : 'would create'} a finished pass for ${batches.length} batch(es), finished ${new Date(finished).toISOString()}`);
    if (!apply) continue;
    const [p] = await db.insert(authoringPasses).values({ interestKey: k, label: `${LABELS[k] ?? k} · family/v1`, kind: 'initial', promptVersion: 'family/v1', notes: 'Created 2 Nov 2026: the family authoring runner did not record passes, so this was added afterwards.', finishedAt: new Date(finished) }).returning();
    for (const b of batches) await db.update(contentGenerationBatches).set({ passId: p.id }).where(eq(contentGenerationBatches.id, b.id));
  }
  process.exit(0);
})().catch((e) => { console.log('ERR', e.cause?.message ?? e.stack); process.exit(1); });
