// 20 Oct 2026: gives Scenic Landscapes its first data column, "Landscape photography" (the chip folded in from the old interest), filled from the
// existing Landscape Photography place scores, and points the Scenic "Landscape photography" chip at it. A cell that already has a value is left alone.
// Usage: PLACE_ROWS_SNAPSHOT=1 npx tsx scripts/fill-landscape-photography-column-oct20.ts [--apply]
import { readFileSync } from 'fs';
import { join } from 'path';
for (const line of readFileSync(join(__dirname, '..', '.env.local'), 'utf8').split('\n')) { const t = line.trim(); if (!t || t.startsWith('#')) continue; const i = t.indexOf('='); if (i < 0) continue; let v = t.slice(i + 1).trim(); if (/^["'].*["']$/.test(v)) v = v.slice(1, -1); if (process.env[t.slice(0, i).trim()] === undefined) process.env[t.slice(0, i).trim()] = v; }
(async () => {
  const apply = process.argv.includes('--apply');
  const { db } = await import('../src/lib/db/client');
  const { placeInterestFacts, interestChips } = await import('../src/lib/db/schema');
  const { sql, eq, and } = await import('drizzle-orm');
  const r: any = await db.execute(sql`select id, (base_scores->>'landscapePhotography')::float as lp, (base_scores->>'scenicLandscapes')::float as sc from places where base_scores ? 'landscapePhotography'`);
  const rows = (r.rows ?? r) as Array<{ id: string; lp: number; sc: number }>;
  const existing = new Map((await db.select().from(placeInterestFacts).where(eq(placeInterestFacts.interestKey, 'scenicLandscapes'))).map((x) => [x.placeId, x.facts as Record<string, unknown>]));
  let filled = 0, kept = 0, over = 0;
  const writes: Array<{ placeId: string; facts: Record<string, unknown> }> = [];
  for (const p of rows) {
    const facts = { ...(existing.get(p.id) ?? {}) };
    if (facts.landscapePhotography !== undefined && facts.landscapePhotography !== null) { kept++; continue; }
    const v = Math.round(Math.max(0, Math.min(10, p.lp)) * 10) / 10;
    if (p.sc !== null && v > p.sc + 0.05) over++;
    facts.landscapePhotography = v; filled++;
    writes.push({ placeId: p.id, facts });
  }
  console.log(`places with a score: ${rows.length}; to fill ${filled}; already filled ${kept}; above their own Scenic score ${over}`);
  if (!apply) { console.log('dry run: pass --apply to write'); process.exit(0); }
  for (const w of writes) await db.insert(placeInterestFacts).values({ placeId: w.placeId, interestKey: 'scenicLandscapes', facts: w.facts as never, updatedAt: new Date() }).onConflictDoUpdate({ target: [placeInterestFacts.placeId, placeInterestFacts.interestKey], set: { facts: w.facts as never, updatedAt: new Date() } });
  await db.update(interestChips).set({ drivers: [{ column: 'landscapePhotography' }], needsColumn: '', updatedBy: 'Claude (column added, 20 Oct 2026)', updatedAt: new Date() }).where(and(eq(interestChips.interestKey, 'scenicLandscapes'), eq(interestChips.chipKey, 'landscape-photography')));
  console.log('wrote', writes.length, 'cells and set the chip driver');
  process.exit(0);
})().catch((e) => { console.log('ERR', e.cause?.message ?? e.message); process.exit(1); });
