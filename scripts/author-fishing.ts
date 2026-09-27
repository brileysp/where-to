import { readFileSync } from 'fs';
import { join } from 'path';
import { eq } from 'drizzle-orm';
import { drizzle as drizzlePostgres } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import { places, adminAuditLog } from '../src/lib/db/schema';
import type { SliderEvent } from '../src/lib/scoring/types';

/**
 * Fishing content. The formula gap here is worse than skiing's or
 * surfing's: `fishing` shares the generic 'hiking' formula with 14 other
 * sliders, so its seasonality has been coming entirely from
 * `hikingBest`/`hikingWorst` — TRAIL WEATHER CONDITIONS, which have
 * nothing to do with when a fish runs or bites. The events branch already
 * exists on this formula (unlike snow/swim, fixed for skiing/surfing);
 * this is purely a content gap, and every one of these ~50 destinations
 * showed zero fishing-specific authoring before this.
 *
 * Four drivers, matching real fishery mechanics rather than trail
 * conditions:
 *
 *   A. ANADROMOUS / COLD-WATER RUN — a dated migratory or legally
 *      regulated season. Lofoten's Skrei (Arctic cod) run is the extreme
 *      case: Jan-Apr, one of the most famous winter fisheries on earth.
 *      Iceland's Atlantic salmon rivers are opened by LAW only in summer.
 *      Denali/Southeast Alaska/Monterey (Pacific salmon), Acadia (striped
 *      bass), and the Rockies/Cascades/Banff/Glacier trout destinations,
 *      whose real constraint is snowmelt runoff — unfishable in spring,
 *      short reliable season Jun-Sep/Oct. Olympic gets its own distinct
 *      driver within this group: Pacific Northwest WINTER steelhead is a
 *      famous, separate run (Dec-Mar) from the summer salmon pattern
 *      everywhere else in this group.
 *
 *   B. BILLFISH / PELAGIC MIGRATION — warm-water game fish following
 *      temperature fronts, each fishing ground with its OWN documented
 *      window, not identical across the group: Los Cabos (roughly
 *      May-Nov), Costa Rica's Pacific sailfish (Dec-Apr) and Riviera
 *      Maya's Caribbean sailfish (Jan-Mar) are different seasons at
 *      different coasts of the same ocean; Panama's Piñas Bay season
 *      (May-Sep) differs again. Hawaii's summer marlin season
 *      (Maui/Big Island, Jun-Sep), Fiji and Mauritius's blue-water
 *      seasons, Papua New Guinea's black-marlin season.
 *
 *   C. FLATS / TARPON-BONEFISH-PERMIT — mostly resident, but several have
 *      a genuine migratory spike worth modeling: Belize and the
 *      Everglades both get the spring migratory TARPON run (Mar/Apr-Jul),
 *      not just "good all year." Seychelles and the Maldives are
 *      monsoon-avoidance stories — the flats are fishable in the calmer
 *      season, not the windy one. The Bahamas (an anchor) gets the same
 *      spring-tarpon shape as Belize/Everglades.
 *
 *   D. LEGALLY REGULATED FRESHWATER SEASON — several of the world's best
 *      trout fisheries have a season set by LAW, not just weather:
 *      Patagonia (Argentine and Chilean Lake Districts) Nov-Apr/May,
 *      New Zealand (Marlborough) and Tasmania Oct/Sep-Apr, Yellowstone's
 *      general season Jun-Oct. Peruvian Amazon's peacock bass season is
 *      the low-water dry months (Sep-Feb), distinct from its own
 *      wildlifeViewing dry season (Jun-Sep) because low water peaks later
 *      in the year than the driest weather does.
 *
 * The nine anchors (costa-rica, argentine-lake-district, denali-interior,
 * belize, southeast-alaska, yellowstone, los-cabos, bahamas, pantanal)
 * target the required ceiling of 10; everyone else targets their own
 * existing peak. Pantanal's event mirrors its own already-correct
 * wildlifeViewing dry-season jaguar timing — dourado and peacock bass
 * fishing there runs on the identical dry-season river-corridor mechanism.
 *
 * LEFT ALONE, documented rather than silently skipped: reef/pelagic
 * destinations where I don't have strong enough specific-species timing
 * to assert real drama over "decent most of the year, weather permitting"
 * — Palau, Palawan, Komodo, Raja Ampat, Borabora, Turks & Caicos, Great
 * Barrier Reef, Marlborough (fishing, distinct from its own D-group trout
 * entry above), Barbados, Great Smoky Mountains, Faroe Islands. This is
 * the same discipline as Costa Rica's wildlifeViewing event a full pass
 * ago — not manufacturing a season that isn't clearly there.
 */

