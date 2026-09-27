import { readFileSync } from 'fs';
import { join } from 'path';
import { drizzle as drizzlePostgres } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import { places } from '../src/lib/db/schema';

const MISSING = [
  'sicily', 'north-island', 'turks-caicos', 'mexicocity', 'uyuni', 'egypt', 'olympic', 'redwood',
  'chiapas', 'nova-scotia', 'palau', 'venice', 'antarctica', 'borneo', 'srilanka', 'everglades',
  'rio', 'great-smoky-mountains', 'big-island', 'monterey-big-sur', 'new-orleans', 'madeira',
  'tasmania', 'rome', 'maldives', 'argentine-lake-district', 'kerala', 'seoul',
  'marlborough-abel-tasman', 'canaries', 'chiang-mai', 'acadia', 'london', 'amalfi', 'hokkaido',
  'denali-interior', 'havana', 'banff', 'edinburgh', 'taiwan', 'yosemite', 'mendoza', 'singapore',
  'fiji', 'gbr', 'sardinia', 'vancouver-island', 'galapagos', 'san-miguel-guanajuato', 'kaziranga',
  'bordeaux', 'angkor', 'el-chalten', 'palawan', 'paris', 'upper-peninsula', 'torres-del-paine',
  'tuscany', 'andalucia', 'zion-bryce', 'croatia', 'athens', 'okinawa', 'nice-riviera',
  'luangprabang', 'ghana', 'arches-canyonlands', 'southeast-alaska', 'tierra-del-fuego', 'maui',
  'barbados', 'mauritius', 'santorini', 'rajaampat', 'tokyo-kyoto', 'yellowstone',
  'glacier-waterton', 'ethiopia', 'borabora', 'cape-town', 'hongkong', 'colombian-caribbean',
  'dubai', 'basque-country', 'provence', 'badlands-black-hills', 'lisbon', 'uluru', 'bagan',
  'bangkok', 'algarve', 'thailand', 'queenstown', 'puerto-rico', 'mallorca', 'punta-cana',
  'texas-hill-country', 'azores', 'rajasthan-golden-triangle', 'chilean-lake-district',
  'rivieramaya', 'kruger', 'st-andrews-fife', 'bahamas', 'pantanal', 'seychelles', 'napa',
  'komodo', 'sydney', 'bali', 'vietnam', 'puglia', 'jamaica', 'amsterdam', 'oaxaca', 'barcelona',
];

function loadDotEnvLocal(): Record<string, string> {
  const out: Record<string, string> = {};
  const raw = readFileSync(join(__dirname, '..', '.env.local'), 'utf8');
  for (const line of raw.split('\n')) {
    const t = line.trim();
    if (!t || t.startsWith('#')) continue;
    const i = t.indexOf('=');
    if (i === -1) continue;
    let v = t.slice(i + 1).trim();
    if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) v = v.slice(1, -1);
    out[t.slice(0, i).trim()] = v;
  }
  return out;
}

async function main() {
  const env = loadDotEnvLocal();
  const db = drizzlePostgres(postgres(env.DATABASE_URL, { prepare: false }));
  const rows = await db.select().from(places);

  const flat: string[] = [];
  const seasonal: string[] = [];

  for (const id of MISSING) {
    const row = rows.find((r) => r.id === id);
    if (!row) { console.log(id, 'NOT FOUND'); continue; }
    const bp = (row.birdingPeak as string[] | null) ?? [];
    const monthly = (row.monthlyWeather as unknown[] | null) ?? [];
    const base = (row.baseScores as Record<string, number>)?.birding;
    const events = (row.sliderEvents as Record<string, unknown[]> | null)?.birding;
    const isFlat = bp.length === 0 && !events;
    console.log(
      `${id.padEnd(28)} name="${row.name}" base=${base} birdingPeak=${JSON.stringify(bp)} hasEvent=${!!events}`
    );
    if (isFlat) flat.push(id); else seasonal.push(id);
  }

  console.log(`\nFlat (no birdingPeak flags, no events): ${flat.length}`);
  console.log(flat.join(', '));
  console.log(`\nSeasonal (has birdingPeak flags and/or events): ${seasonal.length}`);
  console.log(seasonal.join(', '));

  process.exit(0);
}

main().catch((err) => { console.error(err); process.exit(1); });
