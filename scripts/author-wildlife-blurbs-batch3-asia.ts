import { readFileSync } from 'fs';
import { join } from 'path';
import { eq } from 'drizzle-orm';
import { drizzle as drizzlePostgres } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import { places, adminAuditLog } from '../src/lib/db/schema';

const KEY = 'wildlifeViewing';

const OVERVIEWS: Record<string, string> = {
  kaziranga: 'The Indian one-horned rhinoceros is the reason to come — Kaziranga holds about two-thirds of the world\'s population, and jeep and elephant-back safaris make sightings close to guaranteed when the park is open. Wild water buffalo and swamp deer are also common. The park closes entirely under monsoon floodwaters from roughly May to October.',
  nepal: 'Chitwan National Park is Nepal\'s wildlife headquarters — the Indian one-horned rhinoceros is a reliable sighting on jeep safaris and canoe trips along the rivers. Bengal tigers live here too, but seeing one is genuinely rare, even for repeat visitors.',
  bhutan: 'Bhutan isn\'t a dedicated wildlife destination, but the takin — Bhutan\'s odd, cow-faced national animal — is an easy, near-certain stop at the Motithang Takin Preserve outside Thimphu. Seeing one truly wild, in Jigme Dorji National Park, is a matter of luck.',
  srilanka: 'Sri Lanka\'s headline sight is "the Gathering" — hundreds of wild elephants converging on Minneriya and Kaudulla\'s shrinking reservoirs as the dry season peaks, one of Asia\'s great wildlife spectacles and a highly reliable sighting in the right months. Elephants are seen elsewhere on the island too, in smaller numbers.',
  borneo: 'Orangutans are the animal everyone comes for. Sepilok\'s rehabilitation centre gives good, though not guaranteed, odds at its feeding platforms; spotting a genuinely wild one on a Kinabatangan river cruise is a rarer, luckier sighting. Proboscis monkeys and macaques are common on those same river cruises, and pygmy elephants are a real, if unpredictable, bonus.',
  'rajasthan-golden-triangle': 'Ranthambore\'s Bengal tigers are the draw, and the real odds are decent, not guaranteed — often cited around a coin-flip per safari, better across multiple drives. Sightings improve as the dry season progresses and tigers concentrate at shrinking waterholes. The park closes entirely during the monsoon.',
  komodo: 'Komodo dragons are that rare wild megafauna sighting that\'s genuinely close to guaranteed — ranger-led walks on Komodo and Rinca islands find them reliably, year-round.',
  rajaampat: 'Reef manta rays gather reliably at cleaning stations like Manta Sandy in the right season, a genuine highlight for snorkelers and divers on top of Raja Ampat\'s reefs.',
  ladakh: 'Snow leopards are the reason people come to Hemis National Park, and even here — among the best odds anywhere for the species — sightings are genuinely rare and require a dedicated multi-day trip with expert trackers. Blue sheep, the snow leopard\'s main prey, are common and worth watching for their own sake. The high valleys are snowed shut from December through February.',
};

const KAZIRANGA_PEAK = 'Peak dry season — the park is open and near-guaranteed for rhino sightings on safari.';
const KAZIRANGA_CLOSED = 'The park is closed — monsoon floodwaters submerge Kaziranga each year, and no safaris run.';

const NEPAL_PEAK = 'Peak dry season — the best odds of the year for rhino sightings on safari or canoe.';
const NEPAL_BASELINE = 'Monsoon rains thicken the vegetation; rhino sightings remain possible but somewhat less reliable, and tiger sightings stay rare regardless of month.';

const BHUTAN_BASELINE = 'The takin preserve near Thimphu is a reliable, easy stop; a wild sighting in Jigme Dorji National Park is a matter of luck regardless of month.';
const BHUTAN_MONSOON = 'Monsoon rains make higher-altitude trekking harder, slightly reducing the odds of a wild sighting; the takin preserve is unaffected.';

const SRILANKA_BASELINE = 'Elephants are seen in smaller numbers island-wide; the big reservoir gatherings haven\'t yet formed.';
const SRILANKA_PEAK = 'The Gathering — hundreds of elephants concentrate at Minneriya and Kaudulla\'s shrinking reservoirs, the best odds of the year for a dramatic sighting.';

const BORNEO_BASELINE = 'Orangutans, proboscis monkeys, and macaques remain reliably present at Sepilok and on Kinabatangan river cruises.';
const BORNEO_PEAK = 'Drier conditions concentrate wildlife along the Kinabatangan River, the best odds of the year for wild orangutans and pygmy elephants.';

const RAJASTHAN_BASELINE = 'Baseline tiger odds — decent, not guaranteed, and better across multiple safaris.';
const RAJASTHAN_PEAK = 'Peak season — intensifying heat concentrates tigers at shrinking waterholes, the best odds of the year despite the temperatures.';
const RAJASTHAN_CLOSED = 'The park is closed for the monsoon; no safaris run.';

const KOMODO_ROUGH = 'Seas are rougher for the boat trip out, but dragon sightings on the islands themselves are just as reliable.';
const KOMODO_CALM = 'Calmer seas make for an easier crossing; dragon sightings stay reliably good year-round regardless.';

