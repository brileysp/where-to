import { readFileSync } from 'fs';
import { join } from 'path';
import { eq } from 'drizzle-orm';
import { drizzle as drizzlePostgres } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import { places, adminAuditLog } from '../src/lib/db/schema';

/**
 * Second batch of the birding content-authoring project — the African
 * savanna & Rift Valley group (Kenya, Tanzania, Uganda, Zambia, Zimbabwe,
 * Rwanda, Botswana, Namibia), following the score corrections applied in
 * fix-african-savanna-birding.ts and the comprehensive model-based pass
 * in apply-birding-model-targets.ts. Same habitat-level, no-tour-
 * logistics, no-audience-judgment lens established on the first sample
 * batch (Guilin, Grand Canyon, Belize, Cusco).
 */

const KEY = 'birding';

const OVERVIEWS: Record<string, string> = {
  kenya: 'Rift Valley lake flamingos, raptor density across the Mara plains, and elephant-backed views at Amboseli. Palearctic migrants — European storks, warblers, waders — arrive in large numbers alongside the resident species.',
  tanzania: "Serengeti plains alongside Zanzibar's coastal mangroves and reef islets — two different bird communities in one destination. Palearctic migrants arrive in large numbers on the mainland alongside resident raptors and Rift Valley specialties.",
  uganda: "Forest, savanna, and wetland habitats combine to hold the Albertine Rift's endemic-rich birdlife — species found almost nowhere else on Earth. Bwindi and Rwenzori forest interiors hold the deepest concentration.",
  zambia: "South Luangwa's riverbank cliffs host one of Africa's great carmine bee-eater breeding colonies. Dry-season water levels concentrate wading birds and raptors along the river as well.",
  zimbabwe: "Carmine bee-eater colonies along the Zambezi, the same river shared with Zambia's side, plus dry-season waterhole concentrations of raptors and waterbirds at Hwange.",
  rwanda: "Nyungwe Forest holds a concentrated slice of the Albertine Rift's endemic-rich birdlife — species found almost nowhere else on Earth.",
  botswana: "The Okavango Delta's flood pulse arrives months after the local rains, flooding the channels during the dry season. Storks, herons, and African skimmers concentrate along the expanding waterways during that window.",
  namibia: 'Desert specialists — Damara tern, dune lark — alongside Etosha Pan\'s dry-season waterhole concentrations of raptors and waterbirds against a backdrop of shrinking surface water elsewhere.',
};

