import { db } from '../src/lib/db/client';
import { places } from '../src/lib/db/schema';
import { eq } from 'drizzle-orm';
import { toScoringPlace } from '../src/lib/db/queries/places';
import { deriveDestinationScores, isSliderNA } from '../src/lib/scoring/destinations';
import { timingScoreForMonth, weatherComfortScore, scoreLabel } from '../src/lib/scoring/rank';
import { SLIDERS } from '../src/lib/scoring/constants';
import type { ScoringDestination } from '../src/lib/scoring/types';

/**
 * Scans every destination's computed monthly scores for the SHAPES that
 * indicate a real problem, rather than relying on someone happening to
 * open the right destination and noticing something looks off — which is
 * how every bug this check catches was actually found this project (the
 * Colombian Caribbean, Kruger, Yosemite, Sydney, and Churchill bugs, plus
 * a live swallowed-fallback bug in 30 more destinations that was still
 * undiscovered when this script was written).
 *
 * Deliberately does NOT re-check the "events branch swallows the plain
 * fallback" bug class (wildlife/birding/hiking/culture/food all had this
 * at some point) — that's a code-correctness question with an exact,
 * black-and-white answer, and belongs in unit tests (see
 * tests/scoring/destinations.test.ts), which can assert it once against
 * synthetic data instead of re-deriving "what SHOULD this month score"
 * for all 200 real destinations here. This script covers what unit tests
 * structurally can't: content-level statistical anomalies that only show
 * up once real, varied destination data is scored.
 *
 * Checks 1-3 are objective pattern-matches (a real shape either exists or
 * doesn't). Checks 4-8 are lower-precision judgment aids — every finding
 * needs a human to confirm it's actually wrong, not just unusual.
 *
 * Checks 1-6 only ever look at dest.monthly (destinations.ts's per-slider
 * personalized numbers). Checks 7-8 are the only ones that audit the
 * SEPARATE general/"About tab" pipeline (weatherComfortScore +
 * timingScoreForMonth in rank.ts) — added after Aspen, Banff, Denali,
 * Yosemite, Upper Peninsula, Kyrgyzstan, Chiang Mai, and Riviera Maya all
 * shipped with a believable-looking dest.monthly but a general score that
 * never dropped low enough (or never rose high enough) to match their own
 * severity/hazard data, because nothing here ever computed that score
 * before.
 */

// Derived from formula rather than hand-listed (as WEATHER_SENSITIVE_SLIDERS
// already is below) so the new 50-interest taxonomy's hiking-family members
// (mountaineering, national parks, camping, trail running, etc.) are swept
// in automatically instead of silently falling out of this check.
const HIKING_FAMILY = SLIDERS.filter((s) => s.formula === 'hiking').map((s) => s.key);
// Sliders whose real-world activity genuinely tracks weather/season —
// museums, dining, and nightlife are correctly close to flat by design
// (a restaurant scene has no season beyond peak-crowd pricing), so
// running the plateau/cliff shape checks against them was pure noise: a
// first version of this script flagged nearly every "food"/"culture"
// slider in the catalog. Scoping to weather-native formulas only is what
// actually matches the real bugs found this project (Sydney/Kruger/
// Churchill were all hiking-family or wildlife/birding).
const WEATHER_SENSITIVE_FORMULAS = new Set(['hiking', 'wildlife', 'birding', 'sun', 'swim', 'snow']);
const WEATHER_SENSITIVE_SLIDERS = new Set(SLIDERS.filter((s) => WEATHER_SENSITIVE_FORMULAS.has(s.formula)).map((s) => s.key));
const MEANINGFUL_BASE_THRESHOLD = 5; // ignore flat runs on sliders nobody would weight anyway
const CLIFF_GAP_THRESHOLD = 3; // points
const PLATEAU_MIN_RUN = 6; // months

