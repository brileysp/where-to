import { readFileSync } from 'fs';
import { join } from 'path';
import { eq } from 'drizzle-orm';
import { drizzle as drizzlePostgres } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import { places, adminAuditLog } from '../src/lib/db/schema';
import { parseSliderCurve, rescaleCurve } from '../src/lib/scoring/curve';

/**
 * Brings the catalogue down to the ceilings declared in
 * src/lib/scoring/anchors.ts.
 *
 * anchors.ts says which destinations may hold a 10. This says where the
 * ones that shouldn't go instead — a real ladder rather than a blanket
 * demotion to 9, because moving 200 destinations from a meaningless 10 to a
 * meaningless 9 is not progress.
 *
 * Only destinations currently at a peak of 10 are in scope, and nothing is
 * ever raised. The seasonal shape and floor of each curve are preserved;
 * only the ceiling moves (see rescaleCurve).
 *
 * IMPORTANT — the stale-snapshot bug this script exists partly to fix:
 * review-parks-hiking-saturation.ts wrote both of its sliders from ONE
 * snapshot of the rows taken at startup. For any destination appearing in
 * both plans, the second write rebuilt sliderCurves and authoredCurves from
 * that stale row and silently discarded the first — which is why 17 of the
 * 52 nationalParks reshapes never survived. Here every write updates the
 * in-memory row, so later sliders build on earlier ones.
 */

type Ladder = Record<number, string[]>;

