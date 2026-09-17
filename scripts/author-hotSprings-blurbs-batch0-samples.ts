import { readFileSync } from 'fs';
import { join } from 'path';
import { eq } from 'drizzle-orm';
import { drizzle as drizzlePostgres } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import { places, adminAuditLog } from '../src/lib/db/schema';

const KEY = 'hotSprings';

const OVERVIEWS: Record<string, string> = {
  iceland: "Geothermal pools and lagoons are warm year-round, so nothing here really closes. From roughly September through March, dark enough nights add a real chance of watching the aurora from the water.",
  hokkaido: "Onsen culture is real here year-round. What's specific to Hokkaido is rotenburo — outdoor baths — steaming while real snow falls, which needs actual snow on the ground.",
  budapest: "Bathing here is a genuine year-round habit, split between Ottoman-era baths from the 1500s (Rudás, Király) and Széchenyi, one of Europe's largest bath complexes. Its outdoor pools have only stayed open through winter since 1963 — steam rising off the water while the air's below freezing is a real, specific sight, not guaranteed every single day of the window.",
  'costa-rica': "Arenal Volcano's hot springs are warm year-round in a warm climate — there's no cold-air contrast here, and that's not a knock on them; several real, separate properties around La Fortuna are the draw regardless of the weather outside.",
  taiwan: "Beitou (reachable by MRT in Taipei) and Jiaoxi's outdoor springs in Yilan give Taiwan real, easy-access bathing. July through September is a genuinely different case from the rest of the year — typhoon season can disrupt transport to the springs outright, not just the mood.",
};

// Shared bucket text, reused verbatim across every month that shares the
// same real character — see the playbook's note on this pattern. Multiple
// months saying the identical thing is correct when the underlying reality
// doesn't change month to month; the point is each string still names its
// own mechanism and reads fine in isolation.
const ICELAND_PEAK = 'Long, dark nights give real aurora odds on a clear night, on top of the warm geothermal water.';
const ICELAND_BUILDING = 'Nights are getting dark enough for aurora odds to start building, alongside the warm water as always.';
const ICELAND_BASELINE = 'The warm geothermal pools and lagoons are the same as ever — bright summer nights, good for a swim any time of day.';

const HOKKAIDO_PEAK = 'Real snow on the ground makes for the classic rotenburo experience — steaming outdoor baths in falling or settled snow.';
const HOKKAIDO_BUILDING = 'The first snow of the season is arriving, building toward the full rotenburo-in-snow experience.';
const HOKKAIDO_BASELINE = 'A genuinely good onsen destination on its own terms, with the usual mix of indoor and outdoor baths.';

const BUDAPEST_PEAK = "Reliably cold enough outside for Széchenyi's outdoor pools to steam dramatically against the freezing air.";
const BUDAPEST_SHOULDER = 'Cold snaps are common enough this month for the steam effect to show up on many days.';
const BUDAPEST_BASELINE = 'The baths are the same year-round habit they always are — indoor and outdoor pools both running, Ottoman-era and modern alike.';

const CR_DRY = "Dry season — easy access to Arenal's springs and good conditions throughout.";
const CR_WET = 'Rainier conditions, though the springs themselves — several real, separate properties around La Fortuna — are unaffected by the weather outside.';
const CR_PEAK_WET = 'The wettest stretch of the year — heavier rain can make getting around La Fortuna less convenient, though the springs remain just as good.';

const TW_DRY = 'Dry, comfortable conditions for both Beitou and Jiaoxi.';
const TW_DAMP = 'Damper conditions, a real but modest dip from the dry months.';
const TW_TYPHOON = 'Typhoon season — a real risk of disrupted transport to Beitou or Jiaoxi, not just less comfortable weather.';

const MONTHLY: Record<string, string[]> = {
  // Jan Feb Mar Apr May Jun Jul Aug Sep Oct Nov Dec
  iceland: [ICELAND_PEAK, ICELAND_PEAK, ICELAND_PEAK, ICELAND_BASELINE, ICELAND_BASELINE, ICELAND_BASELINE, ICELAND_BASELINE, ICELAND_BASELINE, ICELAND_BUILDING, ICELAND_PEAK, ICELAND_PEAK, ICELAND_PEAK],
  hokkaido: [HOKKAIDO_PEAK, HOKKAIDO_PEAK, HOKKAIDO_PEAK, HOKKAIDO_BASELINE, HOKKAIDO_BASELINE, HOKKAIDO_BASELINE, HOKKAIDO_BASELINE, HOKKAIDO_BASELINE, HOKKAIDO_BASELINE, HOKKAIDO_BASELINE, HOKKAIDO_BUILDING, HOKKAIDO_PEAK],
  budapest: [BUDAPEST_PEAK, BUDAPEST_PEAK, BUDAPEST_SHOULDER, BUDAPEST_BASELINE, BUDAPEST_BASELINE, BUDAPEST_BASELINE, BUDAPEST_BASELINE, BUDAPEST_BASELINE, BUDAPEST_BASELINE, BUDAPEST_BASELINE, BUDAPEST_SHOULDER, BUDAPEST_PEAK],
  'costa-rica': [CR_DRY, CR_DRY, CR_DRY, CR_DRY, CR_WET, CR_WET, CR_WET, CR_WET, CR_PEAK_WET, CR_PEAK_WET, CR_WET, CR_DRY],
  taiwan: [TW_DAMP, TW_DAMP, TW_DRY, TW_DRY, TW_DAMP, TW_DAMP, TW_TYPHOON, TW_TYPHOON, TW_TYPHOON, TW_DRY, TW_DRY, TW_DAMP],
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
