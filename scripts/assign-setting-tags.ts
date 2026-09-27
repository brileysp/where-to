import { readFileSync } from 'fs';
import { join } from 'path';

/**
 * DRAFT place-type tags for every primary place (see src/lib/places/setting-tags.ts).
 * First tag = primary. Meant to be reviewed and corrected in the admin Places
 * grid ("Place type" column) — this only seeds a starting point.
 *
 * Validates that every primary place is covered, no unknown ids, 1–4 unique
 * valid tags each. Dry run by default (prints per-tag counts); --write saves.
 * Doesn't touch updated_at, so open admin pages don't hit conflicts. Only
 * fills places with NO tags yet unless --overwrite is passed, so it never
 * clobbers a human's corrections.
 */

const CODE: Record<string, string> = {
  C: 'city', T: 'town-countryside', I: 'island', B: 'beach-coast', M: 'mountains',
  D: 'desert', J: 'jungle-forest', S: 'savanna-wetlands', P: 'polar-ice',
};

const DRAFT: Record<string, string> = {
  'acadia': 'B M J', 'algarve': 'B T', 'amalfi': 'B T M', 'amsterdam': 'C', 'andalucia': 'T C B',
  'angkor': 'T J', 'antarctica': 'P', 'arches-canyonlands': 'D', 'argentine-lake-district': 'M T',
  'aruba': 'I B D', 'aspen': 'M T', 'atacama': 'D', 'athens': 'C', 'azores': 'I M',
  'badlands-black-hills': 'S M', 'bagan': 'T D', 'bahamas': 'I B', 'bali': 'I B J', 'banff': 'M',
  'bangkok': 'C', 'barbados': 'I B', 'barcelona': 'C B', 'basque-country': 'T B', 'bavaria-munich': 'C M T',
  'beijing': 'C', 'belfast-giants-causeway': 'C B', 'belize': 'J B I', 'bend-crater-lake': 'M J',
  'berlin': 'C', 'bhutan': 'M T', 'big-island': 'I M B', 'black-forest': 'J T', 'borabora': 'I B',
  'bordeaux': 'T C', 'borneo': 'J I', 'botswana': 'S', 'budapest': 'C', 'buenosaires': 'C',
  'canaries': 'I B M', 'cape-cod-islands': 'B I T', 'cape-town': 'C B M', 'chamonix': 'M T',
  'champagne': 'T', 'charleston-savannah': 'C T', 'chiang-mai': 'C M J', 'chiapas': 'J T M',
  'chicago': 'C', 'chilean-lake-district': 'M J T', 'churchill': 'P', 'colombian-andes': 'M T',
  'colombian-caribbean': 'B C', 'copenhagen': 'C', 'cornwall': 'B T', 'costa-rica': 'J B M',
  'cotswolds': 'T', 'croatia': 'B I T', 'death-valley': 'D', 'denali-interior': 'M P',
  'dolomites': 'M T', 'douro-valley-porto': 'T C', 'dubai': 'C D B', 'ecuadorian-andes': 'M T',
  'edinburgh': 'C', 'egypt': 'D C B', 'el-chalten': 'M', 'ethiopia': 'M T', 'everglades': 'S',
  'falklands': 'I B', 'faroe-islands': 'I M B', 'fiji': 'I B', 'fjords': 'M B', 'galapagos': 'I B',
  'gbr': 'B I', 'ghana': 'B T', 'glacier-waterton': 'M P', 'grandcanyon': 'D', 'great-smoky-mountains': 'J M',
  'greenland': 'P I', 'guatemala': 'T M J', 'guilin-yangshuo': 'M T', 'havana': 'C', 'hokkaido': 'M B',
  'hongkong': 'C M', 'hudson-valley': 'T M', 'iceland': 'I M P', 'ireland': 'T B I', 'istanbul': 'C',
  'jamaica': 'I B J', 'jordan': 'D', 'joshua-tree': 'D', 'kaziranga': 'S J', 'kenya': 'S', 'kerala': 'B J',
  'komodo': 'I B', 'kruger': 'S', 'kyrgyzstan': 'M', 'ladakh': 'M D', 'lake-district': 'M T', 'lapland': 'P J',
  'lisbon': 'C B', 'lofoten': 'I M B', 'london': 'C', 'los-cabos': 'B D', 'luangprabang': 'T J M',
  'madagascar': 'I J B', 'madeira': 'I M B', 'maldives': 'I B', 'mallorca': 'I B M',
  'marlborough-abel-tasman': 'B T', 'maui': 'I B M', 'mauritius': 'I B', 'mendoza': 'T M', 'mexicocity': 'C',
  'milford-sound-fiordland': 'M J', 'mongolia': 'S D', 'monterey-big-sur': 'B T', 'morocco': 'C D M',
  'namibia': 'D S B', 'napa': 'T', 'nepal': 'M', 'new-orleans': 'C', 'nicaragua': 'B J', 'nice-riviera': 'B C',
  'north-cascades': 'M J', 'north-island': 'B M', 'nova-scotia': 'B T', 'nyc': 'C', 'oaxaca': 'T C',
  'okinawa': 'I B', 'olympic': 'J M B', 'pakistan': 'M', 'palau': 'I B', 'palawan': 'I B J', 'panama': 'J B',
  'pantanal': 'S J', 'papua-new-guinea': 'J I M', 'paris': 'C', 'peru': 'M T', 'peruvian-amazon': 'J',
  'piedmont': 'T M', 'prague': 'C', 'provence': 'T', 'puerto-rico': 'I B J', 'puglia': 'T B',
  'punta-cana': 'B I', 'quebec-city': 'C', 'queenstown': 'M T', 'rajaampat': 'I B J',
  'rajasthan-golden-triangle': 'C D', 'redwood': 'J B', 'rio': 'C B M', 'rioja': 'T', 'rivieramaya': 'B J',
  'rocky-mountain': 'M', 'rome': 'C', 'rwanda': 'J M', 'san-miguel-guanajuato': 'T C', 'santorini': 'I B T',
  'sardinia': 'I B', 'scottish-highlands-skye': 'M I', 'sedona': 'D T', 'seoul': 'C', 'sequoia-kings-canyon': 'M J',
  'seychelles': 'I B', 'sicily': 'I B M', 'singapore': 'C', 'snowdonia': 'M', 'southeast-alaska': 'B J P',
  'srilanka': 'I B J', 'st-andrews-fife': 'T B', 'svalbard': 'P I', 'swissalps': 'M T', 'sydney': 'C B',
  'taiwan': 'I M C', 'tanzania': 'S I B', 'tasmania': 'I J M', 'tbilisi-caucasus': 'C M', 'texas-hill-country': 'T',
  'thailand': 'I B', 'tierra-del-fuego': 'M I', 'tokyo-kyoto': 'C T', 'torres-del-paine': 'M', 'turks-caicos': 'I B',
  'tuscany': 'T', 'uganda': 'J S', 'uluru': 'D', 'upper-peninsula': 'J B', 'uyuni': 'D M', 'uzbekistan': 'C D',
  'vancouver-island': 'I J B', 'venice': 'C', 'vermont': 'T M', 'vienna': 'C', 'vietnam': 'B C M', 'whistler': 'M T',
  'yellowstone': 'M J', 'yosemite': 'M J', 'zambia': 'S', 'zimbabwe': 'S', 'zion-bryce': 'D',
};

