/* eslint-disable @typescript-eslint/no-explicit-any */
// usage: npx tsx scripts/author-istanbul-diving.ts [--apply]
// Istanbul diving text written by Claude (not Gemini) at the owner's request, 24 Oct 2026, from web-checked facts: Prince Islands reef to 18 m and wall to 40 m (PADI Heybeliada page), crabs, lobsters, shrimp, sea bass, reef fish, dolphins if lucky, best visibility in Istanbul, boats only in windless weather and best late spring to early autumn (Dive Planner Pro), layered water in the Marmara. No temperatures (none sourced).
//
import { readFileSync } from 'fs';
for (const l of readFileSync('.env.local', 'utf8').split('\n')) { const t = l.trim(); if (!t || t.startsWith('#')) continue; const i = t.indexOf('='); if (i < 0) continue; let v = t.slice(i + 1).trim(); if (/^["'].*["']$/.test(v)) v = v.slice(1, -1); if (process.env[t.slice(0, i).trim()] === undefined) process.env[t.slice(0, i).trim()] = v; }

const OVERVIEW = "Istanbul is a city first and a dive destination a distant second, but divers do go out from the Asian shore to the Prince Islands, where a reef drops to about 60 ft and a wall to about 130 ft, with crabs, lobsters, sea bass and reef fish and, with luck, dolphins. It is among the clearest water near the city. Boats go out only in windless weather, and the water is layered, so conditions can change sharply within one dive.";
const MONTHS: Array<[number, string]> = [
  [1.8, "The coldest and least inviting stretch for diving. Trips to the Prince Islands depend on calm, windless weather, and the water is at its coldest."],
  [1.8, "Still cold water and short days. The Prince Islands reef and wall are diveable only in windless weather, and most visitors come for the city instead."],
  [2.4, "The water warms slowly but is still cold. Dives at the Prince Islands depend on a calm day."],
  [3.0, "Spring brings milder weather, though the water is still cool. Diving at the Prince Islands picks up toward late spring."],
  [3.6, "Late spring is when conditions start to come together at the Prince Islands, with warming water and the reef, wall and sea bass in reach on calm days."],
  [4.0, "Warm, settled weather makes this a good month for the reef dive to about 60 ft at the Prince Islands, with crabs, lobsters and reef fish, and for the wall for advanced divers."],
  [4.2, "Summer is the main season for boat dives from the Asian shore to the Prince Islands, with the warmest water of the year. Dolphins are possible, never promised."],
  [4.2, "Warm water and long days make day trips from the Asian shore easy to run. The water is layered, so expect a sudden cooler layer as you go deeper."],
  [4.0, "Settled weather and still-warm water keep early autumn a good time on the Prince Islands reef and wall."],
  [3.4, "The wind picks up and the water cools as the season winds down. Trips go out only on calm days."],
  [2.6, "Cooler water and more wind make dives at the Prince Islands rarer. The city is the reason to come."],
  [2.0, "Winter returns with cold water and few dive days. Come for Istanbul, not for the diving."]
];
(async () => {
  const apply = process.argv.includes('--apply');
  const { db } = await import('../src/lib/db/client');
  const { places, placeInterestFacts } = await import('../src/lib/db/schema');
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
  const out = { overview: OVERVIEW, monthly: MONTHS.map(([score, text]) => ({ score, text })), sources: [], confidence: 'high' as const, flags: [], extras: { diving_rating: 4, snorkeling_rating: 2, best_for: 'diving' } };
  const issues = validateContent(out as never, 'diving', 'istanbul');
  console.log(`overview ${OVERVIEW.length}/550, longest month ${Math.max(...MONTHS.map(([, t]) => t.length))}/326, celsius left: ${[OVERVIEW, ...MONTHS.map(([, t]) => t)].some(hasCelsius)}`);
  console.log(issues.length ? issues.map((i) => `[${i.severity}] ${i.message}`).join('\n') : 'validator: clean');
  console.log('status:', overallStatus(issues));
  if (!apply) process.exit(0);
  if (overallStatus(issues) === 'invalid') { console.log('Not applying: rejected by the validator.'); process.exit(1); }

  const [row] = (await db.select().from(places).where(eq(places.id, 'istanbul'))) as any[];
  const loaded = row.updatedAt.toISOString();
  const scores = MONTHS.map(([s]) => s);
  const curve = fitMonthlyToCurve(scores).curve;
  const cv = parseSliderCurve(curve);
  const overrides: Record<string, number> = {};
  scores.forEach((v, i) => { if (Math.abs(Math.round(curveValue(i + 1, cv) * 10) / 10 - v) > 0.04) overrides[String(i)] = v; });
  const stamp = { origin: 'claude' as const, lastEditedBy: 'claude' as const, lastEditorName: 'claude-sonnet-5.5', lastEditedAt: new Date().toISOString(), lastChange: 'Rewritten as a modest dive place (Claude, web-checked, 24 Oct 2026)' };
  const allOv = { ...((row.scoreOverrides as any) ?? {}) }; if (Object.keys(overrides).length) allOv.diving = overrides; else delete allOv.diving;
  const res = await applyAdminEdits([
    { entityType: 'destination', entityId: 'istanbul', field: 'sliderCurves', value: { ...(row.sliderCurves as any), diving: curve }, loadedUpdatedAt: loaded },
    { entityType: 'destination', entityId: 'istanbul', field: 'sliderOverview', value: { ...(row.sliderOverview as any), diving: OVERVIEW }, loadedUpdatedAt: loaded },
    { entityType: 'destination', entityId: 'istanbul', field: 'sliderMonthlyWeather', value: { ...(row.sliderMonthlyWeather as any), diving: MONTHS.map(([, t]) => t) }, loadedUpdatedAt: loaded },
    { entityType: 'destination', entityId: 'istanbul', field: 'sliderOverviewMeta', value: { ...(row.sliderOverviewMeta as any), diving: stamp }, loadedUpdatedAt: loaded },
    { entityType: 'destination', entityId: 'istanbul', field: 'sliderMonthlyWeatherMeta', value: { ...(row.sliderMonthlyWeatherMeta as any), diving: new Array(12).fill(stamp) }, loadedUpdatedAt: loaded },
    { entityType: 'destination', entityId: 'istanbul', field: 'scoreOverrides', value: allOv, loadedUpdatedAt: loaded },
  ], CLAUDE_ACTOR);
  if (res.errors.length || res.conflicts.length) { console.log('PROBLEM', JSON.stringify(res.errors), JSON.stringify(res.conflicts)); process.exit(1); }
  const [after] = (await db.select().from(places).where(eq(places.id, 'istanbul'))) as any[];
  const shown: number[] = (scorePlace(after) as any).monthly.diving.map((x: number) => Math.round(x * 10) / 10);
  console.log('displayed now:', shown.join(' '), shown.every((v, i) => Math.abs(v - scores[i]) <= 0.05) ? '(matches)' : '(MISMATCH)');

  // Ratings and the few columns the text rests on (kept in the admin's metric units until those columns are converted).
  await writeExtraFacts('istanbul', 'diving', { diving_rating: 4, snorkeling_rating: 2, best_for: 'diving' }, false);
  const [f] = await db.select().from(placeInterestFacts).where(and(eq(placeInterestFacts.placeId, 'istanbul'), eq(placeInterestFacts.interestKey, 'diving')));
  const before = (f?.facts ?? {}) as Record<string, unknown>;
  const afterFacts = { ...before, drawType: 'reef', accessStyle: 'dayBoat', certification: 'openWater', typicalDepth: '60-130 ft', current: 'mild', drawSourceChecked: false };
  await withAdminAudit({ actor: CLAUDE_ACTOR, skipPlaceCache: true, entityType: 'place_interest_fact', entityId: 'istanbul:diving', action: f ? 'update' : 'create', before: f ? { placeId: 'istanbul', interestKey: 'diving', facts: before } : null, after: { placeId: 'istanbul', interestKey: 'diving', facts: afterFacts },
    write: (tx) => tx.insert(placeInterestFacts).values({ placeId: 'istanbul', interestKey: 'diving', facts: afterFacts as never }).onConflictDoUpdate({ target: [placeInterestFacts.placeId, placeInterestFacts.interestKey], set: { facts: afterFacts as never, updatedAt: new Date() } }) });

  console.log('done');
  process.exit(0);
})();
