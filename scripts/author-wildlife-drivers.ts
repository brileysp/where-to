import { readFileSync } from 'fs';
import { join } from 'path';
import { eq } from 'drizzle-orm';
import { drizzle as drizzlePostgres } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import { places, adminAuditLog } from '../src/lib/db/schema';
import type { SliderEvent } from '../src/lib/scoring/types';

/**
 * The wildlife-driver authoring pass this session settled on — not the
 * full wildlifeViewing/safari/whaleWatching/wildflowerBlooms catalogue,
 * only the destinations actually adjudicated one at a time.
 *
 * The proposed taxonomy's first draft (a single broad "dry-season
 * concentration" bucket) was too generous — it pattern-matched "African
 * savanna, dry season" onto everything instead of checking each
 * ecosystem's real mechanism. Review caught it: Namibia and Hwange
 * (Zimbabwe) really do have animals mobbing the only remaining water;
 * Kenya, Tanzania and Kruger mostly don't, and lumping them together
 * asserted a mechanism that isn't there.
 *
 * Five distinct mechanisms survive that review, not one:
 *
 *   TRUE WATERHOLE/RIVER CONCENTRATION — an arid or seasonally-shrinking
 *   water source with no alternative, animals visibly mob it. Namibia
 *   (Etosha), Zimbabwe (Hwange — already correctly authored, untouched
 *   here), Zambia (South Luangwa/Mana Pools river corridor — already
 *   correct, untouched), Sri Lanka ("The Gathering" — elephants at
 *   Minneriya/Kaudulla as the tanks shrink), Everglades (falling water
 *   concentrates wading birds and gators into shrinking sloughs — already
 *   correct, untouched).
 *
 *   FLOOD-PULSE CONCENTRATION — Botswana's Okavango is not a dry-season
 *   story, it only looks like one. Angolan highland rain (Dec-Mar) takes
 *   3-4 months to travel downstream, so the delta actually FLOODS in the
 *   local dry season (roughly Jun-Sep) — a delayed-arrival mechanism, not
 *   an aridity one, even though the visible result (great game viewing in
 *   the dry months) looks the same from the outside.
 *
 *   MIGRATION CIRCUIT — a traveling population passes through on a dated
 *   window. Kenya/Tanzania's river crossings and Ndutu calving were
 *   already correctly authored as events (Tanzania already modeled BOTH
 *   as separate peaks) — untouched on wildlifeViewing. What was missing
 *   was `safari`: the identical phenomenon, viewed from a safari vehicle
 *   instead of scored under a different slider, had no event of its own
 *   at every single one of these destinations.
 *
 *   VISIBILITY/COMFORT ONLY — the animals don't concentrate; thinning
 *   vegetation or drier trails make an unchanged resident population
 *   easier to see or reach. Genuinely common and usually a MILD effect,
 *   not the dramatic one true concentration produces:
 *     - Kaziranga's dry-season grass-cutting (already correctly light —
 *       untouched)
 *     - Kruger, which had been carrying the SAME weight and swing as
 *       Namibia's true concentration (5-9, a 4-point swing) despite being
 *       a comparatively well-watered, ecologically diverse park. Halved.
 *     - Costa Rica, which had NO real driver at all — continuous rainforest
 *       biomass, no drought-driven congregation at water. Its event
 *       asserted "visibility" improves, which isn't true; only trail
 *       comfort does, and that isn't worth a dedicated event. Removed.
 *
 *   ACCESS-CONSTRAINED — Madagascar's roads and trails genuinely become
 *   impassable in the wet season in a way "comfort" undersells; already
 *   correctly framed that way in its existing event — untouched on
 *   wildlifeViewing, mirrored onto safari.
 *
 * Every edit here recomputes the slider's monthly output through the REAL
 * formula (deriveDestinationScores with the new sliderEvents merged in,
 * skipHazards:true — the same source fitDestinationCurves itself uses),
 * then fits a curve from that output with the same smoothing this session
 * settled on (maxSteepness 4, the tight 0.5 tolerance) rather than
 * hand-drawing anchors — sliderEvents are the source of truth here, the
 * curve is a faithful, smooth rendering of them, not an independent guess.
 */