const LADAKH_CLOSED = 'The high valleys are snowed shut — no access to Hemis National Park.';
const LADAKH_PEAK = 'Peak snow leopard tracking season, right as the valleys reopen — still a rare sighting even now, but the best odds of the year.';
const LADAKH_BASELINE = 'Blue sheep and other high-altitude wildlife are reliably visible; snow leopard sightings remain rare outside the March peak.';

const MONTHLY: Record<string, string[]> = {
  kaziranga: [
    KAZIRANGA_PEAK, KAZIRANGA_PEAK,
    'Still good odds for rhino sightings, though the dry season is easing toward monsoon.',
    'Odds are declining as the monsoon approaches.',
    KAZIRANGA_CLOSED, KAZIRANGA_CLOSED, KAZIRANGA_CLOSED, KAZIRANGA_CLOSED, KAZIRANGA_CLOSED,
    'The park is reopening as floodwaters recede; safaris resume, though vegetation is still thick.',
    KAZIRANGA_PEAK, KAZIRANGA_PEAK,
  ],
  nepal: [
    NEPAL_PEAK, NEPAL_PEAK,
    'Still strong odds for rhino sightings as the dry season eases.',
    NEPAL_BASELINE, NEPAL_BASELINE, NEPAL_BASELINE, NEPAL_BASELINE, NEPAL_BASELINE, NEPAL_BASELINE,
    'Odds are improving as the dry season returns.',
    NEPAL_PEAK, NEPAL_PEAK,
  ],
  bhutan: [
    BHUTAN_BASELINE, BHUTAN_BASELINE, BHUTAN_BASELINE, BHUTAN_BASELINE, BHUTAN_BASELINE,
    BHUTAN_MONSOON, BHUTAN_MONSOON, BHUTAN_MONSOON,
    BHUTAN_BASELINE, BHUTAN_BASELINE, BHUTAN_BASELINE, BHUTAN_BASELINE,
  ],
  srilanka: [
    SRILANKA_BASELINE, SRILANKA_BASELINE, SRILANKA_BASELINE, SRILANKA_BASELINE,
    'Odds are easing as the dry season hasn\'t yet peaked.',
    'Odds are easing as the dry season hasn\'t yet peaked.',
    SRILANKA_PEAK, SRILANKA_PEAK, SRILANKA_PEAK, SRILANKA_PEAK,
    'The Gathering is dispersing as rains return, though elephants remain a reliable sighting island-wide.',
    SRILANKA_BASELINE,
  ],
  borneo: [
    BORNEO_BASELINE, BORNEO_BASELINE,
    BORNEO_PEAK, BORNEO_PEAK, BORNEO_PEAK, BORNEO_PEAK, BORNEO_PEAK, BORNEO_PEAK, BORNEO_PEAK, BORNEO_PEAK,
    BORNEO_BASELINE, BORNEO_BASELINE,
  ],
  'rajasthan-golden-triangle': [
    RAJASTHAN_BASELINE, RAJASTHAN_BASELINE,
    'Odds are improving as the dry season builds.',
    RAJASTHAN_PEAK, RAJASTHAN_PEAK, RAJASTHAN_PEAK,
    RAJASTHAN_CLOSED, RAJASTHAN_CLOSED, RAJASTHAN_CLOSED,
    RAJASTHAN_BASELINE, RAJASTHAN_BASELINE, RAJASTHAN_BASELINE,
  ],
  komodo: [
    KOMODO_ROUGH, KOMODO_ROUGH, KOMODO_ROUGH,
    KOMODO_CALM, KOMODO_CALM, KOMODO_CALM, KOMODO_CALM, KOMODO_CALM, KOMODO_CALM, KOMODO_CALM, KOMODO_CALM, KOMODO_CALM,
  ],
  rajaampat: [
    'Peak manta season — reef mantas gather reliably in numbers at cleaning stations like Manta Sandy.',
    'Peak manta season — reef mantas gather reliably in numbers at cleaning stations like Manta Sandy.',
    'Still strong manta odds as peak season eases.',
    'Manta odds are easing; sightings become more scattered.',
    'Manta odds are easing; sightings become more scattered.',
    'The quietest months for manta gatherings at the cleaning stations.',
    'The quietest months for manta gatherings at the cleaning stations.',
    'The quietest months for manta gatherings at the cleaning stations.',
    'Manta activity is picking back up at the cleaning stations.',
    'Manta activity is building toward peak season.',
    'Manta activity is building toward peak season.',
    'Peak manta season — reef mantas gather reliably in numbers at cleaning stations like Manta Sandy.',
  ],
  ladakh: [
    LADAKH_CLOSED, LADAKH_CLOSED,
    LADAKH_PEAK,
    LADAKH_BASELINE, LADAKH_BASELINE, LADAKH_BASELINE, LADAKH_BASELINE, LADAKH_BASELINE, LADAKH_BASELINE, LADAKH_BASELINE, LADAKH_BASELINE,
    LADAKH_CLOSED,
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
