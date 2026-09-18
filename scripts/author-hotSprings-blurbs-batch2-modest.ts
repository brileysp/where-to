import { readFileSync } from 'fs';
import { join } from 'path';
import { eq } from 'drizzle-orm';
import { drizzle as drizzlePostgres } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import { places, adminAuditLog } from '../src/lib/db/schema';

const KEY = 'hotSprings';

const OVERVIEWS: Record<string, string> = {
  chamonix: "Chamonix's own spa uses artificially heated water, not a natural spring. The real natural hot spring is Les Thermes de Saint-Gervais, a short drive away in the same Mont Blanc valley — water that fell as snow on the massif roughly 6,500 years ago, filtering down through rock before resurfacing at 39°C. Bathing here dates back to at least the 14th century.",
  dolomites: "Terme Dolomia in Val di Fassa is Trentino's only sulphur spring, first documented in 1493. Further west, Bagni Vecchi di Bormio is a 1,000-year-old pool built into an ancient Roman tunnel, with views straight up at the snow-capped peaks.",
  jordan: "Ma'in Hot Springs, between Madaba and the Dead Sea, is a waterfall cascading into natural thermal pools that Herod the Great reportedly used for his health. This is a heat-avoidance story, not a cold-contrast one — summer temperatures here top 40°C, making the already-warm springs genuinely uncomfortable.",
  kyrgyzstan: "Altyn Arashan (\"Golden Spa\"), a remote alpine valley near Karakol reached by jeep track or hike, is prized for water rich in radon and hydrogen sulfide — nearly every guesthouse in the small settlement has its own soaking pool. The access road and guesthouses only operate June through September; the rest of the year it's snowed in.",
  'rocky-mountain': "There's no hot spring inside Rocky Mountain National Park itself. Hot Sulphur Springs Resort is about 30 minutes from the park's west entrance near Grand Lake — real, but roughly 2 hours from Estes Park, the main gateway on the park's more-visited east side.",
  tuscany: "Saturnia's Cascate del Mulino are free, natural sulphur pools that have drawn bathers since Etruscan times, roughly 2,500 years ago — Roman myth holds the god Saturn created them with a lightning bolt. The water sits at a constant 37°C year-round; there's no real seasonal story for the spring itself, only general Tuscan weather and crowds.",
  greenland: "Uunartoq's hot spring, on an uninhabited island in South Greenland, has been used since Norse settlers arrived roughly 1,000 years ago — heated geothermally rather than volcanically, and warm year-round. The only way to actually reach it is an organized boat tour, which runs June through September; outside that window it's effectively cut off.",
  peru: "Three real, separate hot springs sit along Peru's most popular routes: Aguas Calientes at the base of Machu Picchu, Cocalmayo on the Sacred Valley/Salkantay trek route, and La Calera in Colca Canyon, fed by the Cotallaulli volcano. All three are more of a stopover than a reason to plan a trip around on their own.",
};

const CHAM_PEAK = 'Cold alpine winter is when the contrast against the warm water is most worthwhile.';
const CHAM_BASE = 'The thermal baths are open and good year-round, just without winter’s contrast.';

const DOL_PEAK = 'Soaking with snow-capped peaks overhead is the real seasonal draw.';
const DOL_BASE = 'Good conditions year-round, just without winter’s snow backdrop.';

const JOR_PEAK = 'Mild desert winter — the most comfortable time to visit.';
const JOR_GOOD = 'Spring and fall temperatures, still comfortable.';
const JOR_AVOID = 'Summer heat regularly tops 40°C — genuinely too hot to enjoy already-warm springs.';

const KYR_PEAK = 'The valley is open and at its best, clear passes and reliable access.';
const KYR_SHOULDER = 'Open, right at the edge of the accessible season.';
const KYR_CLOSED = 'Snowed in and unreachable — not a realistic time to plan a visit.';

const RM_PEAK = 'Soaking in hot water as snow falls is the real appeal here, best reached from the park’s west side near Grand Lake.';
const RM_BASE = 'Open and good, just without winter’s contrast.';

