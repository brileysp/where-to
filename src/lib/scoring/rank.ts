import { BAND_DIMENSIONS, NEUTRAL_WEIGHT, SLIDERS } from './constants';
import { deriveWeatherBand, has, isSliderNA } from './destinations';
import { seasonPosition } from './blurb';
import type { AudienceTier, ScoredDestination, ScoringDestination, Severity } from './types';
import { INTEREST_THRESHOLDS, DEFAULT_THRESHOLD } from './interestThresholds';

// Ported from app.js:127-193,728-733 (legacy app at
// /Users/brendansalant-pearce/Desktop/Claude Code/where-to/app.js),
// retyped to take explicit params instead of reading a global `state`
// object — a retype, not a redesign; the math is unchanged.

export type SelectedBands = Record<string, string[]>;
// Slider key -> the sub-style pills currently scoped for it (e.g.
// { cyclingRoad: ['mountainBiking', 'gravelRiding'] }) — see earnedStyles/
// selectedStyles in db/schema.ts and DOMAIN_CORE_AXES in lib/dna/domains.ts.
export type SelectedStyles = Record<string, string[]>;

// How much a destination's slider score counts when scoped to a
// selected style: 'signature' is a full match, 'none' is a destination
// we've explicitly researched and confirmed is a poor fit for that
// style — a real but soft penalty (not near-zero), since even a
// genuinely opposite destination usually isn't a total non-starter for
// one interest among many. Untagged/unauthored destinations are handled
// separately in styleAdjustedScore and never fall through to this map —
// "we haven't researched this yet" and "we researched it and it's a
// poor fit" are different claims and shouldn't score the same.
const TIER_MULTIPLIERS: Record<'signature' | 'strong' | 'casual' | 'none', number> = {
  signature: 1,
  strong: 0.8,
  casual: 0.5,
  none: 0.3,
};

/**
 * The slider score to use for one destination/slider/month, scoped to
 * whichever sub-style pills are currently selected. With no selection,
 * or no tier data at all for this destination/slider (the destination
 * has never been authored for this slider — most destinations, for most
 * sliders, at any given time), this is just the raw monthly score,
 * unchanged — an unresearched destination reads as neutral, not as a
 * confirmed mismatch, matching isSliderNA's existing non-punitive
 * precedent. The TIER_MULTIPLIERS penalty only applies once a
 * destination has actually been authored for this slider and some of
 * its styles came back 'none' — a real claim, not an absence of one.
 * When multiple styles are selected, the BEST-matching one wins (max,
 * not average) — a destination signature for one of several loved
 * styles shouldn't be dragged down by being merely casual at another.
 */
export function styleAdjustedScore(
  dest: ScoredDestination,
  sliderKey: string,
  monthIdx: number,
  selectedStyles?: SelectedStyles,
): number {
  const raw = dest.monthly[sliderKey][monthIdx];
  const selected = selectedStyles?.[sliderKey];
  if (!selected || !selected.length) return raw;
  const tiers = dest.activityStyleTiers[sliderKey];
  if (!tiers) return raw;
  const multiplier = Math.max(...selected.map((styleKey) => TIER_MULTIPLIERS[tiers[styleKey] ?? 'none']));
  return raw * multiplier;
}

export function bandPenalty(dest: ScoredDestination, monthIdx: number, selectedBands: SelectedBands): number {
  let mult = 1;
  BAND_DIMENSIONS.forEach((dim) => {
    const selected = selectedBands[dim.key] || [];
    if (selected.length >= dim.bands.length) return; // no constraint set
    const match =
      dim.key === 'weather'
        ? selected.includes(dest.weatherBand[monthIdx])
        : ((dest as unknown as Record<string, string[]>)[dim.key + 'Bands'] || []).some((b) => selected.includes(b));
    if (!match) mult *= 0.5;
  });
  return mult;
}

// How sharply an interest's say falls off as the traveller cares about it
// less, in the specialist read below. An interest weighted w against a top
// interest of wMax counts for (w/wMax) ** this. At 2, something you weight
// a third as highly gets a ninth of the say — which is what makes a weak
// score on a peripheral interest a rounding error and a weak score on your
// #1 a deal-breaker.
//
// Fitted against a real profile (cycling, hiking, fishing, kayaking,
// running, wildlife, scenery all at 9; golf at 3), swinging golf 10 -> 0:
//
//   falloff   casual golfer   dedicated golfer
//     1.0         -6%              -54%
//     2.0         -3%              -74%   <- chosen
//     3.0         -2%              -85%
//
// For comparison, the ordinal rank decay this replaced cost the CASUAL
// golfer 31%. Every value above fixes that; 2 is the balance where a
// peripheral weakness is genuinely negligible while a weakness in the
// traveller's whole reason for travelling is disqualifying. The ranking
// assertions do not discriminate between these values (all give 33/35),
// so this is chosen on the behaviour above, not fitted to the suite.
const PRIORITY_FALLOFF = 2;
// How much the blend leans toward the rank-decayed specialist read vs.
// the flat broad average — deliberately specialist-dominant: matching a
// traveler's clearest few priorities well matters far more than being
// broadly decent at everything they weighted, even lightly. The broad
// average still gets real say (25%) so a destination that's a perfect
// match for #1 and dead weight on literally everything else doesn't read
// as a flawless trip.
const TOP_SCORE_BOOST_WEIGHT = 0.75;

