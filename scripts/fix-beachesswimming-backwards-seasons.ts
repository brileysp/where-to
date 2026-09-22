import { readFileSync } from 'fs';
import { join } from 'path';
import { eq } from 'drizzle-orm';
import { drizzle as drizzlePostgres } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import { places, adminAuditLog } from '../src/lib/db/schema';

/**
 * Three real bugs found while researching the apex-tier batch, caught by
 * checking against real sea-temperature data before trusting the existing
 * shape (per playbook §5 — verify, don't assume):
 *
 * - Rio: real water is warmest in Brazilian summer (Dec-Mar, 77-82°F) and
 *   coolest in winter (Jun-Aug, 70-73°F). The stored shape had this exactly
 *   backwards (peak Jun-Sep, low Jan-Mar). Verified: seatemperature.net,
 *   worldbeachguide.com.
 * - Sydney: real water cools gradually from 26°C (Jan/Feb) to 18°C
 *   (Jun-Aug) and back — a smooth curve, not the stored shape's single-
 *   month cliff (Jun=8, Jul=3, Aug=8). A data glitch, not real seasonality.
 *   Verified: weather-and-climate.com, seatemperature.info.
 * - Galápagos: the warm, calm season (Dec-May, 77-80°F) is genuinely the
 *   better swim window; the Garua season (Jun-Nov) brings colder (66°F),
 *   rougher, Humboldt-current water. The stored shape had this exactly
 *   backwards too. Verified: adventuresmithexplorations.com,
 *   adventure-life.com.
 *
 * All three verified against the live pipeline below, not hand-computed.
 */
const KEY = 'beachesSwimming';

function allMonths(base: number, target: number[]): { label: string; weight: number; months: Record<number, number> }[] {
  const byWeight = new Map<number, number[]>();
  target.forEach((t, i) => {
    const w = t - base;
    const list = byWeight.get(w) ?? [];
    list.push(i + 1);
    byWeight.set(w, list);
  });
  return [...byWeight.entries()].map(([weight, months]) => ({
    label: weight >= 0 ? 'Real warm season' : 'Real cooler season',
    weight,
    months: Object.fromEntries(months.map((m) => [m, 1])),
  }));
}

const FIXES: Record<string, { label: string; weight: number; months: Record<number, number> }[]> = {
  // Real: warm Dec-Mar, cooling into autumn, coolest Jun-Aug, warming back Sep-Nov.
  rio: allMonths(8, [9, 9, 9, 8, 8, 6, 6, 6, 7, 8, 8, 9]),
  // Real: 26°C Jan/Feb tapering smoothly to 18°C Jun-Aug, then back up.
  sydney: allMonths(8, [9, 9, 9, 8, 7, 6, 6, 6, 7, 8, 8, 9]),
  // Real: warm/calm Dec-May, cold/rough Garua season Jun-Nov.
  galapagos: allMonths(8, [9, 9, 9, 9, 8, 6, 6, 6, 6, 6, 7, 9]),
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
  const { toScoringPlace } = await import('../src/lib/db/queries/places');
  const { deriveDestinationScores } = await import('../src/lib/scoring/destinations');

  for (const id of Object.keys(FIXES)) {
    const [row] = await db.select().from(places).where(eq(places.id, id));
    if (!row) { console.error(`${id}: not found`); process.exit(1); }
    const before = deriveDestinationScores(toScoringPlace(row), { skipHazards: true }).monthly[KEY] as number[];
    const patch = { sliderEvents: { ...(row.sliderEvents as Record<string, unknown>), [KEY]: FIXES[id] } };
    const afterRow = { ...row, ...patch };
    const after = deriveDestinationScores(toScoringPlace(afterRow as typeof row), { skipHazards: true }).monthly[KEY] as number[];
    console.log(`${id}:\n  before [${before.join(',')}]\n  after  [${after.join(',')}]`);
    if (!dryRun) {
      await db.transaction(async (tx) => {
        await tx.update(places).set({ ...patch, updatedAt: new Date() }).where(eq(places.id, id));
        await tx.insert(adminAuditLog).values({ actorId: '00000000-0000-0000-0000-000000000000', entityType: 'destination', entityId: id, action: 'update', beforeValue: row, afterValue: afterRow });
      });
    }
  }
  console.log(dryRun ? '\ndry run — nothing written.' : '\ndone.');
  process.exit(0);
}

main().catch((err) => { console.error(err); process.exit(1); });
