import { readFileSync } from 'fs';
import { join } from 'path';
import { eq } from 'drizzle-orm';
import { drizzle as drizzlePostgres } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import { places, adminAuditLog } from '../src/lib/db/schema';

const KEY = 'hotSprings';

// Found while researching real facts for the next hotSprings batch — three
// destinations where the generic swim-formula fallback (driven by
// destination-wide dry/wet/cold flags meant for other interests) produces
// a shape that contradicts the real, specific hot-spring story:
//
//   - tokyo-kyoto: the fallback gives a spring/autumn dry-season plateau
//     (Mar/Apr/Oct/Nov) with nothing distinguishing winter, but Kinosaki
//     Onsen's own tourism material explicitly names winter (snow-viewing
//     baths, paired with crab season) as ITS peak — a real, well-documented
//     onsen-specific season the generic dry/wet flags don't capture.
//   - argentine-lake-district: the fallback's cold-flip gives Jun-Aug as
//     the peak, but the region's real named site (Copahue) is only open
//     December-April — it's snowed in and closed for the rest of the year.
//     The fallback had this exactly backwards.
//   - north-island: the fallback's wet-season penalty craters Jun-Aug,
//     but real tourism sources are explicit that winter's cold-air contrast
//     is when Rotorua's geothermal pools are most prized, not least.
const EVENTS: Record<string, { label: string; weight: number; months: Record<number, number> }[]> = {
  'tokyo-kyoto': [
    { label: 'Winter onsen season (snow-viewing baths, e.g. Kinosaki)', weight: 1, months: { 12: 0.6, 1: 1, 2: 1 } },
  ],
  'argentine-lake-district': [
    { label: 'Copahue thermal season (snow-closed the rest of the year)', weight: 3, months: { 12: 0.5, 1: 1, 2: 1, 3: 1, 4: 0.5 } },
  ],
  'north-island': [
    { label: 'Geothermal pools — dry-season comfort & winter cold-air contrast', weight: 1.5, months: { 12: 0.7, 1: 1, 2: 1, 3: 0.7, 6: 0.7, 7: 1, 8: 0.7 } },
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
  const { toScoringPlace } = await import('../src/lib/db/queries/places');
  const { deriveDestinationScores } = await import('../src/lib/scoring/destinations');
  const { fitMonthlyToCurve } = await import('../src/lib/scoring/fitCurve');
  const dryRun = process.argv.includes('--dry-run');
  const db = drizzlePostgres(postgres(env.DATABASE_URL, { prepare: false }));

  for (const [id, events] of Object.entries(EVENTS)) {
    const [row] = await db.select().from(places).where(eq(places.id, id));
    if (!row) { console.error(`${id}: not found`); process.exit(1); }
    const before = deriveDestinationScores(toScoringPlace(row), { skipHazards: true }).monthly[KEY];

    const patch: Record<string, unknown> = { sliderEvents: { ...(row.sliderEvents as Record<string, unknown>), [KEY]: events } };
    const scoring = toScoringPlace({ ...row, ...patch } as typeof row);
    const monthly = deriveDestinationScores(scoring, { skipHazards: true }).monthly[KEY];
    const fit = fitMonthlyToCurve(monthly, { maxSteepness: 4, errorTolerance: 0.5 });
    patch.sliderCurves = { ...(row.sliderCurves as Record<string, unknown>), [KEY]: fit.curve };

    console.log(`${id}:`);
    console.log(`  before: [${before.map((v) => v.toFixed(0)).join(',')}]`);
    console.log(`  after:  [${monthly.map((v) => v.toFixed(0)).join(',')}] peak=${Math.max(...monthly)}`);

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
  console.log(dryRun ? '\ndry run — nothing written.' : '\ndone.');
  process.exit(0);
}

main().catch((err) => { console.error(err); process.exit(1); });