// Its own constant, not PRIORITY_FALLOFF, because it answers a different
// question: PRIORITY_FALLOFF scales a USER's stated priorities, this ranks
// a DESTINATION's own strengths.
//
// Fitted twice — and the right answer CHANGED when the content did, which
// is the part worth remembering.
//
// First sweep, before the zero-triage: a gentler decay counts more
// interests, and back then ~3,300 (destination, interest) pairs were
// unauthored zeros rather than explicit N/A, so counting more interests
// meant counting more phantom zeros. Coverage bias climbed through the
// limit and steeper won:
//
//   decay   r(authored, score)   assertions      (PRE-TRIAGE)
//   0.50          0.182            22/28
//   0.75          0.384            20/28   <- broke the coverage limit
//
// After the triage, N/A interests are excluded from the contribution list
// entirely instead of landing as zeros, so rewarding breadth is finally
// safe — and the same sweep inverts:
//
//   decay   r(authored, score)   assertions      (POST-TRIAGE)
//   0.50          0.234            29/35
//   0.60          0.261            29/35
//   0.70          0.298            31/35   <- best
//   0.80          0.348            30/35   <- coverage bias back at the line
//
// 0.70 spreads credit over roughly the top eight interests, which is what
// broad appeal actually means: several real draws, not one. It also
// decompresses the scale — at 0.50 the single best interest was half the
// entire score, so every destination holding one iconic-signature claim
// piled against the same ceiling and a one-point content edit could move a
// place 45 ranks (Tanzania's scenery, measured).
//
// The lesson to keep: this constant is not independent of content quality.
// Re-run the sweep after any large authoring pass rather than trusting the
// number.
const DEFAULT_APPEAL_DECAY = 0.7;

// What each interest's audienceTier is worth when nobody has stated a
// preference — see the AudienceTier doc comment in types.ts.
export const AUDIENCE_WEIGHT: Record<AudienceTier, number> = {
  iconic: 1,
  popular: 0.7,
  enthusiast: 0.4,
  specialist: 0.15,
};

/**
 * How much of an interest's audience weight a destination actually earns.
 *
 * audienceTier answers "do lots of people travel for this?" — a property
 * of the INTEREST. On its own it was applied at full strength to every
 * destination scoring anything at all, so a pleasant-but-incidental park
 * drew the same iconic-tier amplification as Yellowstone. That put
 * Colombian Caribbean second in the default ranking on the strength of
 * Tayrona. The interest is iconic; that destination's claim on it is not.
 *
 * This is the missing second factor: is this place notable FOR the thing.
 *
 * The spread is wide on purpose, and that is a departure from how the
 * same field is weighted elsewhere. Iconic amplification is EARNED, not
 * given: only a genuine reference point for an interest draws its full
 * audience weight. A real but non-defining draw takes a clear majority
 * discount, not a token one — a first attempt at 0.85 for 'strong' left
 * Colombian Caribbean 5th on four mid-pack iconic claims, because a 15%
 * haircut on four interests is not a gate.
 */
export const SIGNATURE_WEIGHT: Record<'signature' | 'strong' | 'casual' | 'none', number> = {
  signature: 1,
  strong: 0.6,
  casual: 0.25,
  none: 0.1,
};

/**
 * An authored signatureTier if there is one, otherwise one derived from
 * where this score sits among destinations authored for the same interest
 * (see interestThresholds.ts).
 *
 * Derived values are never written to the database. Authored claims are
 * editorial statements and stay authoritative; deriving at read time keeps
 * provenance structural rather than a flag, needs no schema change, and
 * keeps synthetic values out of the content and the audit trail. Coverage
 * is the reason this exists at all: only 12% of authored scores carry a
 * tier, and 82% of scores on ICONIC interests — the ones with the most
 * leverage — have none.
 */
export function effectiveSignatureTier(
  dest: ScoringDestination,
  key: string,
  score: number,
): 'signature' | 'strong' | 'casual' | 'none' {
  const authored = dest.signatureTier?.[key];
  if (authored) return authored;
  const t = INTEREST_THRESHOLDS[key] ?? DEFAULT_THRESHOLD;
  if (score >= t.signature) return 'signature';
  if (score >= t.strong) return 'strong';
  if (score >= t.casual) return 'casual';
  return 'none';
}

