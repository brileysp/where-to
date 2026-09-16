import { readFileSync } from 'fs';
import { join } from 'path';
import { eq } from 'drizzle-orm';
import { drizzle as drizzlePostgres } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import { places, adminAuditLog } from '../src/lib/db/schema';

const KEY = 'safari';

// Safari audit vs SafariBookings.com. Dominant pattern: several
// destinations already had vivid, accurate overview/monthly text
// describing a dramatic dry/wet-season swing ("dramatically easier,"
// "genuinely easy, wide-open," "the wet season... more dispersed") but the
// underlying score barely moved (event weight artificially suppressed to
// 0.3-1 to avoid pushing an already-high flat base past 9/10) — the same
// bug class as Amsterdam's tulips, just inverted (great text, flat score
// instead of flat-high score, worse text). Fix: lower the flat base and
// raise the event weight so the real swing becomes visible, keeping peak
// unchanged (none of these are safari anchors — only kenya/tanzania/
// botswana are — so no ceiling risk).

type Entry = { base?: number; label: string; weight: number; months: Record<number, number> };

const EVENTS: Record<string, Entry> = {
  // Never copied over from the identical, already-correct wildlifeViewing
  // event for the same destination/phenomenon.
  borneo: { label: 'Kinabatangan river dry-season concentration', weight: 0.3, months: { 3: 0.4, 6: 0.7, 7: 1, 8: 1, 9: 0.7 } },
  // SafariBookings: Fair/Fair→Good→Excellent(May-Sep)→Good→Fair, a 3-tier
  // swing comparable to Kenya's. Old weight (0.3) was 5x lower than the
  // IDENTICAL event's weight (1.5) on this same destination's own
  // wildlifeViewing slider — an internal inconsistency, not intentional.
  kruger: { base: 6, label: 'Drier bush eases sightlines', weight: 3, months: { 5: 0.5, 6: 0.85, 7: 1, 8: 1, 9: 0.7 } },
  // SafariBookings: Poor(Jan-Mar)→Fair→Good→Excellent(Jul-Sep) — described
  // as one of Africa's most dramatic dry-season effects. Old weight (1)
  // was 3x lower than the identical event's weight (3) on this
  // destination's own wildlifeViewing slider.
  namibia: { base: 5, label: 'Dry-season concentration', weight: 4, months: { 5: 0.4, 6: 0.7, 7: 1, 8: 1, 9: 1, 10: 0.6 } },
  // SafariBookings rates Dec-Mar "Poor" (not just weaker) — many South
  // Luangwa camps physically close in the wet season (flooding/washed-out
  // roads), though several remain open for boat safaris, so this is a
  // real degradation, not the total closure a wildlifeClosed floor implies
  // (unlike Kaziranga/Ranthambore/Nepal). Modeled as a strong negative
  // within the event instead.
  zambia: { base: 6, label: 'Dry-season river-corridor concentration & wet-season camp closures', weight: 3, months: { 12: -1, 1: -1.3, 2: -1.3, 3: -1, 5: 0.3, 6: 0.7, 7: 1, 8: 1, 9: 1, 10: 0.6 } },
  // SafariBookings rates Oct "Excellent," same tier as Jul-Sep; old event
  // gave Oct only 0.6, a real (if not visibly rounding-affecting) undersell.
  zimbabwe: { label: "Dry-season concentration at Hwange's waterholes", weight: 1, months: { 5: 0.3, 6: 0.7, 7: 1, 8: 1, 9: 1, 10: 1 } },
  // SafariBookings' own table rates Jun-Aug "Excellent" but Jan/Feb/Sep/Dec
  // only "Good" — old event had this backwards (Jan/Feb at full weight,
  // Jun below it).
  rwanda: { label: 'Easier, drier trekking trails', weight: 1.5, months: { 1: 0.6, 2: 0.6, 6: 1, 7: 1, 8: 1, 9: 0.6, 12: 0.6 } },
};

const OVERVIEWS: Record<string, string> = {
  nepal: "Chitwan's one-horned rhinos are a near-guaranteed sighting almost any time of year — roughly 700 individuals, the second-largest population in Asia after Kaziranga — but the park closes entirely during peak monsoon (July through September some years), and tiger odds (a genuine event, not routine, at 5-15% per safari day) improve in the thinner winter vegetation.",
};

