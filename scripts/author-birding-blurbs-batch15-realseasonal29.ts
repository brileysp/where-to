import { readFileSync } from 'fs';
import { join } from 'path';
import { eq } from 'drizzle-orm';
import { drizzle as drizzlePostgres } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import { places, adminAuditLog } from '../src/lib/db/schema';

/**
 * Fifteenth batch — 29 destinations that my earlier flat/seasonal
 * survey mis-classified as flat. The survey checked row.birdingPeak
 * and row.sliderEvents, but the real schema fields are
 * birdingPeakMonths/wetMonths/dryMonths — these destinations all carry
 * genuine month-fact flags driving real curve variation via the
 * generic fallback formula (the same +3 peak / -1 wet mechanism fixed
 * catalog-wide earlier this session). Text below matches each
 * destination's actual birdingPeakMonths/wetMonths windows, with real
 * specific facts layered in where known (Borneo's hornbills, Cape
 * Town's penguins + fynbos sugarbirds, Mauritius's/Seychelles'
 * conservation-success endemics, Puerto Rico's parrot, Bali myna,
 * Vietnam's Da Lat/Annamite endemics, Colombian Caribbean's Sierra
 * Nevada de Santa Marta, Chiapas's quetzal, Ghana's picathartes).
 */

const KEY = 'birding';

type Entry = { overview: string; peak: string; wet: string; base: string; peakMonths: number[]; wetMonths: number[] };