/**
 * The no-stated-preference score: how appealing is this destination to a
 * traveller who hasn't told us anything yet (ResultsApp opens with
 * `weights = {}`).
 *
 * This ranks a destination by its OWN strongest draws — audience-weighted
 * — rather than averaging it across all 53 interests. The average was the
 * bug: it divided by every eligible slider, so an unauthored or absent
 * interest landed as a zero in the numerator while still counting in the
 * denominator, making "great at a few things" indistinguishable from
 * "poorly documented." Measured against real data before this change,
 * default score correlated with a destination's authored-slider count at
 * r = 0.730 — the ranking was substantially reporting how much content had
 * been written, not how appealing a place is. Yellowstone sat 123rd of
 * 200, Rome 86th, and no destination scored above 5.2/10, so matchLabel()
 * called every place in the catalogue a Weak or Poor match.
 *
 * Absence has to be free: Paris having no wildlife and Yellowstone having
 * no food scene are not defects, they're just what those places aren't.
 * Sorting by contribution and decaying by rank makes a missing interest
 * cost nothing (it sorts to the bottom, where the decay weight is ~0)
 * while genuine strengths dominate.
 *
 * Deliberately NOT the same shape as the weighted path below. There, rank
 * decay runs over the USER's priority order, which is right once someone
 * has said what they want. A general audience has no single priority
 * order — it's a distribution of travellers who'd each pick a place for
 * different reasons — so the ranking has to run over what the destination
 * is actually good at, with audienceTier capping how much credit a niche
 * strength can earn. That cap is what stops Churchill (a 10 for polar
 * bears, a 9 for aurora) from reading as broadly appealing.
 */
function defaultAppealScore(
  dest: ScoredDestination,
  monthIdx: number,
  selectedStyles?: SelectedStyles,
): number {
  const contributions = SLIDERS.filter((s) => !isSliderNA(dest, s.key))
    .map((s) => {
      const score = styleAdjustedScore(dest, s.key, monthIdx, selectedStyles);
      const tier = effectiveSignatureTier(dest, s.key, score);
      return AUDIENCE_WEIGHT[s.audienceTier] * SIGNATURE_WEIGHT[tier] * score;
    })
    .sort((a, b) => b - a);
  let weightSum = 0;
  let total = 0;
  contributions.forEach((c, i) => {
    const w = DEFAULT_APPEAL_DECAY ** i;
    weightSum += w;
    total += w * c;
  });
  return weightSum === 0 ? 0 : total / weightSum;
}

// The noise floor for stated priorities. Every persona names a handful of interests and
// leaves the rest (38 of 54 for the Naturalist) at NEUTRAL_WEIGHT, and a user who nudges one
// slider leaves the others wherever they were. Left in, that tail is not harmless: each
// neutral interest is small but there are dozens, so together they held ~28% of the
// specialist read and over half of the broad average. Measured on the Naturalist in May, the
// neutrals rewarded Canary Islands for being decent at everything the traveller never asked
// about (4.7 average on interests they hold at 2) and punished Malaysian Borneo for the blanks
// (2.6), so Canary Islands ranked #1 (6.3) on a wildlife-first profile with wildlife at 4,
// while Borneo, a strong match on all three of the top interests, sat 4th at 6.0.
//
// Two rules. (1) Anything at or below PASSING_MENTION_WEIGHT (3) counts for nothing: 2 is the
// "never asked" baseline, and 3 is a passing mention. (2) Relative to the user's own top weight,
// an interest at or below FLOOR_LOW of it counts for nothing, one at or above FLOOR_HIGH counts
// in full, and in between it ramps
// linearly so a slider nudged across the line does not flip a ranking. The relative rule
// behaves the same for a persona (top weight 9) and a user who tops out at 6, and anyone who
// weights many interests about equally (all ratios near 1) is untouched.
export const WEIGHT_FLOOR_LOW = 0.3;
export const WEIGHT_FLOOR_HIGH = 0.5;
// A stated weight this far above the neutral baseline or less is "a passing mention", not a
// priority, whatever the user's top weight is. Raised from the neutral 2 itself after the first
// version left 3s counting at half strength against a top weight of 10 (30% of it): fifty-odd
// interests at 3 held 42% of the specialist read and 76% of the broad average, so a profile of
// "cycling 10, scenery 8, nothing else above 3" still ranked mostly on the 3s.
export const PASSING_MENTION_WEIGHT = NEUTRAL_WEIGHT + 1;

// Hidden sliders (nationalParks, familyFun, spectatorSports) are not shown in the picker, so a
// weight sitting on one can only be persona residue the user can neither see nor change. The
// Naturalist and Active personas carried nationalParks at 7: a profile of "cycling 10, scenery 8,
// everything visible else at 2" ranked Nepal (national parks 8) 17th at 7.7 and Andalucia
// (national parks 0) 25th at 7.3, on an interest the user could not see. Those weights count
// for nothing here, and are also left out of the "top weight" the ramp is measured against.
const HIDDEN_SLIDER_KEYS = new Set(SLIDERS.filter((s) => s.hidden).map((s) => s.key));

export function effectiveWeights(weights: Record<string, number>): Record<string, number> {
  const max = Math.max(0, ...Object.entries(weights).filter(([k]) => !HIDDEN_SLIDER_KEYS.has(k)).map(([, w]) => w));
  if (max <= 0) return weights;
  const out: Record<string, number> = {};
  for (const [key, w] of Object.entries(weights)) {
    if (HIDDEN_SLIDER_KEYS.has(key)) { out[key] = 0; continue; }
    if (w <= PASSING_MENTION_WEIGHT) { out[key] = 0; continue; }
    const ratio = w / max;
    const factor = Math.min(1, Math.max(0, (ratio - WEIGHT_FLOOR_LOW) / (WEIGHT_FLOOR_HIGH - WEIGHT_FLOOR_LOW)));
    out[key] = w * factor;
  }
  return out;
}

