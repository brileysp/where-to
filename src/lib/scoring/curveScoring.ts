import { SLIDERS } from './constants';
import { clamp10, computeBadges, deriveWeatherBand, HAZARD_SLIDER_MULTIPLIER, has } from './destinations';
import { crowdsScore, curveValue, dealsScore, parseSliderCurve, type SliderCurve } from './curve';
import type { Badge, DerivedScores, ScoringDestination } from './types';

/**
 * Curve-based scoring, Phase 4: the live evaluator docs/scoring-v2-proposal.html
 * describes. Produces the exact same DerivedScores shape as
 * deriveDestinationScores (scoring/destinations.ts) — a drop-in replacement
 * at the scoreDestination/scorePlace call sites — but computes `monthly`
 * from each slider's fitted SliderCurve instead of the old 10-branch
 * formula switch. That old function is untouched and still exported: the
 * doc's own migration plan calls for keeping it in the codebase, unused, as
 * a same-day rollback if this needs to be reverted.
 *
 * What stays exactly as before, reapplied on top of curve-derived monthly
 * rather than formula-derived monthly:
 *  - seasonalHazards (a live, dynamically-applied multiplier — see the
 *    opts.skipHazards doc comment on deriveDestinationScores for why this
 *    is NOT baked into the fitted curves themselves).
 *  - scoreOverrides (still the highest-precedence "just fix this one
 *    month" escape hatch).
 *  - badges/weatherBand (computeBadges/deriveWeatherBand read the
 *    destination's raw flags directly, never the computed monthly scores,
 *    so they're unaffected by which evaluator produced `monthly`).
 *
 * What's naturally already baked into the fitted curves, needing no
 * special-casing here: `inaccessible` months, the wildlifeClosed floor, and
 * every other hard floor the old formula applied BEFORE hazards — Phase 2's
 * curves were fit from the old formula's own output (with skipHazards:true
 * only), so those floors are already part of each curve's shape.
 *
 * deals/crowds are never fitted curves — they're derived at read time from
 * every other slider's curve (crowdsScore/dealsScore in curve.ts).
 */

const FITTABLE_SLIDERS = SLIDERS.filter((s) => s.key !== 'deals' && s.key !== 'crowds');

function describeAnchors(curve: SliderCurve): string {
  return curve.anchors
    .map((a) => `${a.month}:${a.value}${a.steepness !== undefined ? `(k${a.steepness})` : ''}`)
    .join(', ');
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

export function deriveDestinationScoresFromCurves(d: ScoringDestination): DerivedScores {
  const monthly: Record<string, number[]> = {};
  const explanations: Record<string, string[]> = {};
  SLIDERS.forEach((s) => {
    monthly[s.key] = new Array(12).fill(0);
    explanations[s.key] = new Array(12).fill('');
  });

  // Parse every stored curve once, up front — crowdsScore/dealsScore need
  // every fittable slider's curve at once, not one at a time. A curve that
  // fails to parse is a write-path bug (Phase 1's schema should have
  // rejected it before it was ever persisted) — logged and skipped for
  // just that slider rather than taking down this destination's whole
  // score. parseSliderCurve itself stays strict on purpose (see curve.ts);
  // this try/catch is an application-level resilience choice by this one
  // caller, not the library quietly repairing bad data.
  const parsedCurves: Record<string, SliderCurve> = {};
  for (const s of FITTABLE_SLIDERS) {
    const raw = d.sliderCurves[s.key];
    if (!raw) continue; // N/A at fit time — fitCurve.ts skips N/A sliders entirely
    try {
      parsedCurves[s.key] = parseSliderCurve(raw);
    } catch (err) {
      console.error(`deriveDestinationScoresFromCurves: ${d.id}/${s.key} has an unparseable sliderCurves entry, skipping`, err);
    }
  }

  for (const s of FITTABLE_SLIDERS) {
    const curve = parsedCurves[s.key];
    if (!curve) {
      explanations[s.key] = new Array(12).fill('no curve (N/A slider or unparseable data) → 0');
      continue; // monthly already zero-filled
    }
    for (let m = 1; m <= 12; m++) {
      const v = curveValue(m, curve);
      monthly[s.key][m - 1] = v;
      explanations[s.key][m - 1] = `curve [${describeAnchors(curve)}] → ${round2(v)}`;
    }
  }

  for (let m = 1; m <= 12; m++) {
    const idx = m - 1;
    const crowds = crowdsScore(parsedCurves, d.naSliders, m);
    const deals = dealsScore(parsedCurves, d.naSliders, m);
    monthly.crowds[idx] = crowds;
    monthly.deals[idx] = deals;
    explanations.crowds[idx] = `derived from seasonal deviation across ${Object.keys(parsedCurves).length} sliders → ${round2(crowds)}`;
    explanations.deals[idx] = explanations.crowds[idx];
  }

  // seasonalHazards — identical logic to deriveDestinationScores's own
  // hazard block, operating on curve-derived monthly instead of
  // formula-derived monthly.
  for (let m = 1; m <= 12; m++) {
    const idx = m - 1;
    (d.seasonalHazards || []).forEach((hz) => {
      if (!has(hz.months, m)) return;
      const mult = HAZARD_SLIDER_MULTIPLIER[hz.severity];
      hz.affectedSliders.forEach((key) => {
        if (!monthly[key]) return;
        const before = monthly[key][idx];
        const after = clamp10(before * mult);
        if (after !== before) {
          monthly[key][idx] = after;
          explanations[key][idx] += ` → ${hz.label} (${hz.severity}) ×${mult}, now ${round2(after)}`;
        }
      });
    });
  }

  // scoreOverrides — same highest-precedence behavior as before, applied
  // last so it always wins.
  for (const [key, monthOverrides] of Object.entries(d.scoreOverrides || {})) {
    if (!monthly[key]) continue;
    for (const [monthIdxStr, value] of Object.entries(monthOverrides)) {
      const idx = Number(monthIdxStr);
      if (idx < 0 || idx > 11) continue;
      monthly[key][idx] = clamp10(value);
      explanations[key][idx] = `admin override → ${clamp10(value)}`;
    }
  }

  const badges: Badge[][] = [];
  const weatherBand: string[] = new Array(12);
  for (let m = 1; m <= 12; m++) {
    const idx = m - 1;
    weatherBand[idx] = deriveWeatherBand(d, m);
    badges[idx] = computeBadges(d, m);
  }

  return { monthly, badges, weatherBand, explanations };
}
