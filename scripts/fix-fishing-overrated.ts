import { readFileSync } from 'fs';
import { join } from 'path';
import { eq } from 'drizzle-orm';
import { drizzle as drizzlePostgres } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import { places, adminAuditLog } from '../src/lib/db/schema';

/**
 * Fishing peak-tier review, second round: four corrections found comparing
 * anchors and 9s against each other.
 *
 * Denali/Interior Alaska's global fame is Denali National Park itself
 * (mountaineering, wildlife, tundra) — Southeast Alaska already legitimately
 * anchors Alaska's fishing reputation (halibut/salmon world records), and
 * Interior Alaska's rivers aren't the bucket-list fisheries (Bristol Bay,
 * Kenai) that would justify a second Alaska anchor. Moved off the anchor
 * tier, down to 8.
 *
 * Maui and Big Island were tied/inverted on marlin (9 vs 8) — but Kona, on
 * the Big Island, is Hawaii's actual internationally famous marlin capital
 * (Hawaiian International Billfish Tournament has run there since 1959).
 * Maui's marlin fishing is real but clearly secondary. Swapped: Big Island
 * up to 9, Maui down to 7.
 *
 * Acadia and Cape Cod & Islands were similarly inverted on striped bass (9
 * vs 8) — Cape Cod/Martha's Vineyard/Nantucket carries the more singular
 * national striper-fishing reputation; Acadia's coast is famous for scenery
 * and hiking first. Swapped: Cape Cod up to 9, Acadia down to 8.
 *
 * Maldives' flats/GT fishing is real and growing among specialists, but its
 * actual global identity is diving and luxury resorts, not fishing — it
 * doesn't belong in the same tier as Bahamas/Belize/Everglades/Seychelles
 * (Seychelles' GT fishing, by contrast, has a genuine top-3-in-the-world
 * reputation among saltwater fly anglers). Lowered to 6.
 */

const EDITS: { id: string; target: number }[] = [
  { id: 'denali-interior', target: 8 },
  { id: 'maui', target: 7 },
  { id: 'big-island', target: 9 },
  { id: 'acadia', target: 8 },
  { id: 'cape-cod-islands', target: 9 },
  { id: 'maldives', target: 6 },
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

  const KEY = 'fishing';
  for (const e of EDITS) {
    const [row] = await db.select().from(places).where(eq(places.id, e.id));
    const scoring = toScoringPlace(row);
    if (isSliderNA(scoring, KEY)) { console.error(`${e.id}: is N/A`); process.exit(1); }
    const base = scoring.base[KEY];
    const existing = scoring.sliderEvents?.[KEY]?.[0];
    if (!existing) { console.error(`${e.id}: no existing fishing event to preserve months/label from`); process.exit(1); }

    const weight = Math.round((e.target - base) * 10) / 10;
    const events = [{ label: existing.label, weight, months: existing.months }];
    const patchedEvents = { ...(scoring.sliderEvents ?? {}), [KEY]: events };
    const patchedScoring = { ...scoring, sliderEvents: patchedEvents };

    const { monthly } = deriveDestinationScores(patchedScoring, { skipHazards: true });
    const values = monthly[KEY];
    const fit = fitMonthlyToCurve(values, { maxSteepness: MAX_STEEPNESS, errorTolerance: ERROR_TOLERANCE });
    const now = Math.max(...values);

    console.log(`  ${e.id.padEnd(18)} base=${base}  target=${e.target}  actual peak=${now.toFixed(1)}  monthly=[${values.map((v: number) => v.toFixed(0)).join(',')}]`);

    const patch = {
      sliderEvents: patchedEvents,
      sliderCurves: { ...(row.sliderCurves as Record<string, unknown>), [KEY]: fit.curve },
      authoredCurves: Array.from(new Set([...(row.authoredCurves ?? []), KEY])),
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
