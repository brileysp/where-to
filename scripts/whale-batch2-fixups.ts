import { readFileSync } from 'fs';
for (const line of readFileSync('.env.local', 'utf8').split('\n')) { const t = line.trim(); if (!t || t.startsWith('#')) continue; const i = t.indexOf('='); if (i < 0) continue; let v = t.slice(i + 1).trim(); if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) v = v.slice(1, -1); if (process.env[t.slice(0, i).trim()] === undefined) process.env[t.slice(0, i).trim()] = v; }

// Owner review fixes to the staged whale batch two (7 Oct 2026). Edits only touch staged generations, never `places`.
const BATCH2 = '423c33ad-2e1b-4c36-86a8-95e94e7f8a63';
type Out = { overview: string; monthly: Array<{ score: number; text: string }>; sources: unknown[]; confidence: string; flags: string[] };
const r1 = (x: number) => Math.round(x * 10) / 10;
function rep(s: string, a: string, b: string, ctx: string): string {
  if (s.includes(b) && !s.includes(a)) return s;
  if (!s.includes(a)) throw new Error(`Text to replace not found (${ctx}): ${a.slice(0, 60)}`);
  return s.split(a).join(b);
}

const EDITS: Record<string, (o: Out) => void> = {
  'milford-sound-fiordland': (o) => {
    o.overview = 'Bottlenose dolphins are regularly seen year-round on scenic cruises through Milford and Doubtful Sounds, often riding the bow wakes. There are no dedicated whale tours; humpback or southern right whales are only occasionally spotted near the fjord entrances.';
  },
  napa: (o) => {
    o.overview = 'Gray whales pass offshore during their winter and spring migration, and can be seen from shore lookouts or on boat trips from Bodega Bay and Jenner on the Sonoma County coast. The migration runs roughly from December to April, offering good chances to spot the whales as they travel along the coast.';
  },
  palau: (o) => { o.monthly[11].text = o.monthly[0].text; },
  palawan: (o) => { o.monthly[11].text = o.monthly[0].text; },
  'quebec-city': (o) => { o.monthly[11].text = o.monthly[0].text; },
  'papua-new-guinea': (o) => {
    o.overview = 'Spinner and bottlenose dolphins are regularly seen on diving and general boat trips in Kimbe Bay and Milne Bay, with occasional passing sperm whales and orcas. There are no dedicated whale trips, so sightings are incidental; seas are calmest from May to October.';
  },
  thailand: (o) => { for (const i of [5, 6, 7, 8, 9]) o.monthly[i].score = 0.2; },
  redwood: (o) => {
    o.overview = 'Gray whales pass offshore on their migrations and are regularly seen from viewpoints like the Klamath River Overlook and High Bluff Overlook. The northbound migration (March to May) brings mothers and calves closest to shore; the southbound peaks in December and January.';
    const peak = Math.max(...o.monthly.map((m) => m.score));
    const k = 4.4 / peak;
    for (const m of o.monthly) m.score = r1(m.score * k);
    o.monthly[3].score = 4.4;
  },
  rivieramaya: (o) => {
    o.overview = 'Bottlenose dolphins and Atlantic spotted dolphins are occasionally seen offshore year-round. Sightings are chance encounters on general snorkeling, diving, or sailing trips from Playa del Carmen and Puerto Aventuras.';
  },
  santorini: (o) => {
    o.overview = 'Bottlenose and striped dolphins are occasionally seen in the Aegean Sea around the Cyclades. Sightings are chance encounters from ferries or general sailing trips. Summer offers the calmest seas for spotting them.';
  },
  // Seoul: one blurb for the whole year, so a very small weather swing only (ferries run best in the mild months).
  seoul: (o) => { [0.9, 0.9, 1.0, 1.1, 1.1, 1.0, 0.9, 0.9, 1.1, 1.1, 1.0, 0.9].forEach((s, i) => (o.monthly[i].score = s)); },
  // Singapore: the monsoon months (the ones whose blurb says so) clearly lower than the rest.
  singapore: (o) => { o.monthly.forEach((m, i) => (m.score = [0, 10, 11].includes(i) ? 0.7 : 1.2)); },
  'southeast-alaska': (o) => { o.monthly[2].score = 0.7; },
  srilanka: (o) => { [4.4, 4.6, 4.7, 4.4].forEach((s, i) => (o.monthly[5 + i].score = s)); },
  svalbard: (o) => {
    o.overview = rep(o.overview, 'Beluga whales are regularly seen', 'Beluga whales are occasionally seen', 'svalbard ov');
    o.monthly[5].text = rep(o.monthly[5].text, 'bringing good chances to spot belugas and early-arriving fin and humpback whales.', 'bringing good chances to spot early-arriving fin and humpback whales, with belugas occasionally seen.', 'svalbard 6');
    o.monthly[6].text = rep(o.monthly[6].text, 'for reliable sightings of belugas, fin whales, and blue whales feeding in the nutrient-rich waters.', 'for reliable sightings of fin whales and blue whales feeding in the nutrient-rich waters, with belugas occasionally seen.', 'svalbard 7');
    o.monthly[7].text = rep(o.monthly[7].text, 'alongside resident belugas.', 'alongside occasional belugas.', 'svalbard 8');
  },
  whistler: (o) => {
    o.overview = rep(o.overview, 'boat trips departing from Vancouver—about two hours south of Whistler—find them reliably', 'boat trips departing from Vancouver find them reliably', 'whistler');
  },
  vietnam: (o) => {
    const t = 'Calmer seas allow chance sightings of Indo-Pacific bottlenose or spinner dolphins on general coastal boat trips; no dedicated tours operate.';
    o.monthly[3].text = t;
    o.monthly[4].text = t;
  },
};
// Staged rows that must not be applied: Marrakech stays N/A (owner), Tokyo & Kyoto was regenerated with a checked fact sheet.
const SUPERSEDED: Record<string, string> = {
  morocco: 'Owner decision on 7 Oct 2026: Marrakech & Atlas stays N/A for whale watching.',
  'tokyo-kyoto': 'Superseded on 7 Oct 2026 by batch 04e66f13: the Baird\'s beaked whale claim from Choshi had no evidence, so it was regenerated with a checked fact sheet.',
};

