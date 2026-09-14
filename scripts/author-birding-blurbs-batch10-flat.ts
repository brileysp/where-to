import { readFileSync } from 'fs';
import { join } from 'path';
import { eq } from 'drizzle-orm';
import { drizzle as drizzlePostgres } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import { places, adminAuditLog } from '../src/lib/db/schema';

/**
 * Tenth batch — the flat (single-value-all-year) long tail, plus
 * Istanbul (just given a real event above, now has genuine segments).
 * These are honest, brief entries for destinations where birding really
 * is incidental — most get a short, accurate baseline description; a
 * handful have a genuine specific fact worth naming (NYC's Central Park
 * and Chicago's Montrose Point as real migration stopovers, Buenos
 * Aires' Reserva Ecológica, Hudson Valley's wintering bald eagles,
 * Cornwall's reintroduced choughs, Belfast/Giant's Causeway's seabird
 * cliffs) even though none of these rise to a dedicated birding circuit.
 */

const KEY = 'birding';

const FLAT_TEXT: Record<string, string> = {
  'bend-crater-lake': 'Common raptors and waterfowl around the high desert lakes; nothing tied to a specific spectacle.',
  buenosaires: 'The Reserva Ecológica wetland reserve near the city center holds a genuine range of wetland species — an unusual amount of habitat this close to a major capital.',
  beijing: 'Common park and urban species; nothing tied to a specific seasonal spectacle.',
  'rocky-mountain': 'Alpine species including ptarmigan are possible above the treeline, alongside common forest birds lower down.',
  dolomites: 'Alpine specialists are present in the high pastures and forest, similar to other high-Alpine ranges.',
  'black-forest': 'Common Central European forest species; nothing tied to a specific seasonal spectacle.',
  'charleston-savannah': 'Lowcountry wading birds work the tidal marshes, a smaller-scale version of the wetland birding found further south in Florida.',
  fjords: 'White-tailed eagles and common seabirds work the fjord waters, on a smaller scale than the dedicated colonies further north.',
  pakistan: 'High-altitude Himalayan specialists are present in the northern regions, though nothing here rises to a specific dedicated circuit.',
  ireland: 'Irish countryside species are present, with real but modest seabird interest along the coast.',
  snowdonia: 'Moorland and mountain species are present in the Welsh hills, on a smaller scale than the Scottish Highlands.',
  sedona: 'Common desert and raptor species around the red rock formations; nothing tied to a specific spectacle.',
  'north-cascades': 'Common Pacific Northwest forest species; nothing tied to a specific seasonal spectacle.',
  'lake-district': 'Common English countryside and fell species; nothing tied to a specific seasonal spectacle.',
  swissalps: 'Alpine specialists are present in the high pastures, similar to other high-Alpine ranges.',
  'sequoia-kings-canyon': 'Common Sierra Nevada forest species; nothing tied to a specific seasonal spectacle.',
  aspen: 'Common Rocky Mountain forest and alpine species; nothing tied to a specific seasonal spectacle.',
  vermont: 'Common New England forest species; nothing tied to a specific seasonal spectacle.',
  cornwall: 'Reintroduced choughs and common seabirds work the coastal cliffs, on a smaller scale than the major Scottish and Faroese colonies.',
  'tbilisi-caucasus': 'Caucasus mountain specialists are present in the region, though nothing here rises to the scale of the dedicated migration watchpoints elsewhere in the range.',
  nyc: 'Central Park is a surprisingly significant migration stopover for songbirds moving through a city with almost no other green space, drawing dedicated birders each spring and fall.',
  'cape-cod-islands': 'Common New England shorebirds and coastal species work the beaches and marshes; nothing tied to a specific seasonal spectacle beyond the general coastal presence.',
  'hudson-valley': 'Bald eagles winter along the Hudson River, a real if modest seasonal draw alongside common countryside species.',
  rioja: 'Common Iberian countryside species in the vineyard landscape; nothing tied to a specific seasonal spectacle.',
  whistler: 'Common alpine and forest species in the Coast Mountains; nothing tied to a specific seasonal spectacle.',
  chicago: 'Montrose Point, a small lakefront park, is a genuinely famous urban migration stopover for songbirds moving along the Great Lakes shoreline each spring and fall.',
  chamonix: 'Alpine specialists are present in the high pastures, similar to other high-Alpine ranges.',
  'quebec-city': 'Common eastern Canadian forest and river species; nothing tied to a specific seasonal spectacle.',
  budapest: 'Common urban and Danube river species; nothing tied to a specific seasonal spectacle.',
  'bavaria-munich': 'Common Central European countryside species; nothing tied to a specific seasonal spectacle.',
  'belfast-giants-causeway': 'Seabird cliffs along the Causeway Coast hold nesting colonies in season, on a smaller scale than the major Scottish and Faroese sites.',
  cotswolds: 'Common English countryside species; nothing tied to a specific seasonal spectacle.',
  aruba: 'Common arid-adapted Caribbean species; nothing tied to a specific seasonal spectacle.',
  'douro-valley-porto': 'Common Iberian countryside species in the terraced vineyard landscape; nothing tied to a specific seasonal spectacle.',
  'los-cabos': 'Common desert and coastal species at the tip of the Baja peninsula; nothing tied to a specific seasonal spectacle.',
  berlin: 'Common urban and park species; nothing tied to a specific seasonal spectacle.',
  piedmont: 'Common Italian countryside species in the vineyard landscape; nothing tied to a specific seasonal spectacle.',
  vienna: 'Common urban and Danube river species; nothing tied to a specific seasonal spectacle.',
  'joshua-tree': 'Common desert and raptor species among the Joshua trees; nothing tied to a specific seasonal spectacle.',
  champagne: 'Common French countryside species in the vineyard landscape; nothing tied to a specific seasonal spectacle.',
  'death-valley': 'Minimal desert birdlife given the extreme conditions; nothing tied to a specific seasonal spectacle.',
  copenhagen: 'Common urban and coastal species; nothing tied to a specific seasonal spectacle.',
  prague: 'Common urban and river species; nothing tied to a specific seasonal spectacle.',
};

