import { readFileSync } from 'fs';
import { join } from 'path';
import { eq } from 'drizzle-orm';
import { drizzle as drizzlePostgres } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import { places, adminAuditLog } from '../src/lib/db/schema';
import type { SliderEvent } from '../src/lib/scoring/types';

/**
 * Surfing content, following the swim-formula sliderEvents fix in
 * destinations.ts. Four drivers, not the borrowed dry/wet/cold/hazard
 * logic every one of these destinations was running on before (`ev=-`
 * for all 25 scoring above 5 — genuinely zero prior authoring):
 *
 *   A. N. HEMISPHERE WINTER STORM-SWELL (Oct-Mar, peak Dec-Feb) — distant
 *      North Atlantic/Pacific storms send groundswell to west-facing
 *      coasts. Nazaré's giant waves ARE this mechanism, at its most
 *      extreme. Lisbon, Algarve, Canaries, Cornwall, Vancouver Island
 *      (Tofino), Basque Country (Mundaka's real season leans Sep-Feb),
 *      and Puerto Rico (Rincon's north swell — reclassified out of
 *      "tropical minimal", it is genuinely a winter destination).
 *
 *   B. S. HEMISPHERE WINTER STORM-SWELL (Apr-Sep) — same mechanism,
 *      opposite hemisphere and months. Cape Town (Jbay's season), North
 *      Island (Raglan), Rio (South Atlantic winter storms), Sydney (real
 *      but less starkly seasonal than the others — smaller weight).
 *
 *   C. DRY-SEASON / MONSOON-TRANSITION TRADE WINDS — already correctly
 *      modeled for Nicaragua, the reference case. Bali (offshore trades on
 *      the Bukit, Apr-Oct), Fiji (Cloudbreak, Apr-Oct), Maldives (SW
 *      monsoon swell, Mar-Oct), Sri Lanka (a genuine TWO-COAST pattern —
 *      west/south Nov-Apr, east May-Sep — modeled as two peaks, not one).
 *      Costa Rica and Panama are the counter-intuitive members: their best
 *      surf is the WET season (May-Nov / Apr-Oct), when south swells
 *      arrive — the opposite of what "wet is worse" would assume.
 *
 *   D. STORM-SEASON SWELL FROM A DIFFERENT SOURCE — cyclone/hurricane
 *      season, not winter storms. Okinawa (typhoon groundswell, Jun-Sep),
 *      Los Cabos (Pacific hurricane-season south swell, Jun-Oct), Maui and
 *      Big Island (Hawaii's real marquee season is winter north swell —
 *      Pipeline, Jaws — reclassified out of "tropical minimal" the same
 *      way Puerto Rico was), GBR (the mainland east-coast breaks near it
 *      get real autumn/winter swell, Mar-Aug, modest weight since GBR
 *      itself is a reef/diving destination first).
 *
 * LEFT ALONE, documented rather than silently skipped: Aruba and Barbados
 * beyond a small groundswell nod — genuinely minimal, wind-swell-dependent
 * Caribbean breaks with no dramatic, well-documented season distinct from
 * "decent most of the year." Nicaragua is untouched — already correct.
 *
 * Every weight = (existing peak) - base, preserving each destination's
 * current claim exactly — this authors WHEN, not HOW GOOD, the same
 * discipline as every prior pass this session. Surfing has no anchor set
 * yet (anchors.ts), so nothing here pushes any destination's peak higher
 * than what it already had.
 */

