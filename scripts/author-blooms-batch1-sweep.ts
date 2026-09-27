import { readFileSync } from 'fs';
import { join } from 'path';
import { eq } from 'drizzle-orm';
import { drizzle as drizzlePostgres } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import { places, adminAuditLog } from '../src/lib/db/schema';

const KEY = 'wildflowerBlooms';

const OVERVIEWS: Record<string, string> = {
  mallorca: 'Roughly 7 million almond trees blanket the island, and the bloom — the "snow of Mallorca" — is a real, if brief, annual event: two to three weeks, typically late January into February, shifting a little with the winter weather. The Fira de la Flor d\'Ametler in Consell is the island\'s own festival built around it.',
  'douro-valley-porto': 'The Douro Valley\'s terraced hillsides carry an official Almond Blossom Route, and the bloom is genuinely photogenic against the vineyard terraces — but it\'s a niche, brief event (two to three weeks, late February into early March), not a headline reason to visit on its own.',
  nepal: 'Nepal\'s rhododendron is the national flower, and the forests around Ghorepani-Poon Hill are often described as the largest rhododendron forest on Earth — a multi-day trek through red, pink, and white blooms rather than a single roadside stop. The window is real but specific: mid-March to mid-April, peaking around early-to-mid April.',
  bhutan: 'Bhutan\'s high mountain passes — Dochula and Chele La chief among them — turn red and pink with wild rhododendron each spring, and the country runs its own Rhododendron Festival around it. The bloom climbs with elevation, so lower slopes go first and the passes peak later, typically April into May.',
  istanbul: 'Istanbul\'s Tulip Festival plants over 30 million bulbs across the city\'s parks — Emirgan Park is the centerpiece — a deliberate reclaiming of a flower the Ottomans cultivated centuries before the Dutch did. It\'s a genuinely large-scale event, but a short one: the real peak is roughly a 10-day window in mid-April, not the whole month.',
  seoul: 'Seoul\'s cherry blossom season, centered on the Yeouido Spring Flower Festival along the Han River, is a real, comparably-scaled event to Japan\'s — millions of visitors, a dedicated festival — but the window is short and specific: roughly the first half of April, occasionally slipping a few days earlier or later with the spring weather.',
  ethiopia: 'The Meskel daisy (Adey Abeba) blankets highland fields yellow each September, timed to the end of the rainy season — but its fame is tied more to the Meskel festival itself (a UN-recognized cultural celebration, held September 27) than to flower-tourism in its own right. Worth knowing about if you\'re there for Meskel; not a reason to plan a trip around on its own.',
  atacama: 'In most years the Atacama — the driest desert on Earth — stays exactly that: bone dry, no flowers. Roughly once every 5 to 8 years, and increasingly unpredictable as rainfall patterns shift, an unusually wet winter triggers the Desierto Florido: dormant seeds burst into bloom across otherwise barren ground, carpeting stretches of desert in pink, purple, and yellow for a few weeks. There\'s no way to predict a specific year in advance — a bloom is typically only confirmed once it\'s already underway.',
  ladakh: 'Ladakh\'s apricot orchards across the Nubra and Sham valleys erupt into white-pink blossom for a couple of weeks each spring — genuinely picturesque against the high-desert backdrop, and the reason for the region\'s own Apricot Blossom Festival. The window is narrow and weather-dependent, typically the first half of April.',
};

