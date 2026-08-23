import { SLIDERS } from './constants';
import type { Badge, DerivedScores, ScoringDestination, SliderEvent } from './types';

// Ported verbatim from data.js:131-143, 346-424, 426-516 (legacy app at
// /Users/brendansalant-pearce/Desktop/Claude Code/where-to/data.js).
// NOTE: the legacy `formulaScore()` function (data.js:358-379) was audited
// and confirmed dead code — nothing calls it; deriveDestinationScores has
// its own inline switch with the same logic. Not ported.

export function clamp10(v: number): number {
  return Math.max(0, Math.min(10, v));
}

export function has(arr: number[] | null | undefined, m: number): boolean {
  return Array.isArray(arr) && arr.includes(m);
}

/** Sums each event's weight × that month's intensity (0 if unset) — see the `SliderEvent` doc comment. */
export function sliderEventsBonus(events: SliderEvent[] | undefined, m: number): number {
  if (!events || events.length === 0) return 0;
  return events.reduce((sum, e) => sum + e.weight * (e.months[m] ?? 0), 0);
}

/**
 * True if `key` is a structurally-absent interest for this destination —
 * never a real, plannable reason to visit in any month, as opposed to
 * merely scoring low some months. Hand-reviewed, not auto-derived.
 */
export function isSliderNA(d: ScoringDestination, key: string): boolean {
  return Array.isArray(d.naSliders) && d.naSliders.includes(key);
}

export function deriveWeatherBand(d: ScoringDestination, m: number): string {
  const hot = (d.hot || []).includes(m);
  const cold = (d.cold || []).includes(m);
  switch (d.climate) {
    case 'tropical': return hot ? 'hot' : 'warm';
    case 'desert': return hot ? 'hot' : cold ? 'cool' : 'warm';
    case 'mediterranean': return hot ? 'hot' : cold ? 'cool' : 'warm';
    case 'temperate': return hot ? 'warm' : cold ? 'cold' : 'cool';
    case 'highland': return cold ? 'cold' : 'cool';
    case 'polar': return cold ? 'cold' : 'cool';
    default: return 'warm';
  }
}

// Deliberately universal only — facts relevant to any traveler regardless
// of their specific interests. Interest-specific claims belong in the
// personalized breakdown, not here.
const BADGE_RULES: Array<[keyof ScoringDestination, string, Badge['tone']]> = [
  ['wildlifeClosed', 'Reserve/park closed', 'bad'],
  ['inaccessible', 'Not accessible this month', 'bad'],
  ['swimHazard', 'Storm/hazard risk in the water', 'bad'],
  ['noSnow', 'No snow on the ground', 'bad'],
  ['wet', 'Rainy season', 'bad'],
  ['hot', 'Very hot', 'warn'],
  ['cold', 'Very cold', 'warn'],
  ['dry', 'Dry season', 'good'],
  ['low', 'Low season', 'good'],
];

/**
 * "Peak" isn't one thing — d.peakIntensity ('extreme' | 'moderate' | 'mild')
 * captures whether a peak month is a documented overtourism/price-spike
 * case or just modestly busier than the destination's own rainy season.
 * Absent = 'moderate'. 'mild' isn't flagged at all.
 */
export function peakBadge(d: ScoringDestination, m: number): Badge | null {
  if (!has(d.peak, m)) return null;
  const intensity = d.peakIntensity || 'moderate';
  if (intensity === 'extreme') return { label: 'Peak crowds & prices', tone: 'warn' };
  if (intensity === 'moderate') return { label: 'Higher tourism & prices', tone: 'warn' };
  return null;
}

export function computeBadges(d: ScoringDestination, m: number): Badge[] {
  const out: Badge[] = [];
  BADGE_RULES.forEach(([field, label, tone]) => {
    if (has(d[field] as number[] | undefined, m)) out.push({ label, tone });
  });
  const peak = peakBadge(d, m);
  if (peak) out.push(peak);
  if (d.shopClosures && has(d.low, m)) {
    out.push({ label: 'Some shops, hotels & restaurants closed for the season', tone: 'bad' });
  }
  return out;
}