// weight is filled in per-entry below (peak - base), so RAW carries months
// and labels rather than assembled SliderEvent objects.
const RAW: { id: string; peak: number; months: number[][]; labels: string[]; why: string }[] = [
  { id: 'maui', peak: 9, months: [[11, 12, 1, 2, 3]], labels: ['Winter north swell (Pe\'ahi/Jaws)'], why: 'Hawaii\'s marquee big-wave season, not flat tropical' },
  { id: 'big-island', peak: 6, months: [[11, 12, 1, 2, 3]], labels: ['Winter north swell'], why: 'same mechanism as Maui, smaller scale' },
  { id: 'sydney', peak: 9, months: [[4, 5, 6, 7, 8]], labels: ['Autumn/winter swell'], why: 'Group B, real but less starkly seasonal — modest weight' },
  { id: 'rio', peak: 8, months: [[4, 5, 6, 7, 8]], labels: ['South Atlantic winter storm swell'], why: 'Group B' },
  { id: 'bali', peak: 9, months: [[4, 5, 6, 7, 8, 9, 10]], labels: ['Dry-season offshore trades (the Bukit)'], why: 'Group C' },
  { id: 'gbr', peak: 8, months: [[3, 4, 5, 6, 7, 8]], labels: ['East-coast autumn/winter swell'], why: 'the mainland breaks near it, not the reef itself — modest weight' },
  { id: 'canaries', peak: 8, months: [[10, 11, 12, 1, 2, 3]], labels: ['Atlantic winter storm-swell'], why: 'Group A' },
  { id: 'costa-rica', peak: 8, months: [[5, 6, 7, 8, 9, 10, 11]], labels: ['Wet-season south swell'], why: 'Group C counter-intuitive case — the WET season is the surf season' },
  { id: 'basque-country', peak: 8, months: [[9, 10, 11, 12, 1, 2]], labels: ['Mundaka autumn/winter swell'], why: 'Group A, real season leans autumn as much as winter' },
  { id: 'lisbon', peak: 8, months: [[10, 11, 12, 1, 2, 3]], labels: ['Nazaré winter storm-swell'], why: 'Group A, the extreme case' },
  { id: 'algarve', peak: 8, months: [[11, 12, 1, 2, 3]], labels: ['Atlantic winter swell'], why: 'Group A' },
  { id: 'vancouver-island', peak: 7, months: [[10, 11, 12, 1, 2, 3]], labels: ['Tofino winter storm-swell'], why: 'Group A' },
  { id: 'north-island', peak: 7, months: [[4, 5, 6, 7, 8, 9]], labels: ['Raglan winter swell'], why: 'Group B' },
  { id: 'cape-town', peak: 7, months: [[4, 5, 6, 7, 8, 9]], labels: ["J-Bay-adjacent winter swell"], why: 'Group B' },
  { id: 'cornwall', peak: 7, months: [[9, 10, 11, 12, 1, 2]], labels: ['Atlantic autumn/winter swell'], why: 'Group A' },
  { id: 'fiji', peak: 7, months: [[4, 5, 6, 7, 8, 9, 10]], labels: ['Cloudbreak dry-season trades'], why: 'Group C' },
  { id: 'barbados', peak: 6, months: [[11, 12, 1, 2, 3]], labels: ['Soup Bowl winter groundswell'], why: 'a smaller, real nod — Caribbean surf is genuinely modest most of the year' },
  { id: 'maldives', peak: 6, months: [[3, 4, 5, 6, 7, 8, 9, 10]], labels: ['SW monsoon swell'], why: 'Group C' },
  { id: 'panama', peak: 6, months: [[4, 5, 6, 7, 8, 9, 10]], labels: ['Wet-season south swell'], why: 'Group C counter-intuitive case, same as Costa Rica' },
  { id: 'okinawa', peak: 6, months: [[6, 7, 8, 9]], labels: ['Typhoon-season groundswell'], why: 'Group D' },
  { id: 'los-cabos', peak: 6, months: [[6, 7, 8, 9, 10]], labels: ['Pacific hurricane-season south swell'], why: 'Group D' },
  { id: 'puerto-rico', peak: 6, months: [[11, 12, 1, 2, 3]], labels: ['Rincon winter north swell'], why: 'Group A, reclassified out of "tropical minimal"' },
  // Sri Lanka: a genuine two-coast, two-season pattern.
  { id: 'srilanka', peak: 7, months: [[11, 12, 1, 2, 3, 4], [5, 6, 7, 8, 9]], labels: ['West/south coast season', 'East coast season'], why: 'two coasts, opposite monsoons — a real two-peak destination' },
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

  const ids = RAW.map((e) => e.id);
  const rows = await db.select().from(places).where(eq(places.isPrimaryDestination, true));
  const byId = new Map(rows.filter((r) => ids.includes(r.id)).map((r) => [r.id, { ...r }]));
  for (const id of ids) if (!byId.has(id)) { console.error(`${id}: not a primary destination`); process.exit(1); }

  let overCap = 0;
  const KEY = 'surfing';
  for (const e of RAW) {
    const row = byId.get(e.id)!;
    const scoring = toScoringPlace(row);
    if (isSliderNA(scoring, KEY)) { console.error(`${e.id}: is N/A`); process.exit(1); }
    const base = scoring.base[KEY];

    // NOT divided by the number of peak windows — Sri Lanka's two windows
    // are non-adjacent and don't overlap, so each one independently needs
    // the FULL weight to reach the target peak on its own; splitting the
    // weight between them would leave both windows undershooting.
    const weight = Math.round((e.peak - base) * 10) / 10;
    const events: SliderEvent[] = e.months.map((months, i) => ({
      label: e.labels[i],
      weight,
      months: Object.fromEntries(months.map((m) => [m, 1])),
    }));

    const patchedEvents = { ...(scoring.sliderEvents ?? {}), [KEY]: events };
    const patchedScoring = { ...scoring, sliderEvents: patchedEvents };

    const { monthly } = deriveDestinationScores(patchedScoring, { skipHazards: true });
    const values = monthly[KEY];
    const fit = fitMonthlyToCurve(values, { maxSteepness: MAX_STEEPNESS, errorTolerance: ERROR_TOLERANCE });
    const now = Math.max(...values);
    if (now >= 9.99) overCap++;

    console.log(`  ${e.id.padEnd(20)} base=${base}  target=${e.peak}  actual peak=${now.toFixed(1)}   ${e.why}`);

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

  console.log(`\n${RAW.length} destinations, ${overCap} hit peak >= 9.99 (surfing has no anchor set yet — verify none of these exceed their own prior peak).`);
  console.log(dryRun ? 'dry run — nothing written.' : 'done.');
  process.exit(0);
}

main().catch((err) => { console.error(err); process.exit(1); });
