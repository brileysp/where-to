import { readFileSync } from 'fs';
import { join } from 'path';
import { eq } from 'drizzle-orm';
import { drizzle as drizzlePostgres } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import { places, adminAuditLog } from '../src/lib/db/schema';
import { parseSliderCurve, rescaleCurve } from '../src/lib/scoring/curve';

/**
 * Caps landscapePhotography at each destination's own scenicLandscapes
 * peak.
 *
 * 123 of 174 destinations claimed a photography peak ABOVE their own
 * scenery peak — Venice 10 against 6, Angkor 10 against 6, Bavaria 10
 * against 6. That is not a judgement anyone could hold: the two sliders are
 * the same physical thing experienced versus photographed, which is exactly
 * how audit-interest-coverage.ts already describes them ("the clearest
 * possible authoring gap, since the two are the same physical thing
 * photographed vs. experienced").
 *
 * So this is a rule rather than 174 separate calls: photography cannot
 * exceed the landscape it is a photograph of. Destinations already at or
 * below their scenery peak are untouched — a place CAN be less
 * photographically interesting than it is beautiful to stand in, and that
 * remains an authorable claim.
 *
 * Runs after the scenicLandscapes saturation review, and depends on it:
 * before that pass 117 destinations had a scenery peak of 10, so this cap
 * would have done almost nothing.
 */

const KEY = 'landscapePhotography';
const AGAINST = 'scenicLandscapes';

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
    const key = t.slice(0, i).trim();
    let value = t.slice(i + 1).trim();
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1);
    }
    out[key] = value;
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
  // Dynamic import, after the env is set — see review-scenic-saturation.ts.
  const { getAllScoredPlaces } = await import('../src/lib/db/queries/places');
  const { isSliderNA } = await import('../src/lib/scoring/destinations');
  const dryRun = process.argv.includes('--dry-run');
  const db = drizzlePostgres(postgres(env.DATABASE_URL, { prepare: false }));

  const rows = await db.select().from(places).where(eq(places.isPrimaryDestination, true));
  const byId = new Map(rows.map((r) => [r.id, r]));
  const scored = await getAllScoredPlaces();

  let written = 0;
  let totalDrop = 0;
  for (const d of scored) {
    if (isSliderNA(d, KEY) || isSliderNA(d, AGAINST)) continue;
    const photo = d.monthly[KEY] ?? [];
    const scenic = d.monthly[AGAINST] ?? [];
    if (photo.length === 0 || scenic.length === 0) continue;

    const photoPeak = Math.max(...photo);
    const scenicPeak = Math.max(...scenic);
    if (photoPeak <= scenicPeak + 0.01) continue;

    const row = byId.get(d.id)!;
    const rawCurve = (row.sliderCurves as Record<string, unknown>)[KEY];
    if (rawCurve === undefined) continue;

    const floor = Math.min(...photo);
    // Floor can't survive above the new ceiling on a near-flat curve.
    const newFloor = Math.min(floor, scenicPeak);
    const rescaled = rescaleCurve(parseSliderCurve(rawCurve), newFloor, scenicPeak);
    const sliderCurves = { ...(row.sliderCurves as Record<string, unknown>), [KEY]: rescaled };
    const authoredCurves = Array.from(new Set([...(row.authoredCurves ?? []), KEY]));
    const after = { ...row, sliderCurves, authoredCurves };

    totalDrop += photoPeak - scenicPeak;
    console.log(`  ${d.id.padEnd(26)} photo ${photoPeak.toFixed(0)} -> ${scenicPeak.toFixed(0)}  (its own scenery peak)`);
    if (dryRun) { written++; continue; }

    await db.transaction(async (tx) => {
      await tx
        .update(places)
        .set({ sliderCurves: sliderCurves as typeof places.$inferInsert.sliderCurves, authoredCurves, updatedAt: new Date() })
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
    written++;
  }

  console.log(`\n${written} capped, mean drop ${written ? (totalDrop / written).toFixed(1) : '0'} points.`);
  if (dryRun) console.log('dry run — nothing written.');
  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