/**
 * A pure weighted average over ALL weighted sliders rewards being broadly
 * decent proportional to weight, but doesn't specially reward EXCELLING at
 * whichever handful of things the user cares about most. Blending in a
 * second average — computed over every weighted slider, but weighted by
 * PRIORITY (see PRIORITY_FALLOFF) rather than raw weight — breaks ties in favor of
 * the specialist match and concentrates credit on the traveler's clearest
 * priorities specifically, not just "whatever has a high weight number."
 */
export function scoreForMonth(
  dest: ScoredDestination,
  stated: Record<string, number>,
  monthIdx: number,
  selectedBands: SelectedBands,
  selectedStyles?: SelectedStyles,
): number {
  // Everything below reads the floored weights, never the raw ones (see effectiveWeights).
  const weights = effectiveWeights(stated);
  const scoreFor = (key: string) => styleAdjustedScore(dest, key, monthIdx, selectedStyles);

  // N/A sliders (isSliderNA) never count toward the BROAD average, in
  // either direction — that average's job is measuring breadth across
  // everything the caller weighted, and a structurally-absent interest
  // shouldn't count against breadth (a persona/profile that happens to
  // weight e.g. diving highly shouldn't have an otherwise broadly
  // excellent destination dragged down just because diving is marked
  // not-applicable there). Same rule timingScoreForMonth already follows.
  const eligible = SLIDERS.filter((s) => !isSliderNA(dest, s.key));

  const tw = eligible.reduce((s, c) => s + (weights[c.key] || 0), 0);
  if (tw === 0) {
    return defaultAppealScore(dest, monthIdx, selectedStyles) * bandPenalty(dest, monthIdx, selectedBands);
  }

  const broadAvg = eligible.reduce((s, c) => s + (weights[c.key] || 0) * scoreFor(c.key), 0) / tw;

  // The rank-decayed SPECIALIST average below treats N/A differently:
  // it's a real 0, not excluded — and unlike `eligible` above, an N/A
  // slider still occupies its normal rank/weight slot here. That average
  // already has a built-in sense of how exclusive a priority is, via
  // rank-decay and tie-splitting (see the comment below), so scoring N/A
  // at 0 costs an interest exactly the specialist credit it would have
  // won had it scored well: everything, if it's the caller's undisputed
  // #1 priority; a fraction, if tied with others at the top; almost
  // nothing, if it's a minor weighted interest far down the list. This is
  // what separates "lacks one of several co-equal top priorities" (a
  // modest discount, since the tied co-priorities still carry most of the
  // specialist credit) from "lacks THE dominant priority" (a severe one,
  // since nothing else was sharing that top rank slot) — see the two
  // 'scoreForMonth — N/A sliders' tests below for both cases.
  const specialistScoreFor = (key: string) => (isSliderNA(dest, key) ? 0 : scoreFor(key));
  const rankedSliders = SLIDERS.filter((s) => (weights[s.key] || 0) > 0).sort(
    (a, b) => (weights[b.key] || 0) - (weights[a.key] || 0),
  );
  // Priority weight falls off with how much LESS you care, measured
  // against your top interest — not with ordinal rank position.
  //
  // This replaced a dense-rank decay (RANK_DECAY ** rank, split across
  // ties) that had a perverse failure. Ranking is ordinal, so weight 9 and
  // weight 3 were "rank 0 and rank 1" — neighbours — despite an enormous
  // real gap. And the tie-split divided a rank's weight among everything
  // sitting at it, so a cluster of interests you love was diluted while a
  // single thing you barely care about kept its rank weight whole:
  //
  //   seven interests tied at 9 -> 0.5^0 / 7 = 0.143 each
  //   golf, alone at 3          -> 0.5^1 / 1 = 0.500
  //
  // Golf drew 3.5x the pull of any single interest the traveller actually
  // loved, and a third of this read. Measured on a real profile (cycling,
  // hiking, fishing, kayaking, running, wildlife, scenery all at 9, golf
  // at 3), dropping golf from 10 to 0 cost Queenstown 31% of its score.
  // Loving many things diluted each of them; loving one thing barely did.
  //
  // Proportional decay has no ties to split and no ordinal cliff: equal
  // weights get equal say for free, and the exponent controls how sharply
  // a lesser interest fades. It preserves what the rank decay was for —
  // the traveller's clearest priorities still dominate, so a destination
  // is not dragged down by interests they only mildly hold — while making
  // a weakness cost roughly what the traveller says it is worth. The
  // deal-breaker/rounding-error asymmetry falls out of the arithmetic
  // rather than being imposed by rank position.
  const maxWeight = Math.max(...rankedSliders.map((s) => weights[s.key] || 0));
  const priorityWeights = rankedSliders.map((s) => ((weights[s.key] || 0) / maxWeight) ** PRIORITY_FALLOFF);
  const priorityWeightSum = priorityWeights.reduce((s, w) => s + w, 0);
  const topAvg = rankedSliders.reduce((s, c, i) => s + priorityWeights[i] * specialistScoreFor(c.key), 0) / priorityWeightSum;

  const blended = broadAvg * (1 - TOP_SCORE_BOOST_WEIGHT) + topAvg * TOP_SCORE_BOOST_WEIGHT;
  return blended * bandPenalty(dest, monthIdx, selectedBands);
}

