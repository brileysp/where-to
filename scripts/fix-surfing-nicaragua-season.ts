import { readFileSync } from 'fs';
import { join } from 'path';
import { eq } from 'drizzle-orm';
import { drizzle as drizzlePostgres } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import { places, adminAuditLog } from '../src/lib/db/schema';

/**
 * Found while researching real surf breaks for the batch: Nicaragua's
 * stored event ("Consistent dry-season Pacific swells", peaking Jan-Mar)
 * had the real Popoyo season backwards. Real research: the dry season's
 * offshore wind is so strong Jan-Mar it's often described as "alarming"
 * and can blow conditions out; the genuinely best window is Apr-Oct, when
 * wind drops and swell stays consistent (peak July, ~90% clean days).
 */

const KEY = 'surfing';
const ID = 'nicaragua';
// Weight kept at 1 (not 2) to land at peak 9, not 10 — surfing's anchor
// set ("a world-reference wave") is deliberately just bali/maui/lisbon,
// and Popoyo, while genuinely excellent, isn't typically ranked in that
// same legendary tier. Same call already made for Mundaka and Tofino.
const NEW_EVENT = {
  label: 'Popoyo consistent swell (calm-wind season)',
  weight: 1,
  months: { 4: 0.6, 5: 0.8, 6: 0.9, 7: 1, 8: 0.9, 9: 0.8, 10: 0.6 },
};

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
  const patchedScoring = { ...scoring, sliderEvents: { ...(scoring.sliderEvents ?? {}), [KEY]: [NEW_EVENT] } };
  const monthly = deriveDestinationScores(patchedScoring, { skipHazards: true }).monthly[KEY];
  console.log(`  ${ID}`);
  console.log(`    before: peak=${Math.max(...before).toFixed(1)}  monthly=[${before.map((v: number) => v.toFixed(0)).join(',')}]`);
  console.log(`    after:  peak=${Math.max(...monthly).toFixed(1)}  monthly=[${monthly.map((v: number) => v.toFixed(0)).join(',')}]`);

  const fit = fitMonthlyToCurve(monthly, { maxSteepness: 4, errorTolerance: 0.5 });
  const patch: Record<string, unknown> = {
    sliderEvents: { ...(row.sliderEvents as Record<string, unknown>), [KEY]: [NEW_EVENT] },
    sliderCurves: { ...(row.sliderCurves as Record<string, unknown>), [KEY]: fit.curve },
    authoredCurves: Array.from(new Set([...(row.authoredCurves ?? []), KEY])),
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
