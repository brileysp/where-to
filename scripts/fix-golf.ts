import { readFileSync } from 'fs';
import { join } from 'path';
import { eq } from 'drizzle-orm';
import { drizzle as drizzlePostgres } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import { places, adminAuditLog } from '../src/lib/db/schema';

/**
 * golf had 8 destinations tied at the anchor tier — the same over-generous
 * tie signature found and fixed in skiing/surfing/fishing. Four of the
 * eight (Mauritius, Maui, Los Cabos, Punta Cana) were only reaching 10 via
 * a flat +3 generic hikingBest fallback bonus, the same "borrows the
 * destination's general good weather" mechanism-artifact pattern as the
 * pre-fix fishing tier — not from any golf-specific judgment. St Andrews,
 * Monterey-Big-Sur, Dubai, and Algarve, by contrast, had their high base
 * set directly (9-10), a real signal of deliberate judgment.
 *
 * Checked each of the four against real golf-tourism reputation, not just
 * the mechanism: Los Cabos holds up (Cabo del Sol/Diamante/Quivira are
 * genuinely acclaimed, marketed as golf-trip-specific) and stays anchored.
 * Maui has real substance too (Kapalua hosts the PGA Tour's season-opening
 * Sentry Tournament of Champions) but reads as a strong secondary draw on
 * an island whose identity is beaches/nature first — dropped one tier to
 * 9. Mauritius and Punta Cana are genuinely "nice course at the luxury
 * resort," not "the reason golfers plan the trip" — dropped further.
 *
 * Also gave every surviving/adjusted destination real seasonal shape
 * (zero events existed anywhere for golf) — several have dramatic, well-
 * known seasons: Dubai and Los Cabos are both desert climates where summer
 * heat genuinely limits play, not just a mild dip.
 */

const KEY = 'golf';

const EDITS: { id: string; target: number; label: string; months: number[]; newBase: number }[] = [
  { id: 'st-andrews-fife', target: 10, label: 'Scottish golf season', months: [4, 5, 6, 7, 8, 9, 10], newBase: 8 },
  { id: 'monterey-big-sur', target: 10, label: 'Dry-season golf window', months: [4, 5, 6, 7, 8, 9, 10], newBase: 8 },
  { id: 'dubai', target: 10, label: 'Cool-season golf window', months: [10, 11, 12, 1, 2, 3, 4], newBase: 7 },
  { id: 'algarve', target: 10, label: 'Shoulder-season golf window', months: [3, 4, 5, 6, 9, 10, 11], newBase: 8 },
  { id: 'los-cabos', target: 10, label: 'Dry-season golf window', months: [10, 11, 12, 1, 2, 3, 4, 5], newBase: 7 },
  // Real substance (Kapalua's PGA Tour season opener), but a strong
  // secondary draw rather than the reason for the trip — one tier below
  // the anchors rather than tied with them. Event deliberately covers
  // Dec-Sep (not just the tournament window) — Maui's hikingBest flag
  // covers May-Sep, and leaving those months uncovered let the generic
  // +3 fallback bonus push the peak back up to 10, overshooting the
  // intended 9 the same way the mechanism artifact did before the fix.
  { id: 'maui', target: 9, label: 'PGA Tour season & dry-season window', months: [12, 1, 2, 3, 4, 5, 6, 7, 8, 9], newBase: 7 },
  // Real golf, but resort-amenity tier, not bucket-list — corrected off
  // the anchor ceiling entirely.
  { id: 'mauritius', target: 7, label: 'Dry-season golf window', months: [5, 6, 7, 8, 9, 10, 11], newBase: 6 },
  { id: 'punta-cana', target: 7, label: 'Dry-season golf window', months: [12, 1, 2, 3, 4], newBase: 6 },
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

    console.log(`  ${e.id.padEnd(18)} base=${originalBase}->${base}  target=${e.target}  actual peak=${now.toFixed(1)}  monthly=[${values.map((v: number) => v.toFixed(0)).join(',')}]`);

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
