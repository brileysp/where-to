/* eslint-disable @typescript-eslint/no-explicit-any */
// usage: npx tsx scripts/rewrite-iceland-diving-months.ts [--apply]
// Iceland diving month blurbs and scores, revised by Claude 12 Oct 2026. The old text said winter was "too cold and dark for realistic
// access" and scored Nov-Mar at 0; Silfra is dived all year at a steady 35-39 F (daylight is the winter limit, about 4-7 hours).
// Peak stays capped at 6.9 (owner).
import { readFileSync } from 'fs';
for (const l of readFileSync('.env.local', 'utf8').split('\n')) { const t = l.trim(); if (!t || t.startsWith('#')) continue; const i = t.indexOf('='); if (i < 0) continue; let v = t.slice(i + 1).trim(); if (/^["'].*["']$/.test(v)) v = v.slice(1, -1); if (process.env[t.slice(0, i).trim()] === undefined) process.env[t.slice(0, i).trim()] = v; }
const A = 'Silfra stays open all winter, with the same 35 to 39°F water. A drysuit is essential and daylight is short, about 4 to 7 hours, so dive times are limited and wind chill can be harsh.';
const B = 'Silfra is open in every season, and daylight is longer than in midwinter, so there are more dive times. A drysuit is essential in the 35 to 39°F water.';
const C = 'Diveable, with a drysuit essential in the 35 to 39°F water and long daylight for dive times.';
const D = 'The most accessible window of the year, with the longest daylight and the busiest dive times, though the 35 to 39°F water stays glacially cold in every season.';
const E = 'Diveable, with a drysuit essential in the 35 to 39°F water and daylight still good for dive times.';
const F = 'Silfra stays open as the days shorten, with the same 35 to 39°F water and a drysuit essential.';
const MONTHS: Array<[number, string]> = [[4.0, A], [4.2, A], [4.8, B], [5.6, C], [5.9, C], [6.9, D], [6.9, D], [6.7, D], [5.8, E], [5.5, E], [4.5, F], [4.0, A]];
(async () => {
  const apply = process.argv.includes('--apply');
  const { db } = await import('../src/lib/db/client');
  const { places } = await import('../src/lib/db/schema');
  const { eq } = await import('drizzle-orm');
  const { validateContent, overallStatus } = await import('../src/lib/gemini/validate');
  const { fitMonthlyToCurve } = await import('../src/lib/scoring/fitCurve');
  const { curveValue, parseSliderCurve } = await import('../src/lib/scoring/curve');
  const { scorePlace } = await import('../src/lib/db/queries/places');
  const { applyAdminEdits } = await import('../src/lib/admin/apply-edits');
  const { CLAUDE_ACTOR } = await import('../src/lib/admin/auth');
  const [row] = (await db.select().from(places).where(eq(places.id, 'iceland'))) as any[];
  const overview = row.sliderOverview.diving as string;
  const out = { overview, monthly: MONTHS.map(([score, text]) => ({ score, text })), sources: [], confidence: 'high' as const, flags: [] };
  const issues = validateContent(out as never, 'diving', 'iceland');
  console.log(issues.length ? issues.map((i) => `[${i.severity}] ${i.message}`).join('\n') : 'validator: clean', '| status:', overallStatus(issues));
  if (!apply) process.exit(0);
  if (overallStatus(issues) === 'invalid') process.exit(1);
  const scores = MONTHS.map(([s]) => s);
  const curve = fitMonthlyToCurve(scores).curve; const cv = parseSliderCurve(curve);
  const overrides: Record<string, number> = {};
  scores.forEach((v, i) => { if (Math.abs(Math.round(curveValue(i + 1, cv) * 10) / 10 - v) > 0.04) overrides[String(i)] = v; });
  const stamp = { origin: 'claude' as const, lastEditedBy: 'claude' as const, lastEditorName: 'claude-sonnet-5.5', lastEditedAt: new Date().toISOString(), lastChange: 'Month blurbs revised: Silfra is dived all year (Claude, web-checked, 12 Oct 2026)' };
  const allOv = { ...((row.scoreOverrides as any) ?? {}) }; if (Object.keys(overrides).length) allOv.diving = overrides; else delete allOv.diving;
  const loaded = row.updatedAt.toISOString();
  const res = await applyAdminEdits([
    { entityType: 'destination', entityId: 'iceland', field: 'sliderCurves', value: { ...(row.sliderCurves as any), diving: curve }, loadedUpdatedAt: loaded },
    { entityType: 'destination', entityId: 'iceland', field: 'sliderMonthlyWeather', value: { ...(row.sliderMonthlyWeather as any), diving: MONTHS.map(([, t]) => t) }, loadedUpdatedAt: loaded },
    { entityType: 'destination', entityId: 'iceland', field: 'sliderMonthlyWeatherMeta', value: { ...(row.sliderMonthlyWeatherMeta as any), diving: new Array(12).fill(stamp) }, loadedUpdatedAt: loaded },
    { entityType: 'destination', entityId: 'iceland', field: 'scoreOverrides', value: allOv, loadedUpdatedAt: loaded },
  ], CLAUDE_ACTOR);
  if (res.errors.length || res.conflicts.length) { console.log('PROBLEM', JSON.stringify(res.errors), JSON.stringify(res.conflicts)); process.exit(1); }
  const [after] = (await db.select().from(places).where(eq(places.id, 'iceland'))) as any[];
  const shown: number[] = (scorePlace(after) as any).monthly.diving.map((x: number) => Math.round(x * 10) / 10);
  console.log('displayed now:', shown.join(' '), shown.every((v, i) => Math.abs(v - scores[i]) <= 0.05) ? '(matches)' : '(MISMATCH)');
  process.exit(0);
})();
