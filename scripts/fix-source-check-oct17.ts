// Corrections from the 17 Oct 2026 source check of the diving-draw and whale-boat-style fills. Only changes a cell that still holds my original fill.
// Usage: PLACE_ROWS_SNAPSHOT=1 npx tsx scripts/fix-source-check-oct17.ts [--apply]
import { readFileSync } from 'fs';
import { join } from 'path';
for (const line of readFileSync(join(__dirname, '..', '.env.local'), 'utf8').split('\n')) { const t = line.trim(); if (!t || t.startsWith('#')) continue; const i = t.indexOf('='); if (i < 0) continue; let v = t.slice(i + 1).trim(); if (/^["'].*["']$/.test(v)) v = v.slice(1, -1); if (process.env[t.slice(0, i).trim()] === undefined) process.env[t.slice(0, i).trim()] = v; }
(async () => {
  const apply = process.argv.includes('--apply');
  const { db } = await import('../src/lib/db/client');
  const { placeInterestFacts } = await import('../src/lib/db/schema');
  const { and, eq } = await import('drizzle-orm');
  // [interest, place, factKey, what the cell must hold now (my fill), new value or null to clear]
  const fixes: Array<[string, string, string, string[], string[] | null]> = [
    ['diving', 'tuscany', 'drawType', ['caves'], ['caves', 'wrecks']],
    ['whaleWatching', 'barcelona', 'boatStyle', ['inflatable'], ['sailing']],
    ['whaleWatching', 'borneo', 'boatStyle', ['midsize'], null],
    ['whaleWatching', 'st-andrews-fife', 'boatStyle', ['midsize'], null],
    ['whaleWatching', 'cornwall', 'boatStyle', ['inflatable'], ['inflatable', 'midsize']],
    ['whaleWatching', 'mallorca', 'boatStyle', ['midsize'], ['inflatable', 'midsize']],
    ['whaleWatching', 'sydney', 'boatStyle', ['midsize'], ['inflatable', 'midsize']],
  ];
  for (const [interest, place, key, expect, next] of fixes) {
    const [row] = await db.select().from(placeInterestFacts).where(and(eq(placeInterestFacts.placeId, place), eq(placeInterestFacts.interestKey, interest)));
    const cur = row?.facts as Record<string, unknown> | undefined;
    if (!cur || JSON.stringify(cur[key]) !== JSON.stringify(expect)) { console.log('SKIP (changed since my fill):', interest, place, JSON.stringify(cur?.[key])); continue; }
    const facts = { ...cur };
    if (next) facts[key] = next; else delete facts[key];
    if (apply) await db.update(placeInterestFacts).set({ facts: facts as never, updatedAt: new Date() }).where(and(eq(placeInterestFacts.placeId, place), eq(placeInterestFacts.interestKey, interest)));
    console.log(apply ? 'fixed' : 'would fix', interest, place, key, '->', next ? next.join('+') : 'blank');
  }
  process.exit(0);
})().catch(e=>{console.log('ERR',e.cause?.message??e.message);process.exit(1)});