const MONTHLY: Record<string, string[]> = {
  zambia: [
    'The wet season at its worst — many South Luangwa camps close entirely; a few remain open for boat safaris through the flooded riverine groves, a real but different experience from a game drive.',
    'The wet season at its worst — many South Luangwa camps close entirely; a few remain open for boat safaris through the flooded riverine groves, a real but different experience from a game drive.',
    "The wet season easing — some camps still closed, but conditions are improving toward the dry season.",
    'The dry season setting in, game beginning to concentrate along the Luangwa River.',
    'Dry-season game viewing along the Luangwa River — among the best leopard densities on the continent.',
    'Peak dry season — walking safaris, pioneered here in the 1950s, are at their best along the river corridor.',
    'Peak dry season — walking safaris, pioneered here in the 1950s, are at their best along the river corridor.',
    'Peak dry season — walking safaris, pioneered here in the 1950s, are at their best along the river corridor.',
    'Peak dry season — walking safaris, pioneered here in the 1950s, are at their best along the river corridor.',
    'Still peak dry season along the Luangwa River, exceptional leopard and general game viewing.',
    'The dry season nearing its end, still exceptional game viewing along the river.',
    'The wet season returning — some camps beginning to close for the season.',
  ],
  rwanda: [
    'Dry-season trekking conditions at Volcanoes National Park — firmer trails, less rain.',
    'Dry-season trekking conditions at Volcanoes National Park — firmer trails, less rain.',
    'The wetter season at Volcanoes National Park — trekking is still possible, just muddier.',
    'The wetter season at Volcanoes National Park — trekking is still possible, just muddier.',
    'The wetter season at Volcanoes National Park — trekking is still possible, just muddier.',
    'Peak dry season begins — the driest, firmest trail conditions of the year, on par with July and August.',
    'Peak dry season — the driest, firmest trail conditions of the year.',
    'Peak dry season — the driest, firmest trail conditions of the year.',
    'Still within the dry season, easing slightly.',
    'The wetter season returning at Volcanoes National Park — trekking is still possible, just muddier.',
    'The wetter season returning at Volcanoes National Park — trekking is still possible, just muddier.',
    'Dry-season trekking conditions building again at Volcanoes National Park.',
  ],
  nepal: [
    'Peak dry season at Chitwan — thin vegetation improves tiger odds alongside near-guaranteed rhino sightings.',
    'Peak dry season at Chitwan — thin vegetation improves tiger odds alongside near-guaranteed rhino sightings.',
    'Still good dry-season conditions at Chitwan, easing slightly as the season progresses.',
    'The pre-monsoon heat building at Chitwan, conditions still workable.',
    'The pre-monsoon heat building at Chitwan, conditions still workable.',
    'The monsoon approaching at Chitwan, conditions becoming less comfortable ahead of the park\'s closure.',
    'Chitwan is closed to visitors — the park shuts entirely for the deep monsoon.',
    'Chitwan is closed to visitors — the park shuts entirely for the deep monsoon.',
    'Chitwan is often still closed into September in wetter years — check locally before planning around an early-September visit.',
    'The dry season returning to Chitwan, trails drying out.',
    'Good dry-season conditions at Chitwan.',
    'Peak dry season building at Chitwan.',
  ],
};

