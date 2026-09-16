import { readFileSync } from 'fs';
import { join } from 'path';
import { eq } from 'drizzle-orm';
import { drizzle as drizzlePostgres } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import { places, adminAuditLog } from '../src/lib/db/schema';

const KEY = 'wildflowerBlooms';

type Source = { url: string; label?: string; note?: string; addedAt: string };
const TODAY = new Date().toISOString().slice(0, 10);

const SOURCES: Record<string, Source[]> = {
  canaries: [
    { url: 'https://www.teneriffa-news.com/en/canary-islands-travel-guide/tajinaste-blooming-canarias_1464441.html', label: 'Teneriffa News', note: 'Confirms tajinaste rojo blooms late Apr-early Jun, peak May — the old event peaked in March with no June at all, contradicting the destination’s own overview text', addedAt: TODAY },
    { url: 'https://tenerifecotours.com/en/right-now-in-tenerife-discover-the-natural-beauty-of-the-tajinastes/', label: 'Tenerife Eco Tours', addedAt: TODAY },
  ],
  azores: [
    { url: 'https://byacores.com/en/hydrangeas/', label: 'ByAzores', note: 'Confirms Faial hydrangeas ramp up in June but don’t reach full bloom until July', addedAt: TODAY },
  ],
  provence: [
    { url: 'https://www.villaoverdon.com/en/lavender-at-the-verdon-when-to-see-valensole-fields-and-where-to-find-them/', label: 'Villa Overdon', note: 'Confirms fields are typically already harvested by early August', addedAt: TODAY },
  ],
  ethiopia: [
    { url: 'https://www.rootsethiopia.org/news/blog-posts/what-is-meskel-and-how-is-it-celebrated.html', label: 'Roots Ethiopia', note: 'Confirms Meskel daisies bloom Sep-Nov, not just September', addedAt: TODAY },
  ],
  kyrgyzstan: [
    { url: 'https://kyrgyzstan-tourism.com/blog/best-time-to-visit-song-kol-lake/', label: 'Kyrgyzstan Tourism', note: 'Confirms late Jul-Aug is considered the best window overall, not July alone', addedAt: TODAY },
  ],
  'north-island': [
    { url: 'https://www.rnz.co.nz/news/what-you-need-to-know/505397/yes-the-pohutukawa-are-blooming-brighter-this-year-what-you-need-to-know', label: 'RNZ', note: 'Confirms pōhutukawa blooming runs Nov-Jan, peaking mid-late December', addedAt: TODAY },
  ],
  tasmania: [
    { url: 'https://www.discovertasmania.com.au/experiences/stories/tasmania-in-spring/', label: 'Discover Tasmania', note: 'Confirms waratah and flannel flower (the overview’s named species) don’t peak until Nov-Jan, not September', addedAt: TODAY },
    { url: 'https://sitchu.com.au/tasmania/experiences/wildflowers-tasmania', label: 'Sitchu Tasmania', addedAt: TODAY },
  ],
  'death-valley': [
    { url: 'https://www.nps.gov/thingstodo/explore-wildflowers-in-death-valley.htm', label: 'National Park Service', note: 'NPS’s own four documented superblooms are 1998, 2005, 2016, and 2026 — 2019’s famous superbloom was Walker Canyon/Lake Elsinore in Southern California, a different location entirely', addedAt: TODAY },
    { url: 'https://www.popsci.com/environment/best-superbloom-death-valley-2026/', label: 'Popular Science', addedAt: TODAY },
  ],
  atacama: [
    { url: 'https://chile.travel/en/blog/flowering-desert-the-driest-in-the-world-fills-with-flowers-in-spring/', label: 'Chile Travel', note: 'Confirms the bloom cycle is every 5-7 years (not 5-8) and can extend into November', addedAt: TODAY },
  ],
  'glacier-waterton': [
    { url: 'https://www.nps.gov/glac/learn/news/media13-41.htm', label: 'National Park Service (Glacier)', note: 'Confirms real peak is mid-July through mid-August; June often still has snow on Logan Pass, and by September wildflowers are “pretty sparse”', addedAt: TODAY },
    { url: 'https://www.undercanvas.com/blog/guide-to-glacier-national-park-wildflowers/', label: 'Under Canvas', addedAt: TODAY },
  ],
  mallorca: [
    { url: 'https://www.seemallorca.com/events/calendar/almond-fair-son-severa', label: 'See Mallorca', note: 'Confirms the almond fair is held in Son Servera, not Consell as the overview previously stated', addedAt: TODAY },
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

  for (const [id, sources] of Object.entries(SOURCES)) {
    const [row] = await db.select().from(places).where(eq(places.id, id));
    if (!row) { console.error(`${id}: not found`); process.exit(1); }
    const patch = { sliderSources: { ...(row.sliderSources as Record<string, unknown>), [KEY]: sources } };
    console.log(`${id}: ${sources.length} source(s)`);
    if (!dryRun) {
      const afterRow = { ...row, ...patch };
      await db.transaction(async (tx) => {
        await tx.update(places).set({ ...patch, updatedAt: new Date() }).where(eq(places.id, id));
        await tx.insert(adminAuditLog).values({
          actorId: '00000000-0000-0000-0000-000000000000', entityType: 'destination', entityId: id,
          action: 'update', beforeValue: row, afterValue: afterRow,
        });
      });
    }
  }
  console.log(dryRun ? '\ndry run' : '\ndone');
  process.exit(0);
}
main().catch((err) => { console.error(err); process.exit(1); });
