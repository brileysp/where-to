import { readFileSync } from 'fs';
import { join } from 'path';

/**
 * Does each interest move the RIGHT WAY against each seasonal flag?
 *
 * This exists because of the sunbathing bug. The `sun` formula docked -2
 * for a `hot` month — a sign copied from the formulas where heat is a
 * hazard — on the one interest whose entire point is heat. Rome scored 0
 * for sunbathing in July and 4 in April, and 45 destinations sagged in
 * exactly the months people go there to lie in the sun. Nothing caught it
 * for the life of the project, because every existing audit asks whether a
 * score is plausible in isolation, and each of those scores was.
 *
 * The bug class is structural, not incidental: 15 sliders share the
 * `hiking` formula, 12 share `culture`, 6 share `swim`. A slider inherits
 * its formula's sign conventions whether or not they fit, so any interest
 * whose defining condition is another interest's hazard is a candidate.
 * `snow` gets this right and is the model — it pays `cold ? +3`, rewarding
 * the very thing that makes skiing possible.
 *
 * The check is empirical rather than a reading of the formulas, so it also
 * catches a wrong sign baked into fitted curves, authored content, or
 * events — the formula is not the only way a score gets its shape.
 *
 * For every (slider, flag) pair it compares the mean score across
 * destinations in flagged months against unflagged months. EXPECTED holds
 * the pairs where we have a real conviction about the sign; everything else
 * prints for eyeballing, sorted by magnitude, because the point is to make
 * the signs visible rather than to pretend they are all decided.
 *
 * Read-only.
 */

type Dir = 'up' | 'down';

/**
 * Declared convictions: how a flag SHOULD move an interest. Only pairs
 * worth asserting are listed — this is a claim about the world, and the
 * cost of getting one wrong is high (two rules asserting "sunbathing needs
 * a beach" manufactured the findings that justified breaking real content).
 */
const EXPECTED: { slider: string; flag: string; dir: Dir; why: string }[] = [
  { slider: 'sunbathing', flag: 'hot', dir: 'up', why: 'heat and sun are the point' },
  { slider: 'sunbathing', flag: 'cold', dir: 'down', why: 'nobody sunbathes in the cold' },
  { slider: 'sunbathing', flag: 'wet', dir: 'down', why: 'rain ends it' },
  { slider: 'skiingSnowboarding', flag: 'cold', dir: 'up', why: 'cold is what makes the snow' },
  { slider: 'skiingSnowboarding', flag: 'noSnow', dir: 'down', why: 'no snow, no skiing' },
  { slider: 'hotSprings', flag: 'cold', dir: 'up', why: 'a hot spring is best on a cold day — the whole appeal' },
  { slider: 'surfing', flag: 'swimHazard', dir: 'up', why: 'the storms that make it hazardous are what make the swell' },
  { slider: 'beachesSwimming', flag: 'swimHazard', dir: 'down', why: 'a hazard is a hazard when you are the swimmer' },
  { slider: 'beachesSwimming', flag: 'cold', dir: 'down', why: 'cold water ends it' },
  { slider: 'auroraChasing', flag: 'cold', dir: 'up', why: 'the aurora needs the long dark nights that come with winter' },
  { slider: 'stargazing', flag: 'dry', dir: 'up', why: 'clear skies' },
  { slider: 'stargazing', flag: 'wet', dir: 'down', why: 'cloud' },
  { slider: 'hiking', flag: 'hot', dir: 'down', why: 'walking in extreme heat is miserable' },
  { slider: 'hiking', flag: 'hikingBest', dir: 'up', why: 'the flag exists to say so' },
  { slider: 'hiking', flag: 'hikingWorst', dir: 'down', why: 'the flag exists to say so' },
  { slider: 'wildlifeViewing', flag: 'wildlifePeak', dir: 'up', why: 'the flag exists to say so' },
  { slider: 'wildlifeViewing', flag: 'wildlifeClosed', dir: 'down', why: 'the reserve is shut' },
  { slider: 'birding', flag: 'birdingPeak', dir: 'up', why: 'the flag exists to say so' },
  { slider: 'wildflowerBlooms', flag: 'wet', dir: 'up', why: 'blooms follow the rain, they do not precede it' },
];

