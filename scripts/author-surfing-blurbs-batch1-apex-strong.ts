import { readFileSync } from 'fs';
import { join } from 'path';
import { eq } from 'drizzle-orm';
import { drizzle as drizzlePostgres } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import { places, adminAuditLog } from '../src/lib/db/schema';

const KEY = 'surfing';

const OVERVIEWS: Record<string, string> = {
  nicaragua: 'Popoyo is Nicaragua\'s signature wave — a powerful reef break helped by offshore wind so consistent the country gets 300+ days of it a year, thanks to Lake Nicaragua\'s cooling effect. Counterintuitively, the driest months (Jan-Mar) aren\'t the best surf season: the wind gets so strong it can blow conditions out. The real window is April through October, when the wind eases and the swell stays consistent.',
  cornwall: 'Fistral Beach in Newquay is the UK\'s best-known break, and autumn/winter genuinely brings the bigger, more powerful Atlantic swell serious surfers want — at the cost of cold water and stormier conditions. Summer is smaller and more forgiving, better suited to beginners and the crowds that come with it.',
  'basque-country': 'Mundaka, a legendary left-hand river-mouth point break, has hosted the world tour and is regularly named among the best waves in Europe. Its season is genuinely Oct-Feb, despite that being the region\'s worst general weather — the wave barely works at all in summer.',
  'vancouver-island': 'Tofino is a genuinely famous cold-water surf town — winter brings extraordinary 20-30 foot storm swell for experienced surfers, while summer\'s smaller, sandy-bottomed waves are exactly where most people actually learn. Water temperature barely changes with the season, so a thick wetsuit is essential year-round either way.',
  fiji: 'Cloudbreak, a world-class reef pass wave off Tavarua, is one of the most respected big-wave breaks in the Pacific — a real World Surf League venue. The dry season\'s steady trade winds are what make it work; cyclone season is genuinely the wrong time to come.',
  'costa-rica': 'Witch\'s Rock and Ollie\'s Point, both inside Santa Rosa National Park and reachable only by boat, are Costa Rica\'s most famous breaks — made iconic by the surf film Endless Summer 2. The wet season, counterintuitively, brings the more consistent south swell; the dry season is calmer and easier, better for beginners at spots like Tamarindo.',
  canaries: 'Fuerteventura\'s El Cotillo is the standout — powerful, world-class reef breaks that pick up every Atlantic swell, genuinely different from the mellower summer waves elsewhere on the islands. Winter (Oct-Mar) is when it turns on properly; summer is smaller and far more forgiving.',
  gbr: 'This isn\'t really a surf destination — the reef itself blocks most incoming ocean swell close to shore, the same reason its water is calm enough for the diving it\'s actually known for. Any real wave-surfing culture on this stretch of coast is modest and inconsistent.',
  algarve: 'Sagres and nearby Praia do Amado are Portugal\'s southwestern surf hub — exposed to Atlantic swell from multiple directions, so there\'s almost always a wave working somewhere along the coast. Winter brings the biggest, most powerful swell; summer is smaller and busier.',
  srilanka: 'Arugam Bay, on the east coast, is Sri Lanka\'s most famous wave — a long, rippable right-hand point break with rides over 200 meters on a good day. It runs on the opposite calendar from the more-visited west/south coast, so the island genuinely has a good wave somewhere almost year-round.',
  'cape-town': 'Muizenberg is the easy, beginner-friendly win — gentle, sandy-bottomed waves right in the city. The real business is further along the coast toward Jeffreys Bay, one of the world\'s best right-hand point breaks, best in the region\'s cooler winter months.',
  'north-island': 'Raglan\'s Manu Bay is one of the world\'s longest and most famous left-hand point breaks — rides can run several hundred meters on a good day. Winter brings the bigger, more consistent swell; summer is calmer.',
  sydney: 'Bondi and Manly are the easy, iconic beach breaks right in the city, good for beginners and people-watching alike. Autumn and winter bring bigger, more powerful swell for anyone wanting more of a challenge.',
  okinawa: 'Typhoon swell is genuinely the best surf season here — the same storms that make early summer risky for other plans send real groundswell to Okinawa\'s reefs. It\'s a real trade-off: bigger waves, but real storm risk alongside them.',
  'puerto-rico': 'Rincon, on the west coast, is Puerto Rico\'s most famous break — a real winter big-wave destination that put the island on the international surf map in the 1968 World Surfing Championships. Summer is smaller and calmer.',
  rio: 'Arpoador and Barra da Tijuca are the city\'s real surf beaches, right alongside the famous postcard sand — this isn\'t a dedicated pilgrimage destination, but a real, convenient city break. Winter\'s south swell is the more consistent season.',
  maldives: 'Thulusdhoo\'s Cokes, a fast, hollow reef break, is the Maldives\' most famous wave, alongside nearby Sultans and Chickens across the same channel. The southwest monsoon (Mar-Oct) is genuinely the season — reef passes need that swell direction to work at all.',
  'big-island': 'Honoli\'i, near Hilo, is the Big Island\'s best-known break — a real, rivermouth-fed wave popular with local surfers. Winter\'s north swell is the bigger, more consistent season, mirroring the pattern across the rest of Hawaii.',
  panama: 'Santa Catalina, on the Pacific coast, is Panama\'s best-known wave — a powerful, rocky point break that draws experienced surfers from across Central America. The wet season, not the dry one, brings the more consistent south swell.',
  barbados: 'The Soup Bowl, on the rugged east coast, is Barbados\' famous wave and one of the best right-handers in the Caribbean — powerful and reef-fringed, best left to experienced surfers. Winter groundswell is the real season.',
  'los-cabos': 'Costa Azul, near San José del Cabo, is the area\'s best-known break — a real, rocky point break, most consistent during the Pacific hurricane season\'s south swell, which peaks well offshore of Baja without necessarily bringing the storm itself ashore.',
};

