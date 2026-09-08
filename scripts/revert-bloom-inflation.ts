import { readFileSync } from 'fs';
import { join } from 'path';
import { eq } from 'drizzle-orm';
import { drizzle as drizzlePostgres } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import { places, adminAuditLog } from '../src/lib/db/schema';
import { toScoringPlace } from '../src/lib/db/queries/places';
import { fitDestinationCurves } from '../src/lib/scoring/fitCurve';

/**
 * Reverts a bad call of mine in fix-bloom-birding-and-more.ts.
 *
 * I read "base score 2 with a signature tier" as a contradiction and raised
 * the bases. It is not a contradiction — it is how seasonal sliders are
 * SUPPOSED to be modelled here. The base is the OFF-SEASON FLOOR; the peak
 * comes from month flags and sliderEvents. auroraChasing works exactly this
 * way and is correct: Iceland's base is 2 with a curve of
 * [10,10,7,2,2,3,3,3,4,8,10,10] — invisible under the midnight sun, superb
 * in winter.
 *
 * Raising Kyoto's wildflowerBlooms base to 10 produced
 * [10,10,10,10,10,9,10,10,9,10,10,10] — cherry blossom scored as a perfect
 * 10 in December, for an event that lasts about two weeks in late March.
 * That is materially worse than the 2 it replaced.
 *
 * Texas Hill Country shows the intended shape: it HAS the month flags, so
 * base 2 yields [2,2,10,10,10,2,...] for the bluebonnet season. Kyoto,
 * Provence and Hokkaido are flat because their flags are MISSING — the real
 * defect, and a separate piece of authoring work.
 *
 * Non-seasonal entries in that batch (birding, coffeeTea, allInclusive,
 * yogaRetreats) are correct and are deliberately left alone.
 */

const REVERT: Record<string, number> = {
  // Also set to the off-season floor: I un-N/A'd these at flat 5 and 4,
  // which is the same mistake in a smaller form — no month flags means no
  // peak, so a mid-range base just claims a permanent mediocre bloom.
  tasmania: 2,
  'north-island': 2,
  'tokyo-kyoto': 2,
  provence: 2,
  hokkaido: 2,
  'texas-hill-country': 2,
  tuscany: 2,
  namibia: 2,
  'great-smoky-mountains': 2,
  dolomites: 2,
  'joshua-tree': 2,
  'death-valley': 2,
  ladakh: 2,
  kyrgyzstan: 2,
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
  const db = drizzlePostgres(postgres(env.DATABASE_URL, { prepare: false }));
  const rows = await db.select().from(places).where(eq(places.isPrimaryDestination, true));
  const byId = new Map(rows.map((r) => [r.id, r]));

  for (const [id, v] of Object.entries(REVERT)) {
    const row = byId.get(id);
    if (!row) { console.error(`unknown destination: ${id}`); process.exit(1); }
    const baseScores = { ...(row.baseScores as Record<string, number>), wildflowerBlooms: v };
    const after = { ...row, baseScores };
    console.log(`  ${id.padEnd(24)} wildflowerBlooms ${(row.baseScores as Record<string, number>).wildflowerBlooms} -> ${v}`);
    await db.transaction(async (tx) => {
      await tx.update(places).set({ baseScores, updatedAt: new Date() }).where(eq(places.id, id));
      await tx.insert(adminAuditLog).values({
        actorId: '00000000-0000-0000-0000-000000000000',
        entityType: 'destination',
        entityId: id,
        action: 'update',
        beforeValue: row,
        afterValue: after,
      });
      const curves = fitDestinationCurves(toScoringPlace(after as Parameters<typeof toScoringPlace>[0]));
      await tx.update(places).set({ sliderCurves: curves }).where(eq(places.id, id));
    });
  }
  console.log(`\nreverted ${Object.keys(REVERT).length} destinations.`);
  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