const LADDERS: Record<string, Ladder> = {
  wildlifeViewing: {
    9: ['denali-interior', 'southeast-alaska', 'gbr', 'rajaampat', 'komodo', 'zimbabwe', 'ethiopia'],
    8: ['nova-scotia', 'vancouver-island', 'monterey-big-sur', 'tierra-del-fuego', 'torres-del-paine'],
  },
  birding: {
    9: ['tanzania', 'botswana', 'ethiopia', 'srilanka', 'antarctica'],
    8: ['bhutan', 'rwanda', 'everglades'],
  },
  safari: {
    8: ['srilanka'],
    7: ['ethiopia'],
  },
  whaleWatching: {
    9: ['big-island', 'cape-town', 'cape-cod-islands', 'srilanka', 'lofoten', 'churchill'],
    8: ['canaries', 'punta-cana', 'tierra-del-fuego'],
  },
  nationalParks: {
    9: ['lake-district', 'north-cascades', 'olympic', 'arches-canyonlands', 'rocky-mountain', 'glacier-waterton', 'snowdonia'],
    8: ['bend-crater-lake', 'ethiopia', 'joshua-tree', 'canaries', 'argentine-lake-district', 'bhutan', 'queenstown', 'scottish-highlands-skye', 'ecuadorian-andes'],
    7: ['cape-town'],
  },
  campingBackcountry: {
    9: ['iceland', 'tasmania', 'kyrgyzstan', 'olympic', 'ladakh', 'pakistan', 'milford-sound-fiordland', 'botswana', 'namibia', 'tierra-del-fuego'],
    8: ['arches-canyonlands', 'zion-bryce', 'rocky-mountain', 'grandcanyon', 'redwood', 'joshua-tree', 'death-valley', 'great-smoky-mountains', 'badlands-black-hills', 'jordan', 'chilean-lake-district', 'argentine-lake-district', 'tbilisi-caucasus', 'pantanal'],
  },
  geologyVolcanoes: {
    9: ['santorini', 'azores', 'zion-bryce', 'arches-canyonlands', 'death-valley', 'belfast-giants-causeway', 'guilin-yangshuo', 'sedona', 'hokkaido', 'jordan'],
    8: ['namibia', 'badlands-black-hills', 'uluru', 'chilean-lake-district', 'ecuadorian-andes', 'nicaragua', 'palawan', 'yosemite'],
    7: ['amalfi', 'bali', 'vietnam'],
  },
  mountaineering: {
    9: ['torres-del-paine', 'peru', 'north-cascades', 'kyrgyzstan', 'joshua-tree', 'ecuadorian-andes'],
    8: ['tanzania', 'ladakh', 'tbilisi-caucasus'],
  },
  cyclingRoad: {
    9: ['bend-crater-lake', 'copenhagen'],
    8: ['amsterdam', 'guilin-yangshuo'],
  },
  mountainBiking: {
    9: ['snowdonia', 'dolomites', 'banff', 'scottish-highlands-skye'],
    8: ['ladakh', 'great-smoky-mountains'],
  },
  skiingSnowboarding: {
    9: ['banff', 'queenstown', 'argentine-lake-district'],
    8: ['vermont'],
  },
  diving: {
    9: ['thailand', 'palawan', 'rivieramaya', 'okinawa'],
    8: ['borabora', 'seychelles'],
  },
  adventureSports: {
    9: ['yosemite', 'el-chalten', 'banff', 'torres-del-paine', 'iceland', 'pakistan', 'ladakh', 'ecuadorian-andes', 'chilean-lake-district'],
    8: ['joshua-tree', 'mongolia', 'arches-canyonlands', 'zion-bryce', 'glacier-waterton', 'papua-new-guinea', 'guilin-yangshuo', 'nicaragua'],
  },
  museumsArt: {
    9: ['venice', 'prague', 'barcelona', 'istanbul', 'egypt', 'tokyo-kyoto', 'beijing'],
    8: ['peru', 'rajasthan-golden-triangle', 'uzbekistan', 'luangprabang'],
  },
  architecture: {
    9: ['london', 'egypt', 'bagan', 'rajasthan-golden-triangle', 'budapest', 'morocco', 'havana', 'edinburgh', 'quebec-city', 'buenosaires', 'mexicocity', 'athens'],
    8: ['peru', 'jordan', 'bhutan', 'bangkok', 'tuscany', 'amalfi', 'san-miguel-guanajuato'],
  },
  festivals: {
    9: ['quebec-city', 'san-miguel-guanajuato', 'taiwan'],
    8: ['lapland'],
  },
  streetFood: {
    9: ['chiang-mai', 'thailand', 'tokyo-kyoto', 'beijing', 'rajasthan-golden-triangle', 'sicily', 'basque-country'],
    8: ['nyc', 'new-orleans', 'andalucia', 'bali'],
  },
  fineDining: {
    9: ['rome', 'lisbon', 'singapore', 'provence', 'tuscany', 'napa'],
    8: ['seoul', 'oaxaca', 'mendoza', 'amalfi'],
  },
  beachesSwimming: {
    9: ['rajaampat', 'rivieramaya', 'komodo'],
  },
  sunbathing: {
    9: ['seychelles', 'mauritius', 'mallorca', 'sardinia', 'croatia', 'santorini', 'nice-riviera', 'amalfi', 'thailand', 'fiji', 'jamaica', 'puerto-rico'],
    8: ['gbr', 'cape-town', 'colombian-caribbean', 'tanzania', 'maui', 'belize', 'okinawa', 'rio', 'palawan', 'bali', 'sydney'],
  },
  luxuryHotels: {
    9: ['atacama', 'nice-riviera', 'napa', 'amalfi'],
  },
  roadtrip: {
    9: ['lofoten', 'north-island', 'uluru', 'morocco', 'atacama', 'amalfi', 'tuscany', 'provence', 'vermont', 'bavaria-munich', 'ladakh', 'maui'],
    8: ['grandcanyon', 'yosemite', 'north-cascades', 'jordan', 'denali-interior', 'arches-canyonlands', 'yellowstone', 'badlands-black-hills', 'uyuni', 'kruger'],
  },
};

function loadDotEnvLocal(): Record<string, string> {
  const out: Record<string, string> = {};
  let raw: string;
  try {
    raw = readFileSync(join(__dirname, '..', '.env.local'), 'utf8');
  } catch {
    return out;
  }
  for (const line of raw.split('\n')) {
    const t = line.trim();
    if (!t || t.startsWith('#')) continue;
    const i = t.indexOf('=');
    if (i === -1) continue;
    let value = t.slice(i + 1).trim();
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1);
    }
    out[t.slice(0, i).trim()] = value;
  }
  return out;
}