type Edit = {
  id: string;
  slider: string;
  events: SliderEvent[];
  clearWildlifePeakFlag?: boolean;
  why: string;
};

const EDITS: Edit[] = [
  // ---- Mirror the migration/concentration events onto `safari` --------
  // Identical real-world phenomenon, viewed from a safari vehicle. Same
  // months and weights as the already-correct wildlifeViewing event —
  // this is the one place a straight mirror is right, because the
  // underlying mechanism genuinely is the same sighting, not a coincidence
  // of vocabulary.
  // Weight scaled down from the wildlifeViewing mirror, not copied
  // verbatim — safari's base (8) is already higher than wildlifeViewing's
  // (6), and Namibia is not in safari's anchor set (only Kenya, Tanzania,
  // Botswana are), so the literal weight-3 mirror clamped to a flat 10
  // across five months — exactly the saturation shape this session spent
  // a long stretch removing elsewhere. Targets a peak of 9, matching
  // Namibia's own wildlifeViewing peak rather than exceeding it.
  { id: 'namibia', slider: 'safari', why: 'Etosha waterhole concentration, mirrored — weight scaled to avoid clamping past the safari anchor ceiling',
    events: [{ label: 'Dry-season concentration', weight: 1, months: { 5: 0.4, 6: 0.7, 7: 1, 8: 1, 9: 1, 10: 0.6 } }] },
  { id: 'zimbabwe', slider: 'safari', why: "Hwange waterhole concentration, mirrored — weight scaled, same anchor-ceiling reason as Namibia",
    events: [{ label: "Dry-season concentration at Hwange's waterholes", weight: 1, months: { 5: 0.3, 6: 0.7, 7: 1, 8: 1, 9: 1, 10: 0.6 } }] },
  // Zambia's safari base is already 9 — even a modest weight is close to
  // the ceiling, and Zambia is not a safari anchor.
  { id: 'zambia', slider: 'safari', why: 'South Luangwa / Mana Pools river-corridor concentration, mirrored — weight scaled, same anchor-ceiling reason',
    events: [{ label: 'Dry-season river-corridor concentration', weight: 0.3, months: { 5: 0.3, 6: 0.7, 7: 1, 8: 1, 9: 1, 10: 0.6 } }] },
  { id: 'kenya', slider: 'safari', why: 'Great Migration river crossings, mirrored from wildlifeViewing',
    events: [{ label: 'Great Migration river crossings', weight: 2, months: { 6: 0.5, 7: 1, 8: 1, 9: 1, 10: 0.7 } }] },
  { id: 'tanzania', slider: 'safari', why: 'Both migration peaks, mirrored — Tanzania already models two peaks on wildlifeViewing and safari gets the same two',
    events: [
      { label: 'Ndutu calving season', weight: 2.5, months: { 1: 1, 2: 1, 3: 0.7 } },
      { label: 'Great Migration river crossings', weight: 2.5, months: { 6: 0.5, 7: 1, 8: 1, 9: 1, 10: 0.7 } },
    ] },
  { id: 'madagascar', slider: 'safari', why: 'dry-season lemur trekking & road access, mirrored',
    events: [{ label: 'Dry-season lemur trekking & road access', weight: 4, months: { 4: 0.5, 5: 0.7, 6: 1, 7: 1, 8: 1, 9: 1, 10: 0.85, 11: 0.5 } }] },
  { id: 'kaziranga', slider: 'safari', why: 'grass-cutting visibility, mirrored — same light touch as wildlifeViewing',
    events: [{ label: 'Dry-season grass-cutting visibility', weight: 3, months: { 1: 1, 2: 1, 3: 0.7, 4: 0.3, 11: 0.4, 12: 1 } }] },

  // ---- Botswana: relabeled and re-timed as flood-pulse, not aridity ----
  { id: 'botswana', slider: 'wildlifeViewing',
    why: 'flood-pulse concentration, not dry-season aridity — the delta floods in the LOCAL dry season because Angolan rain takes 3-4 months to arrive',
    events: [{ label: 'Okavango flood-pulse (delayed Angolan floodwater)', weight: 3, months: { 6: 0.6, 7: 1, 8: 1, 9: 1, 10: 0.5 } }] },
  { id: 'botswana', slider: 'safari', why: 'flood-pulse concentration, mirrored',
    events: [{ label: 'Okavango flood-pulse (delayed Angolan floodwater)', weight: 3, months: { 6: 0.6, 7: 1, 8: 1, 9: 1, 10: 0.5 } }] },

  // ---- Kruger: halved — visibility/comfort, not true concentration -----
  { id: 'kruger', slider: 'wildlifeViewing',
    why: 'was carrying Namibia\'s true-concentration weight (a 4-point swing) despite being comparatively well-watered — halved to a visibility nudge',
    events: [{ label: 'Drier bush eases sightlines', weight: 1.5, months: { 5: 0.5, 6: 0.85, 7: 1, 8: 1, 9: 0.7 } }] },
  // Kruger's safari base is already 9; the wildlifeViewing version was
  // already halved to a visibility nudge, so this needs to be lighter
  // still to avoid clamping — Kruger is not a safari anchor.
  { id: 'kruger', slider: 'safari', why: 'mirrored, lighter still — same anchor-ceiling reason',
    events: [{ label: 'Drier bush eases sightlines', weight: 0.3, months: { 5: 0.5, 6: 0.85, 7: 1, 8: 1, 9: 0.7 } }] },

  // ---- Costa Rica: removed — no real driver exists ----------------------
  { id: 'costa-rica', slider: 'wildlifeViewing',
    why: 'continuous rainforest biomass, no drought-driven congregation at water — the removed event asserted a visibility improvement that is not real, only trail comfort is',
    events: [] },

  // ---- Sri Lanka: replaced a wrong flag with the real driver -----------
  // The previous wildlifePeakMonths (Feb-Jun, Nov-Jan) run opposite to
  // "The Gathering" at Minneriya/Kaudulla, which happens as the tanks
  // shrink in the dry season, roughly Jul-Oct.
  { id: 'srilanka', slider: 'wildlifeViewing', clearWildlifePeakFlag: true,
    why: 'replaces a flag pointing the wrong direction with the real elephant-gathering season',
    events: [{ label: 'The Gathering — elephants at shrinking tanks (Minneriya/Kaudulla)', weight: 3, months: { 7: 0.6, 8: 1, 9: 1, 10: 0.7 } }] },
  { id: 'srilanka', slider: 'safari', clearWildlifePeakFlag: true, why: 'mirrored',
    events: [{ label: 'The Gathering — elephants at shrinking tanks (Minneriya/Kaudulla)', weight: 3, months: { 7: 0.6, 8: 1, 9: 1, 10: 0.7 } }] },

  // ---- Madeira: three sliders, three different real stories -------------
  // wildlifeViewing deliberately gets NOTHING here — its actual wildlife
  // appeal lives entirely in whaleWatching, wildflowerBlooms and birding
  // (Zino's petrel), not in a generic "wildlife viewing" signal of its
  // own. Leaving it flat and low is the honest answer, not a gap.
  // Madeira is not among whaleWatching's eight anchors (Monterey,
  // Vancouver Island, SE Alaska, Los Cabos, Iceland, Nova Scotia, Maui,
  // Azores) — weight targets a peak of 9, not the clamped 10 a weight-2
  // event would have produced on an 8 base.
  { id: 'madeira', slider: 'whaleWatching',
    why: 'a spring PASSAGE route (resident sperm whales/dolphins year-round, plus migrating blue/fin/sei whales Feb-Jun) — neither a summer feeding ground nor a winter breeding ground, a third pattern',
    events: [{ label: 'Blue, fin & sei whale spring passage', weight: 1, months: { 2: 0.4, 3: 0.7, 4: 1, 5: 1, 6: 0.6 } }] },
  // Madeira is not among wildflowerBlooms's five anchors (Iceland,
  // Canaries, Cape Town, Tokyo & Kyoto, Glacier-Waterton) — weight targets
  // a peak of 8, not the clamped 10 a weight-4 event would have produced.
  { id: 'madeira', slider: 'wildflowerBlooms',
    why: 'the Madeira Flower Festival and endemic spring flora (Pride of Madeira, agapanthus)',
    events: [{ label: 'Flower Festival & endemic spring bloom', weight: 2, months: { 4: 0.7, 5: 1, 6: 0.6 } }] },
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
  // Dynamic, after the env is set — see review-scenic-saturation.ts.
  const { toScoringPlace } = await import('../src/lib/db/queries/places');
  const { deriveDestinationScores, isSliderNA } = await import('../src/lib/scoring/destinations');
  const { fitMonthlyToCurve } = await import('../src/lib/scoring/fitCurve');
  const dryRun = process.argv.includes('--dry-run');
  const db = drizzlePostgres(postgres(env.DATABASE_URL, { prepare: false }));

  const ids = [...new Set(EDITS.map((e) => e.id))];
  const rows = await db.select().from(places).where(eq(places.isPrimaryDestination, true));
  const byId = new Map(rows.filter((r) => ids.includes(r.id)).map((r) => [r.id, { ...r }]));
  for (const id of ids) if (!byId.has(id)) { console.error(`${id}: not a primary destination`); process.exit(1); }

  // Applied and re-derived one edit at a time, against the live row — the
  // stale-snapshot bug that ate 17 of the nationalParks reshapes and
  // Venice's history earlier this session is exactly what "build every
  // patch up front against a startup snapshot" causes. Botswana, Kruger
  // and Sri Lanka each take two edits here.
  for (const e of EDITS) {
    const row = byId.get(e.id)!;
    const scoring = toScoringPlace(row);
    if (isSliderNA(scoring, e.slider)) { console.error(`${e.id}/${e.slider}: is N/A`); process.exit(1); }

    const patchedEvents = { ...(scoring.sliderEvents ?? {}) };
    if (e.events.length > 0) patchedEvents[e.slider] = e.events;
    else delete patchedEvents[e.slider];
    const patchedScoring = { ...scoring, sliderEvents: patchedEvents };
    if (e.clearWildlifePeakFlag) patchedScoring.wildlifePeak = [];

    const before = deriveDestinationScores(scoring, { skipHazards: true }).monthly[e.slider];
    const { monthly } = deriveDestinationScores(patchedScoring, { skipHazards: true });
    const values = monthly[e.slider];
    const fit = fitMonthlyToCurve(values, { maxSteepness: MAX_STEEPNESS, errorTolerance: ERROR_TOLERANCE });

    const was = Math.max(...before);
    const now = Math.max(...values);
    console.log(`  ${e.id.padEnd(14)} ${e.slider.padEnd(15)} peak ${was.toFixed(1)} -> ${now.toFixed(1)}   ${e.why}`);

    const patch: Record<string, unknown> = {
      sliderEvents: patchedEvents,
      sliderCurves: { ...(row.sliderCurves as Record<string, unknown>), [e.slider]: fit.curve },
      authoredCurves: Array.from(new Set([...(row.authoredCurves ?? []), e.slider])),
    };
    if (e.clearWildlifePeakFlag) patch.wildlifePeakMonths = [];

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

  console.log(dryRun ? `\ndry run — ${EDITS.length} edits would apply.` : `\ndone: ${EDITS.length} edits applied.`);
  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
