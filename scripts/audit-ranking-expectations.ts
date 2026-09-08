import { readFileSync } from 'fs';
import { join } from 'path';

/**
 * ============================================================
 *  EDITORIAL GROUND TRUTH — an INPUT, never a generated output
 * ============================================================
 *
 * Hand-authored assertions about what the ranking SHOULD do. This is the
 * spec the scoring model is fitted against; `audit-default-ranking.ts` is
 * the measurement of what it currently DOES. The two must never be
 * collapsed:
 *
 *   NEVER regenerate these expectations from the algorithm's own output.
 *   A baseline refreshed from its own result can only ratify whatever the
 *   model does today — it becomes structurally incapable of detecting its
 *   own regressions. Every assertion below is a human belief about travel,
 *   and changes only by human decision.
 *
 * REVIEW CADENCE: annually. Re-read every `why` and ask whether the belief
 * still holds — destinations rise and fall, and an assertion whose
 * reasoning has expired is worse than no assertion. Record the review date
 * below. This is also where a future visitation-data refresh would land.
 *
 *   Last reviewed: 2026-09-07 (written; grandcanyon band corrected and a
 *   yellowstone>grandcanyon ordering added on the same day's review)
 *
 * WHY THE ASSERTIONS ARE RELATIVE AND BANDED, not exact ranks: content
 * authoring moves absolute positions constantly (a 178-destination pass
 * shifted them the day this was written). A suite that fails whenever
 * someone edits Bali gets muted, and a muted suite protects nothing.
 * Assert orderings and quartiles, which encode the actual editorial claim
 * and survive routine content churn.
 *
 * Written BEFORE the aggregation change, against a measured baseline where
 * r(authored-slider-count, default score) = 0.730 — i.e. the default
 * ranking largely measured how much content had been written about a
 * place, not how appealing it is. Most of these are expected to FAIL until
 * that is fixed; that is the point.
 */

const SNAPSHOT_DIR = join(__dirname, '..', 'docs', 'rankings');

// US/Canadian national parks — named explicitly rather than derived from
// placeType so the set under test is reviewable in one glance.
const NATIONAL_PARKS = [
  'yellowstone', 'yosemite', 'grandcanyon', 'sequoia-kings-canyon', 'denali-interior',
  'glacier-waterton', 'rocky-mountain', 'olympic', 'great-smoky-mountains', 'arches-canyonlands',
  'zion-bryce', 'north-cascades', 'redwood', 'everglades', 'acadia', 'death-valley',
  'badlands-black-hills', 'joshua-tree', 'banff',
];

// Destinations whose appeal is real but narrow — the niche places that
// must NOT float to the top of a no-preference view, and must still be
// reachable when a user asks for what they offer.
const SPECIALIST_PLACES = ['churchill', 'svalbard', 'antarctica', 'falklands', 'kaziranga', 'pantanal', 'peruvian-amazon'];

type Assertion =
  | { kind: 'above'; a: string; b: string; why: string }
  | { kind: 'near'; a: string; b: string; within: number; why: string }
  | { kind: 'band'; id: string; bestRank?: number; worstRank?: number; why: string }
  | { kind: 'persona'; label: string; weights: Record<string, number>; id: string; maxRank: number; why: string }
  | { kind: 'property'; label: string; why: string };

