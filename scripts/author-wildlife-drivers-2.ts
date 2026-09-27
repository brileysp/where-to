import { readFileSync } from 'fs';
import { join } from 'path';
import { eq } from 'drizzle-orm';
import { drizzle as drizzlePostgres } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import { places, adminAuditLog } from '../src/lib/db/schema';
import type { SliderEvent } from '../src/lib/scoring/types';

/**
 * Second wildlife-driver pass — the rest of the catalogue beyond the 13
 * destinations author-wildlife-drivers.ts already settled.
 *
 * Three kinds of edit, by how confident the underlying claim is:
 *
 * 1. NEW REAL STORIES — a specific, well-documented phenomenon that had no
 *    representation at all: Ladakh's snow-leopard tracking season (Hemis
 *    NP, Jan-Mar), Kerala's Periyar reservoir dry-season concentration,
 *    Ghana's Mole NP elephant concentration, Nepal's Chitwan dry-season
 *    access, Borneo's Kinabatangan river concentration, the Scottish
 *    Highlands' October deer rut, Olympic's Roosevelt elk rut (mirroring
 *    Rocky Mountain's already-authored one), the Maldives' Hanifaru Bay
 *    manta/whale-shark aggregation, and several whale-migration windows
 *    (Marlborough & Abel Tasman's Cook Strait passage, Quebec City's St
 *    Lawrence season, Ireland's coastal season, Panama's two-hemisphere
 *    double season, Greenland's ice-free window).
 *
 * 2. MECHANISM CONVERSIONS — a destination whose CLAIM is not being
 *    revisited, only its mechanism: `wildlifePeak` is a flat, destination-
 *    level flag (`has(wildlifePeak, m) ? 7 : 0`, the exact shape this
 *    entire wildlife-family review started from), shared across every
 *    slider using the 'wildlife' formula at that destination. Converting
 *    it to a `sliderEvent` with weight = (current peak - base) reproduces
 *    the IDENTICAL existing peak, but lets fitMonthlyToCurve smooth the
 *    transition instead of stepping. This is the bulk of this pass by
 *    count. Two get a genuine two-peak split instead of one flat mesa,
 *    because the flagged months are two separate, non-adjacent clusters
 *    describing two different real phenomena: Lofoten (winter orca on the
 *    herring run, summer bird cliffs) and Panama (two whale populations,
 *    each hemisphere's winter).
 *
 * 3. MIRRORS — the identical phenomenon already correctly authored on one
 *    slider, carried onto a sibling slider that shares the formula but had
 *    no event of its own (safari mirrors for Uganda/Rwanda/Rajasthan/
 *    Pantanal/Ethiopia; whaleWatching mirrors for Svalbard/Punta Cana/
 *    Okinawa/Canaries, reading the sibling's own event rather than the
 *    shared flag).
 *
 * EVERY weight is checked against the relevant anchor set (anchors.ts)
 * BEFORE being finalized — not after. A destination not in a slider's
 * anchor list must never be pushed to a peak of 10; several of the
 * straight-mirror weights above were scaled down for exactly this reason,
 * and one (Borneo, already at a base of 9) needed a very small weight to
 * avoid Math.round(9.5) silently becoming 10 — the same rounding trap
 * found and fixed in the first wildlife pass.
 *
 * DELIBERATELY LEFT FLAT — no event authored, no flag touched. Real
 * consideration, not an oversight: these destinations have no dramatic,
 * specific, well-documented seasonal wildlife phenomenon distinct from
 * "resident wildlife, present year-round." Manufacturing one for the sake
 * of giving every row a story is the exact mistake the first wildlife pass
 * corrected for Costa Rica.
 *   palau, belize, colombian-andes, ecuadorian-andes, el-chalten, uyuni,
 *   atacama, guatemala, palawan, badlands-black-hills, uluru,
 *   papua-new-guinea, whistler, upper-peninsula, north-cascades
 *   (wildlifeViewing only — its wildflowerBlooms IS authored below),
 *   greenland (wildlifeViewing only — its whaleWatching IS authored below).
 */

