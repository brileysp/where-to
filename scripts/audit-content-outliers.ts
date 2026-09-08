import { readFileSync } from 'fs';
import { join } from 'path';

/**
 * Finds destinations whose CLAIMS contradict each other.
 *
 * This is the complement to audit-scoring-consistency.ts, which looks at
 * the SHAPE of a destination's year (plateaus, cliffs, weather that
 * disagrees with the score). Nothing there can catch a curve that is
 * beautifully shaped and simply asserts the wrong thing — Bagan claiming
 * world-reference architecture with no authored tier behind it, a place
 * scored 9 for sunbathing whose swimming is N/A, a "signature" interest
 * that peaks at 4.
 *
 * RULE 1 COMPARES AGAINST THE MONTHLY PEAK, NEVER THE BASE. This is not a
 * detail. An earlier version of this check read tokyo-kyoto's
 * wildflowerBlooms base of 2 against its "signature" tier, called it a
 * contradiction, and raised the slider to 10 — putting cherry blossom at 10
 * in December across 14 destinations before the mistake was caught. On a
 * seasonal interest the base is the OFF-season floor; a signature claim is
 * a claim about the peak, and only the peak.
 *
 * Every finding here needs a human. These are contradictions, not verdicts:
 * the fix is sometimes the score, sometimes the tier, and sometimes the
 * rule needs a documented exception.
 *
 * Read-only. `--place <id>` prints one destination's full profile instead.
 */

// There were two more rules here, both encoding "sunbathing requires a
// beach": a dominance rule capping sunbathing near beachesSwimming, and a
// prerequisite treating a sunbathing score over a beachesSwimming N/A as a
// contradiction. The premise is false — people sunbathe by hotel pools, on
// terraces, by lakes and in deserts — and the false premise did real
// damage before anyone questioned it: it flagged the Atacama, Uluru and
// Napa, a "fix" then marked all three N/A for sunbathing (the Atacama is
// among the sunniest places on earth), and it pushed Provence and Tuscany
// down for sunbathing on Mediterranean summers. Rules here assert
// something about the world; when one is wrong it manufactures the
// findings that justify breaking the content.

/** b bounds a: a is a subset or a photograph of b and cannot exceed it by more than `slack`. */
const DOMINANCE: { a: string; b: string; slack: number; why: string }[] = [
  { a: 'safari', b: 'wildlifeViewing', slack: 0, why: 'safari is a kind of wildlife viewing' },
  { a: 'landscapePhotography', b: 'scenicLandscapes', slack: 0, why: 'a photograph cannot beat its landscape' },
  { a: 'allInclusive', b: 'beachesSwimming', slack: 2, why: 'the resort format is a beach format' },
  { a: 'yogaRetreats', b: 'spaWellness', slack: 2, why: 'retreats sit inside the wellness scene' },
];

/** If `need` is N/A, `have` scoring at or above `at` is a contradiction. */
const PREREQUISITES: { have: string; need: string; at: number }[] = [
  { have: 'nationalParks', need: 'hiking', at: 7 },
  { have: 'diving', need: 'beachesSwimming', at: 7 },
  { have: 'birding', need: 'wildlifeViewing', at: 7 },
  { have: 'safari', need: 'wildlifeViewing', at: 7 },
  { have: 'landscapePhotography', need: 'scenicLandscapes', at: 7 },
];

/**
 * Per formula family, the month-flag fields that DECLARE a season for it.
 * Rule 5 only fires where one of these is set on part of the year and the
 * slider it exists to drive stays flat anyway.
 */
const SEASON_DRIVERS: Record<string, ('wildlifePeak' | 'wildlifeClosed' | 'birdingPeak' | 'noSnow' | 'swimHazard' | 'hikingBest' | 'hikingWorst' | 'inaccessible')[]> = {
  wildlife: ['wildlifePeak', 'wildlifeClosed'],
  birding: ['birdingPeak'],
  snow: ['noSnow'],
  swim: ['swimHazard'],
  hiking: ['hikingBest', 'hikingWorst', 'inaccessible'],
};

