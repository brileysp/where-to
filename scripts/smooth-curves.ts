import { readFileSync } from 'fs';
import { join } from 'path';
import { eq } from 'drizzle-orm';
import { drizzle as drizzlePostgres } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import { places, adminAuditLog } from '../src/lib/db/schema';
import { parseSliderCurve } from '../src/lib/scoring/curve';

/**
 * General-purpose version of scripts/smooth-hiking-family-curves.ts — same
 * algorithm, any slider list. See that script's doc comment for the full
 * background (the wildlifePeak=+7 class of bug, why fitCurve.ts's Phase 2
 * fitter faithfully reproduces boolean-flag step shapes, and the
 * tied-extreme anchoring fix this all depends on).
 *
 * Re-fits each destination's CURRENT rendered monthly values — never the
 * raw formula — through fitMonthlyToCurve with a capped steepness, so
 * nothing this session already rescaled (anchor-set ceilings, saturation
 * demotions) gets reset to its pre-edit shape.
 *
 * PARAMETERS ARE TIGHTER HERE than the hiking-family run: maxSteepness 4,
 * errorTolerance 0.5 — the ORIGINAL default tolerance, not loosened at
 * all. Tuning showed capping steepness alone already eliminates every
 * steepness>=7 anchor with a negligible anchor-count cost (culture 4.98->
 * 5.02 mean anchors, food/shopping/luxury effectively unchanged, swim
 * 5.07->5.09) — there is no need to trade any tolerance for it on these
 * smaller-magnitude formulas the way hiking-family's larger swings
 * benefited from. Tighter tolerance is also the more conservative choice
 * in general, independent of the specific tied-extreme bug that tolerance
 * exposed last time.
 *
 *   npx tsx scripts/smooth-curves.ts --sliders=a,b,c [--exclude-ids=x,y] [--dry-run]
 *
 * `--exclude-ids` skips specific destinations entirely for every slider in
 * this run — for sunbathing, that means every id touched by
 * author-sunbathing.ts (hand-drawn shapes) or author-sunbathing-levels.ts
 * (deliberate level judgments), where the CURRENT shape already reflects
 * real authored intent that a mechanical re-fit has no business touching.
 */

const MAX_STEEPNESS = 4;
const ERROR_TOLERANCE = 0.5;

function loadDotEnvLocal(): Record<string, string> {
  const out: Record<string, string> = {};
  let raw: string;
  try {
    raw = readFileSync(join(__dirname, '..', '.env.local'), 'utf8');
  } catch {
    return out;
  }
  for (const line of raw.split('\n')) {
    const t = line.trim();
    if (!t || t.startsWith('#')) continue;
    const i = t.indexOf('=');
    if (i === -1) continue;
    let value = t.slice(i + 1).trim();
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1);
    }
    out[t.slice(0, i).trim()] = value;
  }
  return out;
}

function arg(name: string): string[] {
  const raw = process.argv.find((a) => a.startsWith(`--${name}=`));
  return raw ? raw.split('=')[1].split(',').filter(Boolean) : [];
}

function maxSteepnessOf(curve: { anchors: { steepness?: number }[] }): number {
  return Math.max(2, ...curve.anchors.map((a) => a.steepness ?? 2));
}

async function main() {
  const env = loadDotEnvLocal();
  if (!env.DATABASE_URL) {
    console.error('No DATABASE_URL in .env.local — refusing to run against the PGlite fallback.');
    process.exit(1);
  }
  const sliders = arg('sliders');
  if (!sliders.length) { console.error('Pass --sliders=a,b,c'); process.exit(1); }
  const excludeIds = new Set(arg('exclude-ids'));

  process.env.DATABASE_URL = env.DATABASE_URL;
  // Dynamic, after the env is set — see review-scenic-saturation.ts.
  const { getAllScoredPlaces } = await import('../src/lib/db/queries/places');
  const { isSliderNA } = await import('../src/lib/scoring/destinations');
  const { fitMonthlyToCurve } = await import('../src/lib/scoring/fitCurve');
  const dryRun = process.argv.includes('--dry-run');
  const db = drizzlePostgres(postgres(env.DATABASE_URL, { prepare: false }));

  const rows = await db.select().from(places).where(eq(places.isPrimaryDestination, true));
  const byId = new Map(rows.map((r) => [r.id, { ...r }]));
  const scored = await getAllScoredPlaces();

  let touched = 0;
  let skippedFlat = 0;
  let skippedAlreadySmooth = 0;
  let skippedExcluded = 0;
  const perSlider: Record<string, number> = {};
  let hardStepsBefore = 0;
  let hardStepsAfter = 0;

  for (const d of scored) {
    const row = byId.get(d.id);
    if (!row) continue;
    if (excludeIds.has(d.id)) { skippedExcluded++; continue; }
    let rowCurves: Record<string, unknown> | null = null;

    for (const key of sliders) {
      if (isSliderNA(d, key)) continue;
      const monthly = d.monthly[key];
      if (!monthly || monthly.length !== 12) continue;
      if (monthly.every((v) => Math.abs(v - monthly[0]) < 1e-9)) { skippedFlat++; continue; }

      const rawExisting = (row.sliderCurves as Record<string, unknown>)[key];
      const existingSteepness = rawExisting ? maxSteepnessOf(parseSliderCurve(rawExisting)) : 0;
      if (existingSteepness >= 7) hardStepsBefore++;
      if (existingSteepness < MAX_STEEPNESS) { skippedAlreadySmooth++; continue; }

      const fit = fitMonthlyToCurve(monthly, { maxSteepness: MAX_STEEPNESS, errorTolerance: ERROR_TOLERANCE });
      const newSteepness = maxSteepnessOf(fit.curve);
      if (newSteepness >= 7) hardStepsAfter++; // tripwire — should never fire, given MAX_STEEPNESS

      if (!rowCurves) rowCurves = { ...(row.sliderCurves as Record<string, unknown>) };
      rowCurves[key] = fit.curve;
      perSlider[key] = (perSlider[key] ?? 0) + 1;
      touched++;
    }

    if (rowCurves) {
      const touchedKeys = Object.keys(rowCurves).filter((k) => sliders.includes(k));
      const authoredCurves = Array.from(new Set([...(row.authoredCurves ?? []), ...touchedKeys]));
      const patch = { sliderCurves: rowCurves, authoredCurves };
      const after = { ...row, ...patch };
      if (!dryRun) {
        await db.transaction(async (tx) => {
          await tx.update(places)
            .set({ ...(patch as Partial<typeof places.$inferInsert>), updatedAt: new Date() })
            .where(eq(places.id, d.id));
          await tx.insert(adminAuditLog).values({
            actorId: '00000000-0000-0000-0000-000000000000',
            entityType: 'destination',
            entityId: d.id,
            action: 'update',
            beforeValue: row,
            afterValue: after,
          });
        });
      }
      byId.set(d.id, after as typeof row);
    }
  }

  console.log(`Sliders: ${sliders.join(', ')}`);
  console.log('Curves smoothed per slider:');
  for (const [key, n] of Object.entries(perSlider).sort((a, b) => b[1] - a[1])) {
    console.log(`  ${key.padEnd(22)} ${n}`);
  }
  console.log(`\n${touched} curves re-fit.`);
  console.log(`Skipped: ${skippedFlat} flat, ${skippedAlreadySmooth} already under the steepness ceiling, ${skippedExcluded} excluded destinations.`);
  console.log(`Hard steps (steepness >= 7) before: ${hardStepsBefore}. After: ${hardStepsAfter} (should be 0).`);
  console.log(dryRun ? '\ndry run — nothing written.' : '\ndone.');
  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