const TUS_PEAK = 'Comfortable Tuscan spring/fall weather — good conditions for the free, open-air pools.';
const TUS_GOOD = 'Good conditions, whether cooler late-winter days or hot midsummer.';
const TUS_QUIET = 'The quieter, cooler stretch of the year — the pools themselves are unaffected, since the water is a constant 37°C regardless of season.';

const GRL_PEAK = 'Boat tours run reliably, sometimes with drifting icebergs nearby for a genuinely striking soak.';
const GRL_SHOULDER = 'Boat tours run, right at the edges of the season.';
const GRL_CLOSED = 'No practical way to reach the spring — not a realistic time to plan around it.';

const PERU_PEAK = 'Dry season — easier trail access to all three, and the clearest views at Colca Canyon.';
const PERU_SHOULDER = 'Conditions easing toward or from the dry season.';
const PERU_WET = 'Wetter conditions, with afternoon storms most days — still usable, just muddier and greener.';

const MONTHLY: Record<string, string[]> = {
  // Jan Feb Mar Apr May Jun Jul Aug Sep Oct Nov Dec
  chamonix: [CHAM_PEAK, CHAM_PEAK, CHAM_PEAK, CHAM_BASE, CHAM_BASE, CHAM_BASE, CHAM_BASE, CHAM_BASE, CHAM_BASE, CHAM_BASE, CHAM_PEAK, CHAM_PEAK],
  dolomites: [DOL_PEAK, DOL_PEAK, DOL_PEAK, DOL_BASE, DOL_BASE, DOL_BASE, DOL_BASE, DOL_BASE, DOL_BASE, DOL_BASE, DOL_PEAK, DOL_PEAK],
  jordan: [JOR_PEAK, JOR_PEAK, JOR_GOOD, JOR_GOOD, JOR_GOOD, JOR_AVOID, JOR_AVOID, JOR_AVOID, JOR_AVOID, JOR_GOOD, JOR_GOOD, JOR_PEAK],
  kyrgyzstan: [KYR_CLOSED, KYR_CLOSED, KYR_CLOSED, KYR_CLOSED, KYR_CLOSED, KYR_SHOULDER, KYR_PEAK, KYR_PEAK, KYR_SHOULDER, KYR_CLOSED, KYR_CLOSED, KYR_CLOSED],
  'rocky-mountain': [RM_PEAK, RM_PEAK, RM_PEAK, RM_PEAK, RM_BASE, RM_BASE, RM_BASE, RM_BASE, RM_BASE, RM_BASE, RM_PEAK, RM_PEAK],
  tuscany: [TUS_QUIET, TUS_GOOD, TUS_GOOD, TUS_GOOD, TUS_PEAK, TUS_PEAK, TUS_GOOD, TUS_GOOD, TUS_PEAK, TUS_PEAK, TUS_QUIET, TUS_QUIET],
  greenland: [GRL_CLOSED, GRL_CLOSED, GRL_CLOSED, GRL_CLOSED, GRL_CLOSED, GRL_SHOULDER, GRL_PEAK, GRL_PEAK, GRL_SHOULDER, GRL_CLOSED, GRL_CLOSED, GRL_CLOSED],
  peru: [PERU_WET, PERU_WET, PERU_WET, PERU_SHOULDER, PERU_PEAK, PERU_PEAK, PERU_PEAK, PERU_PEAK, PERU_PEAK, PERU_SHOULDER, PERU_SHOULDER, PERU_WET],
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
    const patch = {
      sliderOverview: { ...(row.sliderOverview as Record<string, string>), [KEY]: OVERVIEWS[id] },
      sliderMonthlyWeather: { ...(row.sliderMonthlyWeather as Record<string, (string | null)[]>), [KEY]: MONTHLY[id] },
    };
    if (!dryRun) {
      const after = { ...row, ...patch };
      await db.transaction(async (tx) => {
        await tx.update(places).set({ ...patch, updatedAt: new Date() }).where(eq(places.id, id));
        await tx.insert(adminAuditLog).values({ actorId: '00000000-0000-0000-0000-000000000000', entityType: 'destination', entityId: id, action: 'update', beforeValue: row, afterValue: after });
      });
    }
    console.log(`  ${id}`);
  }
  console.log(dryRun ? '\ndry run — nothing written.' : '\ndone.');
  process.exit(0);
}

main().catch((err) => { console.error(err); process.exit(1); });