async function main() {
  const env = loadDotEnvLocal();
  if (!env.DATABASE_URL) {
    console.error('No DATABASE_URL in .env.local — refusing to run against the PGlite fallback.');
    process.exit(1);
  }
  process.env.DATABASE_URL = env.DATABASE_URL;
  // Dynamic, after the env is set — see review-scenic-saturation.ts.
  const { getAllScoredPlaces } = await import('../src/lib/db/queries/places');
  const { isSliderNA } = await import('../src/lib/scoring/destinations');
  const { INTEREST_ANCHORS } = await import('../src/lib/scoring/anchors');
  const dryRun = process.argv.includes('--dry-run');
  const db = drizzlePostgres(postgres(env.DATABASE_URL, { prepare: false }));

  const rows = await db.select().from(places).where(eq(places.isPrimaryDestination, true));
  // Mutable: each write below updates this map so a later slider's write
  // carries the earlier one's curves rather than clobbering them.
  const byId = new Map(rows.map((r) => [r.id, { ...r }]));
  const scored = await getAllScoredPlaces();

  // Validate every ladder against the live OVER set before writing anything.
  const work: { key: string; id: string; target: number }[] = [];
  let invalid = false;
  for (const [key, ladder] of Object.entries(LADDERS)) {
    const anchor = INTEREST_ANCHORS[key];
    if (!anchor) { console.error(`${key}: no anchor set in anchors.ts`); invalid = true; continue; }
    const anchorSet = new Set(anchor.ten);
    const over = scored
      .filter((d) => !isSliderNA(d, key) && Math.max(...(d.monthly[key] ?? [0])) >= 9.99 && !anchorSet.has(d.id))
      .map((d) => d.id);

    const assigned = new Map<string, number>();
    for (const [target, list] of Object.entries(ladder)) {
      for (const id of list) {
        if (assigned.has(id)) { console.error(`${key}: ${id} appears twice in the ladder`); invalid = true; }
        assigned.set(id, Number(target));
      }
    }
    const missing = over.filter((id) => !assigned.has(id));
    const extra = [...assigned.keys()].filter((id) => !over.includes(id));
    if (missing.length) { console.error(`${key}: over 10 but unassigned (${missing.length}): ${missing.join(' ')}`); invalid = true; }
    if (extra.length) { console.error(`${key}: assigned but not over (${extra.length}): ${extra.join(' ')}`); invalid = true; }

    for (const id of over) work.push({ key, id, target: assigned.get(id)! });
  }
  if (invalid) { console.error('\nRefusing to write — fix the ladders above.'); process.exit(1); }

  const counts: Record<string, Record<number, number>> = {};
  let written = 0;
  for (const { key, id, target } of work) {
    const row = byId.get(id);
    if (!row) { console.error(`${id}: not a primary destination`); process.exit(1); }
    const d = scored.find((x) => x.id === id)!;
    const floor = Math.min(...(d.monthly[key] ?? [0]));
    const rawCurve = (row.sliderCurves as Record<string, unknown>)[key];
    if (rawCurve === undefined) { console.error(`${id}: no ${key} curve`); process.exit(1); }

    const rescaled = rescaleCurve(parseSliderCurve(rawCurve), Math.min(floor, target), target);
    const sliderCurves = { ...(row.sliderCurves as Record<string, unknown>), [key]: rescaled };
    const authoredCurves = Array.from(new Set([...(row.authoredCurves ?? []), key]));
    const after = { ...row, sliderCurves, authoredCurves };

    (counts[key] ??= {})[target] = ((counts[key] ??= {})[target] ?? 0) + 1;

    if (!dryRun) {
      await db.transaction(async (tx) => {
        await tx
          .update(places)
          .set({ sliderCurves: sliderCurves as typeof places.$inferInsert.sliderCurves, authoredCurves, updatedAt: new Date() })
          .where(eq(places.id, id));
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
    // The whole point — later sliders read this, not the startup snapshot.
    byId.set(id, { ...row, sliderCurves: sliderCurves as typeof row.sliderCurves, authoredCurves });
    written++;
  }

  for (const [key, c] of Object.entries(counts)) {
    const kept = INTEREST_ANCHORS[key]!.ten.length;
    console.log(
      `${key.padEnd(22)} ${kept} kept at 10, demoted -> ` +
        Object.entries(c).sort((a, b) => Number(b[0]) - Number(a[0])).map(([k, v]) => `${k}:${v}`).join('  '),
    );
  }
  console.log(dryRun ? `\ndry run — ${written} would change.` : `\ndone: ${written} reshaped.`);
  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