const ISTANBUL_OVERVIEW = 'The Bosphorus is one of the world\'s great raptor and white stork migration bottlenecks — hundreds of thousands pass directly over the city each autumn.';
const ISTANBUL_MONTHLY = [
  'Outside the autumn migration window, birding settles to a common urban baseline.', // Jan
  'Outside the autumn migration window, birding settles to a common urban baseline.', // Feb
  'Outside the autumn migration window, birding settles to a common urban baseline.', // Mar
  'Outside the autumn migration window, birding settles to a common urban baseline.', // Apr
  'Outside the autumn migration window, birding settles to a common urban baseline.', // May
  'Outside the autumn migration window, birding settles to a common urban baseline.', // Jun
  'Outside the autumn migration window, birding settles to a common urban baseline.', // Jul
  'The Bosphorus migration is beginning to build.', // Aug
  'Peak Bosphorus migration — hundreds of thousands of white storks and raptors pass over the city on their way south.', // Sep
  'Migration numbers are easing as the main push has passed.', // Oct
  'Outside the autumn migration window, birding settles to a common urban baseline.', // Nov
  'Outside the autumn migration window, birding settles to a common urban baseline.', // Dec
];

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

  async function writeBlurb(id: string, overview: string, monthly: string[]) {
    const [row] = await db.select().from(places).where(eq(places.id, id));
    if (!row) { console.error(`${id}: not found`); process.exit(1); }
    if (monthly.length !== 12) { console.error(`${id}: monthly array is not length 12`); process.exit(1); }
    const patch: Record<string, unknown> = {
      sliderOverview: { ...(row.sliderOverview as Record<string, string>), [KEY]: overview },
      sliderMonthlyWeather: { ...(row.sliderMonthlyWeather as Record<string, (string | null)[]>), [KEY]: monthly },
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

  for (const [id, text] of Object.entries(FLAT_TEXT)) {
    await writeBlurb(id, text, Array(12).fill(text));
  }
  await writeBlurb('istanbul', ISTANBUL_OVERVIEW, ISTANBUL_MONTHLY);

  console.log(dryRun ? '\ndry run — nothing written.' : '\ndone.');
  process.exit(0);
}

main().catch((err) => { console.error(err); process.exit(1); });
