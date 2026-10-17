// Fills "Close-up / photo ease" (0-10) for Wildlife Viewing, 17 Oct 2026. Judgement ratings drafted from each place's recorded animals and how you watch them; not web-sourced. Only fills cells that are still empty.
// Review the numbers in the admin Places & data tab before relying on them.
//
// Usage: PLACE_ROWS_SNAPSHOT=1 npx tsx scripts/apply-wildlife-close-up.ts [--apply]
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
  const def = factDefsFor('wildlifeViewing').find((d) => d.key === 'closeUp')!;
  const data = JSON.parse(readFileSync(join(__dirname, 'data', 'wildlife-close-up-oct17.json'), 'utf8')) as Record<string, number>;
  const rows = new Map((await db.select().from(placeInterestFacts).where(eq(placeInterestFacts.interestKey, 'wildlifeViewing'))).map((r) => [r.placeId, r.facts as Record<string, unknown>]));
  let n = 0;
  for (const [placeId, rating] of Object.entries(data)) {
    const facts = rows.get(placeId);
    if (!facts) { console.log('no wildlife row for', placeId); continue; }
    if (facts.closeUp !== undefined) { console.log('already filled, skipped:', placeId); continue; }
    const p = parseFact(def, rating);
    if (!p.ok) throw new Error(`${placeId}: ${p.message}`);
    if (apply) await db.update(placeInterestFacts).set({ facts: { ...facts, closeUp: p.value } as never, updatedAt: new Date() }).where(and(eq(placeInterestFacts.placeId, placeId), eq(placeInterestFacts.interestKey, 'wildlifeViewing')));
    n++;
  }
  console.log(`${apply ? 'filled' : 'would fill'} ${n} places`);
  process.exit(0);
})();