export function deriveDestinationScores(d: ScoringDestination): DerivedScores {
  const monthly: Record<string, number[]> = {};
  SLIDERS.forEach((s) => (monthly[s.key] = new Array(12).fill(0)));
  const badges: Badge[][] = [];
  const weatherBand: string[] = new Array(12);

  for (let m = 1; m <= 12; m++) {
    const idx = m - 1;
    weatherBand[idx] = deriveWeatherBand(d, m);

    if (has(d.inaccessible, m)) {
      SLIDERS.forEach((s) => (monthly[s.key][idx] = 0));
      badges[idx] = computeBadges(d, m);
      continue;
    }

    // NOTE: legacy code was `d.hikingBest || d.dry` — a plain OR, which in
    // JS only falls back when the field is `undefined`/`null` (an empty
    // array is truthy). That's fine in the legacy data, where an unset
    // field is genuinely absent from the object. Postgres has no
    // "genuinely absent" for a NOT NULL array column — an unset field
    // round-trips as `[]`, which a plain `||` would treat as "explicitly
    // no override" and never fall back, silently breaking every
    // destination that relied on the fallback. `.length` checks instead
    // of `||` preserve the original intent against the new storage shape.
    const hikeBestList = d.hikingBest?.length ? d.hikingBest : d.dry;
    const hikeWorstList = d.hikingWorst?.length
      ? d.hikingWorst
      : [...(d.wet || []), ...(d.hot || []), ...(d.cold || [])];

    SLIDERS.forEach((s) => {
      const base = d.base[s.key];
      let v: number;
      // 'deals'/'crowds' are computed purely from peak/low flags, with no
      // per-destination base value at all — the base-undefined bail-out
      // must not apply to them.
      if (base === undefined && s.formula !== 'deals' && s.formula !== 'crowds') {
        monthly[s.key][idx] = 0;
        return;
      }
      switch (s.formula) {
        case 'sun':
          v = base + (has(d.dry, m) ? 2 : 0) - (has(d.wet, m) ? 4 : 0) - (has(d.hot, m) ? 2 : 0) - (has(d.cold, m) ? 4 : 0);
          break;
        case 'swim':
          v = base + (has(d.dry, m) ? 1 : 0) - (has(d.wet, m) ? 2 : 0) - (has(d.swimHazard, m) ? 5 : 0) - (has(d.cold, m) ? 5 : 0);
          break;
        case 'hiking': {
          // This formula is shared by seven sliders (hiking, scenic,
          // fishing, cycling, adventure, roadtrip, golf), all reading the
          // same hikingBest/hikingWorst flags by default — so unlike
          // birding/wildlife, the events lookup here must be keyed by the
          // specific slider (s.key), not hardcoded, so e.g. `scenic`
          // events don't leak into `hiking`'s score or vice versa.
          const events = d.sliderEvents?.[s.key];
          if (events && events.length > 0) {
            v = Math.round(base + sliderEventsBonus(events, m));
          } else {
            v = base + (has(hikeBestList, m) ? 3 : 0) - (has(hikeWorstList, m) ? 4 : 0);
          }
          break;
        }
        case 'snow':
          v = base + (has(d.cold, m) ? 3 : 0) - (has(d.dry, m) || has(d.hot, m) ? 2 : 0);
          // The +3/-2 swing above assumes every ski destination's summer
          // gets flagged hot/dry — it doesn't, since a ski town's "summer"
          // is still mild by its own climate norms. noSnow is an explicit,
          // hard floor for "there is no snow on the ground this month",
          // independent of whatever weather flags did or didn't get set.
          if (has(d.noSnow, m)) v = 0;
          break;
        case 'culture': {
          // Shared by four sliders (stargazing, museums, architecture,
          // festivals) that mostly don't need this — museums/architecture
          // at world monuments are genuinely flat unless shopClosures
          // already covers a real low-season closure. Festivals and a
          // couple of daylight-driven stargazing cases are the real
          // exceptions, so events are keyed by s.key like the hiking
          // formula, not hardcoded to one slider.
          const events = d.sliderEvents?.[s.key];
          if (events && events.length > 0) {
            v = Math.round(base + sliderEventsBonus(events, m));
          } else {
            v = base + (has(d.dry, m) ? 1 : 0) - (has(d.wet, m) ? 2 : 0) - (d.shopClosures && has(d.low, m) ? 3 : 0);
          }
          break;
        }
        case 'food': {
          // Shared by five sliders (spa, finedining, streetfood, nightlife,
          // winetasting). Most destinations should stay on the legacy
          // peak/shopClosures formula -- a restaurant scene doesn't have a
          // season -- winetasting's harvest bump is the real exception, so
          // events are keyed by s.key like hiking/culture, not hardcoded.
          const events = d.sliderEvents?.[s.key];
          if (events && events.length > 0) {
            v = Math.round(base + sliderEventsBonus(events, m));
          } else {
            v = base + (has(d.peak, m) ? 1 : 0) - (d.shopClosures && has(d.low, m) ? 3 : 0);
          }
          break;
        }
        case 'shopping':
          v = base + (has(d.peak, m) ? 1 : 0) - (d.shopClosures && has(d.low, m) ? 4 : 0);
          break;
        case 'deals':
        case 'crowds':
          // Same peakIntensity tier that drives the badge/blurb text also
          // drives this score, so the number and the words agree.
          if (has(d.peak, m)) {
            const intensity = d.peakIntensity || 'moderate';
            v = intensity === 'extreme' ? 1 : intensity === 'mild' ? 5 : 3;
          } else {
            v = has(d.low, m) ? 9 : 6;
          }
          break;
        case 'birding': {
          // Same multi-tier mechanism as wildlife below — a destination
          // with a real shoulder season or more than one distinct arrival
          // window authors `sliderEvents.birding` instead of the single
          // flat peak-month bonus.
          const events = d.sliderEvents?.birding;
          if (events && events.length > 0) {
            v = Math.round(base + sliderEventsBonus(events, m));
          } else {
            v = base + (has(d.birdingPeak, m) ? 7 : 0) - (has(d.wet, m) && !has(d.birdingPeak, m) ? 1 : 0);
          }
          break;
        }
        case 'wildlife': {
          // Destinations with real multi-tier seasonality (a genuine peak,
          // a shoulder, and possibly a second independently-weighted draw
          // like whales alongside bears) author `sliderEvents.wildlife`
          // instead of the single flat peak-month bonus below — see the
          // `SliderEvent` doc comment in types.ts.
          const events = d.sliderEvents?.wildlife;
          if (events && events.length > 0) {
            v = Math.round(base + sliderEventsBonus(events, m));
          } else {
            v = base + (has(d.wildlifePeak, m) ? 7 : 0) - (has(d.wet, m) && !has(d.wildlifePeak, m) ? 1 : 0);
          }
          if (has(d.wildlifeClosed, m)) v = Math.min(v, 1);
          break;
        }
        default:
          v = base;
      }
      // A destination-specific ceiling — for wildlife/birding especially,
      // the peak-month bonus above is a flat +7 regardless of whether the
      // destination is actually a world-class destination for that
      // interest. Without this, a place with modest, incidental wildlife
      // (a beach island with a few visiting birds) reads identically to
      // Serengeti in its "best" month. Sparse: only authored where a
      // destination's peak would otherwise overstate how good it really
      // is — most destinations need no cap at all.
      const cap = d.sliderCaps?.[s.key];
      if (cap !== undefined) v = Math.min(v, cap);
      monthly[s.key][idx] = clamp10(v);
    });

    if (has(d.wildlifeClosed, m)) {
      monthly.birding[idx] = Math.min(monthly.birding[idx], 3);
    }

    badges[idx] = computeBadges(d, m);
  }

  return { monthly, badges, weatherBand };
}
