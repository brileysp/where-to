import { readFileSync } from 'fs';
import { join } from 'path';
import { eq } from 'drizzle-orm';
import { drizzle as drizzlePostgres } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import { places, adminAuditLog } from '../src/lib/db/schema';

const KEY = 'windSports';

const OVERVIEWS: Record<string, string> = {
  // "Can exceed 50 knots" is an overstatement — Wind-Hounds and other
  // sources put Sotavento's real summer peak at up to ~40 knots in gusts.
  canaries: "Fuerteventura's Sotavento lagoon has hosted the PWA Windsurfing & Kiteboarding World Cup for over 30 years — trade winds here can gust up to 40 knots in peak season. This works essentially year-round, though winter (November through February) is genuinely the least reliable stretch; March through October is when to actually plan a trip.",
};

const MONTHLY: Record<string, string[]> = {
  sicily: [
    'Winter thermal wind at Lo Stagnone — genuinely quieter than summer, but a real, reliable presence, not a dead season.',
    'Winter thermal wind at Lo Stagnone — genuinely quieter than summer, but a real, reliable presence, not a dead season.',
    'Wind picking up at Lo Stagnone as the season builds.',
    'Solid, building thermal wind at Lo Stagnone.',
    'Solid, building thermal wind at Lo Stagnone.',
    'Peak thermal-wind season at Lo Stagnone — one of Europe\'s most reliable flat-water kitesurfing windows.',
    'Peak thermal-wind season at Lo Stagnone — one of Europe\'s most reliable flat-water kitesurfing windows.',
    'Peak thermal-wind season at Lo Stagnone — one of Europe\'s most reliable flat-water kitesurfing windows.',
    'Still strong thermal wind at Lo Stagnone, easing from peak.',
    'Still strong thermal wind at Lo Stagnone, easing from peak.',
    'Winter thermal wind at Lo Stagnone — genuinely quieter than summer, but a real, reliable presence, not a dead season.',
    'Winter thermal wind at Lo Stagnone — genuinely quieter than summer, but a real, reliable presence, not a dead season.',
  ],
  'turks-caicos': [
    'Peak trade-wind season at Long Bay — among the most reliable kitesurfing conditions in the Caribbean.',
    'Peak trade-wind season at Long Bay — among the most reliable kitesurfing conditions in the Caribbean.',
    'Peak trade-wind season at Long Bay — among the most reliable kitesurfing conditions in the Caribbean.',
    'Peak trade-wind season at Long Bay — among the most reliable kitesurfing conditions in the Caribbean.',
    'Peak trade-wind season at Long Bay — among the most reliable kitesurfing conditions in the Caribbean.',
    'Still genuinely good wind at Long Bay, easing into the real summer dip.',
    'The real dip at Long Bay, coinciding with hurricane season — wind is noticeably less consistent than the rest of the year, though not entirely absent.',
    'The real dip at Long Bay, coinciding with hurricane season — wind is noticeably less consistent than the rest of the year, though not entirely absent.',
    'The real dip at Long Bay, coinciding with hurricane season — wind is noticeably less consistent than the rest of the year, though not entirely absent.',
    'The real dip at Long Bay, coinciding with hurricane season — wind is noticeably less consistent than the rest of the year, though not entirely absent.',
    'Trade winds building back at Long Bay toward the winter peak.',
    'Trade winds building back at Long Bay toward the winter peak.',
  ],
  cornwall: [
    'Still within Atlantic storm season at Watergate Bay, easing from the winter peak.',
    'Still within the Atlantic storm season at Watergate Bay, close behind January.',
    'The storm season fading at Watergate Bay, still meaningfully better than the summer lull.',
    'The calmer stretch at Watergate Bay, well short of the Atlantic storm season.',
    'A modest spring uptick at Watergate Bay — real, if inconsistent, breeze.',
    'A modest spring uptick at Watergate Bay — real, if inconsistent, breeze.',
    'Summer at Watergate Bay — genuinely the lightest wind of the year, with real breeze on only about half of days.',
    'Summer at Watergate Bay — genuinely the lightest wind of the year, with real breeze on only about half of days.',
    'Atlantic storm season building at Watergate Bay.',
    'Atlantic storm season building at Watergate Bay.',
    'Peak Atlantic storm season at Watergate Bay — the biggest, most reliable wind and waves of the year.',
    'Peak Atlantic storm season at Watergate Bay — the biggest, most reliable wind and waves of the year.',
  ],
  dubai: [
    'Peak comfort-and-wind season at Kite Beach — strong wind and pleasant temperatures together.',
    'Peak comfort-and-wind season at Kite Beach — strong wind and pleasant temperatures together.',
    'Still strong, comfortable conditions at Kite Beach, easing from peak.',
    'Still strong, comfortable conditions at Kite Beach, easing from peak.',
    'One of the hottest, least comfortable stretches at Kite Beach — real wind, but the heat makes sessions tough.',
    'Shamal season at Kite Beach — genuinely windy, but extreme heat (40°C+) makes this a demanding time to visit.',
    'Shamal season at Kite Beach — genuinely windy, but extreme heat (40°C+) makes this a demanding time to visit.',
    'Shamal season at Kite Beach — genuinely windy, but extreme heat (40°C+) makes this a demanding time to visit.',
    'Shamal season at Kite Beach — genuinely windy, but extreme heat (40°C+) makes this a demanding time to visit.',
    'Cooling slightly at Kite Beach, with solid Shamal wind.',
    'Comfortable temperatures returning to Kite Beach, with solid wind — genuinely within the preferred winter season, not the hot stretch.',
    'Comfortable temperatures returning to Kite Beach, with solid wind.',
  ],
  'los-cabos': [
    'Peak "El Norte" wind season at La Ventana — among the most consistent kiteboarding conditions anywhere.',
    'Peak "El Norte" wind season at La Ventana — among the most consistent kiteboarding conditions anywhere.',
    'Peak "El Norte" wind season at La Ventana — among the most consistent kiteboarding conditions anywhere.',
    'Still strong "El Norte" wind at La Ventana, just past peak.',
    '"El Norte" winds easing at La Ventana as the season winds down.',
    'The real off-season at La Ventana — the "El Norte" thermal wind that drives this spot isn\'t present in summer.',
    'The real off-season at La Ventana — the "El Norte" thermal wind that drives this spot isn\'t present in summer.',
    'The real off-season at La Ventana — the "El Norte" thermal wind that drives this spot isn\'t present in summer.',
    'The real off-season at La Ventana — the "El Norte" thermal wind that drives this spot isn\'t present in summer.',
    'The "El Norte" wind season returning at La Ventana, genuinely underway by late October.',
    'The "El Norte" wind season returning at La Ventana.',
    '"El Norte" wind season building toward peak at La Ventana.',
  ],
  namibia: [
    'Peak kitesurfing season at Walvis Bay Lagoon — the wind at its strongest and most reliable.',
    'Peak kitesurfing season at Walvis Bay Lagoon — the wind at its strongest and most reliable.',
    'Peak kitesurfing season at Walvis Bay Lagoon — the wind at its strongest and most reliable.',
    'Still strong wind at Walvis Bay Lagoon, just past peak.',
    'The quieter stretch at Walvis Bay Lagoon — real wind is still possible, but this isn\'t the season to plan a trip around.',
    'The quieter stretch at Walvis Bay Lagoon — real wind is still possible, but this isn\'t the season to plan a trip around.',
    'The quieter stretch at Walvis Bay Lagoon — real wind is still possible, but this isn\'t the season to plan a trip around.',
    'The quieter stretch at Walvis Bay Lagoon — real wind is still possible, but this isn\'t the season to plan a trip around.',
    'The wind season genuinely beginning to build at Walvis Bay Lagoon, ahead of the main November-April window.',
    'The wind season building at Walvis Bay Lagoon, ahead of the main season.',
    'The wind season building back at Walvis Bay Lagoon.',
    'Wind season building toward peak at Walvis Bay Lagoon.',
  ],
  'nova-scotia': [
    'The only genuinely impractical months at Lawrencetown Beach — too cold for a realistic session.',
    'The only genuinely impractical months at Lawrencetown Beach — too cold for a realistic session.',
    'A modest, consistent local wind-sports scene at Lawrencetown Beach, real but small in scale.',
    'A modest, consistent local wind-sports scene at Lawrencetown Beach, real but small in scale.',
    'A modest, consistent local wind-sports scene at Lawrencetown Beach, real but small in scale.',
    'A modest, consistent local wind-sports scene at Lawrencetown Beach, real but small in scale.',
    'A modest, consistent local wind-sports scene at Lawrencetown Beach, real but small in scale.',
    'A modest, consistent local wind-sports scene at Lawrencetown Beach, real but small in scale.',
    'Fall storm season beginning at Lawrencetown Beach — genuinely the best wind of the year, building toward the peak.',
    'Peak fall storm-wind season at Lawrencetown Beach — the strongest, most consistent wind of the year, cold water notwithstanding.',
    'Peak fall storm-wind season at Lawrencetown Beach — the strongest, most consistent wind of the year, cold water notwithstanding.',
    'The fall storm season easing at Lawrencetown Beach, still notably better than the summer baseline.',
  ],
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

  const missing: string[] = [];
  for (const id of Object.keys(MONTHLY)) {
    if (MONTHLY[id].length !== 12) missing.push(id);
  }
  if (missing.length) { console.error('Bad monthly arrays:', missing); process.exit(1); }

  const allIds = new Set([...Object.keys(OVERVIEWS), ...Object.keys(MONTHLY)]);
  for (const id of allIds) {
    const [row] = await db.select().from(places).where(eq(places.id, id));
    if (!row) { console.error(`${id}: not found`); process.exit(1); }

    const patch: Record<string, unknown> = {};
    if (OVERVIEWS[id]) patch.sliderOverview = { ...(row.sliderOverview as Record<string, string>), [KEY]: OVERVIEWS[id] };
    if (MONTHLY[id]) patch.sliderMonthlyWeather = { ...(row.sliderMonthlyWeather as Record<string, unknown>), [KEY]: MONTHLY[id] };

    console.log(`  ${id}`);
    if (!dryRun) {
      const after = { ...row, ...patch };
      await db.transaction(async (tx) => {
        await tx.update(places).set({ ...patch, updatedAt: new Date() }).where(eq(places.id, id));
        await tx.insert(adminAuditLog).values({
          actorId: '00000000-0000-0000-0000-000000000000', entityType: 'destination', entityId: id,
          action: 'update', beforeValue: row, afterValue: after,
        });
      });
    }
  }
  console.log(dryRun ? '\ndry run — nothing written.' : '\ndone.');
  process.exit(0);
}

main().catch((err) => { console.error(err); process.exit(1); });
