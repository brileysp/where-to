import { readFileSync } from 'fs';
import { join } from 'path';
import { eq } from 'drizzle-orm';
import { drizzle as drizzlePostgres } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import { places, adminAuditLog } from '../src/lib/db/schema';

const KEY = 'surfing';

const OVERVIEWS: Record<string, string> = {
  rajaampat: 'Real, current-driven surf exists at a handful of exposed points, genuinely secondary to the area\'s world-famous diving. The dry season\'s calmer seas are the only realistic window.',
  lofoten: 'Real, very niche cold-water Arctic surf exists here — a small, dedicated scene rather than a visitor draw, made famous mostly by photos of surfers against snow-capped peaks.',
  palau: 'Real but very minor surf exists at a few exposed reef passes, entirely secondary to the world-class diving this destination is actually known for.',
  egypt: 'Not a real surf destination — the Red Sea\'s calm, current-free water is exactly what makes it excellent for diving, not waves.',
  olympic: 'Real, cold-water Pacific Northwest surf exists on the park\'s exposed beaches, genuinely secondary to the rainforest and hiking this park is known for.',
  'turks-caicos': 'Real but minor surf exists on a few exposed reef edges, genuinely secondary to the calm, clear water most visitors come for.',
  sicily: 'Real but modest Mediterranean surf, genuinely secondary to the island\'s history and food.',
  madeira: 'Real, if modest, Atlantic surf exists on the island\'s north coast — genuinely secondary to the famous levada hiking trails.',
  'punta-cana': 'Real but minor surf exists on a few exposed stretches, genuinely secondary to the beach-resort experience most visitors come for.',
  'marlborough-abel-tasman': 'Real but minor surf exists along this stretch of coast, genuinely secondary to the Abel Tasman Coast Track\'s famous hiking and kayaking.',
  'nova-scotia': 'Real, cold-water Atlantic Canada surf exists here, genuinely secondary to the Cabot Trail and Bay of Fundy this destination is known for.',
  iceland: 'Real, very niche cold-water surf exists on a few exposed coasts — a small, dedicated scene, not a reason most people visit.',
  'cape-cod-islands': 'Real, cold-water New England surf exists here, genuinely secondary to the beaches and whale-watching this destination is known for.',
  galapagos: 'Real, little-known surf exists on a few islands, entirely secondary to the wildlife this destination is actually known for — genuinely not a reason to visit.',
  kerala: 'Real but minor surf exists on a few exposed beaches, genuinely secondary to the backwaters and beaches this destination is known for.',
  tanzania: 'Real but minor surf exists off Zanzibar, entirely secondary to the diving and mainland safari this destination is known for.',
  redwood: 'Real, cold-water Northern California surf exists on the coast here, genuinely secondary to the ancient redwood forests this destination is known for.',
  namibia: 'Real, powerful desert-coast surf exists near Swakopmund, genuinely secondary to the wildlife and dunes this destination is known for — cold water from the Benguela current year-round.',
  croatia: 'Not really a surf destination — the Adriatic\'s calm, enclosed water is what makes it so good for sailing and island-hopping, not waves.',
  copenhagen: 'Real, cold-water surf exists on Denmark\'s North Sea coast, genuinely secondary to the city itself.',
  fjords: 'Real, very niche cold-water surf exists on Norway\'s exposed outer coast, entirely secondary to the fjords themselves.',
  santorini: 'Real but modest Aegean surf, genuinely secondary to the caldera views and beaches this destination is known for.',
  hongkong: 'Real but minor surf exists on the outer islands, genuinely secondary to the city itself.',
  'colombian-caribbean': 'Real but minor surf exists along this coast, genuinely secondary to Cartagena\'s walled city and beaches.',
  dubai: 'Not really a surf destination — the Gulf\'s calm, warm water suits swimming far more than waves.',
  provence: 'Not really a surf destination — this is a lavender-and-hill-towns region, and any real coastline is well outside its scope.',
  mallorca: 'Real but modest Mediterranean surf, genuinely secondary to the beaches and cycling this destination is known for.',
  puglia: 'Real but modest Adriatic and Ionian surf, genuinely secondary to the region\'s beaches and food.',
  jamaica: 'Real but minor surf exists along the north coast, genuinely secondary to the beaches this destination is known for.',
  'nice-riviera': 'Not really a surf destination — the French Riviera\'s calm Mediterranean water suits glamour and swimming, not waves.',
  'scottish-highlands-skye': 'Real, very niche cold-water surf exists on Skye\'s coast, entirely secondary to the hiking and scenery this destination is known for.',
  'charleston-savannah': 'Real but minor surf exists on nearby barrier islands, genuinely secondary to the historic architecture this destination is known for.',
  athens: 'Not really a surf destination — the Aegean\'s calm summer water suits island-hopping, not waves.',
  belize: 'Not really a surf destination — the barrier reef offshore blocks most incoming swell, the same reason its water suits the diving this destination is known for.',
  'faroe-islands': 'Real, very niche cold-water surf exists here, entirely secondary to the dramatic cliffs and puffins this destination is known for.',
  guatemala: 'Real but minor Pacific-coast surf exists near the black-sand beaches, genuinely secondary to the volcano hikes and Maya ruins this destination is known for.',
  'belfast-giants-causeway': 'Real, very niche cold-water surf exists on the Antrim coast, entirely secondary to the Giant\'s Causeway itself.',
  'douro-valley-porto': 'Porto\'s Atlantic coast has real, if minor, surf — genuinely secondary to the inland wine valley this destination is really about.',
  'st-andrews-fife': 'Real, very niche cold-water North Sea surf exists here, entirely secondary to the golf this destination is actually known for.',
  chicago: 'A genuine, if very unusual, freshwater surf scene exists on Lake Michigan — a small, dedicated local community rides real wind-driven swell, most often during fall and winter storms, not summer\'s calm lake days.',
  'bavaria-munich': 'Not a surf destination in any traditional sense — though Munich\'s Eisbach river wave, a permanent standing wave in the city center, is a genuinely famous novelty for river/stationary-wave surfers.',
};

