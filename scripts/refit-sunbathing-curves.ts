import { readFileSync } from 'fs';
import { join } from 'path';
import { eq } from 'drizzle-orm';
import { drizzle as drizzlePostgres } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import { places, adminAuditLog } from '../src/lib/db/schema';

/**
 * Re-fits the `sunbathing` curve from the corrected sun formula.
 *
 * Curves are the read path, and every sunbathing curve in the catalogue was
 * fitted from a formula that docked -2 for a hot month — so the inverted
 * shape is baked into the stored anchors and fixing the formula alone
 * changes nothing a user sees. This re-fits that one slider.
 *
 * `authoredCurves` needs splitting here, because it conflates two different
 * claims. Most of the authored sunbathing curves were produced by
 * rescaleCurve — the anchor-ceiling pass and the two beach-premise reverts —
 * which moves a curve's ceiling and deliberately PRESERVES its shape. Their
 * shape is therefore still the buggy fit, inverted July and all, even though
 * the column says "authored".
 *
 * So: the fourteen curves drawn by hand in author-sunbathing.ts are left
 * completely alone, and everything else is re-fitted for SHAPE and then
 * rescaled back onto whatever floor and peak it currently has. Nobody's
 * ceiling judgement is lost; only the month-to-month shape underneath it is
 * corrected.
 */

/**
 * Hand-drawn in scripts/author-sunbathing.ts — real authored anchors, not a
 * rescaled fit. These keep their shape.
 */
const HAND_DRAWN = new Set([
  'napa', 'dolomites', 'atacama', 'uluru', 'kyrgyzstan', 'north-cascades', 'ladakh',
  'mongolia', 'pakistan', 'tierra-del-fuego', 'greenland', 'churchill', 'svalbard',
  'antarctica',
]);

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

const KEY = 'sunbathing';

async function main() {
  const env = loadDotEnvLocal();
  if (!env.DATABASE_URL) {
    console.error('No DATABASE_URL in .env.local — refusing to run against the PGlite fallback.');
    process.exit(1);
  }
  process.env.DATABASE_URL = env.DATABASE_URL;
  // Dynamic, after the env is set — see review-scenic-saturation.ts.
  const { toScoringPlace, getAllScoredPlaces } = await import('../src/lib/db/queries/places');
  const { fitDestinationCurves } = await import('../src/lib/scoring/fitCurve');
  const { isSliderNA } = await import('../src/lib/scoring/destinations');
  const { parseSliderCurve, rescaleCurve } = await import('../src/lib/scoring/curve');
  const dryRun = process.argv.includes('--dry-run');
  const db = drizzlePostgres(postgres(env.DATABASE_URL, { prepare: false }));

  const rows = await db.select().from(places).where(eq(places.isPrimaryDestination, true));
  const scored = await getAllScoredPlaces();
  let written = 0;
  let reshaped = 0;
  let skipped = 0;

  for (const row of rows) {
    if (HAND_DRAWN.has(row.id)) { skipped++; continue; }
    const scoring = toScoringPlace(row);
    if (isSliderNA(scoring, KEY)) continue;

    const refitted = fitDestinationCurves(scoring) as Record<string, unknown>;
    let next = refitted[KEY];
    if (next === undefined) continue;

    // An authored ceiling is a judgement; put the corrected shape back
    // underneath it rather than discarding it.
    if ((row.authoredCurves ?? []).includes(KEY)) {
      const monthly = scored.find((x) => x.id === row.id)?.monthly[KEY] ?? [];
      if (monthly.length) {
        next = rescaleCurve(parseSliderCurve(next), Math.min(...monthly), Math.max(...monthly));
        reshaped++;
      }
    }

    const before = JSON.stringify((row.sliderCurves as Record<string, unknown>)[KEY]);
    if (before === JSON.stringify(next)) continue;

    const sliderCurves = { ...(row.sliderCurves as Record<string, unknown>), [KEY]: next };
    const after = { ...row, sliderCurves };
    if (!dryRun) {
      await db.transaction(async (tx) => {
        await tx.update(places)
          .set({ sliderCurves: sliderCurves as typeof places.$inferInsert.sliderCurves, updatedAt: new Date() })
          .where(eq(places.id, row.id));
        await tx.insert(adminAuditLog).values({
          actorId: '00000000-0000-0000-0000-000000000000',
          entityType: 'destination',
          entityId: row.id,
          action: 'update',
          beforeValue: row,
          afterValue: after,
        });
      });
    }
    written++;
  }

  console.log(`${written} sunbathing curves re-fitted (${reshaped} of them keeping an authored ceiling), ${skipped} hand-drawn curves left alone.`);
  if (dryRun) console.log('dry run — nothing written.');
  process.exit(0);
}

main().catch((err) => { console.error(err); process.exit(1); });
