import { readFileSync } from 'fs';
for (const line of readFileSync('.env.local', 'utf8').split('\n')) { const t = line.trim(); if (!t || t.startsWith('#')) continue; const i = t.indexOf('='); if (i < 0) continue; let v = t.slice(i + 1).trim(); if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) v = v.slice(1, -1); if (process.env[t.slice(0, i).trim()] === undefined) process.env[t.slice(0, i).trim()] = v; }

// Round two of the batch-two fixes (7 Oct 2026): places that use one blurb all year are exactly flat, and where the
// weather has a clear worse season those months get their own blurb and a lower score. Staged rows only.
type Out = { overview: string; monthly: Array<{ score: number; text: string }>; sources: unknown[]; confidence: string; flags: string[] };
const BATCHES = ['423c33ad-2e1b-4c36-86a8-95e94e7f8a63', '0e674e5f-4ab2-47f4-8038-02834e97981e'];

function flat(o: Out, base: number, low: number[] = [], lowScore = base, lowText?: (t: string) => string) {
  o.monthly.forEach((m, i) => {
    const isLow = low.includes(i);
    m.score = isLow ? lowScore : base;
    if (isLow && lowText) m.text = lowText(m.text);
  });
}
const EDITS: Record<string, (o: Out) => void> = {
  'milford-sound-fiordland': (o) => flat(o, 3.5, [11, 0], 3.2, () => "Bottlenose dolphins are regularly seen on scenic cruises through Milford and Doubtful Sounds, though sightings are incidental. The year's heaviest rain makes time on deck wetter."),
  london: (o) => flat(o, 0.4),
  venice: (o) => flat(o, 0.5),
  seoul: (o) => flat(o, 1.0, [6, 7], 0.8, () => 'Indo-Pacific finless porpoises are occasionally spotted from ferries or the coast near Incheon, by chance only, and summer monsoon rain makes ferry rides less pleasant.'),
  'new-orleans': (o) => flat(o, 0.9, [7, 8, 9], 0.7, () => 'Bottlenose dolphins are occasionally spotted in Lake Pontchartrain and nearby coastal waters, with chance encounters on general boat trips. Hurricane season brings rougher water.'),
  havana: (o) => flat(o, 1.0, [7, 8, 9], 0.8, (t) => `${t} Peak hurricane season brings rougher seas.`),
};

(async () => {
  const { db } = await import('../src/lib/db/client');
  const { contentGenerations } = await import('../src/lib/db/schema');
  const { inArray, eq } = await import('drizzle-orm');
  const { validateContent, overallStatus } = await import('../src/lib/gemini/validate');
  const gens = await db.select().from(contentGenerations).where(inArray(contentGenerations.batchId, BATCHES));
  const summary: string[] = [];
  for (const g of gens) {
    const edit = EDITS[g.placeId];
    if (!edit || g.validationStatus !== 'valid') continue;
    const out = JSON.parse(JSON.stringify(g.parsedOutput)) as Out;
    edit(out);
    const issues = validateContent(out as never, 'whaleWatching', g.placeId);
    const status = overallStatus(issues);
    await db.update(contentGenerations).set({ parsedOutput: out as never, validationStatus: status, validationErrors: issues as never }).where(eq(contentGenerations.id, g.id));
    summary.push(`${g.placeId}: ${status} | ${out.monthly.map((m) => m.score).join(',')} | ${issues.filter((i) => /characters/.test(i.message)).map((i) => i.message.slice(0, 70)).join(' ; ')}`);
  }
  console.log(summary.join('\n'));
  process.exit(0);

})();