function loadDotEnvLocal(): void {
  let raw: string;
  try {
    raw = readFileSync(join(__dirname, '..', '.env.local'), 'utf8');
  } catch {
    return;
  }
  for (const line of raw.split('\n')) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const eq = trimmed.indexOf('=');
    if (eq === -1) continue;
    const key = trimmed.slice(0, eq).trim();
    let value = trimmed.slice(eq + 1).trim();
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) value = value.slice(1, -1);
    if (!process.env[key]) process.env[key] = value;
  }
}
loadDotEnvLocal();

async function main() {
  const write = process.argv.includes('--write');
  const overwrite = process.argv.includes('--overwrite');
  if (!process.env.DATABASE_URL) {
    console.error('No DATABASE_URL found in .env.local — refusing to run against the PGlite fallback.');
    process.exit(1);
  }
  const { db } = await import('../src/lib/db/client');
  const { places } = await import('../src/lib/db/schema');
  const { SETTING_TAG_SLUGS, MAX_SETTING_TAGS } = await import('../src/lib/places/setting-tags');
  const { eq } = await import('drizzle-orm');

  const rows = await db.select({ id: places.id, tags: places.settingTags, primary: places.isPrimaryDestination }).from(places);
  const primaryIds = new Set(rows.filter((r) => r.primary).map((r) => r.id));
  const problems: string[] = [];

  const draft = new Map<string, string[]>();
  for (const [id, codes] of Object.entries(DRAFT)) {
    const tags = codes.split(' ').map((c) => CODE[c]);
    if (tags.some((t) => !t || !(SETTING_TAG_SLUGS as readonly string[]).includes(t))) problems.push(`${id}: unknown code in "${codes}"`);
    if (new Set(tags).size !== tags.length || tags.length < 1 || tags.length > MAX_SETTING_TAGS) problems.push(`${id}: needs 1–${MAX_SETTING_TAGS} unique tags`);
    if (!primaryIds.has(id)) problems.push(`${id}: not a primary place in the database`);
    draft.set(id, tags);
  }
  for (const id of primaryIds) if (!draft.has(id)) problems.push(`${id}: primary place with no draft tags`);
  if (problems.length) { console.error('Problems:\n' + problems.join('\n')); process.exit(1); }

  const counts: Record<string, number> = {}, primaryCounts: Record<string, number> = {};
  let toWrite = 0, skipped = 0;
  for (const r of rows) {
    const tags = draft.get(r.id);
    if (!tags) continue;
    tags.forEach((t) => (counts[t] = (counts[t] ?? 0) + 1));
    primaryCounts[tags[0]] = (primaryCounts[tags[0]] ?? 0) + 1;
    if (r.tags.length > 0 && !overwrite) { skipped++; continue; }
    toWrite++;
    if (write) await db.update(places).set({ settingTags: tags }).where(eq(places.id, r.id));
  }
  console.log(`${write ? 'WROTE' : 'DRY RUN'}: ${toWrite} places tagged, ${skipped} skipped (already have tags). ${draft.size} places in draft.`);
  console.log('Places per tag (any position | as primary):');
  for (const s of SETTING_TAG_SLUGS) console.log(`  ${s.padEnd(18)} ${String(counts[s] ?? 0).padStart(3)} | ${String(primaryCounts[s] ?? 0).padStart(3)}`);
  process.exit(0);
}

main();
