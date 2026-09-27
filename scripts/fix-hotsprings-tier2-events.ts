import { readFileSync } from 'fs';
import { join } from 'path';
import { eq } from 'drizzle-orm';
import { drizzle as drizzlePostgres } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import { places, adminAuditLog } from '../src/lib/db/schema';

const KEY = 'hotSprings';

// Same bug class as fix-hotsprings-tier1-events.ts, found continuing the
// same research pass: both destinations have a real hard ACCESS window
// (not just a comfort preference) that the generic cold-flip fallback gets
// backwards.
//   - kyrgyzstan: Altyn Arashan's access road and guesthouses are only
//     open June-September; the rest of the year it's snowed in and
//     unreachable. The fallback's cold-flip made winter the peak — exactly
//     when it's inaccessible.
//   - greenland: Uunartoq's hot spring itself stays warm year-round, but
//     it's on an uninhabited island only reachable by organized boat tours
//     that run June-September. Outside that window it's effectively cut
//     off by weather/ice for a typical visitor. The fallback's cold-flip
//     again made winter the peak — the exact months it can't be reached.
const EVENTS: Record<string, { label: string; weight: number; months: Record<number, number> }[]> = {
  kyrgyzstan: [
    { label: 'Altyn Arashan accessible season (road & guesthouses open)', weight: 3, months: { 6: 0.7, 7: 1, 8: 1, 9: 0.6 } },
  ],
  greenland: [
    { label: 'Uunartoq boat-tour season (the only way to reach it)', weight: 3, months: { 6: 0.7, 7: 1, 8: 1, 9: 0.6 } },
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
