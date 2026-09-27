import { readFileSync } from 'fs';
import { join } from 'path';
import { eq } from 'drizzle-orm';
import { drizzle as drizzlePostgres } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import { places, adminAuditLog } from '../src/lib/db/schema';
import { parseSliderCurve, rescaleCurve } from '../src/lib/scoring/curve';

/**
 * Second half of the scenicLandscapes saturation review: the destinations
 * that already sat at a peak of 9 before the peak-10 pass ran.
 *
 * The first pass deliberately left these alone — it was about removing 10s
 * nobody had claimed. But the same problem lives one notch down: Athens,
 * Barcelona, Lisbon, Seoul and Tokyo were all claiming 9 for LANDSCAPE, as
 * were Aruba and Turks & Caicos (flat coral islands) and Kruger and
 * Kaziranga (bushveld and floodplain — wildlife destinations whose draw is
 * the animals, not the terrain).
 *
 * Only the 47 pre-existing 9s are touched. The 30 set by the peak-10 pass
 * were deliberate judgements made hours ago against the same scale and are
 * left as they are rather than re-litigated.
 *
 * Twelve keep their 9, and they are worth naming because they are the test
 * of whether this scale means anything: Rio (Sugarloaf, Corcovado and the
 * bay are one of the great urban landscapes on earth), Queenstown, the
 * Amalfi Coast, Wadi Rum, Madeira, Santorini's caldera, Peru's Sacred
 * Valley, and the five North American parks — Banff, the Grand Canyon,
 * Rocky Mountain, Sequoia & Kings Canyon and Yellowstone.
 */

const KEY = 'scenicLandscapes';

const TARGET: Record<number, string[]> = {
  // Unchanged — a genuine 9.
  9: [
    'rio', 'queenstown', 'amalfi', 'jordan', 'madeira', 'santorini', 'peru',
    'banff', 'grandcanyon', 'rocky-mountain', 'sequoia-kings-canyon', 'yellowstone',
  ],
  8: ['aspen', 'whistler', 'algarve', 'croatia', 'thailand', 'costa-rica', 'seychelles', 'vietnam', 'chiapas'],
  7: [
    'edinburgh', 'hongkong', 'luangprabang', 'egypt', 'jamaica', 'maldives', 'panama',
    'andalucia', 'los-cabos', 'napa', 'oaxaca', 'pantanal',
  ],
  6: [
    'athens', 'barcelona', 'lisbon', 'seoul', 'aruba', 'turks-caicos', 'kaziranga', 'kruger',
    'rajasthan-golden-triangle', 'rioja', 'san-miguel-guanajuato', 'tokyo-kyoto',
  ],
  5: ['bordeaux', 'ghana'],
};

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
  // Dynamic, after the env is set — a static import loads db/client.ts too
  // early and silently falls back to the local PGlite sandbox.
  const { getAllScoredPlaces } = await import('../src/lib/db/queries/places');
  const dryRun = process.argv.includes('--dry-run');
  const db = drizzlePostgres(postgres(env.DATABASE_URL, { prepare: false }));

  const rows = await db.select().from(places).where(eq(places.isPrimaryDestination, true));
  const byId = new Map(rows.map((r) => [r.id, r]));
  const scored = await getAllScoredPlaces();

  // Scope: peak 9-9.9 AND not already authored by the peak-10 pass.
  const inScope = scored
    .filter((d) => {
      const p = Math.max(...(d.monthly[KEY] ?? [0]));
      const authored = (byId.get(d.id)?.authoredCurves ?? []).includes(KEY);
      return p >= 9 && p < 9.99 && !authored;
    })
    .map((d) => d.id);

  const assigned = new Map<string, number>();
  for (const [peak, ids] of Object.entries(TARGET)) {
    for (const id of ids) {
      if (assigned.has(id)) { console.error(`${id} assigned twice`); process.exit(1); }
      assigned.set(id, Number(peak));
    }
  }
  const missing = inScope.filter((id) => !assigned.has(id));
  const extra = [...assigned.keys()].filter((id) => !inScope.includes(id));
  if (missing.length || extra.length) {
    if (missing.length) console.error(`Unassigned (${missing.length}): ${missing.join(' ')}`);
    if (extra.length) console.error(`Assigned but out of scope (${extra.length}): ${extra.join(' ')}`);
    process.exit(1);
  }

  let written = 0;
  const counts: Record<number, number> = {};
  for (const id of inScope) {
    const target = assigned.get(id)!;
    counts[target] = (counts[target] ?? 0) + 1;
    if (target >= 9) continue;

    const row = byId.get(id)!;
    const d = scored.find((x) => x.id === id)!;
    const floor = Math.min(...(d.monthly[KEY] ?? [0]));
    const rawCurve = (row.sliderCurves as Record<string, unknown>)[KEY];
    if (rawCurve === undefined) { console.error(`${id}: no ${KEY} curve`); process.exit(1); }

    const rescaled = rescaleCurve(parseSliderCurve(rawCurve), floor, target);
    const sliderCurves = { ...(row.sliderCurves as Record<string, unknown>), [KEY]: rescaled };
    const authoredCurves = Array.from(new Set([...(row.authoredCurves ?? []), KEY]));
    const after = { ...row, sliderCurves, authoredCurves };

    console.log(`  ${id.padEnd(26)} peak 9 -> ${target}   (floor ${floor.toFixed(0)} kept)`);
    if (dryRun) { written++; continue; }

    await db.transaction(async (tx) => {
      await tx
        .update(places)
        .set({ sliderCurves: sliderCurves as typeof places.$inferInsert.sliderCurves, authoredCurves, updatedAt: new Date() })
        .where(eq(places.id, id));
      await tx.insert(adminAuditLog).values({
        actorId: '00000000-0000-0000-0000-000000000000',
        entityType: 'destination',
        entityId: id,
        action: 'update',
        beforeValue: row,
        afterValue: after,
      });
    });
    written++;
  }

  console.log(`\nin scope: ${inScope.length}  distribution: ` + Object.entries(counts).sort((a, b) => Number(b[0]) - Number(a[0])).map(([k, v]) => `${k}:${v}`).join('  '));
  console.log(dryRun ? `\ndry run — ${written} would change.` : `\ndone: ${written} reshaped, 12 kept at 9.`);
  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
