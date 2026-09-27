import { readFileSync } from 'fs';
import { join } from 'path';
import { eq, inArray } from 'drizzle-orm';
import { drizzle as drizzlePostgres } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import { places, adminAuditLog } from '../src/lib/db/schema';
import { scorePlace } from '../src/lib/db/queries/places';
import { MONTH_NAMES } from '../src/lib/scoring/constants';

// mountaineering ("Mountaineering & Rock Climbing") batch 0: the six
// voice-lock samples approved with the user. Scores are decimal and
// derived from the blurb text (identical text -> one score, distinct
// text -> its own), per playbook §2; written as full 12-month
// scoreOverrides so they don't depend on the legacy integer curve.
const KEY = 'mountaineering';

interface Entry {
  overview: string;
  months: { score: number; text: string }[];
}

const m = (score: number, text: string) => ({ score, text });

const CHAMONIX_WINTER = `Winter closes the summer glacier routes, but this is real ski-mountaineering and ice-climbing season in the Vallée Blanche and gullies.`;
const CHAMONIX_PEAK = `Peak season — Mont Blanc’s Goûter route and the Chamonix aiguilles’ classic routes are all in full swing.`;
const NEPAL_WINTER = `Extreme winter cold and wind close the high peaks; not a realistic climbing month.`;
const NEPAL_MONSOON = `Monsoon snow loading makes the high peaks genuinely avalanche-prone.`;
const KILI_QUIET = `Within the quieter of the two dry windows — colder at the summit with a real chance of snow, but reliable trail conditions.`;
const CUSCO_WET = `Wet season — real avalanche and crevasse risk on top of poor visibility.`;
const CUSCO_PEAK = `Peak dry season — the best conditions of the year for Ausangate and the region’s other real objectives.`;
const CAPE_WIND = `Dry, but the Cape Doctor southeaster is at its fiercest — real wind and visibility risk.`;
const CAPE_EASING = `Still dry, with the summer wind starting to ease — one of the better windows.`;
const CAPE_WET = `Wet winter — the least reliable stretch of the year.`;
const CAPE_BEST = `Dry season returning, and the southeaster hasn’t picked up yet — one of the best windows of the year.`;
const CAPE_BUILDING = `Dry, but the Cape Doctor is building back toward its peak.`;
const JT_SUMMER = `Summer heat regularly tops 100°F — not a realistic climbing season.`;
const JT_COOL = `Cool, dry, prime conditions, though nights are cold.`;

