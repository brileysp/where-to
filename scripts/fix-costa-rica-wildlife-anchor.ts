import { readFileSync } from 'fs';
import { join } from 'path';
import { eq } from 'drizzle-orm';
import { drizzle as drizzlePostgres } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import { places, adminAuditLog } from '../src/lib/db/schema';

/**
 * Costa Rica's wildlifeViewing base 8 -> 10, following
 * author-wildlife-drivers.ts's removal of its "dry-season visibility"
 * event.
 *
 * Costa Rica is one of wildlifeViewing's twelve global anchors — the
 * destinations that define what a 10 means for this interest. Removing
 * the event (there is no real dry-season concentration there, only trail
 * comfort) correctly took away the mechanism that USED to lift it to 10,
 * but it did nothing to the separate, still-true claim the anchor set
 * makes: Costa Rica is one of the most biodiverse places on earth per unit
 * area, and "you WILL see remarkable animals" here without much regard to
 * season. That claim was never about a dry-season swing — it was always
 * about year-round density and accessibility, which the event had been
 * riding alongside rather than actually representing.
 *
 * So the honest fix is not to re-add a fake seasonal event, it's to make
 * the flatness real: base 10 year-round, letting the formula's own mild
 * wet-season dip (-1 in the wettest months) be the only texture left,
 * which is a materially different curve than before (10 in ~8 months
 * versus a real peak/floor swing) — an honest flat 10, not a event-driven
 * one, and the exact case the earlier "no dry-season concentration" review
 * was about in the first place.
 */

function loadDotEnvLocal(): Record<string, string> {
  const out: Record<string, string> = {};
  let raw: string;
  try { raw = readFileSync(join(__dirname, '..', '.env.local'), 'utf8'); } catch { return out; }
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

const MAX_STEEPNESS = 4;
const ERROR_TOLERANCE = 0.5;

async function main() {
  const env = loadDotEnvLocal();
  if (!env.DATABASE_URL) {
    console.error('No DATABASE_URL in .env.local — refusing to run against the PGlite fallback.');
    process.exit(1);
  }
  process.env.DATABASE_URL = env.DATABASE_URL;
  const { toScoringPlace } = await import('../src/lib/db/queries/places');
  const { deriveDestinationScores } = await import('../src/lib/scoring/destinations');
  const { fitMonthlyToCurve } = await import('../src/lib/scoring/fitCurve');
  const dryRun = process.argv.includes('--dry-run');
  const db = drizzlePostgres(postgres(env.DATABASE_URL, { prepare: false }));

  const [row] = await db.select().from(places).where(eq(places.id, 'costa-rica'));
  const scoring = toScoringPlace(row);
  const patchedScoring = { ...scoring, base: { ...scoring.base, wildlifeViewing: 10 } };
  const { monthly } = deriveDestinationScores(patchedScoring, { skipHazards: true });
  const values = monthly.wildlifeViewing;
  const fit = fitMonthlyToCurve(values, { maxSteepness: MAX_STEEPNESS, errorTolerance: ERROR_TOLERANCE });

  console.log('costa-rica wildlifeViewing base 8 -> 10, monthly:', values.map((v) => v.toFixed(1)).join(' '));

  const patch = {
    baseScores: { ...(row.baseScores as Record<string, unknown>), wildlifeViewing: 10 },
    sliderCurves: { ...(row.sliderCurves as Record<string, unknown>), wildlifeViewing: fit.curve },
    authoredCurves: Array.from(new Set([...(row.authoredCurves ?? []), 'wildlifeViewing'])),
  };
  if (!dryRun) {
    await db.transaction(async (tx) => {
      await tx.update(places)
        .set({ ...(patch as Partial<typeof places.$inferInsert>), updatedAt: new Date() })
        .where(eq(places.id, 'costa-rica'));
      await tx.insert(adminAuditLog).values({
        actorId: '00000000-0000-0000-0000-000000000000',
        entityType: 'destination',
        entityId: 'costa-rica',
        action: 'update',
        beforeValue: row,
        afterValue: { ...row, ...patch },
      });
    });
  }
  console.log(dryRun ? 'dry run — nothing written.' : 'done.');
  process.exit(0);
}

main().catch((err) => { console.error(err); process.exit(1); });
