import { readFileSync } from 'fs';
for (const line of readFileSync('.env.local', 'utf8').split('\n')) { const t = line.trim(); if (!t || t.startsWith('#')) continue; const i = t.indexOf('='); if (i < 0) continue; let v = t.slice(i + 1).trim(); if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) v = v.slice(1, -1); if (process.env[t.slice(0, i).trim()] === undefined) process.env[t.slice(0, i).trim()] = v; }
(async () => {
  const { db } = await import('../src/lib/db/client');
  const { places, placeInterestFacts, contentGenerationBatches } = await import('../src/lib/db/schema');
  const { and, eq } = await import('drizzle-orm');
  for (const id of ['marrakech','new-orleans']) {
    const [p] = await db.select().from(places).where(eq(places.id, id));
    const [f] = await db.select().from(placeInterestFacts).where(and(eq(placeInterestFacts.placeId, id), eq(placeInterestFacts.interestKey, 'whaleWatching')));
    console.log(id, 'na', p?.naSliders.includes('whaleWatching'), 'facts', JSON.stringify(f?.facts));
  }
  const b = await db.select().from(contentGenerationBatches).limit(3);
  console.log(JSON.stringify(b.map(x=>({id:x.id, ...x})),null,0).slice(0,800));
  process.exit(0);
})();
