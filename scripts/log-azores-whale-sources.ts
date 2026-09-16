import { readFileSync } from 'fs';
import { join } from 'path';
import { eq } from 'drizzle-orm';
import { drizzle as drizzlePostgres } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import { places, adminAuditLog } from '../src/lib/db/schema';

type Source = { url: string; label?: string; note?: string; addedAt: string };
const TODAY = new Date().toISOString().slice(0, 10);

const SOURCES: Record<string, Source[]> = {
  wildlifeViewing: [
    { url: 'https://azores.com/blog/whale-watching-in-the-azores-islands', label: 'Azores.com', note: 'Confirms blue whales are spring migrants (Apr-May peak) and sperm whales are resident year-round, not migratory — corrected the event label, which had bundled them together', addedAt: TODAY },
  ],
  whaleWatching: [
    { url: 'https://azores.com/blog/whale-watching-in-the-azores-islands', label: 'Azores.com', note: 'Species-by-species monthly calendar: fin whales Mar-Jun, blue whales best Apr-May, sei whales Jul-Sep, sperm whales year-round', addedAt: TODAY },
    { url: 'https://www.azoreswhalewatch.com/statistics/whale-watching-season-reports/2025-whale-watching-season-sightings-report', label: 'Terra Azul 2025 season report', note: '2025 raw sighting counts by species (fin 184, sei 111, blue 50) support two distinct baleen-whale pulses rather than one flat Jun-Aug plateau', addedAt: TODAY },
    { url: 'https://whalewatchingazores.com/blog/statistics/', label: 'Whale Watching Azores (CW Azores)', note: 'Confirms the prior content’s claim that blue/fin whales are present "in large numbers" through October was inaccurate — multi-year notes describe sei whales, not blue/fin, as the mid/late-summer story', addedAt: TODAY },
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

  const [row] = await db.select().from(places).where(eq(places.id, 'azores'));
  if (!row) { console.error('azores: not found'); process.exit(1); }
  const newSources = { ...(row.sliderSources as Record<string, unknown>) };
  for (const [key, sources] of Object.entries(SOURCES)) newSources[key] = sources;
  const patch = { sliderSources: newSources };
  console.log(`azores: ${Object.keys(SOURCES).join(', ')}`);
  if (!dryRun) {
    const afterRow = { ...row, ...patch };
    await db.transaction(async (tx) => {
      await tx.update(places).set({ ...patch, updatedAt: new Date() }).where(eq(places.id, 'azores'));
      await tx.insert(adminAuditLog).values({
        actorId: '00000000-0000-0000-0000-000000000000', entityType: 'destination', entityId: 'azores',
        action: 'update', beforeValue: row, afterValue: afterRow,
      });
    });
  }
  console.log(dryRun ? '\ndry run' : '\ndone');
  process.exit(0);
}
main().catch((err) => { console.error(err); process.exit(1); });
