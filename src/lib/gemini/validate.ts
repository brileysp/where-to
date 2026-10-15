import { hasCelsius } from '../text/temperature';
import { hasMeters } from '../text/length';
import { SLIDERS } from '../scoring/constants';
import { oldNameIssues } from './renamed-places';
import { INTEREST_ANCHORS } from '../scoring/anchors';
import { seasonWordsIn } from './hemisphere';
import type { GenerationOutput } from './schema';
import { emphasisIsBalanced, stripEmphasis } from '../text/emphasis';

export interface ValidationIssue {
  layer: 'schema' | 'content' | 'plausibility';
  /** 'reject' flips the generation's overall status to 'invalid' (blocks
   * pipeline:apply). 'warning' is recorded and surfaced for human review
   * but never blocks on its own — see the duplicate-blurb rule below for
   * why this distinction exists at all. */
  severity: 'reject' | 'warning';
  message: string;
}

const SAME_TEXT_SCORE_TOLERANCE = 0.45;
// Whale watching (owner rule 2026-10-07): only flag identical text when the scores jump a lot. Elsewhere the older, tighter tolerance stays.
const SAME_TEXT_TOLERANCE_BY_INTEREST: Record<string, number> = { whaleWatching: 1.0, diving: 1.0 }; // months with matching text shouldn't differ by 0.5 or more (user rule 2026-10-03: a shared blurb may carry slightly different scores; a distinct blurb is only needed for a 0.5+ jump)
const CLIFF_THRESHOLD = 2; // an isolated month differing from both neighbors by at least this is suspect
const NEIGHBOR_CLOSE_THRESHOLD = 0.5; // "the neighbors are close to each other" — playbook's own cliff definition
const LITERAL_MAX_RUN_LENGTH = 5; // a run this long at the ceiling needs real justification (playbook §1 Step 6)

// Formula families that are clearly land-based, non-water interests — a
// generation for one of these mentioning reef/dive/snorkel-specific content
// is category bleed, not a legitimate cross-reference (compare to the
// playbook's OWN overlap rule, which is about two interests both covering
// the same land animal from different angles — a genuinely different case
// from a hiking-formula interest describing marine life at all).
const LAND_FORMULAS = new Set(['hiking', 'snow']);
const MARINE_BLEED_KEYWORDS = ['reef', 'coral', 'snorkel', 'scuba', 'dive site', 'diving', 'manta ray', 'whale shark', 'liveaboard'];


// Scenic/atmospheric padding explicitly banned by the Wildlife Viewing
// Authoring Directive v2 (2026-09-29, prompts/wildlifeViewing/v2.md §5) —
// generic enough that it's bad writing for any interest, not just wildlife,
// so checked unconditionally rather than gated to one interest. A cheap,
// exact-phrase mechanical check; it catches lazy scenic prose, not every
// possible form of fluff — the expert-review pass (docs/todo.md's standing
// rule) is what catches the subtler cases this can't.
const BANNED_FLUFF_PHRASES = [
  'sun-warmed rocks', 'dramatic cliffs', 'basking serenely', 'vibrant displays',
  'pristine snowscapes', 'stags roar across the dehesa',
];

// v3 directive §5's plain-language rule: two field-guide words the user
// caught and replaced by hand in v2 drafts ("cetacean" -> "whale",
// "ungulate(s)" -> "deer"/the specific common name) — unambiguous jargon
// with no valid use in this copy, unlike a self-rating adjective ("modest",
// "elite"), which is too context-dependent to safely hard-reject on.
const BANNED_JARGON_WORDS = ['cetacean', 'ungulate'];

// The verb "host" is only right for TRANSIENT visitors (user rule 2026-10-03):
// it means a temporary home or stopover ("coastal waters host schools of sharks
// on their migration"; "mudflats host wintering shorebirds"). Gemini kept using
// it for permanent residents ("parks host barbets"), which the user had to fix
// by hand many times. A heuristic: reject a sentence that uses the verb without a
// transient marker (migrating, wintering, summer/seasonal breeding, stopover).
// For residents use "holds", "is home to" or "are seen". Verb forms only, so the
// noun ("host plant") passes. Not true semantic verification; read before trusting.
const HOST_VERB_PATTERN = /\b(hosts|hosted|hosting)\b|\b(reliably|frequently|also|commonly|regularly|often|to|can|will|both|still) host\b|\b(parks|waters|forests|wetlands|marshes|mudflats|lagoons|islands|reserves|areas|colonies|beaches|rivers|lakes|biome|mountains|slopes) host\b/i;
const TRANSIENT_MARKERS = /migrat|winter|summer|breeding|nesting|seasonal|stopover|passage|arriv|autumn|spring|vagrant|transient|visitor/i;