(async () => {
  const { db } = await import('../src/lib/db/client');
  const { contentGenerations } = await import('../src/lib/db/schema');
  const { eq } = await import('drizzle-orm');
  const { validateContent, overallStatus } = await import('../src/lib/gemini/validate');
  const gens = await db.select().from(contentGenerations).where(eq(contentGenerations.batchId, BATCH2));
  const summary: string[] = [];
  for (const g of gens) {
    if (SUPERSEDED[g.placeId]) {
      const note = [{ layer: 'content', severity: 'reject', message: SUPERSEDED[g.placeId] }];
      await db.update(contentGenerations).set({ validationStatus: 'invalid', validationErrors: note as never }).where(eq(contentGenerations.id, g.id));
      summary.push(`${g.placeId}: superseded`);
      continue;
    }
    const edit = EDITS[g.placeId];
    if (!edit) continue;
    const out = JSON.parse(JSON.stringify(g.parsedOutput)) as Out;
    edit(out);
    const issues = validateContent(out as never, 'whaleWatching', g.placeId);
    const status = overallStatus(issues);
    await db.update(contentGenerations).set({ parsedOutput: out as never, validationStatus: status, validationErrors: issues as never }).where(eq(contentGenerations.id, g.id));
    const rej = issues.filter((i) => i.severity === 'reject').map((i) => i.message.slice(0, 110));
    summary.push(`${g.placeId}: ${status}${rej.length ? ' | ' + rej.join(' | ') : ''} | scores ${out.monthly.map((m) => m.score).join(',')}`);
  }
  console.log(summary.join('\n'));
  process.exit(0);
})();