const MONTHLY: Record<string, string[]> = {
  mallorca: [
    'Almond blossom season beginning — the island\'s roughly 7 million trees starting to flower, building toward peak.',
    'Peak almond blossom — the "snow of Mallorca," typically the best two weeks of the bloom, though the exact timing shifts with the winter weather.',
    'Almond blossom season usually finished by now, occasionally lingering into the first week in a late year.',
    'Outside almond blossom season.',
    'Outside almond blossom season.',
    'Outside almond blossom season.',
    'Outside almond blossom season.',
    'Outside almond blossom season.',
    'Outside almond blossom season.',
    'Outside almond blossom season.',
    'Outside almond blossom season.',
    'Outside almond blossom season.',
  ],
  'douro-valley-porto': [
    'Outside almond blossom season.',
    'Almond blossom season beginning along the Douro\'s terraced hillsides, building toward peak.',
    'Peak almond blossom — the terraces in bloom, typically the best two to three weeks, though timing shifts with the year\'s weather.',
    'Almond blossom season usually finished by now.',
    'Outside almond blossom season.',
    'Outside almond blossom season.',
    'Outside almond blossom season.',
    'Outside almond blossom season.',
    'Outside almond blossom season.',
    'Outside almond blossom season.',
    'Outside almond blossom season.',
    'Outside almond blossom season.',
  ],
  nepal: [
    'Outside rhododendron season.',
    'Outside rhododendron season.',
    'Rhododendron season beginning at lower elevations, building toward peak — the Ghorepani-Poon Hill forests starting to turn red and pink.',
    'Peak rhododendron season — the Ghorepani-Poon Hill trek and forests across the mid-hills in full bloom, typically the best two to three weeks in the first half of the month.',
    'Rhododendron season fading at lower elevations, occasionally still active higher up.',
    'Outside rhododendron season.',
    'The monsoon closes Chitwan National Park entirely — unrelated to blooms, but worth knowing if combining a trip.',
    'The monsoon closes Chitwan National Park entirely — unrelated to blooms, but worth knowing if combining a trip.',
    'Outside rhododendron season.',
    'Outside rhododendron season.',
    'Outside rhododendron season.',
    'Outside rhododendron season.',
  ],
  bhutan: [
    'Outside rhododendron season.',
    'Outside rhododendron season.',
    'Outside rhododendron season.',
    'Rhododendron season at its best — Dochula and Chele La passes turning red and pink, along with the country\'s own Rhododendron Festival.',
    'Rhododendron season continuing at higher elevations as lower slopes fade.',
    'Rhododendron season usually finished by now.',
    'Outside rhododendron season.',
    'Outside rhododendron season.',
    'Outside rhododendron season.',
    'Outside rhododendron season.',
    'Outside rhododendron season.',
    'Outside rhododendron season.',
  ],
  istanbul: [
    'Outside tulip season.',
    'Outside tulip season.',
    'Outside tulip season.',
    'Tulip season — Emirgan Park and the city\'s other tulip plantings in bloom, but the real peak is a narrow window, historically around April 10-20. Early or late April can still miss the best of it; check that year\'s bloom forecast before booking.',
    'Tulip season usually finished by now.',
    'Outside tulip season.',
    'Outside tulip season.',
    'Outside tulip season.',
    'Outside tulip season.',
    'Outside tulip season.',
    'Outside tulip season.',
    'Outside tulip season.',
  ],
  seoul: [
    'Outside cherry blossom season.',
    'Outside cherry blossom season.',
    'Outside cherry blossom season.',
    'Cherry blossom season — the Yeouido Spring Flower Festival along the Han River, but the real peak is roughly the first half of the month. Late April is often past it; check that year\'s forecast before booking.',
    'Cherry blossom season usually finished by now.',
    'Outside cherry blossom season.',
    'Outside cherry blossom season.',
    'Outside cherry blossom season.',
    'Outside cherry blossom season.',
    'Outside cherry blossom season.',
    'Outside cherry blossom season.',
    'Outside cherry blossom season.',
  ],
  ethiopia: [
    'Outside Meskel daisy season.',
    'Outside Meskel daisy season.',
    'Outside Meskel daisy season.',
    'Outside Meskel daisy season.',
    'Outside Meskel daisy season.',
    'Outside Meskel daisy season.',
    'Outside Meskel daisy season.',
    'Outside Meskel daisy season.',
    'Meskel daisies bloom across highland fields, timed to the end of the rainy season and the Meskel festival (September 27) — worth knowing about if you\'re there for Meskel, not a standalone draw.',
    'Outside Meskel daisy season.',
    'Outside Meskel daisy season.',
    'Outside Meskel daisy season.',
  ],
  atacama: [
    'Outside the window when a bloom could occur, and most years see no bloom at all regardless of month.',
    'Outside the window when a bloom could occur, and most years see no bloom at all regardless of month.',
    'Outside the window when a bloom could occur, and most years see no bloom at all regardless of month.',
    'Outside the window when a bloom could occur, and most years see no bloom at all regardless of month.',
    'Outside the window when a bloom could occur, and most years see no bloom at all regardless of month.',
    'Outside the window when a bloom could occur, and most years see no bloom at all regardless of month.',
    'Outside the window when a bloom could occur, and most years see no bloom at all regardless of month.',
    'The earliest edge of a possible bloom, only in a year when winter rains were unusually heavy — most years nothing happens here.',
    'Within the possible bloom window if that year\'s rains were heavy enough — confirm locally before planning a trip around it; most years there\'s no bloom at all.',
    'The most likely month for the Desierto Florido in a bloom year, but this remains a rare event, roughly once every 5-8 years and increasingly unpredictable. Check current reports before planning around it.',
    'Still within the possible window in a bloom year, typically fading by this point.',
    'Outside the window — even in a bloom year, this would be over by now.',
  ],
  ladakh: [
    'Outside apricot blossom season.',
    'Outside apricot blossom season.',
    'Too early most years — the bloom usually hasn\'t started yet, though a warm year can bring it forward into late March.',
    'Apricot blossom season — orchards across the Nubra and Sham valleys bloom, typically peaking in the first half of the month. Check locally before travel, since a cold spring can push the bloom later.',
    'The bloom has typically finished by now, occasionally lingering into the first week in a late year.',
    'Outside apricot blossom season.',
    'Outside apricot blossom season.',
    'Outside apricot blossom season.',
    'Outside apricot blossom season.',
    'Outside apricot blossom season.',
    'Outside apricot blossom season.',
    'Outside apricot blossom season.',
  ],
};

