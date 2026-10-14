/* eslint-disable @typescript-eslint/no-explicit-any */
// usage: npx tsx scripts/rewrite-french-polynesia-diving.ts [--apply]
// French Polynesia diving text written by Claude (not Gemini) for the whole place, 12 Oct 2026, from web-checked facts:
// Rangiroa Tiputa Pass (hammerheads Dec-Mar, mantas Jul-Oct, dolphins any month), Fakarava South Pass (resident grey reef sharks,
// camouflage grouper spawning at the June/July full moons), Moorea/Tahiti humpback whales Aug-Oct, water 79-84 F, wet season Nov-Apr.
import { readFileSync } from 'fs';
for (const l of readFileSync('.env.local', 'utf8').split('\n')) { const t = l.trim(); if (!t || t.startsWith('#')) continue; const i = t.indexOf('='); if (i < 0) continue; let v = t.slice(i + 1).trim(); if (/^["'].*["']$/.test(v)) v = v.slice(1, -1); if (process.env[t.slice(0, i).trim()] === undefined) process.env[t.slice(0, i).trim()] = v; }

const OVERVIEW = "The Tuamotu atolls, Rangiroa and Fakarava above all, are drift dives through narrow passes where the tide brings in grey reef sharks, dolphins, eagle rays and, in season, hammerheads, mantas and a spawning gathering of groupers. The passes have strong current and suit experienced divers. Moorea, Tahiti and Bora Bora have calmer lagoon dives and snorkels with lemon sharks, rays and turtles, though some ray and shark tours feed the animals. Water holds 79 to 84°F all year, and the clearest months are May to October.";
const MONTHS: Array<[number, string]> = [
  [8.5, "Hammerhead sharks school in the Tiputa Pass at Rangiroa, at their best from January to March, with eagle rays in the same current. The water is at its warmest, about 84°F. It is the wet season, so rain can cloud the Society Islands more than the atolls."],
  [8.7, "Hammerheads are still gathering in the Tiputa Pass at Rangiroa, and grey reef sharks and eagle rays work the current alongside them. Water stays near 84°F, and the Tuamotu atolls get less rain than the Society Islands, so visibility holds up better there."],
  [8.2, "The last of the hammerhead season at Rangiroa, with grey reef sharks, dolphins and eagle rays still working the Tiputa Pass. Water is a warm 83°F and the atolls are calm and clear, with the rain easing in the Society Islands."],
  [7.5, "Rain is tapering off in the Society Islands and visibility there is variable, while the Tuamotu passes at Rangiroa and Fakarava stay good, with grey reef sharks in the current and dolphins in the Tiputa Pass in any month. A quieter month between the hammerheads and the dry-season peak."],
  [8.4, "The dry season brings the best visibility of the year to the atoll passes. Fakarava's South Pass holds hundreds of grey reef sharks facing the current, and Rangiroa has dolphins and eagle rays. The lagoons at Moorea and Bora Bora are calm and clear for snorkeling. Water is about 82°F, so a 3 mm wetsuit is enough."],
  [9.0, "Camouflage groupers gather to spawn in Fakarava's South Pass around the June full moon, and the grey reef sharks already holding the current feed on them. The current is strong and the dive suits experienced divers. Southeast winds can roughen the sea on the way out."],
  [9.1, "The grouper spawning in Fakarava's South Pass can still fill the channel with sharks around the July full moon, and manta rays begin to appear at Rangiroa. Humpback whales are in the waters around Moorea and Tahiti. This is the coolest water of the year, about 79°F, so a thicker wetsuit helps."],
  [8.8, "Manta rays visit Rangiroa's Tiputa Pass from late August, and humpback whales with calves are around Moorea, where regulated swims let snorkelers get in the water with them. Visibility is excellent and the seas are mostly calm."],
  [8.9, "The peak month for humpback whales around Moorea and Tahiti, with mothers and calves and regulated swims in the water for snorkelers. At Rangiroa, manta rays are in the pass, and Fakarava's passes stay clear and full of grey reef sharks. Water is about 79 to 80°F."],
  [8.6, "Humpbacks stay around Moorea through October, and manta rays at Rangiroa are seen through mid-October. The dry season is closing out, with clear water and good visibility in the passes."],
  [7.6, "The wet season sets in with more rain and some storm risk, and the whale season is over by early November. The Tuamotu atolls get less rain than the Society Islands, so the passes at Rangiroa and Fakarava are still worth diving, with grey reef sharks and dolphins."],
  [8.0, "Hammerhead sharks begin to return to the Tiputa Pass at Rangiroa, and the water warms toward 84°F. It is the wet season, with rain around the Society Islands, but the atoll passes keep good visibility."],
];
(async () => {
  const apply = process.argv.includes('--apply');
  const { db } = await import('../src/lib/db/client');
  const { places, placeInterestFacts, interestTodos } = await import('../src/lib/db/schema');
  const { and, eq } = await import('drizzle-orm');
  const { validateContent, overallStatus } = await import('../src/lib/gemini/validate');
  const { fitMonthlyToCurve } = await import('../src/lib/scoring/fitCurve');
  const { curveValue, parseSliderCurve } = await import('../src/lib/scoring/curve');
  const { scorePlace } = await import('../src/lib/db/queries/places');
  const { applyAdminEdits } = await import('../src/lib/admin/apply-edits');
  const { withAdminAudit } = await import('../src/lib/admin/write');
  const { CLAUDE_ACTOR } = await import('../src/lib/admin/auth');
  const { writeExtraFacts } = await import('../src/lib/gemini/apply');
  const { hasCelsius } = await import('../src/lib/text/temperature');
  const out = { overview: OVERVIEW, monthly: MONTHS.map(([score, text]) => ({ score, text })), sources: [], confidence: 'high' as const, flags: [], extras: { diving_rating: 9, snorkeling_rating: 8, best_for: 'both' } };
  const issues = validateContent(out as never, 'diving', 'borabora');
  console.log(`overview ${OVERVIEW.length}/550, longest month ${Math.max(...MONTHS.map(([, t]) => t.length))}/326, celsius left: ${[OVERVIEW, ...MONTHS.map(([, t]) => t)].some(hasCelsius)}`);
  console.log(issues.length ? issues.map((i) => `[${i.severity}] ${i.message}`).join('\n') : 'validator: clean');
  console.log('status:', overallStatus(issues));
  if (!apply) process.exit(0);
  if (overallStatus(issues) === 'invalid') { console.log('Not applying: rejected by the validator.'); process.exit(1); }

  const [row] = (await db.select().from(places).where(eq(places.id, 'borabora'))) as any[];
  const loaded = row.updatedAt.toISOString();
  const scores = MONTHS.map(([s]) => s);
  const curve = fitMonthlyToCurve(scores).curve;
  const cv = parseSliderCurve(curve);
  const overrides: Record<string, number> = {};
  scores.forEach((v, i) => { if (Math.abs(Math.round(curveValue(i + 1, cv) * 10) / 10 - v) > 0.04) overrides[String(i)] = v; });
  const stamp = { origin: 'claude' as const, lastEditedBy: 'claude' as const, lastEditorName: 'claude-sonnet-5.5', lastEditedAt: new Date().toISOString(), lastChange: 'Rewritten for all of French Polynesia (Claude, web-checked, 12 Oct 2026)' };
  const allOv = { ...((row.scoreOverrides as any) ?? {}) }; if (Object.keys(overrides).length) allOv.diving = overrides; else delete allOv.diving;
  const res = await applyAdminEdits([
    { entityType: 'destination', entityId: 'borabora', field: 'sliderCurves', value: { ...(row.sliderCurves as any), diving: curve }, loadedUpdatedAt: loaded },
    { entityType: 'destination', entityId: 'borabora', field: 'sliderOverview', value: { ...(row.sliderOverview as any), diving: OVERVIEW }, loadedUpdatedAt: loaded },
    { entityType: 'destination', entityId: 'borabora', field: 'sliderMonthlyWeather', value: { ...(row.sliderMonthlyWeather as any), diving: MONTHS.map(([, t]) => t) }, loadedUpdatedAt: loaded },
    { entityType: 'destination', entityId: 'borabora', field: 'sliderOverviewMeta', value: { ...(row.sliderOverviewMeta as any), diving: stamp }, loadedUpdatedAt: loaded },
    { entityType: 'destination', entityId: 'borabora', field: 'sliderMonthlyWeatherMeta', value: { ...(row.sliderMonthlyWeatherMeta as any), diving: new Array(12).fill(stamp) }, loadedUpdatedAt: loaded },
    { entityType: 'destination', entityId: 'borabora', field: 'scoreOverrides', value: allOv, loadedUpdatedAt: loaded },
  ], CLAUDE_ACTOR);
  if (res.errors.length || res.conflicts.length) { console.log('PROBLEM', JSON.stringify(res.errors), JSON.stringify(res.conflicts)); process.exit(1); }
  const [after] = (await db.select().from(places).where(eq(places.id, 'borabora'))) as any[];
  const shown: number[] = (scorePlace(after) as any).monthly.diving.map((x: number) => Math.round(x * 10) / 10);
  console.log('displayed now:', shown.join(' '), shown.every((v, i) => Math.abs(v - scores[i]) <= 0.05) ? '(matches)' : '(MISMATCH)');

  // Ratings and the few columns the text rests on (kept in the admin's metric units until those columns are converted).
  await writeExtraFacts('borabora', 'diving', { diving_rating: 9, snorkeling_rating: 8, best_for: 'both' }, false);
  const [f] = await db.select().from(placeInterestFacts).where(and(eq(placeInterestFacts.placeId, 'borabora'), eq(placeInterestFacts.interestKey, 'diving')));
  const before = (f?.facts ?? {}) as Record<string, unknown>;
  const afterFacts = { ...before, drawType: 'animals', accessStyle: 'mixed', certification: 'advanced', current: 'strong', waterTemp: '26-29 C', drawSourceChecked: false };
  await withAdminAudit({ actor: CLAUDE_ACTOR, skipPlaceCache: true, entityType: 'place_interest_fact', entityId: 'borabora:diving', action: f ? 'update' : 'create', before: f ? { placeId: 'borabora', interestKey: 'diving', facts: before } : null, after: { placeId: 'borabora', interestKey: 'diving', facts: afterFacts },
    write: (tx) => tx.insert(placeInterestFacts).values({ placeId: 'borabora', interestKey: 'diving', facts: afterFacts as never }).onConflictDoUpdate({ target: [placeInterestFacts.placeId, placeInterestFacts.interestKey], set: { facts: afterFacts as never, updatedAt: new Date() } }) });

  // Close the French Polynesia diving rewrite to-do.
  const [t] = await db.select().from(interestTodos).where(and(eq(interestTodos.interestKey, 'diving'), eq(interestTodos.placeId, 'borabora')));
  if (t && t.status !== 'done') {
    const detail = `${t.detail}\n\nDone 12 Oct 2026: rewritten by Claude (not Gemini) for all of French Polynesia, using web-checked facts for Rangiroa, Fakarava, Moorea and Tahiti. Peak 9.1 in July; diving rating 9, snorkeling rating 8.`;
    await withAdminAudit({ actor: CLAUDE_ACTOR, skipPlaceCache: true, entityType: 'interest_todo', entityId: t.id, action: 'update', before: t, after: { ...t, status: 'done', detail }, write: (tx) => tx.update(interestTodos).set({ status: 'done', doneAt: new Date(), detail, updatedAt: new Date() }).where(eq(interestTodos.id, t.id)).returning() });
    console.log('to-do closed');
  }
  process.exit(0);
})();
