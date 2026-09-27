import { readFileSync } from 'fs';
import { join } from 'path';
import { eq } from 'drizzle-orm';
import { drizzle as drizzlePostgres } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import { places, adminAuditLog } from '../src/lib/db/schema';
import { parseSliderCurve, rescaleCurve } from '../src/lib/scoring/curve';

/**
 * Deflates `hiking` below the anchor line.
 *
 * The anchor set in anchors.ts caps a hiking 10 at eight global trekking
 * references, but 107 of 200 destinations still peaked at 8 or 9 — so the
 * saturation simply moved down a notch, and because `hiking` is a POPULAR
 * audience interest, an 8 with an inferred "signature" tier outweighs the
 * thing a destination is actually for. Reading the default ranking's top-3
 * contributors bottom-up makes it obvious: hiking was the single largest
 * draw for Bali, Munich, Nicaragua and Uluru, and the second largest for
 * the Great Barrier Reef, Kruger, the Galapagos and Rwanda.
 *
 * Kruger is the clearest of them. It sat at 8 for hiking in a park where
 * visitors are not permitted out of the vehicle.
 *
 * The scale being applied below the 10:
 *    9  a major trekking destination — people plan the trip around walking
 *    8  excellent hiking, a real part of why you go
 *    7  good walking, but you came for something else
 *    6  there are trails
 *    5  incidental; you are here for water, wildlife or a city
 *    4  you effectively cannot walk here
 *
 * Nothing is raised, and only destinations currently at 8 or above are in
 * scope. Everything at 8+ that is NOT listed keeps its score — those are
 * the affirmative judgements (Tasmania's Overland Track, the Smokies, the
 * Tongariro Crossing, Table Mountain, Joshua Tree, the Azores, Taiwan).
 */

const TARGET: Record<number, string[]> = {
  // Real hiking, but not the reason for the trip.
  8: [
    'morocco', 'amalfi', 'croatia', 'mallorca', 'cornwall', 'black-forest', 'acadia',
    'hokkaido', 'jordan', 'monterey-big-sur', 'lofoten', 'colombian-andes', 'guatemala',
  ],
  // Good walking attached to a different draw.
  7: [
    'redwood', 'bavaria-munich', 'badlands-black-hills', 'mendoza', 'srilanka', 'nicaragua',
    'atacama', 'tuscany', 'namibia', 'sardinia', 'chiang-mai', 'lapland', 'sicily', 'provence',
    'basque-country', 'chiapas', 'guilin-yangshuo', 'tierra-del-fuego', 'southeast-alaska',
    'beijing', 'tokyo-kyoto', 'rio', 'colombian-caribbean',
  ],
  // There are trails; nobody comes for them.
  6: [
    'uluru', 'bali', 'edinburgh', 'santorini', 'algarve', 'puerto-rico', 'mongolia',
    'rwanda', 'uganda', 'madagascar',
  ],
  // Incidental — this is a water, wildlife or city destination.
  5: ['galapagos', 'uyuni'],
  // You effectively cannot walk here.
  4: ['kruger', 'gbr'],
};

const KEY = 'hiking';

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

async function main() {
  const env = loadDotEnvLocal();
  if (!env.DATABASE_URL) {
    console.error('No DATABASE_URL in .env.local — refusing to run against the PGlite fallback.');
    process.exit(1);
  }
  process.env.DATABASE_URL = env.DATABASE_URL;
  // Dynamic, after the env is set — see review-scenic-saturation.ts.
  const { getAllScoredPlaces } = await import('../src/lib/db/queries/places');
  const { isSliderNA } = await import('../src/lib/scoring/destinations');
  const dryRun = process.argv.includes('--dry-run');
  const db = drizzlePostgres(postgres(env.DATABASE_URL, { prepare: false }));

  const rows = await db.select().from(places).where(eq(places.isPrimaryDestination, true));
  const byId = new Map(rows.map((r) => [r.id, { ...r }]));
  const scored = await getAllScoredPlaces();

  const inScope = new Set(
    scored
      .filter((d) => !isSliderNA(d, KEY) && Math.max(...(d.monthly[KEY] ?? [0])) >= 8)
      .map((d) => d.id),
  );

  const assigned = new Map<string, number>();
  for (const [target, ids] of Object.entries(TARGET)) {
    for (const id of ids) {
      if (assigned.has(id)) { console.error(`${id} assigned twice`); process.exit(1); }
      assigned.set(id, Number(target));
    }
  }
  const notInScope = [...assigned.keys()].filter((id) => !inScope.has(id));
  if (notInScope.length) {
    console.error(`Assigned but not at hiking >= 8 (${notInScope.length}): ${notInScope.join(' ')}`);
    process.exit(1);
  }

  const counts: Record<number, number> = {};
  let written = 0;
  for (const [id, target] of assigned) {
    const row = byId.get(id);
    if (!row) { console.error(`${id}: not a primary destination`); process.exit(1); }
    const d = scored.find((x) => x.id === id)!;
    const monthly = d.monthly[KEY] ?? [];
    const was = Math.max(...monthly);
    const floor = Math.min(...monthly);
    const raw = (row.sliderCurves as Record<string, unknown>)[KEY];
    if (raw === undefined) { console.error(`${id}: no ${KEY} curve`); process.exit(1); }

    const rescaled = rescaleCurve(parseSliderCurve(raw), Math.min(floor, target), target);
    const sliderCurves = { ...(row.sliderCurves as Record<string, unknown>), [KEY]: rescaled };
    const authoredCurves = Array.from(new Set([...(row.authoredCurves ?? []), KEY]));
    const after = { ...row, sliderCurves, authoredCurves };

    counts[target] = (counts[target] ?? 0) + 1;
    console.log(`  ${id.padEnd(24)} ${was.toFixed(0)} -> ${target}`);
    if (!dryRun) {
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
    }
    byId.set(id, after as typeof row);
    written++;
  }

  const kept = inScope.size - assigned.size;
  console.log(
    `\n${inScope.size} were at hiking >= 8. Demoted: ` +
      Object.entries(counts).sort((a, b) => Number(b[0]) - Number(a[0])).map(([k, v]) => `${k}:${v}`).join('  ') +
      `   (${kept} kept as authored judgements)`,
  );
  console.log(dryRun ? `\ndry run — ${written} would change.` : `\ndone: ${written} reshaped.`);
  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
