import type { InterestFactValue } from '@/lib/db/schema';
import type { FactDef } from './config';

/**
 * The completeness score for one interest, 0 to 100. Pure functions: the database loading lives in
 * src/lib/db/queries/interest-pages.ts. See docs/todo.md for the decisions behind the weights.
 *
 *   content 50        per place, five yes/no checks (live overview, 12 blurbs, authored curve, within length
 *                     caps, nothing staged waiting), averaged over the places that apply
 *   data columns 20   share of the interest's special-column cells that are filled (skipped when it has none)
 *   scoring quality 10  per place, three checks on the 12 monthly scores (see scoringChecks)
 *   verification 10   a place-specific review or source-check flag counts fully, a whole-interest review
 *                     in the last 12 months counts half
 *   scope and rules 10  five yes/no checks on the interest itself
 *
 * Open to-do items never change the score.
 */
export const COMPLETENESS_WEIGHTS = { content: 50, data: 20, scoring: 10, verify: 10, rules: 10 } as const;
export type CompletenessPart = keyof typeof COMPLETENESS_WEIGHTS;
export type CompletenessTab = 'rules' | 'todo' | 'ideas' | 'data' | 'reviews';

export interface EventLike {
  label: string;
  months: Record<string, number>;
}

export interface PlaceInput {
  id: string;
  /** The place is marked N/A for this interest, so it never counts for or against the score. */
  na: boolean;
  overview: string;
  blurbs: Array<string | null> | null;
  authored: boolean;
  /** The 12 live monthly scores, Jan to Dec. */
  monthly: number[];
  events: EventLike[];
  /** A valid generation newer than the live text is waiting to be applied. */
  staged: boolean;
  facts: Record<string, InterestFactValue>;
  /** A review entry names this place within the last 12 months. */
  placeReviewed: boolean;
}

export interface InterestInput {
  places: PlaceInput[];
  factDefs: FactDef[];
  hasDefinition: boolean;
  hasTen: boolean;
  hasDirective: boolean;
  hasRulesTab: boolean;
  ideasCount: number;
  /** A review of the whole interest was recorded within the last 12 months. */
  wideReviewed: boolean;
}

export interface Gain {
  label: string;
  points: number;
  tab: CompletenessTab;
}

export interface Completeness {
  score: number;
  /** Each part as 0-100, or null when it does not apply to this interest. */
  parts: Record<CompletenessPart, number | null>;
  gains: Gain[];
}

/** Overview and monthly length caps by peak score (same table as the authoring validator). */
export function lengthCaps(peak: number): { overview: number; monthly: number } {
  if (peak <= 4) return { overview: 280, monthly: 180 };
  if (peak <= 6) return { overview: 380, monthly: 260 };
  if (peak <= 8.5) return { overview: 450, monthly: 320 };
  return { overview: 550, monthly: 326 };
}

export function withinCaps(overview: string, blurbs: Array<string | null> | null, monthly: number[]): boolean {
  if (!overview || !blurbs || blurbs.length !== 12) return false;
  const peak = monthly.length ? Math.max(...monthly) : 0;
  const caps = lengthCaps(peak);
  return overview.length <= caps.overview && blurbs.every((b) => (b ?? '').length <= caps.monthly);
}

const CAUSE_WORDS = /\b(opens?|opening|reopens?|closes?|closed|closure|begins?|starts?|ends|arrives?|arrival|leaves?|departs?|migrat\w*|monsoon|rainy season|wet season|dry season|calving|spawning|blooms?|blooming|hatch\w*|breeding|nesting|rut|rutting|thaw\w*|freezes?|snowfall|floods?|flooded|flooding|cyclones?|hurricanes?|typhoons?|midnight sun|polar night|swell|crossings?)\b/i;

export interface ScoringChecks {
  granularity: boolean;
  flat: boolean;
  jumps: boolean;
}

/**
 * Three checks on a place's 12 monthly scores:
 *  - granularity: at most 4 of the 12 are exact whole or half numbers (random decimals give about 2 or 3)
 *  - flat: a run of 3 or more months within 0.3 of each other must be a ceiling or a floor (its average within 1.0
 *    of the year's high or low) or share one blurb; a flat run in mid-range fails
 *  - jumps: any month-to-month change of 1.5 or more needs a cause named in one of the two blurbs or in the
 *    place's event list
 */
