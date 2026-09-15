import { readFileSync } from 'fs';
import { join } from 'path';
import { eq } from 'drizzle-orm';
import { drizzle as drizzlePostgres } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import { places, adminAuditLog } from '../src/lib/db/schema';

const KEY = 'surfing';

const OVERVIEWS: Record<string, string> = {
  'monterey-big-sur': 'Real, cold-water Central California surf — Steamer Lane in nearby Santa Cruz is the area\'s famous break, though genuine wave quality here takes a back seat to the region\'s rugged coastal scenery. A wetsuit is essential year-round.',
  mauritius: 'Le Morne\'s "One Eye" is a genuine, respected reef wave, on the same peninsula famous for windsurfing and kitesurfing — a real, if secondary, wave-surfing story alongside that bigger reputation. The drier, cooler months are the more consistent season.',
  taiwan: 'Jinzun and other spots on the east coast have a real, growing surf scene, best in the clear autumn/spring windows and during summer\'s typhoon-driven swell — a genuine trade-off between bigger waves and real storm risk.',
  ireland: 'Real, serious cold-water surf — Bundoran and the west coast\'s Wild Atlantic Way have a genuine, respected surf culture, with reliable Atlantic swell nearly year-round. A thick wetsuit is essential regardless of season.',
  ghana: 'Busua and the coast around it have a real, if under-the-radar, West African surf scene — consistent Atlantic swell, and the dry season\'s calmer wind makes conditions more workable.',
  borabora: 'Real, if minor, reef-pass surf exists on the island\'s south side, but this isn\'t a wave-surfing pilgrimage destination — Bora Bora\'s underwater fame belongs to its calm lagoon, not its waves. The drier season\'s calmer wind is the better window.',
  morocco: 'Taghazout, on the Atlantic coast near Agadir, is Morocco\'s surf capital — a real, well-established scene built around a long right-hand point break (Anchor Point) and a genuine year-round season, thanks to consistent Atlantic swell.',
  sardinia: 'Real but modest Mediterranean surf — the west coast picks up genuine swell during storms, though this is a distant secondary activity to the island\'s beaches.',
  rivieramaya: 'Real wave surfing here is modest — the reef and sandbar breaks near Playa del Carmen are inconsistent, genuinely secondary to the region\'s cenotes and coral reef. A cold-front swell in October is the one real seasonal bright spot.',
  'papua-new-guinea': 'Vanimo, on the north coast, has a real, little-known reef break scene — genuinely remote and undeveloped, more an extension of the country\'s off-the-beaten-path reputation than a dedicated surf pilgrimage. The dry season is the more consistent window.',
  barcelona: 'Real but modest Mediterranean surf along the Catalan coast — genuinely inconsistent, a distant secondary activity to the city itself.',
  thailand: 'Real wave surfing here is minor — Phuket\'s beaches pick up some swell during the monsoon, but this isn\'t a dedicated surf destination the way Bali or Indonesia\'s outer islands are.',
  tasmania: 'Real, serious cold-water surf exists along the east and south coasts, genuinely good by Australian standards, but a niche, dedicated-local activity rather than a visitor draw — winter is both the best swell and the coldest, least accessible water.',
  havana: 'Real wave surfing in Cuba is genuinely minor and little-documented — Havana\'s own coastline is mostly rocky and exposed rather than a dedicated break, and this isn\'t a reason to visit.',
  palawan: 'Real but minor surf exists around Palawan\'s exposed coasts, genuinely secondary to the region\'s diving and island-hopping. The dry season is the calmer, more comfortable window, though wave quality doesn\'t change dramatically with season.',
  azores: 'Real, cold-water Atlantic surf exists here, genuinely secondary to the islands\' famous whale watching and volcanic scenery — winter brings rougher, less accessible conditions.',
  seychelles: 'Real but minor surf exists at a handful of exposed reef passes, genuinely secondary to the islands\' beaches and diving. The calmer trade-wind-transition months are the more workable window.',
  nyc: 'Rockaway Beach, in Queens, is genuinely New York City\'s real surf spot — a legitimate, if modest, urban break with its own dedicated local scene, most consistent in the shoulder seasons.',
  bahamas: 'Real but minor surf exists on a few exposed Atlantic-facing beaches, genuinely secondary to the country\'s diving and the calm turquoise water most visitors come for.',
  madagascar: 'Real, little-documented surf exists on the southwest coast near Anakao, genuinely remote and undeveloped — an extension of the country\'s off-the-beaten-path reputation rather than a dedicated surf destination.',
  komodo: 'Real, current-driven surf exists at a few exposed points within the national park, genuinely secondary to the area\'s world-class diving. The dry season\'s calmer seas are the only realistic window.',
  vietnam: 'Da Nang and China Beach have a real, small but genuine surf scene, more consistent during the same typhoon-season swell that makes central Vietnam\'s weather unpredictable.',
};

