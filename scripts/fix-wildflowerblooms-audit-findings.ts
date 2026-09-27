import { readFileSync } from 'fs';
import { join } from 'path';
import { eq } from 'drizzle-orm';
import { drizzle as drizzlePostgres } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import { places, adminAuditLog } from '../src/lib/db/schema';

const KEY = 'wildflowerBlooms';

type Event = { label: string; weight: number; months: Record<number, number> };

// Cross-checked all 40 wildflowerBlooms destinations (three parallel
// research passes) against real bloom-calendar sources — tourism boards,
// national parks, botanical references. 29 destinations matched real data
// exactly; these 11 needed a fix.
const EVENTS: Record<string, Event> = {
  // Overview already correctly says "typically May into June" for tajinaste
  // rojo, but the event itself peaked in March with no June at all —
  // a real internal contradiction. Real bloom: late Apr-early Jun, most
  // spectacular in May.
  canaries: { label: 'Spring bloom on volcanic slopes', weight: 6, months: { 4: 0.6, 5: 1, 6: 0.6 } },
  // Faial hydrangeas ramp up in June, don't hit full bloom until July.
  azores: { label: 'Hydrangea bloom season', weight: 2, months: { 6: 0.6, 7: 1, 8: 1 } },
  // Fields are typically already harvested by early August — August was
  // equal-weighted to June, overstating how much is left to see by then.
  provence: { label: 'Bloom season', weight: 7, months: { 6: 0.6, 7: 1, 8: 0.25 } },
  // Meskel daisies persist past the Sep 27 festival into early October.
  ethiopia: { label: 'Meskel daisy bloom', weight: 3, months: { 9: 1, 10: 0.35 } },
  // August is as important as July for Song-Köl/Jyrgalan, not absent.
  kyrgyzstan: { label: 'Bloom season', weight: 3, months: { 6: 0.5, 7: 0.85, 8: 0.85 } },
  // Pōhutukawa blooming starts in November, not just December.
  'north-island': { label: 'Pōhutukawa bloom', weight: 4, months: { 11: 0.35, 12: 1, 1: 0.7 } },
  // The overview's own named species (waratah, flannel flower) don't peak
  // until Nov-Jan — September was equal-weighted to the true Nov/Dec peak,
  // overstating early-spring intensity.
  tasmania: { label: 'Austral spring bloom', weight: 7, months: { 9: 0.5, 10: 0.7, 11: 1, 12: 1, 1: 0.6 } },
  // "5 to 8 years" should be "5 to 7 years" (fixed in OVERVIEWS below), and
  // the bloom can extend into November, not just through October.
  atacama: { label: 'Desierto Florido (irregular)', weight: 3, months: { 8: 0.3, 9: 0.6, 10: 1, 11: 0.3 } },
  // Real peak is mid-July through mid-August; June (snow often still on
  // Logan Pass) and September ("pretty sparse... nothing like July") were
  // both equal-weighted to the true peak.
  'glacier-waterton': { label: 'Alpine wildflower season', weight: 4, months: { 6: 0.5, 7: 1, 8: 1, 9: 0.4 } },
};

const OVERVIEWS: Record<string, string> = {
  // NPS's own four documented Death Valley superblooms are 1998, 2005,
  // 2016, and 2026 — 2019's famous superbloom was Walker Canyon/Lake
  // Elsinore in Southern California, a different location entirely, not
  // Death Valley.
  'death-valley': "Death Valley has a modest wildflower bloom most years at lower elevations, typically February into April — but the true \"superbloom,\" carpeting the valley floor, is a rare, exceptional event tied to unusually wet winters. NPS has documented only four: 1998, 2005, 2016, and 2026. Most years fall well short of that.",
  atacama: "In most years the Atacama — the driest desert on Earth — stays exactly that: bone dry, no flowers. Roughly once every 5 to 7 years, and increasingly unpredictable as rainfall patterns shift, an unusually wet winter triggers the Desierto Florido: dormant seeds burst into bloom across otherwise barren ground, carpeting stretches of desert in pink, purple, and yellow for a few weeks. There's no way to predict a specific year in advance — a bloom is typically only confirmed once it's already underway.",
  // The almond festival is held in Son Servera, not Consell.
  mallorca: "Roughly 7 million almond trees blanket the island, and the bloom — the \"snow of Mallorca\" — is a real, if brief, annual event: two to three weeks, typically late January into February, shifting a little with the winter weather. The Fira de la Flor d'Ametler in Son Servera is the island's own festival built around it.",
};