// Weather-band midpoints for the timing score's comfort baseline — warm
// and dry reads best, cold or wet reads worst. Deliberately coarse (four
// bands, two flags) since this only needs to answer "is this a pleasant
// month," not model real climatology.
const COMFORT_BAND_BASE: Record<string, number> = { cold: 3, cool: 7, warm: 9, hot: 6 };

// Extra penalty layered on top of the band baseline above, scaled by how
// severe the flagged month genuinely is (see the Severity doc comment in
// types.ts). Unset severity defaults to 'moderate' — chosen so an
// un-reviewed destination scores exactly as it did before this field
// existed: wet's 'moderate' value (-3) matches wet's old flat penalty,
// and hot/cold's 'moderate' value (0) matches their old lack of any
// separate penalty (the band baseline already accounts for typical
// hot/cold weather; only a hand-classified 'severe' month goes further).
const WET_SEVERITY_PENALTY: Record<string, number> = { mild: -1, moderate: -3, severe: -5 };
const HOT_SEVERITY_PENALTY: Record<string, number> = { mild: 0, moderate: 0, severe: -3 };
const COLD_SEVERITY_PENALTY: Record<string, number> = { mild: 0, moderate: 0, severe: -3 };

// How much of a flag's full penalty/bonus applies at each position within
// its contiguous run of months — reusing seasonPosition (blurb.ts) rather
// than re-deriving "where in this season" a second way. A season doesn't
// snap on/off: real weather ramps in at the edges and is most intense in
// the middle, so "the start of" a 5-month wet season should read milder
// than "the heart of" it, even though both months share the same `wet`
// flag. Without this, every month sharing one flag scored identically —
// the flat, obviously-fake multi-month plateau on the About tab's chart
// (e.g. a whole May-Nov block reading as one repeated value). 1 for a
// null position (a single-month "season", or one so long — 12/12 months —
// that "position within it" is meaningless).
const SEASON_POSITION_TAPER: Record<string, number> = {
  'the only month of': 1,
  'the start of': 0.55,
  'the tail end of': 0.55,
  'early in': 0.8,
  'late in': 0.8,
  'the heart of': 1,
};
function seasonTaper(arr: number[] | null | undefined, m: number): number {
  const pos = seasonPosition(arr, m);
  return pos ? SEASON_POSITION_TAPER[pos] : 1;
}

// Small stable (not random-per-render) per-destination/per-month nudge —
// tapering alone still leaves ties within a run (a 7-month block's two
// "early" months taper identically, for instance). This guarantees every
// month reads as numerically distinct, matching how real weather never
// actually holds two different months at the exact same value, without
// touching the personalized per-slider scores (deriveDestinationScores) —
// scoped to this general/"independent of you" comfort read alone.
// `amplitude` widens the range for exceptionPeak below, whose own source
// data (a flat birding/wildlife baseline with no authored peak) needs a
// visibly larger nudge than comfort's already-tapered curve to read as
// distinct on the chart.
function monthTexture(seed: string, m: number, amplitude = 0.3): number {
  let h = 0;
  const key = `${seed}:${m}`;
  for (let i = 0; i < key.length; i++) h = (h * 31 + key.charCodeAt(i)) | 0;
  // A plain polynomial fold leaves consecutive months (whose seed differs
  // by only one trailing digit) nearly linearly related — e.g. -0.08,
  // -0.09, -0.10, -0.11 — which reads as a smooth ramp, not the scatter
  // real month-to-month weather actually has. This finalizer (the
  // "triple32" integer hash: xorshift + multiply, twice) avalanches that
  // small input difference into an uncorrelated output.
  h ^= h >>> 16;
  h = Math.imul(h, 0x45d9f3b);
  h ^= h >>> 16;
  h = Math.imul(h, 0x45d9f3b);
  h ^= h >>> 16;
  return ((Math.abs(h) % 2001) - 1000) * (amplitude / 1000); // -amplitude .. +amplitude
}

/**
 * The default component of timingScoreForMonth: for most destinations,
 * most months, "is this generally a good time to go" really is just "is
 * the weather pleasant" (mild-to-warm, dry). See timingScoreForMonth for
 * the exceptions layered on top of this.
 */
// seasonalHazards feed a real penalty into the affected sliders'
// personalized scores (deriveDestinationScores), but were never wired
// into the GENERAL comfort read at all — a data-quality audit found this
// directly: a "Peak hurricane season" or "Peak smog season" badge (tone
// 'bad') sat right next to a general "Excellent" score, at Havana, Belize,
// Riviera Maya, Punta Cana, and Rajasthan, since nothing here ever
// checked seasonalHazards. Only 'storm' and 'airQuality' feed this —
// both are genuine reasons to reconsider the WHOLE trip (safety,
// disrupted plans, air quality affecting every outdoor activity), unlike
// 'insects'/'seaweed', which are real but narrowly scoped nuisances that
// shouldn't tank a month's overall "is this a good time to visit" read.
const HAZARD_COMFORT_PENALTY: Record<Severity, number> = { mild: -0.5, moderate: -2, severe: -4 };
const GENERAL_IMPACT_HAZARD_CATEGORIES = new Set(['storm', 'airQuality']);