const MONTHLY: Record<string, string[]> = {
  'monterey-big-sur': Array(12).fill('Conditions stay fairly consistent year-round — cold water and a wetsuit are the constant, not the season.'),
  mauritius: [
    'Cyclone season — the least reliable stretch of the year.', 'Cyclone season — the least reliable stretch of the year.', 'Cyclone season — the least reliable stretch of the year.',
    'Conditions are improving.',
    'The drier season — the more consistent window for One Eye and the island\'s other reef passes.', 'The drier season — the more consistent window for One Eye and the island\'s other reef passes.', 'The drier season — the more consistent window for One Eye and the island\'s other reef passes.', 'The drier season — the more consistent window for One Eye and the island\'s other reef passes.', 'The drier season — the more consistent window for One Eye and the island\'s other reef passes.', 'The drier season — the more consistent window for One Eye and the island\'s other reef passes.', 'The drier season — the more consistent window for One Eye and the island\'s other reef passes.',
    'Conditions are easing as cyclone season approaches.',
  ],
  taiwan: [
    'The quietest, least consistent stretch.', 'The quietest, least consistent stretch.',
    'A clearer, more comfortable window.', 'A clearer, more comfortable window.',
    'The quietest, least consistent stretch.', 'The quietest, least consistent stretch.',
    'Typhoon season sends real swell to the east coast — bigger waves, with real storm-disruption risk alongside them.', 'Typhoon season sends real swell to the east coast — bigger waves, with real storm-disruption risk alongside them.', 'Typhoon season sends real swell to the east coast — bigger waves, with real storm-disruption risk alongside them.',
    'A clearer, more comfortable window.', 'A clearer, more comfortable window.',
    'The quietest, least consistent stretch.',
  ],
  ireland: Array(12).fill('Reliable Atlantic swell year-round — a thick wetsuit matters more than the calendar here.'),
  ghana: [
    'Dry season — the calmest, most workable conditions.', 'Dry season — the calmest, most workable conditions.', 'Dry season — the calmest, most workable conditions.',
    'A brief better window within the wetter stretch.',
    'The main rains — the least workable conditions.', 'The main rains — the least workable conditions.', 'The main rains — the least workable conditions.',
    'A brief better window within the wetter stretch.',
    'A shorter secondary rainy stretch.', 'A shorter secondary rainy stretch.',
    'Dry season returns — the calmest, most workable conditions.', 'Dry season returns — the calmest, most workable conditions.',
  ],
  borabora: [
    'The wetter season, with occasional cyclone risk — the least consistent stretch.', 'The wetter season, with occasional cyclone risk — the least consistent stretch.', 'The wetter season, with occasional cyclone risk — the least consistent stretch.',
    'Conditions are improving as the drier season approaches.',
    'The drier season — calmer wind, the more workable window for the island\'s minor reef-pass surf.', 'The drier season — calmer wind, the more workable window for the island\'s minor reef-pass surf.', 'The drier season — calmer wind, the more workable window for the island\'s minor reef-pass surf.', 'The drier season — calmer wind, the more workable window for the island\'s minor reef-pass surf.', 'The drier season — calmer wind, the more workable window for the island\'s minor reef-pass surf.', 'The drier season — calmer wind, the more workable window for the island\'s minor reef-pass surf.',
    'Conditions ease as the wetter season returns.',
    'The wetter season, with occasional cyclone risk — the least consistent stretch.',
  ],
  morocco: [
    'A genuine year-round season continues, consistent but not at its peak.',
    'A genuine year-round season continues, consistent but not at its peak.',
    'One of the better windows of the year.', 'One of the better windows of the year.', 'One of the better windows of the year.',
    'A genuine year-round season continues, consistent but not at its peak.', 'A genuine year-round season continues, consistent but not at its peak.', 'A genuine year-round season continues, consistent but not at its peak.',
    'One of the better windows of the year.', 'One of the better windows of the year.', 'One of the better windows of the year.',
    'A genuine year-round season continues, consistent but not at its peak.',
  ],
  sardinia: [
    'The quietest stretch of the year.',
    'Moderate, storm-dependent conditions.', 'Moderate, storm-dependent conditions.', 'Moderate, storm-dependent conditions.', 'Moderate, storm-dependent conditions.',
    'The best window of the year, though still modest by regional standards.', 'The best window of the year, though still modest by regional standards.', 'The best window of the year, though still modest by regional standards.', 'The best window of the year, though still modest by regional standards.',
    'Moderate, storm-dependent conditions.',
    'The quietest stretch of the year.', 'The quietest stretch of the year.',
  ],
  rivieramaya: [
    'Baseline modest conditions.', 'Baseline modest conditions.', 'Baseline modest conditions.', 'Baseline modest conditions.',
    'Conditions are easing.',
    'The quietest, flattest stretch of the year.', 'The quietest, flattest stretch of the year.',
    'Conditions are building.', 'Conditions are building.',
    'The best window of the year, tied to early-season cold fronts pushing real swell in.',
    'Baseline modest conditions.', 'Baseline modest conditions.',
  ],
  'papua-new-guinea': [
    'The wet season — the least consistent stretch.', 'The wet season — the least consistent stretch.', 'The wet season — the least consistent stretch.',
    'Conditions are improving as the dry season approaches.',
    'The dry season — the most consistent window for Vanimo\'s reef breaks.', 'The dry season — the most consistent window for Vanimo\'s reef breaks.', 'The dry season — the most consistent window for Vanimo\'s reef breaks.', 'The dry season — the most consistent window for Vanimo\'s reef breaks.', 'The dry season — the most consistent window for Vanimo\'s reef breaks.',
    'Conditions are easing as the wet season approaches.', 'Conditions are easing as the wet season approaches.',
    'The wet season returns.',
  ],
  barcelona: [
    'The quietest stretch of the year.',
    'Moderate, inconsistent conditions.', 'Moderate, inconsistent conditions.', 'Moderate, inconsistent conditions.',
    'One of the better windows of the year, though still modest.', 'One of the better windows of the year, though still modest.',
    'Moderate, inconsistent conditions.', 'Moderate, inconsistent conditions.',
    'One of the better windows of the year, though still modest.', 'One of the better windows of the year, though still modest.',
    'The quietest stretch of the year.', 'The quietest stretch of the year.',
  ],
  thailand: [
    'A slightly better window within the cool-dry season.', 'A slightly better window within the cool-dry season.',
    'Baseline, minor conditions.', 'Baseline, minor conditions.', 'Baseline, minor conditions.', 'Baseline, minor conditions.', 'Baseline, minor conditions.', 'Baseline, minor conditions.', 'Baseline, minor conditions.', 'Baseline, minor conditions.',
    'A slightly better window within the cool-dry season.', 'A slightly better window within the cool-dry season.',
  ],
  tasmania: [
    'The more comfortable season — cold water, but workable.', 'The more comfortable season — cold water, but workable.', 'The more comfortable season — cold water, but workable.', 'The more comfortable season — cold water, but workable.',
    'A transitional, cooling stretch.',
    'The coldest, least practical stretch of the year, even though the swell itself is often good.', 'The coldest, least practical stretch of the year, even though the swell itself is often good.',
    'Still difficult, cold-water conditions.',
    'A transitional, warming stretch.', 'A transitional, warming stretch.', 'A transitional, warming stretch.',
    'The more comfortable season returns.',
  ],
  havana: [
    'Baseline modest conditions.', 'Baseline modest conditions.', 'Baseline modest conditions.', 'Baseline modest conditions.',
    'Conditions are easing as hurricane season approaches.',
    'Hurricane season begins — the quietest, least reliable stretch.', 'Hurricane season begins — the quietest, least reliable stretch.',
    'Hurricane season continues, though modest conditions return.', 'Hurricane season continues, though modest conditions return.',
    'The best window of the year, as hurricane season winds down.',
    'Baseline modest conditions.', 'Baseline modest conditions.',
  ],
  palawan: [
    'Dry season — the calmer, more comfortable window.', 'Dry season — the calmer, more comfortable window.', 'Dry season — the calmer, more comfortable window.', 'Dry season — the calmer, more comfortable window.',
    'Conditions are easing as the monsoon approaches.',
    'The quietest stretch of the year.',
    'Monsoon season — modest conditions continue.', 'Monsoon season — modest conditions continue.', 'Monsoon season — modest conditions continue.', 'Monsoon season — modest conditions continue.',
    'Dry season returns.', 'Dry season returns.',
  ],
  azores: [
    'The roughest, least accessible stretch of the year.', 'The roughest, least accessible stretch of the year.',
    'The more workable window, still cold-water surf throughout.', 'The more workable window, still cold-water surf throughout.', 'The more workable window, still cold-water surf throughout.', 'The more workable window, still cold-water surf throughout.', 'The more workable window, still cold-water surf throughout.', 'The more workable window, still cold-water surf throughout.', 'The more workable window, still cold-water surf throughout.', 'The more workable window, still cold-water surf throughout.',
    'The roughest, least accessible stretch of the year.', 'The roughest, least accessible stretch of the year.',
  ],
  seychelles: [
    'The roughest, least workable stretch of the year.', 'The roughest, least workable stretch of the year.',
    'Baseline conditions between trade winds.',
    'The calmer, more workable window between trade winds.', 'The calmer, more workable window between trade winds.',
    'Baseline conditions between trade winds.', 'Baseline conditions between trade winds.', 'Baseline conditions between trade winds.', 'Baseline conditions between trade winds.',
    'The calmer, more workable window between trade winds.', 'The calmer, more workable window between trade winds.',
    'The roughest, least workable stretch of the year.',
  ],
  nyc: [
    'Too cold for realistic access.', 'Too cold for realistic access.',
    'Baseline conditions at Rockaway.',
    'One of the better shoulder-season windows.', 'One of the better shoulder-season windows.',
    'Baseline conditions at Rockaway.', 'Baseline conditions at Rockaway.', 'Baseline conditions at Rockaway.',
    'One of the better shoulder-season windows.', 'One of the better shoulder-season windows.',
    'Baseline conditions at Rockaway.',
    'Too cold for realistic access.',
  ],
  bahamas: [
    'Dry season — the best window of the year.', 'Dry season — the best window of the year.', 'Dry season — the best window of the year.', 'Dry season — the best window of the year.',
    'Conditions are easing as hurricane season begins.',
    'Hurricane season — the least reliable stretch.', 'Hurricane season — the least reliable stretch.',
    'Hurricane season continues, modest conditions.', 'Hurricane season continues, modest conditions.', 'Hurricane season continues, modest conditions.', 'Hurricane season continues, modest conditions.',
    'Dry season returns.',
  ],
  madagascar: [
    'Cyclone season — the least accessible stretch.', 'Cyclone season — the least accessible stretch.', 'Cyclone season — the least accessible stretch.',
    'Conditions are improving.',
    'The dry season — the more workable window.', 'The dry season — the more workable window.', 'The dry season — the more workable window.', 'The dry season — the more workable window.', 'The dry season — the more workable window.', 'The dry season — the more workable window.',
    'Conditions are easing as cyclone season approaches.',
    'Cyclone season — the least accessible stretch.',
  ],
  komodo: [
    'The wet season — rough, least accessible conditions.', 'The wet season — rough, least accessible conditions.', 'The wet season — rough, least accessible conditions.',
    'The dry season — the workable window for the park\'s exposed points.', 'The dry season — the workable window for the park\'s exposed points.', 'The dry season — the workable window for the park\'s exposed points.', 'The dry season — the workable window for the park\'s exposed points.', 'The dry season — the workable window for the park\'s exposed points.', 'The dry season — the workable window for the park\'s exposed points.', 'The dry season — the workable window for the park\'s exposed points.', 'The dry season — the workable window for the park\'s exposed points.', 'The dry season — the workable window for the park\'s exposed points.',
  ],
  vietnam: [
    'Baseline modest conditions.',
    'The calmer, clearer window.', 'The calmer, clearer window.', 'The calmer, clearer window.',
    'Baseline modest conditions.', 'Baseline modest conditions.', 'Baseline modest conditions.', 'Baseline modest conditions.', 'Baseline modest conditions.', 'Baseline modest conditions.',
    'Typhoon risk peaks, especially in the north/central coast — the least reliable month.',
    'Baseline modest conditions.',
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
