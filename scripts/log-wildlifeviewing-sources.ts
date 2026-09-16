import { readFileSync } from 'fs';
import { join } from 'path';
import { eq } from 'drizzle-orm';
import { drizzle as drizzlePostgres } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import { places, adminAuditLog } from '../src/lib/db/schema';

const KEY = 'wildlifeViewing';

type Source = { url: string; label?: string; note?: string; addedAt: string };

const TODAY = new Date().toISOString().slice(0, 10);

const SOURCES: Record<string, Source[]> = {
  'torres-del-paine': [
    { url: 'https://www.cascada.travel/en/tour/patagonia-winter-puma-tracking-sku-wpat080', label: 'Cascada Expediciones', note: 'Confirms winter (Jun-Aug) puma-tracking success rates of 80-90%, driven by snow-track visibility and guanaco concentration', addedAt: TODAY },
    { url: 'https://www.swoop-patagonia.com/visit/wildlife/pumas', label: 'Swoop Patagonia', addedAt: TODAY },
  ],
  yellowstone: [
    { url: 'https://yellowstonesafari.com/lamar-valley-wolves-yellowstones-premier-wolf-watching-destination/', label: 'Yellowstone Safari Company', addedAt: TODAY },
    { url: 'https://www.tetonscience.org/where-to-see-wolves-in-yellowstone-this-winter-and-what-to-expect/', label: 'Teton Science Schools', note: 'Confirms Feb/Mar as the strongest wolf-watching months', addedAt: TODAY },
  ],
  'great-smoky-mountains': [
    { url: 'https://www.wate.com/news/smoky-mountains/best-ways-to-witness-the-elk-rut-in-the-great-smoky-mountains-national-park/', label: 'WATE 6 News', note: 'Confirms Cataloochee elk rut runs mid-Sep through late Oct', addedAt: TODAY },
  ],
  'cape-cod-islands': [
    { url: 'https://www.capecodchamber.org/articles/stories/post/cape-cod-whale-watching-guide-best-time-tours-tips/', label: 'Cape Cod Chamber of Commerce', note: 'Confirms Jul-Sep peak with sighting rates approaching 98%; existing event was missing both months', addedAt: TODAY },
  ],
  rwanda: [
    { url: 'https://www.safaribookings.com', label: 'SafariBookings — Best Time to Visit pages', note: 'Same short-dry vs. long-dry tier-inversion pattern already corrected on the safari slider', addedAt: TODAY },
  ],
  lofoten: [
    { url: 'https://guidetolofoten.com/ethical-whale-watching-in-tromso-best-tours/', label: 'Guide to Lofoten', note: 'Confirms herring/orca activity shifted north to Tromsø/Skjervøy since ~2022', addedAt: TODAY },
  ],
  komodo: [
    { url: 'https://mantadivekomodo.com/manta-rays-in-komodo/', label: 'Manta Dive Komodo', note: 'Confirms southern (Manta Alley) Dec-Mar aggregation vs. central/north Aug-Oct activity — the old single dry-season event had this backwards for the southern site', addedAt: TODAY },
    { url: 'https://indahnesia.id/journal/manta-ray-season-in-komodo-2026-month-by-month-guide', label: 'Indahnesia', addedAt: TODAY },
  ],
  seychelles: [
    { url: 'https://koek.sc/en/seychelles-diving-guide/seychelles-whale-shark-diving', label: 'KOEK Seychelles', note: 'MCSS monitoring data confirms Oct/Nov as the genuine peak, not a "tail end"', addedAt: TODAY },
  ],
  nicaragua: [
    { url: 'https://vianica.com/attraction/25/la-flor-beach-natural-reserve', label: 'ViaNica.com', note: 'Confirms La Flor arribadas run Jul-Jan with Sep/Oct peak, correcting the un-scored, mis-dated Jun-Oct text', addedAt: TODAY },
  ],
  'monterey-big-sur': [
    { url: 'https://www.nps.gov/articles/where-when-elephant-seals-point-reyes.htm', label: 'National Park Service', note: 'Confirms pupping peaks mid-January, colony thins by early March; distinct from the Mar-Apr gray whale northbound migration', addedAt: TODAY },
    { url: 'https://montereybay.noaa.gov/visitor/seasons.html', label: 'Monterey Bay National Marine Sanctuary', addedAt: TODAY },
  ],
  maui: [
    { url: 'https://mauiwhalewatching.com/', label: 'Maui Whale Watching', note: 'Confirms February as peak whale density, not a flat Dec-Apr plateau', addedAt: TODAY },
  ],
  hokkaido: [
    { url: 'https://www.japan.travel/en/japans-local-treasures/red-crowned-cranes-kushiro-2020/', label: 'Japan Travel (JNTO)', note: 'Confirms cranes gather Dec-Mar, not just Jan-Feb', addedAt: TODAY },
  ],
  kenya: [
    { url: 'https://www.masaimaramigration.com/safari-guide/masai-mara-river-crossing-best-time-places-to-see-the-migration/', label: 'Masai Mara Migration', note: 'Confirms July is "growing momentum" building toward the August peak, not itself a peak month', addedAt: TODAY },
  ],
  kerala: [
    { url: 'https://elephantguide.com/complete-seasonal-elephant-viewing-guide-by-location/', label: 'Elephant Guide', note: 'Confirms April as the height of Periyar dry-season elephant concentration', addedAt: TODAY },
  ],
  ladakh: [
    { url: 'https://www.ju-lehadventure.com/trekking-ladakh/winter-snow-leopard', label: 'Ju-Leh Adventure', note: 'Confirms a real, accessible November shoulder season for snow-leopard tracking', addedAt: TODAY },
    { url: 'https://vargiskhan.com/log/ladakh-roads-in-winter/', label: 'Vargis Khan', note: 'On Leh winter road/flight access — flagged separately as a possible destination-wide inaccessible-flag issue, not changed here', addedAt: TODAY },
  ],
  namibia: [
    { url: 'https://etoshanationalpark.com.na/plan-your-visit/etosha-in-september/', label: 'Etosha National Park guide', note: 'Confirms Sep/Oct as the true dry-season peak; October was previously underweighted relative to September', addedAt: TODAY },
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

  for (const id of Object.keys(SOURCES)) {
    const [row] = await db.select().from(places).where(eq(places.id, id));
    if (!row) { console.error(`${id}: not found`); process.exit(1); }
    const sources = SOURCES[id];
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