export function weatherComfortScore(dest: ScoringDestination, monthIdx: number): number {
  const m = monthIdx + 1;
  const band = deriveWeatherBand(dest, m);
  let v = COMFORT_BAND_BASE[band] ?? 6;
  if (has(dest.wet, m)) v += WET_SEVERITY_PENALTY[dest.wetSeverity || 'moderate'] * seasonTaper(dest.wet, m);
  if (has(dest.hot, m)) v += HOT_SEVERITY_PENALTY[dest.hotSeverity || 'moderate'] * seasonTaper(dest.hot, m);
  if (has(dest.cold, m)) v += COLD_SEVERITY_PENALTY[dest.coldSeverity || 'moderate'] * seasonTaper(dest.cold, m);
  if (has(dest.dry, m)) v += 0.5 * seasonTaper(dest.dry, m);
  const hazardPenalty = (dest.seasonalHazards || [])
    .filter((hz) => GENERAL_IMPACT_HAZARD_CATEGORIES.has(hz.category) && has(hz.months, m))
    .reduce((worst, hz) => Math.min(worst, HAZARD_COMFORT_PENALTY[hz.severity]), 0);
  v += hazardPenalty;
  v += monthTexture(dest.id, m);
  return Math.max(0, Math.min(10, v));
}

// Formulas whose whole point is a specific, curated reason to visit that
// doesn't track comfortable weather — skiing peaks in cold (the opposite
// of what weatherComfortScore rewards), and birding/wildlife peaks are
// about where the animals are, not the forecast.
const COMFORT_INDEPENDENT_FORMULAS = new Set(['snow', 'birding', 'wildlife']);

// A candidate must itself be "good" or better to count as a real,
// independent standout worth weighing against another one — texture
// jitter or a mediocre secondary category shouldn't trigger the
// disagreement discount below.
const EXCEPTION_ACTIVE_THRESHOLD = 6.5;
// How much gap between the two best active candidates it takes to fully
// discount the winner down to the second-best's own value — deliberately
// small (not a hard on/off cutoff at some larger gap) so adjacent months
// with slightly different gaps get a smooth gradient, not a cliff. A
// first version used a binary "gap >= 2 → ignore the exception entirely"
// rule, which produced exactly the jump this was reported against: Dec
// (gap 2, triggered) vs. Nov (gap 1, didn't) landed on opposite sides of
// "Excellent" vs. "Not ideal" despite genuinely similar conditions.
const EXCEPTION_DISAGREEMENT_FULL_DISCOUNT_GAP = 1.5;

/**
 * A slider counts as a "timing exception" for THIS month — capable of
 * lifting the month's score above what the weather alone would justify —
 * either because this specific destination has authored `signatureTier`
 * for the slider (the real per-destination signal: is this actually a
 * signature/strong reason to visit THIS place, not just a structural
 * property of the formula), or because this destination has an authored
 * sliderEvents entry that actually applies a boost to this specific month
 * (cherry blossoms, waterfall snowmelt, Christmas markets, aurora season,
 * ...). The month-check on the events path matters: a slider with a
 * spring-only event is not a standing "exception" for every other month
 * too — outside its event window, its score is just its ordinary
 * baseline, no more special than any other slider's, and treating it as
 * one let an unrelated high baseline (e.g. a destination's Scenic
 * Landscapes score being naturally high in August) override the
 * weather-comfort signal in a month with no real exception happening at
 * all. deals/crowds are excluded even though they're formula-driven —
 * they're an artifact of the peak/low flags, not a reason anyone visits.
 *
 * `signatureTier` is only backfilled for the interests added in the
 * 50-interest taxonomy migration (Phase 2) — for any slider without a
 * signatureTier entry on this destination (the original ski/birding/
 * wildlife-formula sliders, not yet backfilled), this falls back to the
 * old structural COMFORT_INDEPENDENT_FORMULAS heuristic so behavior is
 * unchanged until that backfill lands too. Where signatureTier IS
 * authored, it's authoritative in both directions: 'signature'/'strong'
 * grants exception status even for an otherwise-ordinary formula, and
 * 'casual'/'none' withholds it even for a comfort-independent formula —
 * e.g. Aurora being merely 'casual' somewhere shouldn't let a middling
 * score override a correctly bad weather month there.
 */
function isTimingExceptionSlider(dest: ScoringDestination, key: string, monthIdx: number): boolean {
  if (key === 'deals' || key === 'crowds') return false;
  const tier = dest.signatureTier?.[key];
  if (tier) {
    if (tier === 'signature' || tier === 'strong') return true;
  } else {
    const slider = SLIDERS.find((s) => s.key === key);
    if (slider && COMFORT_INDEPENDENT_FORMULAS.has(slider.formula)) return true;
  }
  const events = dest.sliderEvents?.[key];
  if (!events || events.length === 0) return false;
  return events.some((e) => (e.months[monthIdx + 1] ?? 0) > 0);
}