type Edit = {
  id: string;
  slider: string;
  events: SliderEvent[];
  clearWildlifePeakFlag?: boolean;
  why: string;
};

const EDITS: Edit[] = [
  // ==== 1. NEW REAL STORIES ==============================================
  { id: 'ladakh', slider: 'wildlifeViewing',
    why: 'snow-leopard tracking season at Hemis NP — a real single-species spectacle, peak Feb, window Jan-Mar',
    events: [{ label: 'Snow leopard tracking season (Hemis NP)', weight: 3, months: { 1: 0.7, 2: 1, 3: 1 } }] },
  { id: 'kerala', slider: 'wildlifeViewing',
    why: 'Periyar reservoir dry-season concentration — a real, if smaller-scale, water-concentration mechanic',
    events: [{ label: 'Periyar reservoir dry-season concentration', weight: 2, months: { 12: 0.6, 1: 1, 2: 1, 3: 1, 4: 0.6 } }] },
  { id: 'ghana', slider: 'wildlifeViewing',
    why: "Mole NP's dry-season elephant concentration at the river",
    events: [{ label: 'Mole National Park dry-season concentration', weight: 2, months: { 12: 0.5, 1: 1, 2: 1, 3: 1, 4: 0.6 } }] },
  { id: 'nepal', slider: 'wildlifeViewing',
    why: 'Chitwan dry-season access and visibility, avoiding the monsoon — comfort/visibility group, same light touch as Kaziranga',
    events: [{ label: 'Chitwan dry-season access', weight: 1.5, months: { 10: 0.5, 11: 0.85, 12: 1, 1: 1, 2: 1, 3: 0.7 } }] },
  { id: 'nepal', slider: 'safari', why: 'mirrored — Chitwan tiger/rhino safari, same driver',
    events: [{ label: 'Chitwan dry-season access', weight: 1.5, months: { 10: 0.5, 11: 0.85, 12: 1, 1: 1, 2: 1, 3: 0.7 } }] },
  { id: 'borneo', slider: 'wildlifeViewing',
    why: 'Kinabatangan river dry-season concentration — already a base of 9, so a small weight to avoid clamping (Borneo is not a wildlifeViewing anchor)',
    events: [{ label: 'Kinabatangan river dry-season concentration', weight: 0.3, months: { 3: 0.4, 6: 0.7, 7: 1, 8: 1, 9: 0.7 } }] },
  { id: 'scottish-highlands-skye', slider: 'wildlifeViewing',
    why: 'the red deer rut — a well-known, specific October event',
    events: [{ label: 'Red deer rut', weight: 2, months: { 9: 0.4, 10: 1 } }] },
  { id: 'olympic', slider: 'wildlifeViewing',
    why: "Roosevelt elk fall rut, mirroring Rocky Mountain's already-authored elk-rut event",
    events: [{ label: 'Roosevelt elk rut', weight: 2, months: { 9: 1, 10: 0.7 } }] },
  { id: 'maldives', slider: 'wildlifeViewing',
    why: 'Hanifaru Bay manta ray and whale shark aggregation — monsoon-driven plankton bloom, real and well documented',
    events: [{ label: 'Hanifaru Bay manta & whale shark aggregation', weight: 3, months: { 6: 0.4, 7: 0.7, 8: 1, 9: 1, 10: 0.7, 11: 0.4 } }] },
  { id: 'marlborough-abel-tasman', slider: 'whaleWatching',
    why: 'Cook Strait humpback passage — a genuine two-peak migration (northbound and southbound), not a single season',
    events: [
      { label: 'Humpback passage (northbound)', weight: 1, months: { 6: 0.6, 7: 1, 8: 0.7 } },
      { label: 'Humpback passage (southbound)', weight: 1, months: { 9: 0.6, 10: 1, 11: 0.6 } },
    ] },
  { id: 'quebec-city', slider: 'whaleWatching',
    why: 'St Lawrence beluga/blue/minke season at Tadoussac, May-Oct, peak Jul-Sep',
    events: [{ label: 'St Lawrence whale season (Tadoussac)', weight: 2, months: { 5: 0.4, 6: 0.7, 7: 1, 8: 1, 9: 1, 10: 0.5 } }] },
  { id: 'ireland', slider: 'whaleWatching',
    why: 'Irish coastal whale/dolphin season, best documented Jul-Oct (post-breeding baleen whales, especially West Cork)',
    events: [{ label: 'Irish coastal whale season', weight: 3, months: { 7: 0.5, 8: 0.85, 9: 1, 10: 0.7 } }] },
  { id: 'panama', slider: 'whaleWatching',
    why: 'Panama sees TWO humpback populations from opposite hemispheres — a genuine two-peak season, not one',
    events: [
      { label: 'Southern-hemisphere humpbacks', weight: 1.5, months: { 7: 0.6, 8: 1, 9: 1, 10: 0.6 } },
      { label: 'Northern-hemisphere humpbacks', weight: 1.5, months: { 12: 0.5, 1: 0.85, 2: 1, 3: 0.7 } },
    ] },
  { id: 'greenland', slider: 'whaleWatching',
    why: 'ice-free fjord access window, Jun-Sep',
    events: [{ label: 'Ice-free fjord season', weight: 2, months: { 6: 0.6, 7: 1, 8: 1, 9: 0.6 } }] },

  // ==== 2. MECHANISM CONVERSIONS (weight = current peak - base) ==========
  // Straightforward flag-to-event conversions preserving the destination's
  // existing peak exactly — see the header comment. Months carry the same
  // flagged set at full intensity; fitMonthlyToCurve supplies the smooth
  // transition, not a hand-graduated ramp.
  { id: 'nova-scotia', slider: 'wildlifeViewing', clearWildlifePeakFlag: true, why: 'flag->event, same peak (8)',
    events: [{ label: 'Peak wildlife season', weight: 4, months: { 7: 1, 8: 1, 9: 1 } }] },
  { id: 'gbr', slider: 'wildlifeViewing', clearWildlifePeakFlag: true, why: 'flag->event, same peak (9)',
    events: [{ label: 'Dry-season reef visibility', weight: 1, months: { 6: 1, 7: 1, 8: 1, 9: 1 } }] },
  { id: 'yosemite', slider: 'wildlifeViewing', clearWildlifePeakFlag: true, why: 'flag->event, same peak (5) — black bear spring/fall activity',
    events: [{ label: 'Black bear spring & fall activity', weight: 1, months: { 4: 1, 5: 1, 9: 1, 10: 1 } }] },
  { id: 'peru', slider: 'wildlifeViewing', clearWildlifePeakFlag: true, why: 'flag->event, same peak (5) — Amazon dry-season access',
    events: [{ label: 'Amazon dry-season access', weight: 1, months: { 5: 1, 6: 1, 7: 1, 8: 1, 9: 1 } }] },
  { id: 'iceland', slider: 'wildlifeViewing', clearWildlifePeakFlag: true, why: 'flag->event, same peak (6) — arctic fox, seals, summer accessibility',
    events: [{ label: 'Summer wildlife accessibility', weight: 1, months: { 6: 1, 7: 1, 8: 1 } }] },
  { id: 'tasmania', slider: 'wildlifeViewing', why: 'flag->event, same peak (8) — austral spring activity',
    events: [{ label: 'Austral spring activity', weight: 4, months: { 9: 1, 10: 1, 11: 1, 12: 1 } }] },
  { id: 'tasmania', slider: 'wildflowerBlooms', clearWildlifePeakFlag: true, why: 'flag->event, same peak (9) — austral spring bloom, same window as wildlifeViewing above',
    events: [{ label: 'Austral spring bloom', weight: 7, months: { 9: 1, 10: 1, 11: 1, 12: 1 } }] },
  { id: 'ethiopia', slider: 'wildlifeViewing', why: 'flag->event, same peak (9) — dry-season highlands wildlife',
    events: [{ label: 'Dry-season highlands wildlife', weight: 4, months: { 10: 1, 11: 1, 12: 1, 1: 1, 2: 1, 3: 1 } }] },
  { id: 'ethiopia', slider: 'safari', clearWildlifePeakFlag: true, why: 'flag->event, same peak (7) — Omo Valley / Bale Mountains dry season',
    events: [{ label: 'Dry-season game viewing', weight: 4, months: { 10: 1, 11: 1, 12: 1, 1: 1, 2: 1, 3: 1 } }] },
  { id: 'cape-town', slider: 'wildlifeViewing', why: 'flag->event, same peak (6) — southern right whale season overlap',
    events: [{ label: 'Southern right whale season overlap', weight: 4, months: { 7: 1, 8: 1, 9: 1, 10: 1 } }] },
  { id: 'cape-town', slider: 'wildflowerBlooms', clearWildlifePeakFlag: true, why: 'flag->event, same peak (10, an anchor) — fynbos & Namaqualand spring bloom',
    events: [{ label: 'Fynbos & Namaqualand spring bloom', weight: 4, months: { 7: 1, 8: 1, 9: 1, 10: 1 } }] },
  { id: 'banff', slider: 'wildlifeViewing', clearWildlifePeakFlag: true, why: 'flag->event, same peak (8) — spring emergence and fall shoulder seasons',
    events: [{ label: 'Spring & fall wildlife activity', weight: 3, months: { 5: 1, 6: 1, 9: 1, 10: 1 } }] },
  { id: 'big-island', slider: 'wildlifeViewing', why: 'flag->event, same peak (9) — humpback whale season overlap',
    events: [{ label: 'Humpback whale season overlap', weight: 7, months: { 12: 1, 1: 1, 2: 1, 3: 1, 4: 1 } }] },
  { id: 'big-island', slider: 'whaleWatching', clearWildlifePeakFlag: true, why: 'flag->event, same peak (9) — humpback whale season',
    events: [{ label: 'Humpback whale season', weight: 2, months: { 12: 1, 1: 1, 2: 1, 3: 1, 4: 1 } }] },
  { id: 'tierra-del-fuego', slider: 'wildlifeViewing', why: 'flag->event, same peak (8) — austral summer marine mammals & penguins',
    events: [{ label: 'Austral summer wildlife', weight: 2, months: { 11: 1, 12: 1, 1: 1, 2: 1, 3: 1 } }] },
  { id: 'tierra-del-fuego', slider: 'whaleWatching', clearWildlifePeakFlag: true, why: 'flag->event, same peak (8) — austral summer whale season',
    events: [{ label: 'Austral summer whale season', weight: 4, months: { 11: 1, 12: 1, 1: 1, 2: 1, 3: 1 } }] },
  { id: 'vancouver-island', slider: 'wildlifeViewing', clearWildlifePeakFlag: true, why: 'flag->event, same peak (8) — orca season overlap',
    events: [{ label: 'Orca season overlap', weight: 3, months: { 6: 1, 7: 1, 8: 1, 9: 1 } }] },
  { id: 'maui', slider: 'wildlifeViewing', why: 'flag->event, same peak (7) — humpback whale season overlap',
    events: [{ label: 'Humpback whale season overlap', weight: 5, months: { 12: 1, 1: 1, 2: 1, 3: 1, 4: 1 } }] },
  { id: 'southeast-alaska', slider: 'wildlifeViewing', clearWildlifePeakFlag: true, why: 'flag->event, same peak (9) — bears at salmon runs, whales',
    events: [{ label: 'Salmon-run bears & whale season', weight: 4, months: { 6: 1, 7: 1, 8: 1 } }] },
  { id: 'monterey-big-sur', slider: 'wildlifeViewing', why: 'flag->event, same peak (8) — elephant seal pupping (Dec-Mar) and gray whale migration overlap',
    events: [{ label: 'Elephant seal pupping & gray whale migration', weight: 5, months: { 12: 1, 1: 1, 2: 1, 3: 1, 4: 1 } }] },
  { id: 'lofoten', slider: 'wildlifeViewing',
    why: 'a genuine two-peak year, not one flag: winter orca on the herring run, summer bird cliffs',
    events: [
      { label: 'Winter orca (herring run)', weight: 2.5, months: { 11: 0.6, 12: 1, 1: 1 } },
      { label: 'Summer bird cliffs', weight: 2.5, months: { 5: 0.6, 6: 1, 7: 1, 8: 0.7 } },
    ] },
  // Lofoten is not a whaleWatching anchor (monterey-big-sur, vancouver-island,
  // southeast-alaska, los-cabos, iceland, nova-scotia, maui, azores) — weight
  // targets its existing true peak of 9, not the clamped 10 a weight-4 mirror
  // would have produced on an 8 base.
  { id: 'lofoten', slider: 'whaleWatching', clearWildlifePeakFlag: true,
    why: 'mirrors the winter-orca half of wildlifeViewing above — whales specifically, not the summer bird cliffs',
    events: [{ label: 'Winter orca (herring run)', weight: 1, months: { 11: 0.6, 12: 1, 1: 1 } }] },
  { id: 'glacier-waterton', slider: 'wildlifeViewing', why: 'flag->event, same peak (7) — summer high-country accessibility',
    events: [{ label: 'Summer high-country accessibility', weight: 1, months: { 6: 1, 7: 1, 8: 1, 9: 1 } }] },
  { id: 'glacier-waterton', slider: 'wildflowerBlooms', clearWildlifePeakFlag: true, why: 'flag->event, same peak (10, an anchor) — alpine wildflower season, same window',
    events: [{ label: 'Alpine wildflower season', weight: 4, months: { 6: 1, 7: 1, 8: 1, 9: 1 } }] },
  { id: 'torres-del-paine', slider: 'wildlifeViewing', clearWildlifePeakFlag: true, why: 'flag->event, same peak (8) — austral spring/summer season',
    events: [{ label: 'Austral spring/summer season', weight: 1, months: { 10: 1, 11: 1, 12: 1, 1: 1, 2: 1, 3: 1 } }] },
  { id: 'rivieramaya', slider: 'wildlifeViewing', clearWildlifePeakFlag: true, why: 'flag->event, same peak (7) — whale shark season at Isla Holbox/Isla Mujeres',
    events: [{ label: 'Whale shark season (Isla Holbox)', weight: 3, months: { 6: 1, 7: 1, 8: 1, 9: 1 } }] },
  { id: 'seychelles', slider: 'wildlifeViewing', clearWildlifePeakFlag: true, why: 'flag->event, same peak (8) — tail end of whale shark season',
    events: [{ label: 'Whale shark season (tail end)', weight: 6, months: { 10: 1, 11: 1 } }] },
  { id: 'cape-cod-islands', slider: 'wildlifeViewing', why: 'flag->event, same peak (8) — Stellwagen Bank whale season overlap',
    events: [{ label: 'Stellwagen Bank whale season overlap', weight: 7, months: { 4: 1, 5: 1, 6: 1, 9: 1, 10: 1 } }] },
  { id: 'cape-cod-islands', slider: 'whaleWatching', clearWildlifePeakFlag: true, why: 'flag->event, same peak (9) — Stellwagen Bank season',
    events: [{ label: 'Stellwagen Bank whale season', weight: 1, months: { 4: 1, 5: 1, 6: 1, 9: 1, 10: 1 } }] },
  { id: 'canaries', slider: 'wildlifeViewing', why: 'flag->event, same peak (3) — the shared flag is genuinely uncertain here (Canary dolphin/pilot-whale watching is good near year-round), kept at its existing modest claim rather than asserted with more confidence than is warranted',
    events: [{ label: 'Spring wildlife activity', weight: 2, months: { 3: 1, 4: 1, 5: 1 } }] },
  { id: 'canaries', slider: 'whaleWatching', why: 'flag->event, same peak (8) — same uncertainty noted above',
    events: [{ label: 'Spring whale activity', weight: 1, months: { 3: 1, 4: 1, 5: 1 } }] },
  { id: 'canaries', slider: 'wildflowerBlooms', clearWildlifePeakFlag: true, why: 'flag->event, same peak (10, an anchor) — spring bloom on volcanic slopes, higher confidence than the fauna claims above',
    events: [{ label: 'Spring bloom on volcanic slopes', weight: 6, months: { 3: 1, 4: 1, 5: 1 } }] },

  // ==== 3. MIRRORS (identical phenomenon, sibling slider) ================
  { id: 'uganda', slider: 'safari', why: "mirrors wildlifeViewing's drier-trekking-trails event — gorilla trekking is the safari product here",
    events: [{ label: 'Easier, drier trekking trails', weight: 1.5, months: { 1: 1, 2: 1, 6: 1, 7: 1, 8: 0.6, 12: 0.6 } }] },
  { id: 'rwanda', slider: 'safari', why: 'mirrors wildlifeViewing, same driver',
    events: [{ label: 'Easier, drier trekking trails', weight: 1.5, months: { 1: 1, 2: 1, 6: 0.6, 7: 1, 8: 1, 9: 0.6, 12: 0.6 } }] },
  { id: 'rajasthan-golden-triangle', slider: 'safari',
    why: "mirrors wildlifeViewing's tiger-sighting event, weight scaled down — Rajasthan is not a safari anchor and the literal weight would have clamped it",
    events: [{ label: 'Tiger sightings (thinning dry-season vegetation)', weight: 2, months: { 3: 0.5, 4: 0.85, 5: 1, 6: 1 } }] },
  { id: 'pantanal', slider: 'safari',
    why: "mirrors wildlifeViewing's jaguar-season event, weight scaled down — Pantanal is not a safari anchor",
    events: [{ label: 'Jaguar season (dry-season riverbank concentration)', weight: 2, months: { 7: 0.85, 8: 1, 9: 1, 10: 0.7 } }] },
  { id: 'svalbard', slider: 'whaleWatching',
    why: "mirrors the open-water half of wildlifeViewing's two events — whales need open water, not the ice-edge polar-bear season — weight scaled down as Svalbard is not a whaleWatching anchor",
    events: [{ label: 'Walrus, whales & seabird cliffs (open-water season)', weight: 2.5, months: { 6: 0.6, 7: 1, 8: 1, 9: 0.6 } }] },
  { id: 'punta-cana', slider: 'whaleWatching', clearWildlifePeakFlag: true,
    why: "mirrors wildlifeViewing's own humpback event exactly — same phenomenon, same slider family",
    events: [{ label: 'Humpback whale season off Samaná', weight: 3, months: { 1: 1, 2: 1, 3: 1 } }] },
  { id: 'okinawa', slider: 'whaleWatching', why: "mirrors wildlifeViewing's humpback event",
    events: [{ label: 'Humpback whale season (Kerama Islands)', weight: 2, months: { 1: 0.6, 2: 1, 3: 0.6 } }] },

  // ==== 4. New wildflowerBlooms stories (H2 snowmelt/temperature, H3 cultivated) ====
  { id: 'north-cascades', slider: 'wildflowerBlooms', why: 'H2 — alpine wildflower season, snowmelt-triggered',
    events: [{ label: 'Alpine wildflower season', weight: 2, months: { 7: 1, 8: 1 } }] },
  { id: 'olympic', slider: 'wildflowerBlooms', why: 'H2 — Hurricane Ridge alpine wildflowers',
    events: [{ label: 'Alpine wildflower season (Hurricane Ridge)', weight: 2, months: { 7: 1, 8: 1 } }] },
  { id: 'swissalps', slider: 'wildflowerBlooms', why: 'H2 — alpine wildflower season',
    events: [{ label: 'Alpine wildflower season', weight: 2, months: { 6: 1, 7: 1, 8: 1 } }] },
  { id: 'rocky-mountain', slider: 'wildflowerBlooms', why: 'H2 — alpine tundra wildflower season',
    events: [{ label: 'Alpine tundra wildflower season', weight: 2, months: { 7: 1, 8: 1 } }] },
  { id: 'azores', slider: 'wildflowerBlooms', why: 'hydrangea bloom season — the Azores\' distinctive summer flora',
    events: [{ label: 'Hydrangea bloom season', weight: 2, months: { 6: 1, 7: 1, 8: 1 } }] },
  { id: 'amsterdam', slider: 'wildflowerBlooms',
    why: 'H3 cultivated — Keukenhof tulip season is a genuinely narrow April peak, not a broad summer bloom; weight scaled to avoid clamping (Amsterdam already has a high base of 8 and is not an anchor)',
    events: [{ label: 'Tulip season (Keukenhof)', weight: 1, months: { 3: 0.4, 4: 1, 5: 0.5 } }] },
];

