import { readFileSync } from 'fs';
import { join } from 'path';
import { eq } from 'drizzle-orm';
import { drizzle as drizzlePostgres } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import { places, adminAuditLog } from '../src/lib/db/schema';

const KEY = 'whaleWatching';

type Source = { url: string; label?: string; note?: string; addedAt: string };

const TODAY = new Date().toISOString().slice(0, 10);

const BASE: Source[] = [
  { url: 'https://sealifeguide.com/best-time-to-go-whale-watching/', label: 'Sea Life Guide', addedAt: TODAY },
  { url: 'https://2seewhales.com', label: '2seewhales.com', addedAt: TODAY },
];

// Destination-specific sources named explicitly in the research, beyond the
// two base sources every destination in this pass was checked against.
const EXTRA: Record<string, Source[]> = {
  acadia: [{ url: 'https://www.barharborwhales.com', label: 'Bar Harbor Whale Watch', note: 'Confirmed Mount Desert Rock (not Jeffreys Ledge) as the real feeding ground', addedAt: TODAY }],
  belize: [{ url: 'https://ambergristoday.com', label: 'Ambergris Today', note: 'A 2011 Turneffe Atoll sighting described by name as "a truly rare sighting" — basis for downgrading to incidental', addedAt: TODAY }],
  'cape-cod-islands': [{ url: 'https://stellwagen.noaa.gov', label: 'NOAA Stellwagen Bank National Marine Sanctuary', addedAt: TODAY }],
  'charleston-savannah': [{ url: 'https://www.fisheries.noaa.gov', label: 'NOAA Fisheries', note: 'North Atlantic right whale calving season Nov-Apr', addedAt: TODAY }],
  'nova-scotia': [{ url: 'https://www.fisheries.noaa.gov', label: 'NOAA Fisheries', note: 'Post-2010 regime shift moved much of the right whale population to the Gulf of St. Lawrence', addedAt: TODAY }],
  falklands: [{ url: 'https://www.falklandsconservation.com', label: 'Falklands Conservation', addedAt: TODAY }],
  croatia: [{ url: 'https://www.blue-world.org', label: 'Blue World Institute', note: 'Confirms Lošinj population is resident bottlenose dolphins, not whales', addedAt: TODAY }],
};

const IDS = [
  'monterey-big-sur', 'belize', 'cape-cod-islands', 'falklands', 'charleston-savannah',
  'cornwall', 'rio', 'svalbard', 'tasmania', 'tierra-del-fuego', 'acadia', 'nova-scotia',
  'lofoten', 'los-cabos', 'sicily',
];

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

  for (const id of IDS) {
    const [row] = await db.select().from(places).where(eq(places.id, id));
    if (!row) { console.error(`${id}: not found`); process.exit(1); }
    const sources = [...BASE, ...(EXTRA[id] ?? [])];
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