const RAW: { id: string; peak: number; months: number[][]; labels: string[]; why: string }[] = [
  // ---- A. Anadromous / cold-water run -----------------------------------
  { id: 'lofoten', peak: 9, months: [[1, 2, 3, 4]], labels: ['Skrei (Arctic cod) run'], why: 'one of the most famous winter fisheries on earth' },
  { id: 'iceland', peak: 9, months: [[6, 7, 8, 9]], labels: ['Atlantic salmon season (legally regulated)'], why: 'rivers are opened by law only in summer' },
  { id: 'southeast-alaska', peak: 10, months: [[6, 7, 8, 9]], labels: ['Pacific salmon run'], why: 'anchor — the classic Alaska salmon season' },
  { id: 'denali-interior', peak: 10, months: [[6, 7, 8]], labels: ['Salmon & grayling season (ice-free window)'], why: 'anchor — short interior Alaska season' },
  { id: 'monterey-big-sur', peak: 8, months: [[5, 6, 7, 8, 9, 10]], labels: ['King salmon season'], why: 'Central California salmon season' },
  { id: 'acadia', peak: 9, months: [[6, 7, 8, 9, 10]], labels: ['Striped bass & bluefish run'], why: 'Maine coast run' },
  { id: 'rocky-mountain', peak: 8, months: [[7, 8, 9]], labels: ['Post-runoff trout season'], why: 'high-country streams unfishable during spring snowmelt' },
  { id: 'banff', peak: 9, months: [[7, 8, 9]], labels: ['Post-runoff trout season'], why: 'same snowmelt constraint as the Rockies' },
  { id: 'glacier-waterton', peak: 9, months: [[7, 8, 9]], labels: ['Post-runoff trout season'], why: 'same constraint' },
  { id: 'north-cascades', peak: 8, months: [[7, 8, 9]], labels: ['Post-runoff trout season'], why: 'same constraint' },
  { id: 'bend-crater-lake', peak: 9, months: [[5, 6, 7, 8, 9, 10]], labels: ['Spring-fall trout season'], why: 'Oregon high-desert fly fishing, avoiding winter ice' },
  { id: 'yosemite', peak: 8, months: [[6, 7, 8, 9, 10]], labels: ['High-Sierra trout season'], why: 'short season around snowmelt and early ice' },
  { id: 'great-smoky-mountains', peak: 8, months: [[4, 5, 6, 7, 8, 9, 10]], labels: ['Southern Appalachian trout season'], why: 'lower elevation than the Rockies, less starkly seasonal' },
  // Olympic's real driver is a DIFFERENT season from every other trout
  // destination above — winter steelhead, not summer trout.
  { id: 'olympic', peak: 8, months: [[12, 1, 2, 3]], labels: ['Winter steelhead run'], why: 'Pacific Northwest\'s famous winter run, distinct from the summer salmon pattern elsewhere in this group' },

  // ---- B. Billfish / pelagic migration -----------------------------------
  { id: 'los-cabos', peak: 10, months: [[5, 6, 7, 8, 9, 10, 11]], labels: ['Marlin season'], why: 'anchor — the marlin capital' },
  { id: 'costa-rica', peak: 10, months: [[12, 1, 2, 3, 4]], labels: ['Pacific sailfish season'], why: 'anchor — Quepos-area sailfish' },
  { id: 'rivieramaya', peak: 8, months: [[1, 2, 3]], labels: ['Caribbean sailfish run'], why: 'a different coast, a different season from Pacific Central America' },
  { id: 'panama', peak: 8, months: [[5, 6, 7, 8, 9]], labels: ['Piñas Bay sailfish season'], why: 'again a distinct window from Costa Rica\'s Pacific coast' },
  { id: 'fiji', peak: 9, months: [[5, 6, 7, 8, 9, 10]], labels: ['Blue-water game fish season'], why: 'marlin/tuna season' },
  { id: 'maui', peak: 9, months: [[6, 7, 8, 9]], labels: ['Summer marlin season'], why: 'Hawaii offshore game fishing' },
  { id: 'big-island', peak: 8, months: [[6, 7, 8, 9]], labels: ['Summer marlin season'], why: 'same Hawaii season as Maui' },
  { id: 'mauritius', peak: 8, months: [[11, 12, 1, 2, 3]], labels: ['Blue marlin season'], why: 'Indian Ocean marlin season' },
  { id: 'papua-new-guinea', peak: 8, months: [[9, 10, 11, 12]], labels: ['Black marlin season'], why: '"grander" black marlin season' },

  // ---- C. Flats / tarpon-bonefish-permit ---------------------------------
  { id: 'belize', peak: 10, months: [[3, 4, 5, 6, 7]], labels: ['Spring migratory tarpon run'], why: 'anchor — the grand-slam destination gets a real spring spike, not just "good all year"' },
  { id: 'bahamas', peak: 10, months: [[3, 4, 5, 6, 7]], labels: ['Spring migratory tarpon run'], why: 'anchor — same run as Belize' },
  { id: 'everglades', peak: 9, months: [[4, 5, 6, 7]], labels: ['Spring migratory tarpon run'], why: 'the Keys/Everglades backcountry get the same run' },
  { id: 'seychelles', peak: 9, months: [[10, 11, 12, 1, 2, 3, 4, 5]], labels: ['Calm-season flats fishing'], why: 'the flats are fishable in the calmer NE monsoon, not the windy SW one' },
  { id: 'maldives', peak: 9, months: [[11, 12, 1, 2, 3, 4]], labels: ['Calm-season flats fishing'], why: 'same monsoon-avoidance logic' },

  // ---- D. Legally regulated freshwater season ----------------------------
  { id: 'argentine-lake-district', peak: 10, months: [[11, 12, 1, 2, 3, 4]], labels: ['Patagonian trout season (legally regulated)'], why: 'anchor — Nov-Apr by law' },
  { id: 'chilean-lake-district', peak: 9, months: [[11, 12, 1, 2, 3, 4]], labels: ['Patagonian trout season (legally regulated)'], why: 'same regulated season as the Argentine side' },
  { id: 'marlborough-abel-tasman', peak: 9, months: [[10, 11, 12, 1, 2, 3, 4]], labels: ['NZ trout season (legally regulated)'], why: 'closed in winter by law' },
  { id: 'tasmania', peak: 9, months: [[9, 10, 11, 12, 1, 2, 3, 4]], labels: ['Highland lakes trout season (legally regulated)'], why: 'Tasmania\'s inland season is set by law, closed in winter' },
  { id: 'yellowstone', peak: 10, months: [[6, 7, 8, 9, 10]], labels: ['General fishing season (legally regulated)'], why: 'anchor — opens Memorial Day weekend, runs through early November' },
  { id: 'peruvian-amazon', peak: 9, months: [[9, 10, 11, 12, 1, 2]], labels: ['Peacock bass low-water season'], why: 'low water peaks later in the year than the driest weather does — a distinct timing from this destination\'s own dry-season wildlife viewing' },
  { id: 'pantanal', peak: 10, months: [[7, 8, 9, 10]], labels: ['Dourado & peacock bass dry-season season'], why: 'anchor — mirrors this destination\'s own dry-season jaguar-viewing timing, the identical river-corridor mechanism' },
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

  const ids = [...new Set(RAW.map((e) => e.id))];
  const rows = await db.select().from(places).where(eq(places.isPrimaryDestination, true));
  const byId = new Map(rows.filter((r) => ids.includes(r.id)).map((r) => [r.id, { ...r }]));
  for (const id of ids) if (!byId.has(id)) { console.error(`${id}: not a primary destination`); process.exit(1); }

  const ANCHORS = new Set(['costa-rica', 'argentine-lake-district', 'denali-interior', 'belize', 'southeast-alaska', 'yellowstone', 'los-cabos', 'bahamas', 'pantanal']);

  let overCap = 0;
  let overCapBad = 0;
  const KEY = 'fishing';
  for (const e of RAW) {
    const row = byId.get(e.id)!;
    const scoring = toScoringPlace(row);
    if (isSliderNA(scoring, KEY)) { console.error(`${e.id}: is N/A`); process.exit(1); }
    const base = scoring.base[KEY];

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
    if (now >= 9.99) {
      overCap++;
      if (!ANCHORS.has(e.id)) overCapBad++;
    }

    console.log(`  ${e.id.padEnd(24)} base=${base}  target=${e.peak}  actual peak=${now.toFixed(1)}${ANCHORS.has(e.id) ? '  [anchor]' : ''}   ${e.why}`);

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

  console.log(`\n${RAW.length} destinations, ${overCap} hit peak >= 9.99 (${overCapBad} of those are NOT anchors — must be 0).`);
  if (overCapBad > 0) console.error('REFUSING — a non-anchor destination clamped to 10. Fix the weight and re-run.');
  console.log(dryRun ? 'dry run — nothing written.' : 'done.');
  process.exit(overCapBad > 0 ? 1 : 0);
}

main().catch((err) => { console.error(err); process.exit(1); });