const MAX_STEEPNESS = 4;
const ERROR_TOLERANCE = 0.5;

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
  if (!env.DATABASE_URL) {
    console.error('No DATABASE_URL in .env.local — refusing to run against the PGlite fallback.');
    process.exit(1);
  }
  process.env.DATABASE_URL = env.DATABASE_URL;
  // Dynamic, after the env is set — see review-scenic-saturation.ts.
  const { toScoringPlace } = await import('../src/lib/db/queries/places');
  const { deriveDestinationScores, isSliderNA } = await import('../src/lib/scoring/destinations');
  const { fitMonthlyToCurve } = await import('../src/lib/scoring/fitCurve');
  const dryRun = process.argv.includes('--dry-run');
  const db = drizzlePostgres(postgres(env.DATABASE_URL, { prepare: false }));

  const ids = [...new Set(EDITS.map((e) => e.id))];
  const rows = await db.select().from(places).where(eq(places.isPrimaryDestination, true));
  const byId = new Map(rows.filter((r) => ids.includes(r.id)).map((r) => [r.id, { ...r }]));
  for (const id of ids) if (!byId.has(id)) { console.error(`${id}: not a primary destination`); process.exit(1); }

  let overCap = 0;
  for (const e of EDITS) {
    const row = byId.get(e.id)!;
    const scoring = toScoringPlace(row);
    if (isSliderNA(scoring, e.slider)) { console.error(`${e.id}/${e.slider}: is N/A`); process.exit(1); }

    const patchedEvents = { ...(scoring.sliderEvents ?? {}) };
    if (e.events.length > 0) patchedEvents[e.slider] = e.events;
    else delete patchedEvents[e.slider];
    const patchedScoring = { ...scoring, sliderEvents: patchedEvents };
    if (e.clearWildlifePeakFlag) patchedScoring.wildlifePeak = [];

    const before = deriveDestinationScores(scoring, { skipHazards: true }).monthly[e.slider];
    const { monthly } = deriveDestinationScores(patchedScoring, { skipHazards: true });
    const values = monthly[e.slider];
    const fit = fitMonthlyToCurve(values, { maxSteepness: MAX_STEEPNESS, errorTolerance: ERROR_TOLERANCE });

    const was = Math.max(...before);
    const now = Math.max(...values);
    if (now >= 9.99) overCap++;
    console.log(`  ${e.id.padEnd(26)} ${e.slider.padEnd(15)} peak ${was.toFixed(1)} -> ${now.toFixed(1)}   ${e.why}`);

    const patch: Record<string, unknown> = {
      sliderEvents: patchedEvents,
      sliderCurves: { ...(row.sliderCurves as Record<string, unknown>), [e.slider]: fit.curve },
      authoredCurves: Array.from(new Set([...(row.authoredCurves ?? []), e.slider])),
    };
    if (e.clearWildlifePeakFlag) patch.wildlifePeakMonths = [];

    const after = { ...row, ...patch };
    if (!dryRun) {
      await db.transaction(async (tx) => {
        await tx.update(places)
          .set({ ...(patch as Partial<typeof places.$inferInsert>), updatedAt: new Date() })
          .where(eq(places.id, e.id));
        await tx.insert(adminAuditLog).values({
          actorId: '00000000-0000-0000-0000-000000000000',
          entityType: 'destination',
          entityId: e.id,
          action: 'update',
          beforeValue: row,
          afterValue: after,
        });
      });
    }
    byId.set(e.id, after as typeof row);
  }

  console.log(`\n${EDITS.length} edits, ${overCap} hit a peak >= 9.99 (verify these against anchors.ts).`);
  console.log(dryRun ? 'dry run — nothing written.' : 'done.');
  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