function loadDotEnvLocal(): Record<string, string> {
  const out: Record<string, string> = {};
  const raw = readFileSync(join(__dirname, '..', '.env.local'), 'utf8');
  for (const line of raw.split('\n')) {
    const t = line.trim();
    if (!t || t.startsWith('#')) continue;
    const i = t.indexOf('=');
    if (i === -1) continue;
    let v = t.slice(i + 1).trim();
    if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) v = v.slice(1, -1);
    out[t.slice(0, i).trim()] = v;
  }
  return out;
}

async function main() {
  const env = loadDotEnvLocal();
  if (!env.DATABASE_URL) { console.error('No DATABASE_URL'); process.exit(1); }
  process.env.DATABASE_URL = env.DATABASE_URL;
  const dryRun = process.argv.includes('--dry-run');
  const db = drizzlePostgres(postgres(env.DATABASE_URL, { prepare: false }));

  for (const id of Object.keys(OVERVIEWS)) {
    const [row] = await db.select().from(places).where(eq(places.id, id));
    if (!row) { console.error(`${id}: not found`); process.exit(1); }
    if (MONTHLY[id].length !== 12) { console.error(`${id}: monthly array is not length 12`); process.exit(1); }

    const patch: Record<string, unknown> = {
      sliderOverview: { ...(row.sliderOverview as Record<string, string>), [KEY]: OVERVIEWS[id] },
      sliderMonthlyWeather: { ...(row.sliderMonthlyWeather as Record<string, (string | null)[]>), [KEY]: MONTHLY[id] },
    };
    console.log(`  ${id}`);
    if (!dryRun) {
      const after = { ...row, ...patch };
      await db.transaction(async (tx) => {
        await tx.update(places).set({ ...patch, updatedAt: new Date() }).where(eq(places.id, id));
        await tx.insert(adminAuditLog).values({
          actorId: '00000000-0000-0000-0000-000000000000', entityType: 'destination', entityId: id,
          action: 'update', beforeValue: row, afterValue: after,
        });
      });
    }
  }
  console.log(dryRun ? '\ndry run — nothing written.' : '\ndone.');
  process.exit(0);
}

main().catch((err) => { console.error(err); process.exit(1); });