const ASSERTIONS: Assertion[] = [
  // ---- Properties: the structural claims, most valuable of the lot ----
  {
    kind: 'property',
    label: 'coverage-bias',
    why: 'Default score must not be a proxy for how many sliders we happened to author. Measured at r=0.730 before the aggregation change; a ranking that rewards documentation effort over destination quality is measuring the content team, not the world.',
  },
  {
    kind: 'property',
    label: 'national-parks-not-crushed',
    why: 'Major national parks are mainstream destinations with enormous real visitation. They score on few sliders (no nightlife, no shopping, no fine dining) and an averaging model reads that as mediocrity. Median NP rank sat at ~150/200 pre-change, with Yellowstone 123rd — that is a model artifact, not a travel fact.',
  },
  {
    kind: 'property',
    label: 'score-headroom',
    why: 'Nothing scored above 5.17/10 in the default view, so matchLabel() would call literally every destination in the catalog a Weak or Poor match to a new visitor. The best destination for an unspecified traveler should read as at least a good one.',
  },
  {
    kind: 'property',
    label: 'no-specialist-in-top-20',
    why: 'Guards the specific regression risk of strength-based ranking: scoring a place on its best sliders alone would let Churchill (a 10 for polar bears, a 9 for aurora) outrank broadly appealing places. Interest-level audience weighting is what must prevent that.',
  },

  // ---- Bands: where specific destinations belong ----
  { kind: 'band', id: 'yellowstone', bestRank: 1, worstRank: 50, why: 'The archetypal mainstream nature destination — roughly 4M visitors a year. If a general-audience ranking cannot place Yellowstone in its top quartile, the ranking is wrong.' },
  { kind: 'band', id: 'grandcanyon', bestRank: 1, worstRank: 120, why: 'Deliberately looser than Yellowstone (editorial review, 2026-09-07). Awareness is comparable but the visit is not: the Grand Canyon is largely one overwhelming thing absorbed over a day or two, where Yellowstone sustains a week across geothermal features, wildlife, hiking, camping and fishing. It should rank respectably, not in the top quartile. The original top-50 assertion here was wrong — the model already had these two in the right order.' },
  { kind: 'band', id: 'paris', bestRank: 1, worstRank: 30, why: 'If a no-preference "where should I go" list does not surface Paris near the top, the list has no credibility with a general audience.' },
  { kind: 'band', id: 'rome', bestRank: 1, worstRank: 30, why: 'Same as Paris. Sat at 86th pre-change purely for lacking nature content.' },
  { kind: 'band', id: 'nyc', bestRank: 1, worstRank: 30, why: 'Same as Paris.' },
  { kind: 'band', id: 'tuscany', bestRank: 1, worstRank: 40, why: 'Broad mainstream appeal on many axes at once — beautiful towns, food, scenery, history, culture and high-end hotels, not just wine and cycling. Ranked 134th after the aggregation change, which review traced to under-authored content rather than to the model (scenicLandscapes 6 while the same row tagged landscapePhotography signature; historyArchaeology 5 alongside architecture 9). Corrected in scripts/fix-tuscany-underscored.ts — the fix belonged in the content, not the algorithm.' },
  { kind: 'band', id: 'churchill', bestRank: 140, why: 'Genuinely excellent and genuinely niche. It should be findable by someone who wants polar bears, and should not appear in a general list. Currently 196th, but for the wrong reason (thin content, not niche appeal) — this must stay true once coverage stops being the driver.' },
  { kind: 'band', id: 'antarctica', bestRank: 140, why: 'Extreme cost and access put it outside any general recommendation, regardless of how remarkable it is.' },
  {
    kind: 'band', id: 'north-cascades', bestRank: 60, worstRank: 175,
    why: 'Two-sided on purpose. It is last (200th) today on 9 authored sliders, which is a coverage artifact and should improve. But strength-based scoring must not over-correct and reward thin content — a place we know almost nothing about should not outrank places we have documented well. If this lands top-50, the decay constant is too aggressive.',
  },

  // ---- Orderings: each encodes a principle, not a preference ----
  { kind: 'band', id: 'colombian-caribbean', bestRank: 31, why: 'Editorial review, 2026-09-07: it reached 2nd on the strength of a nationalParks score for Tayrona. National parks are an iconic-tier interest, but this destination is not iconic FOR national parks — nobody flies to Colombia for them. A destination must not draw an interest\'s full audience weight unless it is genuinely notable for that interest; this assertion is the guard on that.' },
  { kind: 'above', a: 'yellowstone', b: 'colombian-caribbean', why: 'The same claim stated as an ordering, so it survives both moving together. Yellowstone IS iconic for national parks; Tayrona is a pleasant bonus once you are already there.' },
  { kind: 'above', a: 'yellowstone', b: 'churchill', why: 'Broad-appeal nature over niche-appeal nature — the single clearest statement of what the general view is for.' },
  { kind: 'above', a: 'yellowstone', b: 'grandcanyon', why: 'Comparable fame, different trip. Yellowstone is a multi-day destination with genuinely distributed appeal; the Grand Canyon is a shorter, more singular visit. Encoded as an ordering rather than as two bands so it keeps holding if both move together.' },
  { kind: 'above', a: 'grandcanyon', b: 'uyuni', why: 'Comparable visual spectacle; vastly different awareness and accessibility. Tests that fame and reachability count for something.' },
  { kind: 'above', a: 'paris', b: 'champagne', why: 'A globally iconic city over a narrow regional specialty within the same country.' },
  { kind: 'above', a: 'rome', b: 'piedmont', why: 'Same principle as Paris/Champagne, same country.' },
  { kind: 'above', a: 'kenya', b: 'kaziranga', why: 'Both wildlife destinations; one is the global reference for safari. Tests that being the category archetype counts.' },
  // The safari ladder. These four are the same product at different levels
  // of fame and accessibility, so they are the sharpest available test of
  // whether the model grades within a category rather than just across
  // them — a failure here is invisible to every other assertion.
  { kind: 'near', a: 'kenya', b: 'tanzania', within: 15, why: 'The Mara and the Serengeti are the same ecosystem and the same trip, marketed and priced alike. A model that separates them materially is reading noise, not travel.' },
  { kind: 'above', a: 'kenya', b: 'uganda', why: 'Kenya is the default first safari; Uganda is a gorilla-trekking specialist that far fewer travellers consider.' },
  { kind: 'above', a: 'tanzania', b: 'uganda', why: 'Same claim as Kenya/Uganda — the Serengeti and Kilimanjaro carry recognition Uganda does not.' },
  { kind: 'above', a: 'uganda', b: 'ethiopia', why: 'Both are enthusiast-level East African destinations, but Uganda has a defined draw (gorillas) that converts; Ethiopia is a historical and highland destination with far thinner tourism.' },
  { kind: 'above', a: 'banff', b: 'north-cascades', why: 'Comparable mountain parks, sharply different real-world draw.' },
  { kind: 'above', a: 'nyc', b: 'chicago', why: 'Two US cities with similar activity profiles; one is a global destination. If the model cannot separate them it is not modelling appeal at all.' },
  { kind: 'above', a: 'iceland', b: 'greenland', why: 'Adjacent, similar landscapes; hugely different tourism maturity and access.' },
  { kind: 'above', a: 'venice', b: 'bagan', why: 'Both historic-architecture destinations of genuine world importance; one draws an order of magnitude more travellers.' },
  { kind: 'above', a: 'maui', b: 'punta-cana', why: 'Both beach destinations; one has real breadth beyond the resort strip.' },

  // ---- Personas: the For You path, which the general view must not break ----
  {
    kind: 'persona', label: 'mountaineering-focused', id: 'nepal', maxRank: 15,
    weights: { mountaineering: 10, hiking: 9, scenicLandscapes: 8, campingBackcountry: 7 },
    why: 'The mirror of the general view: when someone states a niche priority, the niche destination must surface. Suppressing specialist places in the default view is only correct if personalisation still finds them.',
  },
  {
    kind: 'persona', label: 'mountaineering-focused', id: 'pakistan', maxRank: 40,
    weights: { mountaineering: 10, hiking: 9, scenicLandscapes: 8, campingBackcountry: 7 },
    why: 'Pakistan should usually not appear in a general list, but for a stated trekking priority it is genuinely world-class and must rank accordingly. This is the assertion that stops general-view suppression from becoming blanket suppression.',
  },
  {
    kind: 'persona', label: 'aurora-focused', id: 'churchill', maxRank: 20,
    weights: { auroraChasing: 10, wildlifeViewing: 8, stargazing: 6 },
    why: 'The exact destination the general view must bury is the one this persona must surface. If both hold, the two modes are doing their separate jobs correctly.',
  },
  {
    kind: 'persona', label: 'beach-focused', id: 'maldives', maxRank: 20,
    weights: { beachesSwimming: 10, sunbathing: 9, diving: 8, luxuryHotels: 7 },
    why: 'Sanity check on the most common real-world travel motivation.',
  },
  {
    kind: 'persona', label: 'city-culture-focused', id: 'paris', maxRank: 10,
    weights: { museumsArt: 10, cityExploration: 9, architecture: 9, fineDining: 8, historyArchaeology: 8 },
    why: 'Where a stated preference and iconic status point the same way, the answer should be unambiguous.',
  },
];

