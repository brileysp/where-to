import { readFileSync } from 'fs';
import { join } from 'path';

/**
 * Reports drift between the catalogue and src/lib/scoring/anchors.ts.
 *
 * Three failure modes, in the order they matter:
 *
 *   OVER   a destination peaks at 10 but is not in that interest's anchor
 *          set. This is the saturation failure — the one that made a
 *          scenic 10 meaningless when 117 destinations held one.
 *   UNDER  an anchor has fallen below 10. Either the content moved or the
 *          anchor set is out of date; both are worth knowing.
 *   BAD    an anchor names a slider or a place id that doesn't exist.
 *
 * It also lists interests with no ceiling defined at all, which is the
 * work queue rather than an error.
 *
 * Read-only. Nothing here writes to the database.
 */

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
  // Dynamic, after the env is set — db/client.ts reads process.env at module
  // load and silently falls back to the local PGlite sandbox otherwise.
  const { getAllScoredPlaces } = await import('../src/lib/db/queries/places');
  const { isSliderNA } = await import('../src/lib/scoring/destinations');
  const { SLIDERS } = await import('../src/lib/scoring/constants');
  const { INTEREST_ANCHORS } = await import('../src/lib/scoring/anchors');

  const scored = await getAllScoredPlaces();
  const ids = new Set(scored.map((d) => d.id));
  const sliderKeys = new Set(SLIDERS.map((s) => s.key));

  let bad = 0;
  let over = 0;
  let under = 0;

  for (const [key, anchor] of Object.entries(INTEREST_ANCHORS)) {
    if (!sliderKeys.has(key)) {
      console.log(`BAD    ${key}: not a slider key`);
      bad++;
      continue;
    }
    const unknown = anchor.ten.filter((id) => !ids.has(id));
    if (unknown.length) {
      console.log(`BAD    ${key}: unknown place ids — ${unknown.join(' ')}`);
      bad += unknown.length;
    }

    const anchorSet = new Set(anchor.ten);
    const peaks = new Map(
      scored
        .filter((d) => !isSliderNA(d, key))
        .map((d) => [d.id, Math.max(...(d.monthly[key] ?? [0]))] as const),
    );

    const overs = [...peaks].filter(([id, p]) => p >= 9.99 && !anchorSet.has(id)).map(([id]) => id);
    if (overs.length) {
      console.log(`OVER   ${key.padEnd(22)} ${overs.length} at 10 outside the anchor set: ${overs.join(' ')}`);
      over += overs.length;
    }

    const unders = anchor.ten.filter((id) => ids.has(id) && (peaks.get(id) ?? 0) < 9.99);
    if (unders.length) {
      const detail = unders.map((id) => `${id}=${(peaks.get(id) ?? 0).toFixed(1)}`).join(' ');
      console.log(`UNDER  ${key.padEnd(22)} ${unders.length} anchor(s) below 10: ${detail}`);
      under += unders.length;
    }
  }

  const undefined_ = SLIDERS.filter((s) => !INTEREST_ANCHORS[s.key] && s.key !== 'deals' && s.key !== 'crowds');
  if (undefined_.length) {
    console.log(`\nNo ceiling defined (${undefined_.length}): ${undefined_.map((s) => s.key).join(' ')}`);
  }

  const anchored = Object.keys(INTEREST_ANCHORS).length;
  console.log(
    `\n${anchored} interests anchored, ` +
      `${Object.values(INTEREST_ANCHORS).reduce((n, a) => n + a.ten.length, 0)} anchor destinations.`,
  );
  console.log(`${bad} bad, ${over} over, ${under} under.`);
  process.exit(bad || over ? 1 : 0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
