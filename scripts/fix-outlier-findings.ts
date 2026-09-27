import { readFileSync } from 'fs';
import { join } from 'path';
import { eq } from 'drizzle-orm';
import { drizzle as drizzlePostgres } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import { places, adminAuditLog } from '../src/lib/db/schema';
import { parseSliderCurve, rescaleCurve } from '../src/lib/scoring/curve';

/**
 * Fixes the findings from audit-content-outliers.ts that are confirmed
 * wrong on inspection, plus one under-score the audit can't see.
 *
 * Four groups, in descending order of how clearly wrong they were:
 *
 * 1. WHALE SEASONS. Three destinations scored 8-10 for whale watching in
 *    every month while their own month flags declared a 3-7 month season.
 *    Los Cabos was a 9-10 in August; the gray whales are in Baja from
 *    roughly December to April and nowhere near it the rest of the year.
 *    These get real authored curves, not a rescale — the problem is the
 *    shape, not the ceiling.
 *
 * 2. SUNBATHING WITHOUT A BEACH. Atacama, Uluru and Napa each scored 7-8
 *    for sunbathing with swimming marked N/A. The driest desert on earth,
 *    the Australian interior and an inland valley are not places anyone
 *    sunbathes; the slider belongs in naSliders, which is the whole point
 *    of the "never score zero in every month" invariant.
 *
 * 3. DOMINANCE. A sub-interest scoring above the interest that contains it.
 *    Fixed in whichever direction is true rather than mechanically: Costa
 *    Rica's spa scene really is better than a 6 (Nosara, Santa Teresa), so
 *    it goes up; Nepal's and Guatemala's retreat scenes are real but their
 *    spa scenes are thin, so the retreats come down.
 *
 * 4. VENICE. Not an audit finding — nothing here detects an UNDER-score,
 *    which is a real gap in the tooling. Found by hand while working out
 *    why Bagan outranks Venice: Venice sat at 5 for History & Archaeology,
 *    below Budapest, Vienna and Tuscany at 9, and at 8 for city
 *    exploration despite being a car-free medieval city. A thousand years
 *    of the Republic, the Doge's Palace and the Arsenale is not a 5. Its
 *    authored "casual" history tier came down too: a corrected peak that a
 *    tier still suppresses is only half a fix.
 *
 * 5. BAGAN'S PADDING. Also found by hand, chasing the same question. Bagan
 *    scored 6 for hiking and 7 each for road-tripping and adventure sports
 *    on a flat alluvial plain whose entire draw is temples — formula
 *    leftovers rather than claims, and between them the fourth, sixth and
 *    eighth largest contributors to its rank.
 */

type CurveEdit = { id: string; key: string; anchors: { month: number; value: number; steepness?: number }[]; why: string };
type PeakEdit = { id: string; key: string; peak: number; why: string };
type TierEdit = { id: string; key: string; tier: 'signature' | 'strong' | 'casual' | 'none'; why: string };
type NaEdit = { id: string; key: string; why: string };

const CURVE_EDITS: CurveEdit[] = [
  {
    id: 'los-cabos',
    key: 'whaleWatching',
    // Gray whales calve in Baja lagoons Jan-Mar; humpbacks Dec-Apr. Nothing
    // in summer but the odd resident dolphin pod.
    anchors: [
      { month: 1, value: 10, steepness: 2 },
      { month: 3, value: 10, steepness: 2 },
      { month: 4, value: 7, steepness: 2 },
      { month: 5, value: 3, steepness: 2 },
      { month: 9, value: 2, steepness: 1 },
      { month: 11, value: 6, steepness: 2 },
      { month: 12, value: 9, steepness: 2 },
    ],
    why: 'gray/humpback season is Dec-Apr; was 9-10 in August',
  },
  {
    id: 'cape-cod-islands',
    key: 'whaleWatching',
    // Stellwagen Bank humpbacks and the boats that reach them: mid-April to
    // late October, nothing at all in winter.
    anchors: [
      { month: 1, value: 1, steepness: 1 },
      { month: 3, value: 1, steepness: 2 },
      { month: 4, value: 6, steepness: 3 },
      { month: 6, value: 9, steepness: 2 },
      { month: 8, value: 9, steepness: 1 },
      { month: 10, value: 7, steepness: 2 },
      { month: 11, value: 2, steepness: 3 },
    ],
    why: 'Stellwagen Bank season is Apr-Oct; was 8-9 in January',
  },
  {
    id: 'lofoten',
    key: 'whaleWatching',
    // Orca and humpback follow the herring into the fjords Nov-Jan. The
    // rest of the year there is essentially nothing to see.
    anchors: [
      { month: 1, value: 8, steepness: 2 },
      { month: 2, value: 4, steepness: 3 },
      { month: 4, value: 1, steepness: 2 },
      { month: 9, value: 1, steepness: 1 },
      { month: 10, value: 4, steepness: 3 },
      { month: 11, value: 9, steepness: 2 },
      { month: 12, value: 9, steepness: 1 },
    ],
    why: 'orca/humpback follow the herring Nov-Jan; was 8-9 in June',
  },
];

