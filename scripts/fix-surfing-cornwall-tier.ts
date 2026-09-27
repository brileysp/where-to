import { readFileSync } from 'fs';
import { join } from 'path';
import { eq } from 'drizzle-orm';
import { drizzle as drizzlePostgres } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import { places, adminAuditLog } from '../src/lib/db/schema';

/**
 * Specialist-lens review (playbook Step 5): the zero-weight-event fix
 * earlier in this pass set Cornwall's event weight to 2, landing it at
 * peak 9 — the same tier as Mundaka (basque-country), Tofino
 * (vancouver-island), Popoyo (nicaragua), and Cloudbreak (fiji). But
 * Cornwall's own authored content only calls Fistral "the UK's best-known
 * break," never claiming the "legendary"/"world tour" status the other
 * peak-9 destinations' content does. A real surf enthusiast wouldn't rank
 * Newquay in that same tier. Dropping the event weight to 1 lands peak 8,
 * matching the "well-known, solid, not legendary" tier (costa-rica,
 * canaries, algarve).
 */

const KEY = 'surfing';
const ID = 'cornwall';
const NEW_WEIGHT = 1;

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
  const existingEvent = (scoring.sliderEvents as Record<string, { label: string; weight: number; months: Record<string, number> }[]>)[KEY][0];
  const newEvent = { ...existingEvent, weight: NEW_WEIGHT };
  const patchedScoring = { ...scoring, sliderEvents: { ...(scoring.sliderEvents ?? {}), [KEY]: [newEvent] } };
  const monthly = deriveDestinationScores(patchedScoring, { skipHazards: true }).monthly[KEY];
  console.log(`  ${ID}`);
  console.log(`    before: peak=${Math.max(...before).toFixed(1)}  monthly=[${before.map((v: number) => v.toFixed(0)).join(',')}]`);
  console.log(`    after:  peak=${Math.max(...monthly).toFixed(1)}  monthly=[${monthly.map((v: number) => v.toFixed(0)).join(',')}]`);

  const fit = fitMonthlyToCurve(monthly, { maxSteepness: 4, errorTolerance: 0.5 });
  const patch: Record<string, unknown> = {
    sliderEvents: { ...(row.sliderEvents as Record<string, unknown>), [KEY]: [newEvent] },
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