// v4 directive §5's word-economy rule (2026-09-30) — a character budget for
// blurb_overall and each monthly blurb, keyed to the destination's peak
// score. Calibrated against real applied content: Death Valley (peak 3.2)
// and Denali (peak 8.9) came back from Gemini at almost the same length
// (~430 vs ~420 chars) despite being in wildly different score tiers — the
// user flagged Death Valley as "way too long and too much fluff" while
// Denali was "appropriate". These are a WARNING, deliberately not a reject:
// the user's own framing is "pay for space by the word" — a destination
// with several genuinely distinct, high-value species (Costa Rica's four
// monkeys + endemic tapir + toucans) can reasonably run over its cap
// because every extra word buys new information, while a low-scoring place
// padded with generic filler species (Death Valley's original draft, before
// the fix) should never even approach it. A human glance decides which.
// Loosened 2026-09-30 after the first real pass (Death Valley) cut a
// genuine actionable detail — the explicit "search at dawn/dusk near water
// sources" viewing tactic — to hit the original, tighter budget. The
// original numbers solved the real problem (Death Valley and Denali coming
// back nearly the same length despite wildly different tiers) but left too
// little room for a §2 "Viewing Requirement" tactic on top of naming the
// species. ~25-30% more room across the board.
const LENGTH_TIERS: Array<{ maxPeak: number; overview: number; monthly: number }> = [
  { maxPeak: 4.0, overview: 280, monthly: 180 },
  { maxPeak: 6.0, overview: 380, monthly: 260 },
  { maxPeak: 8.5, overview: 450, monthly: 320 }, // user rule 2026-10-03: >450 only at peak >= 8.5
  { maxPeak: Infinity, overview: 550, monthly: 326 },
];

// Interests whose directive makes the overview ceiling a hard limit (whaleWatching/v2 §6). Elsewhere it stays a warning.
const HARD_OVERVIEW_CAP_INTERESTS = new Set(['whaleWatching']);

function lengthCapFor(peak: number): { overview: number; monthly: number } {
  return LENGTH_TIERS.find((t) => peak < t.maxPeak) ?? LENGTH_TIERS[LENGTH_TIERS.length - 1];
}

function normalizeText(s: string): string {
  return s.trim().toLowerCase().replace(/\s+/g, ' ');
}

/** Two texts count as "the same" for the duplicate/same-text checks if
 * they're identical after normalizing whitespace/case, OR one contains the
 * other almost entirely (a near-paraphrase) — deliberately loose, since the
 * playbook's own examples ("the literal same sentence six times over") are
 * about near-verbatim repetition, not textual identity down to punctuation. */
function textsMatch(a: string, b: string): boolean {
  const na = normalizeText(a);
  const nb = normalizeText(b);
  if (na === nb) return true;
  const [shorter, longer] = na.length <= nb.length ? [na, nb] : [nb, na];
  return shorter.length > 20 && longer.includes(shorter);
}

/**
 * Layer 2 (content rules) of the three-layer validation pipeline —
 * docs/gemini-content-pipeline-plan.md §5. Layer 1 (schema) is
 * generationOutputSchema.safeParse in client.ts; this runs only once that
 * has already succeeded. Mechanical checks made executable from
 * interest-content-authoring-playbook.md §1 Step 6 — same rules a human
 * reviewer was already applying by eye, just applied consistently and
 * before anything reaches a human at all.
 */
/** A directive may let the model declare a place not applicable (whaleWatching/v1 §9): every score 0,
 * every month blurb exactly "n/a", and an overview beginning with this marker plus a one-sentence reason. */
export const NOT_APPLICABLE_MARKER = 'NOT_APPLICABLE:';
export function isNotApplicable(output: Pick<GenerationOutput, 'overview'>): boolean {
  return output.overview.trim().startsWith(NOT_APPLICABLE_MARKER);
}

function validateNotApplicable(output: GenerationOutput): ValidationIssue[] {
  const issues: ValidationIssue[] = [];
  const reason = output.overview.trim().slice(NOT_APPLICABLE_MARKER.length).trim();
  if (reason.length < 15) issues.push({ layer: 'content', severity: 'reject', message: 'NOT_APPLICABLE needs a one-sentence geographic reason after the marker.' });
  if (output.monthly.some((m) => m.score !== 0)) issues.push({ layer: 'content', severity: 'reject', message: 'A NOT_APPLICABLE output must score every month 0.' });
  if (output.monthly.some((m) => m.text.trim().toLowerCase() !== 'n/a')) issues.push({ layer: 'content', severity: 'reject', message: 'A NOT_APPLICABLE output must use the text "n/a" for every month.' });
  issues.push({ layer: 'content', severity: 'warning', message: `Model judged this place not applicable: ${reason}` });
  return issues;
}

/** Snorkeling & diving fit fields (diving_rating, snorkeling_rating, best_for): ratings 0-10, best_for must follow the ratings, and the better rating should sit near the place's peak score. */
export const BEST_FOR_GAP = 1.5;
export function bestForFromRatings(diving: number, snorkeling: number): 'both' | 'diving' | 'snorkeling' {
  const gap = diving - snorkeling;
  if (Math.abs(gap) < BEST_FOR_GAP) return 'both';
  return gap > 0 ? 'diving' : 'snorkeling';
}
/** Interests where the model chooses its own 10s and an off-list 10 is only a warning. */
const OPEN_TEN_INTERESTS = new Set(['surfing', 'hiking']);

