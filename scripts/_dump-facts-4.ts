import { readFileSync, writeFileSync } from 'fs';
for (const line of readFileSync('.env.local', 'utf8').split('\n')) { const t = line.trim(); if (!t || t.startsWith('#')) continue; const i = t.indexOf('='); if (i < 0) continue; let v = t.slice(i + 1).trim(); if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) v = v.slice(1, -1); if (process.env[t.slice(0, i).trim()] === undefined) process.env[t.slice(0, i).trim()] = v; }
(async () => {
  const { db } = await import('../src/lib/db/client');
  const { places, contentGenerations, placeInterestFacts } = await import('../src/lib/db/schema');
  const { and, eq, desc, isNotNull } = await import('drizzle-orm');
  const out: Record<string, Record<string, unknown>> = {};
  const ps = await db.select().from(places);
  const nameOf = Object.fromEntries(ps.map((p) => [p.id, { name: p.name, na: p.naSliders }]));
  for (const key of ['birding', 'safari', 'wildlifeViewing', 'whaleWatching']) {
    const facts = await db.select().from(placeInterestFacts).where(eq(placeInterestFacts.interestKey, key));
    const gens = await db.select().from(contentGenerations).where(and(eq(contentGenerations.interestKey, key), isNotNull(contentGenerations.appliedAt))).orderBy(desc(contentGenerations.createdAt));
    const peak: Record<string, number[]> = {};
    for (const g of gens) { if (!peak[g.placeId]) peak[g.placeId] = ((g.parsedOutput as { monthly?: Array<{ score: number }> })?.monthly ?? []).map((m) => m.score); }
    out[key] = {};
    for (const f of facts) {
      const n = nameOf[f.placeId]; if (!n || n.na.includes(key)) continue;
      out[key][f.placeId] = { name: n.name, scores: peak[f.placeId] ?? [], facts: f.facts };
    }
  }
  writeFileSync(process.argv[2], JSON.stringify(out));
  console.log(Object.fromEntries(Object.entries(out).map(([k, v]) => [k, Object.keys(v).length])));
  process.exit(0);
})();