const ENTRIES: Record<string, Entry> = {
  chamonix: {
    overview: `The birthplace of alpinism, built around Mont Blanc (4,808m) via the Goûter route. The real season is tied to hut staffing at the Refuge du Goûter — mandatory reservations, roughly late May through September — and to permafrost-thaw rockfall risk that closes the route outside that window. Winter doesn’t close the massif; it shifts the objective to ski mountaineering and ice climbing instead.`,
    months: [
      m(3.4, CHAMONIX_WINTER), m(3.4, CHAMONIX_WINTER), m(3.4, CHAMONIX_WINTER),
      m(3.9, `Still winter conditions; the Goûter hut hasn’t opened yet.`),
      m(6.8, `The Refuge du Goûter is opening for the season — an early, less crowded window on Mont Blanc’s normal route, conditions permitting.`),
      m(10, CHAMONIX_PEAK), m(10, CHAMONIX_PEAK), m(10, CHAMONIX_PEAK),
      m(9.3, `Still peak season, though permafrost-thaw rockfall risk is a real, growing concern late in the month.`),
      m(6.4, `The Goûter hut is closing for the season; conditions are becoming less reliable.`),
      m(2.8, `Winter conditions return; summer glacier routes are closed.`),
      m(2.8, `Winter conditions return; summer glacier routes are closed.`),
    ],
  },
  nepal: {
    overview: `Home to Everest, with the real summit window narrower than it looks — a jet-stream-driven calm spell that typically opens for just 5–10 days in mid-to-late May. Spring and autumn are the two real climbing seasons; winter’s extreme cold and the monsoon’s avalanche-prone snow close the high peaks the rest of the year, though lower trekking peaks like Island Peak have a wider window across both seasons.`,
    months: [
      m(1.8, NEPAL_WINTER), m(1.8, NEPAL_WINTER),
      m(6.3, `The spring season is building — trekking peaks like Island and Mera are workable, though the high 8,000m peaks are still early.`),
      m(8.7, `Spring climbing season is in full swing.`),
      m(10, `Peak season — the jet stream typically lifts off the summits for a narrow calm window, when most 8,000m summit pushes happen.`),
      m(4.2, `The monsoon is arriving; conditions are becoming less stable.`),
      m(1.9, NEPAL_MONSOON), m(1.9, NEPAL_MONSOON),
      m(7.2, `The monsoon is clearing; the autumn season is beginning.`),
      m(9.8, `Peak autumn season — reliably the most popular window for trekking peaks, with some 8,000m activity too.`),
      m(8.4, `Still a strong autumn window, cooling toward winter.`),
      m(3.1, `Winter is closing in fast.`),
    ],
  },
  tanzania: {
    overview: `Kilimanjaro (5,895m), Africa’s highest peak and one of the Seven Summits, is a high-altitude trek rather than technical climbing — no ropes needed on the standard routes. Longer routes like Lemosho have meaningfully higher summit success than the shorter, more crowded Marangu route. The two real dry windows are late June through October (the main season) and late December through mid-March (colder, quieter); April–May and November bring rains that make the trails a real slog.`,
    months: [
      m(7.1, KILI_QUIET), m(7.1, KILI_QUIET),
      m(5.8, `The quieter dry window is ending; rain is building toward the wetter months ahead.`),
      m(1.9, `The long rains — heavy, persistent, and a real slog underfoot.`),
      m(2.4, `The long rains are easing toward month’s end, but conditions are still wet underfoot.`),
      m(6.4, `The main dry season is building, though early month can still carry rain from the long rains’ tail.`),
      m(8.6, `Peak dry season — clear skies, though this is genuinely the coldest stretch at high camp and the summit.`),
      m(9.4, `Peak dry season, warmer than June–July, and the single busiest month on the mountain.`),
      m(9.2, `Still peak dry season and among the busiest months.`),
      m(8.5, `The main dry season is easing but still reliable.`),
      m(3.2, `The short rains — a real, if brief, wet stretch.`),
      m(5.9, `The short rains are easing and the quieter dry window is beginning by month’s end.`),
    ],
  },
  peru: {
    overview: `Real technical mountaineering exists here, centered on Ausangate (6,384m) — genuine glacier travel and a roped ice wall, not a walk-up. But it’s a secondary layer on Cusco’s dominant identity as a trekking hub, not Peru’s real climbing center — that’s Huaraz, a different region entirely. The dry season (May–September) is best for both.`,
    months: [
      m(2.2, CUSCO_WET), m(2.2, CUSCO_WET),
      m(5.7, `Conditions are improving as the wet season eases.`),
      m(6.9, `Approaching the dry season, increasingly reliable.`),
      m(8.1, `Dry season begins — the best conditions of the year for Ausangate and the region’s other real objectives.`),
      m(8.4, CUSCO_PEAK), m(8.4, CUSCO_PEAK), m(8.4, CUSCO_PEAK),
      m(7.8, `Still within the dry season, though it’s beginning to ease.`),
      m(5.9, `Conditions easing as the wet season approaches.`),
      m(5.9, `Conditions easing as the wet season approaches.`),
      m(2.6, `The wet season returns.`),
    ],
  },
  'cape-town': {
    overview: `Real, if niche, technical rock climbing on Table Mountain — over 200 documented routes, respected regionally but not a bucket-list destination. The complication: the dry season overlaps with the “Cape Doctor” southeaster, which can bring 30+ knot winds and zero visibility in exactly those months. The best windows are the shoulder seasons — spring and autumn — dry, but before or after the worst of the wind.`,
    months: [
      m(4.3, CAPE_WIND), m(4.3, CAPE_WIND),
      m(6.2, CAPE_EASING), m(6.2, CAPE_EASING),
      m(3.4, `Transitioning into the wet season.`),
      m(1.2, CAPE_WET), m(1.2, CAPE_WET),
      m(2.3, `Still wet, conditions slowly improving.`),
      m(6.6, CAPE_BEST), m(6.6, CAPE_BEST),
      m(4.5, CAPE_BUILDING), m(4.5, CAPE_BUILDING),
    ],
  },
  'joshua-tree': {
    overview: `One of the best-known rock climbing destinations in the US, with more than 8,000 routes and 2,000 boulder problems, known especially for traditional crack and slab climbing on abrasive granite. The season runs fall through spring; summer heat regularly tops 100°F. Raptor nesting closes some formations from late February through July, and campgrounds fill on weekends through the busy season.`,
    months: [
      m(8.4, `Cold nights and the occasional storm, but sunny days are still workable.`),
      m(9.1, `Cool, dry, and reliably good, with raptor-nesting closures starting on a few formations late in the month.`),
      m(9.5, `One of the two best months — mild temperatures and dry rock — though campgrounds fill on weekends and some formations are closed for nesting.`),
      m(8.8, `Still prime, though warming toward the end of the season; nesting closures continue.`),
      m(5.7, `Heat is building and the season is winding down.`),
      m(2.1, JT_SUMMER), m(2.1, JT_SUMMER), m(2.1, JT_SUMMER),
      m(4.8, `The heat is easing but still a real limiter.`),
      m(9.5, `Cooler weather returns — one of the two best months of the year — and campgrounds start filling again.`),
      m(9.0, JT_COOL), m(9.0, JT_COOL),
    ],
  },
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

  const ids = Object.keys(ENTRIES);
  const rows = await db.select().from(places).where(inArray(places.id, ids));
  const byId = new Map(rows.map((r) => [r.id, r]));

  for (const id of ids) {
    const row = byId.get(id);
    if (!row) { console.error(`${id}: not found`); process.exit(1); }
    const entry = ENTRIES[id];
    if (entry.months.length !== 12) { console.error(`${id}: months is not length 12`); process.exit(1); }

    const scoreOverridesBefore = (row.scoreOverrides as Record<string, Record<number, number>>) || {};
    const live = scorePlace(row).monthly[KEY];
    const override: Record<number, number> = {};
    entry.months.forEach((mo, i) => { override[i] = mo.score; });

    const patch = {
      sliderOverview: { ...(row.sliderOverview as Record<string, string>), [KEY]: entry.overview },
      sliderMonthlyWeather: { ...(row.sliderMonthlyWeather as Record<string, (string | null)[]>), [KEY]: entry.months.map((mo) => mo.text) },
      scoreOverrides: { ...scoreOverridesBefore, [KEY]: override },
    };

    console.log(`\n${row.name} (${id})`);
    entry.months.forEach((mo, i) => console.log(`  ${MONTH_NAMES[i].padEnd(10)} ${String(live[i]).padEnd(6)} -> ${mo.score}`));

    if (!dryRun) {
      const after = { ...row, ...patch };
      await db.transaction(async (tx) => {
        await tx.update(places).set({ ...patch, updatedAt: new Date() }).where(eq(places.id, id));
        await tx.insert(adminAuditLog).values({
          actorId: '00000000-0000-0000-0000-000000000000',
          entityType: 'destination',
          entityId: id,
          action: 'update',
          beforeValue: row,
          afterValue: after,
        });
      });
    }
  }

  console.log(dryRun ? '\n\ndry run — nothing written.' : '\n\ndone — written to sliderOverview / sliderMonthlyWeather / scoreOverrides.');
  process.exit(0);
}

main().catch((err) => { console.error(err); process.exit(1); });