const PEAK_EDITS: PeakEdit[] = [
  { id: 'costa-rica', key: 'spaWellness', peak: 7, why: 'Nosara/Santa Teresa — the spa scene is better than a 6' },
  { id: 'nepal', key: 'yogaRetreats', peak: 6, why: 'real retreats, thin spa scene — bring the retreats to it' },
  { id: 'guatemala', key: 'yogaRetreats', peak: 6, why: 'Atitlan retreats are real but not above the wellness scene' },
  { id: 'provence', key: 'sunbathing', peak: 7, why: 'the calanques are rock, not lounging beach' },
  { id: 'tuscany', key: 'sunbathing', peak: 6, why: 'Versilia and the Maremma are pleasant, not a sun destination' },
  { id: 'venice', key: 'historyArchaeology', peak: 8, why: 'the Republic, the Doge’s Palace, the Arsenale — was 5' },
  { id: 'venice', key: 'cityExploration', peak: 9, why: 'a car-free medieval city; belongs with Prague and Amsterdam' },
  { id: 'bagan', key: 'roadtrip', peak: 4, why: 'you e-bike between temples; it is not a touring route' },
  { id: 'bagan', key: 'adventureSports', peak: 4, why: 'a balloon ride is not an adventure-sports destination' },
];

const TIER_EDITS: TierEdit[] = [
  {
    id: 'venice',
    key: 'historyArchaeology',
    tier: 'strong',
    why: '"casual" alongside a corrected peak of 8 suppressed it twice over',
  },
];

