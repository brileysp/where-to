import { readFileSync } from 'fs';
import { join } from 'path';
import { eq } from 'drizzle-orm';
import { drizzle as drizzlePostgres } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import { places, adminAuditLog } from '../src/lib/db/schema';

/**
 * Found while sampling wildlifeViewing content: Seychelles' only authored
 * event is an Oct-Nov whale shark spike (weight 6), leaving every other
 * month at base=2 — effectively nothing. In reality, Aldabra giant
 * tortoises (a large, free-roaming population on Curieuse Island) are a
 * reliable, non-seasonal sighting year-round, which the stored score
 * didn't reflect at all.
 */

const KEY = 'wildlifeViewing';

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

  const id = 'seychelles';
  const [row] = await db.select().from(places).where(eq(places.id, id));
  const scoring = toScoringPlace(row);
  const existingEvents = ((row.sliderEvents as Record<string, unknown>)?.[KEY] as unknown[]) ?? [];
  const tortoiseEvent = {
    label: 'Aldabra giant tortoises (Curieuse Island, non-seasonal)',
    weight: 3,
    months: { 1: 1, 2: 1, 3: 1, 4: 1, 5: 1, 6: 1, 7: 1, 8: 1, 9: 1, 10: 1, 11: 1, 12: 1 },
  };
  const newEvents = [...existingEvents, tortoiseEvent];
  const patchedScoring = { ...scoring, sliderEvents: { ...(scoring.sliderEvents ?? {}), [KEY]: newEvents } };
  const { monthly } = deriveDestinationScores(patchedScoring, { skipHazards: true });
  const fit = fitMonthlyToCurve(monthly[KEY], { maxSteepness: 4, errorTolerance: 0.5 });
  console.log(`  ${id}  base=${scoring.base[KEY]}  monthly=[${monthly[KEY].map((v: number) => v.toFixed(1)).join(',')}]`);
  const patch: Record<string, unknown> = {
    sliderEvents: { ...(row.sliderEvents as Record<string, unknown>), [KEY]: newEvents },
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
  console.log(dryRun ? 'dry run' : 'done');
  process.exit(0);
}

main().catch((err) => { console.error(err); process.exit(1); });