/** Four or more months at a literal 10.0 are not an error, but each should be truly as good as the others: worth a human glance. */
export const MANY_TENS_MONTHS = 4;
function validateManyTens(output: GenerationOutput): ValidationIssue[] {
  const tens = output.monthly.map((m, i) => (m.score >= 10 ? i + 1 : 0)).filter(Boolean);
  if (tens.length < MANY_TENS_MONTHS) return [];
  return [{ layer: 'content', severity: 'warning', message: `Months ${tens.join(', ')} all score 10.0. That is allowed when they are truly equally good; check each one against the others and differentiate any that are not.` }];
}

/** Snorkeling & diving: self-rating words the directive bans. Warnings, because a word like "prime" can be innocent in context. */
// Owner (10 Oct 2026): flag only egregious filler; words like excellent, ideal, prime, pristine, massive, playful and world-class are fine.
const DIVING_SELF_RATING_WORDS = ['incredible', 'amazing', 'stunning', 'spectacular', 'breathtaking', 'unforgettable'];
const OFF_SEASON_SIGNAL = /\b(off-season|out of season|not the (best|diving)|less (reliable|likely|common)|fewer|rather than|but snorkel|no (big|pelagic)|outside the)\b/i;
function validateDivingText(output: GenerationOutput): ValidationIssue[] {
  const issues: ValidationIssue[] = [];
  const all = [output.overview, ...output.monthly.map((m) => m.text)].join(' ').toLowerCase();
  const hits = DIVING_SELF_RATING_WORDS.filter((w) => new RegExp(`\\b${w}\\b`).test(all));
  if (hits.length) issues.push({ layer: 'content', severity: 'warning', message: `Self-rating words the directive bans: ${hits.join(', ')}. State what is there and let the score carry the tier.` });
  // Temperatures are written in Fahrenheit (owner rule, 11 Oct 2026). The authoring script converts them; this catches anything that slipped through.
  if ([output.overview, ...output.monthly.map((m) => m.text)].some((t) => hasCelsius(t))) {
    issues.push({ layer: 'content', severity: 'warning', message: 'A temperature is written in Celsius. Blurbs use Fahrenheit (for example 72°F).' });
  }
  // Depths, visibility and distances in diving blurbs are in feet (owner rule, 11 Oct 2026).
  if ([output.overview, ...output.monthly.map((m) => m.text)].some((t) => hasMeters(t))) {
    issues.push({ layer: 'content', severity: 'warning', message: 'A depth, visibility or distance is written in metres. Diving blurbs use feet (for example 100 ft).' });
  }
  // Never talk about the research in the text (owner rule, 11 Oct 2026): when facts conflict, stay vague.
  if (/\b(sources?|guides?|operators?|reports?)\s+(disagree|differ|conflict|vary|are mixed)\b|\bdisputed\b/i.test([output.overview, ...output.monthly.map((m) => m.text)].join(' '))) {
    issues.push({ layer: 'content', severity: 'warning', message: 'The text mentions that sources disagree. Never say so in a blurb; if the facts conflict, keep the wording vague.' });
  }
  // "liveaboard" is never explained (owner rule, 11 Oct 2026): no "(a multi-day dive boat)" after the word.
  if (/\blive-?aboards?\b\s*(\(|,\s*(a|an|which|i\.e\.)\b)/i.test([output.overview, ...output.monthly.map((m) => m.text)].join(' '))) {
    issues.push({ layer: 'content', severity: 'warning', message: 'Do not explain what a liveaboard is; divers know the word.' });
  }
  // "pelagic" is diver jargon: fine, but the overview must explain it the first time (owner rule, 9 Oct 2026).
  if (/\bpelagics?\b/i.test(output.monthly.map((m) => m.text).join(' ')) && !/\bpelagics?\b/i.test(output.overview)) {
    issues.push({ layer: 'content', severity: 'warning', message: 'A month blurb uses "pelagic" but the overview does not. The overview must introduce it first, as "big pelagics like <named animals>".' });
  }
  // First use in the overview must carry its helper: "like"/"such as"/"including" plus a named animal, never a definition.
  const firstUse = output.overview.match(/\bpelagics?\b(.{0,40})/i);
  if (firstUse && !/^\s*(,\s*)?(like|such as|including)\s+\S+/i.test(firstUse[1])) {
    issues.push({ layer: 'content', severity: 'warning', message: 'The overview uses "pelagic" but not as "big pelagics like <named animals>" (the named animals are the helper, no definition).' });
  }
  // The text is about the water: land and beach events (nesting, courting, breeding colonies) belong elsewhere.
  const land = all.match(/\b(nesting|nest|courting|courtship|breeding colon\w+|hatchlings?)\b/);
  if (land) issues.push({ layer: 'content', severity: 'warning', message: `Mentions "${land[0]}", which usually happens on land. Keep only what a person in the water sees or what changes the in-water experience.` });
  const x = output.extras;
  if (x && typeof x.diving_rating === 'number' && typeof x.snorkeling_rating === 'number') {
    const diving = x.diving_rating, best = Math.max(diving, x.snorkeling_rating);
    output.monthly.forEach((m, i) => {
      if (m.score > best + 0.5) issues.push({ layer: 'content', severity: 'warning', message: `Month ${i + 1} scores ${m.score}, above both ratings (best ${best}); the ratings are for the best time of year.` });
      // Only for places with a real diving draw (rating 6+): a low place is simply low, there is no headline draw to be out of season.
      if (x.best_for === 'diving' && diving >= 6 && m.score <= diving - 1 && !OFF_SEASON_SIGNAL.test(m.text)) {
        issues.push({ layer: 'content', severity: 'warning', message: `Month ${i + 1} scores ${m.score}, 1.0 or more below the diving rating (${diving}) at a diving-led place, but the blurb does not say the diving draw is out of season.` });
      }
    });
  }
  return issues;
}

/** Surfing fit fields (beginner_rating, advanced_rating): both 0-10, and the better one should sit near the place's peak score. */
function validateSurfRatings(output: GenerationOutput): ValidationIssue[] {
  const x = output.extras;
  if (!x || typeof x.beginner_rating !== 'number') return [];
  const issues: ValidationIssue[] = [];
  const b = x.beginner_rating, a = x.advanced_rating;
  if (typeof a !== 'number') return [{ layer: 'content', severity: 'reject', message: 'advanced_rating is missing.' }];
  if (b < 0 || b > 10 || a < 0 || a > 10) issues.push({ layer: 'content', severity: 'reject', message: 'beginner_rating and advanced_rating must be between 0 and 10.' });
  const peak = Math.max(...output.monthly.map((m) => m.score));
  if (Math.abs(Math.max(b, a) - peak) > 0.5) {
    issues.push({ layer: 'content', severity: 'warning', message: `The better of the two ratings (${Math.max(b, a).toFixed(1)}) is not within 0.5 of the peak score (${peak.toFixed(1)}); the directive asks for them to agree.` });
  }
  return issues;
}

/** Hiking fit fields (day_hike_rating, trek_rating): both 0-10, and the better one should sit near the place's peak score. */
function validateHikeRatings(output: GenerationOutput): ValidationIssue[] {
  const x = output.extras;
  if (!x || typeof x.day_hike_rating !== 'number') return [];
  const issues: ValidationIssue[] = [];
  const d = x.day_hike_rating, t = x.trek_rating;
  if (typeof t !== 'number') return [{ layer: 'content', severity: 'reject', message: 'trek_rating is missing.' }];
  if (d < 0 || d > 10 || t < 0 || t > 10) issues.push({ layer: 'content', severity: 'reject', message: 'day_hike_rating and trek_rating must be between 0 and 10.' });
  const peak = Math.max(...output.monthly.map((m) => m.score));
  if (Math.abs(Math.max(d, t) - peak) > 0.5) {
    issues.push({ layer: 'content', severity: 'warning', message: `The better of the two ratings (${Math.max(d, t).toFixed(1)}) is not within 0.5 of the peak score (${peak.toFixed(1)}); the directive asks for them to agree.` });
  }
  return issues;
}

/** Hiking: "world-class" and "legendary" appear at most once in a place's whole text and never in a month blurb (owner rule, 14 Oct 2026). */
function validateHikingText(output: GenerationOutput, options: ValidateOptions = {}): ValidationIssue[] {
  const big = /\b(world-class|legendary)\b/gi;
  const inMonths = output.monthly.filter((m) => big.test(m.text)).length;
  big.lastIndex = 0;
  const total = [output.overview, ...output.monthly.map((m) => m.text)].reduce((n, t) => n + (t.match(big)?.length ?? 0), 0);
  const issues: ValidationIssue[] = [];
  if (inMonths > 0) issues.push({ layer: 'content', severity: 'warning', message: `"World-class" or "legendary" appears in ${inMonths} month blurb(s). The rule is never in a month.` });
  if (total > 1) issues.push({ layer: 'content', severity: 'warning', message: `"World-class" or "legendary" appears ${total} times. The rule is at most once in a place's whole text.` });
  // Owner review of the 5-place sample, 14 Oct 2026 (hiking/v3). Warnings only: a person decides.
  const all = [output.overview, ...output.monthly.map((m) => m.text)];
  if (/\b(suits?|best for|mostly|entirely|best suited to)\b[^.]{0,30}\bday[- ](hikers?|hikes?|trips?)\b|\bday-trip focused\b/i.test(output.overview)) issues.push({ layer: 'content', severity: 'warning', message: 'The overview says who the place suits or that it is day-hike only. Day hiking is the default; cut it, and mention a trek only if one exists.' });
  if (all.some((t) => /\b(indoors?|treadmills?|gyms?)\b/i.test(t))) issues.push({ layer: 'content', severity: 'warning', message: 'A blurb mentions indoors, treadmills or gyms. Out of scope: say what the trails are like and stop.' });
  if (/\bthere (is|are) no\b/i.test(all.join(' '))) issues.push({ layer: 'content', severity: 'warning', message: 'A blurb says "there is no ...". Do not state what a place lacks.' });
  if (/\d[\d,.]*[- ]mile/i.test(output.overview) && !/\b\d+(?:[-\s](?:to\s+\d+\s+)?)days?\b|\bmulti-day\b/i.test(output.overview)) issues.push({ layer: 'content', severity: 'warning', message: 'The overview gives a distance but no multi-day route. Day hikes get no mileage unless 15 miles or more; check it.' });
  // Owner review, 14 Oct 2026 (hiking/v4).
  if (/\bmoderate\b(?! (daytime |overnight )?(temperatures?|weather|conditions?|rain|climate|humidity|winds?|heat|cool|warmth)\b)/i.test(all.join(' '))) issues.push({ layer: 'content', severity: 'warning', message: 'A bare "moderate" is not used to describe a route. Say what the route is like (steep, long, rough, exposed) or leave the level out.' });
  if (/\bheadline\b/i.test(all.join(' '))) issues.push({ layer: 'content', severity: 'warning', message: '"Headline" (as in "the headline route") is not used. Say "best-known" or name the route.' });
  if (/\bworld-reference\b/i.test(all.join(' '))) issues.push({ layer: 'content', severity: 'warning', message: '"World-reference" is the scoring scale\'s own word. Say "world famous", or one "world-class", or describe it, never "world-reference".' });
  if (/\b(overrun|swamped|teeming|inundated|invaded|flooded with (tourists|visitors))\b/i.test(all.join(' '))) issues.push({ layer: 'content', severity: 'warning', message: 'Crowding is said as "crowded", with the places named. Words like "overrun" or "swamped" are too negative and vague.' });
  if (/\bmost (celebrated|legendary) hiking\b/i.test(output.overview) || /^Some of the world's (most )?/i.test(output.overview.trim())) issues.push({ layer: 'content', severity: 'warning', message: 'The overview opens with a stock self-rating phrase ("Some of the world\'s ..."). Open with what is specific to this place.' });
  if (options.crowding !== undefined) {
    const words = /\b(crowd\w*|congest\w*|queue\w*|busiest)\b/i;
    const inOverview = words.test(output.overview);
    const inMonths = output.monthly.filter((m) => words.test(m.text)).length;
    if (options.crowding === 5 && !inOverview) issues.push({ layer: 'content', severity: 'warning', message: 'The notes show 5 of 5 crowding indicators: the overview must mention crowds.' });
    if (options.crowding === 4 && inOverview) issues.push({ layer: 'content', severity: 'warning', message: 'The notes show 4 of 5 crowding indicators: crowds may be mentioned in peak-crowd month blurbs, never in the overview.' });
    if (options.crowding <= 3 && (inOverview || inMonths > 0)) issues.push({ layer: 'content', severity: 'warning', message: `The notes show ${options.crowding} of 5 crowding indicators: crowds are not mentioned at all.` });
  }
  if (options.monthsNotSeasons) {
    const found = [...new Set(all.flatMap((t) => seasonWordsIn(t)))];
    if (found.length) issues.push({ layer: 'content', severity: 'warning', message: `This place is in the Southern Hemisphere or near the equator: name months, not seasons (found: ${found.join(', ')}).` });
  }
  return issues;
}

function validateFitExtras(output: GenerationOutput): ValidationIssue[] {
  const x = output.extras;
  if (!x || typeof x.diving_rating !== 'number') return [];
  const issues: ValidationIssue[] = [];
  const d = x.diving_rating, sn = x.snorkeling_rating;
  if (typeof sn !== 'number') return [{ layer: 'content', severity: 'reject', message: 'snorkeling_rating is missing.' }];
  if (d < 0 || d > 10 || sn < 0 || sn > 10) issues.push({ layer: 'content', severity: 'reject', message: 'diving_rating and snorkeling_rating must be between 0 and 10.' });
  const expected = bestForFromRatings(d, sn);
  if (x.best_for !== expected) {
    issues.push({ layer: 'content', severity: 'reject', message: `best_for is "${x.best_for}" but the ratings (diving ${d}, snorkeling ${sn}) say "${expected}": a gap of ${BEST_FOR_GAP} or more makes it lopsided, otherwise it is "both".` });
  }
  const peak = Math.max(...output.monthly.map((m) => m.score));
  if (Math.abs(Math.max(d, sn) - peak) > 0.5) {
    issues.push({ layer: 'content', severity: 'warning', message: `The better of the two ratings (${Math.max(d, sn).toFixed(1)}) is not within 0.5 of the peak score (${peak.toFixed(1)}); the directive asks for them to agree.` });
  }
  return issues;
}

export interface ValidateOptions {
  /** The place is in the Southern Hemisphere or the equatorial belt: text names months, never seasons (see hemisphere.ts). */
  monthsNotSeasons?: boolean;
  /** Count of documented crowding indicators (0-5) from the hiking notes: 5 must mention crowds, 4 only peak months, 3 or fewer never. Undefined = not checked. */
  crowding?: number;
}

export function validateContent(rawOutput: GenerationOutput, interestKey: string, placeId: string, options: ValidateOptions = {}): ValidationIssue[] {
  if (isNotApplicable(rawOutput)) return validateNotApplicable(rawOutput);
  const oldNameWarnings: ValidationIssue[] = oldNameIssues(placeId, [rawOutput.overview, ...rawOutput.monthly.map((m) => m.text)]).map((message) => ({ layer: 'content' as const, severity: 'warning' as const, message }));
  const issues: ValidationIssue[] = [...oldNameWarnings, ...validateFitExtras(rawOutput), ...validateSurfRatings(rawOutput), ...validateHikeRatings(rawOutput), ...(interestKey === 'hiking' ? validateHikingText(rawOutput, options) : []), ...validateManyTens(rawOutput), ...(interestKey === 'diving' ? validateDivingText(rawOutput) : [])];
  // Species-name markers (**Name**) are display formatting: every check below sees the text without them.
  const allText = [rawOutput.overview, ...rawOutput.monthly.map((m) => m.text)];
  if (allText.some((t) => !emphasisIsBalanced(t))) {
    issues.push({ layer: 'content', severity: 'reject', message: 'A species-name marker (**) is unbalanced, empty or nested. Each marked name needs one ** before and one after.' });
  }
  const output: GenerationOutput = { ...rawOutput, overview: stripEmphasis(rawOutput.overview), monthly: rawOutput.monthly.map((m) => ({ ...m, text: stripEmphasis(m.text) })) };
  const { monthly, overview } = output;

  // Duplicate/near-duplicate monthly blurbs — warning by default, per user
  // correction (2026-09-28): NOT an automatic reject. A genuinely flat
  // season legitimately reuses the same short sentence verbatim (the
  // playbook's own auroraChasing example: three identical "too light for a
  // realistic look" months is called correct, not a bug) — so duplicate
  // text alone is surfaced for a human glance, not auto-invalidated. It
  // only escalates to 'reject' when paired with a real score mismatch
  // (matching text asserting the months are equivalent, while the scores
  // disagree) — that combination IS unambiguously the bug the playbook
  // describes, never a legitimate judgment call.
  //
  // Grouped rather than reported pairwise: a block of N identical months is
  // one real issue ("months 1-6 are duplicated"), not the N*(N-1)/2
  // near-identical entries a naive pairwise loop would flood the audit
  // trail with for the exact same underlying fact.
  const visited = new Set<number>();
  for (let i = 0; i < 12; i++) {
    if (visited.has(i)) continue;
    const group = [i];
    for (let j = i + 1; j < 12; j++) {
      if (textsMatch(monthly[i].text, monthly[j].text)) group.push(j);
    }
    if (group.length > 1) {
      group.forEach((idx) => visited.add(idx));
      const monthList = group.map((idx) => idx + 1).join(', ');
      const scores = group.map((idx) => monthly[idx].score);
      const scoreSpread = Math.max(...scores) - Math.min(...scores);
      // Shared text is only honest for a STABLE stretch. A transition event ("migration
      // ceases", "rains clear the smoke", "the pass opens") can't be reused across
      // consecutive months (user rule 2026-10-03): it would say the event happens in each.
      // The text the months truly share is the shortest one: a longer month that merely contains it (an extra sentence such as "Peak season begins.") must not make the shared stretch look like a transition.
      const sharedText = group.map((idx) => monthly[idx].text).sort((x, y) => x.length - y.length)[0];
      const strict = sharedText.match(/\b(begins?|starts?|ends|ceases|clears|opens|closes|winds down|tapers|eases|arrives?|arriving|returns?|returning)\b/i);
      if (strict) {
        issues.push({
          layer: 'content',
          severity: 'reject',
          message: `Months ${monthList} share text that describes a transition ("${strict[0]}"). A shared blurb must describe stable conditions; an event like this can only be stated in the one month it happens.`,
        });
      }
      const tolerance = SAME_TEXT_TOLERANCE_BY_INTEREST[interestKey] ?? SAME_TEXT_SCORE_TOLERANCE;
      if (scoreSpread > tolerance) {
        issues.push({
          layer: 'content',
          severity: 'reject',
          message: `Months ${monthList} have matching/near-identical text but scores span ${Math.min(...scores)}-${Math.max(...scores)} (spread ${scoreSpread.toFixed(1)} > ${tolerance}) — the text asserts these months are equivalent; the scores disagree.`,
        });
      } else {
        issues.push({
          layer: 'content',
          severity: 'warning',
          message: `Months ${monthList} share duplicate/near-duplicate blurb text (scores agree, within tolerance). Worth a human glance: legitimate if this is a genuinely flat season, a bug if it's lazy repetition of a season that should actually differ.`,
        });
      }
    }
  }

  // Category bleed — marine/reef/dive-specific keywords showing up in a
  // clearly land-based interest's content.
  const slider = SLIDERS.find((s) => s.key === interestKey);
  if (slider && LAND_FORMULAS.has(slider.formula)) {
    const allText = `${overview} ${monthly.map((m) => m.text).join(' ')}`.toLowerCase();
    for (const kw of MARINE_BLEED_KEYWORDS) {
      if (allText.includes(kw)) {
        issues.push({ layer: 'content', severity: 'reject', message: `Category bleed: "${interestKey}" is a land-based (${slider.formula}) interest, but its content mentions "${kw}" — a marine/diving-specific term.` });
      }
    }
  }

  // Banned fluff phrases — cheap, exact-phrase check for the scenic
  // padding the v2 directive explicitly calls out. A reject: these are
  // literal banned strings, not a judgment call.
  {
    const allTextLower = `${overview} ${monthly.map((m) => m.text).join(' ')}`.toLowerCase();
    for (const phrase of BANNED_FLUFF_PHRASES) {
      if (allTextLower.includes(phrase)) {
        issues.push({ layer: 'content', severity: 'reject', message: `Banned fluff phrase found: "${phrase}" — strip scenic/atmospheric padding, use telegraphic field notes instead.` });
      }
    }
    for (const word of BANNED_JARGON_WORDS) {
      if (allTextLower.includes(word)) {
        issues.push({ layer: 'content', severity: 'reject', message: `Field-guide jargon found: "${word}" — use the plain common word instead (e.g. "whale" not "cetacean", "deer" not "ungulate").` });
      }
    }
    hostCheck: for (const t of [overview, ...monthly.map((m) => m.text)]) {
      for (const sentence of t.split(/(?<=[.!?])\s+/)) {
        const hit = sentence.match(HOST_VERB_PATTERN);
        // The rule is about animals; "hosted the Olympics" in a surfing blurb is an event, not a resident species.
        if (hit && interestKey !== 'surfing' && !TRANSIENT_MARKERS.test(sentence)) {
          issues.push({ layer: 'content', severity: 'reject', message: `The verb "host" used for what looks like a permanent resident ("${hit[0]}"). "Host" is only for transient visitors (migrants, winter visitors, seasonal breeders, stopovers); for residents use "holds", "is home to" or "are seen".` });
          break hostCheck;
        }
      }
    }
    // Warnings (not rejects): negative framing and "guaranteed" slipped through in the draw-bird test.
    {
      const allTexts = [overview, ...monthly.map((m) => m.text)];
      const neg = allTexts.map((t) => t.match(/\b(lacks?|lacking|lack of|limited as|no breeding spectacle)\b/i)).find(Boolean);
      if (neg) issues.push({ layer: 'content', severity: 'warning', message: `Negative framing ("${neg[0]}"): never state what a place lacks.` });
      const guar = allTexts.filter((t) => /guarantee/i.test(t)).length;
      if (guar > 0) issues.push({ layer: 'content', severity: 'warning', message: `"guaranteed" appears in ${guar} text(s). Only a key target someone would detour for, or a feeder/blind, earns it; never a bird everyone sees.` });
      // Severity vs score: a month described as extreme/impassable should score well below the peak.
      const peakScore = Math.max(...monthly.map((m) => m.score));
      monthly.forEach((m, i) => {
        if (/extreme heat|severe (storm|weather|rain)|cyclone|hurricane season|snowbound|impassable|largely inaccessible|inaccessible/i.test(m.text) && m.score > 0.5 * peakScore) {
          issues.push({ layer: 'content', severity: 'warning', message: `Month ${i + 1} describes severe conditions but scores ${m.score} (${Math.round((100 * m.score) / peakScore)}% of the ${peakScore} peak). Severe months should be about 40% of peak or lower.` });
        }
      });
      if (/\ball (three|four|of the)\b/i.test(overview)) issues.push({ layer: 'content', severity: 'warning', message: 'Overview says "all three/four/of the": check that every member of the group is really present and common.' });
      // Unexpanded acronyms (rule 2026-10-04): an all-caps abbreviation is fine only if expanded in parentheses on first use.
      {
        const ALLOWED_ACRONYMS = new Set(['UK', 'USA', 'US', 'UAE', 'NP', 'DC', 'NYC', 'BC', 'II', 'III', 'IV']);
        const joined = [overview, ...monthly.map((m) => m.text)].join(' ');
        const found = new Set<string>();
        for (const mm of joined.matchAll(/\b[A-Z]{2,6}\b/g)) {
          const a = mm[0];
          if (ALLOWED_ACRONYMS.has(a)) continue;
          if (!overview.includes(`(${a})`)) found.add(a);
        }
        if (found.size > 0) issues.push({ layer: 'content', severity: 'warning', message: `Acronym(s) not expanded in the overview: ${[...found].join(', ')}. Spell out the organization on first use, with the abbreviation in parentheses.` });
      }
      // Surfing and hiking may say "world-class" (owner decisions 11 and 14 Oct 2026; hiking has its own once-per-place check).
      if (/\b(premier|world-class|top-notch)\b/i.test(overview) && !((interestKey === 'surfing' || interestKey === 'hiking') && !/\b(premier|top-notch)\b/i.test(overview))) issues.push({ layer: 'content', severity: 'warning', message: 'Self-rating word in the overview ("premier"/"world-class"): cut it.' });
    }
  }

  // (Removed 2026-10-07: the "jump needs a recognised cause word" check. A keyword list could not tell a real driver from an unusual wording, and rejected good text. What remains for big swings is the same-text check above: identical text with a big score gap.)

  // Literal-max plateau — a long run at the interest's own ceiling. Needs
  // real comparative research to justify, which is a human/further-research
  // judgment call, not a mechanical bug — warning, not a reject.
  const anchor = INTEREST_ANCHORS[interestKey];
  const ceiling = 10;
  let runStart = -1;
  for (let i = 0; i <= 12; i++) {
    const atCeiling = i < 12 && monthly[i].score >= ceiling - 0.05;
    if (atCeiling && runStart === -1) runStart = i;
    if (!atCeiling && runStart !== -1) {
      const runLength = i - runStart;
      if (runLength >= LITERAL_MAX_RUN_LENGTH) {
        issues.push({
          layer: 'content',
          severity: 'warning',
          message: `Months ${runStart + 1}-${i} (${runLength} months) sit at the literal ceiling (${ceiling}) — needs real justification against every other place claiming the same for this interest, not assumed.`,
        });
      }
      runStart = -1;
    }
  }

  // Anchor ceiling — a non-anchor place should never hit 10. Matches
  // audit-anchors.ts's existing "OVER" hard-error gate exactly — stays a
  // reject, not a judgment call.
  const peak = Math.max(...monthly.map((m) => m.score));
  if (peak >= ceiling - 0.05) {
    if (!anchor) {
      issues.push({ layer: 'content', severity: 'reject', message: `Scored a ${ceiling} but "${interestKey}" has no anchor entry in anchors.ts defining what a 10 means — add one, or lower this.` });
    } else if (!anchor.ten.includes(placeId)) {
      // Surfing (owner, 13 Oct 2026): Gemini is not told which places may be a 10, so an off-list 10 is something to look at, not a failure.
      issues.push({ layer: 'content', severity: OPEN_TEN_INTERESTS.has(interestKey) ? 'warning' : 'reject', message: `"${placeId}" scored a ${ceiling} for "${interestKey}" but is not in that interest's anchor list (${anchor.ten.join(', ')}) — matches audit-anchors.ts's "OVER" gate.` });
    }
  }

  // Word-economy length budget — see LENGTH_TIERS' doc comment. Warning
  // only; a genuinely information-dense overview is allowed to run over.
  {
    const cap = lengthCapFor(peak);
    if (overview.length > cap.overview) {
      issues.push({
        layer: 'content',
        severity: HARD_OVERVIEW_CAP_INTERESTS.has(interestKey) ? 'reject' : 'warning',
        message: `blurb_overall is ${overview.length} characters, over the ${cap.overview}-character guide for this peak score (${peak.toFixed(1)}). Fine if every extra word buys new species/information; a problem if it's restating or generic filler.`,
      });
    }
    // Too short is a flag as well (owner, 11 Oct 2026): a flagship place should use its room to say why it is worth going, what you see and how it works.
    if (overview.length < 0.6 * cap.overview && peak >= 6) {
      issues.push({
        layer: 'content',
        severity: 'warning',
        message: `blurb_overall is only ${overview.length} characters against a ${cap.overview}-character guide for this peak score (${peak.toFixed(1)}). There is room to say more about why it is worth going, what you see there and how trips usually work.`,
      });
    }
    monthly.forEach((m, i) => {
      if (m.text.length > cap.monthly) {
        issues.push({
          layer: 'content',
          severity: 'warning',
          message: `Month ${i + 1}'s blurb is ${m.text.length} characters, over the ${cap.monthly}-character guide for this peak score (${peak.toFixed(1)}).`,
        });
      }
    });
  }

  // Isolated cliff — one month sharply different from both close-together
  // neighbors, no textual reason. "Likely a fitting artifact" per the
  // playbook, but not certain — warning, surfaced for a look.
  for (let i = 0; i < 12; i++) {
    const prev = monthly[(i + 11) % 12].score;
    const next = monthly[(i + 1) % 12].score;
    const cur = monthly[i].score;
    const neighborsClose = Math.abs(prev - next) <= NEIGHBOR_CLOSE_THRESHOLD;
    const curDiffFromBoth = Math.min(Math.abs(cur - prev), Math.abs(cur - next));
    if (neighborsClose && curDiffFromBoth >= CLIFF_THRESHOLD) {
      const textDiffers = !textsMatch(monthly[i].text, monthly[(i + 11) % 12].text) || !textsMatch(monthly[i].text, monthly[(i + 1) % 12].text);
      if (!textDiffers) {
        issues.push({
          layer: 'content',
          severity: 'warning',
          message: `Month ${i + 1} (score ${cur}) differs sharply from both close neighbors (${prev}, ${next}) with no textual justification — likely a fitting artifact, not an authored choice.`,
        });
      }
    }
  }

  return issues;
}

/**
 * Layer 3 (plausibility) — cross-checks against data this pipeline itself
 * fetched for context (naSliders, sibling-interest content), not just the
 * generation's own internal consistency. `naSliderKeys` should already have
 * excluded this place/interest from being generated at all (see the batch
 * runner) — this is a belt-and-suspenders check, not the primary gate.
 */
export function validatePlausibility(naSliderKeys: string[], interestKey: string): ValidationIssue[] {
  if (naSliderKeys.includes(interestKey)) {
    return [{ layer: 'plausibility', severity: 'reject', message: `This place has "${interestKey}" marked N/A — a generation should never have been requested for it.` }];
  }
  return [];
}

/** A generation is only 'valid' (eligible for pipeline:apply) if nothing in
 * it reached 'reject' severity — warnings are recorded but never block. */
export function overallStatus(issues: ValidationIssue[]): 'valid' | 'invalid' {
  return issues.some((i) => i.severity === 'reject') ? 'invalid' : 'valid';
}
