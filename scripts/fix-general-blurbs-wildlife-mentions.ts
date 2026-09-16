import { readFileSync } from 'fs';
import { join } from 'path';
import { eq } from 'drizzle-orm';
import { drizzle as drizzlePostgres } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import { places, adminAuditLog } from '../src/lib/db/schema';

// Following up on the general-vs-per-interest cross-check: the plain,
// place-level `monthlyWeather` blurbs (shown for the destination overall,
// separate from any one interest) never mentioned several of the real,
// newly-verified events this session added or fixed. Tight, single-clause
// additions only — weather stays the lead clause, the interest detail is
// a trailing "with/though/and" aside, not a rewrite. Not touching months
// or destinations where the general blurb was already silent for good
// reason (Atacama's Desierto Florido is too rare/unpredictable to belong
// in a "what's this month usually like" blurb; Lofoten's orca claim is
// itself now heavily caveated, not something to foreground).

// month (1-12) -> full replacement text
const PATCHES: Record<string, Record<number, string>> = {
  yellowstone: {
    1: 'bitterly cold, with deep snow and most roads open only to guided snow tours, though prime for wolf-watching',
    2: 'bitterly cold and deep winter with limited road access, but peak wolf-watching season in Lamar Valley',
    3: 'cold, with winter still firmly in control and most interior roads closed, though wolf-watching remains excellent',
  },
  'great-smoky-mountains': {
    9: 'mild and pleasant, with fall color starting at higher elevations and the elk rut beginning at Cataloochee',
    10: 'mild, with fall foliage at its peak, elk bugling at Cataloochee, and the busiest month of the year',
  },
  'cape-cod-islands': {
    7: 'warm, the height of summer with beaches, islands, and whale watching all at their peak',
    8: 'warm and humid, still peak season across the Cape, islands, and whale watching',
  },
  nicaragua: {
    9: 'hot and very wet, one of the rainiest months of the year, though also peak season for La Flor’s turtle arribadas',
    10: 'still hot and rainy, among the wettest stretches of the year, with La Flor’s turtle arribadas at their peak',
  },
  'torres-del-paine': {
    6: 'deep winter, cold and snowy with very limited services, though prime for winter puma tracking',
    7: 'the coldest month, cold and snowy with short daylight hours, but the best month for puma tracking',
    8: 'still deep winter, cold with limited trail access, though puma-tracking odds remain the year’s best',
  },
  hokkaido: {
    12: 'cold and snowy, with ski season underway and red-crowned cranes gathering near Kushiro',
    1: 'the coldest month, deep snow, prime powder skiing, and peak crane-viewing near Kushiro',
    2: 'bitterly cold, with the Sapporo Snow Festival drawing crowds and cranes still at their peak near Kushiro',
    3: 'cold, with snow lingering, the ski season winding down, and cranes still visible near Kushiro',
  },
  maui: {
    12: 'warm, with the wet season’s occasional heavier showers and whale season beginning offshore',
    1: 'warm, with the wet season’s occasional heavier showers, whale season building offshore',
    2: 'warm and still within the wetter half of the year, with whale season at its peak offshore',
    3: 'warm and increasingly dry, as showers ease, with whale season still at its peak',
    4: 'warm and pleasant, one of the best months before summer crowds, with whale season winding down',
  },
  seychelles: {
    9: 'warm and drying out, with the trade winds easing and whale sharks beginning to arrive',
    10: 'warm and calm, one of the best months, with light winds and peak whale shark season',
    11: 'warm and increasingly humid, as the monsoon returns, though whale sharks remain at their peak',
  },
  canaries: {
    4: 'warm and dry, one of the most pleasant months, with the tajinaste rojo beginning to bloom on Tenerife',
    5: 'warm and dry, with comfortable trade winds and Tenerife’s tajinaste rojo at its peak',
    6: 'warm, with steady trade winds, little rain, and the tajinaste rojo bloom tailing off',
  },
  tasmania: {
    11: 'mild and increasingly pleasant, as summer builds and waratahs come into bloom',
    12: 'warm and drying out, with summer beginning in earnest and wildflowers at their peak',
    1: 'warm and mostly dry, the hottest month, prime for beaches, hiking, and the tail of the wildflower season',
  },
  mallorca: {
    1: 'mild and wet, quiet with the fewest visitors, though almond blossom season is beginning',
    2: 'mild, still quiet, good for cycling training, and peak almond blossom season',
  },
  'glacier-waterton': {
    7: 'warm and clear, the height of the short hiking season, with alpine wildflowers at their peak',
    8: 'warm, still prime hiking with the road fully open and wildflowers still going strong',
  },
  'monterey-big-sur': {
    // Both whaleWatching's own data (Feb=0.5, a real dip) and this
    // session's wildlifeViewing fix put Feb between the two whale
    // migrations, not "still excellent" — tightened to lead with the
    // elephant seals, which really do peak this month.
    2: 'cool and often rainy, with peak elephant seal season though whales are between migrations',
  },
};

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
  if (!env.DATABASE_URL) { console.error('No DATABASE_URL'); process.exit(1); }
  process.env.DATABASE_URL = env.DATABASE_URL;
  const dryRun = process.argv.includes('--dry-run');
  const db = drizzlePostgres(postgres(env.DATABASE_URL, { prepare: false }));

  for (const [id, monthPatches] of Object.entries(PATCHES)) {
    const [row] = await db.select().from(places).where(eq(places.id, id));
    if (!row) { console.error(`${id}: not found`); process.exit(1); }
    const monthly = ((row.monthlyWeather as (string | null)[] | null) ?? new Array(12).fill(null)).slice();
    for (const [idx1, text] of Object.entries(monthPatches)) {
      monthly[Number(idx1) - 1] = text;
    }
    console.log(`${id}: patched months [${Object.keys(monthPatches).join(',')}]`);
    if (!dryRun) {
      const patch = { monthlyWeather: monthly };
      const afterRow = { ...row, ...patch };
      await db.transaction(async (tx) => {
        await tx.update(places).set({ ...patch, updatedAt: new Date() }).where(eq(places.id, id));
        await tx.insert(adminAuditLog).values({
          actorId: '00000000-0000-0000-0000-000000000000', entityType: 'destination', entityId: id,
          action: 'update', beforeValue: row, afterValue: afterRow,
        });
      });
    }
  }
  console.log(dryRun ? '\ndry run — nothing written.' : '\ndone.');
  process.exit(0);
}

main().catch((err) => { console.error(err); process.exit(1); });
