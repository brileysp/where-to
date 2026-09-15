import { readFileSync } from 'fs';
import { join } from 'path';
import { eq } from 'drizzle-orm';
import { drizzle as drizzlePostgres } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import { places, adminAuditLog } from '../src/lib/db/schema';

const KEY = 'diving';

const OVERVIEWS: Record<string, string> = {
  rajaampat: 'Raja Ampat has the highest marine biodiversity on Earth — Cape Kri holds the world record for the most fish species counted on a single dive, over 370. Diving here is almost entirely liveaboard-based: drift dives through current-swept channels, soft coral walls, and tiny, easy-to-miss life like pygmy seahorses.',
  belize: 'Hol Chan Marine Reserve and Shark Ray Alley are the easy, no-certification-needed win — shallow water, close to shore, with reliable nurse shark and stingray encounters. The Great Blue Hole is the bucket-list dive: a massive sinkhole with a dramatic drop past ancient stalactites, though it\'s more about the formation than marine life at that depth.',
  borabora: 'Bora Bora\'s lagoon is built for snorkeling, not scuba — shallow, warm, and calm enough that no certification is needed. Blacktip reef sharks and stingrays are a near-guaranteed sight on a standard lagoon tour, and manta rays visit a cleaning station on the north side.',
  egypt: 'The Red Sea is diveable nearly year-round, with exceptional visibility and warm water — a rare combination. The SS Thistlegorm, a WWII supply ship sunk off Sharm el-Sheikh, is one of the world\'s most famous wreck dives, its holds still full of motorcycles and trucks. Oceanic whitetip sharks gather at outer reefs like Elphinstone and Daedalus in the fall.',
  palau: 'Blue Corner is Palau\'s signature dive — a current-swept wall where divers clip in with a reef hook and watch grey reef sharks, big pelagics, and schooling fish stream past. German Channel is the reliable spot for manta ray cleaning stations, and WWII wrecks add a second, very different specialty.',
  borneo: 'Sipadan is one of the most famous dive sites on Earth — a sheer wall dropping 600 meters, with resident green and hawksbill turtles, schooling barracuda, and white-tip reef sharks. Access is permit-limited to about 120 divers a day, and there\'s no accommodation on the island itself — everyone stays on nearby Mabul or Kapalai.',
  maldives: 'Diving here is mostly about channel and atoll diving — thilas (underwater pinnacles) and kandus (channels) where strong currents draw in grey reef sharks, eagle rays, and big schools of fish. Manta ray and whale shark aggregations at sites like Hanifaru Bay are the marquee wildlife draw, on top of house-reef diving right off many resorts.',
  gbr: 'The reef\'s dry season (May-Oct) is genuinely the better window — the best visibility of the year, and no dangerous box jellyfish in the water, so no stinger suit is needed. Wet season diving is still good, just requires more caution and coverage in the water. Site variety is enormous, from the Whitsundays to the Ribbon Reefs further north.',
  galapagos: 'This is cold, current-swept, advanced diving, not a tropical reef — a wetsuit (often 7mm, sometimes a hood) is essential even at the equator. Darwin and Wolf, the two legendary sites, are liveaboard-only and have the highest concentration of shark biomass recorded anywhere on Earth, with hammerhead schools numbering in the hundreds.',
  palawan: 'El Nido and Coron offer accessible, varied diving and snorkeling — limestone karst lagoons, coral reefs, and in Coron\'s case, a cluster of WWII Japanese shipwrecks sitting in clear, shallow water. Tubbataha Reef, one of the world\'s great reef systems, is a different trip entirely: liveaboard-only, and open only mid-March to mid-June.',
  okinawa: 'Okinawa\'s reefs and the Kerama Islands\' famously clear turquoise water ("Kerama Blue") are the main draw, alongside real cave and cavern diving at sites like Blue Cave. It\'s mild by Japanese standards nearly year-round, though typhoons are a genuine, unpredictable risk in late summer.',
  seychelles: 'Diving here is built around granite boulder dive sites, a formation found almost nowhere else in the tropics, alongside sharks and rays on the outer reefs. Whale sharks pass through between August and November, a real if unpredictable bonus.',
  thailand: 'The Similan Islands are Thailand\'s headline dive site — dramatic granite boulders and some of the country\'s clearest water — but the islands are a national park that closes completely from mid-May to mid-October every year, not just a quiet season. Richelieu Rock, near the Myanmar border, is the other big draw, a submerged pinnacle known for macro life and the occasional whale shark.',
  fiji: 'Fiji calls itself the "soft coral capital of the world," and the Rainbow Reef/Somosomo Strait area backs it up — current-fed walls thick with color. Beqa Lagoon is the other headline: a shark dive with up to eight species, including bull sharks, in open water.',
  rivieramaya: 'Cenote diving is the real specialty here — freshwater sinkholes and cave systems through the Yucatán\'s limestone, unaffected by ocean conditions or hurricanes. Reef diving along the Mesoamerican Barrier Reef is the other half, and whale sharks gather off Isla Mujeres and Isla Holbox from June to September — right in the middle of hurricane season.',
  komodo: 'Komodo\'s diving is defined by strong currents and a real temperature gradient across a small area — warmer water and mantas in the north, colder, nutrient-rich water and bigger pelagics in the south at sites like Manta Alley. It\'s current-driven drift diving throughout, better suited to experienced divers.',
  'turks-caicos': 'The wall — a dramatic drop-off close to shore around Grace Bay and Grand Turk — is the signature feature, along with consistently clear, calm water. It\'s a relaxed, easy destination for the diving itself; the real variable is hurricane season.',
  mauritius: 'Diving here mixes coral reef, wrecks, and drop-offs along the lagoon\'s outer edge, with dolphins a regular sighting on the west coast. It\'s a real, solid destination — just a tier below the Indian Ocean\'s biggest names like the Maldives and Seychelles.',
  'papua-new-guinea': 'PNG is genuinely remote, liveaboard-and-resort-based diving in some of the least-touristed reefs left in the world. Milne Bay is the specialty: "muck diving" over sandy, silty bottoms that turn up bizarre, rarely-seen critters most reef divers never see.',
  bahamas: 'Shark diving is the real specialty — Tiger Beach draws tiger sharks reliably from October through March, and oceanic whitetip sharks gather off Cat Island each spring. Blue holes (deep, flooded sinkholes, mostly in Andros) are the other signature feature, alongside generally calm, clear Caribbean water.',
  bali: 'Tulamben\'s USAT Liberty is one of the most accessible wreck dives in the world — a WWII cargo ship close enough to shore that no boat is needed. Nusa Penida, a short boat ride away, is the other big draw: manta rays are reliable year-round at Manta Point, and mola mola (giant ocean sunfish) show up at cleaning stations from July to October.',
};