export function scoringChecks(monthly: number[], blurbs: Array<string | null> | null, events: EventLike[]): ScoringChecks {
  if (monthly.length !== 12) return { granularity: false, flat: false, jumps: false };
  const half = monthly.filter((v) => Math.abs(v * 2 - Math.round(v * 2)) < 1e-6).length;
  const granularity = half <= 4;

  const mn = Math.min(...monthly);
  const mx = Math.max(...monthly);
  const text = (i: number) => (blurbs?.[((i % 12) + 12) % 12] ?? '').trim();
  let flat = true;
  for (let i = 0; i < 12 && flat; i++) {
    let len = 1;
    let lo = monthly[i];
    let hi = monthly[i];
    while (len < 12) {
      const v = monthly[(i + len) % 12];
      const nlo = Math.min(lo, v);
      const nhi = Math.max(hi, v);
      if (nhi - nlo > 0.3 + 1e-9) break;
      lo = nlo;
      hi = nhi;
      len++;
    }
    if (len < 3 || len >= 12) continue;
    const window = Array.from({ length: len }, (_, t) => (i + t) % 12);
    const mean = window.reduce((a, m) => a + monthly[m], 0) / len;
    const ceilingOrFloor = mean >= mx - 1.0 || mean <= mn + 1.0;
    const texts = window.map(text);
    const sharedBlurb = texts[0].length > 0 && texts.every((t) => t === texts[0]);
    if (!ceilingOrFloor && !sharedBlurb) flat = false;
  }

  let jumps = true;
  for (let i = 0; i < 12 && jumps; i++) {
    const j = (i + 1) % 12;
    if (Math.abs(monthly[i] - monthly[j]) < 1.5 - 1e-9) continue;
    const eventHit = events.some((e) => (e.months?.[String(i)] ?? 0) !== 0 || (e.months?.[String(j)] ?? 0) !== 0);
    const textHit = CAUSE_WORDS.test(text(i)) || CAUSE_WORDS.test(text(j));
    if (!eventHit && !textHit) jumps = false;
  }
  return { granularity, flat, jumps };
}

const pct = (n: number, d: number) => (d > 0 ? (100 * n) / d : 0);
const round1 = (n: number) => Math.round(n * 10) / 10;