const MONTHLY: Record<string, string[]> = {
  kenya: [
    'Peak Palearctic migrant season — European storks, warblers, and waders join the resident population in the largest numbers of the year.', // Jan
    'Peak Palearctic migrant season — European storks, warblers, and waders join the resident population in the largest numbers of the year.', // Feb
    'Migrant numbers begin thinning as birds start their return journey north.', // Mar
    'Long rains reduce visibility across the plains; migrants have largely departed.', // Apr
    'Long rains reduce visibility across the plains; migrants have largely departed.', // May
    'Dry-season baseline — resident species only, without the migrant influx.', // Jun
    'Dry-season baseline — resident species only, without the migrant influx.', // Jul
    'Dry-season baseline — resident species only, without the migrant influx.', // Aug
    'Dry-season baseline — resident species only, without the migrant influx.', // Sep
    'Dry-season baseline — resident species only, without the migrant influx.', // Oct
    'Migrants begin arriving from the north.', // Nov
    'Migrant arrivals build toward the January-February peak.', // Dec
  ],
  tanzania: [
    'Peak Palearctic migrant season on the mainland plains, alongside year-round coastal and mangrove species around Zanzibar.', // Jan
    'Peak Palearctic migrant season on the mainland plains, alongside year-round coastal and mangrove species around Zanzibar.', // Feb
    'Migrant numbers remain high, easing only slightly.', // Mar
    'Migrant numbers continue easing as birds begin the return journey north.', // Apr
    'Long rains reduce visibility across the plains; migrants have largely departed.', // May
    "Dry-season baseline on the mainland — resident species only, with Zanzibar's coastal birds unaffected by the mainland's seasonal swing.", // Jun
    "Dry-season baseline on the mainland — resident species only, with Zanzibar's coastal birds unaffected by the mainland's seasonal swing.", // Jul
    "Dry-season baseline on the mainland — resident species only, with Zanzibar's coastal birds unaffected by the mainland's seasonal swing.", // Aug
    "Dry-season baseline on the mainland — resident species only, with Zanzibar's coastal birds unaffected by the mainland's seasonal swing.", // Sep
    "Dry-season baseline on the mainland — resident species only, with Zanzibar's coastal birds unaffected by the mainland's seasonal swing.", // Oct
    'Migrants begin arriving from the north.', // Nov
    'Migrant arrivals build toward the January-February peak.', // Dec
  ],
  uganda: [
    "Dry-season trail access into the Albertine Rift's forest interiors, where the endemic-rich birdlife concentrates.", // Jan
    "Dry-season trail access into the Albertine Rift's forest interiors, where the endemic-rich birdlife concentrates.", // Feb
    'Wetter conditions make forest trails harder going, though the same endemic species remain present.', // Mar
    'Wetter conditions make forest trails harder going, though the same endemic species remain present.', // Apr
    'Wetter conditions make forest trails harder going, though the same endemic species remain present.', // May
    "Dry-season trail access into the Albertine Rift's forest interiors, where the endemic-rich birdlife concentrates.", // Jun
    "Dry-season trail access into the Albertine Rift's forest interiors, where the endemic-rich birdlife concentrates.", // Jul
    "Dry-season trail access into the Albertine Rift's forest interiors, where the endemic-rich birdlife concentrates.", // Aug
    'Wetter conditions make forest trails harder going, though the same endemic species remain present.', // Sep
    'Wetter conditions make forest trails harder going, though the same endemic species remain present.', // Oct
    'Wetter conditions make forest trails harder going, though the same endemic species remain present.', // Nov
    "Dry-season trail access into the Albertine Rift's forest interiors, where the endemic-rich birdlife concentrates.", // Dec
  ],
  zambia: [
    'Wet season; high water disperses wading birds and raptors along the river.', // Jan
    'Wet season; high water disperses wading birds and raptors along the river.', // Feb
    'Wet season; high water disperses wading birds and raptors along the river.', // Mar
    'Baseline conditions as water levels begin dropping.', // Apr
    'Baseline conditions as water levels begin dropping.', // May
    'Baseline conditions as water levels begin dropping.', // Jun
    'Baseline conditions as water levels begin dropping.', // Jul
    'Falling water levels expose the riverbank cliffs where carmine bee-eaters nest in dense colonies.', // Aug
    'Falling water levels expose the riverbank cliffs where carmine bee-eaters nest in dense colonies.', // Sep
    'Falling water levels expose the riverbank cliffs where carmine bee-eaters nest in dense colonies.', // Oct
    'Baseline conditions as the colonies begin dispersing for the season.', // Nov
    'Rains return, and the colonies disperse for the season.', // Dec
  ],
  zimbabwe: [
    "Wet season; water levels are high along the Zambezi and at Hwange's waterholes.", // Jan
    "Wet season; water levels are high along the Zambezi and at Hwange's waterholes.", // Feb
    "Wet season; water levels are high along the Zambezi and at Hwange's waterholes.", // Mar
    'Baseline conditions as the dry season sets in.', // Apr
    'Baseline conditions as the dry season sets in.', // May
    'Baseline conditions as the dry season sets in.', // Jun
    'Baseline conditions as the dry season sets in.', // Jul
    "Carmine bee-eater colonies nest in the exposed Zambezi riverbanks, while shrinking waterholes concentrate wildlife and birds at Hwange.", // Aug
    "Carmine bee-eater colonies nest in the exposed Zambezi riverbanks, while shrinking waterholes concentrate wildlife and birds at Hwange.", // Sep
    "Carmine bee-eater colonies nest in the exposed Zambezi riverbanks, while shrinking waterholes concentrate wildlife and birds at Hwange.", // Oct
    'Baseline conditions as the colonies and waterhole concentrations begin dispersing.', // Nov
    'Rains return, dispersing both the colonies and the waterhole concentrations.', // Dec
  ],
  rwanda: [
    "Dry-season trail access into Nyungwe Forest, where the Albertine Rift's endemic-rich birdlife concentrates.", // Jan
    "Dry-season trail access into Nyungwe Forest, where the Albertine Rift's endemic-rich birdlife concentrates.", // Feb
    'Wetter conditions make forest trails harder going, though the same endemic species remain present.', // Mar
    'Wetter conditions make forest trails harder going, though the same endemic species remain present.', // Apr
    'Wetter conditions make forest trails harder going, though the same endemic species remain present.', // May
    "Dry-season trail access into Nyungwe Forest, where the Albertine Rift's endemic-rich birdlife concentrates.", // Jun
    "Dry-season trail access into Nyungwe Forest, where the Albertine Rift's endemic-rich birdlife concentrates.", // Jul
    "Dry-season trail access into Nyungwe Forest, where the Albertine Rift's endemic-rich birdlife concentrates.", // Aug
    "Dry-season trail access into Nyungwe Forest, where the Albertine Rift's endemic-rich birdlife concentrates.", // Sep
    'Wetter conditions make forest trails harder going, though the same endemic species remain present.', // Oct
    'Wetter conditions make forest trails harder going, though the same endemic species remain present.', // Nov
    "Dry-season trail access into Nyungwe Forest, where the Albertine Rift's endemic-rich birdlife concentrates.", // Dec
  ],
  botswana: [
    "Local rains bring their own wet season, before the Delta's own flood has arrived from further north.", // Jan
    "Local rains bring their own wet season, before the Delta's own flood has arrived from further north.", // Feb
    "Local rains bring their own wet season, before the Delta's own flood has arrived from further north.", // Mar
    "Local rains bring their own wet season, before the Delta's own flood has arrived from further north.", // Apr
    'A transitional month as the flood pulse begins arriving.', // May
    'The flood pulse — arriving from Angolan headwater rains months earlier — floods the channels, concentrating storks, herons, and African skimmers along the expanding waterways.', // Jun
    'The flood pulse — arriving from Angolan headwater rains months earlier — floods the channels, concentrating storks, herons, and African skimmers along the expanding waterways.', // Jul
    'The flood pulse — arriving from Angolan headwater rains months earlier — floods the channels, concentrating storks, herons, and African skimmers along the expanding waterways.', // Aug
    'The flood pulse — arriving from Angolan headwater rains months earlier — floods the channels, concentrating storks, herons, and African skimmers along the expanding waterways.', // Sep
    'A transitional month as the flood recedes.', // Oct
    "Local rains bring their own wet season, before the Delta's own flood has arrived from further north.", // Nov
    "Local rains bring their own wet season, before the Delta's own flood has arrived from further north.", // Dec
  ],
  namibia: [
    "The wetter season; desert specialists remain but waterhole concentrations haven't yet formed.", // Jan
    "The wetter season; desert specialists remain but waterhole concentrations haven't yet formed.", // Feb
    "The wetter season; desert specialists remain but waterhole concentrations haven't yet formed.", // Mar
    'A transitional month as the dry season sets in.', // Apr
    "Etosha Pan's dry season concentrates raptors and waterbirds at its shrinking waterholes, against a backdrop of desert specialists like the Damara tern and dune lark elsewhere in the country.", // May
    "Etosha Pan's dry season concentrates raptors and waterbirds at its shrinking waterholes, against a backdrop of desert specialists like the Damara tern and dune lark elsewhere in the country.", // Jun
    "Etosha Pan's dry season concentrates raptors and waterbirds at its shrinking waterholes, against a backdrop of desert specialists like the Damara tern and dune lark elsewhere in the country.", // Jul
    "Etosha Pan's dry season concentrates raptors and waterbirds at its shrinking waterholes, against a backdrop of desert specialists like the Damara tern and dune lark elsewhere in the country.", // Aug
    "Etosha Pan's dry season concentrates raptors and waterbirds at its shrinking waterholes, against a backdrop of desert specialists like the Damara tern and dune lark elsewhere in the country.", // Sep
    "Etosha Pan's dry season concentrates raptors and waterbirds at its shrinking waterholes, against a backdrop of desert specialists like the Damara tern and dune lark elsewhere in the country.", // Oct
    'A transitional month as the rains return.', // Nov
    "The wetter season; desert specialists remain but waterhole concentrations haven't yet formed.", // Dec
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
  if (!env.DATABASE_URL) {
    console.error('No DATABASE_URL in .env.local — refusing to run against the PGlite fallback.');
    process.exit(1);
  }
  const dryRun = process.argv.includes('--dry-run');
  const db = drizzlePostgres(postgres(env.DATABASE_URL, { prepare: false }));

  for (const id of Object.keys(OVERVIEWS)) {
    const [row] = await db.select().from(places).where(eq(places.id, id));
    if (MONTHLY[id].length !== 12) { console.error(`${id}: monthly array is not length 12 (${MONTHLY[id].length})`); process.exit(1); }
    const patch: Record<string, unknown> = {
      sliderOverview: { ...(row.sliderOverview as Record<string, string>), [KEY]: OVERVIEWS[id] },
      sliderMonthlyWeather: { ...(row.sliderMonthlyWeather as Record<string, (string | null)[]>), [KEY]: MONTHLY[id] },
    };
    console.log(`  ${id}: writing overview (${OVERVIEWS[id].length} chars) + 12 monthly entries`);
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