const ENTRIES: Record<string, Entry> = {
  'north-island': {
    overview: 'Forest specialists like tui and bellbird are most vocal during the spring breeding season, alongside the nocturnal, rarely-seen kiwi present year-round.',
    peak: 'Spring breeding season — tui and bellbird are at their most vocal and active.',
    wet: 'Winter conditions bring quieter forest birding.',
    base: 'Outside the spring breeding season, forest birding settles to a common baseline.',
    peakMonths: [10, 11, 12], wetMonths: [6, 7, 8],
  },
  uyuni: {
    overview: 'High-altitude lagoons near the salt flat hold three flamingo species — Andean, Chilean, and James\'s — best accessed during the dry season when roads across the Altiplano are passable.',
    peak: 'Dry-season roads give the best access to the high-altitude flamingo lagoons.',
    wet: 'Rains complicate road access across the Altiplano.',
    base: 'Conditions are transitioning between the wet and dry seasons.',
    peakMonths: [5, 6, 7, 8, 9], wetMonths: [1, 2, 3, 12],
  },
  egypt: {
    overview: 'The Nile Valley hosts large numbers of wintering waterfowl and raptors moving along the African-Eurasian flyway each northern winter.',
    peak: 'Wintering waterfowl and raptors are present along the Nile in strong numbers.',
    wet: 'Outside the wintering season, birding settles to a common baseline.',
    base: 'Outside the wintering season, birding settles to a common baseline.',
    peakMonths: [1, 2, 3, 11, 12], wetMonths: [],
  },
  chiapas: {
    overview: 'Cloud forest in the El Triunfo Biosphere Reserve holds a real quetzal population, best accessed during the dry season when trails into the reserve are passable.',
    peak: 'Dry-season trail access into the El Triunfo cloud forest is at its best.',
    wet: 'Rains limit trail access into the cloud forest reserve.',
    base: 'Conditions are transitioning between the wet and dry seasons.',
    peakMonths: [1, 2, 3, 11, 12], wetMonths: [6, 7, 8, 9],
  },
  borneo: {
    overview: 'Eight hornbill species live in the lowland rainforest, among the richest hornbill diversity anywhere; dry-season conditions give the best access to river systems like the Kinabatangan where they concentrate.',
    peak: 'Dry-season conditions give the best river access to hornbill concentrations along waterways like the Kinabatangan.',
    wet: 'Monsoon rains limit river and trail access to the rainforest interior.',
    base: 'Conditions are transitioning between the wet and dry seasons.',
    peakMonths: [3, 4, 5, 6, 7, 8], wetMonths: [1, 2, 11, 12],
  },
  tasmania: {
    overview: 'A dozen bird species are found only in Tasmania, including the forty-spotted pardalote, most active and vocal during the spring breeding season.',
    peak: 'Spring breeding season — Tasmanian endemics including the forty-spotted pardalote are most active.',
    wet: 'Winter conditions bring quieter birding.',
    base: 'Outside the spring breeding season, birding settles to a common baseline.',
    peakMonths: [10, 11, 12], wetMonths: [6, 7, 8],
  },
  maldives: {
    overview: 'Minimal land bird diversity given the atoll geography; common seabirds and shorebirds are present, with drier conditions from December through April.',
    peak: 'Drier conditions bring slightly more comfortable birding.',
    wet: 'Monsoon rains bring wetter, less comfortable conditions.',
    base: 'Conditions are transitioning between the wet and dry seasons.',
    peakMonths: [1, 2, 3, 12], wetMonths: [5, 6, 7, 8, 9, 10, 11],
  },
  kerala: {
    overview: 'Backwater wetlands attract herons and waterfowl, with Western Ghats endemics present in the nearby hill forests; the dry season gives the best access.',
    peak: 'Dry-season conditions give the best access to the backwaters and nearby hill forests.',
    wet: 'Monsoon rains limit access and comfort.',
    base: 'Conditions are transitioning between the wet and dry seasons.',
    peakMonths: [1, 2, 3, 12], wetMonths: [6, 7, 8, 9],
  },
  taiwan: {
    overview: 'Taiwan holds around 30 endemic species present year-round, joined by large numbers of migrants moving through the Taiwan Strait each winter.',
    peak: 'Migrant numbers are at their strongest alongside the resident endemics.',
    wet: 'Wetter conditions bring a quieter birding baseline.',
    base: 'Outside the main migration windows, birding settles to the resident endemic baseline.',
    peakMonths: [1, 2, 3, 10, 11, 12], wetMonths: [5, 6],
  },
  mendoza: {
    overview: 'Andean foothill species, including condors at higher elevations, are present; activity peaks during the spring breeding season.',
    peak: 'Spring breeding season brings the most activity to the Andean foothills.',
    wet: 'Outside the spring peak, birding settles to a common baseline.',
    base: 'Outside the spring peak, birding settles to a common baseline.',
    peakMonths: [10, 11, 12], wetMonths: [],
  },
  fiji: {
    overview: 'A handful of Fijian endemics live in the forest interior; the dry season gives the most comfortable access.',
    peak: 'Dry-season conditions give the most comfortable access to the forest interior.',
    wet: 'Wetter conditions make forest access less comfortable.',
    base: 'Conditions are transitioning between the wet and dry seasons.',
    peakMonths: [5, 6, 7, 8, 9], wetMonths: [1, 2, 3, 12],
  },
  angkor: {
    overview: 'Tonle Sap lake nearby holds one of Southeast Asia\'s most significant waterbird colonies, including large numbers of pelicans and storks, most accessible during the dry season.',
    peak: 'Dry-season conditions give the best access to the Tonle Sap waterbird colonies.',
    wet: 'Monsoon rains limit access to the lake\'s colonies.',
    base: 'Conditions are transitioning between the wet and dry seasons.',
    peakMonths: [1, 2, 3, 12], wetMonths: [6, 7, 8, 9, 10],
  },
  palawan: {
    overview: 'Palawan holds a real concentration of Philippine endemics, including the Palawan peacock-pheasant, found nowhere else; the dry season gives the best forest access.',
    peak: 'Dry-season conditions give the best forest access to the island\'s endemics.',
    wet: 'Monsoon rains limit forest access.',
    base: 'Conditions are transitioning between the wet and dry seasons.',
    peakMonths: [1, 2, 3, 4, 12], wetMonths: [6, 7, 8, 9],
  },
  luangprabang: {
    overview: 'Common Mekong River and forest species are present, with the dry season giving the most comfortable access.',
    peak: 'Dry-season conditions give the most comfortable access.',
    wet: 'Monsoon rains bring less comfortable conditions.',
    base: 'Conditions are transitioning between the wet and dry seasons.',
    peakMonths: [1, 2, 11, 12], wetMonths: [6, 7, 8, 9, 10],
  },
  ghana: {
    overview: 'Kakum National Park\'s rainforest canopy holds real West African forest specialists, including the yellow-headed picathartes, a famously localized and sought-after species, best accessed during the dry season.',
    peak: 'Dry-season trail access into the rainforest canopy is at its best.',
    wet: 'Rains limit trail access into the rainforest.',
    base: 'Conditions are transitioning between the wet and dry seasons.',
    peakMonths: [1, 2, 11, 12], wetMonths: [5, 6, 7, 9, 10],
  },
  barbados: {
    overview: 'Common Caribbean species are present, with the dry season offering the most comfortable conditions.',
    peak: 'Dry-season conditions offer the most comfortable birding.',
    wet: 'Wetter conditions bring a less comfortable baseline.',
    base: 'Conditions are transitioning between the wet and dry seasons.',
    peakMonths: [1, 2, 3, 4, 12], wetMonths: [6, 7, 8, 9, 10, 11],
  },
  mauritius: {
    overview: 'Mauritius is home to several critically rare endemics — the Mauritius kestrel, pink pigeon, and echo parakeet — each brought back from the brink of extinction, most active during the drier months.',
    peak: 'Drier conditions bring the most comfortable viewing of the island\'s rare endemics.',
    wet: 'Wetter conditions bring a less comfortable baseline.',
    base: 'Conditions are transitioning between the wet and dry seasons.',
    peakMonths: [8, 9, 10, 11], wetMonths: [1, 2, 3],
  },
  'cape-town': {
    overview: 'Boulders Beach holds a colony of African penguins, alongside fynbos endemics like the Cape sugarbird, most active during the spring protea bloom.',
    peak: 'The spring protea bloom brings fynbos endemics like the Cape sugarbird to their most active.',
    wet: 'The Cape winter rains bring a quieter baseline.',
    base: 'Outside the spring bloom, birding settles to a common baseline; the penguin colony remains present year-round.',
    peakMonths: [9, 10, 11], wetMonths: [6, 7, 8],
  },
  'colombian-caribbean': {
    overview: 'The Sierra Nevada de Santa Marta nearby holds an extraordinary concentration of endemic and near-endemic species, joined each winter by large numbers of Nearctic migrants.',
    peak: 'Wintering Nearctic migrants join the resident endemics of the Sierra Nevada de Santa Marta in strong numbers.',
    wet: 'Wetter conditions bring a quieter baseline.',
    base: 'Outside the wintering season, birding settles to the resident endemic baseline.',
    peakMonths: [1, 2, 3, 12], wetMonths: [5, 6, 7, 8, 9, 10, 11],
  },
  bagan: {
    overview: 'Common river and dry-zone species along the Irrawaddy are present, with the dry season giving the most comfortable conditions.',
    peak: 'Dry-season conditions along the Irrawaddy are at their most comfortable.',
    wet: 'Monsoon rains bring a less comfortable baseline.',
    base: 'Conditions are transitioning between the wet and dry seasons.',
    peakMonths: [1, 2, 11, 12], wetMonths: [6, 7, 8, 9, 10],
  },
  thailand: {
    overview: 'Common coastal and reef-adjacent species are present, with the dry season giving the most comfortable conditions.',
    peak: 'Dry-season conditions are at their most comfortable.',
    wet: 'Monsoon rains bring a less comfortable baseline.',
    base: 'Conditions are transitioning between the wet and dry seasons.',
    peakMonths: [1, 2, 11, 12], wetMonths: [6, 7, 8, 9, 10],
  },
  queenstown: {
    overview: 'Alpine and lake-country species are present, similar to other South Island regions, with activity peaking during the spring breeding season.',
    peak: 'Spring breeding season brings the most activity to the alpine and lake-country habitat.',
    wet: 'Outside the spring peak, birding settles to a common baseline.',
    base: 'Outside the spring peak, birding settles to a common baseline.',
    peakMonths: [10, 11, 12], wetMonths: [],
  },
  'puerto-rico': {
    overview: 'El Yunque rainforest holds the critically endangered Puerto Rican parrot, one of the rarest birds in the Caribbean, best viewed during the dry season.',
    peak: 'Dry-season conditions give the most comfortable access to El Yunque.',
    wet: 'Outside the dry season, birding settles to a common baseline.',
    base: 'Outside the dry season, birding settles to a common baseline.',
    peakMonths: [1, 2, 3, 4, 12], wetMonths: [],
  },
  seychelles: {
    overview: 'Several of the world\'s rarest endemics — the Seychelles magpie-robin, Seychelles warbler, and black parrot — survive only on a handful of predator-free islands here, most reachable during the calm inter-monsoon periods.',
    peak: 'Calm inter-monsoon seas give the best boat access to the predator-free islands holding the rarest endemics.',
    wet: 'Monsoon conditions make boat access to the outer islands rougher.',
    base: 'Conditions are transitioning between monsoon periods.',
    peakMonths: [5, 6, 9, 10], wetMonths: [1, 2, 12],
  },
  komodo: {
    overview: 'Common Indonesian dry-forest species, including megapodes, are present, with the dry season giving the most comfortable access.',
    peak: 'Dry-season conditions give the most comfortable access to the dry-forest habitat.',
    wet: 'Wetter conditions bring a less comfortable baseline.',
    base: 'Conditions are transitioning between the wet and dry seasons.',
    peakMonths: [5, 6, 7, 8, 9], wetMonths: [1, 2, 3],
  },
  sydney: {
    overview: 'Common Australian urban species, including conspicuous flocks of cockatoos and rainbow lorikeets, are present year-round, with activity peaking during the spring breeding season.',
    peak: 'Spring breeding season brings cockatoo and lorikeet flocks to their most active.',
    wet: 'Outside the spring peak, birding settles to a common baseline.',
    base: 'Outside the spring peak, birding settles to a common baseline.',
    peakMonths: [9, 10, 11], wetMonths: [],
  },
  bali: {
    overview: 'Bali Barat National Park in the island\'s west holds the last wild population of the critically endangered Bali myna, best accessed during the dry season.',
    peak: 'Dry-season conditions give the best access to Bali Barat National Park.',
    wet: 'Monsoon rains limit access to the park.',
    base: 'Conditions are transitioning between the wet and dry seasons.',
    peakMonths: [4, 5, 6, 7, 8, 9], wetMonths: [1, 2, 3, 11, 12],
  },
  vietnam: {
    overview: 'The Da Lat Plateau and Annamite mountains hold a real concentration of Vietnamese and Indochinese endemics, best accessed during the dry season.',
    peak: 'Dry-season conditions give the best access to the Da Lat Plateau and Annamite endemics.',
    wet: 'Wetter conditions bring a less comfortable baseline.',
    base: 'Conditions are transitioning between the wet and dry seasons.',
    peakMonths: [1, 2, 3, 11, 12], wetMonths: [9, 10],
  },
  oaxaca: {
    overview: 'Common Mexican highland and cloud forest species are present, with the dry season giving the most comfortable access.',
    peak: 'Dry-season conditions give the most comfortable access to the highland and cloud forest habitat.',
    wet: 'Monsoon rains bring a less comfortable baseline.',
    base: 'Conditions are transitioning between the wet and dry seasons.',
    peakMonths: [1, 2, 3, 11, 12], wetMonths: [6, 7, 8, 9],
  },
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

function buildMonthly(e: Entry): string[] {
  const peakSet = new Set(e.peakMonths);
  const wetSet = new Set(e.wetMonths);
  return Array.from({ length: 12 }, (_, i) => {
    const m = i + 1;
    if (peakSet.has(m)) return e.peak;
    if (wetSet.has(m)) return e.wet;
    return e.base;
  });
}

async function main() {
  const env = loadDotEnvLocal();
  if (!env.DATABASE_URL) {
    console.error('No DATABASE_URL in .env.local — refusing to run against the PGlite fallback.');
    process.exit(1);
  }
  const dryRun = process.argv.includes('--dry-run');
  const db = drizzlePostgres(postgres(env.DATABASE_URL, { prepare: false }));

  for (const [id, entry] of Object.entries(ENTRIES)) {
    const [row] = await db.select().from(places).where(eq(places.id, id));
    if (!row) { console.error(`${id}: not found`); process.exit(1); }
    const monthly = buildMonthly(entry);
    const patch: Record<string, unknown> = {
      sliderOverview: { ...(row.sliderOverview as Record<string, string>), [KEY]: entry.overview },
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
  console.log(dryRun ? '\ndry run — nothing written.' : '\ndone.');
  process.exit(0);
}

main().catch((err) => { console.error(err); process.exit(1); });