export function computeCompleteness(input: InterestInput): Completeness {
  const applicable = input.places.filter((p) => !p.na);
  const n = applicable.length;

  // ---- content
  const fail = { overview: 0, blurbs: 0, authored: 0, caps: 0, staged: 0 };
  let contentPass = 0;
  for (const p of applicable) {
    const hasOverview = p.overview.length > 0;
    const hasBlurbs = !!p.blurbs && p.blurbs.length === 12 && p.blurbs.every((b) => (b ?? '').length > 0);
    if (p.staged) fail.staged++;
    // A place with no live text earns nothing: curves and "nothing staged" are not credit for work not done.
    if (!hasOverview) {
      fail.overview++;
      if (!hasBlurbs) fail.blurbs++;
      continue;
    }
    const caps = withinCaps(p.overview, p.blurbs, p.monthly);
    const checks = [hasOverview, hasBlurbs, p.authored, caps, !p.staged];
    contentPass += checks.filter(Boolean).length;
    if (!hasBlurbs) fail.blurbs++;
    if (!p.authored) fail.authored++;
    if (hasBlurbs && !caps) fail.caps++;
  }
  const content = pct(contentPass, n * 5);

  // ---- data columns
  // A blank animal list means that kind of animal is simply not a draw there, so blanks never count against a place.
  // When an interest has a full set of animal columns (Wildlife Viewing), each place instead needs at least one animal
  // recorded somewhere in them.
  const animalDefs = input.factDefs.filter((d) => !d.hidden && d.animals);
  const needsOneAnimal = animalDefs.length >= 3;
  const dataDefs = input.factDefs.filter((d) => !d.hidden && !d.optional && !d.animals && d.type !== 'bool');
  const hasValue = (v: InterestFactValue | undefined) => v !== undefined && v !== null && !(typeof v === 'string' && v.trim() === '') && !(Array.isArray(v) && v.length === 0);
  let data: number | null = null;
  let emptyCells = 0;
  if ((dataDefs.length > 0 || needsOneAnimal) && n > 0) {
    let filled = 0;
    let total = 0;
    for (const p of applicable) {
      for (const d of dataDefs) {
        total++;
        if (hasValue(p.facts[d.key])) filled++;
        else emptyCells++;
      }
      if (needsOneAnimal) {
        total++;
        if (animalDefs.some((d) => hasValue(p.facts[d.key]))) filled++;
        else emptyCells++;
      }
    }
    data = pct(filled, total);
  }

  // ---- scoring quality
  const sFail = { granularity: 0, flat: 0, jumps: 0 };
  let scoringPass = 0;
  for (const p of applicable) {
    if (p.overview.length === 0) continue; // no text yet: scores are not graded, and the gain is "write the text"
    const c = scoringChecks(p.monthly, p.blurbs, p.events);
    scoringPass += Number(c.granularity) + Number(c.flat) + Number(c.jumps);
    if (!c.granularity) sFail.granularity++;
    if (!c.flat) sFail.flat++;
    if (!c.jumps) sFail.jumps++;
  }
  const scoring = pct(scoringPass, n * 3);

  // ---- verification
  let verifySum = 0;
  let unverified = 0;
  for (const p of applicable) {
    const full = p.placeReviewed || p.facts.drawSourceChecked === true;
    const v = full ? 1 : input.wideReviewed ? 0.5 : 0;
    verifySum += v;
    if (v < 1) unverified++;
  }
  const verify = pct(verifySum, n);

  // ---- scope and rules
  const ruleChecks = [input.hasDefinition, input.hasTen, input.hasDirective, input.hasRulesTab, input.ideasCount > 0];
  const rules = pct(ruleChecks.filter(Boolean).length, ruleChecks.length);

  const parts: Record<CompletenessPart, number | null> = { content, data, scoring, verify, rules };
  const active = (Object.keys(COMPLETENESS_WEIGHTS) as CompletenessPart[]).filter((k) => parts[k] !== null);
  const totalWeight = active.reduce((a, k) => a + COMPLETENESS_WEIGHTS[k], 0);
  const score = Math.round(active.reduce((a, k) => a + COMPLETENESS_WEIGHTS[k] * (parts[k] as number), 0) / totalWeight);
  const eff = (k: CompletenessPart) => (100 * COMPLETENESS_WEIGHTS[k]) / totalWeight;

  // ---- what would raise it most
  const plural = (c: number, one: string, many: string) => `${c} ${c === 1 ? one : many}`;
  const gains: Gain[] = [];
  const push = (label: string, points: number, tab: CompletenessTab) => {
    if (points >= 0.5) gains.push({ label, points: round1(points), tab });
  };
  if (n > 0) {
    const perCheck = eff('content') / 5 / n;
    push(`Write overviews for ${plural(fail.overview, 'place', 'places')}`, fail.overview * perCheck, 'data');
    push(`Write monthly blurbs for ${plural(fail.blurbs, 'place', 'places')}`, fail.blurbs * perCheck, 'data');
    push(`Author the curve for ${plural(fail.authored, 'place', 'places')} (still on the formula)`, fail.authored * perCheck, 'data');
    push(`Trim text over the length cap in ${plural(fail.caps, 'place', 'places')}`, fail.caps * perCheck, 'data');
    push(`Apply or discard staged text for ${plural(fail.staged, 'place', 'places')}`, fail.staged * perCheck, 'data');
    if (data !== null) push(`Fill ${plural(emptyCells, 'empty cell', 'empty cells')} in the data columns`, eff('data') * (1 - data / 100), 'data');
    const sPer = eff('scoring') / 3 / n;
    push(`Fix rounded scores in ${plural(sFail.granularity, 'place', 'places')}`, sFail.granularity * sPer, 'data');
    push(`Fix flat stretches in ${plural(sFail.flat, 'place', 'places')}`, sFail.flat * sPer, 'data');
    push(`Explain or fix big jumps in ${plural(sFail.jumps, 'place', 'places')}`, sFail.jumps * sPer, 'data');
    push(`Source-check ${plural(unverified, 'place', 'places')}`, eff('verify') * (1 - verify / 100), 'reviews');
  }
  const rPer = eff('rules') / 5;
  if (!input.hasDefinition) push('Write the definition in anchors.ts', rPer, 'rules');
  if (!input.hasTen) push('Name the places allowed a 10 in anchors.ts', rPer, 'rules');
  if (!input.hasDirective) push('Write an authoring directive', rPer, 'rules');
  if (!input.hasRulesTab) push('Write the rules tab', rPer, 'rules');
  if (input.ideasCount === 0) push('Start the future-places list', rPer, 'ideas');
  gains.sort((a, b) => b.points - a.points);

  return { score, parts, gains: gains.slice(0, 3) };
}