function loadDotEnvLocal(): Record<string, string> {
  const out: Record<string, string> = {};
  let raw: string;
  try {
    raw = readFileSync(join(__dirname, '..', '.env.local'), 'utf8');
  } catch {
    return out;
  }
  for (const line of raw.split('\n')) {
    const t = line.trim();
    if (!t || t.startsWith('#')) continue;
    const i = t.indexOf('=');
    if (i === -1) continue;
    const key = t.slice(0, i).trim();
    let value = t.slice(i + 1).trim();
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1);
    }
    out[key] = value;
  }
  return out;
}

function pearson(xs: number[], ys: number[]): number {
  const n = xs.length;
  const mx = xs.reduce((a, b) => a + b, 0) / n;
  const my = ys.reduce((a, b) => a + b, 0) / n;
  let cov = 0, sx = 0, sy = 0;
  for (let i = 0; i < n; i++) {
    cov += (xs[i] - mx) * (ys[i] - my);
    sx += (xs[i] - mx) ** 2;
    sy += (ys[i] - my) ** 2;
  }
  return cov / Math.sqrt(sx * sy);
}

function median(ns: number[]): number {
  const s = [...ns].sort((a, b) => a - b);
  const m = Math.floor(s.length / 2);
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
}

async function main() {
  const env = loadDotEnvLocal();
  if (!env.DATABASE_URL) {
    console.error('No DATABASE_URL in .env.local — refusing to run against the PGlite fallback.');
    process.exit(1);
  }
  process.env.DATABASE_URL = env.DATABASE_URL;

  const { getAllScoredPlaces } = await import('../src/lib/db/queries/places');
  const { scoreForMonth } = await import('../src/lib/scoring/rank');
  const { allBandsSelected, SLIDERS } = await import('../src/lib/scoring/constants');
  const bands = allBandsSelected();

  const destinations = await getAllScoredPlaces();

  function rankBy(weights: Record<string, number>) {
    const scored = destinations
      .map((d) => {
        const monthly = Array.from({ length: 12 }, (_, m) => scoreForMonth(d, weights, m, bands));
        return { id: d.id, name: d.name, score: Math.max(...monthly) };
      })
      .sort((a, b) => b.score - a.score);
    return {
      rankOf: new Map(scored.map((s, i) => [s.id, i + 1])),
      scoreOf: new Map(scored.map((s) => [s.id, s.score])),
    };
  }

  const dflt = rankBy({});
  const personaCache = new Map<string, ReturnType<typeof rankBy>>();

  const authoredCount = new Map(
    destinations.map((d) => [d.id, SLIDERS.filter((s) => (d.monthly[s.key] ?? []).some((v) => v > 0)).length]),
  );

  let passed = 0;
  const failures: string[] = [];

  function report(ok: boolean, label: string, detail: string) {
    if (ok) passed++;
    else failures.push(`${label} — ${detail}`);
    console.log(`  ${ok ? 'PASS' : 'FAIL'}  ${label.padEnd(42)} ${detail}`);
  }

  console.log(`\n=== Ranking expectations — ${ASSERTIONS.length} assertions, ${destinations.length} destinations ===\n`);

  for (const a of ASSERTIONS) {
    if (a.kind === 'property') {
      if (a.label === 'coverage-bias') {
        const ids = destinations.map((d) => d.id);
        const r = pearson(ids.map((i) => authoredCount.get(i)!), ids.map((i) => dflt.scoreOf.get(i)!));
        report(r < 0.35, a.label, `r(authored, score) = ${r.toFixed(3)} (want < 0.35)`);
      } else if (a.label === 'national-parks-not-crushed') {
        const med = median(NATIONAL_PARKS.map((id) => dflt.rankOf.get(id)!).filter(Boolean));
        report(med < 100, a.label, `median national-park rank = ${med} of ${destinations.length} (want < 100)`);
      } else if (a.label === 'score-headroom') {
        const top = Math.max(...destinations.map((d) => dflt.scoreOf.get(d.id)!));
        report(top >= 6.5, a.label, `top default score = ${top.toFixed(2)} (want >= 6.5, matchLabel's "Good match")`);
      } else if (a.label === 'no-specialist-in-top-20') {
        const offenders = SPECIALIST_PLACES.filter((id) => (dflt.rankOf.get(id) ?? 999) <= 20);
        report(offenders.length === 0, a.label, offenders.length ? `in top 20: ${offenders.join(', ')}` : 'none in top 20');
      }
    } else if (a.kind === 'band') {
      const rank = dflt.rankOf.get(a.id);
      if (!rank) { report(false, `band:${a.id}`, 'destination not found'); continue; }
      const ok = (a.bestRank === undefined || rank >= a.bestRank) && (a.worstRank === undefined || rank <= a.worstRank);
      const want = a.bestRank !== undefined && a.worstRank !== undefined
        ? `${a.bestRank}–${a.worstRank}`
        : a.worstRank !== undefined ? `<= ${a.worstRank}` : `>= ${a.bestRank}`;
      report(ok, `band:${a.id}`, `rank ${rank} (want ${want})`);
    } else if (a.kind === 'near') {
      const ra = dflt.rankOf.get(a.a), rb = dflt.rankOf.get(a.b);
      if (!ra || !rb) { report(false, `near:${a.a}~${a.b}`, 'destination not found'); continue; }
      const gap = Math.abs(ra - rb);
      report(gap <= a.within, `near:${a.a}~${a.b}`, `${ra} vs ${rb} (gap ${gap}, want <= ${a.within})`);
    } else if (a.kind === 'above') {
      const ra = dflt.rankOf.get(a.a), rb = dflt.rankOf.get(a.b);
      if (!ra || !rb) { report(false, `above:${a.a}>${a.b}`, 'destination not found'); continue; }
      report(ra < rb, `above:${a.a}>${a.b}`, `${ra} vs ${rb}`);
    } else {
      const key = JSON.stringify(a.weights);
      if (!personaCache.has(key)) personaCache.set(key, rankBy(a.weights));
      const rank = personaCache.get(key)!.rankOf.get(a.id);
      if (!rank) { report(false, `persona:${a.label}/${a.id}`, 'destination not found'); continue; }
      report(rank <= a.maxRank, `persona:${a.label}/${a.id}`, `rank ${rank} (want <= ${a.maxRank})`);
    }
  }

  console.log(`\n${passed}/${ASSERTIONS.length} passing, ${failures.length} failing.`);
  if (failures.length) {
    console.log('\nFailing:');
    for (const f of failures) console.log(`  - ${f}`);
  }
  console.log(`\n(Snapshots of what the ranking currently does: ${SNAPSHOT_DIR})`);
  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
