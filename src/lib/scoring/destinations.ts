import { SLIDERS } from './constants';
import type { Badge, DerivedScores, ScoringDestination, Severity, SliderEvent } from './types';

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

// Fallback "worst month" penalty for the shared 'hiking'-formula sliders
// (see the 'hiking' case below for the full list), scaled by how severe the
// flagged condition genuinely is — 'moderate' matches the flat -4 this
// formula always used, so an unclassified destination's score is
// unchanged (same zero-regression default as every other severity field).
// 'mild' (Sydney's real 8-17°C July) barely dents it; 'severe' hits
// harder than the old flat rule ever could.
const HIKING_WORST_PENALTY: Record<Severity, number> = { mild: -1.5, moderate: -4, severe: -6.5 };

/**
 * The generic hikingWorst fallback's penalty for month `m` — the worst
 * (most negative) of whichever wet/hot/cold flags apply, each scaled by
 * that category's own severity. A month flagged for more than one reason
 * doesn't stack them (matching the old flat rule, which only ever applied
 * one -4 regardless of how many flags coincided) — it just takes
 * whichever single reason is most severe.
 */
function hikingWorstFallbackPenalty(d: ScoringDestination, m: number): number {
  let worst = 0;
  if (has(d.wet, m)) worst = Math.min(worst, HIKING_WORST_PENALTY[d.wetSeverity || 'moderate']);
  if (has(d.hot, m)) worst = Math.min(worst, HIKING_WORST_PENALTY[d.hotSeverity || 'moderate']);
  if (has(d.cold, m)) worst = Math.min(worst, HIKING_WORST_PENALTY[d.coldSeverity || 'moderate']);
  return worst;
}

/** Sums each event's weight × that month's intensity (0 if unset) — see the `SliderEvent` doc comment. */
export function sliderEventsBonus(events: SliderEvent[] | undefined, m: number): number {
  if (!events || events.length === 0) return 0;
  return events.reduce((sum, e) => sum + e.weight * (e.months[m] ?? 0), 0);
}

// Interests that are always at least nominally possible everywhere, so no
// destination should ever mark them structurally absent — sunbathing can
// be genuinely weak (a cloudy, polar, or otherwise sun-starved place), but
// "sit outside in the sun" is never truly unavailable the way scuba diving
// is in a landlocked desert. Enforced here rather than trusted to content
// authoring, so a future destination can't silently reintroduce this.
const NEVER_NA_SLIDERS = new Set(['sunbathing']);

/**
 * True if `key` is a structurally-absent interest for this destination —
 * never a real, plannable reason to visit in any month, as opposed to
 * merely scoring low some months. Hand-reviewed, not auto-derived.
 */
