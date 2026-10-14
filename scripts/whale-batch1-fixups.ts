import { readFileSync } from 'fs';
for (const line of readFileSync('.env.local', 'utf8').split('\n')) { const t = line.trim(); if (!t || t.startsWith('#')) continue; const i = t.indexOf('='); if (i < 0) continue; let v = t.slice(i + 1).trim(); if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) v = v.slice(1, -1); if (process.env[t.slice(0, i).trim()] === undefined) process.env[t.slice(0, i).trim()] = v; }

// Owner review fixes to the staged whale batch one (7 Oct 2026). Edits only touch staged generations, never `places`.
const BATCH1 = 'b9cb157c-4bba-4d8c-9c9e-8ec045638eeb';
const RERUN = '120af52a-6e39-4d36-852f-cfe26a2aca3d';
type Out = { overview: string; monthly: Array<{ score: number; text: string }>; sources: unknown[]; confidence: string; flags: string[] };

function rep(s: string, a: string, b: string, ctx: string): string {
  if (s.includes(b) && !s.includes(a)) return s; // already applied
  if (!s.includes(a)) throw new Error(`Text to replace not found (${ctx}): ${a.slice(0, 60)}`);
  return s.split(a).join(b);
}
const EDITS: Record<string, (o: Out) => void> = {
  andalucia: (o) => { o.monthly[7].text = 'Orcas remain in the Strait of Gibraltar hunting migrating bluefin tuna, and dedicated boat trips from Tarifa still offer good chances of seeing them alongside highly reliable sightings of resident long-finned pilot whales.'; },
  azores: (o) => {
    o.monthly[7].text = 'Sei whales remain the seasonal headline visitor, joining the resident sperm whales and Atlantic spotted dolphins. Boat trips from Pico and São Miguel find them reliably in calm summer waters.';
    o.monthly[8].text = 'Sei whales are still the seasonal headline visitor, joining the resident sperm whales and Atlantic spotted dolphins, and boat trips from Pico and São Miguel find them reliably in calm waters.';
  },
  antarctica: (o) => { for (let i = 3; i <= 9; i++) o.monthly[i].score = 0; },
  churchill: (o) => { for (const i of [0, 1, 2, 3, 4, 9, 10, 11]) o.monthly[i].score = 0; },
  copenhagen: (o) => {
    o.overview = 'Harbor porpoises are regularly seen in the Øresund strait, with the best chances on summer boat trips from Helsingør, a 45-minute train ride north of Copenhagen.';
    for (const i of [5, 6, 7]) o.monthly[i].text = rep(o.monthly[i].text, 'making it easier to spot them breaking the surface', 'making them easier to spot', 'copenhagen');
  },
  croatia: (o) => { o.overview = 'Bottlenose dolphins are regularly seen from general boat trips and ferries along the Dalmatian Coast. While there are no dedicated whale-watching trips in this region, the resident bottlenose dolphin population provides good chances for incidental sightings.'; },
  'faroe-islands': (o) => {
    o.overview = rep(o.overview, 'Minke whales, orcas, and white-beaked dolphins are regularly seen around the Faroe Islands from May to August.', 'White-beaked dolphins are regularly seen around the Faroe Islands from May to August, and minke whales and orcas are sometimes seen.', 'faroe overview');
    for (const i of [5, 6, 7]) o.monthly[i].text = rep(o.monthly[i].text, 'where minke whales, orcas, and white-beaked dolphins are regularly seen offshore', 'where white-beaked dolphins are regularly seen offshore and minke whales and orcas are sometimes seen', 'faroe month');
  },
  greenland: (o) => { o.monthly[11].text = o.monthly[0].text; },
  bahamas: (o) => { o.overview = 'Atlantic spotted dolphins and bottlenose dolphins are regularly seen year-round on boat trips from Bimini and Grand Bahama. Sperm whales live in the deep offshore trenches and humpbacks pass in winter, but large whales are chance sightings.'; },
  'hudson-valley': (o) => {
    o.overview = 'NOT_APPLICABLE: The Hudson Valley is inland; the whale and dolphin trips are off New York City, which is its own place.';
    o.monthly = o.monthly.map(() => ({ score: 0, text: 'n/a' }));
  },
};
// Accepted by the owner despite a rejection.
const OVERRIDE = new Set(['amsterdam', 'borneo', 'galapagos']);
const SUPERSEDED = new Set(['angkor', 'bagan', 'borabora', 'fjords']);

