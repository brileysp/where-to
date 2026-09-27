import { readFileSync } from 'fs';
import { join } from 'path';
import { eq } from 'drizzle-orm';
import { drizzle as drizzlePostgres } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import { places, adminAuditLog } from '../src/lib/db/schema';

const KEY = 'diving';

// Found via db:audit:scoring while wrapping up the diving pass: Sydney's
// July diving score was a literal 0 — base5 + the swim formula's default
// -5 cold-flag penalty (no diving-specific SWIM_SIGN_FLIPS entry exists,
// unlike surfing/hotSprings). But grey nurse shark aggregations at Magic
// Point — Sydney's signature dive, already the headline of its own
// overview text — actually PEAK in winter (May-Sep), not just "still
// happen despite the cold." The cold flag had the sign backwards for this
// specific slider at this specific destination. Pre-existing bug, not
// introduced this session — Sydney was never touched for diving before.

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

  const [row] = await db.select().from(places).where(eq(places.id, 'sydney'));
  const scoring = toScoringPlace(row);
  const before = deriveDestinationScores(scoring, { skipHazards: true }).monthly[KEY];

  const event = { label: 'Grey nurse shark aggregation (Magic Point)', weight: 1, months: { 5: 0.6, 6: 1, 7: 1, 8: 1, 9: 0.6 } };
  const patchedScoring = { ...scoring, sliderEvents: { ...(scoring.sliderEvents ?? {}), [KEY]: [event] } };
  const after = deriveDestinationScores(patchedScoring, { skipHazards: true }).monthly[KEY];
  console.log('before:', before.map((v: number) => v.toFixed(0)).join(','));
  console.log('after: ', after.map((v: number) => v.toFixed(0)).join(','));

  const fit = fitMonthlyToCurve(after, { maxSteepness: 4, errorTolerance: 0.5 });
  const patch: Record<string, unknown> = {
    sliderEvents: { ...(row.sliderEvents as Record<string, unknown>), [KEY]: [event] },
    sliderCurves: { ...(row.sliderCurves as Record<string, unknown>), [KEY]: fit.curve },
    authoredCurves: Array.from(new Set([...(row.authoredCurves ?? []), KEY])),
    sliderOverview: {
      ...(row.sliderOverview as Record<string, string>),
      [KEY]: "This is real temperate diving, not tropical — grey nurse sharks gather at sites like Magic Point and Fish Rock, with the largest, most reliable aggregations actually in winter (May-Sep), not despite the cooler water. Weedy seadragons, found only in this part of the world, are a genuine specialty year-round.",
    },
    sliderMonthlyWeather: {
      ...(row.sliderMonthlyWeather as Record<string, unknown>),
      [KEY]: [
        'Grey nurse sharks present at Magic Point, outside their peak aggregation window.',
        'Grey nurse sharks present at Magic Point, outside their peak aggregation window.',
        'Grey nurse sharks present at Magic Point, outside their peak aggregation window.',
        'Grey nurse sharks present at Magic Point, outside their peak aggregation window.',
        'Grey nurse shark aggregation season beginning at Magic Point, building toward peak.',
        'Peak grey nurse shark aggregation season — the largest, most reliable numbers at Magic Point, despite the cooler water.',
        'Peak grey nurse shark aggregation season — the largest, most reliable numbers at Magic Point, despite the cooler water.',
        'Peak grey nurse shark aggregation season — the largest, most reliable numbers at Magic Point, despite the cooler water.',
        'Grey nurse shark aggregation season easing, still strong numbers.',
        'Grey nurse sharks present at Magic Point, outside their peak aggregation window.',
        'Grey nurse sharks present at Magic Point, outside their peak aggregation window.',
        'Grey nurse sharks present at Magic Point, outside their peak aggregation window.',
      ],
    },
  };

  if (!dryRun) {
    const afterRow = { ...row, ...patch };
    await db.transaction(async (tx) => {
      await tx.update(places).set({ ...patch, updatedAt: new Date() }).where(eq(places.id, 'sydney'));
      await tx.insert(adminAuditLog).values({
        actorId: '00000000-0000-0000-0000-000000000000', entityType: 'destination', entityId: 'sydney',
        action: 'update', beforeValue: row, afterValue: afterRow,
      });
    });
  }
  console.log(dryRun ? '\ndry run' : '\ndone');
  process.exit(0);
}
main().catch((err) => { console.error(err); process.exit(1); });