function loadDotEnvLocal(): Record<string, string> {
  const out: Record<string, string> = {};
  const raw = readFileSync(join(__dirname, '..', '.env.local'), 'utf8');
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
  if (!env.DATABASE_URL) { console.error('No DATABASE_URL'); process.exit(1); }
  process.env.DATABASE_URL = env.DATABASE_URL;
  const { toScoringPlace } = await import('../src/lib/db/queries/places');
  const { deriveDestinationScores } = await import('../src/lib/scoring/destinations');
  const { fitMonthlyToCurve } = await import('../src/lib/scoring/fitCurve');
  const dryRun = process.argv.includes('--dry-run');
  const db = drizzlePostgres(postgres(env.DATABASE_URL, { prepare: false }));

  // Score-affecting events
  for (const id of Object.keys(EVENTS)) {
    const [row] = await db.select().from(places).where(eq(places.id, id));
    if (!row) { console.error(`${id}: not found`); process.exit(1); }
    const entry = EVENTS[id];
    const scoring = toScoringPlace(row);
    const before = deriveDestinationScores(scoring, { skipHazards: true }).monthly[KEY];
    const patchedScoring = {
      ...scoring,
      base: entry.base !== undefined ? { ...(scoring.base ?? {}), [KEY]: entry.base } : scoring.base,
      sliderEvents: { ...(scoring.sliderEvents ?? {}), [KEY]: [{ label: entry.label, weight: entry.weight, months: entry.months }] },
    };
    const after = deriveDestinationScores(patchedScoring, { skipHazards: true }).monthly[KEY];
    console.log(`${id}`);
    console.log(`  before: [${before ? before.map((v: number) => v.toFixed(0)).join(',') : 'NA'}]`);
    console.log(`  after:  [${after.map((v: number) => v.toFixed(0)).join(',')}]`);

    const fit = fitMonthlyToCurve(after, { maxSteepness: 4, errorTolerance: 0.5 });
    const patch: Record<string, unknown> = {
      sliderEvents: { ...(row.sliderEvents as Record<string, unknown>), [KEY]: [{ label: entry.label, weight: entry.weight, months: entry.months }] },
      sliderCurves: { ...(row.sliderCurves as Record<string, unknown>), [KEY]: fit.curve },
      authoredCurves: Array.from(new Set([...(row.authoredCurves ?? []), KEY])),
    };
    if (entry.base !== undefined) {
      patch.baseScores = { ...(row.baseScores as Record<string, unknown>), [KEY]: entry.base };
    }
    if (MONTHLY[id]) patch.sliderMonthlyWeather = { ...(row.sliderMonthlyWeather as Record<string, unknown>), [KEY]: MONTHLY[id] };
    if (OVERVIEWS[id]) patch.sliderOverview = { ...(row.sliderOverview as Record<string, string>), [KEY]: OVERVIEWS[id] };

    if (!dryRun) {
      const afterRow = { ...row, ...patch };
      await db.transaction(async (tx) => {
        await tx.update(places).set({ ...patch, updatedAt: new Date() }).where(eq(places.id, id));
        await tx.insert(adminAuditLog).values({
          actorId: '00000000-0000-0000-0000-000000000000', entityType: 'destination', entityId: id,
          action: 'update', beforeValue: row, afterValue: afterRow,
        });
      });
    }
  }

  // Nepal: extend the hard monsoon closure to include September (real
  // 2026-dated reporting: Chitwan jeep safaris suspended "until further
  // notice" from Jul 1, historically resuming only early-mid September).
  // This is a shared destination-level flag, affecting wildlifeViewing too.
  {
    const id = 'nepal';
    const [row] = await db.select().from(places).where(eq(places.id, id));
    if (!row) { console.error(`${id}: not found`); process.exit(1); }
    const scoring = toScoringPlace(row);
    const before = deriveDestinationScores(scoring, { skipHazards: true }).monthly[KEY];
    const patchedScoring = { ...scoring, wildlifeClosed: [7, 8, 9] };
    const after = deriveDestinationScores(patchedScoring, { skipHazards: true }).monthly[KEY];
    console.log(`\n${id} (wildlifeClosed extended to include Sep)`);
    console.log(`  before: [${before.map((v: number) => v.toFixed(0)).join(',')}]`);
    console.log(`  after:  [${after.map((v: number) => v.toFixed(0)).join(',')}]`);

    const patch: Record<string, unknown> = {
      wildlifeClosedMonths: [7, 8, 9],
      sliderOverview: { ...(row.sliderOverview as Record<string, string>), [KEY]: OVERVIEWS[id] },
      sliderMonthlyWeather: { ...(row.sliderMonthlyWeather as Record<string, unknown>), [KEY]: MONTHLY[id] },
    };
    if (!dryRun) {
      const afterRow = { ...row, ...patch };
      await db.transaction(async (tx) => {
        await tx.update(places).set({ ...patch, updatedAt: new Date() }).where(eq(places.id, id));
        await tx.insert(adminAuditLog).values({
          actorId: '00000000-0000-0000-0000-000000000000', entityType: 'destination', entityId: id,
          action: 'update', beforeValue: row, afterValue: afterRow,
        });
      });
    }
  }

  console.log(dryRun ? '\ndry run — nothing written.' : '\ndone.');
  process.exit(0);
}

main().catch((err) => { console.error(err); process.exit(1); });
