import { readFileSync } from 'fs';
import { join } from 'path';

/**
 * Flags N/A claims that the destination's own authored scores contradict.
 *
 * The zero-triage sweep made N/A the default disposition for every
 * all-zero interest, which closed ~3,300 silent gaps — but it also turned
 * every incomplete exception list into a false editorial claim. That is a
 * worse failure mode than the zeros were: an all-zero row announces itself
 * as unauthored and gets caught by the coverage audits, whereas a wrong
 * N/A says "we considered this and it doesn't apply" and is invisible
 * forever after.
 *
 * So this inverts the existing coverage cross-checks: instead of asking
 * "is this zero suspicious?", it asks "is this N/A suspicious?" — an
 * interest marked inapplicable on a destination that scores highly on a
 * closely related one it must co-occur with. Found on the first run:
 * Finnish Lapland N/A for nationalParks (Urho Kekkonen, Pallas-Yllästunturi),
 * Yellowstone N/A for trailRunning.
 */

const CHECKS: Array<{ target: string; requires: Array<{ key: string; min: number }>; why: string }> = [
  { target: 'nationalParks', requires: [{ key: 'hiking', min: 7 }, { key: 'campingBackcountry', min: 6 }, { key: 'scenicLandscapes', min: 8 }],
    why: 'Strong hiking/camping/scenery almost always implies a protected area worth naming.' },
  { target: 'trailRunning', requires: [{ key: 'hiking', min: 7 }],
    why: 'Where there is serious hiking there are runnable trails.' },
  { target: 'campingBackcountry', requires: [{ key: 'hiking', min: 7 }, { key: 'nationalParks', min: 7 }],
    why: 'Serious hiking or a major park almost always supports camping.' },
  { target: 'landscapePhotography', requires: [{ key: 'scenicLandscapes', min: 8 }],
    why: 'The two are the same thing experienced vs. photographed.' },
  { target: 'historyArchaeology', requires: [{ key: 'architecture', min: 7 }, { key: 'museumsArt', min: 7 }],
    why: 'Strong architecture or museums implies a documented past.' },
  { target: 'cityExploration', requires: [{ key: 'streetFood', min: 6 }, { key: 'nightlife', min: 6 }, { key: 'museumsArt', min: 6 }],
    why: 'Street food, nightlife and museums are urban activities.' },
  { target: 'familyFun', requires: [{ key: 'beachesSwimming', min: 7 }, { key: 'themeParks', min: 5 }],
    why: 'Good beaches or a theme park make a place family-workable.' },
  { target: 'geologyVolcanoes', requires: [{ key: 'hotSprings', min: 6 }],
    why: 'Geothermal activity is volcanic geology by definition.' },
  { target: 'wildlifeViewing', requires: [{ key: 'safari', min: 5 }, { key: 'birding', min: 7 }],
    why: 'Safari or strong birding is wildlife viewing.' },
  { target: 'religiousSites', requires: [{ key: 'historyArchaeology', min: 7 }, { key: 'architecture', min: 8 }],
    why: 'Deep history and monumental architecture usually include sacred sites.' },
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

  const rows = await db
    .select({ id: places.id, name: places.name, baseScores: places.baseScores, naSliders: places.naSliders })
    .from(places)
    .where(eq(places.isPrimaryDestination, true));

  console.log(`\n=== Suspicious N/A claims — ${rows.length} destinations ===`);
  console.log('An interest marked inapplicable, on a destination whose own authored');
  console.log('scores say it should apply. Each needs a real score or a deliberate keep.\n');

  let total = 0;
  for (const c of CHECKS) {
    const hits: string[] = [];
    for (const r of rows) {
      if (!(r.naSliders ?? []).includes(c.target)) continue;
      const b = r.baseScores as Record<string, number>;
      const trigger = c.requires.find((q) => (b[q.key] ?? 0) >= q.min);
      if (trigger) hits.push(`${r.name} (${trigger.key}=${b[trigger.key]})`);
    }
    if (!hits.length) continue;
    total += hits.length;
    console.log(`--- ${c.target}: ${hits.length} suspicious ---`);
    console.log(`    ${c.why}`);
    for (const h of hits) console.log(`      ${h}`);
    console.log();
  }

  console.log(`${total} suspicious N/A claims total.`);
  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