const MONTHLY: Record<string, Record<number, string>> = {
  canaries: {
    3: 'Outside spring bloom season.',
    6: "Spring bloom season continuing into early summer, including Tenerife's tajinaste rojo.",
  },
  ethiopia: {
    10: "Meskel daisies linger in places into early October, past the festival's official date, though the display is thinning.",
  },
  kyrgyzstan: {
    7: 'Peak alpine wildflower season around Song-Köl and Jyrgalan, continuing into August.',
    8: 'Still peak alpine wildflower season around Song-Köl and Jyrgalan — often just as good as July.',
  },
  'north-island': {
    11: 'Pōhutukawa beginning to bloom, building toward the December peak.',
  },
  tasmania: {
    9: 'Austral spring bloom beginning — the display is still light this early.',
    10: 'Spring bloom building toward peak.',
    11: 'Peak bloom — waratahs and flannel flowers coming into their own.',
    12: 'Peak bloom continues, timed to the southern summer.',
    1: 'The tail of the season — waratahs and summer alpine blooms still present in many years.',
  },
  'death-valley': {
    3: 'The best of the typical annual bloom — again, a genuine superbloom (like 1998, 2005, 2016, or 2026) is rare and not something to expect.',
  },
  atacama: {
    10: 'The most likely month for the Desierto Florido in a bloom year, but this remains a rare event, roughly once every 5-7 years and increasingly unpredictable. Check current reports before planning around it.',
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
  process.env.DATABASE_URL = env.DATABASE_URL;
  const { toScoringPlace } = await import('../src/lib/db/queries/places');
  const { deriveDestinationScores } = await import('../src/lib/scoring/destinations');
  const { fitMonthlyToCurve } = await import('../src/lib/scoring/fitCurve');
  const dryRun = process.argv.includes('--dry-run');
  const db = drizzlePostgres(postgres(env.DATABASE_URL, { prepare: false }));

  const ids = new Set([...Object.keys(EVENTS), ...Object.keys(OVERVIEWS), ...Object.keys(MONTHLY)]);
  for (const id of ids) {
    const [row] = await db.select().from(places).where(eq(places.id, id));
    if (!row) { console.error(`${id}: not found`); process.exit(1); }

    const patch: Record<string, unknown> = {};
    if (EVENTS[id]) {
      patch.sliderEvents = { ...(row.sliderEvents as Record<string, unknown>), [KEY]: [EVENTS[id]] };
    }
    if (OVERVIEWS[id]) {
      patch.sliderOverview = { ...(row.sliderOverview as Record<string, string>), [KEY]: OVERVIEWS[id] };
    }
    if (MONTHLY[id]) {
      const existing = ((row.sliderMonthlyWeather as Record<string, (string | null)[]>)?.[KEY] ?? new Array(12).fill(null)).slice();
      for (const [idx1, text] of Object.entries(MONTHLY[id])) existing[Number(idx1) - 1] = text;
      patch.sliderMonthlyWeather = { ...(row.sliderMonthlyWeather as Record<string, unknown>), [KEY]: existing };
    }

    let monthly: number[] | undefined;
    if (patch.sliderEvents) {
      const scoringRow = { ...row, ...patch };
      const scoring = toScoringPlace(scoringRow as typeof row);
      monthly = deriveDestinationScores(scoring, { skipHazards: true }).monthly[KEY];
      const fit = fitMonthlyToCurve(monthly, { maxSteepness: 4, errorTolerance: 0.5 });
      patch.sliderCurves = { ...(row.sliderCurves as Record<string, unknown>), [KEY]: fit.curve };
    }

    console.log(`${id}${monthly ? `: [${monthly.map((v) => v.toFixed(0)).join(',')}] peak=${Math.max(...monthly)}` : ' (content-only)'}`);

    if (!dryRun) {
      const afterRow = { ...row, ...patch };
      await db.transaction(async (tx) => {
        await tx.update(places).set({ ...patch, updatedAt: new Date() }).where(eq(places.id, id));
        await tx.insert(adminAuditLog).values({
          actorId: '00000000-0000-0000-0000-000000000000', entityType: 'destination', entityId: id,
          action: 'update', beforeValue: row, afterValue: afterRow,
        });
      });
    }
  }
  console.log(dryRun ? '\ndry run — nothing written.' : '\ndone.');
  process.exit(0);
}

main().catch((err) => { console.error(err); process.exit(1); });