// Checks 7-8 audit the SEPARATE general/"About tab" timing pipeline
// (weatherComfortScore + timingScoreForMonth in rank.ts) — checks 1-6
// above only ever look at dest.monthly, the per-slider personalized
// numbers from destinations.ts. That gap is exactly how Aspen/Banff/
// Denali/Yosemite/Upper Peninsula/Kyrgyzstan/Chiang Mai/Riviera Maya all
// shipped: a minor comfort-independent slider (usually snowsports or
// birding, rarely the destination's real story) was overriding a
// correctly-low comfort score via timingScoreForMonth's own
// Math.max(comfort, exceptionPeak), and since badge-score-disagreement
// (check 5) only fires when a bad-tone badge already sits on the month,
// a month with no flag at all (Aspen's un-flagged mud season) had
// nothing for it to disagree with.
const COMFORT_INDEPENDENT_FORMULAS = new Set(['snow', 'birding', 'wildlife']);
const EXCEPTION_OVERRIDE_THRESHOLD = 6.5; // "Good" boundary — see scoreLabel
const SEVERE_FLOOR_THRESHOLD = 6.5; // a severe/hazard destination's worst month should drop below "Good"

interface Finding {
  check: string;
  destId: string;
  destName: string;
  slider?: string;
  month?: string;
  detail: string;
  // flat-plateau only, for de-duplicating siblings that share one flag's
  // shape — see the grouping step in main().
  runShape?: string;
}

const MONTH_NAMES = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

function longestEqualRun(values: number[]): { start: number; len: number; value: number } {
  let best = { start: 0, len: 0, value: values[0] };
  for (let start = 0; start < 12; start++) {
    let len = 1;
    while (len < 12 && values[(start + len) % 12] === values[start]) len++;
    if (len > best.len) best = { start, len, value: values[start] };
  }
  return best;
}

// Check 2: a single month sitting far from BOTH neighbors, where those two
// neighbors happen to be identical to each other — a lone cliff/spike in
// an otherwise flat context (the real Sydney July shape), as opposed to a
// smooth ramp (three different values in a row, which is fine).
function findIsolatedAnomalies(monthly: number[]): number[] {
  const flagged: number[] = [];
  for (let m = 0; m < 12; m++) {
    const prev = monthly[(m - 1 + 12) % 12];
    const next = monthly[(m + 1) % 12];
    const cur = monthly[m];
    if (prev === next && Math.abs(cur - prev) >= CLIFF_GAP_THRESHOLD) flagged.push(m);
  }
  return flagged;
}

