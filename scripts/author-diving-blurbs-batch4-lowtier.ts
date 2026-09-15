import { readFileSync } from 'fs';
import { join } from 'path';
import { eq } from 'drizzle-orm';
import { drizzle as drizzlePostgres } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import { places, adminAuditLog } from '../src/lib/db/schema';

const KEY = 'diving';

const OVERVIEWS: Record<string, string> = {
  'new-orleans': 'Not a diving or snorkeling destination — no reef and no clear water nearby; this is a food-and-music city, not a coastal one in any relevant sense.',
  'guilin-yangshuo': 'Not a diving or snorkeling destination — inland limestone karst scenery, no coast.',
  svalbard: 'Diving here is a genuinely extreme, specialist activity — near-freezing Arctic water under pack ice, done only by a small number of dedicated cold-water technical divers. Not a mainstream activity for a typical visitor.',
  'charleston-savannah': 'Not a diving or snorkeling destination — murky, low-visibility coastal water; this is a history-and-architecture stop, not a coastal activity one.',
  greenland: 'Diving here is an extreme, specialist activity — icy water among calving glaciers, done only by a small number of dedicated cold-water divers. Not a realistic activity for a typical visitor.',
  'belfast-giants-causeway': 'Not a real diving or snorkeling destination — cold, murky North Atlantic water; the Giant\'s Causeway is a geology stop, not a coastal activity one.',
  vermont: 'Not a diving or snorkeling destination — landlocked, with only lakes; no real dive culture.',
  'scottish-highlands-skye': 'Real but very niche cold-water diving exists around Skye\'s sea lochs, but this isn\'t a reason most people visit — cold, dark water with limited visibility.',
  'st-andrews-fife': 'Not a real diving or snorkeling destination — cold North Sea water with limited visibility.',
  'hudson-valley': 'Not a diving or snorkeling destination — inland, no coast.',
  olympic: 'Cold Pacific Northwest water with real but very niche diving — most visitors never do it; the park is a hiking and rainforest destination.',
  'nova-scotia': 'Cold Atlantic water with real but niche wreck and reef diving — a small, dedicated local scene rather than a visitor draw. Icebergs and whale watching are the region\'s better-known water activities.',
  everglades: 'Not a diving destination — murky freshwater and brackish water, low visibility; wildlife-watching by airboat is the park\'s real water activity.',
  'milford-sound-fiordland': 'Real, distinctive cold-water diving exists in the fiord\'s unusual layered water — a freshwater layer sits on top of the seawater, creating deep-water conditions at shallow depths — but this is a niche, specialist activity, not a mainstream one.',
  ireland: 'Real but niche cold-water diving exists around the coast — shipwrecks and reef, done mostly by a small local diving community rather than visitors.',
  'faroe-islands': 'Cold, dramatic North Atlantic water with real but very niche diving — not a mainstream activity here.',
  provence: 'Not a dedicated diving destination — this is a lavender-and-hill-towns region, well inland from any real coast.',
  'cape-cod-islands': 'Cold New England water with real but niche wreck diving — most visitors are here for the beaches, not diving.',
  lofoten: 'Cold, dramatic Arctic water with real but very niche diving — a specialist activity, not a visitor draw.',
  athens: 'Real but modest Aegean diving exists nearby — clear water, some ancient wrecks — though it\'s a clear secondary activity to the ruins.',
  venice: 'Not a diving destination — the lagoon is shallow, murky, and has essentially zero visibility; this is a city built on water, not a place to dive in it.',
  kerala: 'Real but modest diving exists around Kerala\'s coast and nearby Lakshadweep islands, though it\'s a clear secondary activity to the backwaters and beaches.',
  hokkaido: 'Cold water with real, if niche, diving in summer — a small specialist activity compared to Hokkaido\'s famous skiing and wildlife-watching.',
  istanbul: 'Real but modest Bosphorus and Sea of Marmara diving exists, mostly wrecks — a niche activity, not a reason to visit.',
  ghana: 'Not a dedicated diving destination — Atlantic surf and murky coastal water; wildlife and cultural sites are the real draw here.',
  'southeast-alaska': 'Cold water with real, niche diving among kelp forests and marine life — a small specialist activity compared to the region\'s famous wildlife cruises.',
  fjords: 'Cold, dramatic fjord water with real but very niche diving — a specialist activity, not a visitor draw.',
  'tokyo-kyoto': 'Not a dedicated diving destination in these cities themselves — real diving exists elsewhere in Japan (Okinawa, the Izu Peninsula), well outside this itinerary.',
  'basque-country': 'Real but modest Bay of Biscay diving exists, cold Atlantic water rather than Mediterranean — a niche activity alongside the region\'s famous surfing and food.',
  cornwall: 'Real, if cold-water, diving exists around Cornwall\'s coast — wrecks and Atlantic reef, a genuine niche activity for those willing to brave the cold.',
  morocco: 'The Atlantic coast has real, modest diving — cooler water than the Mediterranean, a clear secondary activity to the souks and mountain trekking.',
};

