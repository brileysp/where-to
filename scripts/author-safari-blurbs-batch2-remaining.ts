import { readFileSync } from 'fs';
import { join } from 'path';
import { eq } from 'drizzle-orm';
import { drizzle as drizzlePostgres } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import { places, adminAuditLog } from '../src/lib/db/schema';

const KEY = 'safari';

const OVERVIEWS: Record<string, string> = {
  tanzania: 'Ndutu and the southern Serengeti plains host the wildebeest calving season each January through March — over half a million calves born in a matter of weeks, with predators (lion, cheetah, hyena) working the herds hard. The same migration\'s Mara River crossings, one of the most dramatic wildlife spectacles on Earth, run roughly June through October as the herds push north into Kenya.',
  botswana: 'The Okavango Delta\'s flood — arriving from Angolan headwater rains months earlier, right as the local dry season sets in — draws elephant herds in the hundreds and concentrates lions, leopards, and wild dogs along the remaining channels. It\'s a genuinely unusual combination: the driest, clearest months for game viewing are also when the Delta itself is at its wettest and most beautiful, opening up real water-based safaris by mokoro and boat.',
  namibia: 'Etosha\'s waterholes — like Okaukuejo, which draws black rhino most nights — concentrate desert-adapted lions and elephants (pale with the park\'s white clay) during the dry season, when the pan\'s sparse vegetation makes for genuinely easy, wide-open game viewing.',
  uganda: 'Bwindi Impenetrable Forest\'s mountain gorilla trekking is genuinely possible year-round, but the two dry seasons — June through August and December through February — mean firmer, less slippery trails and better gorilla visibility through thinner vegetation.',
  srilanka: 'Minneriya and Kaudulla National Parks host "The Gathering" — the largest natural congregation of wild Asian elephants on Earth, up to 300 animals converging on the ancient Minneriya Tank as the dry season shrinks other water sources. It peaks August through September.',
  zambia: 'South Luangwa is the birthplace of the walking safari, pioneered by conservationist Norman Carr in the 1950s — the park\'s permanent river frontage has earned it the nickname "Valley of the Leopard" for one of the highest leopard densities on the continent, at its best when the dry season concentrates game along the river.',
  zimbabwe: 'Hwange National Park has almost no natural water — its 45,000+ elephants depend on a network of pumped waterholes, which become genuine magnets for game during the dry season, with herds of 200+ elephants and predators following close behind.',
  kruger: 'Kruger is South Africa\'s flagship Big Five park and one of the few in Africa set up for genuine self-drive safaris — sparse dry-season vegetation (May through September) makes sightings dramatically easier than the lush wet season.',
  rwanda: 'Volcanoes National Park\'s mountain gorilla trekking, like Uganda\'s, has two real dry seasons — June through September and December through February — with firmer trails and less rain, though the Virunga range\'s mixed climate means some rain is possible any time of year.',
  madagascar: 'Real access constraint, not just comfort: many of Madagascar\'s best lemur-viewing parks, including Tsingy de Bemaraha, are only reachable during the dry season (roughly April through November) — the rains make the roads, including the iconic RN7, genuinely impassable.',
  'rajasthan-golden-triangle': 'Ranthambore\'s core tiger zones close entirely each monsoon (July through September, by national conservation directive) — a real, hard cutoff, not just reduced access. The dry season leading up to that closure (March through June) is when tigers come to lake edges to drink more often, the best odds of the year despite the heat.',
  ethiopia: 'The Simien Mountains hold Ethiopia\'s "big three" — Walia ibex, gelada monkey troops, and the rare Ethiopian wolf — with the Bale Mountains offering genuinely good odds of the wolf too, on the world\'s largest Afro-alpine plateau. The dry season (October through March) is real and sharp: trekking conditions elsewhere turn genuinely difficult once the rains set in.',
  nepal: 'Chitwan\'s one-horned rhinos are a near-guaranteed sighting almost any time of year — roughly 700 individuals, the second-largest population in Asia after Kaziranga — but the park closes entirely during peak monsoon (July-August), and tiger odds (a genuine event, not routine, at 5-15% per safari day) improve in the thinner winter vegetation.',
  borneo: 'The Kinabatangan River is Borneo\'s best wildlife-viewing trip — orangutans, pygmy elephants, proboscis monkeys, and hornbills spotted from a small boat rather than on foot. This is real, if genuinely different from a classic plains safari: a multi-night stay meaningfully improves the odds of pygmy elephants, best during the dry season when animals gather at the river.',
};

