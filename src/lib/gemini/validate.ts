import { SLIDERS } from '../scoring/constants';
import { INTEREST_ANCHORS } from '../scoring/anchors';
import type { GenerationOutput } from './schema';

export interface ValidationIssue {
  layer: 'schema' | 'content' | 'plausibility';
  /** 'reject' flips the generation's overall status to 'invalid' (blocks
   * pipeline:apply). 'warning' is recorded and surfaced for human review
   * but never blocks on its own — see the duplicate-blurb rule below for
   * why this distinction exists at all. */
  severity: 'reject' | 'warning';
  message: string;
}

const SAME_TEXT_SCORE_TOLERANCE = 0.3; // months with matching text shouldn't diverge by more than this
const CLIFF_THRESHOLD = 2; // an isolated month differing from both neighbors by at least this is suspect
const NEIGHBOR_CLOSE_THRESHOLD = 0.5; // "the neighbors are close to each other" — playbook's own cliff definition
const LITERAL_MAX_RUN_LENGTH = 5; // a run this long at the ceiling needs real justification (playbook §1 Step 6)
const CAUSALITY_DELTA_THRESHOLD = 0.5; // per user decision (2026-09-28) — any adjacent-month swing this large needs a cited driver

// Formula families that are clearly land-based, non-water interests — a
// generation for one of these mentioning reef/dive/snorkel-specific content
// is category bleed, not a legitimate cross-reference (compare to the
// playbook's OWN overlap rule, which is about two interests both covering
// the same land animal from different angles — a genuinely different case
// from a hiking-formula interest describing marine life at all).
const LAND_FORMULAS = new Set(['hiking', 'snow']);
const MARINE_BLEED_KEYWORDS = ['reef', 'coral', 'snorkel', 'scuba', 'dive site', 'diving', 'manta ray', 'whale shark', 'liveaboard'];

// Heuristic markers that a sentence is naming an actual environmental/
// biological driver, not just asserting a score. Deliberately a keyword
// proxy, not true semantic verification — expect this list to need tuning
// once it's run against real generations.
const CAUSALITY_MARKERS = [
  'season', 'seasonal', 'migrat', 'breed', 'spawn', 'nest', 'hatch', 'monsoon', 'rain', 'dry season',
  'wind', 'current', 'temperature', 'peak', 'off-peak', 'close', 'closed', 'open', 'snow', 'melt',
  'flow', 'flood', 'drought', 'because', 'due to', 'when the', 'during', 'storm', 'ice', 'thaw',
  'low water', 'high water', 'runoff', 'tide', 'molt',
];

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
  { maxPeak: 8.0, overview: 480, monthly: 320 },
  { maxPeak: Infinity, overview: 580, monthly: 380 },
];

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
export function validateContent(output: GenerationOutput, interestKey: string, placeId: string): ValidationIssue[] {
  const issues: ValidationIssue[] = [];
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
      if (scoreSpread > SAME_TEXT_SCORE_TOLERANCE) {
        issues.push({
          layer: 'content',
          severity: 'reject',
          message: `Months ${monthList} have matching/near-identical text but scores span ${Math.min(...scores)}-${Math.max(...scores)} (spread ${scoreSpread.toFixed(1)} > ${SAME_TEXT_SCORE_TOLERANCE}) — the text asserts these months are equivalent; the scores disagree.`,
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
  }

  // Score-text causality — a big month-to-month swing must cite a driver.
  for (let i = 0; i < 12; i++) {
    const next = (i + 1) % 12;
    const delta = Math.abs(monthly[i].score - monthly[next].score);
    if (delta < CAUSALITY_DELTA_THRESHOLD) continue;
    const combined = `${monthly[i].text} ${monthly[next].text}`.toLowerCase();
    const hasMarker = CAUSALITY_MARKERS.some((m) => combined.includes(m));
    if (!hasMarker) {
      issues.push({
        layer: 'content',
        severity: 'reject',
        message: `Months ${i + 1}->${next + 1} swing by ${delta.toFixed(1)} (>= ${CAUSALITY_DELTA_THRESHOLD}) but neither month's text names a recognizable environmental/biological driver. (Heuristic keyword check, not true semantic verification — a real driver stated in unusual wording can false-positive here; read the text before assuming this is actually wrong.)`,
      });
    }
  }

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
      issues.push({ layer: 'content', severity: 'reject', message: `"${placeId}" scored a ${ceiling} for "${interestKey}" but is not in that interest's anchor list (${anchor.ten.join(', ')}) — matches audit-anchors.ts's "OVER" gate.` });
    }
  }

  // Word-economy length budget — see LENGTH_TIERS' doc comment. Warning
  // only; a genuinely information-dense overview is allowed to run over.
  {
    const cap = lengthCapFor(peak);
    if (overview.length > cap.overview) {
      issues.push({
        layer: 'content',
        severity: 'warning',
        message: `blurb_overall is ${overview.length} characters, over the ${cap.overview}-character guide for this peak score (${peak.toFixed(1)}). Fine if every extra word buys new species/information; a problem if it's restating or generic filler.`,
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