const RAJAAMPAT_PEAK = 'Peak season — calm seas, the year\'s best visibility (often 20-30m+), and manta rays gathering at cleaning stations like Manta Sandy in their biggest numbers, especially January and February.';
const BELIZE_JANFEB = 'Dry season, calm seas — Hol Chan, Shark Ray Alley, and the Blue Hole are all at their best.';
const BELIZE_MARJUN = 'Dry season conditions continue, and whale sharks gather at Gladden Spit around the full moons to feed on spawning snapper — the best window to add that sighting to a trip.';
const BELIZE_HURRICANE = 'Hurricane season brings rougher seas and lower visibility; diving continues, but trips get more weather-dependent.';
const BORABORA_WET = 'The wetter season, with occasional cyclone risk. The sharks, rays, and mantas are just as reliable as any other month — the difference is water clarity, which is at its least consistent now.';
const BORABORA_TRANSITION = 'Transitioning — clarity improving or easing as the dry/wet season approaches.';
const BORABORA_DRY = 'The dry season, the calmest and clearest water of the year. Wildlife sightings aren\'t any more or less likely now — this is purely about water clarity.';

const MONTHLY: Record<string, string[]> = {
  rajaampat: [
    RAJAAMPAT_PEAK, RAJAAMPAT_PEAK, RAJAAMPAT_PEAK, RAJAAMPAT_PEAK,
    'Conditions are easing as the wet season approaches, and manta numbers at the cleaning stations start to thin.',
    'The wettest, roughest months — choppier crossings, lower visibility, and the fewest mantas at the cleaning stations.',
    'The wettest, roughest months — choppier crossings, lower visibility, and the fewest mantas at the cleaning stations.',
    'The wettest, roughest months — choppier crossings, lower visibility, and the fewest mantas at the cleaning stations.',
    'Conditions are improving as the dry season returns.',
    'Peak season returns — calm seas, the year\'s best visibility, and mantas building back up at the cleaning stations.',
    'Peak season returns — calm seas, the year\'s best visibility, and mantas building back up at the cleaning stations.',
    'Peak season returns — calm seas, the year\'s best visibility, and mantas building back up at the cleaning stations.',
  ],
  belize: [
    BELIZE_JANFEB, BELIZE_JANFEB,
    BELIZE_MARJUN, BELIZE_MARJUN, BELIZE_MARJUN, BELIZE_MARJUN,
    BELIZE_HURRICANE, BELIZE_HURRICANE, BELIZE_HURRICANE, BELIZE_HURRICANE, BELIZE_HURRICANE,
    'The dry season returns — calmer seas, improving visibility.',
  ],
  borabora: [
    BORABORA_WET, BORABORA_WET, BORABORA_WET,
    BORABORA_TRANSITION,
    BORABORA_DRY, BORABORA_DRY, BORABORA_DRY, BORABORA_DRY, BORABORA_DRY, BORABORA_DRY,
    BORABORA_TRANSITION,
    BORABORA_WET,
  ],
  egypt: [
    'Good conditions year-round continue; water is at its coolest, a light wetsuit is enough.',
    'Good conditions year-round continue; water is at its coolest, a light wetsuit is enough.',
    'Good conditions year-round continue; water is at its coolest, a light wetsuit is enough.',
    'One of the two calmest shoulder windows — excellent visibility, comfortable water.',
    'One of the two calmest shoulder windows — excellent visibility, comfortable water.',
    'Peak heat above water, though diving conditions stay good; water is warmest, sometimes uncomfortably so on the surface.',
    'Peak heat above water, though diving conditions stay good; water is warmest, sometimes uncomfortably so on the surface.',
    'Peak heat above water, though diving conditions stay good; water is warmest, sometimes uncomfortably so on the surface.',
    'Peak heat above water, though diving conditions stay good; water is warmest, sometimes uncomfortably so on the surface.',
    'The other calm shoulder window, and the best chance of oceanic whitetip sharks at outer reefs like Elphinstone and Daedalus.',
    'The other calm shoulder window, and the best chance of oceanic whitetip sharks at outer reefs like Elphinstone and Daedalus.',
    'Good conditions continue as the year cools back down.',
  ],
  palau: [
    'Dry season — the calmest seas and best visibility of the year at Blue Corner and German Channel.',
    'Dry season — the calmest seas and best visibility of the year at Blue Corner and German Channel.',
    'Dry season — the calmest seas and best visibility of the year at Blue Corner and German Channel.',
    'Dry season — the calmest seas and best visibility of the year at Blue Corner and German Channel.',
    'Conditions are easing as the wet season builds.',
    'The wettest months — rougher water and lower visibility, though diving continues nearly year-round.',
    'The wettest months — rougher water and lower visibility, though diving continues nearly year-round.',
    'The wettest months — rougher water and lower visibility, though diving continues nearly year-round.',
    'The wettest months — rougher water and lower visibility, though diving continues nearly year-round.',
    'Conditions are improving as the dry season returns.',
    'Dry season peak returns — calm, clear water again.',
    'Dry season peak returns — calm, clear water again.',
  ],
  borneo: [
    'The northeast monsoon brings the roughest seas and lowest visibility of the year around Sipadan and Mabul.',
    'Transitioning — conditions improving as the monsoon eases.',
    'Calm seas and excellent visibility for most of the year — the reliable stretch for diving Sipadan\'s wall.',
    'Calm seas and excellent visibility for most of the year — the reliable stretch for diving Sipadan\'s wall.',
    'Calm seas and excellent visibility for most of the year — the reliable stretch for diving Sipadan\'s wall.',
    'Calm seas and excellent visibility for most of the year — the reliable stretch for diving Sipadan\'s wall.',
    'Calm seas and excellent visibility for most of the year — the reliable stretch for diving Sipadan\'s wall.',
    'Calm seas and excellent visibility for most of the year — the reliable stretch for diving Sipadan\'s wall.',
    'Calm seas and excellent visibility for most of the year — the reliable stretch for diving Sipadan\'s wall.',
    'Calm seas and excellent visibility for most of the year — the reliable stretch for diving Sipadan\'s wall.',
    'Transitioning — conditions easing as the monsoon builds.',
    'The northeast monsoon brings the roughest seas and lowest visibility of the year around Sipadan and Mabul.',
  ],
  maldives: [
    'Dry northeast monsoon — the calmest seas, clearest water, and busiest, most expensive season.',
    'Dry northeast monsoon — the calmest seas, clearest water, and busiest, most expensive season.',
    'Dry northeast monsoon — the calmest seas, clearest water, and busiest, most expensive season.',
    'Dry northeast monsoon — the calmest seas, clearest water, and busiest, most expensive season.',
    'The wetter southwest monsoon — windier and less predictable, though diving continues, and it\'s this season that brings the manta and whale shark aggregations to Hanifaru Bay.',
    'The wetter southwest monsoon — windier and less predictable, though diving continues, and it\'s this season that brings the manta and whale shark aggregations to Hanifaru Bay.',
    'The wetter southwest monsoon — windier and less predictable, though diving continues, and it\'s this season that brings the manta and whale shark aggregations to Hanifaru Bay.',
    'The wetter southwest monsoon — windier and less predictable, though diving continues, and it\'s this season that brings the manta and whale shark aggregations to Hanifaru Bay.',
    'The wetter southwest monsoon — windier and less predictable, though diving continues, and it\'s this season that brings the manta and whale shark aggregations to Hanifaru Bay.',
    'The wetter southwest monsoon — windier and less predictable, though diving continues, and it\'s this season that brings the manta and whale shark aggregations to Hanifaru Bay.',
    'The wetter southwest monsoon — windier and less predictable, though diving continues, and it\'s this season that brings the manta and whale shark aggregations to Hanifaru Bay.',
    'The dry season returns — calm water and clear visibility again.',
  ],
  gbr: [
    'Wet season — dangerous box jellyfish are present in open water, so a stinger suit is required; visibility is also at its lowest.',
    'Wet season — dangerous box jellyfish are present in open water, so a stinger suit is required; visibility is also at its lowest.',
    'Wet season — dangerous box jellyfish are present in open water, so a stinger suit is required; visibility is also at its lowest.',
    'Conditions are improving as the dry season approaches.',
    'Dry season — the best visibility of the year, and no stinger suit needed.',
    'Dry season — the best visibility of the year, and no stinger suit needed.',
    'Dry season — the best visibility of the year, and no stinger suit needed.',
    'Dry season — the best visibility of the year, and no stinger suit needed.',
    'Dry season — the best visibility of the year, and no stinger suit needed.',
    'Dry season — the best visibility of the year, and no stinger suit needed.',
    'The wet season is returning; stinger suits become necessary again.',
    'The wet season is returning; stinger suits become necessary again.',
  ],
  galapagos: [
    'Warmer, calmer water — more manta rays and the biggest hammerhead schools, though whale sharks are scarce.',
    'Warmer, calmer water — more manta rays and the biggest hammerhead schools, though whale sharks are scarce.',
    'Warmer, calmer water — more manta rays and the biggest hammerhead schools, though whale sharks are scarce.',
    'Warmer, calmer water — more manta rays and the biggest hammerhead schools, though whale sharks are scarce.',
    'Transitioning — cooling, with conditions building toward the pelagic season.',
    'Cooler, nutrient-rich water — the best season for whale sharks (often pregnant females) at Darwin and Wolf, though hammerhead schools tend to be smaller and a thicker wetsuit is worth it.',
    'Cooler, nutrient-rich water — the best season for whale sharks (often pregnant females) at Darwin and Wolf, though hammerhead schools tend to be smaller and a thicker wetsuit is worth it.',
    'Cooler, nutrient-rich water — the best season for whale sharks (often pregnant females) at Darwin and Wolf, though hammerhead schools tend to be smaller and a thicker wetsuit is worth it.',
    'Cooler, nutrient-rich water — the best season for whale sharks (often pregnant females) at Darwin and Wolf, though hammerhead schools tend to be smaller and a thicker wetsuit is worth it.',
    'Cooler, nutrient-rich water — the best season for whale sharks (often pregnant females) at Darwin and Wolf, though hammerhead schools tend to be smaller and a thicker wetsuit is worth it.',
    'Cooler, nutrient-rich water — the best season for whale sharks (often pregnant females) at Darwin and Wolf, though hammerhead schools tend to be smaller and a thicker wetsuit is worth it.',
    'Transitioning back toward the warmer season.',
  ],
  palawan: [
    'Peak season for El Nido and Coron, and — from mid-March — the only window Tubbataha is open at all.',
    'Peak season for El Nido and Coron, and — from mid-March — the only window Tubbataha is open at all.',
    'Peak season for El Nido and Coron, and — from mid-March — the only window Tubbataha is open at all.',
    'Peak season for El Nido and Coron, and — from mid-March — the only window Tubbataha is open at all.',
    'Still good conditions, and Tubbataha\'s season is closing by mid-June.',
    'Conditions are easing as the monsoon approaches; Tubbataha\'s brief season has ended for the year.',
    'Monsoon season — rough seas and limited diving; Tubbataha is fully closed until March.',
    'Monsoon season — rough seas and limited diving; Tubbataha is fully closed until March.',
    'Monsoon season — rough seas and limited diving; Tubbataha is fully closed until March.',
    'The dry season returns — calm water and good visibility at El Nido and Coron again.',
    'The dry season returns — calm water and good visibility at El Nido and Coron again.',
    'The dry season returns — calm water and good visibility at El Nido and Coron again.',
  ],
  okinawa: [
    'Mild, calm conditions — one of the better windows of the year.',
    'Mild, calm conditions — one of the better windows of the year.',
    'Mild, calm conditions — one of the better windows of the year.',
    'Still good, easing slightly as the wetter season approaches.',
    'The rainy season brings less reliable conditions.',
    'The rainy season brings less reliable conditions.',
    'A brief window of better weather between the rainy season and typhoon peak.',
    'Typhoon season peaks — the least reliable stretch of the year, with real risk of trip disruption.',
    'Typhoon season peaks — the least reliable stretch of the year, with real risk of trip disruption.',
    'Conditions settle back down — calm and mild again.',
    'Conditions settle back down — calm and mild again.',
    'Conditions settle back down — calm and mild again.',
  ],
  seychelles: [
    'The rainier, windier stretch of the year — the least consistent conditions.',
    'The rainier, windier stretch of the year — the least consistent conditions.',
    'Conditions are improving between the trade winds.',
    'One of the two calmest windows of the year.',
    'One of the two calmest windows of the year.',
    'Good conditions continue, and whale sharks are possible from August.',
    'Good conditions continue, and whale sharks are possible from August.',
    'Good conditions continue, and whale sharks are possible from August.',
    'Good conditions continue, and whale sharks are possible from August.',
    'The other calm window, and the best chance of whale sharks.',
    'The other calm window, and the best chance of whale sharks.',
    'The rainier season returns.',
  ],
  thailand: [
    'Peak season — the Similan Islands are open and at their best.',
    'Peak season — the Similan Islands are open and at their best.',
    'Still open and good, easing slightly as the monsoon approaches.',
    'Still open and good, easing slightly as the monsoon approaches.',
    'Still open, though the islands close by May 15 as the monsoon arrives.',
    'The Similan Islands are completely closed to all visitors — monsoon seas make the crossing unsafe, and the park closure lets the reef recover.',
    'The Similan Islands are completely closed to all visitors — monsoon seas make the crossing unsafe, and the park closure lets the reef recover.',
    'The Similan Islands are completely closed to all visitors — monsoon seas make the crossing unsafe, and the park closure lets the reef recover.',
    'The Similan Islands are completely closed to all visitors — monsoon seas make the crossing unsafe, and the park closure lets the reef recover.',
    'The Similan Islands are completely closed to all visitors — monsoon seas make the crossing unsafe, and the park closure lets the reef recover.',
    'The islands reopen (October 15) and conditions are back to their best.',
    'The islands reopen (October 15) and conditions are back to their best.',
  ],
  fiji: [
    'Cyclone season peaks — the least reliable stretch of the year for diving.',
    'Cyclone season peaks — the least reliable stretch of the year for diving.',
    'Cyclone season peaks — the least reliable stretch of the year for diving.',
    'Conditions are improving fast as cyclone risk eases.',
    'The dry season — calm, clear water and the best diving of the year.',
    'The dry season — calm, clear water and the best diving of the year.',
    'The dry season — calm, clear water and the best diving of the year.',
    'The dry season — calm, clear water and the best diving of the year.',
    'The dry season — calm, clear water and the best diving of the year.',
    'The dry season — calm, clear water and the best diving of the year.',
    'Still good conditions as the wetter season approaches.',
    'Cyclone risk is building again.',
  ],
  rivieramaya: [
    'Dry season — the best reef diving conditions of the year; cenotes are unaffected year-round.',
    'Dry season — the best reef diving conditions of the year; cenotes are unaffected year-round.',
    'Dry season — the best reef diving conditions of the year; cenotes are unaffected year-round.',
    'Dry season — the best reef diving conditions of the year; cenotes are unaffected year-round.',
    'Still good, easing as hurricane season begins.',
    'Hurricane season is underway and reef conditions get choppier, but this is also whale shark season off Isla Mujeres and Isla Holbox — cenotes remain a reliable backup regardless of ocean conditions.',
    'Hurricane season is underway and reef conditions get choppier, but this is also whale shark season off Isla Mujeres and Isla Holbox — cenotes remain a reliable backup regardless of ocean conditions.',
    'Peak hurricane risk — the least reliable stretch for reef diving, though whale sharks are still present through early September and cenotes stay unaffected.',
    'Peak hurricane risk — the least reliable stretch for reef diving, though whale sharks may linger into September and cenotes stay unaffected.',
    'Conditions are slowly improving as hurricane season winds down.',
    'The dry season returns — calm, clear reef diving again.',
    'The dry season returns — calm, clear reef diving again.',
  ],
  komodo: [
    'The wet season — rain and rougher crossings make conditions less reliable.',
    'The wet season — rain and rougher crossings make conditions less reliable.',
    'The wet season — rain and rougher crossings make conditions less reliable.',
    'The dry season — calm seas and reliable, current-driven diving throughout the park.',
    'The dry season — calm seas and reliable, current-driven diving throughout the park.',
    'The dry season — calm seas and reliable, current-driven diving throughout the park.',
    'The dry season — calm seas and reliable, current-driven diving throughout the park.',
    'The dry season — calm seas and reliable, current-driven diving throughout the park.',
    'The dry season — calm seas and reliable, current-driven diving throughout the park.',
    'The dry season — calm seas and reliable, current-driven diving throughout the park.',
    'The dry season — calm seas and reliable, current-driven diving throughout the park.',
    'The dry season — calm seas and reliable, current-driven diving throughout the park.',
  ],
  'turks-caicos': [
    'Dry season, calm and clear — the best window of the year.',
    'Dry season, calm and clear — the best window of the year.',
    'Dry season, calm and clear — the best window of the year.',
    'Dry season, calm and clear — the best window of the year.',
    'Still good, easing as hurricane season begins.',
    'Hurricane season is underway; conditions are less consistent.',
    'Hurricane season is underway; conditions are less consistent.',
    'Peak hurricane risk — the least reliable stretch of the year, with real potential for trip disruption.',
    'Peak hurricane risk — the least reliable stretch of the year, with real potential for trip disruption.',
    'Peak hurricane risk — the least reliable stretch of the year, with real potential for trip disruption.',
    'Conditions are recovering as hurricane season ends.',
    'Back to calm, clear dry-season conditions.',
  ],
  mauritius: [
    'Cyclone season — the least reliable stretch of the year.',
    'Cyclone season — the least reliable stretch of the year.',
    'Cyclone season — the least reliable stretch of the year.',
    'Conditions are improving as cyclone risk eases.',
    'The drier, cooler season — the most reliable diving conditions of the year.',
    'The drier, cooler season — the most reliable diving conditions of the year.',
    'The drier, cooler season — the most reliable diving conditions of the year.',
    'The drier, cooler season — the most reliable diving conditions of the year.',
    'The drier, cooler season — the most reliable diving conditions of the year.',
    'The drier, cooler season — the most reliable diving conditions of the year.',
    'The drier, cooler season — the most reliable diving conditions of the year.',
    'Cyclone risk is building again.',
  ],
  'papua-new-guinea': [
    'The wet season brings heavier rain and rougher diving conditions.',
    'The wet season brings heavier rain and rougher diving conditions.',
    'The wet season brings heavier rain and rougher diving conditions.',
    'Conditions are improving as the dry season approaches.',
    'The dry season — the most reliable conditions of the year.',
    'The dry season — the most reliable conditions of the year.',
    'The dry season — the most reliable conditions of the year.',
    'The dry season — the most reliable conditions of the year.',
    'The dry season — the most reliable conditions of the year.',
    'Still good, easing as the wet season approaches.',
    'Still good, easing as the wet season approaches.',
    'The wet season returns.',
  ],
  bahamas: [
    'Tiger sharks are at Tiger Beach in good numbers, and conditions overall are calm and clear — the best window of the year.',
    'Tiger sharks are at Tiger Beach in good numbers, and conditions overall are calm and clear — the best window of the year.',
    'Tiger sharks are at Tiger Beach in good numbers, and conditions overall are calm and clear — the best window of the year.',
    'Tiger sharks are at Tiger Beach in good numbers, and conditions overall are calm and clear — the best window of the year.',
    'Still good conditions, and oceanic whitetip sharks begin arriving off Cat Island.',
    'Oceanic whitetip season continues, though hurricane season is starting and conditions ease.',
    'Oceanic whitetip season continues, though hurricane season is starting and conditions ease.',
    'Peak hurricane risk — the least reliable stretch of the year, with real potential for trip disruption.',
    'Peak hurricane risk — the least reliable stretch of the year, with real potential for trip disruption.',
    'Peak hurricane risk — the least reliable stretch of the year, with real potential for trip disruption.',
    'Conditions recover, and tiger sharks return to Tiger Beach for the season.',
    'Calm, clear conditions return, tiger sharks reliably present.',
  ],
  bali: [
    'The wet season — rougher water and lower visibility, though the Liberty wreck and Manta Point remain diveable.',
    'The wet season — rougher water and lower visibility, though the Liberty wreck and Manta Point remain diveable.',
    'The wet season — rougher water and lower visibility, though the Liberty wreck and Manta Point remain diveable.',
    'The dry season is underway — calm, clear conditions across the island.',
    'The dry season is underway — calm, clear conditions across the island.',
    'The dry season is underway — calm, clear conditions across the island.',
    'Dry season conditions continue, and this is when mola mola (giant ocean sunfish) show up at Nusa Penida\'s cleaning stations, drawn by a seasonal cold-water upwelling — the single biggest reason divers time a trip around this window.',
    'Dry season conditions continue, and this is when mola mola (giant ocean sunfish) show up at Nusa Penida\'s cleaning stations, drawn by a seasonal cold-water upwelling — the single biggest reason divers time a trip around this window.',
    'Dry season conditions continue, and this is when mola mola (giant ocean sunfish) show up at Nusa Penida\'s cleaning stations, drawn by a seasonal cold-water upwelling — the single biggest reason divers time a trip around this window.',
    'Dry season conditions continue, and this is when mola mola (giant ocean sunfish) show up at Nusa Penida\'s cleaning stations, drawn by a seasonal cold-water upwelling — the single biggest reason divers time a trip around this window.',
    'The wet season returns — rougher water and lower visibility.',
    'The wet season returns — rougher water and lower visibility.',
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