export function isSliderNA(d: ScoringDestination, key: string): boolean {
  if (NEVER_NA_SLIDERS.has(key)) return false;
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
//
// wet/hot/cold are handled separately below (severityBadge) since their
// tone now depends on how severe the flagged month actually is, not just
// whether the flag is set — a flat rule here couldn't tell Kruger's
// birding-boosting light rain from an actual monsoon.
const BADGE_RULES: Array<[keyof ScoringDestination, string, Badge['tone']]> = [
  ['wildlifeClosed', 'Reserve/park closed', 'bad'],
  ['inaccessible', 'Not accessible this month', 'bad'],
  ['swimHazard', 'Storm/hazard risk in the water', 'bad'],
  ['noSnow', 'No snow on the ground', 'bad'],
  ['dry', 'Dry season', 'good'],
  ['low', 'Low season', 'good'],
];

/**
 * Every flagged month still earns a badge — 'mild' (e.g. Galápagos's light
 * November rain, Kruger's birding-season showers) is real and worth
 * knowing about, just not alarming, so it shows as a soft 'warn' pill
 * rather than being hidden or reading as a red flag. 'moderate' keeps
 * whatever tone this category always used to have, and 'severe' escalates
 * to 'bad' regardless of category — extreme heat is exactly as much a
 * reason to avoid a month as extreme rain, which the old flat
 * hot/cold→'warn' rule couldn't express. Absent severity defaults to
 * 'moderate', matching every other severity default in this file.
 */
function severityBadge(severity: Severity | null, label: string, moderateTone: Badge['tone']): Badge {
  const s = severity || 'moderate';
  if (s === 'severe') return { label, tone: 'bad' };
  if (s === 'moderate') return { label, tone: moderateTone };
  return { label, tone: 'warn' };
}

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
  if (has(d.wet, m)) out.push(severityBadge(d.wetSeverity, 'Rainy season', 'bad'));
  if (has(d.hot, m)) out.push(severityBadge(d.hotSeverity, 'Very hot', 'warn'));
  if (has(d.cold, m)) out.push(severityBadge(d.coldSeverity, 'Very cold', 'warn'));
  BADGE_RULES.forEach(([field, label, tone]) => {
    if (has(d[field] as number[] | undefined, m)) out.push({ label, tone });
  });
  (d.seasonalHazards || []).forEach((hz) => {
    if (has(hz.months, m)) out.push(severityBadge(hz.severity, hz.label, 'warn'));
  });
  const peak = peakBadge(d, m);
  if (peak) out.push(peak);
  if (d.shopClosures && has(d.low, m)) {
    out.push({ label: 'Some shops, hotels & restaurants closed for the season', tone: 'bad' });
  }
  return out;
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

// How much a seasonal hazard multiplies down each of its affectedSliders'
// scores in an active month — 'mild' (e.g. light seaweed) barely dents an
// otherwise-good month, 'severe' (a real hurricane-season swim risk, peak
// smog) makes the affected interest a poor idea even if everything else
// about the destination that month is great.
export const HAZARD_SLIDER_MULTIPLIER: Record<Severity, number> = { mild: 0.85, moderate: 0.6, severe: 0.3 };

/**
 * Narrates a base+terms formula's result — the same shape every non-
 * deals/crowds formula below computes. Purely descriptive: takes the
 * already-computed values, never re-derives them, so it can never disagree
 * with the actual score.
 */
function formatBreakdown(base: number, terms: Array<[string, number]>, rawV: number, cap: number | undefined, finalV: number): string {
  const nonzero = terms.filter(([, v]) => v !== 0);
  const cappedV = cap !== undefined ? Math.min(rawV, cap) : rawV;
  const wasCapped = cap !== undefined && cappedV < rawV;
  const wasClamped = finalV !== round2(cappedV);

  const parts = [`base ${round2(base)}`];
  for (const [label, value] of nonzero) {
    parts.push(`${value > 0 ? '+' : '−'}${round2(Math.abs(value))} ${label}`);
  }
  let out = parts.join(' ');
  if (nonzero.length > 0 || wasCapped || wasClamped) out += ` = ${round2(rawV)}`;
  if (wasCapped) out += ` → capped to ${cap}`;
  if (wasClamped) out += ` → clamped to ${finalV}`;
  if (nonzero.length === 0 && !wasCapped && !wasClamped) out += ' (flat, no seasonal adjustment)';
  return out;
}

export function deriveDestinationScores(d: ScoringDestination, opts?: { skipHazards?: boolean }): DerivedScores {
  const monthly: Record<string, number[]> = {};
  const explanations: Record<string, string[]> = {};
  SLIDERS.forEach((s) => {
    monthly[s.key] = new Array(12).fill(0);
    explanations[s.key] = new Array(12).fill('');
  });
  const badges: Badge[][] = [];
  const weatherBand: string[] = new Array(12);

  for (let m = 1; m <= 12; m++) {
    const idx = m - 1;
    weatherBand[idx] = deriveWeatherBand(d, m);

    if (has(d.inaccessible, m)) {
      SLIDERS.forEach((s) => {
        monthly[s.key][idx] = 0;
        explanations[s.key][idx] = 'inaccessible this month → 0';
      });
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
    // A destination-specific hikingWorst is a deliberate, hand-curated
    // call — kept as a flat penalty, unchanged. Only the generic fallback
    // (no bespoke hikingWorst authored, so it's inheriting the plain
    // weather flags) is severity-aware: reproduces the real Sydney bug,
    // where a single MILD "cold" flag (an 8-17°C winter, not remotely
    // harsh) applied the exact same -4 hit to scenic/hiking-family
    // sliders as a genuinely severe winter would, creating one isolated
    // cliff in an otherwise flat, unrelated month. See HIKING_WORST_PENALTY.
    const hasBespokeWorstList = (d.hikingWorst?.length ?? 0) > 0;
    const hikeWorstList = hasBespokeWorstList
      ? d.hikingWorst
      : [...(d.wet || []), ...(d.hot || []), ...(d.cold || [])];

    SLIDERS.forEach((s) => {
      const base = d.base[s.key];
      let v: number;
      // Populated by every branch below except deals/crowds (which builds
      // customExplanation instead, since it has no base/terms shape at
      // all) — the additive terms that produced v, for the tooltip.
      let terms: Array<[string, number]> = [];
      let customExplanation: string | undefined;
      // 'deals'/'crowds' are computed purely from peak/low flags, with no
      // per-destination base value at all — the base-undefined bail-out
      // must not apply to them.
      if (base === undefined && s.formula !== 'deals' && s.formula !== 'crowds') {
        monthly[s.key][idx] = 0;
        explanations[s.key][idx] = 'no base score authored → 0';
        return;
      }
      switch (s.formula) {
        case 'sun': {
          const dry = has(d.dry, m) ? 2 : 0;
          const wet = has(d.wet, m) ? -4 : 0;
          const hot = has(d.hot, m) ? -2 : 0;
          const cold = has(d.cold, m) ? -4 : 0;
          terms = [['dry', dry], ['wet', wet], ['hot', hot], ['cold', cold]];
          v = base + dry + wet + hot + cold;
          break;
        }
        case 'swim': {
          const dry = has(d.dry, m) ? 1 : 0;
          const wet = has(d.wet, m) ? -2 : 0;
          const hazard = has(d.swimHazard, m) ? -5 : 0;
          const cold = has(d.cold, m) ? -5 : 0;
          terms = [['dry', dry], ['wet', wet], ['swimHazard', hazard], ['cold', cold]];
          v = base + dry + wet + hazard + cold;
          break;
        }
        case 'hiking': {
          // This formula is shared by many sliders (hiking, mountaineering,
          // cyclingRoad, mountainBiking, adventureSports, golf, fishing,
          // horsebackRiding, trailRunning, scenicLandscapes,
          // landscapePhotography, nationalParks, campingBackcountry,
          // geologyVolcanoes, roadtrip), all reading the same
          // hikingBest/hikingWorst flags by default — so the events lookup
          // here must be keyed by the specific slider (s.key), not
          // hardcoded, so e.g. `scenicLandscapes` events don't leak into
          // `hiking`'s score or vice versa.
          const events = d.sliderEvents?.[s.key];
          const worstFallback = () =>
            hasBespokeWorstList ? (has(hikeWorstList, m) ? -4 : 0) : hikingWorstFallbackPenalty(d, m);
          if (events && events.length > 0) {
            const bonus = sliderEventsBonus(events, m);
            terms = events.map((e): [string, number] => [e.label, e.weight * (e.months[m] ?? 0)]);
            // A month with no active event still deserves the plain
            // hikingBest/hikingWorst read a no-events destination would
            // get — otherwise authoring an event for the OTHER months
            // silently exempts every remaining month from ever being
            // flagged good or bad at all (reproduces the same Kruger
            // wildlife/birding bug, here for the shared hiking formula).
            const fallback = bonus <= 0 ? (has(hikeBestList, m) ? 3 : 0) + worstFallback() : 0;
            if (fallback) terms.push(['no active event', fallback]);
            v = Math.round(base + bonus + fallback);
          } else {
            const best = has(hikeBestList, m) ? 3 : 0;
            const worst = worstFallback();
            terms = [['hikingBest', best], ['hikingWorst', worst]];
            v = base + best + worst;
          }
          break;
        }
        case 'snow': {
          // cold is "this month is cold," not "this place has skiable
          // snow" — plenty of cold-flagged destinations (Rome in Jan,
          // Sydney in Jul, Istanbul in Feb...) have zero winter-sports
          // relevance at all. Gating on base>0 stops those from getting a
          // phantom +3 snowsports score in their one cold month; a real
          // ski destination always has a nonzero authored base.
          const cold = base > 0 && has(d.cold, m) ? 3 : 0;
          // The +3/-2 swing above assumes every ski destination's summer
          // gets flagged hot/dry — it doesn't, since a ski town's "summer"
          // is still mild by its own climate norms. noSnow is an explicit,
          // hard floor for "there is no snow on the ground this month",
          // independent of whatever weather flags did or didn't get set.
          const warmth = has(d.dry, m) || has(d.hot, m) ? -2 : 0;
          terms = [['cold', cold], ['dry/hot', warmth]];
          v = base + cold + warmth;
          if (has(d.noSnow, m)) {
            if (v !== 0) terms.push(['noSnow (hard floor)', -v]);
            v = 0;
          }
          break;
        }
        case 'culture': {
          // Shared by many sliders (stargazing, auroraChasing,
          // historyArchaeology, museumsArt, architecture, cityExploration,
          // indigenousCultures, religiousSites, festivals,
          // traditionalCrafts, familyFun, spectatorSports) that mostly
          // don't need this — museums/architecture at world monuments are
          // genuinely flat unless shopClosures already covers a real
          // low-season closure. Festivals and a couple of daylight-driven
          // stargazing cases are the real exceptions, so events are keyed
          // by s.key like the hiking formula, not hardcoded to one slider.
          const events = d.sliderEvents?.[s.key];
          const cultureFallback = () => {
            const dry = has(d.dry, m) ? 1 : 0;
            const wet = has(d.wet, m) ? -2 : 0;
            const closures = d.shopClosures && has(d.low, m) ? -3 : 0;
            return { total: dry + wet + closures, terms: [['dry', dry], ['wet', wet], ['shopClosures+low', closures]] as Array<[string, number]> };
          };
          if (events && events.length > 0) {
            const bonus = sliderEventsBonus(events, m);
            terms = events.map((e): [string, number] => [e.label, e.weight * (e.months[m] ?? 0)]);
            // See the identical hiking-formula comment — a month with no
            // active event still deserves the plain dry/wet/closures read,
            // or authoring an event for OTHER months silently exempts
            // every remaining month from ever being flagged either way.
            const fb = bonus <= 0 ? cultureFallback() : null;
            if (fb && fb.total) terms.push(...fb.terms.filter(([, v]) => v !== 0));
            v = Math.round(base + bonus + (fb?.total ?? 0));
          } else {
            const fb = cultureFallback();
            terms = fb.terms;
            v = base + fb.total;
          }
          break;
        }
        case 'food': {
          // Shared by many sliders (spaWellness, yogaRetreats, fineDining,
          // streetFood, nightlife, wineSpirits, coffeeTea). Most
          // destinations should stay on the legacy peak/shopClosures
          // formula -- a restaurant scene doesn't have a season --
          // wineSpirits' harvest bump is the real exception, so events are
          // keyed by s.key like hiking/culture, not hardcoded.
          const events = d.sliderEvents?.[s.key];
          const foodFallback = () => {
            const peak = has(d.peak, m) ? 1 : 0;
            const closures = d.shopClosures && has(d.low, m) ? -3 : 0;
            return { total: peak + closures, terms: [['peak', peak], ['shopClosures+low', closures]] as Array<[string, number]> };
          };
          if (events && events.length > 0) {
            const bonus = sliderEventsBonus(events, m);
            terms = events.map((e): [string, number] => [e.label, e.weight * (e.months[m] ?? 0)]);
            const fb = bonus <= 0 ? foodFallback() : null;
            if (fb && fb.total) terms.push(...fb.terms.filter(([, v]) => v !== 0));
            v = Math.round(base + bonus + (fb?.total ?? 0));
          } else {
            const fb = foodFallback();
            terms = fb.terms;
            v = base + fb.total;
          }
          break;
        }
        case 'shopping': {
          const peak = has(d.peak, m) ? 1 : 0;
          const closures = d.shopClosures && has(d.low, m) ? -4 : 0;
          terms = [['peak', peak], ['shopClosures+low', closures]];
          v = base + peak + closures;
          break;
        }
        case 'deals':
        case 'crowds': {
          // Same peakIntensity tier that drives the badge/blurb text also
          // drives this score, so the number and the words agree.
          let reason: string;
          if (has(d.peak, m)) {
            const intensity = d.peakIntensity || 'moderate';
            v = intensity === 'extreme' ? 1 : intensity === 'mild' ? 5 : 3;
            reason = `peak month, ${intensity} intensity → ${v}`;
          } else {
            v = has(d.low, m) ? 9 : 6;
            reason = has(d.low, m) ? `low season → ${v}` : `typical (no peak/low flag) → ${v}`;
          }
          // An absolute floor/ceiling for destinations that are
          // chronically over- or under-touristed, independent of their
          // own peak/low swing — Ethiopia's "peak" month still isn't
          // remotely as crowded as anywhere's peak in the French
          // Riviera, and NYC's quietest month never really thins out.
          // This deliberately overrides peakIntensity's contribution
          // above rather than blending with it: once a destination is
          // flagged chronically quiet or chronically busy, its own
          // peak/low swing stops being the relevant signal.
          const preOverride = v;
          if (d.crowdBaseline === 'low') v = Math.max(v, has(d.peak, m) ? 8 : 10);
          if (d.crowdBaseline === 'high') v = Math.min(v, has(d.peak, m) ? 2 : 5);
          if (v !== preOverride) reason += ` → crowdBaseline (${d.crowdBaseline}) floor/ceiling, now ${v}`;
          customExplanation = reason;
          break;
        }
        case 'birding': {
          // Same multi-tier mechanism as wildlife below — a destination
          // with a real shoulder season or more than one distinct arrival
          // window authors `sliderEvents.birding` instead of the single
          // flat peak-month bonus.
          const events = d.sliderEvents?.birding;
          if (events && events.length > 0) {
            const bonus = sliderEventsBonus(events, m);
            terms = events.map((e): [string, number] => [e.label, e.weight * (e.months[m] ?? 0)]);
            // The plain fallback below already docks a wet month with no
            // peak flag — an authored event covering SOME months
            // shouldn't silently exempt every other month from that same
            // real penalty. Reproduces the Kruger case: outside its
            // Nov-Mar migrant-arrival event, wet months got zero
            // downside at all, keeping the score flatly "excellent" even
            // in months where nothing is actually boosting it.
            const wetFallback = bonus <= 0 && has(d.wet, m) ? -1 : 0;
            if (wetFallback) terms.push(['wet (no active event)', wetFallback]);
            v = Math.round(base + bonus + wetFallback);
          } else {
            const peak = has(d.birdingPeak, m) ? 7 : 0;
            const wet = has(d.wet, m) && !has(d.birdingPeak, m) ? -1 : 0;
            terms = [['birdingPeak', peak], ['wet (no peak)', wet]];
            v = base + peak + wet;
          }
          break;
        }
        case 'wildlife': {
          // Shared by four sliders (wildlifeViewing, safari, whaleWatching,
          // wildflowerBlooms) — like hiking/culture/food above, the events
          // lookup must be keyed by the specific slider (s.key), not
          // hardcoded, so e.g. `whaleWatching` events don't leak into
          // `safari`'s score or vice versa. Destinations with real
          // multi-tier seasonality (a genuine peak, a shoulder, and
          // possibly a second independently-weighted draw like whales
          // alongside bears) author `sliderEvents[s.key]` instead of the
          // single flat peak-month bonus below — see the `SliderEvent` doc
          // comment in types.ts.
          const events = d.sliderEvents?.[s.key];
          if (events && events.length > 0) {
            const bonus = sliderEventsBonus(events, m);
            terms = events.map((e): [string, number] => [e.label, e.weight * (e.months[m] ?? 0)]);
            // See the identical comment on the birding case above — a
            // month with no active event still deserves the same wet
            // penalty a plain (no-events) destination would get, e.g.
            // Kruger's animals genuinely are harder to spot once they
            // disperse from dry-season waterholes.
            const wetFallback = bonus <= 0 && has(d.wet, m) ? -1 : 0;
            if (wetFallback) terms.push(['wet (no active event)', wetFallback]);
            v = Math.round(base + bonus + wetFallback);
          } else {
            const peak = has(d.wildlifePeak, m) ? 7 : 0;
            const wet = has(d.wet, m) && !has(d.wildlifePeak, m) ? -1 : 0;
            terms = [['wildlifePeak', peak], ['wet (no peak)', wet]];
            v = base + peak + wet;
          }
          if (has(d.wildlifeClosed, m)) {
            const before = v;
            v = Math.min(v, 1);
            if (v !== before) terms.push(['wildlifeClosed floor', v - before]);
          }
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
      const rawV = v;
      if (cap !== undefined) v = Math.min(v, cap);
      const finalV = clamp10(v);
      monthly[s.key][idx] = finalV;
      explanations[s.key][idx] = customExplanation ?? formatBreakdown(base, terms, rawV, cap, finalV);
    });

    if (has(d.wildlifeClosed, m)) {
      const before = monthly.birding[idx];
      monthly.birding[idx] = Math.min(monthly.birding[idx], 3);
      if (monthly.birding[idx] !== before) {
        explanations.birding[idx] += ` → wildlifeClosed floor, now ${monthly.birding[idx]}`;
      }
    }

    // seasonalHazards only penalize the sliders they actually name
    // (affectedSliders) — a hurricane risk should drag down swimming and
    // sailing without also dragging down museums, unlike the blanket
    // wet/hot/cold flags above which affect the general weather-comfort
    // read for every interest.
    //
    // opts.skipHazards exists for curve-fitting only (scoring/fitCurve.ts):
    // a fitted SliderCurve is a static snapshot, but hazards are meant to
    // stay a live, dynamically-reapplied mechanism (see "Unchanged" in
    // docs/scoring-v2-proposal.html section 04) — baking a hazard's effect
    // into the curve's anchors would apply it twice once curve-based
    // scoring reapplies it on top, and would freeze it at fit-time even if
    // the hazard's months/severity are edited later. Fitting against the
    // pre-hazard monthly values (this flag) and reapplying hazards
    // dynamically in the curve-based evaluator keeps the two mechanisms
    // doing exactly one job each, matching today's live formula's own
    // separation between "the slider's shape" and "a cross-cutting risk."
    if (!opts?.skipHazards) {
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

    badges[idx] = computeBadges(d, m);
  }

  // scoreOverrides is the highest-precedence source in the whole
  // function — an admin-set exact value for one slider/month, applied
  // after every other adjustment above (including the inaccessible
  // early-fill, sliderCaps, the wildlifeClosed floor, and seasonalHazards)
  // so it always wins rather than being silently reprocessed by one of
  // those. See the ScoringDestination.scoreOverrides doc comment.
  for (const [key, monthOverrides] of Object.entries(d.scoreOverrides || {})) {
    if (!monthly[key]) continue;
    for (const [monthIdxStr, value] of Object.entries(monthOverrides)) {
      const idx = Number(monthIdxStr);
      if (idx < 0 || idx > 11) continue;
      monthly[key][idx] = clamp10(value);
      explanations[key][idx] = `admin override → ${clamp10(value)}`;
    }
  }

  return { monthly, badges, weatherBand, explanations };
}