(async () => {
  const { db } = await import('../src/lib/db/client');
  const { contentGenerations } = await import('../src/lib/db/schema');
  const { eq } = await import('drizzle-orm');
  const { validateContent, validatePlausibility, overallStatus, isNotApplicable } = await import('../src/lib/gemini/validate');
  const gens = await db.select().from(contentGenerations).where(eq(contentGenerations.batchId, BATCH1));
  const rerun = await db.select().from(contentGenerations).where(eq(contentGenerations.batchId, RERUN));
  const hudson = gens.find((g) => g.placeId === 'hudson-valley')!;
  const hudsonOriginal = JSON.parse(JSON.stringify(hudson.parsedOutput)) as Out;

  const summary: string[] = [];
  const revalidate = async (g: (typeof gens)[number], out: Out, extra: Array<{ layer: 'content'; severity: 'warning' | 'reject'; message: string }> = []) => {
    const issues = [...validateContent(out as never, 'whaleWatching', g.placeId), ...extra];
    let status = overallStatus(issues);
    if (status === 'invalid' && OVERRIDE.has(g.placeId)) {
      const rejects = issues.filter((i) => i.severity === 'reject').map((i) => i.message.slice(0, 80));
      issues.push({ layer: 'content', severity: 'warning', message: `Accepted by the owner on 7 Oct 2026 despite: ${rejects.join(' | ')}` });
      for (const i of issues) if (i.severity === 'reject') i.severity = 'warning';
      status = 'valid';
    }
    await db.update(contentGenerations).set({ parsedOutput: out as never, validationStatus: status, validationErrors: issues as never }).where(eq(contentGenerations.id, g.id));
    return { status, rejects: issues.filter((i) => i.severity === 'reject').map((i) => i.message) };
  };

  for (const g of gens) {
    if (SUPERSEDED.has(g.placeId)) {
      const note = [{ layer: 'content', severity: 'reject', message: 'Superseded on 7 Oct 2026 by the rewrite in batch 120af52a (regenerated with a whole-place scope sheet).' }];
      await db.update(contentGenerations).set({ validationStatus: 'invalid', validationErrors: note as never }).where(eq(contentGenerations.id, g.id));
      summary.push(`${g.placeId}: superseded`);
      continue;
    }
    const out = JSON.parse(JSON.stringify(g.parsedOutput)) as Out;
    EDITS[g.placeId]?.(out);
    const r = await revalidate(g, out);
    summary.push(`${g.placeId}: ${r.status}${r.rejects.length ? ' | ' + r.rejects.map((m) => m.slice(0, 90)).join(' | ') : ''}`);
  }
  for (const g of rerun) {
    const out = g.parsedOutput as Out;
    const r = await revalidate(g, out);
    summary.push(`(rerun) ${g.placeId}: ${r.status}${isNotApplicable(out as never) ? ' NA' : ''}${r.rejects.length ? ' | ' + r.rejects.join(' | ') : ''}`);
  }

  // New York City: the Hudson Valley text, adapted to the city itself.
  const nyc: Out = {
    overview: 'Humpback whales feed in the waters just off New York City and Long Island, and boat trips from Manhattan, Brooklyn and the Rockaways regularly find them in season. Bottlenose dolphins are also regularly seen.',
    monthly: [
      { score: 0.4, text: 'Whale-watching boat trips from New York City do not run in winter, and whale or dolphin sightings are rare chance encounters from the coast.' },
      { score: 0.5, text: 'Whale-watching boat trips from New York City do not run in winter, and whale or dolphin sightings are rare chance encounters from the coast.' },
      { score: 0.6, text: 'Whale-watching boat trips from New York City do not run in winter, and whale or dolphin sightings are rare chance encounters from the coast.' },
      { score: 1.2, text: 'A few boat trips from New York City run on weekends as spring arrives, but humpback whales are only starting to move into the waters off the city.' },
      { score: 3.2, text: 'Humpback whales move into the waters off New York City to feed on baitfish, and regular boat trips from Manhattan, Brooklyn and the Rockaways start to find them.' },
      { score: 5.5, text: 'Humpback whales are regularly seen feeding in the waters off New York City on boat trips from Manhattan, Brooklyn and the Rockaways, and bottlenose dolphins are also regularly seen.' },
      { score: 5.9, text: 'Humpback whales are regularly seen feeding in the waters off New York City on boat trips from Manhattan, Brooklyn and the Rockaways, and bottlenose dolphins are also regularly seen.' },
      { score: 6.3, text: 'Humpback whales are regularly seen feeding in the waters off New York City on boat trips from Manhattan, Brooklyn and the Rockaways, and bottlenose dolphins are also regularly seen.' },
      { score: 6.1, text: 'Humpback whales are regularly seen feeding in the waters off New York City on boat trips from Manhattan, Brooklyn and the Rockaways, and bottlenose dolphins are also regularly seen.' },
      { score: 5.0, text: 'Humpback whales are still regularly seen on boat trips from New York City as the fall season continues, with fewer trips on rougher days.' },
      { score: 2.4, text: 'Late-season boat trips from New York City occasionally find lingering humpback whales, and most trips stop running for the year.' },
      { score: 0.5, text: 'Whale-watching boat trips from New York City do not run in winter, and whale or dolphin sightings are rare chance encounters from the coast.' },
    ],
    sources: [], confidence: 'high', flags: [],
  };
  const issues = validateContent(nyc as never, 'whaleWatching', 'nyc');
  issues.push({ layer: 'content', severity: 'warning', message: 'Adapted by Claude on 7 Oct 2026 from the Hudson Valley generation (which was about New York City waters); scores re-set for the city itself. Not written by Gemini.' });
  const status = overallStatus(issues);
  const existing = await db.select().from(contentGenerations).where(eq(contentGenerations.placeId, 'nyc'));
  const already = existing.find((e) => e.promptVersion.includes('adapted'));
  if (!already) {
    await db.insert(contentGenerations).values({
      batchId: BATCH1, placeId: 'nyc', interestKey: 'whaleWatching', kind: 'author', promptVersion: 'whaleWatching/v2 (adapted by Claude from the Hudson Valley text)', promptHash: hudson.promptHash,
      inputContextHash: hudson.inputContextHash, model: 'claude-sonnet-5.5', temperature: 0, rawResponse: { adaptedFrom: hudson.id, original: hudsonOriginal } as never, parsedOutput: nyc as never,
      validationStatus: status, validationErrors: issues as never, tokensIn: 0, tokensOut: 0, costUsd: 0,
    });
  }
  summary.push(`nyc (adapted): ${status}`);
  console.log(summary.join('\n'));
  process.exit(0);
})();
