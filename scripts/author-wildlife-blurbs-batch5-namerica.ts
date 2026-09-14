import { readFileSync } from 'fs';
import { join } from 'path';
import { eq } from 'drizzle-orm';
import { drizzle as drizzlePostgres } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import { places, adminAuditLog } from '../src/lib/db/schema';

const KEY = 'wildlifeViewing';

const OVERVIEWS: Record<string, string> = {
  yellowstone: 'Bison are the near-guaranteed sighting — massive herds roam right along the roads in Lamar and Hayden valleys. Wolves are the animal most visitors have their heart set on, and Lamar Valley is the best place in the world to find one, though even here it takes a spotting scope and real patience. Grizzly and black bears are also present but a matter of luck.',
  'denali-interior': 'Grizzly bears, caribou, moose, wolves, and Dall sheep are known here as the "Big Five" — Dall sheep and caribou are fairly reliable from the park road, while wolves are a genuinely rare sighting even for repeat visitors. The park\'s interior is only reachable by shuttle bus from late May to mid-September; outside that window, wildlife-watching here is essentially not happening.',
  banff: 'Elk are a near-guaranteed sighting, often right around the Banff townsite. Bighorn sheep are common at highway pullouts. Black bears and grizzlies are real, more elusive sightings, most active in spring and fall; wolves are rare.',
  grandcanyon: 'Wildlife-watching isn\'t a dedicated draw here — mule deer and bighorn sheep are the common sightings along the rim and inner canyon trails.',
  'great-smoky-mountains': 'Black bears are genuinely common here — one of the densest populations in the East — and Cades Cove is the most reliable place to spot one. Elk, reintroduced to Cataloochee Valley, are a real site-specific bonus. The synchronous firefly display at Elkmont each early summer is a famous, one-of-a-kind spectacle, though a lottery-won permit is now required to see it.',
  'southeast-alaska': 'Brown bears fishing for salmon are the headline sighting — Anan Creek and Pack Creek are among the most reliable places in the world to watch bears catch fish mid-leap, in the short summer salmon-run window. Whales are also present in the same waters through the summer.',
  'glacier-waterton': 'Mountain goats are the animal most associated with Glacier, genuinely common along high alpine trails like the Highline. Bighorn sheep and grizzly bears are also present, though the grizzlies are a matter of luck. The high country, where goats and sheep live, is only accessible once summer snowmelt opens the trails.',
};

const YELLOWSTONE_BASE = 'Bison herds remain reliable year-round; wolves and bears are a matter of luck.';
const YELLOWSTONE_NEWBORN_PEAK = 'Newborn wildlife peak — bison calves and elk calves are everywhere, one of the best times to be watching.';
const YELLOWSTONE_NEWBORN_EASING = 'Still a strong window, as the newborn-wildlife season eases.';
const YELLOWSTONE_RUT_PEAK = 'The elk rut peaks — bugling and sparring bulls are a dramatic, reliable sight.';
const YELLOWSTONE_RUT_EASING = 'The elk rut is easing but still active.';

const DENALI_CLOSED = 'The shuttle-bus road is closed; the park\'s interior is inaccessible.';
const DENALI_PEAK = 'Peak season — the road is open, the best window for caribou, Dall sheep, and grizzly sightings, though wolves remain rare.';
const DENALI_EASING = 'The season is winding down as the road begins closing for winter.';

const BANFF_BASE = 'Baseline season — elk and bighorn sheep remain reliable; bears are less active.';
const BANFF_SPRING = 'Bears are most active as they emerge and forage; this is also elk calving season.';
const BANFF_SUMMER = 'Baseline summer — heat reduces bear activity, though elk and bighorn sheep remain reliable.';
const BANFF_FALL = 'The elk rut brings bugling and sparring bulls, and bears are active again ahead of winter.';

const GRANDCANYON_TEXT = 'Wildlife-watching isn\'t a dedicated draw here — mule deer and bighorn sheep are the common sightings along the rim and inner canyon trails.';

const SMOKIES_BASE = 'Baseline season — black bears are seen year-round, though less active in the coldest months.';
const SMOKIES_MAY = 'The synchronous firefly display is building toward its peak at Elkmont.';
const SMOKIES_JUNE = 'Peak firefly season — a genuinely rare, famous spectacle, though it now requires a lottery-won permit to see at Elkmont.';

const SEALASKA_BASE = 'Baseline season — bears are present but not yet concentrated at the fishing streams.';
const SEALASKA_PEAK = 'Peak season — the salmon run concentrates brown bears at streams like Anan Creek, among the best bear-fishing viewing anywhere. Whales are also present in the same waters.';

const GLACIER_BASE = 'Baseline season — lower-elevation wildlife remains visible, but the high country where goats and sheep live is still snowed in.';
const GLACIER_PEAK = 'The high alpine trails are open — the best window for mountain goats and bighorn sheep.';

const MONTHLY: Record<string, string[]> = {
  yellowstone: [
    YELLOWSTONE_BASE, YELLOWSTONE_BASE, YELLOWSTONE_BASE, YELLOWSTONE_BASE,
    YELLOWSTONE_NEWBORN_PEAK, YELLOWSTONE_NEWBORN_EASING,
    YELLOWSTONE_BASE, YELLOWSTONE_BASE,
    YELLOWSTONE_RUT_PEAK, YELLOWSTONE_RUT_EASING,
    YELLOWSTONE_BASE, YELLOWSTONE_BASE,
  ],
  'denali-interior': [
    DENALI_CLOSED, DENALI_CLOSED, DENALI_CLOSED, DENALI_CLOSED, DENALI_CLOSED,
    DENALI_PEAK, DENALI_PEAK, DENALI_PEAK,
    DENALI_EASING,
    DENALI_CLOSED, DENALI_CLOSED, DENALI_CLOSED,
  ],
  banff: [
    BANFF_BASE, BANFF_BASE, BANFF_BASE, BANFF_BASE,
    BANFF_SPRING, BANFF_SPRING,
    BANFF_SUMMER, BANFF_SUMMER,
    BANFF_FALL, BANFF_FALL,
    BANFF_BASE, BANFF_BASE,
  ],
  grandcanyon: Array(12).fill(GRANDCANYON_TEXT),
  'great-smoky-mountains': [
    SMOKIES_BASE, SMOKIES_BASE, SMOKIES_BASE, SMOKIES_BASE,
    SMOKIES_MAY,
    SMOKIES_JUNE,
    SMOKIES_BASE, SMOKIES_BASE, SMOKIES_BASE, SMOKIES_BASE, SMOKIES_BASE, SMOKIES_BASE,
  ],
  'southeast-alaska': [
    SEALASKA_BASE, SEALASKA_BASE, SEALASKA_BASE, SEALASKA_BASE, SEALASKA_BASE,
    SEALASKA_PEAK, SEALASKA_PEAK, SEALASKA_PEAK,
    SEALASKA_BASE, SEALASKA_BASE, SEALASKA_BASE, SEALASKA_BASE,
  ],
  'glacier-waterton': [
    GLACIER_BASE, GLACIER_BASE, GLACIER_BASE, GLACIER_BASE, GLACIER_BASE,
    GLACIER_PEAK, GLACIER_PEAK, GLACIER_PEAK, GLACIER_PEAK,
    GLACIER_BASE, GLACIER_BASE, GLACIER_BASE,
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
