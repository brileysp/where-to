import { readFileSync } from 'fs';
import { join } from 'path';
import { eq } from 'drizzle-orm';
import { drizzle as drizzlePostgres } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import { places, adminAuditLog } from '../src/lib/db/schema';

/** Flagged in the previous commit as a content gap: Nova Scotia's
 * whaleWatching was completely flat (base 7, no event) despite the Bay
 * of Fundy being a real, significant whale-watching region — humpback
 * and minke whales feed there Jun-Oct, and the bay is one of the last
 * critical feeding habitats for the endangered North Atlantic right
 * whale. Deliberately kept below the anchor tier (peak 9, not 10) —
 * removed from the whaleWatching anchor list this session specifically
 * because its old 10 was an unresearched artifact, not because the real
 * whale season here rivals the true global top tier. */

const KEY = 'whaleWatching';

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

  const [row] = await db.select().from(places).where(eq(places.id, 'nova-scotia'));
  const scoring = toScoringPlace(row);
  const base = scoring.base[KEY];
  const events = [{ label: 'Bay of Fundy whale season', weight: 2, months: { 6: 0.5, 7: 0.8, 8: 1, 9: 1, 10: 0.6 } }];
  const patchedScoring = { ...scoring, sliderEvents: { ...(scoring.sliderEvents ?? {}), [KEY]: events } };
  const { monthly } = deriveDestinationScores(patchedScoring, { skipHazards: true });
  const fit = fitMonthlyToCurve(monthly[KEY], { maxSteepness: 4, errorTolerance: 0.5 });
  console.log(`  nova-scotia  base=${base}  peak=${Math.max(...monthly[KEY]).toFixed(1)}  monthly=[${monthly[KEY].map((v: number) => v.toFixed(0)).join(',')}]`);
  const patch: Record<string, unknown> = {
    sliderEvents: { ...(row.sliderEvents as Record<string, unknown>), [KEY]: events },
    sliderCurves: { ...(row.sliderCurves as Record<string, unknown>), [KEY]: fit.curve },
    authoredCurves: Array.from(new Set([...(row.authoredCurves ?? []), KEY])),
  };
  if (!dryRun) {
    const after = { ...row, ...patch };
    await db.transaction(async (tx) => {
      await tx.update(places).set({ ...(patch as Partial<typeof places.$inferInsert>), updatedAt: new Date() }).where(eq(places.id, 'nova-scotia'));
      await tx.insert(adminAuditLog).values({
        actorId: '00000000-0000-0000-0000-000000000000', entityType: 'destination', entityId: 'nova-scotia',
        action: 'update', beforeValue: row, afterValue: after,
      });
    });
  }
  console.log(dryRun ? 'dry run' : 'done');
  process.exit(0);
}

main().catch((err) => { console.error(err); process.exit(1); });