function auditDestination(d: ScoringDestination, findings: Finding[]) {
  const scored = deriveDestinationScores(d);
  const eligibleSliders = SLIDERS.filter((s) => !isSliderNA(d, s.key));

  // Check 2 + 3: per-slider shape checks, weather-native sliders only.
  for (const s of eligibleSliders) {
    if (!WEATHER_SENSITIVE_SLIDERS.has(s.key)) continue;
    const monthly = scored.monthly[s.key];
    const base = d.base[s.key] ?? 0;

    const cliffs = findIsolatedAnomalies(monthly);
    for (const m of cliffs) {
      findings.push({
        check: 'isolated-anomaly',
        destId: d.id,
        destName: d.name,
        slider: s.key,
        month: MONTH_NAMES[m],
        detail: `${MONTH_NAMES[m]}=${monthly[m]} vs both neighbors=${monthly[(m - 1 + 12) % 12]} (gap ${Math.abs(monthly[m] - monthly[(m - 1 + 12) % 12]).toFixed(1)})`,
      });
    }

    if (base >= MEANINGFUL_BASE_THRESHOLD) {
      const run = longestEqualRun(monthly);
      // A run covering all 12 months usually means "no seasonal formula
      // input ever fires for this slider at all" — a content-authoring
      // GAP (nothing to compare against), not the suspicious shape this
      // check is after: a slider that DOES vary somewhere in the year
      // (proving its formula responds to real inputs) but still holds an
      // unexplained multi-month plateau in the middle of that variation —
      // the exact Colombian Caribbean/Kruger/Churchill shape.
      if (run.len >= PLATEAU_MIN_RUN && run.len < 12) {
        findings.push({
          check: 'flat-plateau',
          destId: d.id,
          destName: d.name,
          slider: s.key,
          detail: `${run.len} consecutive months all = ${run.value}, starting ${MONTH_NAMES[run.start]} (base ${base})`,
          runShape: `${run.start}:${run.len}`,
        });
      }
    }
  }

  // Check 4: cross-slider mismatch — this destination has a real,
  // seasonally-shaped WEATHER narrative somewhere (sliderEvents on a
  // weather-native slider), but a sibling hiking-family slider is a
  // single flat value all year despite having a meaningful base. Scoped
  // to weather-sensitive sliders specifically — an earlier version
  // counted ANY sliderEvents, which flagged Madeira's hiking/scenic as
  // suspicious because it has a Flower Festival event; a calendar event
  // says nothing about whether hiking conditions vary, and Madeira's
  // famously stable "island of eternal spring" climate genuinely doesn't.
  const hasRealNarrative = Object.entries(d.sliderEvents || {}).some(
    ([key, events]) =>
      WEATHER_SENSITIVE_SLIDERS.has(key) &&
      events.some((e) => new Set(Object.values(e.months)).size > 1 || Object.keys(e.months).length > 0),
  );
  if (hasRealNarrative) {
    for (const key of HIKING_FAMILY) {
      if (isSliderNA(d, key) || d.sliderEvents?.[key]?.length) continue; // NA, or already has its own narrative
      const base = d.base[key] ?? 0;
      if (base < MEANINGFUL_BASE_THRESHOLD) continue;
      const monthly = scored.monthly[key];
      if (new Set(monthly).size === 1) {
        findings.push({
          check: 'cross-slider-mismatch',
          destId: d.id,
          destName: d.name,
          slider: key,
          detail: `flat ${monthly[0]} all year despite this destination having a real seasonal narrative elsewhere (base ${base})`,
        });
      }
    }
  }

  // Check 5: badge/score disagreement — a 'bad' badge sitting on a month
  // that reads "Excellent", or a 'good' badge on a month reading "Avoid".
  // Deliberately excludes structural/factual badges whose whole point is
  // that ONE thing is unavailable without implying the month is bad
  // overall (no snow in July at a ski resort, off-season shop closures,
  // a water-specific hazard) — timingScoreForMonth already correctly
  // lets a real exception (summer hiking) carry an otherwise-snowless
  // month, and flagging every one of those was pure noise in an earlier
  // version of this check. Only the weather-comfort badges (rain/heat/
  // cold and named hazards) SHOULD track the overall comfort read, which
  // is the actual Andalucía/Galápagos/Kruger bug class this check is for.
  const STRUCTURAL_BADGES = new Set([
    'No snow on the ground',
    'Some shops, hotels & restaurants closed for the season',
    'Storm/hazard risk in the water',
    'Reserve/park closed',
    'Not accessible this month',
    // 'Low season' is a value/crowds claim, not a comfort claim — a month
    // can legitimately be BOTH low season AND genuinely worth avoiding
    // (Death Valley in July is exactly that: nobody visits BECAUSE of
    // the dangerous heat, not despite it). Pairing the two isn't a
    // disagreement, it's the same underlying weather causing both facts.
    'Low season',
  ]);
  for (let m = 0; m < 12; m++) {
    const label = scoreLabel(timingScoreForMonth({ ...d, ...scored }, m)).cls;
    for (const badge of scored.badges[m]) {
      if (STRUCTURAL_BADGES.has(badge.label)) continue;
      if (badge.tone === 'bad' && label === 'excellent') {
        findings.push({
          check: 'badge-score-disagreement',
          destId: d.id,
          destName: d.name,
          month: MONTH_NAMES[m],
          detail: `"${badge.label}" (bad) badge on a month scoring "Excellent"`,
        });
      }
      if (badge.tone === 'good' && label === 'bad') {
        findings.push({
          check: 'badge-score-disagreement',
          destId: d.id,
          destName: d.name,
          month: MONTH_NAMES[m],
          detail: `"${badge.label}" (good) badge on a month scoring "Avoid this month"`,
        });
      }
    }
  }

  // Check 6: unclassified severity, ranked by how likely a real mismatch
  // is — a cheap keyword scan of the destination's own hand-written text,
  // not real NLP. This is a prioritization aid for the ~190 destinations
  // still unclassified, not a verdict — every hit still needs a human to
  // actually read the destination and decide.
  const text = [d.about, d.overview, ...(d.monthlyWeather || [])].filter(Boolean).join(' ').toLowerCase();
  const severeWords = /\b(extreme|brutal|scorching|blistering|bitter(ly)?|harsh|savage|dangerous(ly)?)\b/;
  // Deliberately narrow: "mild"/"gentle" alone are common generic filler
  // (a hotel can be "pleasant," a meal "comfortable") that matched almost
  // every destination in an earlier version of this check. Requiring the
  // word to sit near an actual weather/season term targets genuine
  // climate claims specifically.
  const mildWords = /\b(mild|gentle)\b[^.]{0,25}\b(winter|weather|climate|temperatures?|season)\b|\b(winter|weather|climate|season)\b[^.]{0,25}\b(mild|gentle)\b/;
  const checks: Array<['hot' | 'cold' | 'wet', string | null]> = [
    ['hot', d.hotSeverity],
    ['cold', d.coldSeverity],
    ['wet', d.wetSeverity],
  ];
  for (const [category, severity] of checks) {
    const flagArr = category === 'hot' ? d.hot : category === 'cold' ? d.cold : d.wet;
    if (!flagArr?.length || severity !== null) continue;
    if (severeWords.test(text)) {
      findings.push({
        check: 'severity-review-candidate',
        destId: d.id,
        destName: d.name,
        detail: `${category} unclassified, but text uses severe-sounding language ("${text.match(severeWords)?.[0]}") — likely 'severe'`,
      });
    } else if (mildWords.test(text)) {
      findings.push({
        check: 'severity-review-candidate',
        destId: d.id,
        destName: d.name,
        detail: `${category} unclassified, but text uses mild-sounding language ("${text.match(mildWords)?.[0]}") — likely 'mild'`,
      });
    }
  }

  // Check 7: secondary-peak override — a month reads "Excellent" on the
  // general timing score even though weather comfort alone is nowhere
  // close, meaning a comfort-independent slider (snow/birding/wildlife)
  // is carrying the whole month by itself. Sometimes that's exactly
  // right (Banff's skiing, Kruger's dry-season wildlife) — but just as
  // often the "exception" is a minor, non-primary activity for that
  // destination (Aspen's mud season had no noSnow floor; Chiang Mai's
  // real April/May low-appeal months looked fine only because birding
  // ignored the same severe air-quality hazard tanking everything else).
  // Every hit needs a human to judge whether the driving slider is
  // actually a big enough independent draw to justify the override.
  const scoredDest = { ...d, ...scored };
  for (let m = 0; m < 12; m++) {
    const general = timingScoreForMonth(scoredDest, m);
    const comfort = weatherComfortScore(d, m);
    if (general < 8 || comfort >= EXCEPTION_OVERRIDE_THRESHOLD) continue;
    const drivers = SLIDERS.filter((s) => COMFORT_INDEPENDENT_FORMULAS.has(s.formula) && !isSliderNA(d, s.key))
      .map((s) => ({ key: s.key, v: scored.monthly[s.key][m] }))
      .filter((x) => x.v >= EXCEPTION_OVERRIDE_THRESHOLD)
      .sort((a, b) => b.v - a.v);
    if (drivers.length === 0) continue; // general score came from comfort itself — not this check's concern
    findings.push({
      check: 'secondary-peak-override',
      destId: d.id,
      destName: d.name,
      month: MONTH_NAMES[m],
      detail: `general=${general.toFixed(1)} ("Excellent") vs comfort=${comfort.toFixed(1)} — driven by ${drivers.map((x) => `${x.key}:${x.v}`).join(', ')}`,
    });
  }

  // Check 8: severe-destination floor — a destination flagged severe
  // hot/cold/wet, a severe (or storm-category) seasonal hazard, or with
  // any inaccessible months should have SOME real low point across the
  // year. If even its single worst month still reads "Good" or better,
  // that severity isn't actually landing anywhere — the exact Upper
  // Peninsula/Kyrgyzstan/Greenland shape (a minor snowsports/birding
  // credit kept literally every month above "Good" despite genuinely
  // brutal winters). One finding per destination, not per month — the
  // question here is "does this destination have a believable low
  // point," which only needs the single minimum to answer.
  const severeReasons: string[] = [];
  if (d.hotSeverity === 'severe') severeReasons.push('hot:severe');
  if (d.coldSeverity === 'severe') severeReasons.push('cold:severe');
  if (d.wetSeverity === 'severe') severeReasons.push('wet:severe');
  if (d.inaccessible.length > 0) severeReasons.push(`inaccessible:${d.inaccessible.length}mo`);
  for (const hz of d.seasonalHazards || []) {
    if (hz.severity === 'severe' || hz.category === 'storm') severeReasons.push(`hazard:${hz.category}:${hz.severity}`);
  }
  if (severeReasons.length > 0) {
    let minScore = Infinity;
    let minMonth = 0;
    for (let m = 0; m < 12; m++) {
      const g = timingScoreForMonth(scoredDest, m);
      if (g < minScore) {
        minScore = g;
        minMonth = m;
      }
    }
    if (minScore >= SEVERE_FLOOR_THRESHOLD) {
      findings.push({
        check: 'severe-floor-too-high',
        destId: d.id,
        destName: d.name,
        month: MONTH_NAMES[minMonth],
        detail: `worst month is still ${scoreLabel(minScore).text} (${minScore.toFixed(1)}) despite ${severeReasons.join(', ')}`,
      });
    }
  }
}