const MONTHLY: Record<string, string[]> = {
  tanzania: [
    'Peak wildebeest calving season at Ndutu — hundreds of thousands of calves born within weeks, with predators working the herds hard.',
    'Peak calving season continues at Ndutu, the single best month for newborn wildebeest and intense predator action.',
    'Calving season easing at Ndutu, still exceptional predator action on the southern plains.',
    'The migration herds have moved on from Ndutu; the long rains make roads harder elsewhere in the Serengeti.',
    'The long rains continue; the migration herds are moving north through the western corridor.',
    'The migration herds crossing the Grumeti River as they push north toward the Mara ecosystem.',
    'Peak Mara River crossing season begins — one of the most dramatic wildlife spectacles on Earth.',
    'Peak Mara River crossing season continues.',
    'Still peak Mara River crossing season.',
    'The river crossings continue as the herds begin their return south.',
    'The migration herds heading back toward the southern plains, ahead of calving season.',
    'The migration herds arriving back on the southern plains, ahead of calving season.',
  ],
  botswana: [
    'The green season — the Delta\'s own floodwaters haven\'t yet arrived from Angola, but calving season brings real predator action.',
    'The green season — the Delta\'s own floodwaters haven\'t yet arrived from Angola, but calving season brings real predator action.',
    'The green season — the Delta\'s own floodwaters haven\'t yet arrived from Angola, but calving season brings real predator action.',
    'The green season — the Delta\'s own floodwaters haven\'t yet arrived from Angola, but calving season brings real predator action.',
    'The flood pulse beginning to arrive from Angola, right as the dry season sets in.',
    'The Delta\'s channels filling with floodwater — elephant herds in the hundreds, with lions, leopards, and wild dogs concentrating along the remaining dry ground.',
    'Peak flood season — water-based safaris by mokoro and boat open up alongside exceptional predator sightings.',
    'Still peak flood season, exceptional big-cat and elephant sightings.',
    'Water levels beginning to recede, still exceptional game viewing.',
    'The last of the flood season — water levels at their lowest, animals concentrated along what remains.',
    'The flood has receded and the rains are returning; a real, if different, green-season safari.',
    'The green season — real predator action from calving, without the Delta\'s own floodwaters.',
  ],
  namibia: [
    'The wet season — Etosha\'s animals are more dispersed across the park, away from the waterholes.',
    'The wet season — Etosha\'s animals are more dispersed across the park, away from the waterholes.',
    'The wet season — Etosha\'s animals are more dispersed across the park, away from the waterholes.',
    'Conditions drying out; wildlife beginning to concentrate around Etosha\'s waterholes.',
    'The dry season setting in at Etosha, wildlife concentration building.',
    'Peak dry season at Etosha — desert-adapted lions and elephants concentrate at waterholes like Okaukuejo, genuinely easy, wide-open game viewing.',
    'Peak dry season at Etosha — desert-adapted lions and elephants concentrate at waterholes like Okaukuejo, genuinely easy, wide-open game viewing.',
    'Peak dry season at Etosha — desert-adapted lions and elephants concentrate at waterholes like Okaukuejo, genuinely easy, wide-open game viewing.',
    'Still peak dry season at Etosha, exceptional waterhole viewing.',
    'Still peak dry season at Etosha, exceptional waterhole viewing.',
    'The dry season easing as the first rains approach.',
    'The wet season returning; Etosha\'s animals disperse away from the waterholes.',
  ],
  uganda: [
    'Dry-season trekking conditions at Bwindi — firm trails and thinner vegetation for gorilla visibility.',
    'Dry-season trekking conditions at Bwindi — firm trails and thinner vegetation for gorilla visibility.',
    'The wetter season at Bwindi — trekking is still possible, just muddier and more physically demanding.',
    'The wetter season at Bwindi — trekking is still possible, just muddier and more physically demanding.',
    'The wetter season at Bwindi — trekking is still possible, just muddier and more physically demanding.',
    'Dry-season trekking conditions return at Bwindi — firm trails and thinner vegetation for gorilla visibility.',
    'Dry-season trekking conditions return at Bwindi — firm trails and thinner vegetation for gorilla visibility.',
    'Still within the dry season at Bwindi, easing slightly.',
    'The wetter season returning at Bwindi — trekking is still possible, just muddier.',
    'The wetter season returning at Bwindi — trekking is still possible, just muddier.',
    'The wetter season returning at Bwindi — trekking is still possible, just muddier.',
    'Dry-season trekking conditions building again at Bwindi.',
  ],
  srilanka: [
    'Baseline elephant sightings around Minneriya and Kaudulla, before the dry season concentrates them at the tank.',
    'Baseline elephant sightings around Minneriya and Kaudulla, before the dry season concentrates them at the tank.',
    'Baseline elephant sightings around Minneriya and Kaudulla, before the dry season concentrates them at the tank.',
    'Baseline elephant sightings around Minneriya and Kaudulla, before the dry season concentrates them at the tank.',
    'The driest, quietest stretch before the Gathering builds — elephants still dispersed across the region.',
    'The driest, quietest stretch before the Gathering builds — elephants still dispersed across the region.',
    'The Gathering beginning at Minneriya Tank as the dry season shrinks other water sources.',
    'Peak of the Gathering — up to 300 elephants converging on Minneriya Tank, the largest natural gathering of wild Asian elephants on Earth.',
    'Peak of the Gathering — up to 300 elephants converging on Minneriya Tank, the largest natural gathering of wild Asian elephants on Earth.',
    'Still within the Gathering, easing slightly as the season winds down.',
    'The Gathering has dispersed as the rains return.',
    'Baseline elephant sightings around Minneriya and Kaudulla.',
  ],
  zambia: [
    'The wet season — South Luangwa\'s leopards and other game are more dispersed away from the river.',
    'The wet season — South Luangwa\'s leopards and other game are more dispersed away from the river.',
    'The wet season — South Luangwa\'s leopards and other game are more dispersed away from the river.',
    'The dry season setting in, game beginning to concentrate along the Luangwa River.',
    'Dry-season game viewing along the Luangwa River — among the best leopard densities on the continent.',
    'Peak dry season — walking safaris, pioneered here in the 1950s, are at their best along the river corridor.',
    'Peak dry season — walking safaris, pioneered here in the 1950s, are at their best along the river corridor.',
    'Peak dry season — walking safaris, pioneered here in the 1950s, are at their best along the river corridor.',
    'Peak dry season — walking safaris, pioneered here in the 1950s, are at their best along the river corridor.',
    'Still peak dry season along the Luangwa River, exceptional leopard and general game viewing.',
    'The dry season nearing its end, still exceptional game viewing along the river.',
    'The wet season returning; game disperses away from the river.',
  ],
  zimbabwe: [
    'The wet season — Hwange\'s elephants and other game are dispersed away from the pumped waterholes.',
    'The wet season — Hwange\'s elephants and other game are dispersed away from the pumped waterholes.',
    'The wet season — Hwange\'s elephants and other game are dispersed away from the pumped waterholes.',
    'Conditions drying out; game beginning to concentrate at Hwange\'s waterholes.',
    'Conditions drying out; game beginning to concentrate at Hwange\'s waterholes.',
    'Peak dry season at Hwange — herds of 200+ elephants gather at the pumped waterholes, with predators close behind.',
    'Peak dry season at Hwange — herds of 200+ elephants gather at the pumped waterholes, with predators close behind.',
    'Peak dry season at Hwange — herds of 200+ elephants gather at the pumped waterholes, with predators close behind.',
    'Still peak dry season at Hwange, exceptional waterhole game viewing.',
    'Still peak dry season at Hwange, exceptional waterhole game viewing.',
    'The dry season easing as the first rains approach.',
    'The wet season returning; Hwange\'s game disperses away from the waterholes.',
  ],
  kruger: [
    'The wet season — Kruger\'s lush vegetation makes sightings harder, though the Big Five are all still present.',
    'The wet season — Kruger\'s lush vegetation makes sightings harder, though the Big Five are all still present.',
    'The wet season — Kruger\'s lush vegetation makes sightings harder, though the Big Five are all still present.',
    'Vegetation thinning as the dry season sets in, sightings becoming easier.',
    'Peak dry season at Kruger — sparse vegetation makes for dramatically easier Big Five sightings, genuinely well-suited to self-drive safaris.',
    'Peak dry season at Kruger — sparse vegetation makes for dramatically easier Big Five sightings, genuinely well-suited to self-drive safaris.',
    'Peak dry season at Kruger — sparse vegetation makes for dramatically easier Big Five sightings, genuinely well-suited to self-drive safaris.',
    'Peak dry season at Kruger — sparse vegetation makes for dramatically easier Big Five sightings, genuinely well-suited to self-drive safaris.',
    'Peak dry season at Kruger — sparse vegetation makes for dramatically easier Big Five sightings, genuinely well-suited to self-drive safaris.',
    'Still within the dry season at Kruger, excellent sightlines.',
    'The rains returning; vegetation thickens and sightings become harder again.',
    'The rains returning; vegetation thickens and sightings become harder again.',
  ],
  rwanda: [
    'Dry-season trekking conditions at Volcanoes National Park — firmer trails, less rain.',
    'Dry-season trekking conditions at Volcanoes National Park — firmer trails, less rain.',
    'The wetter season at Volcanoes National Park — trekking is still possible, just muddier.',
    'The wetter season at Volcanoes National Park — trekking is still possible, just muddier.',
    'The wetter season at Volcanoes National Park — trekking is still possible, just muddier.',
    'Dry-season trekking conditions returning at Volcanoes National Park.',
    'Peak dry season — the driest, firmest trail conditions of the year.',
    'Peak dry season — the driest, firmest trail conditions of the year.',
    'Still within the dry season, easing slightly.',
    'The wetter season returning at Volcanoes National Park — trekking is still possible, just muddier.',
    'The wetter season returning at Volcanoes National Park — trekking is still possible, just muddier.',
    'Dry-season trekking conditions building again at Volcanoes National Park.',
  ],
  madagascar: [
    'The wet season — many roads, including access to parks like Tsingy de Bemaraha, become impassable.',
    'The wet season — many roads, including access to parks like Tsingy de Bemaraha, become impassable.',
    'The wet season — many roads, including access to parks like Tsingy de Bemaraha, become impassable.',
    'Roads beginning to reopen as the dry season sets in.',
    'The dry season underway — roads passable, lemur-viewing conditions improving.',
    'Peak dry season — roads including the RN7 are fully passable, and thinner foliage makes for excellent lemur viewing.',
    'Peak dry season — roads including the RN7 are fully passable, and thinner foliage makes for excellent lemur viewing.',
    'Peak dry season — roads including the RN7 are fully passable, and thinner foliage makes for excellent lemur viewing.',
    'Still within the dry season, roads fully passable and lemur viewing excellent.',
    'The dry season easing, still good conditions.',
    'The dry season ending; roads remain passable for now.',
    'The wet season returning; roads become harder going, including the RN7.',
  ],
  'rajasthan-golden-triangle': [
    'Baseline tiger sightings at Ranthambore — cooler weather, thicker vegetation than the dry-season peak.',
    'Baseline tiger sightings at Ranthambore — cooler weather, thicker vegetation than the dry-season peak.',
    'Vegetation thinning at Ranthambore as the dry season builds, tiger sightings improving.',
    'Peak dry-season tiger sightings at Ranthambore — tigers come to lake edges to drink more often, despite the heat.',
    'Peak dry-season tiger sightings at Ranthambore — tigers come to lake edges to drink more often, despite the heat.',
    'Still peak dry-season tiger sightings, in the final weeks before the monsoon closure.',
    'Ranthambore\'s core tiger zones are closed entirely for the monsoon, by national conservation directive.',
    'Ranthambore\'s core tiger zones are closed entirely for the monsoon, by national conservation directive.',
    'Ranthambore\'s core tiger zones are closed entirely for the monsoon, by national conservation directive.',
    'Ranthambore\'s core zones reopen as the monsoon ends, vegetation still thick.',
    'Baseline tiger sightings at Ranthambore, vegetation gradually thinning.',
    'Baseline tiger sightings at Ranthambore.',
  ],
  ethiopia: [
    'Dry-season trekking conditions in the Simien and Bale Mountains — good odds for gelada monkeys and the Ethiopian wolf.',
    'Dry-season trekking conditions in the Simien and Bale Mountains — good odds for gelada monkeys and the Ethiopian wolf.',
    'Still within the dry season, good trekking conditions in the Simien and Bale Mountains.',
    'The rains setting in, trekking conditions becoming harder.',
    'The rains setting in, trekking conditions becoming harder.',
    'The wet season — trekking conditions in the Simien and Bale Mountains are genuinely difficult.',
    'The wet season — trekking conditions in the Simien and Bale Mountains are genuinely difficult.',
    'The wet season — trekking conditions in the Simien and Bale Mountains are genuinely difficult.',
    'The wet season — trekking conditions in the Simien and Bale Mountains are genuinely difficult.',
    'The dry season returning — trekking conditions improving in the Simien and Bale Mountains.',
    'Dry-season trekking conditions in the Simien and Bale Mountains — good odds for gelada monkeys and the Ethiopian wolf.',
    'Dry-season trekking conditions in the Simien and Bale Mountains — good odds for gelada monkeys and the Ethiopian wolf.',
  ],
  nepal: [
    'Peak dry season at Chitwan — thin vegetation improves tiger odds alongside near-guaranteed rhino sightings.',
    'Peak dry season at Chitwan — thin vegetation improves tiger odds alongside near-guaranteed rhino sightings.',
    'Still good dry-season conditions at Chitwan, easing slightly as the season progresses.',
    'The pre-monsoon heat building at Chitwan, conditions still workable.',
    'The pre-monsoon heat building at Chitwan, conditions still workable.',
    'The monsoon approaching at Chitwan, conditions becoming less comfortable ahead of the park\'s closure.',
    'Chitwan is closed to visitors — the park shuts entirely for the deep monsoon.',
    'Chitwan is closed to visitors — the park shuts entirely for the deep monsoon.',
    'Chitwan reopens as the monsoon eases, typically by mid-September, though conditions remain lush and less comfortable.',
    'The dry season returning to Chitwan, trails drying out.',
    'Good dry-season conditions at Chitwan.',
    'Peak dry season building at Chitwan.',
  ],
  borneo: [
    'The wetter season on the Kinabatangan River — the rainforest is lush, but animals spread out and sightings take longer.',
    'The wetter season on the Kinabatangan River — the rainforest is lush, but animals spread out and sightings take longer.',
    'The dry season beginning on the Kinabatangan River, wildlife starting to gather along the water.',
    'Dry-season conditions on the Kinabatangan River — better odds for pygmy elephants coming out of the dense forest.',
    'Dry-season conditions on the Kinabatangan River — better odds for pygmy elephants coming out of the dense forest.',
    'Dry-season conditions on the Kinabatangan River — better odds for pygmy elephants coming out of the dense forest.',
    'Dry-season conditions on the Kinabatangan River — better odds for pygmy elephants coming out of the dense forest.',
    'Dry-season conditions on the Kinabatangan River — better odds for pygmy elephants coming out of the dense forest.',
    'Dry-season conditions on the Kinabatangan River — better odds for pygmy elephants coming out of the dense forest.',
    'Conditions easing on the Kinabatangan River as the dry season ends.',
    'The wetter season returning to the Kinabatangan River — the rainforest is lush, but animals spread out.',
    'The wetter season on the Kinabatangan River — the rainforest is lush, but animals spread out and sightings take longer.',
  ],
};

function loadDotEnvLocal(): Record<string, string> {
  const out: Record<string, string> = {};
  const raw = readFileSync(join(__dirname, '..', '.env.local'), 'utf8');
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
    if (MONTHLY[id].length !== 12) { console.error(`${id}: monthly array is not length 12`); process.exit(1); }
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
