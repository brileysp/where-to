import { readFileSync } from 'fs';
import { join } from 'path';
import { eq } from 'drizzle-orm';
import { drizzle as drizzlePostgres } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import { places, adminAuditLog } from '../src/lib/db/schema';

/**
 * horsebackRiding's anchor tier had the same suspicious +3 mechanism-
 * artifact swing found in golf: 3 of 6 anchors (Argentine Lake District,
 * Iceland, Torres del Paine) were only reaching 10 via the generic
 * hikingBest fallback, not deliberate judgment.
 *
 * Argentine Lake District and Iceland hold up on inspection — Iceland's
 * horse is a genuinely unique, isolated breed and multi-day highland tours
 * are a real, well-known product; Argentine Lake District's Andean
 * crossing rides are real and marketed, and there's no better catalog
 * proxy for Argentine horse culture. Torres del Paine doesn't — its real
 * headline is trekking (the W/O circuits), with horseback riding a
 * secondary activity for some visitors, not the reason people go.
 * Corrected off the anchor tier.
 *
 * Andalucia was sitting one tier below (9) despite having one of the most
 * documented, internationally recognized equestrian traditions on Earth —
 * the Spanish purebred (PRE) breed, the Royal Andalusian School of
 * Equestrian Art, the Feria del Caballo. Promoted to fill the gap.
 *
 * Also added real seasonal shape to all six (zero events existed
 * anywhere) — mostly hard climate-driven windows (Mongolia/Kyrgyzstan/
 * Iceland are all summer-only; snow and river crossings close the
 * highlands otherwise), plus Andalucia's is deliberately timed around the
 * Feria del Caballo itself (May).
 */

const KEY = 'horsebackRiding';

const EDITS: { id: string; target: number; label: string; months: number[]; newBase: number }[] = [
  { id: 'mongolia', target: 10, label: 'Nomadic trekking season', months: [6, 7, 8, 9], newBase: 7 },
  { id: 'kyrgyzstan', target: 10, label: 'Mountain trekking season', months: [6, 7, 8, 9], newBase: 7 },
  { id: 'provence', target: 10, label: 'Camargue riding season', months: [4, 5, 6, 9, 10], newBase: 7 },
  { id: 'argentine-lake-district', target: 10, label: 'Andean crossing season', months: [11, 12, 1, 2, 3], newBase: 7 },
  { id: 'iceland', target: 10, label: 'Highland riding season', months: [6, 7, 8, 9], newBase: 7 },
  { id: 'andalucia', target: 10, label: 'Feria del Caballo & spring riding season', months: [4, 5, 6, 10, 11], newBase: 7 },
  // Real, but secondary to trekking — corrected off the anchor tier.
  { id: 'torres-del-paine', target: 7, label: 'Patagonian summer riding season', months: [11, 12, 1, 2, 3], newBase: 5 },
];

const MAX_STEEPNESS = 4;
const ERROR_TOLERANCE = 0.5;

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

async function main() {
  const env = loadDotEnvLocal();
  if (!env.DATABASE_URL) {
    console.error('No DATABASE_URL in .env.local — refusing to run against the PGlite fallback.');
    process.exit(1);
  }
  process.env.DATABASE_URL = env.DATABASE_URL;
  const { toScoringPlace } = await import('../src/lib/db/queries/places');
  const { deriveDestinationScores, isSliderNA } = await import('../src/lib/scoring/destinations');
  const { fitMonthlyToCurve } = await import('../src/lib/scoring/fitCurve');
  const dryRun = process.argv.includes('--dry-run');
  const db = drizzlePostgres(postgres(env.DATABASE_URL, { prepare: false }));

  for (const e of EDITS) {
    const [row] = await db.select().from(places).where(eq(places.id, e.id));
    const scoring = toScoringPlace(row);
    if (isSliderNA(scoring, KEY)) { console.error(`${e.id}: is N/A`); process.exit(1); }
    const originalBase = scoring.base[KEY];
    const base = e.newBase;

    const weight = Math.round((e.target - base) * 10) / 10;
    const events = [{ label: e.label, weight, months: Object.fromEntries(e.months.map((m) => [m, 1])) }];
    const patchedEvents = { ...(scoring.sliderEvents ?? {}), [KEY]: events };
    const patchedScoring = { ...scoring, sliderEvents: patchedEvents, base: { ...scoring.base, [KEY]: base } };

    const { monthly } = deriveDestinationScores(patchedScoring, { skipHazards: true });
    const values = monthly[KEY];
    const fit = fitMonthlyToCurve(values, { maxSteepness: MAX_STEEPNESS, errorTolerance: ERROR_TOLERANCE });
    const now = Math.max(...values);

    console.log(`  ${e.id.padEnd(24)} base=${originalBase}->${base}  target=${e.target}  actual peak=${now.toFixed(1)}  monthly=[${values.map((v: number) => v.toFixed(0)).join(',')}]`);

    const patch: Record<string, unknown> = {
      sliderEvents: patchedEvents,
      sliderCurves: { ...(row.sliderCurves as Record<string, unknown>), [KEY]: fit.curve },
      authoredCurves: Array.from(new Set([...(row.authoredCurves ?? []), KEY])),
      baseScores: { ...(row.baseScores as Record<string, unknown>), [KEY]: base },
    };
    const after = { ...row, ...patch };
    if (!dryRun) {
      await db.transaction(async (tx) => {
        await tx.update(places)
          .set({ ...(patch as Partial<typeof places.$inferInsert>), updatedAt: new Date() })
          .where(eq(places.id, e.id));
        await tx.insert(adminAuditLog).values({
          actorId: '00000000-0000-0000-0000-000000000000',
          entityType: 'destination',
          entityId: e.id,
          action: 'update',
          beforeValue: row,
          afterValue: after,
        });
      });
    }
  }
  console.log(dryRun ? '\ndry run — nothing written.' : '\ndone.');
  process.exit(0);
}

main().catch((err) => { console.error(err); process.exit(1); });