const FLAT_MODEST = Array(12).fill('Conditions stay fairly consistent, genuinely modest, year-round.');

const MONTHLY: Record<string, string[]> = {
  rajaampat: [
    'Dry season — the calmer, more workable window.', 'Dry season — the calmer, more workable window.', 'Dry season — the calmer, more workable window.', 'Dry season — the calmer, more workable window.',
    'A transitional, less reliable month.',
    'The wet season — essentially unworkable.', 'The wet season — essentially unworkable.', 'The wet season — essentially unworkable.',
    'A transitional, less reliable month.',
    'Dry season — the calmer, more workable window.', 'Dry season — the calmer, more workable window.', 'Dry season — the calmer, more workable window.',
  ],
  lofoten: [
    'Too dark and cold for realistic access.', 'Too dark and cold for realistic access.', 'Too dark and cold for realistic access.',
    'A marginal shoulder-season window.', 'A marginal shoulder-season window.',
    'The most workable stretch of the year, still genuinely niche.', 'The most workable stretch of the year, still genuinely niche.', 'The most workable stretch of the year, still genuinely niche.',
    'A marginal shoulder-season window.', 'A marginal shoulder-season window.',
    'Too dark and cold for realistic access.', 'Too dark and cold for realistic access.',
  ],
  palau: [
    'Dry season — the calmer, more workable window.', 'Dry season — the calmer, more workable window.', 'Dry season — the calmer, more workable window.', 'Dry season — the calmer, more workable window.',
    'A transitional, less reliable month.',
    'The wet season — essentially unworkable.', 'The wet season — essentially unworkable.', 'The wet season — essentially unworkable.', 'The wet season — essentially unworkable.',
    'A transitional, less reliable month.',
    'Dry season — the calmer, more workable window.', 'Dry season — the calmer, more workable window.',
  ],
  egypt: [
    'Baseline, minor conditions.', 'Baseline, minor conditions.', 'Baseline, minor conditions.', 'Baseline, minor conditions.',
    'Baseline, minor conditions, slightly quieter.', 'Baseline, minor conditions, slightly quieter.', 'Baseline, minor conditions, slightly quieter.', 'Baseline, minor conditions, slightly quieter.', 'Baseline, minor conditions, slightly quieter.',
    'Baseline, minor conditions.', 'Baseline, minor conditions.', 'Baseline, minor conditions.',
  ],
  olympic: [
    'Too rough and cold for realistic access.', 'Too rough and cold for realistic access.', 'Too rough and cold for realistic access.', 'Too rough and cold for realistic access.',
    'A marginal, cold-water window.', 'A marginal, cold-water window.',
    'The most workable stretch of the year.', 'The most workable stretch of the year.', 'The most workable stretch of the year.',
    'A marginal, cold-water window.',
    'Too rough and cold for realistic access.', 'Too rough and cold for realistic access.',
  ],
  'turks-caicos': [
    'Dry season — the calmer, more workable window.', 'Dry season — the calmer, more workable window.', 'Dry season — the calmer, more workable window.', 'Dry season — the calmer, more workable window.',
    'Conditions are easing.',
    'Hurricane season — the least reliable stretch.', 'Hurricane season — the least reliable stretch.',
    'Hurricane season continues, modest conditions.', 'Hurricane season continues, modest conditions.', 'Hurricane season continues, modest conditions.', 'Hurricane season continues, modest conditions.',
    'Dry season — the calmer, more workable window.',
  ],
  sicily: [
    'The quietest stretch of the year.',
    'Baseline, modest conditions.', 'Baseline, modest conditions.', 'Baseline, modest conditions.', 'Baseline, modest conditions.',
    'The best window of the year, still modest.', 'The best window of the year, still modest.', 'The best window of the year, still modest.', 'The best window of the year, still modest.',
    'Baseline, modest conditions.',
    'The quietest stretch of the year.', 'The quietest stretch of the year.',
  ],
  madeira: FLAT_MODEST,
  'punta-cana': [
    'Dry season — the best window of the year.', 'Dry season — the best window of the year.', 'Dry season — the best window of the year.', 'Dry season — the best window of the year.',
    'Hurricane season — essentially unworkable.', 'Hurricane season — essentially unworkable.', 'Hurricane season — essentially unworkable.', 'Hurricane season — essentially unworkable.', 'Hurricane season — essentially unworkable.', 'Hurricane season — essentially unworkable.', 'Hurricane season — essentially unworkable.',
    'Dry season returns.',
  ],
  'marlborough-abel-tasman': [
    'The warmest, most workable stretch of the year.', 'The warmest, most workable stretch of the year.', 'The warmest, most workable stretch of the year.',
    'Baseline, cooler conditions.', 'Baseline, cooler conditions.',
    'The coldest, least workable stretch of the year.', 'The coldest, least workable stretch of the year.',
    'Baseline, cooler conditions.', 'Baseline, cooler conditions.', 'Baseline, cooler conditions.', 'Baseline, cooler conditions.',
    'The warmest, most workable stretch of the year.',
  ],
  'nova-scotia': [
    'Too cold for realistic access.', 'Too cold for realistic access.',
    'The workable window — cold water throughout.', 'The workable window — cold water throughout.', 'The workable window — cold water throughout.', 'The workable window — cold water throughout.', 'The workable window — cold water throughout.', 'The workable window — cold water throughout.', 'The workable window — cold water throughout.', 'The workable window — cold water throughout.', 'The workable window — cold water throughout.', 'The workable window — cold water throughout.',
  ],
  iceland: [
    'Too dark and cold for realistic access.', 'Too dark and cold for realistic access.', 'Too dark and cold for realistic access.',
    'A marginal shoulder-season window.', 'A marginal shoulder-season window.',
    'The most workable stretch of the year, still genuinely niche.', 'The most workable stretch of the year, still genuinely niche.', 'The most workable stretch of the year, still genuinely niche.',
    'A marginal shoulder-season window.', 'A marginal shoulder-season window.',
    'Too dark and cold for realistic access.', 'Too dark and cold for realistic access.',
  ],
  'cape-cod-islands': [
    'Too cold for realistic access.', 'Too cold for realistic access.',
    'The workable window — cold water throughout.', 'The workable window — cold water throughout.', 'The workable window — cold water throughout.', 'The workable window — cold water throughout.', 'The workable window — cold water throughout.', 'The workable window — cold water throughout.', 'The workable window — cold water throughout.', 'The workable window — cold water throughout.', 'The workable window — cold water throughout.',
    'Too cold for realistic access.',
  ],
  galapagos: [
    'The calm season — essentially flat.', 'The calm season — essentially flat.', 'The calm season — essentially flat.', 'The calm season — essentially flat.',
    'A transitional month.',
    'The cooler "garua" season — the more workable window.', 'The cooler "garua" season — the more workable window.', 'The cooler "garua" season — the more workable window.', 'The cooler "garua" season — the more workable window.', 'The cooler "garua" season — the more workable window.', 'The cooler "garua" season — the more workable window.',
    'A transitional month.',
  ],
  kerala: [
    'Dry season — the calmer, more workable window.', 'Dry season — the calmer, more workable window.', 'Dry season — the calmer, more workable window.',
    'A transitional, less reliable month.', 'A transitional, less reliable month.',
    'Monsoon season — essentially unworkable.', 'Monsoon season — essentially unworkable.', 'Monsoon season — essentially unworkable.', 'Monsoon season — essentially unworkable.',
    'A transitional, less reliable month.', 'A transitional, less reliable month.',
    'Dry season — the calmer, more workable window.',
  ],
  tanzania: [
    'Baseline, minor conditions.', 'Baseline, minor conditions.',
    'The long rains — the least workable stretch.', 'The long rains — the least workable stretch.', 'The long rains — the least workable stretch.',
    'The dry season — the more workable window.', 'The dry season — the more workable window.', 'The dry season — the more workable window.', 'The dry season — the more workable window.', 'The dry season — the more workable window.',
    'Baseline, minor conditions.', 'Baseline, minor conditions.',
  ],
  redwood: [
    'Too rough and cold for realistic access.', 'Too rough and cold for realistic access.',
    'A marginal, cold-water window.', 'A marginal, cold-water window.', 'A marginal, cold-water window.',
    'The most workable stretch of the year.', 'The most workable stretch of the year.', 'The most workable stretch of the year.', 'The most workable stretch of the year.',
    'A marginal, cold-water window.',
    'Too rough and cold for realistic access.', 'Too rough and cold for realistic access.',
  ],
  namibia: [
    'The least workable stretch of the year.', 'The least workable stretch of the year.', 'The least workable stretch of the year.',
    'A transitional month.',
    'The dry season — the more workable window, cold Benguela-current water throughout.', 'The dry season — the more workable window, cold Benguela-current water throughout.', 'The dry season — the more workable window, cold Benguela-current water throughout.', 'The dry season — the more workable window, cold Benguela-current water throughout.', 'The dry season — the more workable window, cold Benguela-current water throughout.', 'The dry season — the more workable window, cold Benguela-current water throughout.',
    'A transitional month.',
    'The least workable stretch of the year.',
  ],
  croatia: [
    'The quietest stretch of the year.', 'The quietest stretch of the year.',
    'Baseline, modest conditions.', 'Baseline, modest conditions.', 'Baseline, modest conditions.',
    'The best window of the year, still modest.', 'The best window of the year, still modest.', 'The best window of the year, still modest.', 'The best window of the year, still modest.',
    'Baseline, modest conditions.', 'Baseline, modest conditions.',
    'The quietest stretch of the year.',
  ],
  copenhagen: [
    'Too cold for realistic access.', 'Too cold for realistic access.',
    'A marginal, cold-water window.', 'A marginal, cold-water window.',
    'The most workable stretch of the year.', 'The most workable stretch of the year.', 'The most workable stretch of the year.', 'The most workable stretch of the year.',
    'A marginal, cold-water window.', 'A marginal, cold-water window.', 'A marginal, cold-water window.',
    'Too cold for realistic access.',
  ],
  fjords: [
    'Too dark and cold for realistic access.', 'Too dark and cold for realistic access.', 'Too dark and cold for realistic access.',
    'A marginal shoulder-season window.', 'A marginal shoulder-season window.',
    'The most workable stretch of the year.', 'The most workable stretch of the year.', 'The most workable stretch of the year.',
    'A marginal shoulder-season window.', 'A marginal shoulder-season window.',
    'Too dark and cold for realistic access.', 'Too dark and cold for realistic access.',
  ],
  santorini: [
    'The quietest stretch of the year.', 'The quietest stretch of the year.',
    'Baseline, modest conditions.', 'Baseline, modest conditions.', 'Baseline, modest conditions.',
    'The best window of the year, still modest.', 'The best window of the year, still modest.', 'The best window of the year, still modest.', 'The best window of the year, still modest.',
    'Baseline, modest conditions.',
    'The quietest stretch of the year.', 'The quietest stretch of the year.',
  ],
  hongkong: [
    'Baseline, minor conditions.', 'Baseline, minor conditions.', 'Baseline, minor conditions.', 'Baseline, minor conditions.',
    'The least workable stretch of the year.', 'The least workable stretch of the year.',
    'Baseline, minor conditions.', 'Baseline, minor conditions.', 'Baseline, minor conditions.',
    'The clearest, most comfortable stretch of the year.', 'The clearest, most comfortable stretch of the year.', 'The clearest, most comfortable stretch of the year.',
  ],
  'colombian-caribbean': [
    'Dry season — the best window of the year.', 'Dry season — the best window of the year.', 'Dry season — the best window of the year.', 'Dry season — the best window of the year.',
    'The wetter season — essentially unworkable.', 'The wetter season — essentially unworkable.', 'The wetter season — essentially unworkable.', 'The wetter season — essentially unworkable.', 'The wetter season — essentially unworkable.', 'The wetter season — essentially unworkable.', 'The wetter season — essentially unworkable.',
    'Dry season returns.',
  ],
  dubai: [
    'The most comfortable stretch of the year.', 'The most comfortable stretch of the year.', 'The most comfortable stretch of the year.',
    'Baseline conditions, extreme heat above water regardless.', 'Baseline conditions, extreme heat above water regardless.', 'Baseline conditions, extreme heat above water regardless.', 'Baseline conditions, extreme heat above water regardless.', 'Baseline conditions, extreme heat above water regardless.', 'Baseline conditions, extreme heat above water regardless.', 'Baseline conditions, extreme heat above water regardless.',
    'The most comfortable stretch of the year.', 'The most comfortable stretch of the year.',
  ],
  provence: [
    'The quietest stretch of the year.',
    'Baseline, modest conditions.', 'Baseline, modest conditions.', 'Baseline, modest conditions.',
    'The best window of the year, still modest.', 'The best window of the year, still modest.', 'The best window of the year, still modest.', 'The best window of the year, still modest.', 'The best window of the year, still modest.',
    'Baseline, modest conditions.',
    'The quietest stretch of the year.', 'The quietest stretch of the year.',
  ],
  mallorca: [
    'The quietest stretch of the year.',
    'Baseline, modest conditions.', 'Baseline, modest conditions.', 'Baseline, modest conditions.', 'Baseline, modest conditions.',
    'The best window of the year, still modest.', 'The best window of the year, still modest.', 'The best window of the year, still modest.', 'The best window of the year, still modest.',
    'Baseline, modest conditions.',
    'The quietest stretch of the year.', 'The quietest stretch of the year.',
  ],
  puglia: [
    'The quietest stretch of the year.',
    'Baseline, modest conditions.', 'Baseline, modest conditions.', 'Baseline, modest conditions.', 'Baseline, modest conditions.',
    'The best window of the year, still modest.', 'The best window of the year, still modest.', 'The best window of the year, still modest.', 'The best window of the year, still modest.',
    'Baseline, modest conditions.',
    'The quietest stretch of the year.', 'The quietest stretch of the year.',
  ],
  jamaica: [
    'Dry season — the best window of the year.', 'Dry season — the best window of the year.', 'Dry season — the best window of the year.', 'Dry season — the best window of the year.',
    'The least reliable stretch of the year.', 'The least reliable stretch of the year.',
    'A brief better window within hurricane season.', 'A brief better window within hurricane season.',
    'Hurricane season continues.', 'Hurricane season continues.', 'Hurricane season continues.',
    'Dry season returns.',
  ],
  'nice-riviera': [
    'The quietest stretch of the year.',
    'Baseline, very modest conditions.', 'Baseline, very modest conditions.', 'Baseline, very modest conditions.', 'Baseline, very modest conditions.',
    'The best window of the year, still very modest.', 'The best window of the year, still very modest.', 'The best window of the year, still very modest.', 'The best window of the year, still very modest.',
    'Baseline, very modest conditions.',
    'The quietest stretch of the year.', 'The quietest stretch of the year.',
  ],
  'scottish-highlands-skye': [
    'Too cold and dark for realistic access.', 'Too cold and dark for realistic access.',
    'The workable window, genuinely niche.', 'The workable window, genuinely niche.', 'The workable window, genuinely niche.', 'The workable window, genuinely niche.', 'The workable window, genuinely niche.', 'The workable window, genuinely niche.', 'The workable window, genuinely niche.', 'The workable window, genuinely niche.',
    'Too cold and dark for realistic access.', 'Too cold and dark for realistic access.',
  ],
  'charleston-savannah': [
    'The quietest stretch of the year.',
    'Baseline, modest conditions.', 'Baseline, modest conditions.', 'Baseline, modest conditions.', 'Baseline, modest conditions.', 'Baseline, modest conditions.', 'Baseline, modest conditions.', 'Baseline, modest conditions.', 'Baseline, modest conditions.', 'Baseline, modest conditions.', 'Baseline, modest conditions.',
    'The quietest stretch of the year.',
  ],
  athens: [
    'The quietest stretch of the year.',
    'Baseline, very modest conditions.', 'Baseline, very modest conditions.', 'Baseline, very modest conditions.', 'Baseline, very modest conditions.',
    'The best window of the year, still very modest.', 'The best window of the year, still very modest.', 'The best window of the year, still very modest.', 'The best window of the year, still very modest.',
    'Baseline, very modest conditions.',
    'The quietest stretch of the year.', 'The quietest stretch of the year.',
  ],
  belize: [
    'Baseline, minor conditions.', 'Baseline, minor conditions.', 'Baseline, minor conditions.', 'Baseline, minor conditions.', 'Baseline, minor conditions.',
    'Baseline, minor conditions, slightly quieter.', 'Baseline, minor conditions, slightly quieter.', 'Baseline, minor conditions, slightly quieter.', 'Baseline, minor conditions, slightly quieter.', 'Baseline, minor conditions, slightly quieter.', 'Baseline, minor conditions, slightly quieter.', 'Baseline, minor conditions, slightly quieter.',
  ],
  'faroe-islands': [
    'Too rough for realistic access.', 'Too rough for realistic access.', 'Too rough for realistic access.',
    'The workable window, genuinely niche.', 'The workable window, genuinely niche.', 'The workable window, genuinely niche.', 'The workable window, genuinely niche.', 'The workable window, genuinely niche.', 'The workable window, genuinely niche.', 'The workable window, genuinely niche.',
    'Too rough for realistic access.', 'Too rough for realistic access.',
  ],
  guatemala: [
    'Dry season — the calmer, more workable window.', 'Dry season — the calmer, more workable window.', 'Dry season — the calmer, more workable window.', 'Dry season — the calmer, more workable window.',
    'A transitional, less reliable month.',
    'The wet season — essentially unworkable.', 'The wet season — essentially unworkable.', 'The wet season — essentially unworkable.', 'The wet season — essentially unworkable.',
    'A transitional, less reliable month.',
    'Dry season — the calmer, more workable window.', 'Dry season — the calmer, more workable window.',
  ],
  'belfast-giants-causeway': FLAT_MODEST,
  'douro-valley-porto': FLAT_MODEST,
  'st-andrews-fife': [
    'Too cold and dark for realistic access.', 'Too cold and dark for realistic access.',
    'The workable window, genuinely niche.', 'The workable window, genuinely niche.', 'The workable window, genuinely niche.', 'The workable window, genuinely niche.', 'The workable window, genuinely niche.', 'The workable window, genuinely niche.', 'The workable window, genuinely niche.', 'The workable window, genuinely niche.',
    'Too cold and dark for realistic access.', 'Too cold and dark for realistic access.',
  ],
  chicago: [
    'The lake often freezes or is too dangerous to approach.', 'The lake often freezes or is too dangerous to approach.',
    'A genuinely tiny, niche window, best in fall/winter storms rather than calm summer days.', 'A genuinely tiny, niche window, best in fall/winter storms rather than calm summer days.', 'A genuinely tiny, niche window, best in fall/winter storms rather than calm summer days.', 'A genuinely tiny, niche window, best in fall/winter storms rather than calm summer days.', 'A genuinely tiny, niche window, best in fall/winter storms rather than calm summer days.', 'A genuinely tiny, niche window, best in fall/winter storms rather than calm summer days.', 'A genuinely tiny, niche window, best in fall/winter storms rather than calm summer days.', 'A genuinely tiny, niche window, best in fall/winter storms rather than calm summer days.', 'A genuinely tiny, niche window, best in fall/winter storms rather than calm summer days.',
    'The lake often freezes or is too dangerous to approach.',
  ],
  'bavaria-munich': [
    'Too cold for the river to be comfortable.', 'Too cold for the river to be comfortable.',
    'The Eisbach standing wave works year-round for those who seek it out, though it remains a tiny niche activity.', 'The Eisbach standing wave works year-round for those who seek it out, though it remains a tiny niche activity.', 'The Eisbach standing wave works year-round for those who seek it out, though it remains a tiny niche activity.', 'The Eisbach standing wave works year-round for those who seek it out, though it remains a tiny niche activity.', 'The Eisbach standing wave works year-round for those who seek it out, though it remains a tiny niche activity.', 'The Eisbach standing wave works year-round for those who seek it out, though it remains a tiny niche activity.', 'The Eisbach standing wave works year-round for those who seek it out, though it remains a tiny niche activity.', 'The Eisbach standing wave works year-round for those who seek it out, though it remains a tiny niche activity.', 'The Eisbach standing wave works year-round for those who seek it out, though it remains a tiny niche activity.',
    'Too cold for the river to be comfortable.',
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
