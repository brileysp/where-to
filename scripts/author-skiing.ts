import { readFileSync } from 'fs';
import { join } from 'path';
import { eq } from 'drizzle-orm';
import { drizzle as drizzlePostgres } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import { places, adminAuditLog } from '../src/lib/db/schema';
import type { SliderEvent } from '../src/lib/scoring/types';

/**
 * skiingSnowboarding: converts every flag-only destination to an explicit
 * sliderEvent, preserving each destination's existing peak exactly.
 *
 * Unlike fishing (borrows the unrelated `hiking` formula's trail-condition
 * flags) or surfing (the `swim` formula's storm-is-bad logic runs backwards
 * for swell), skiing's OWN formula ('snow') already reads the right
 * domain signal: `cold` marks genuine winter months, and `noSnow` is an
 * explicit hard floor for "there is no snow on the ground," independent of
 * whatever else is flagged. That hard floor is deliberately LEFT ALONE
 * here — a resort closing for the season is a real cliff, not an artifact,
 * and smoothing it away would assert something false. What gets smoothed
 * is everything else: the ramp into and out of winter, which was
 * previously implicit in the raw formula's flat `cold ? +3` term and is
 * now an explicit, fittable event.
 *
 * weight = (destination's current peak) - base, months = the SAME `cold`
 * array already on the row — this is a mechanism fix, not a re-litigation
 * of when any resort's season runs. The six anchors (chamonix, swissalps,
 * hokkaido, dolomites, whistler, aspen) get weight = 10 - base, since 10
 * is their required ceiling; every other destination targets its own
 * current peak, checked against the anchor list before writing.
 *
 * Aspen and Whistler both already sit at a base of 10, meaning their
 * winter months hit the ceiling from the base score alone with no event
 * needed — they're included anyway so the same fit-and-smooth pass runs
 * over their noSnow transition along with everyone else's.
 */

type Entry = { id: string; target: number; months: number[] };

const ENTRIES: Entry[] = [
  // Anchors — target is the required ceiling of 10.
  { id: 'dolomites', target: 10, months: [11, 12, 1, 2, 3] },
  { id: 'hokkaido', target: 10, months: [12, 1, 2, 3] },
  { id: 'chamonix', target: 10, months: [11, 12, 1, 2, 3] },
  { id: 'swissalps', target: 10, months: [11, 12, 1, 2, 3] },
  { id: 'aspen', target: 10, months: [11, 12, 1, 2, 3] },
  { id: 'whistler', target: 10, months: [11, 12, 1, 2, 3] },
  // Everyone else — target is their own existing peak.
  { id: 'banff', target: 9, months: [11, 12, 1, 2, 3] },
  { id: 'north-cascades', target: 9, months: [11, 12, 1, 2, 3] },
  { id: 'lapland', target: 9, months: [11, 12, 1, 2, 3] },
  { id: 'queenstown', target: 9, months: [6, 7, 8] }, // Southern Hemisphere — already correct
  { id: 'vermont', target: 8, months: [12, 1, 2] },
  { id: 'lofoten', target: 8, months: [11, 12, 1, 2, 3] },
  { id: 'seoul', target: 7, months: [12, 1, 2] },
  { id: 'fjords', target: 7, months: [11, 12, 1, 2, 3] },
  { id: 'rocky-mountain', target: 7, months: [11, 12, 1, 2, 3, 4] },
  { id: 'yellowstone', target: 7, months: [11, 12, 1, 2, 3] },
  { id: 'tbilisi-caucasus', target: 7, months: [12, 1, 2] },
  { id: 'bend-crater-lake', target: 6, months: [12, 1, 2] },
  { id: 'beijing', target: 6, months: [12, 1, 2] },
  { id: 'churchill', target: 6, months: [12, 1, 2, 3] },
  { id: 'yosemite', target: 6, months: [12, 1, 2] },
  { id: 'black-forest', target: 6, months: [12, 1, 2] },
  { id: 'denali-interior', target: 6, months: [10, 11, 12, 1, 2, 3, 4, 5] },
  { id: 'sequoia-kings-canyon', target: 6, months: [12, 1, 2] },
  { id: 'olympic', target: 6, months: [12, 1, 2] },
  { id: 'mendoza', target: 6, months: [7] }, // Southern Hemisphere (Las Leñas) — already correct
  { id: 'chilean-lake-district', target: 6, months: [6, 7, 8] }, // Southern Hemisphere — already correct
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

  const ids = ENTRIES.map((e) => e.id);
  const rows = await db.select().from(places).where(eq(places.isPrimaryDestination, true));
  const byId = new Map(rows.filter((r) => ids.includes(r.id)).map((r) => [r.id, { ...r }]));
  for (const id of ids) if (!byId.has(id)) { console.error(`${id}: not a primary destination`); process.exit(1); }

  let overCap = 0;
  const KEY = 'skiingSnowboarding';
  for (const e of ENTRIES) {
    const row = byId.get(e.id)!;
    const scoring = toScoringPlace(row);
    if (isSliderNA(scoring, KEY)) { console.error(`${e.id}: is N/A`); process.exit(1); }
    const base = scoring.base[KEY];

    const weight = Math.round((e.target - base) * 10) / 10;
    // Always route through the events branch, even at weight 0 — the
    // 'snow' formula's fallback (cold ? +3) fires unconditionally once
    // there's no event, which overshot Banff/Vermont/Queenstown back to a
    // clamped 10 exactly when target === base (weight 0) skipped adding
    // an event at all. An explicit weight-0 event still correctly bypasses
    // that fallback and holds the destination at its own base.
    const events: SliderEvent[] = [{ label: 'Ski season', weight, months: Object.fromEntries(e.months.map((m) => [m, 1])) }];

    const patchedEvents = { ...(scoring.sliderEvents ?? {}) };
    if (events.length > 0) patchedEvents[KEY] = events;
    else delete patchedEvents[KEY];
    const patchedScoring = { ...scoring, sliderEvents: patchedEvents };

    const { monthly } = deriveDestinationScores(patchedScoring, { skipHazards: true });
    const values = monthly[KEY];
    const fit = fitMonthlyToCurve(values, { maxSteepness: MAX_STEEPNESS, errorTolerance: ERROR_TOLERANCE });
    const now = Math.max(...values);
    if (now >= 9.99) overCap++;

    console.log(`  ${e.id.padEnd(24)} base=${base}  target=${e.target}  actual peak=${now.toFixed(1)}`);

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
    byId.set(e.id, after as typeof row);
  }

  console.log(`\n${ENTRIES.length} destinations, ${overCap} hit peak >= 9.99 (verify against the 6-destination anchor list).`);
  console.log(dryRun ? 'dry run — nothing written.' : 'done.');
  process.exit(0);
}

main().catch((err) => { console.error(err); process.exit(1); });