const MONTHLY: Record<string, string[]> = {
  'new-orleans': Array(12).fill('Not a diving or snorkeling destination in any month.'),
  'guilin-yangshuo': Array(12).fill('Not a diving or snorkeling destination in any month.'),
  svalbard: Array(12).fill('An extreme, specialist activity in every month — near-freezing water year-round, not something a typical visitor does.'),
  'charleston-savannah': Array(12).fill('Not a diving or snorkeling destination in any month.'),
  greenland: Array(12).fill('An extreme, specialist activity in every month — icy water year-round, not something a typical visitor does.'),
  'belfast-giants-causeway': Array(12).fill('Not a real diving or snorkeling destination in any month.'),
  vermont: Array(12).fill('Not a diving or snorkeling destination in any month.'),
  'scottish-highlands-skye': Array(12).fill('A real but very niche activity year-round — cold, dark water with limited visibility every month.'),
  'st-andrews-fife': Array(12).fill('Not a real diving or snorkeling destination in any month.'),
  'hudson-valley': Array(12).fill('Not a diving or snorkeling destination in any month.'),
  olympic: Array(12).fill('A real but very niche activity year-round — cold water, limited visibility every month.'),
  'nova-scotia': [
    'Too cold for realistic access.', 'Too cold for realistic access.',
    'A real, niche local diving season, though most visitors are here for other reasons.', 'A real, niche local diving season, though most visitors are here for other reasons.', 'A real, niche local diving season, though most visitors are here for other reasons.', 'A real, niche local diving season, though most visitors are here for other reasons.', 'A real, niche local diving season, though most visitors are here for other reasons.', 'A real, niche local diving season, though most visitors are here for other reasons.', 'A real, niche local diving season, though most visitors are here for other reasons.', 'A real, niche local diving season, though most visitors are here for other reasons.',
    'A real, niche local diving season, though most visitors are here for other reasons.', 'A real, niche local diving season, though most visitors are here for other reasons.',
  ],
  everglades: [
    'Not a diving destination this time of year — murky, low-visibility water.', 'Not a diving destination this time of year — murky, low-visibility water.', 'Not a diving destination this time of year — murky, low-visibility water.', 'Not a diving destination this time of year — murky, low-visibility water.',
    'Not a diving destination this time of year — murky, low-visibility water.',
    'Not a diving destination — murky water and real hurricane risk.', 'Not a diving destination — murky water and real hurricane risk.', 'Not a diving destination — murky water and real hurricane risk.', 'Not a diving destination — murky water and real hurricane risk.', 'Not a diving destination — murky water and real hurricane risk.',
    'Not a diving destination this time of year — murky, low-visibility water.',
    'Not a diving destination this time of year — murky, low-visibility water.',
  ],
  'milford-sound-fiordland': [
    'The more accessible season for the fiord\'s distinctive layered-water diving.', 'The more accessible season for the fiord\'s distinctive layered-water diving.', 'The more accessible season for the fiord\'s distinctive layered-water diving.', 'The more accessible season for the fiord\'s distinctive layered-water diving.',
    'Winter conditions make this a much less realistic window.', 'Winter conditions make this a much less realistic window.', 'Winter conditions make this a much less realistic window.', 'Winter conditions make this a much less realistic window.', 'Winter conditions make this a much less realistic window.',
    'The more accessible season for the fiord\'s distinctive layered-water diving.', 'The more accessible season for the fiord\'s distinctive layered-water diving.', 'The more accessible season for the fiord\'s distinctive layered-water diving.',
  ],
  ireland: Array(12).fill('A real but niche activity year-round, done mostly by a small local diving community rather than visitors.'),
  'faroe-islands': [
    'Too cold and stormy for realistic access.', 'Too cold and stormy for realistic access.', 'Too cold and stormy for realistic access.',
    'A real, niche diving season, though a genuinely specialist activity here.', 'A real, niche diving season, though a genuinely specialist activity here.', 'A real, niche diving season, though a genuinely specialist activity here.', 'A real, niche diving season, though a genuinely specialist activity here.', 'A real, niche diving season, though a genuinely specialist activity here.', 'A real, niche diving season, though a genuinely specialist activity here.', 'A real, niche diving season, though a genuinely specialist activity here.',
    'Too cold and stormy for realistic access.', 'Too cold and stormy for realistic access.',
  ],
  provence: Array(12).fill('Not a dedicated diving destination in any month.'),
  'cape-cod-islands': [
    'Too cold for realistic access.', 'Too cold for realistic access.',
    'A real, niche local diving season, though most visitors are here for the beaches.', 'A real, niche local diving season, though most visitors are here for the beaches.', 'A real, niche local diving season, though most visitors are here for the beaches.', 'A real, niche local diving season, though most visitors are here for the beaches.', 'A real, niche local diving season, though most visitors are here for the beaches.', 'A real, niche local diving season, though most visitors are here for the beaches.', 'A real, niche local diving season, though most visitors are here for the beaches.', 'A real, niche local diving season, though most visitors are here for the beaches.',
    'A real, niche local diving season, though most visitors are here for the beaches.',
    'Too cold for realistic access.',
  ],
  lofoten: [
    'Too cold and dark for realistic access.', 'Too cold and dark for realistic access.', 'Too cold and dark for realistic access.',
    'A real, niche diving season, though a genuinely specialist activity here.', 'A real, niche diving season, though a genuinely specialist activity here.',
    'The most accessible window of the year, though still a specialist activity.', 'The most accessible window of the year, though still a specialist activity.', 'The most accessible window of the year, though still a specialist activity.',
    'A real, niche diving season, though a genuinely specialist activity here.', 'A real, niche diving season, though a genuinely specialist activity here.',
    'Too cold and dark for realistic access.', 'Too cold and dark for realistic access.',
  ],
  athens: [
    'Too cold for most casual diving.',
    'A real, modest local diving season, secondary to the ruins.', 'A real, modest local diving season, secondary to the ruins.', 'A real, modest local diving season, secondary to the ruins.', 'A real, modest local diving season, secondary to the ruins.',
    'The warmest, most comfortable water of the year.', 'The warmest, most comfortable water of the year.', 'The warmest, most comfortable water of the year.',
    'A real, modest local diving season, secondary to the ruins.', 'A real, modest local diving season, secondary to the ruins.',
    'Too cold for most casual diving.', 'Too cold for most casual diving.',
  ],
  venice: Array(12).fill('Not a diving destination in any month — the lagoon has essentially zero visibility.'),
  kerala: [
    'The more comfortable, dry-season stretch for the coast and nearby islands.', 'The more comfortable, dry-season stretch for the coast and nearby islands.', 'The more comfortable, dry-season stretch for the coast and nearby islands.',
    'Conditions ease as the monsoon approaches.', 'Conditions ease as the monsoon approaches.',
    'Monsoon season — genuinely poor conditions for diving.', 'Monsoon season — genuinely poor conditions for diving.', 'Monsoon season — genuinely poor conditions for diving.', 'Monsoon season — genuinely poor conditions for diving.',
    'Conditions are recovering.', 'Conditions are recovering.',
    'The more comfortable, dry-season stretch returns.',
  ],
  hokkaido: [
    'Too cold for realistic access.', 'Too cold for realistic access.', 'Too cold for realistic access.',
    'A real, niche diving season, though a small specialist activity here.', 'A real, niche diving season, though a small specialist activity here.',
    'The most accessible window of the year, though still a niche activity.', 'The most accessible window of the year, though still a niche activity.', 'The most accessible window of the year, though still a niche activity.',
    'A real, niche diving season, though a small specialist activity here.', 'A real, niche diving season, though a small specialist activity here.', 'A real, niche diving season, though a small specialist activity here.',
    'Too cold for realistic access.',
  ],
  istanbul: [
    'A real, modest local diving season.',
    'Too cold for most casual diving.',
    'A real, modest local diving season.',
    'The clearest, most comfortable stretch of the year.', 'The clearest, most comfortable stretch of the year.',
    'A real, modest local diving season.', 'A real, modest local diving season.', 'A real, modest local diving season.',
    'The clearest, most comfortable stretch of the year.', 'The clearest, most comfortable stretch of the year.',
    'A real, modest local diving season.', 'A real, modest local diving season.',
  ],
  ghana: [
    'Dry season, though this still isn\'t a diving destination — Atlantic surf and murky water.', 'Dry season, though this still isn\'t a diving destination — Atlantic surf and murky water.', 'Dry season, though this still isn\'t a diving destination — Atlantic surf and murky water.',
    'Not a diving destination.',
    'Not a diving destination.', 'Not a diving destination.', 'Not a diving destination.',
    'Not a diving destination.',
    'Not a diving destination.', 'Not a diving destination.',
    'Dry season returns, though this still isn\'t a diving destination.', 'Dry season returns, though this still isn\'t a diving destination.',
  ],
  'southeast-alaska': [
    'Too cold for realistic access.', 'Too cold for realistic access.', 'Too cold for realistic access.',
    'A real, niche diving season begins, though a small specialist activity here.', 'A real, niche diving season begins, though a small specialist activity here.',
    'The most accessible window of the year, though still a niche activity compared to the region\'s wildlife cruises.', 'The most accessible window of the year, though still a niche activity compared to the region\'s wildlife cruises.', 'The most accessible window of the year, though still a niche activity compared to the region\'s wildlife cruises.',
    'A real, niche diving season, though a small specialist activity here.', 'A real, niche diving season, though a small specialist activity here.',
    'Too cold for realistic access.', 'Too cold for realistic access.',
  ],
  fjords: [
    'Too cold and dark for realistic access.', 'Too cold and dark for realistic access.', 'Too cold and dark for realistic access.',
    'A real, niche diving season, though a genuinely specialist activity here.', 'A real, niche diving season, though a genuinely specialist activity here.',
    'The most accessible window of the year, though still a specialist activity.', 'The most accessible window of the year, though still a specialist activity.', 'The most accessible window of the year, though still a specialist activity.',
    'A real, niche diving season, though a genuinely specialist activity here.', 'A real, niche diving season, though a genuinely specialist activity here.',
    'Too cold and dark for realistic access.', 'Too cold and dark for realistic access.',
  ],
  'tokyo-kyoto': [
    'Not a dedicated diving destination in these cities themselves.', 'Not a dedicated diving destination in these cities themselves.',
    'Not a dedicated diving destination in these cities themselves.', 'Not a dedicated diving destination in these cities themselves.',
    'Not a dedicated diving destination in these cities themselves.',
    'Not a dedicated diving destination in these cities themselves.',
    'Not a dedicated diving destination in these cities themselves.',
    'Not a dedicated diving destination in these cities themselves.',
    'Not a dedicated diving destination in these cities themselves.',
    'Not a dedicated diving destination in these cities themselves.', 'Not a dedicated diving destination in these cities themselves.',
    'Not a dedicated diving destination in these cities themselves.',
  ],
  'basque-country': [
    'Cooler Bay of Biscay water, less consistent conditions.', 'Cooler Bay of Biscay water, less consistent conditions.', 'Cooler Bay of Biscay water, less consistent conditions.',
    'The warmer, more reliable stretch of the year for this coast.', 'The warmer, more reliable stretch of the year for this coast.', 'The warmer, more reliable stretch of the year for this coast.', 'The warmer, more reliable stretch of the year for this coast.', 'The warmer, more reliable stretch of the year for this coast.', 'The warmer, more reliable stretch of the year for this coast.', 'The warmer, more reliable stretch of the year for this coast.',
    'Cooler Bay of Biscay water, less consistent conditions.', 'Cooler Bay of Biscay water, less consistent conditions.',
  ],
  cornwall: Array(12).fill('A real, cold-water diving scene exists year-round — wrecks and Atlantic reef for those willing to brave the cold in every month.'),
  morocco: [
    'Cooler Atlantic water.', 'Cooler Atlantic water.',
    'The more comfortable stretch of the year.', 'The more comfortable stretch of the year.', 'The more comfortable stretch of the year.',
    'Cooler Atlantic water.', 'Cooler Atlantic water.', 'Cooler Atlantic water.',
    'The more comfortable stretch of the year.', 'The more comfortable stretch of the year.', 'The more comfortable stretch of the year.',
    'Cooler Atlantic water.',
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