/**
 * "Is this generally a good month to visit" — independent of any one
 * user's picks (see DestinationCard's timing/match split). Comfortable
 * weather is the default answer for most destinations, most months (a
 * flat equal-weighted average across every slider — the previous
 * approach — meant a city was scored on its birding and golf potential
 * exactly as heavily as its museums and nightlife, and could never read
 * as "good timing" in any month). On top of that baseline, whichever
 * "timing exception" slider (see isTimingExceptionSlider) peaks highest
 * this month can lift the score — the BEST one, not an average, so a
 * genuine standout (skiing at 10/10 in January) isn't diluted by an
 * unrelated, off-season category (hiking at 3/10 that same month). N/A
 * sliders (isSliderNA) never count either way.
 *
 * Exception: when TWO OR MORE exception candidates are independently
 * strong but genuinely disagree with each other, that disagreement is
 * itself the signal — there's no single "why visit this month" answer, so
 * crediting only the loudest one would overstate it. Reproduces the real
 * Kruger case: birding peaks (migrant arrivals) in the same wet season
 * that disperses game away from easy viewing, so "great birding, harder
 * general safari" isn't "great," it's "good with real tradeoffs." Taking
 * birding's raw peak via Math.max alone read every wet month as a flat
 * "Excellent," the same bug this function's own bandPenalty exclusion
 * above was written to avoid — but discounting all the way down to
 * comfort alone overcorrected just as badly (a real January visitor's
 * account: "there is no bad month for Kruger," and weather-comfort-only
 * math doesn't know that a decent-but-not-flashy wildlife score, 7/10, is
 * still a perfectly good safari month on its own). The discount below
 * lands on the SECOND-best candidate's own value, not zero or an average
 * — disagreement should make a genuine standout stop lifting the whole
 * month past what the more conservative activity alone already supports,
 * not erase all of its credit. The discount is smooth in the size of the
 * gap (see EXCEPTION_DISAGREEMENT_FULL_DISCOUNT_GAP), not an on/off
 * cutoff — an earlier binary version put adjacent months with a gap of 1
 * vs. 2 on opposite sides of a cliff (Excellent vs. Not ideal) for no real
 * underlying reason. A single dominant exception (a ski resort's
 * snowsports) or two candidates that genuinely agree (birding and
 * wildlife moving together at most safari destinations) are unaffected —
 * the discount is zero unless there's a real, active gap between them.
 *
 * Deliberately does NOT apply bandPenalty (unlike scoreForMonth) — this
 * function's whole point is a destination-level "is this generally a good
 * time" signal that's the same for every viewer, and the "About" tab
 * shows it captioned exactly that way ("independent of you"). Multiplying
 * in the current user's Open To selections here previously made that
 * caption false: the chart would quietly rate a month poorly because of a
 * band the viewer happened to have restricted, while the month's own
 * generated description (generateMonthlyBlurb, genuinely independent of
 * the viewer) kept describing the same month as pleasant — the chart and
 * the text disagreeing for a reason nothing on screen explained.
 */
export function timingScoreForMonth(dest: ScoredDestination, monthIdx: number): number {
  const comfort = weatherComfortScore(dest, monthIdx);

  const exceptionKeys = SLIDERS.filter((s) => !isSliderNA(dest, s.key) && isTimingExceptionSlider(dest, s.key, monthIdx)).map(
    (s) => s.key,
  );
  // Disagreement is computed on the RAW dest.monthly values, not
  // texture-jittered ones — texture is cosmetic noise for chart
  // smoothness and shouldn't be able to manufacture (or hide) a real
  // gap between two candidates that actually agree or disagree.
  const rawExceptionValues = exceptionKeys.map((k) => dest.monthly[k][monthIdx]);
  const activeExceptions = rawExceptionValues.filter((v) => v >= EXCEPTION_ACTIVE_THRESHOLD).sort((a, b) => b - a);
  let exceptionPeak = rawExceptionValues.length ? Math.max(...rawExceptionValues) : 0;
  if (activeExceptions.length >= 2) {
    const [best, second] = activeExceptions;
    const gap = best - second;
    const discount = Math.min(1, gap / EXCEPTION_DISAGREEMENT_FULL_DISCOUNT_GAP);
    // discount 0 (candidates agree) → best, unchanged; discount 1 (gap at
    // or past the full-discount point) → second, the more conservative
    // candidate's own value — not zero. A genuine standout contradicted
    // by another still-solid signal (10 vs. a merely "good" 7) shouldn't
    // get to declare the month flawless, but it also shouldn't erase
    // credit for the fact that BOTH activities are still working — the
    // floor is "as good as the weaker of the two," not "no better than
    // the weather alone."
    exceptionPeak = best - discount * (best - second);
  }
  // A wider texture than comfort's own: an exception candidate's source
  // curve (dest.monthly[key]) is often just as flat across a season as the
  // raw weather flags were — e.g. birding with no authored birdingPeak
  // months is a uniform base-minus-a-flat-wet-penalty for the entire wet
  // season — and Math.max below would otherwise clip comfort's own
  // tapering right back to a plateau wherever that flat exception value
  // happens to win. Applied once, after disagreement is resolved above,
  // so it can't itself manufacture a gap between otherwise-equal
  // candidates. Reads dest.monthly[key] itself unmodified, so the
  // personalized per-slider score every other tab shows never changes.
  if (exceptionPeak > 0) exceptionPeak += monthTexture(`${dest.id}:exception`, monthIdx + 1, 0.5);

  return Math.max(0, Math.min(10, Math.max(comfort, exceptionPeak)));
}

