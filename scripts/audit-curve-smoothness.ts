import { readFileSync } from 'fs';
import { join } from 'path';

/**
 * Finds the "wildlifePeak = +7" shape wherever it still lives — not in the
 * formula source, but in the actual STORED curves, since curves are the
 * read path (deriveDestinationScoresFromCurves) and a formula fix alone
 * changes nothing a user sees until the curve is re-fit or hand-authored.
 *
 * Two signatures, both meaning the same thing: a discrete month-flag bonus
 * got fit into a curve without a ramp.
 *
 *   HARD STEP     an anchor transition with steepness >= HARD_STEEPNESS.
 *                 curve.ts's own comment says it plainly: at extreme k "the
 *                 curve has effectively become a step function." A
 *                 wildlifePeak bonus/wet penalty/hikingBest flag fit
 *                 straight from the old formula produces exactly this —
 *                 flat, flat, flat, VERTICAL JUMP, flat, flat — because the
 *                 formula has no concept of a shoulder month.
 *
 *   FLAT PLATEAU + CLIFF   several consecutive months at (nearly) the same
 *                 value, then a big jump to the next. This is what a step
 *                 function looks like even at a MODEST steepness, once
 *                 several flagged months share one flat bonus and the
 *                 unflagged months share the base.
 *
 * This audit does not touch the source of the shape (formula vs authored
 * curve) — it only asks what the destination actually renders today, which
 * is the only thing a user experiences. It ranks by SLIDER (most affected
 * destinations) and lists the worst individual cases, so a next fix can be
 * chosen by real live impact rather than by re-reading the formula switch
 * from memory.
 *
 * Read-only. `--slider <key>` narrows to one slider; `--place <id>` prints
 * one destination's raw curve for every slider.
 */

const HARD_STEEPNESS = 7; // curve.ts caps at 10; this is "unmistakably a step"
const CLIFF_GAP = 3; // points, adjacent months
const PLATEAU_MIN_RUN = 3; // consecutive identical-ish months before a cliff counts

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
  const { parseSliderCurve } = await import('../src/lib/scoring/curve');

  const scored = await getAllScoredPlaces();
  const sliderArg = process.argv.indexOf('--slider');
  const placeArg = process.argv.indexOf('--place');

  if (placeArg !== -1) {
    const id = process.argv[placeArg + 1];
    const d = scored.find((x) => x.id === id);
    if (!d) { console.error(`No such place: ${id}`); process.exit(1); }
    console.log(`\n${d.name} (${id})\n`);
    for (const s of SLIDERS) {
      const raw = d.sliderCurves?.[s.key];
      if (!raw) continue;
      let curve;
      try { curve = parseSliderCurve(raw); } catch { continue; }
      const anchors = curve.anchors.map((a) => `${a.month}:${a.value}${a.steepness ? `(k${a.steepness})` : ''}`).join(' ');
      console.log(`  ${s.key.padEnd(22)} ${anchors}`);
    }
    process.exit(0);
  }

  type Finding = { id: string; slider: string; kind: 'hard-step' | 'plateau-cliff'; detail: string };
  const findings: Finding[] = [];
  const bySlider = new Map<string, Set<string>>();

  const targetSliders = sliderArg !== -1 ? [process.argv[sliderArg + 1]] : SLIDERS.map((s) => s.key);

  for (const d of scored) {
    for (const key of targetSliders) {
      if (isSliderNA(d, key)) continue;
      const raw = d.sliderCurves[key];
      if (!raw) continue;
      let curve;
      try { curve = parseSliderCurve(raw); } catch { continue; }
      if (curve.anchors.length < 2) continue;

      const flag = (kind: Finding['kind'], detail: string) => {
        findings.push({ id: d.id, slider: key, kind, detail });
        if (!bySlider.has(key)) bySlider.set(key, new Set());
        bySlider.get(key)!.add(d.id);
      };

      // HARD STEP: any anchor whose OWN steepness (which governs the
      // transition INTO it, per curve.ts) is extreme.
      for (const a of curve.anchors) {
        if ((a.steepness ?? 2) >= HARD_STEEPNESS) {
          flag('hard-step', `steepness ${a.steepness} into month ${a.month} (value ${a.value})`);
        }
      }

      // PLATEAU + CLIFF: walk the 12 rendered months — what curveValue
      // actually produces, read straight off the scored destination rather
      // than re-derived, since that is exactly what a user sees — looking
      // for a run of PLATEAU_MIN_RUN+ nearly-identical months immediately
      // followed by a jump of CLIFF_GAP+.
      const rendered: number[] = d.monthly[key] ?? [];
      if (rendered.length === 12) {
        let i = 0;
        while (i < 12) {
          let j = i;
          while (j + 1 < 12 && Math.abs(rendered[j + 1] - rendered[i]) < 0.3) j++;
          const runLen = j - i + 1;
          const nextIdx = (j + 1) % 12;
          const gap = Math.abs(rendered[nextIdx] - rendered[j]);
          if (runLen >= PLATEAU_MIN_RUN && gap >= CLIFF_GAP) {
            flag('plateau-cliff', `flat ${rendered[i].toFixed(1)} for ${runLen} months (idx ${i}-${j}), then jumps ${gap.toFixed(1)} pts`);
          }
          i = j + 1;
        }
      }
    }
  }

  // Rank sliders by number of DISTINCT destinations affected — that is the
  // "how much live impact" number, not the raw finding count.
  const ranked = [...bySlider.entries()].sort((a, b) => b[1].size - a[1].size);
  console.log('=== Sliders ranked by destinations showing a hard step or plateau-cliff\n');
  for (const [key, ids] of ranked) {
    console.log(`  ${String(ids.size).padStart(3)}  ${key}`);
  }

  console.log(`\n=== Worst individual cases (up to 40)\n`);
  const worst = findings
    .filter((f) => f.kind === 'hard-step')
    .slice(0, 40);
  for (const f of worst) console.log(`  ${f.id.padEnd(24)} ${f.slider.padEnd(20)} ${f.detail}`);

  console.log(`\n${findings.length} findings, ${bySlider.size} sliders affected, ${new Set(findings.map((f) => f.id)).size} destinations affected.`);
  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
