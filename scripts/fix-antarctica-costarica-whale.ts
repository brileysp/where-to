import { readFileSync } from 'fs';
import { join } from 'path';
import { eq } from 'drizzle-orm';
import { drizzle as drizzlePostgres } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import { places, adminAuditLog } from '../src/lib/db/schema';

/**
 * Found while surveying whaleWatching's full catalog before writing
 * content: Antarctica and Costa Rica were both flat (no authored
 * event), despite both being real, major whale destinations.
 *
 * Antarctica's whaleWatching was flat 8 across its whole Nov-Mar
 * accessible window (Apr-Oct is already correctly zeroed by the global
 * `inaccessible` mechanism — ships can't sail then). In reality, whale
 * sightings build through the season as sea ice retreats further and
 * krill blooms — Feb-Mar is the recognized peak whale window, distinct
 * from Nov-Dec's early-season/penguin-chick peak (already captured in
 * the wildlifeViewing event).
 *
 * Costa Rica's Pacific coast sees two separate humpback populations at
 * different times of year — Southern Hemisphere humpbacks breeding
 * Jul-Oct, Northern Hemisphere humpbacks breeding Dec-Mar — giving it
 * one of the longest whale-watching seasons in the world.
 */

const KEY = 'whaleWatching';

const FIXES: Record<string, { events: Array<{ label: string; weight: number; months: Record<number, number> }> }> = {
  antarctica: {
    events: [
      { label: 'Increasing whale activity as sea ice retreats', weight: 2, months: { 1: 0.5, 2: 1, 3: 1 } },
    ],
  },
  'costa-rica': {
    events: [
      { label: 'Southern Hemisphere humpback season', weight: 3, months: { 7: 0.5, 8: 1, 9: 1, 10: 0.6 } },
      { label: 'Northern Hemisphere humpback season', weight: 3, months: { 12: 0.5, 1: 1, 2: 1, 3: 0.6 } },
    ],
  },
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

  for (const [id, fix] of Object.entries(FIXES)) {
    const [row] = await db.select().from(places).where(eq(places.id, id));
    const scoring = toScoringPlace(row);
    const patchedScoring = { ...scoring, sliderEvents: { ...(scoring.sliderEvents ?? {}), [KEY]: fix.events } };
    const { monthly } = deriveDestinationScores(patchedScoring, { skipHazards: true });
    const fit = fitMonthlyToCurve(monthly[KEY], { maxSteepness: 4, errorTolerance: 0.5 });
    console.log(`  ${id}  base=${scoring.base[KEY]}  peak=${Math.max(...monthly[KEY]).toFixed(1)}  monthly=[${monthly[KEY].map((v: number) => v.toFixed(0)).join(',')}]`);
    const patch: Record<string, unknown> = {
      sliderEvents: { ...(row.sliderEvents as Record<string, unknown>), [KEY]: fix.events },
      sliderCurves: { ...(row.sliderCurves as Record<string, unknown>), [KEY]: fit.curve },
      authoredCurves: Array.from(new Set([...(row.authoredCurves ?? []), KEY])),
    };
    if (!dryRun) {
      const after = { ...row, ...patch };
      await db.transaction(async (tx) => {
        await tx.update(places).set({ ...(patch as Partial<typeof places.$inferInsert>), updatedAt: new Date() }).where(eq(places.id, id));
        await tx.insert(adminAuditLog).values({
          actorId: '00000000-0000-0000-0000-000000000000', entityType: 'destination', entityId: id,
          action: 'update', beforeValue: row, afterValue: after,
        });
      });
    }
  }
  console.log(dryRun ? 'dry run' : 'done');
  process.exit(0);
}

main().catch((err) => { console.error(err); process.exit(1); });