/** The cyclic (wraps Dec→Jan) contiguous run of exactly-equal values in `values` containing `idx`. */
function findEqualRun(values: number[], idx: number): { start: number; len: number } {
  const v = values[idx];
  let start = idx;
  let end = idx;
  let guard = 0;
  while (values[(start - 1 + 12) % 12] === v && guard < 11) {
    start = (start - 1 + 12) % 12;
    guard++;
  }
  guard = 0;
  while (values[(end + 1) % 12] === v && guard < 11) {
    end = (end + 1) % 12;
    guard++;
  }
  const len = start <= end ? end - start + 1 : 12 - start + end + 1;
  return { start, len };
}

/** Same five-tier categorization as SEASON_POSITION_TAPER, generalized to a run's own start/length rather than a flag array. */
function positionTaperInRun(idx: number, start: number, len: number): number {
  if (len <= 1) return 1;
  const pos = idx >= start ? idx - start : 12 - start + idx;
  if (pos === 0 || pos === len - 1) return 0.55;
  if (pos <= Math.floor(len / 3) || pos >= Math.ceil((2 * len) / 3) - 1) return 0.8;
  return 1;
}

/**
 * A display-only smoothed reading of dest.monthly[key][monthIdx] — for
 * charts that plot ONE slider's personalized score across all 12 months
 * (the "For You" tab's "Best months for X"). Reproduces the exact same
 * "obviously fake flat plateau" bug timingScoreForMonth was fixed for,
 * one level down: a flag-driven formula (e.g. hikingWorst's flat -4
 * across exactly the months it's set) produces a genuinely flat run of
 * identical values, which a real season never actually holds. Only
 * softens the EDGES of a real dip (a run that's lower than both of its
 * neighbors, like a "worst months" block) toward its neighbors — a run
 * that's just a uniformly good stretch (most of the year, for most
 * destinations) gets a small texture nudge instead, since there's no
 * genuine downward signal to taper toward. Never touches dest.monthly
 * itself, so the real ranking math (scoreForMonth) and every existing
 * exact-value test are completely unaffected — this exists purely so the
 * chart a viewer looks at doesn't show three or more identical bars in a
 * row for no visible reason.
 */
export function smoothedMonthlyDisplay(dest: ScoredDestination, key: string, monthIdx: number): number {
  const values = dest.monthly[key];
  if (!values) return 0;
  const v = values[monthIdx];
  const { start, len } = findEqualRun(values, monthIdx);
  if (len >= 2 && len <= 10) {
    const prevVal = values[(start - 1 + 12) % 12];
    const nextVal = values[(start + len) % 12];
    if (v < prevVal && v < nextVal) {
      const taper = positionTaperInRun(monthIdx, start, len);
      const neighborBlend = (prevVal + nextVal) / 2;
      const blended = v * taper + neighborBlend * (1 - taper);
      // A short, symmetric dip (equal neighbors on both sides) tapers its
      // two edges to the exact same value — texture still breaks that tie,
      // same as every other month here.
      return Math.max(0, Math.min(10, blended + monthTexture(`${dest.id}:${key}:display`, monthIdx + 1, 0.3)));
    }
  }
  return Math.max(0, Math.min(10, v + monthTexture(`${dest.id}:${key}:display`, monthIdx + 1, 0.3)));
}

export function scoreLabel(score: number): { text: string; cls: string } {
  if (score >= 8) return { text: 'Excellent time to go', cls: 'excellent' };
  if (score >= 6.5) return { text: 'Good time to go', cls: 'good' };
  if (score >= 5) return { text: 'Okay, some tradeoffs', cls: 'okay' };
  if (score >= 3) return { text: 'Not ideal timing', cls: 'poor' };
  return { text: 'Avoid this month', cls: 'bad' };
}

/** Same tiers/thresholds as scoreLabel, worded for how well a destination
 * fits this user's picks rather than whether the month itself is good —
 * a low match can still be great timing (see DestinationCard). */
export function matchLabel(score: number): { text: string; cls: string } {
  if (score >= 8) return { text: 'Excellent match', cls: 'excellent' };
  if (score >= 6.5) return { text: 'Good match', cls: 'good' };
  if (score >= 5) return { text: 'Okay match', cls: 'okay' };
  if (score >= 3) return { text: 'Weak match', cls: 'poor' };
  return { text: 'Poor match', cls: 'bad' };
}

export function barColor(s: number): string {
  if (s >= 8) return 'var(--good)';
  if (s >= 6.5) return 'var(--good-soft)';
  if (s >= 5) return 'var(--okay)';
  if (s >= 3) return 'var(--poor)';
  return 'var(--bad)';
}

export interface RankedDestination {
  d: ScoredDestination;
  s: number;
}

export function computeRankedDestinations(
  destinations: ScoredDestination[],
  weights: Record<string, number>,
  month: number,
  selectedBands: SelectedBands,
  selectedStyles?: SelectedStyles,
): RankedDestination[] {
  const monthIdx = month - 1;
  return [...destinations]
    .map((d) => ({ d, s: scoreForMonth(d, weights, monthIdx, selectedBands, selectedStyles) }))
    .sort((a, b) => b.s - a.s);
}
