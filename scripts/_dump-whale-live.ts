import { readFileSync, writeFileSync } from 'fs';
for (const line of readFileSync('.env.local', 'utf8').split('\n')) { const t = line.trim(); if (!t || t.startsWith('#')) continue; const i = t.indexOf('='); if (i < 0) continue; let v = t.slice(i + 1).trim(); if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) v = v.slice(1, -1); if (process.env[t.slice(0, i).trim()] === undefined) process.env[t.slice(0, i).trim()] = v; }
(async () => {
  const { db } = await import('../src/lib/db/client');
  const { places, contentGenerations, placeInterestFacts } = await import('../src/lib/db/schema');
  const { and, eq, desc } = await import('drizzle-orm');
  const ids = process.argv[3].split(',');
  const out: Record<string, unknown> = {};
  for (const id of ids) {
    const [p] = await db.select().from(places).where(eq(places.id, id));
    if (!p) { console.log('missing', id); continue; }
    const gens = await db.select().from(contentGenerations).where(and(eq(contentGenerations.placeId, id), eq(contentGenerations.interestKey, 'whaleWatching'))).orderBy(desc(contentGenerations.createdAt));
    const g = gens.find((x) => x.appliedAt);
    const [f] = await db.select().from(placeInterestFacts).where(and(eq(placeInterestFacts.placeId, id), eq(placeInterestFacts.interestKey, 'whaleWatching')));
    out[id] = {
      name: p.name, na: p.naSliders.includes('whaleWatching'),
      overview: (p.sliderOverview as Record<string, string>)?.whaleWatching,
      months: (p.sliderMonthlyWeather as Record<string, string[]>)?.whaleWatching,
      genId: g?.id, genOverview: (g?.parsedOutput as { overview?: string })?.overview, scores: (g?.parsedOutput as { monthly?: Array<{ score: number }> })?.monthly?.map((m) => m.score),
      facts: f?.facts,
    };
  }
  writeFileSync(process.argv[2], JSON.stringify(out, null, 1));
  process.exit(0);
})();