const NA_EDITS: NaEdit[] = [
  { id: 'atacama', key: 'sunbathing', why: 'the driest desert on earth has no beach' },
  { id: 'uluru', key: 'sunbathing', why: 'the Australian interior has no beach' },
  { id: 'napa', key: 'sunbathing', why: 'an inland valley has no beach' },
  { id: 'bagan', key: 'hiking', why: 'a flat alluvial plain of temples — there is nothing to hike' },
];

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
  const dryRun = process.argv.includes('--dry-run');
  const db = drizzlePostgres(postgres(env.DATABASE_URL, { prepare: false }));

  const rows = await db.select().from(places).where(eq(places.isPrimaryDestination, true));
  // Mutable — Venice takes two edits, and a stale snapshot between them is
  // exactly the bug that ate 17 of the parks reshapes.
  const byId = new Map(rows.map((r) => [r.id, { ...r }]));
  const scored = await getAllScoredPlaces();

  // Edits are built AND applied one at a time, against the live row.
  //
  // The first version of this script built every patch in three up-front
  // loops and applied them afterwards. Venice takes two edits; both were
  // computed from the pre-write row, so the cityExploration write rebuilt
  // sliderCurves from a snapshot that predated the historyArchaeology write
  // and silently discarded it — the identical read-modify-write-over-a-
  // stale-snapshot bug that ate 17 of the nationalParks reshapes in
  // review-parks-hiking-saturation.ts. Building the patch at apply time,
  // from a map that every apply updates, is what actually prevents it;
  // "remember to update the map afterwards" is not enough when the patch
  // was computed before the loop began.
  type Edit = { id: string; label: string; build: (row: typeof rows[number]) => Record<string, unknown> };
  const edits: Edit[] = [];

  for (const e of CURVE_EDITS) {
    if (!byId.has(e.id)) { console.error(`${e.id}: not a primary destination`); process.exit(1); }
    const curve = parseSliderCurve({ anchors: e.anchors });
    edits.push({
      id: e.id,
      label: `${e.key} reshaped — ${e.why}`,
      build: (row) => ({
        sliderCurves: { ...(row.sliderCurves as Record<string, unknown>), [e.key]: curve },
        authoredCurves: Array.from(new Set([...(row.authoredCurves ?? []), e.key])),
      }),
    });
  }

  for (const e of PEAK_EDITS) {
    if (!byId.has(e.id)) { console.error(`${e.id}: not a primary destination`); process.exit(1); }
    const d = scored.find((x) => x.id === e.id);
    const monthly = d?.monthly[e.key] ?? [];
    if (monthly.length === 0) { console.error(`${e.id}: no ${e.key} scores`); process.exit(1); }
    const was = Math.max(...monthly);
    const floor = Math.min(...monthly);
    edits.push({
      id: e.id,
      label: `${e.key} ${was.toFixed(0)} -> ${e.peak} — ${e.why}`,
      build: (row) => {
        const raw = (row.sliderCurves as Record<string, unknown>)[e.key];
        if (raw === undefined) { console.error(`${e.id}: no ${e.key} curve`); process.exit(1); }
        // Keep the floor where it is unless the new ceiling drops below it.
        const rescaled = rescaleCurve(parseSliderCurve(raw), Math.min(floor, e.peak), e.peak);
        return {
          sliderCurves: { ...(row.sliderCurves as Record<string, unknown>), [e.key]: rescaled },
          authoredCurves: Array.from(new Set([...(row.authoredCurves ?? []), e.key])),
        };
      },
    });
  }

  for (const e of TIER_EDITS) {
    if (!byId.has(e.id)) { console.error(`${e.id}: not a primary destination`); process.exit(1); }
    edits.push({
      id: e.id,
      label: `${e.key} tier -> ${e.tier} — ${e.why}`,
      build: (row) => ({
        signatureTier: { ...(row.signatureTier as Record<string, unknown>), [e.key]: e.tier },
      }),
    });
  }

  for (const e of NA_EDITS) {
    if (!byId.has(e.id)) { console.error(`${e.id}: not a primary destination`); process.exit(1); }
    edits.push({
      id: e.id,
      label: `${e.key} -> N/A — ${e.why}`,
      build: (row) => {
        // A curve left under an N/A slider is dead weight that would come
        // back if the N/A were ever lifted. Drop it with the flag.
        const curves = { ...(row.sliderCurves as Record<string, unknown>) };
        delete curves[e.key];
        return {
          naSliders: Array.from(new Set([...(row.naSliders ?? []), e.key])),
          sliderCurves: curves,
          authoredCurves: (row.authoredCurves ?? []).filter((k) => k !== e.key),
        };
      },
    });
  }

  for (const w of edits) {
    const row = byId.get(w.id)!;
    const patch = w.build(row);
    const after = { ...row, ...patch };
    console.log(`  ${w.id.padEnd(22)} ${w.label}`);
    if (!dryRun) {
      await db.transaction(async (tx) => {
        await tx
          .update(places)
          .set({ ...(patch as Partial<typeof places.$inferInsert>), updatedAt: new Date() })
          .where(eq(places.id, w.id));
        await tx.insert(adminAuditLog).values({
          actorId: '00000000-0000-0000-0000-000000000000',
          entityType: 'destination',
          entityId: w.id,
          action: 'update',
          beforeValue: row,
          afterValue: after,
        });
      });
    }
    byId.set(w.id, after as typeof row);
  }

  console.log(dryRun ? `\ndry run — ${edits.length} would change.` : `\ndone: ${edits.length} edits.`);
  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