/**
 * Interests where a tier deliberately sits BELOW the score, so the gap is
 * policy rather than a contradiction.
 *
 * `nationalParks` is the whole of this list: the US-centric notch says a
 * non-US park generally isn't "signature" for its destination even when the
 * park itself is excellent, because the slider's iconic audience weight
 * would otherwise hand every protected landscape on earth the pull of
 * Yellowstone. Decoupling score from tier is exactly what that notch is
 * FOR, so scanning for the decoupling and calling it an error just
 * re-reports the policy 60 times.
 */
const NOTCHED_BY_POLICY = new Set(['nationalParks']);

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
    let value = t.slice(i + 1).trim();
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1);
    }
    out[t.slice(0, i).trim()] = value;
  }
  return out;
}

async function main() {
  const env = loadDotEnvLocal();
  if (!env.DATABASE_URL) {
    console.error('No DATABASE_URL in .env.local — refusing to run against the PGlite fallback.');
    process.exit(1);
  }
  process.env.DATABASE_URL = env.DATABASE_URL;
  // Dynamic, after the env is set — see review-scenic-saturation.ts.
  const { getAllScoredPlaces } = await import('../src/lib/db/queries/places');
  const { isSliderNA } = await import('../src/lib/scoring/destinations');
  const { SLIDERS } = await import('../src/lib/scoring/constants');
  const { NEVER_NA } = await import('../src/lib/scoring/destinations');
  const { AUDIENCE_WEIGHT, SIGNATURE_WEIGHT, effectiveSignatureTier } = await import('../src/lib/scoring/rank');

  const scored = await getAllScoredPlaces();
  const byKey = new Map(SLIDERS.map((s) => [s.key, s]));
  const peakOf = (d: (typeof scored)[number], key: string) =>
    isSliderNA(d, key) ? null : Math.max(...(d.monthly[key] ?? [0]));

  const placeArg = process.argv.indexOf('--place');
  if (placeArg !== -1) {
    const id = process.argv[placeArg + 1];
    const d = scored.find((x) => x.id === id);
    if (!d) { console.error(`No such place: ${id}`); process.exit(1); }
    console.log(`\n${d.name} (${id})\n`);
    const rows = SLIDERS.map((s) => {
      const peak = peakOf(d, s.key);
      if (peak === null || peak === 0) return null;
      const floor = Math.min(...(d.monthly[s.key] ?? [0]));
      const authored = d.signatureTier?.[s.key];
      const tier = effectiveSignatureTier(d, s.key, peak);
      return {
        key: s.key,
        peak,
        floor,
        aud: s.audienceTier,
        tier,
        authored: Boolean(authored),
        contribution: AUDIENCE_WEIGHT[s.audienceTier] * SIGNATURE_WEIGHT[tier] * peak,
      };
    }).filter((r): r is NonNullable<typeof r> => r !== null);
    rows.sort((a, b) => b.contribution - a.contribution);
    console.log('  contrib  peak floor  audience     tier            interest');
    for (const r of rows.slice(0, 15)) {
      console.log(
        `  ${r.contribution.toFixed(2).padStart(6)}   ${r.peak.toFixed(1).padStart(4)} ${r.floor.toFixed(1).padStart(4)}  ` +
          `${r.aud.padEnd(11)} ${(r.tier + (r.authored ? '' : ' (inferred)')).padEnd(15)} ${r.key}`,
      );
    }
    process.exit(0);
  }

  type Finding = { rule: string; id: string; detail: string };
  const findings: Finding[] = [];
  let inferredTopDraws = 0;

  for (const d of scored) {
    // RULE 0 — the central invariant: nothing scores zero in every month.
    //
    // A zero row is indistinguishable from an unauthored one, and it drags
    // a destination in the ranking in exactly the way an N/A does not. A
    // genuine year-round absence belongs in naSliders. This existed as an
    // agreed rule for most of a session before anything checked it, and a
    // NEVER_NA_SLIDERS override in destinations.ts was silently
    // manufacturing fifteen of them.
    for (const s of SLIDERS) {
      if (s.key === 'deals' || s.key === 'crowds') continue;
      if (isSliderNA(d, s.key)) continue;
      const m = d.monthly[s.key] ?? [];
      if (m.length && Math.max(...m) < 0.01) {
        findings.push({ rule: 'zero-every-month', id: d.id, detail: `${s.key}: 0 in all twelve months — score it or mark it N/A` });
      }
    }

    // RULE 0b — an naSliders entry that NEVER_NA_SLIDERS refuses to honour.
    //
    // The guard in destinations.ts is right that some interests are never
    // structurally absent, but it used to drop the author's claim on the
    // floor: 37 destinations carried a sunbathing N/A that did nothing, and
    // a content pass wrote three more, reported success, and had none.
    // A rejected claim has to be visible, or the author never learns the
    // real answer is "score it low", not "mark it absent".
    for (const key of (d.naSliders ?? [])) {
      if (NEVER_NA.has(key)) {
        findings.push({ rule: 'na-claim-ignored', id: d.id, detail: `${key}: in naSliders, but this interest is never treated as absent — score it instead` });
      }
    }

    // RULE 1 — an authored tier that disagrees with the destination's own peak.
    for (const s of SLIDERS) {
      const authored = d.signatureTier?.[s.key];
      if (!authored) continue;
      const peak = peakOf(d, s.key);
      if (peak === null) {
        findings.push({ rule: 'tier-on-na', id: d.id, detail: `${s.key}: tier "${authored}" but the slider is N/A` });
        continue;
      }
      if (authored === 'signature' && peak < 6) {
        findings.push({ rule: 'tier-too-high', id: d.id, detail: `${s.key}: "signature" but peaks at ${peak.toFixed(1)}` });
      }
      // Only "none" counts, and only outside the notch policy. "casual" at a
      // peak of 9 is the notch band itself — a real and common editorial
      // position ("excellent here, but not what this place is FOR"), so
      // flagging it produced 98 findings that were almost all deliberate.
      if (authored === 'none' && peak >= 9 && !NOTCHED_BY_POLICY.has(s.key)) {
        findings.push({ rule: 'tier-too-low', id: d.id, detail: `${s.key}: "none" but peaks at ${peak.toFixed(1)}` });
      }
    }

    // RULE 2 — dominance: one interest logically bounds another.
    for (const { a, b, slack, why } of DOMINANCE) {
      const pa = peakOf(d, a);
      const pb = peakOf(d, b);
      if (pa === null || pb === null || pa === 0 || pb === 0) continue;
      if (pa > pb + slack + 0.01) {
        findings.push({ rule: 'dominance', id: d.id, detail: `${a} ${pa.toFixed(1)} > ${b} ${pb.toFixed(1)} — ${why}` });
      }
    }

    // RULE 3 — a prerequisite marked N/A under an interest that needs it.
    for (const { have, need, at } of PREREQUISITES) {
      const ph = peakOf(d, have);
      if (ph === null || ph < at) continue;
      if (isSliderNA(d, need)) {
        findings.push({ rule: 'na-contradiction', id: d.id, detail: `${have} ${ph.toFixed(1)} but ${need} is N/A` });
      }
    }

    // RULE 4 — RETIRED, kept as a coverage counter.
    //
    // A score with no authored tier infers "signature" from the score
    // itself, and that inferred tier then amplifies the same score. Two
    // attempts to turn that into a finding both failed: "top draw is
    // inferred" fired on 143 destinations (Rome's architecture 10 infers
    // "signature" and is RIGHT), and narrowing it to "an inferred draw
    // outranks an authored signature" still fired on 57, because
    // signatureTier authoring is sparse and skewed toward specialist
    // interests — so Yosemite led by scenery over its authored nationalParks
    // tier is the notch policy working, not a bug.
    //
    // There is no mechanical proxy for "this destination's top draw is
    // wrong". That judgement is what the anchor sets in
    // src/lib/scoring/anchors.ts encode, and audit-anchors.ts already
    // enforces it. All that survives here is the coverage number, which is
    // a real work queue: each of these is a destination whose position
    // rests on a tier nobody wrote down.
    const contributions = SLIDERS.map((s) => {
      const peak = peakOf(d, s.key);
      if (peak === null || peak === 0) return null;
      const tier = effectiveSignatureTier(d, s.key, peak);
      return { authored: Boolean(d.signatureTier?.[s.key]), tier, value: AUDIENCE_WEIGHT[s.audienceTier] * SIGNATURE_WEIGHT[tier] * peak };
    }).filter((c): c is NonNullable<typeof c> => c !== null);
    const top = contributions.sort((a, b) => b.value - a.value)[0];
    if (top && !top.authored && top.tier === 'signature') inferredTopDraws++;

    // RULE 5 — the destination declares a season its own slider ignores.
    //
    // A flat score is not itself wrong: the Canaries really are a 10 for
    // sunbathing in February, and the Galapagos really is year-round. Naive
    // flatness fired on 65 destinations, most of them correct. The
    // contradiction is when a destination has ALREADY declared a seasonal
    // driver in its month flags — a wildlife peak, a closure, a snowless
    // stretch — and the slider that flag exists to drive doesn't move.
    for (const s of SLIDERS) {
      const driver = SEASON_DRIVERS[s.formula];
      if (!driver) continue;
      const flagged = new Set<number>();
      for (const field of driver) for (const m of (d[field] ?? []) as number[]) flagged.add(m);
      // No declared season, or a "season" covering the whole year: nothing
      // to contradict.
      if (flagged.size === 0 || flagged.size >= 12) continue;

      const peak = peakOf(d, s.key);
      if (peak === null || peak < 7) continue;
      const floor = Math.min(...(d.monthly[s.key] ?? [0]));
      if (peak - floor >= 1.5) continue;
      findings.push({
        rule: 'declared-season-ignored',
        id: d.id,
        detail:
          `${s.key}: ${floor.toFixed(1)}-${peak.toFixed(1)} all year, but ` +
          `${driver.join('/')} flags ${flagged.size} month(s)`,
      });
    }
  }

  const order = ['zero-every-month', 'na-claim-ignored', 'tier-on-na', 'na-contradiction', 'dominance', 'tier-too-high', 'tier-too-low', 'declared-season-ignored'];
  for (const rule of order) {
    const hits = findings.filter((f) => f.rule === rule);
    if (!hits.length) continue;
    console.log(`\n=== ${rule} (${hits.length})`);
    const byPlace = new Map<string, string[]>();
    for (const h of hits) byPlace.set(h.id, [...(byPlace.get(h.id) ?? []), h.detail]);
    const sorted = [...byPlace].sort((a, b) => b[1].length - a[1].length);
    for (const [id, details] of sorted.slice(0, 40)) {
      console.log(`  ${id}`);
      for (const detail of details) console.log(`      ${detail}`);
    }
    if (sorted.length > 40) console.log(`  … and ${sorted.length - 40} more destinations`);
  }

  console.log(`\n${findings.length} findings across ${new Set(findings.map((f) => f.id)).size} destinations.`);
  // Coverage, not an error — see rule 4. Worth watching: every one of these
  // is a destination whose position rests on a tier nobody wrote down.
  console.log(`${inferredTopDraws}/${scored.length} destinations are led by an INFERRED signature tier.`);
  console.log(`(${byKey.size} interests, ${scored.length} destinations scanned)`);
  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
