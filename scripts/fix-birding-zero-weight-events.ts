import { readFileSync } from 'fs';
import { join } from 'path';
import { eq } from 'drizzle-orm';
import { drizzle as drizzlePostgres } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import { places, adminAuditLog } from '../src/lib/db/schema';

const KEY = 'birding';

/**
 * Found while cross-checking wildlifeViewing against birding: three
 * destinations have a real, correctly-shaped birding sliderEvent authored,
 * but with weight: 0 — a structural no-op (bonus = weight * intensity),
 * the identical bug pattern already found and fixed 4x on surfing this
 * session (scripts/fix-surfing-zero-weight-events.ts). All three verified
 * as genuine phenomena before restoring a weight (not assumed):
 *   - Galapagos: garua-season seabird breeding is real and well-documented
 *     (heightened marine productivity during the cool/misty Jun-Dec
 *     season); weight kept modest (1) to match wildlifeViewing's own event
 *     for the same driver and avoid pushing this non-anchor destination's
 *     already-high base (8) over the anchor ceiling.
 *   - GBR: Cairns Esplanade is a genuinely well-known shorebird migration
 *     site within this catalog entry's own region (unlike the surfing
 *     case, where GBR's reef structure blocks the swell the equivalent
 *     surfing event claimed — verified this is NOT the same mislabel).
 *     Real passage Sep-Mar per multiple Cairns birding guides.
 *   - Kruger: Palearctic migrant arrivals are a real, standard bushveld
 *     phenomenon, identical months to Tanzania's own (weighted) birding
 *     event for the same driver; weight kept lower than Tanzania's because
 *     Kruger's birding base is already higher, and Kruger isn't a birding
 *     anchor destination (unlike Tanzania), so a high weight would risk
 *     an unintended ceiling.
 */

const WEIGHT_FIXES: Record<string, number> = {
  galapagos: 1,
  gbr: 1,
  kruger: 2,
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

  for (const [id, newWeight] of Object.entries(WEIGHT_FIXES)) {
    const [row] = await db.select().from(places).where(eq(places.id, id));
    if (!row) { console.error(`${id}: not found`); process.exit(1); }
    const existingEvents = ((row.sliderEvents as Record<string, unknown>)?.[KEY] as Array<{ label: string; weight: number; months: Record<string, number> }>) ?? [];
    const newEvents = existingEvents.map((e) => (e.weight === 0 ? { ...e, weight: newWeight } : e));

    const scoringRow = { ...row, sliderEvents: { ...(row.sliderEvents as Record<string, unknown>), [KEY]: newEvents } };
    const scoring = toScoringPlace(scoringRow as typeof row);
    const monthly = deriveDestinationScores(scoring, { skipHazards: true }).monthly[KEY];
    console.log(`${id}: [${monthly.map((v: number) => v.toFixed(0)).join(',')}] peak=${Math.max(...monthly)}`);

    const fit = fitMonthlyToCurve(monthly, { maxSteepness: 4, errorTolerance: 0.5 });
    const patch: Record<string, unknown> = {
      sliderEvents: { ...(row.sliderEvents as Record<string, unknown>), [KEY]: newEvents },
      sliderCurves: { ...(row.sliderCurves as Record<string, unknown>), [KEY]: fit.curve },
    };

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