async function main() {
  // Place migration Phase 6 completed (2026-09-07): `destinations` no
  // longer exists. Reads `places`, filtered to isPrimaryDestination — same
  // 200-destination scope this audit always covered — via
  // deriveDestinationScores directly (the OLD formula, still the real
  // content-authoring "compile source" for curve-based scoring's fitted
  // curves; auditing it is still the right layer for content-shape checks).
  const rows = await db.select().from(places).where(eq(places.isPrimaryDestination, true));
  const findings: Finding[] = [];

  for (const row of rows) {
    const d = toScoringPlace(row);
    auditDestination(d, findings);
  }

  // flat-plateau: 3+ sibling sliders at the same destination sharing the
  // exact same run shape are reporting ONE underlying flag (a real,
  // deliberately-authored season), not N separate anomalies — collapse
  // them into a single line. What's actually interesting is the opposite
  // case: a slider whose plateau shape nothing else at that destination
  // shares, meaning it's the odd one out.
  const plateauGroups = new Map<string, Finding[]>();
  for (const f of findings) {
    if (f.check !== 'flat-plateau') continue;
    const key = `${f.destId}:${f.runShape}`;
    if (!plateauGroups.has(key)) plateauGroups.set(key, []);
    plateauGroups.get(key)!.push(f);
  }
  const collapsedPlateaus: Finding[] = [];
  for (const group of plateauGroups.values()) {
    if (group.length >= 3) {
      const [first] = group;
      const [, len] = first.runShape!.split(':').map(Number);
      collapsedPlateaus.push({
        ...first,
        slider: `${group.length} sliders`,
        detail: `${len}-month shared plateau across ${group.map((g) => g.slider).join(', ')} — one underlying flag, not a per-slider issue`,
      });
    } else {
      collapsedPlateaus.push(...group);
    }
  }

  const otherFindings = findings.filter((f) => f.check !== 'flat-plateau');
  const allFindings = [...otherFindings, ...collapsedPlateaus];

  const byCheck = new Map<string, Finding[]>();
  for (const f of allFindings) {
    if (!byCheck.has(f.check)) byCheck.set(f.check, []);
    byCheck.get(f.check)!.push(f);
  }

  const order = [
    'isolated-anomaly',
    'flat-plateau',
    'cross-slider-mismatch',
    'badge-score-disagreement',
    'secondary-peak-override',
    'severe-floor-too-high',
    'severity-review-candidate',
  ];
  for (const check of order) {
    const list = byCheck.get(check) || [];
    console.log(`\n=== ${check} (${list.length}) ===`);
    for (const f of list) {
      console.log(`  ${f.destId.padEnd(28)} ${(f.slider ?? '').padEnd(10)} ${(f.month ?? '').padEnd(4)} ${f.detail}`);
    }
  }

  const rawPlateauCount = findings.filter((f) => f.check === 'flat-plateau').length;
  console.log(
    `\nTotal findings: ${allFindings.length} across ${rows.length} destinations ` +
      `(flat-plateau collapsed from ${rawPlateauCount} raw per-slider lines to ${collapsedPlateaus.length}).`,
  );
  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
