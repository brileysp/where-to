import { readFileSync } from 'fs';
import { join } from 'path';
import { eq } from 'drizzle-orm';
import { drizzle as drizzlePostgres } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import { places, adminAuditLog } from '../src/lib/db/schema';

/**
 * Twelfth batch — flat national-park / wilderness destinations. Real,
 * specific facts where they exist (Great Smoky Mountains' warbler
 * diversity, Yellowstone's wintering trumpeter swans, Zion's
 * reintroduced condors, Torres del Paine's Andean condors, Monterey
 * Bay's pelagic seabirding, Southeast Alaska's bald eagle density);
 * honest generic habitat text for the rest, matching the flat-batch
 * discipline established in batch10.
 */

const KEY = 'birding';

const FLAT_TEXT: Record<string, string> = {
  olympic: 'Old-growth temperate rainforest, coastline, and alpine zones support a real range of habitat specialists, though nothing here rises to a dedicated circuit.',
  redwood: 'Marbled murrelets nest deep in the old-growth redwood canopy, a genuine if hard-to-observe specialist, alongside common Pacific coastal species.',
  'great-smoky-mountains': 'One of the most bird-diverse national parks in the eastern US, with a dense concentration of breeding wood-warblers in its Appalachian cove forests.',
  acadia: 'Coastal spruce-fir forest and rocky shoreline support common Northeastern warblers and seabirds; nothing tied to a specific seasonal spectacle.',
  banff: 'Alpine and boreal forest species are present in the Canadian Rockies, similar to other high-alpine ranges.',
  yosemite: 'Common Sierra Nevada forest species; nothing tied to a specific seasonal spectacle.',
  'denali-interior': 'Boreal forest and tundra specialists, including ptarmigan and nesting raptors, are present during the short summer season.',
  'glacier-waterton': 'Alpine and boreal forest species are present, similar to other high-alpine Rocky Mountain ranges.',
  yellowstone: 'Trumpeter swans winter on the park\'s ice-free geothermal waters, alongside ospreys and bald eagles along its rivers.',
  'arches-canyonlands': 'Common desert and canyon raptor species, including cliff-nesting peregrine falcons; nothing tied to a specific seasonal spectacle.',
  'zion-bryce': 'Common desert and canyon species, including California condors reintroduced to the region; nothing tied to a specific seasonal spectacle.',
  'badlands-black-hills': 'Grassland and prairie species, including raptors hunting over the open badlands terrain; nothing tied to a specific seasonal spectacle.',
  'upper-peninsula': 'Great Lakes shoreline and boreal forest species; nothing tied to a specific seasonal spectacle.',
  'southeast-alaska': 'Bald eagles are unusually dense along the Inside Passage\'s coastline and river mouths, alongside common coastal and forest species.',
  'torres-del-paine': 'Andean condors are a real highlight over the granite peaks, alongside Patagonian steppe species.',
  'tierra-del-fuego': 'Sub-Antarctic forest and coastal species, including the Magellanic woodpecker, are present; nothing tied to a specific seasonal spectacle.',
  'el-chalten': 'Andean condors and Patagonian steppe species are present in the mountains around Fitz Roy; nothing tied to a specific seasonal spectacle.',
  'argentine-lake-district': 'Andean-Patagonian forest and lake species are present; nothing tied to a specific seasonal spectacle.',
  'chilean-lake-district': 'Andean-Patagonian forest and lake species are present, similar to the Argentine side of the range.',
  uluru: 'Common arid-adapted Australian species, including honeyeaters and raptors; nothing tied to a specific seasonal spectacle.',
  antarctica: 'Penguin colonies and seabird spectacles are visually enormous, though total species diversity is limited compared to birding destinations elsewhere.',
  'nova-scotia': 'Atlantic Canada coastal and forest species; nothing tied to a specific seasonal spectacle.',
  'vancouver-island': 'Bald eagles and coastal Pacific Northwest species are present; nothing tied to a specific seasonal spectacle.',
  'monterey-big-sur': 'Monterey Bay is one of the most productive pelagic seabirding areas in the world, with deep offshore canyons bringing albatrosses and shearwaters close to shore.',
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
  if (!env.DATABASE_URL) {
    console.error('No DATABASE_URL in .env.local — refusing to run against the PGlite fallback.');
    process.exit(1);
  }
  const dryRun = process.argv.includes('--dry-run');
  const db = drizzlePostgres(postgres(env.DATABASE_URL, { prepare: false }));

  for (const [id, text] of Object.entries(FLAT_TEXT)) {
    const [row] = await db.select().from(places).where(eq(places.id, id));
    if (!row) { console.error(`${id}: not found`); process.exit(1); }
    const patch: Record<string, unknown> = {
      sliderOverview: { ...(row.sliderOverview as Record<string, string>), [KEY]: text },
      sliderMonthlyWeather: { ...(row.sliderMonthlyWeather as Record<string, (string | null)[]>), [KEY]: Array(12).fill(text) },
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
