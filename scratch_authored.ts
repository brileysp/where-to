import { readFileSync } from 'fs';
import { join } from 'path';

function loadEnv() {
  const raw = readFileSync(join(__dirname, '.env.local'), 'utf8');
  for (const line of raw.split('\n')) {
    const t = line.trim();
    if (!t || t.startsWith('#')) continue;
    const i = t.indexOf('=');
    if (i === -1) continue;
    process.env[t.slice(0, i).trim()] = t.slice(i + 1).trim().replace(/^['"]|['"]$/g, '');
  }
}

const BIG = [
  'themeParks', 'spectatorSports', 'hotSprings', 'safari', 'yogaRetreats', 'horsebackRiding',
  'allInclusive', 'whaleWatching', 'wildflowerBlooms', 'traditionalCrafts', 'auroraChasing',
  'mountaineering', 'indigenousCultures', 'trailRunning', 'geologyVolcanoes', 'nationalParks',
  'campingBackcountry', 'historyArchaeology', 'religiousSites', 'familyFun', 'cityExploration', 'coffeeTea',
];

async function main() {
  loadEnv();
  const { eq } = await import('drizzle-orm');
  const { db } = await import('./src/lib/db/client');
  const { places } = await import('./src/lib/db/schema');

  const rows = await db
    .select({ id: places.id, baseScores: places.baseScores, naSliders: places.naSliders })
    .from(places)
    .where(eq(places.isPrimaryDestination, true));

  for (const k of BIG) {
    const authored = rows
      .filter((r) => {
        const v = (r.baseScores as Record<string, number>)[k];
        return v !== undefined && v > 0;
      })
      .map((r) => `${r.id}:${(r.baseScores as Record<string, number>)[k]}`);
    console.log(`\n${k} — ${authored.length} authored`);
    console.log('  ' + (authored.join(' ') || '(none)'));
  }
  process.exit(0);
}
main();