const WINTER_BIG = 'Winter swell season — the biggest, most powerful waves of the year.';
const SUMMER_SMALL = 'Smaller, calmer summer swell — the easier, more beginner-friendly season.';

const MONTHLY: Record<string, string[]> = {
  nicaragua: [
    'Offshore wind is at its strongest — sometimes too strong, blowing out otherwise-good swell.',
    'Offshore wind is at its strongest — sometimes too strong, blowing out otherwise-good swell.',
    'Offshore wind is at its strongest — sometimes too strong, blowing out otherwise-good swell.',
    'Conditions are calming into the best window of the year.',
    'The real season — calmer wind and consistent swell, peaking around July.',
    'The real season — calmer wind and consistent swell, peaking around July.',
    'The real season — calmer wind and consistent swell, peaking around July.',
    'The real season — calmer wind and consistent swell, peaking around July.',
    'The real season — calmer wind and consistent swell, peaking around July.',
    'The real season — calmer wind and consistent swell, peaking around July.',
    'Wind is picking back up as the dry season returns.',
    'Wind is picking back up as the dry season returns.',
  ],
  cornwall: [WINTER_BIG, WINTER_BIG, SUMMER_SMALL, SUMMER_SMALL, SUMMER_SMALL, SUMMER_SMALL, SUMMER_SMALL, SUMMER_SMALL, WINTER_BIG, WINTER_BIG, WINTER_BIG, WINTER_BIG],
  'basque-country': [
    'Mundaka\'s season is in full swing — big, powerful, world-class waves, though winter winds can make the estuary choppy.',
    'Mundaka\'s season is in full swing — big, powerful, world-class waves, though winter winds can make the estuary choppy.',
    'A transitional month — Mundaka\'s autumn/winter magic hasn\'t returned and conditions are unsettled.',
    'Summer conditions are pleasant for general beach time, but Mundaka itself barely works this time of year.',
    'Summer conditions are pleasant for general beach time, but Mundaka itself barely works this time of year.',
    'Summer conditions are pleasant for general beach time, but Mundaka itself barely works this time of year.',
    'Summer conditions are pleasant for general beach time, but Mundaka itself barely works this time of year.',
    'Summer conditions are pleasant for general beach time, but Mundaka itself barely works this time of year.',
    'Mundaka\'s season returns — some of the best point-break surfing in Europe.',
    'Mundaka\'s season returns — some of the best point-break surfing in Europe.',
    'Mundaka\'s season returns — some of the best point-break surfing in Europe.',
    'Mundaka\'s season returns — some of the best point-break surfing in Europe.',
  ],
  'vancouver-island': [
    'Winter storm season — huge, powerful swell for experienced surfers, best watched as much as surfed by most visitors.',
    'Winter storm season — huge, powerful swell for experienced surfers, best watched as much as surfed by most visitors.',
    'Winter storm season — huge, powerful swell for experienced surfers, best watched as much as surfed by most visitors.',
    SUMMER_SMALL, SUMMER_SMALL, SUMMER_SMALL, SUMMER_SMALL, SUMMER_SMALL, SUMMER_SMALL,
    'Winter storm season returns.', 'Winter storm season returns.', 'Winter storm season returns.',
  ],
  fiji: [
    'Cyclone season — the least reliable, least safe stretch of the year.',
    'Cyclone season — the least reliable, least safe stretch of the year.',
    'Cyclone season — the least reliable, least safe stretch of the year.',
    'Conditions are turning on fast as the dry season\'s trade winds arrive.',
    'Cloudbreak\'s season — consistent trade winds and world-class waves.',
    'Cloudbreak\'s season — consistent trade winds and world-class waves.',
    'Cloudbreak\'s season — consistent trade winds and world-class waves.',
    'Cloudbreak\'s season — consistent trade winds and world-class waves.',
    'Cloudbreak\'s season — consistent trade winds and world-class waves.',
    'Cloudbreak\'s season — consistent trade winds and world-class waves.',
    'Conditions are easing as cyclone season approaches.',
    'Cyclone risk is building.',
  ],
  'costa-rica': [
    'Dry season — calmer, smaller, and more beginner-friendly at spots like Tamarindo.',
    'Dry season — calmer, smaller, and more beginner-friendly at spots like Tamarindo.',
    'Dry season — calmer, smaller, and more beginner-friendly at spots like Tamarindo.',
    'Dry season — calmer, smaller, and more beginner-friendly at spots like Tamarindo.',
    'Wet season brings a more consistent south swell — the better window for experienced surfers heading to Witch\'s Rock and Ollie\'s Point.',
    'Wet season brings a more consistent south swell — the better window for experienced surfers heading to Witch\'s Rock and Ollie\'s Point.',
    'Wet season brings a more consistent south swell — the better window for experienced surfers heading to Witch\'s Rock and Ollie\'s Point.',
    'Wet season brings a more consistent south swell — the better window for experienced surfers heading to Witch\'s Rock and Ollie\'s Point.',
    'Wet season brings a more consistent south swell — the better window for experienced surfers heading to Witch\'s Rock and Ollie\'s Point.',
    'Wet season brings a more consistent south swell — the better window for experienced surfers heading to Witch\'s Rock and Ollie\'s Point.',
    'Wet season brings a more consistent south swell — the better window for experienced surfers heading to Witch\'s Rock and Ollie\'s Point.',
    'Dry season conditions return.',
  ],
  canaries: [
    'Winter Atlantic swell season — the biggest, most powerful waves at reef breaks like El Cotillo.',
    'Winter Atlantic swell season — the biggest, most powerful waves at reef breaks like El Cotillo.',
    'Winter Atlantic swell season — the biggest, most powerful waves at reef breaks like El Cotillo.',
    SUMMER_SMALL, SUMMER_SMALL, SUMMER_SMALL, SUMMER_SMALL, SUMMER_SMALL, SUMMER_SMALL,
    'Winter swell season returns.', 'Winter swell season returns.', 'Winter swell season returns.',
  ],
  gbr: [
    'The wet season — the least consistent stretch of the year.', 'The wet season — the least consistent stretch of the year.', 'The wet season — the least consistent stretch of the year.',
    'Conditions are marginally better, though this still isn\'t a real surf destination.', 'Conditions are marginally better, though this still isn\'t a real surf destination.',
    'Dry season — calm, clear water, genuinely not built for waves.', 'Dry season — calm, clear water, genuinely not built for waves.', 'Dry season — calm, clear water, genuinely not built for waves.', 'Dry season — calm, clear water, genuinely not built for waves.', 'Dry season — calm, clear water, genuinely not built for waves.',
    'Conditions ease slightly as the wet season approaches.', 'Conditions ease slightly as the wet season approaches.',
  ],
  algarve: [
    'Winter Atlantic swell — the biggest waves of the year.', 'Winter Atlantic swell — the biggest waves of the year.', 'Winter Atlantic swell — the biggest waves of the year.',
    'Smaller, calmer summer swell, and the busiest season for beach crowds.', 'Smaller, calmer summer swell, and the busiest season for beach crowds.', 'Smaller, calmer summer swell, and the busiest season for beach crowds.', 'Smaller, calmer summer swell, and the busiest season for beach crowds.', 'Smaller, calmer summer swell, and the busiest season for beach crowds.', 'Smaller, calmer summer swell, and the busiest season for beach crowds.', 'Smaller, calmer summer swell, and the busiest season for beach crowds.',
    'Winter Atlantic swell — the biggest waves of the year.', 'Winter Atlantic swell — the biggest waves of the year.',
  ],
  srilanka: [
    'One coast or the other is in season — the west/south coast Dec-Apr, Arugam Bay and the east coast May-Sep.',
    'One coast or the other is in season — the west/south coast Dec-Apr, Arugam Bay and the east coast May-Sep.',
    'One coast or the other is in season — the west/south coast Dec-Apr, Arugam Bay and the east coast May-Sep.',
    'One coast or the other is in season — the west/south coast Dec-Apr, Arugam Bay and the east coast May-Sep.',
    'One coast or the other is in season — the west/south coast Dec-Apr, Arugam Bay and the east coast May-Sep.',
    'One coast or the other is in season — the west/south coast Dec-Apr, Arugam Bay and the east coast May-Sep.',
    'One coast or the other is in season — the west/south coast Dec-Apr, Arugam Bay and the east coast May-Sep.',
    'One coast or the other is in season — the west/south coast Dec-Apr, Arugam Bay and the east coast May-Sep.',
    'One coast or the other is in season — the west/south coast Dec-Apr, Arugam Bay and the east coast May-Sep.',
    'The narrow transition between the two coasts\' seasons — the least reliable month on either side.',
    'One coast or the other is in season — the west/south coast Dec-Apr, Arugam Bay and the east coast May-Sep.',
    'One coast or the other is in season — the west/south coast Dec-Apr, Arugam Bay and the east coast May-Sep.',
  ],
  'cape-town': [
    'Summer — calmer, smaller, easier conditions, good for beginners at Muizenberg.', 'Summer — calmer, smaller, easier conditions, good for beginners at Muizenberg.', 'Summer — calmer, smaller, easier conditions, good for beginners at Muizenberg.',
    'Winter swell season — the best window for the region\'s serious point breaks.', 'Winter swell season — the best window for the region\'s serious point breaks.', 'Winter swell season — the best window for the region\'s serious point breaks.', 'Winter swell season — the best window for the region\'s serious point breaks.', 'Winter swell season — the best window for the region\'s serious point breaks.', 'Winter swell season — the best window for the region\'s serious point breaks.',
    'Summer — calmer, smaller, easier conditions, good for beginners at Muizenberg.', 'Summer — calmer, smaller, easier conditions, good for beginners at Muizenberg.', 'Summer — calmer, smaller, easier conditions, good for beginners at Muizenberg.',
  ],
  'north-island': [
    'Summer — calmer, smaller conditions.', 'Summer — calmer, smaller conditions.', 'Summer — calmer, smaller conditions.',
    'Winter swell season — Raglan\'s best window.', 'Winter swell season — Raglan\'s best window.', 'Winter swell season — Raglan\'s best window.', 'Winter swell season — Raglan\'s best window.', 'Winter swell season — Raglan\'s best window.', 'Winter swell season — Raglan\'s best window.',
    'Summer — calmer, smaller conditions.', 'Summer — calmer, smaller conditions.', 'Summer — calmer, smaller conditions.',
  ],
  sydney: [
    'Summer — smaller, warmer, more crowded conditions.', 'Summer — smaller, warmer, more crowded conditions.', 'Summer — smaller, warmer, more crowded conditions.',
    'Bigger, more consistent swell — the better window for experienced surfers.', 'Bigger, more consistent swell — the better window for experienced surfers.', 'Bigger, more consistent swell — the better window for experienced surfers.', 'Bigger, more consistent swell — the better window for experienced surfers.', 'Bigger, more consistent swell — the better window for experienced surfers.',
    'Summer/spring — smaller, warmer, more crowded conditions.', 'Summer/spring — smaller, warmer, more crowded conditions.', 'Summer/spring — smaller, warmer, more crowded conditions.', 'Summer/spring — smaller, warmer, more crowded conditions.',
  ],
  okinawa: [
    'Baseline conditions — modest, inconsistent surf.', 'Baseline conditions — modest, inconsistent surf.', 'Baseline conditions — modest, inconsistent surf.', 'Baseline conditions — modest, inconsistent surf.',
    'The quietest stretch of the year for swell.',
    'Typhoon season sends real groundswell to the reefs — the best waves of the year, with real storm-disruption risk alongside them.', 'Typhoon season sends real groundswell to the reefs — the best waves of the year, with real storm-disruption risk alongside them.', 'Typhoon season sends real groundswell to the reefs — the best waves of the year, with real storm-disruption risk alongside them.', 'Typhoon season sends real groundswell to the reefs — the best waves of the year, with real storm-disruption risk alongside them.',
    'Baseline conditions — modest, inconsistent surf.', 'Baseline conditions — modest, inconsistent surf.', 'Baseline conditions — modest, inconsistent surf.',
  ],
  'puerto-rico': [
    'Winter north swell — Rincon\'s real season, with the biggest, most consistent waves of the year.', 'Winter north swell — Rincon\'s real season, with the biggest, most consistent waves of the year.', 'Winter north swell — Rincon\'s real season, with the biggest, most consistent waves of the year.',
    SUMMER_SMALL, SUMMER_SMALL, SUMMER_SMALL, SUMMER_SMALL, SUMMER_SMALL, SUMMER_SMALL, SUMMER_SMALL,
    'Winter north swell — Rincon\'s real season, with the biggest, most consistent waves of the year.', 'Winter north swell — Rincon\'s real season, with the biggest, most consistent waves of the year.',
  ],
  rio: [
    'Summer — the calmest, smallest, least consistent stretch of the year.', 'Summer — the calmest, smallest, least consistent stretch of the year.', 'Summer — the calmest, smallest, least consistent stretch of the year.',
    'Winter south swell — the more consistent season.', 'Winter south swell — the more consistent season.', 'Winter south swell — the more consistent season.', 'Winter south swell — the more consistent season.', 'Winter south swell — the more consistent season.',
    'Conditions ease as summer approaches.', 'Conditions ease as summer approaches.', 'Conditions ease as summer approaches.',
    'Summer — the calmest, smallest, least consistent stretch of the year.',
  ],
  maldives: [
    'The dry season — calm, but largely flat for surfing; this is prime diving season instead.', 'The dry season — calm, but largely flat for surfing; this is prime diving season instead.',
    'The southwest monsoon swell season — the real window for Thulusdhoo\'s reef breaks.', 'The southwest monsoon swell season — the real window for Thulusdhoo\'s reef breaks.', 'The southwest monsoon swell season — the real window for Thulusdhoo\'s reef breaks.', 'The southwest monsoon swell season — the real window for Thulusdhoo\'s reef breaks.', 'The southwest monsoon swell season — the real window for Thulusdhoo\'s reef breaks.', 'The southwest monsoon swell season — the real window for Thulusdhoo\'s reef breaks.', 'The southwest monsoon swell season — the real window for Thulusdhoo\'s reef breaks.', 'The southwest monsoon swell season — the real window for Thulusdhoo\'s reef breaks.',
    'The narrow transition between seasons — the least reliable month.',
    'The dry season — calm, but largely flat for surfing; this is prime diving season instead.',
  ],
  'big-island': [
    'Winter north swell — the bigger, more consistent season.', 'Winter north swell — the bigger, more consistent season.', 'Winter north swell — the bigger, more consistent season.',
    SUMMER_SMALL, SUMMER_SMALL, SUMMER_SMALL, SUMMER_SMALL, SUMMER_SMALL, SUMMER_SMALL, SUMMER_SMALL,
    'Winter north swell — the bigger, more consistent season.', 'Winter north swell — the bigger, more consistent season.',
  ],
  panama: [
    'Dry season — calmer, smaller, more beginner-friendly conditions.', 'Dry season — calmer, smaller, more beginner-friendly conditions.', 'Dry season — calmer, smaller, more beginner-friendly conditions.',
    'Wet season swell — the more consistent window for Santa Catalina.', 'Wet season swell — the more consistent window for Santa Catalina.', 'Wet season swell — the more consistent window for Santa Catalina.', 'Wet season swell — the more consistent window for Santa Catalina.', 'Wet season swell — the more consistent window for Santa Catalina.', 'Wet season swell — the more consistent window for Santa Catalina.', 'Wet season swell — the more consistent window for Santa Catalina.',
    'A brief, less reliable transitional stretch.',
    'Dry season conditions return.',
  ],
  barbados: [
    'Winter groundswell — the Soup Bowl\'s real season.', 'Winter groundswell — the Soup Bowl\'s real season.', 'Winter groundswell — the Soup Bowl\'s real season.',
    'Conditions are easing.', 'Conditions are easing.',
    'Hurricane season — the least reliable, least consistent stretch of the year.', 'Hurricane season — the least reliable, least consistent stretch of the year.', 'Hurricane season — the least reliable, least consistent stretch of the year.', 'Hurricane season — the least reliable, least consistent stretch of the year.', 'Hurricane season — the least reliable, least consistent stretch of the year.',
    'Winter groundswell — the Soup Bowl\'s real season.', 'Winter groundswell — the Soup Bowl\'s real season.',
  ],
  'los-cabos': [
    'Baseline conditions — modest, inconsistent surf.', 'Baseline conditions — modest, inconsistent surf.', 'Baseline conditions — modest, inconsistent surf.', 'Baseline conditions — modest, inconsistent surf.', 'Baseline conditions — modest, inconsistent surf.',
    'Hurricane-season south swell — the more consistent window for Costa Azul.', 'Hurricane-season south swell — the more consistent window for Costa Azul.', 'Hurricane-season south swell — the more consistent window for Costa Azul.', 'Hurricane-season south swell — the more consistent window for Costa Azul.', 'Hurricane-season south swell — the more consistent window for Costa Azul.',
    'Baseline conditions — modest, inconsistent surf.', 'Baseline conditions — modest, inconsistent surf.',
  ],
};

function loadDotEnvLocal(): Record<string, string> {
  const out: Record<string, string> = {};
  let raw: string;
  try { raw = readFileSync(join(__dirname, '..', '.env.local'), 'utf8'); } catch { return out; }
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
  const dryRun = process.argv.includes('--dry-run');
  const db = drizzlePostgres(postgres(env.DATABASE_URL, { prepare: false }));

  for (const id of Object.keys(OVERVIEWS)) {
    const [row] = await db.select().from(places).where(eq(places.id, id));
    if (!row) { console.error(`${id}: not found`); process.exit(1); }
    if (MONTHLY[id].length !== 12) { console.error(`${id}: monthly array is not length 12 (${MONTHLY[id].length})`); process.exit(1); }
    const patch: Record<string, unknown> = {
      sliderOverview: { ...(row.sliderOverview as Record<string, string>), [KEY]: OVERVIEWS[id] },
      sliderMonthlyWeather: { ...(row.sliderMonthlyWeather as Record<string, (string | null)[]>), [KEY]: MONTHLY[id] },
    };
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
