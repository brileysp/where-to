import { readFileSync } from 'fs';
import { join } from 'path';
import { eq } from 'drizzle-orm';
import { drizzle as drizzlePostgres } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import { places, adminAuditLog } from '../src/lib/db/schema';

const KEY = 'whaleWatching';

const OVERVIEWS: Record<string, string> = {
  hongkong: 'Chinese white dolphins — a sharply declining population, down from roughly 158 individuals in 2003 to around 37 by 2020 — are the real draw here, with an established operator running dedicated tours since 1995 and reporting a 97% sighting rate.',
  'milford-sound-fiordland': 'Fiordland holds one of the southernmost resident bottlenose dolphin populations in the world, studied here for decades — though current guidelines have cruise operators no longer actively pursuing them, so sightings are a real but opportunistic bonus rather than a guarantee.',
  croatia: 'The waters around Lošinj hold a resident community of roughly 180-200 individually known, named bottlenose dolphins, the subject of one of the longest continuous dolphin studies in the Mediterranean — commercial tours run in direct partnership with the research institute that has tracked them since 1987.',
};

const MONTHLY: Record<string, string[]> = {
  hongkong: [
    'Peak season for Chinese white dolphin tours — clear water and calm seas make for good visibility.', // Jan
    'Peak season for Chinese white dolphin tours — clear water and calm seas make for good visibility.', // Feb
    'Chinese white dolphin tours remain reliable as the dry season continues.', // Mar
    'Tours continue at a solid baseline as conditions transition toward the wetter season.', // Apr
    'Outside the clearest-water season, tours settle to a quieter baseline.', // May
    'Outside the clearest-water season, tours settle to a quieter baseline.', // Jun
    'Outside the clearest-water season, tours settle to a quieter baseline.', // Jul
    'Outside the clearest-water season, tours settle to a quieter baseline.', // Aug
    'Outside the clearest-water season, tours settle to a quieter baseline.', // Sep
    'Chinese white dolphin tours are improving as the dry season approaches.', // Oct
    'Chinese white dolphin tours are improving as the dry season approaches.', // Nov
    'Peak season for Chinese white dolphin tours — clear water and calm seas make for good visibility.', // Dec
  ],
  'milford-sound-fiordland': Array(12).fill('The resident bottlenose dolphin population is present year-round in Fiordland\'s waters, though current guidelines have cruise operators leaving encounters to chance rather than actively pursuing them.'),
  croatia: Array(12).fill('The resident bottlenose dolphin community around Lošinj is present year-round, with tours run in direct partnership with the marine research institute that has studied them for decades.'),
};

function loadDotEnvLocal(): Record<string, string> {
  const out: Record<string, string> = {};
  let raw: string;
  try { raw = readFileSync(join(__dirname, '..', '.env.local'), 'utf8'); } catch { return out; }
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
