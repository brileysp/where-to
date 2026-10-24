// 24 Oct 2026: fills the diving "Signature animals" column for places where the live text names animals worth building a trip around.
// Many places (lakes, shipwreck sites, ice, Iceland, the Mediterranean reefs with nothing notable) are deliberately left blank: blank means no signature animal.
// Entries come from the animals each place's live text names; likelihoods and months follow the wording of the text. Not source-checked.
// Fills only empty cells. Usage: PLACE_ROWS_SNAPSHOT=1 npx tsx scripts/seed-diving-animals-oct24.ts [--apply]
import { readFileSync } from 'fs';
import { join } from 'path';
for (const line of readFileSync(join(__dirname, '..', '.env.local'), 'utf8').split('\n')) { const t = line.trim(); if (!t || t.startsWith('#')) continue; const i = t.indexOf('='); if (i === -1) continue; let v = t.slice(i + 1).trim(); if (/^["'].*["']$/.test(v)) v = v.slice(1, -1); if (process.env[t.slice(0, i).trim()] === undefined) process.env[t.slice(0, i).trim()] = v; }
(async () => {
  const apply = process.argv.includes('--apply');
  const data = JSON.parse(readFileSync(join(__dirname, 'data', 'diving-animals-oct24.json'), 'utf8')) as Record<string, string>;
  const { db } = await import('../src/lib/db/client');
  const { placeInterestFacts, places } = await import('../src/lib/db/schema');
  const { and, eq } = await import('drizzle-orm');
  const { factDefsFor, parseFact } = await import('../src/lib/admin/interest-pages/config');
  const def = factDefsFor('diving').find((d) => d.key === 'animals')!;
  const known = new Map((await db.select({ id: places.id, na: places.naSliders }).from(places)).map((p) => [p.id, p]));
  let n = 0;
  for (const [id, text] of Object.entries(data)) {
    const p = known.get(id);
    if (!p) { console.log('unknown', id); continue; }
    if ((p.na as string[]).includes('diving')) { console.log('N/A, skipped', id); continue; }
    const parsed = parseFact(def, text);
    if (!parsed.ok) { console.log('bad', id, parsed.message); continue; }
    const [ex] = await db.select().from(placeInterestFacts).where(and(eq(placeInterestFacts.placeId, id), eq(placeInterestFacts.interestKey, 'diving')));
    const have = (ex?.facts ?? {}) as Record<string, unknown>;
    if (have.animals) continue;
    n++;
    if (apply) await db.insert(placeInterestFacts).values({ placeId: id, interestKey: 'diving', facts: { ...have, animals: parsed.value, drawSourceChecked: have.drawSourceChecked ?? false } as never }).onConflictDoUpdate({ target: [placeInterestFacts.placeId, placeInterestFacts.interestKey], set: { facts: { ...have, animals: parsed.value, drawSourceChecked: have.drawSourceChecked ?? false } as never, updatedAt: new Date() } });
  }
  console.log(`${apply ? 'wrote' : 'would write'} ${n} places`);
  process.exit(0);
})();