const FLAGS = [
  'dry', 'wet', 'hot', 'cold', 'peak', 'low',
  'wildlifePeak', 'wildlifeClosed', 'birdingPeak',
  'hikingBest', 'hikingWorst', 'inaccessible', 'swimHazard', 'noSnow',
] as const;

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

  const scored = (await getAllScoredPlaces()) as unknown as Array<
    Record<string, unknown> & { id: string; monthly: Record<string, number[]> }
  >;

  type Row = { slider: string; flag: string; on: number; off: number; delta: number; n: number };
  const rows: Row[] = [];

  for (const s of SLIDERS) {
    if (s.key === 'deals' || s.key === 'crowds') continue;
    for (const flag of FLAGS) {
      let onSum = 0, onN = 0, offSum = 0, offN = 0, places = 0;
      for (const d of scored) {
        if (isSliderNA(d as never, s.key)) continue;
        const monthly = d.monthly[s.key];
        const flagged = (d[flag] as number[] | undefined) ?? [];
        if (!monthly?.length || !flagged.length || flagged.length === 12) continue;
        places++;
        for (let m = 0; m < 12; m++) {
          if (flagged.includes(m + 1)) { onSum += monthly[m]; onN++; }
          else { offSum += monthly[m]; offN++; }
        }
      }
      // Too thin to say anything about.
      if (places < 5 || onN === 0 || offN === 0) continue;
      const on = onSum / onN;
      const off = offSum / offN;
      rows.push({ slider: s.key, flag, on, off, delta: on - off, n: places });
    }
  }

  const violations: string[] = [];
  for (const e of EXPECTED) {
    const row = rows.find((r) => r.slider === e.slider && r.flag === e.flag);
    if (!row) {
      violations.push(`  NO DATA  ${e.slider} × ${e.flag} — expected ${e.dir}, but too few destinations carry the flag`);
      continue;
    }
    const actual: Dir = row.delta >= 0 ? 'up' : 'down';
    // A near-zero delta is not a wrong sign, it is no signal — worth
    // knowing when we expected the flag to matter, but not an inversion.
    if (Math.abs(row.delta) < 0.25) {
      violations.push(
        `  FLAT     ${e.slider} × ${e.flag} — expected ${e.dir}, delta ${row.delta.toFixed(2)} across ${row.n} destinations. ${e.why}`,
      );
    } else if (actual !== e.dir) {
      violations.push(
        `  INVERTED ${e.slider} × ${e.flag} — expected ${e.dir}, got ${actual} ` +
          `(${row.on.toFixed(1)} flagged vs ${row.off.toFixed(1)} unflagged, ${row.n} destinations). ${e.why}`,
      );
    }
  }

  console.log(`=== Declared expectations (${EXPECTED.length})`);
  console.log(violations.length ? violations.join('\n') : '  all hold.');

  console.log('\n=== Every slider × flag pair, largest effect first');
  console.log('  delta   flagged  unflagged  n    slider × flag');
  for (const r of rows.sort((a, b) => Math.abs(b.delta) - Math.abs(a.delta)).slice(0, 45)) {
    const sign = r.delta >= 0 ? '+' : '';
    console.log(
      `  ${(sign + r.delta.toFixed(2)).padStart(6)}   ${r.on.toFixed(1).padStart(5)}    ${r.off.toFixed(1).padStart(6)}  ${String(r.n).padStart(3)}  ${r.slider} × ${r.flag}`,
    );
  }

  console.log(`\n${rows.length} pairs measured, ${violations.length} declared expectations not met.`);
  process.exit(violations.some((v) => v.includes('INVERTED')) ? 1 : 0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
