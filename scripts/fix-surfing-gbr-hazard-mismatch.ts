import { readFileSync } from 'fs';
import { join } from 'path';
import { eq } from 'drizzle-orm';
import { drizzle as drizzlePostgres } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import { places, adminAuditLog } from '../src/lib/db/schema';

/**
 * Specialist-lens review (playbook Step 5) caught a real score/content
 * mismatch: GBR's surfing score has no event, so it falls to the standalone
 * 'swim' formula, where SWIM_SIGN_FLIPS.surfing.hazard flips a destination's
 * swimHazard flag from a -5 penalty into a +2 bonus (the "dangerous swim
 * conditions usually mean good surf" heuristic). For GBR, swimHazard is
 * driven by stinger-jellyfish season (Nov-Apr, per the destination's own
 * `about` text) — nothing to do with swell or wave quality. The reef
 * actually blocks most incoming ocean swell, which is exactly why the
 * water is calm enough for the diving GBR is known for. The false-positive
 * hazard bonus was pushing surfing to peak 8, directly contradicting the
 * batch1 content ("This isn't really a surf destination... modest and
 * inconsistent"). Lowering baseScores.surfing so the peak lands in the
 * genuinely-modest/incidental tier (~3-4), matching peers like belize,
 * tanzania, redwood.
 */

const KEY = 'surfing';
const ID = 'gbr';
const NEW_BASE = 1;

async function main() {
  const raw = readFileSync(join(__dirname, '..', '.env.local'), 'utf8');
  const env: Record<string, string> = {};
  for (const line of raw.split('\n')) {
    const t = line.trim();
    if (!t || t.startsWith('#')) continue;
    const i = t.indexOf('=');
    if (i === -1) continue;
    let v = t.slice(i + 1).trim();
    if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) v = v.slice(1, -1);
    env[t.slice(0, i).trim()] = v;
  }
  if (!env.DATABASE_URL) { console.error('No DATABASE_URL'); process.exit(1); }
  process.env.DATABASE_URL = env.DATABASE_URL;
  const { toScoringPlace } = await import('../src/lib/db/queries/places');
  const { deriveDestinationScores } = await import('../src/lib/scoring/destinations');
  const { fitMonthlyToCurve } = await import('../src/lib/scoring/fitCurve');
  const dryRun = process.argv.includes('--dry-run');
  const db = drizzlePostgres(postgres(env.DATABASE_URL, { prepare: false }));

  const [row] = await db.select().from(places).where(eq(places.id, ID));
  const scoring = toScoringPlace(row);
  const before = deriveDestinationScores(scoring, { skipHazards: true }).monthly[KEY];
  const patchedScoring = { ...scoring, base: { ...scoring.base, [KEY]: NEW_BASE } };
  const monthly = deriveDestinationScores(patchedScoring, { skipHazards: true }).monthly[KEY];
  console.log(`  ${ID}`);
  console.log(`    before: peak=${Math.max(...before).toFixed(1)}  monthly=[${before.map((v: number) => v.toFixed(0)).join(',')}]`);
  console.log(`    after:  peak=${Math.max(...monthly).toFixed(1)}  monthly=[${monthly.map((v: number) => v.toFixed(0)).join(',')}]`);

  const fit = fitMonthlyToCurve(monthly, { maxSteepness: 4, errorTolerance: 0.5 });

  const NEW_OVERVIEW = 'This isn\'t really a surf destination — the reef itself blocks most incoming ocean swell close to shore, the same reason its water is calm enough for the diving it\'s actually known for. Any real wave-surfing culture on this stretch of coast is modest and inconsistent, without a real seasonal pattern worth planning around.';
  const NEW_MONTHLY = [
    'Baseline, very minor conditions.', 'Baseline, very minor conditions.', 'Baseline, very minor conditions.',
    'A marginally better stretch, still very minor.', 'A marginally better stretch, still very minor.',
    'Baseline, very minor conditions.', 'Baseline, very minor conditions.', 'Baseline, very minor conditions.', 'Baseline, very minor conditions.', 'Baseline, very minor conditions.',
    'A marginally better stretch, still very minor.', 'A marginally better stretch, still very minor.',
  ];

  const patch: Record<string, unknown> = {
    baseScores: { ...(row.baseScores as Record<string, number>), [KEY]: NEW_BASE },
    sliderCurves: { ...(row.sliderCurves as Record<string, unknown>), [KEY]: fit.curve },
    authoredCurves: Array.from(new Set([...(row.authoredCurves ?? []), KEY])),
    sliderOverview: { ...(row.sliderOverview as Record<string, string>), [KEY]: NEW_OVERVIEW },
    sliderMonthlyWeather: { ...(row.sliderMonthlyWeather as Record<string, string[]>), [KEY]: NEW_MONTHLY },
  };
  if (!dryRun) {
    const after = { ...row, ...patch };
    await db.transaction(async (tx) => {
      await tx.update(places).set({ ...(patch as Partial<typeof places.$inferInsert>), updatedAt: new Date() }).where(eq(places.id, ID));
      await tx.insert(adminAuditLog).values({ actorId: '00000000-0000-0000-0000-000000000000', entityType: 'destination', entityId: ID, action: 'update', beforeValue: row, afterValue: after });
    });
  }
  console.log(dryRun ? '\ndry run' : '\ndone');
  process.exit(0);
}

main().catch((err) => { console.error(err); process.exit(1); });
