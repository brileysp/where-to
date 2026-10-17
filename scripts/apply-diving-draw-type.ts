// Fills "What the draw is" for the 19 diving places left blank by the multi-select conversion (17 Oct 2026), from web research the same day
// (dive-operator and travel guides; sources named in the commit notes / chat). Only fills cells that are still empty.
//
// Usage: PLACE_ROWS_SNAPSHOT=1 npx tsx scripts/apply-diving-draw-type.ts [--apply]
import { readFileSync } from 'fs';
import { join } from 'path';

for (const line of readFileSync(join(__dirname, '..', '.env.local'), 'utf8').split('\n')) {
  const t = line.trim();
  if (!t || t.startsWith('#')) continue;
  const i = t.indexOf('=');
  if (i === -1) continue;
  let v = t.slice(i + 1).trim();
  if (/^["'].*["']$/.test(v)) v = v.slice(1, -1);
  if (process.env[t.slice(0, i).trim()] === undefined) process.env[t.slice(0, i).trim()] = v;
}

(async () => {
  const apply = process.argv.includes('--apply');
  const { db } = await import('../src/lib/db/client');
  const { placeInterestFacts } = await import('../src/lib/db/schema');
  const { and, eq } = await import('drizzle-orm');
  const { factDefsFor, parseFact } = await import('../src/lib/admin/interest-pages/config');
  const def = factDefsFor('diving').find((d) => d.key === 'drawType')!;
  const data = JSON.parse(readFileSync(join(__dirname, 'data', 'diving-draw-type-oct17.json'), 'utf8')) as Record<string, string[]>;
  const rows = new Map((await db.select().from(placeInterestFacts).where(eq(placeInterestFacts.interestKey, 'diving'))).map((r) => [r.placeId, r.facts as Record<string, unknown>]));
  let n = 0;
  for (const [placeId, draws] of Object.entries(data)) {
    const facts = rows.get(placeId);
    if (!facts) { console.log('no diving row for', placeId); continue; }
    if (facts.drawType !== undefined) { console.log('already filled, skipped:', placeId); continue; }
    const p = parseFact(def, draws);
    if (!p.ok) throw new Error(`${placeId}: ${p.message}`);
    if (apply) await db.update(placeInterestFacts).set({ facts: { ...facts, drawType: p.value } as never, updatedAt: new Date() }).where(and(eq(placeInterestFacts.placeId, placeId), eq(placeInterestFacts.interestKey, 'diving')));
    n++;
  }
  console.log(`${apply ? 'filled' : 'would fill'} ${n} places`);
  process.exit(0);
})();
