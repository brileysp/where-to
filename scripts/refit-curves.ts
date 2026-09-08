import { readFileSync } from 'fs';
import { join } from 'path';
import { eq } from 'drizzle-orm';
import { drizzle as drizzlePostgres } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import { places, adminAuditLog } from '../src/lib/db/schema';

/**
 * Re-fits named sliders' curves from the current formulas.
 *
 * Curves are the read path, so correcting a formula changes nothing a user
 * sees until the stored anchors are re-fitted from it. Used after the
 * seasonal-sign fixes (hotSprings/cold, surfing/swimHazard,
 * wildflowerBlooms/wet) — every curve for those sliders was fitted from a
 * formula that had the sign backwards, so the inverted shape is baked in.
 *
 * `authoredCurves` is respected two ways, because that column conflates two
 * different claims. A curve produced by rescaleCurve has an authored
 * CEILING but an inherited shape, so it gets the corrected shape rescaled
 * back onto its own floor and peak. Only ids passed in --hand-drawn are
 * left untouched entirely.
 *
 *   npx tsx scripts/refit-curves.ts --sliders=hotSprings,surfing --dry-run
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

function arg(name: string): string[] {
  const raw = process.argv.find((a) => a.startsWith(`--${name}=`));
  return raw ? raw.split('=')[1].split(',').filter(Boolean) : [];
}

async function main() {
  const env = loadDotEnvLocal();
  if (!env.DATABASE_URL) {
    console.error('No DATABASE_URL in .env.local — refusing to run against the PGlite fallback.');
    process.exit(1);
  }
  const keys = arg('sliders');
  if (!keys.length) { console.error('Pass --sliders=a,b,c'); process.exit(1); }
  const handDrawn = new Set(arg('hand-drawn'));

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

  for (const key of keys) {
    let written = 0, reshaped = 0, skipped = 0;
    for (const row of rows) {
      if (handDrawn.has(row.id)) { skipped++; continue; }
      const scoring = toScoringPlace(row);
      if (isSliderNA(scoring, key)) continue;

      const refitted = fitDestinationCurves(scoring) as Record<string, unknown>;
      let next = refitted[key];
      if (next === undefined) continue;

      if ((row.authoredCurves ?? []).includes(key)) {
        const monthly = scored.find((x) => x.id === row.id)?.monthly[key] ?? [];
        if (monthly.length) {
          next = rescaleCurve(parseSliderCurve(next), Math.min(...monthly), Math.max(...monthly));
          reshaped++;
        }
      }

      const sliderCurves = { ...(row.sliderCurves as Record<string, unknown>), [key]: next };
      if (JSON.stringify((row.sliderCurves as Record<string, unknown>)[key]) === JSON.stringify(next)) continue;
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
      // Keep the in-memory row current so a second slider in the same run
      // builds on this write instead of clobbering it.
      row.sliderCurves = sliderCurves as typeof row.sliderCurves;
      written++;
    }
    console.log(`${key.padEnd(20)} ${written} re-fitted (${reshaped} keeping an authored ceiling)${skipped ? `, ${skipped} hand-drawn skipped` : ''}`);
  }
  if (dryRun) console.log('\ndry run — nothing written.');
  process.exit(0);
}

main().catch((err) => { console.error(err); process.exit(1); });
