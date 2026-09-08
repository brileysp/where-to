import { readFileSync } from 'fs';
import { join } from 'path';
import { eq } from 'drizzle-orm';
import { drizzle as drizzlePostgres } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import { places, adminAuditLog } from '../src/lib/db/schema';
import { parseSliderCurve, rescaleCurve } from '../src/lib/scoring/curve';

/**
 * Saturation review for nationalParks (62 of 113 at a peak of 10) and
 * hiking (45 of 200), the last two badly-saturated sliders after
 * scenicLandscapes and landscapePhotography.
 *
 * These need judgement rather than a rule, so each is an ANCHOR SET: the
 * handful of destinations that define what a 10 means for that interest,
 * with everything else stepped down against them. That is the "anchor sets"
 * phase of the audit plan, done for the two interests where it pays most.
 *
 * nationalParks 10 — the park IS the destination and defines the category
 * worldwide. Note this is the raw score, separate from the US-centric
 * signatureTier notch applied earlier: that gates how much AUDIENCE weight
 * a claim earns, this is how good the park actually is.
 *
 * hiking 10 — a global trekking reference. Provence, Vermont, Sedona, Cape
 * Town, the Azores and Whistler were all sitting at 10 alongside Nepal and
 * the Dolomites; they are good walking, not world trekking.
 *
 * Only peak-10 destinations are in scope. Nothing is raised — the point is
 * removing 10s nobody claimed, not re-ranking the whole slider.
 */

type Plan = { key: string; targets: Record<number, string[]> };

const PLANS: Plan[] = [
  {
    key: 'nationalParks',
    targets: {
      10: [
        'yellowstone', 'yosemite', 'grandcanyon', 'torres-del-paine', 'denali-interior',
        'milford-sound-fiordland', 'banff', 'zion-bryce', 'sequoia-kings-canyon', 'kruger',
      ],
      9: [
        'glacier-waterton', 'arches-canyonlands', 'rocky-mountain', 'el-chalten', 'iceland',
        'great-smoky-mountains', 'olympic', 'redwood', 'north-cascades', 'dolomites',
        'snowdonia', 'lake-district', 'galapagos', 'tanzania', 'kenya', 'botswana',
      ],
      8: [
        'acadia', 'death-valley', 'joshua-tree', 'bend-crater-lake',
        'everglades', 'big-island', 'southeast-alaska', 'fjords', 'namibia', 'zambia',
        'zimbabwe', 'uganda', 'rwanda', 'costa-rica', 'ecuadorian-andes', 'nepal', 'bhutan',
        'croatia', 'canaries', 'taiwan', 'komodo', 'palawan', 'borneo', 'srilanka',
        'argentine-lake-district', 'tierra-del-fuego', 'queenstown', 'scottish-highlands-skye',
        'lapland', 'ethiopia',
      ],
      7: ['badlands-black-hills', 'cape-town', 'maui', 'uluru', 'kerala', 'colombian-caribbean'],
    },
  },
  {
    key: 'hiking',
    targets: {
      10: [
        'nepal', 'dolomites', 'torres-del-paine', 'el-chalten', 'chamonix', 'swissalps',
        'pakistan', 'ladakh',
      ],
      9: [
        'yosemite', 'zion-bryce', 'banff', 'rocky-mountain', 'glacier-waterton',
        'arches-canyonlands', 'sequoia-kings-canyon', 'north-cascades', 'olympic',
        'denali-interior', 'yellowstone', 'lake-district', 'snowdonia',
        'scottish-highlands-skye', 'faroe-islands', 'kyrgyzstan', 'bhutan', 'peru',
        'ecuadorian-andes', 'colombian-andes', 'chilean-lake-district',
        'argentine-lake-district', 'atacama', 'queenstown', 'marlborough-abel-tasman',
        'bend-crater-lake', 'ethiopia', 'tbilisi-caucasus',
      ],
      8: [
        'canaries', 'azores', 'cape-town', 'sedona', 'aspen',
        'whistler', 'joshua-tree', 'vermont', 'provence',
      ],
    },
  },
];

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
    const key = t.slice(0, i).trim();
    let value = t.slice(i + 1).trim();
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1);
    }
    out[key] = value;
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
  const { getAllScoredPlaces } = await import('../src/lib/db/queries/places');
  const { isSliderNA } = await import('../src/lib/scoring/destinations');
  const dryRun = process.argv.includes('--dry-run');
  const db = drizzlePostgres(postgres(env.DATABASE_URL, { prepare: false }));

  const rows = await db.select().from(places).where(eq(places.isPrimaryDestination, true));
  const byId = new Map(rows.map((r) => [r.id, r]));
  const scored = await getAllScoredPlaces();
  let grandTotal = 0;

  for (const plan of PLANS) {
    const KEY = plan.key;
    const inScope = scored
      .filter((d) => !isSliderNA(d, KEY) && Math.max(...(d.monthly[KEY] ?? [0])) >= 9.99)
      .map((d) => d.id);

    const assigned = new Map<string, number>();
    for (const [peak, ids] of Object.entries(plan.targets)) {
      for (const id of ids) {
        if (assigned.has(id)) { console.error(`${KEY}: ${id} assigned twice`); process.exit(1); }
        assigned.set(id, Number(peak));
      }
    }
    const missing = inScope.filter((id) => !assigned.has(id));
    const extra = [...assigned.keys()].filter((id) => !inScope.includes(id));
    if (missing.length || extra.length) {
      if (missing.length) console.error(`${KEY} unassigned (${missing.length}): ${missing.join(' ')}`);
      if (extra.length) console.error(`${KEY} assigned but not at peak 10 (${extra.length}): ${extra.join(' ')}`);
      process.exit(1);
    }

    let written = 0;
    const counts: Record<number, number> = {};
    for (const id of inScope) {
      const target = assigned.get(id)!;
      counts[target] = (counts[target] ?? 0) + 1;
      if (target >= 10) continue;

      const row = byId.get(id)!;
      const d = scored.find((x) => x.id === id)!;
      const floor = Math.min(...(d.monthly[KEY] ?? [0]));
      const rawCurve = (row.sliderCurves as Record<string, unknown>)[KEY];
      if (rawCurve === undefined) { console.error(`${id}: no ${KEY} curve`); process.exit(1); }

      const rescaled = rescaleCurve(parseSliderCurve(rawCurve), Math.min(floor, target), target);
      const sliderCurves = { ...(row.sliderCurves as Record<string, unknown>), [KEY]: rescaled };
      const authoredCurves = Array.from(new Set([...(row.authoredCurves ?? []), KEY]));
      const after = { ...row, sliderCurves, authoredCurves };

      if (dryRun) { written++; continue; }
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
      written++;
    }
    grandTotal += written;
    console.log(`${KEY}: ${inScope.length} at peak 10 -> ` + Object.entries(counts).sort((a, b) => Number(b[0]) - Number(a[0])).map(([k, v]) => `${k}:${v}`).join('  ') + `   (${written} reshaped)`);
  }

  console.log(dryRun ? `\ndry run — ${grandTotal} would change.` : `\ndone: ${grandTotal} reshaped.`);
  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
