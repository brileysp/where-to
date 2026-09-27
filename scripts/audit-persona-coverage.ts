import { readFileSync } from 'fs';
import { join } from 'path';

/**
 * Which unauthored interests are distorting each persona's results.
 *
 * Every persona weights all 53 sliders, and the weighted read divides by
 * the full weight — so a slider nobody has authored for a destination
 * contributes a zero to the numerator while keeping its weight in the
 * denominator. Measured: a destination's score correlates with how many
 * sliders have been authored for it at r = 0.54 for `connoisseur`, i.e.
 * over half the variance in what that user sees reflects how much content
 * exists rather than how well the place suits them.
 *
 * The ambiguity this exists to surface is the one that started the scoring
 * review: a zero means EITHER "genuinely absent here" (a real editorial
 * claim, which SHOULD cost a persona that wants it) OR "nobody has written
 * it yet" (a data gap wearing a claim's clothes). Only the second is a bug,
 * and only naSliders separates them — so unauthored and N/A are counted
 * apart and never conflated.
 *
 * Two things this deliberately does NOT count:
 *  - `deals`/`crowds`, which are derived at read time (seasonalQuietness)
 *    and have no authored base score by design. Counting them put two
 *    phantom 200s at the top of the first version of this report.
 *  - Low-weight interests, when ranking what to fix. The blend is 75%
 *    rank-decayed over the persona's OWN priority order, so an interest
 *    weighted 2 sits deep in the decay tail and barely moves a result no
 *    matter how unauthored it is. What distorts real output is a gap in an
 *    interest the persona actually cares about.
 */

const DERIVED_SLIDERS = new Set(['deals', 'crowds']);
const TOP_N = 12;

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

async function main() {
  const env = loadDotEnvLocal();
  if (!env.DATABASE_URL) {
    console.error('No DATABASE_URL in .env.local — refusing to run against the PGlite fallback.');
    process.exit(1);
  }
  process.env.DATABASE_URL = env.DATABASE_URL;

  const { eq } = await import('drizzle-orm');
  const { db } = await import('../src/lib/db/client');
  const { places } = await import('../src/lib/db/schema');
  const { getAllScoredPlaces } = await import('../src/lib/db/queries/places');
  const { scoreForMonth } = await import('../src/lib/scoring/rank');
  const { SLIDERS, PERSONAS, allBandsSelected } = await import('../src/lib/scoring/constants');

  const rows = await db
    .select({ id: places.id, name: places.name, baseScores: places.baseScores, naSliders: places.naSliders })
    .from(places)
    .where(eq(places.isPrimaryDestination, true));
  const scored = await getAllScoredPlaces();
  const bands = allBandsSelected();

  const authorable = SLIDERS.map((s) => s.key).filter((k) => !DERIVED_SLIDERS.has(k));
  const tierOf = new Map(SLIDERS.map((s) => [s.key, s.audienceTier]));

  // unauthored = no base score AND not explicitly marked N/A.
  const unauthored = new Map<string, number>();
  const na = new Map<string, number>();
  for (const k of authorable) {
    let u = 0, n = 0;
    for (const r of rows) {
      if ((r.naSliders ?? []).includes(k)) n++;
      else {
        const v = (r.baseScores as Record<string, number>)[k];
        if (v === undefined || v === 0) u++;
      }
    }
    unauthored.set(k, u);
    na.set(k, n);
  }

  const authoredPerDest = new Map(
    scored.map((d) => [d.id, authorable.filter((k) => (d.monthly[k] ?? []).some((v) => v > 0)).length]),
  );

  console.log(`\n=== Persona coverage damage — ${rows.length} destinations, ${authorable.length} authorable interests ===`);
  console.log('unauthored = no base score and NOT marked N/A (a gap, not an editorial claim)');
  console.log('deals/crowds excluded: derived at read time, never authored.\n');

  const globalDamage = new Map<string, number>();

  for (const p of PERSONAS) {
    const ranked = authorable
      .map((k) => ({ key: k, weight: p.weights[k] ?? 0 }))
      .filter((r) => r.weight > 0)
      .sort((a, b) => b.weight - a.weight);
    const core = ranked.slice(0, TOP_N);

    const scores = scored.map((d) => Math.max(...Array.from({ length: 12 }, (_, m) => scoreForMonth(d, p.weights, m, bands))));
    const r = pearson(scored.map((d) => authoredPerDest.get(d.id)!), scores);

    const coreSlots = core.length * rows.length;
    const coreGaps = core.reduce((s, c) => s + unauthored.get(c.key)!, 0);

    console.log(`--- ${p.id} (${p.name}) ---`);
    console.log(`    r(authored count, score) = ${r.toFixed(3)}`);
    console.log(`    top-${TOP_N} interests: ${coreGaps}/${coreSlots} destination-slots unauthored (${((coreGaps / coreSlots) * 100).toFixed(1)}%)`);
    console.log('      ' + 'interest'.padEnd(22) + 'wt'.padStart(4) + 'unauthored'.padStart(12) + 'N/A'.padStart(6) + '  tier');
    for (const c of core) {
      const u = unauthored.get(c.key)!;
      const flag = u >= 100 ? '  <-- majority missing' : u >= 50 ? '  <-- notable gap' : '';
      console.log(
        `      ${c.key.padEnd(22)}${String(c.weight).padStart(4)}${String(u).padStart(12)}${String(na.get(c.key)).padStart(6)}  ${tierOf.get(c.key)}${flag}`,
      );
      globalDamage.set(c.key, (globalDamage.get(c.key) ?? 0) + c.weight * u);
    }
    console.log();
  }

  console.log('=== Priority authoring list ===');
  console.log('Ranked by weight x unauthored destinations, counting only interests that sit in');
  console.log(`some persona's top ${TOP_N} — i.e. gaps that actually move a real user's results.\n`);
  console.log('  ' + 'interest'.padEnd(22) + 'unauthored'.padStart(12) + 'N/A'.padStart(6) + '  tier');
  for (const [k] of [...globalDamage.entries()].sort((a, b) => b[1] - a[1]).slice(0, 15)) {
    console.log(`  ${k.padEnd(22)}${String(unauthored.get(k)).padStart(12)}${String(na.get(k)).padStart(6)}  ${tierOf.get(k)}`);
  }

  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
