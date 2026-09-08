import { readFileSync } from 'fs';
import { join } from 'path';
import { eq } from 'drizzle-orm';
import { drizzle as drizzlePostgres } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import { places, adminAuditLog } from '../src/lib/db/schema';
import { parseSliderCurve, rescaleCurve } from '../src/lib/scoring/curve';

/**
 * Authors the sunbathing scores that were never written, and clears the
 * N/A claims that were standing in for them.
 *
 * Fourteen destinations rendered a row of twelve zeroes for sunbathing.
 * Thirty-seven carried `sunbathing` in naSliders, which
 * NEVER_NA_SLIDERS in destinations.ts correctly refuses to honour. Both
 * facts were symptoms of the same thing: nobody had ever scored the
 * interest for these places, and "you can't sunbathe here" was doing duty
 * for "we haven't said."
 *
 * It isn't true. Napa has hot dry summers and a pool at every inn. The
 * Dolomites have sun terraces. The Atacama is among the sunniest places on
 * the planet, and Uluru sits in a desert with a resort pool. What these
 * places lack is a BEACH, which is a different interest.
 *
 * So: strip the dead N/A claims, and author a real curve for each of the
 * fourteen. Scores answer "how pleasant is lying in the sun here, at its
 * best" — sun reliability and somewhere to do it, not coastline. Curves
 * peak in local summer, with the two deserts peaking in their cooler
 * months instead, because 42C at Uluru in January is not lounging weather.
 */

type SunEdit = { id: string; anchors: { month: number; value: number; steepness?: number }[]; why: string };

const SUN: SunEdit[] = [
  {
    id: 'napa',
    anchors: [
      { month: 1, value: 2, steepness: 1 }, { month: 4, value: 4, steepness: 2 },
      { month: 6, value: 8, steepness: 2 }, { month: 9, value: 8, steepness: 1 },
      { month: 10, value: 5, steepness: 2 }, { month: 12, value: 2, steepness: 2 },
    ],
    why: 'hot rainless summers and a pool at every inn',
  },
  {
    id: 'dolomites',
    anchors: [
      { month: 1, value: 1, steepness: 1 }, { month: 5, value: 3, steepness: 2 },
      { month: 7, value: 6, steepness: 2 }, { month: 8, value: 6, steepness: 1 },
      { month: 9, value: 4, steepness: 2 }, { month: 11, value: 1, steepness: 2 },
    ],
    why: 'alpine sun terraces and hotel pools through the summer',
  },
  {
    id: 'atacama',
    anchors: [
      { month: 1, value: 7, steepness: 1 }, { month: 3, value: 6, steepness: 2 },
      { month: 6, value: 4, steepness: 2 }, { month: 8, value: 4, steepness: 1 },
      { month: 10, value: 6, steepness: 2 }, { month: 12, value: 7, steepness: 2 },
    ],
    why: 'the sunniest place on earth; lodge pools in San Pedro. Cold desert nights cap it',
  },
  {
    id: 'uluru',
    anchors: [
      { month: 1, value: 3, steepness: 2 }, { month: 3, value: 4, steepness: 2 },
      { month: 5, value: 7, steepness: 2 }, { month: 8, value: 7, steepness: 1 },
      { month: 9, value: 6, steepness: 2 }, { month: 11, value: 3, steepness: 2 },
    ],
    why: 'desert sun and a resort pool — peaks in the cooler months, since January is 42C',
  },
  {
    id: 'kyrgyzstan',
    anchors: [
      { month: 1, value: 0.5, steepness: 1 }, { month: 5, value: 3, steepness: 2 },
      { month: 7, value: 6, steepness: 2 }, { month: 8, value: 6, steepness: 1 },
      { month: 9, value: 3, steepness: 2 }, { month: 11, value: 0.5, steepness: 2 },
    ],
    why: 'Issyk-Kul is a genuine lake-beach resort region in July and August',
  },
  {
    id: 'north-cascades',
    anchors: [
      { month: 1, value: 0.5, steepness: 1 }, { month: 5, value: 2, steepness: 2 },
      { month: 7, value: 5, steepness: 2 }, { month: 8, value: 5, steepness: 1 },
      { month: 9, value: 3, steepness: 2 }, { month: 11, value: 0.5, steepness: 2 },
    ],
    why: 'a short, reliably dry, warm summer by the lakes',
  },
  {
    id: 'ladakh',
    anchors: [
      { month: 1, value: 0.5, steepness: 1 }, { month: 5, value: 3, steepness: 2 },
      { month: 7, value: 5, steepness: 2 }, { month: 8, value: 5, steepness: 1 },
      { month: 9, value: 3, steepness: 2 }, { month: 11, value: 0.5, steepness: 2 },
    ],
    why: 'fierce high-altitude sun in the short summer, thin air keeping it short of comfortable',
  },
  {
    id: 'mongolia',
    anchors: [
      { month: 1, value: 0.5, steepness: 1 }, { month: 5, value: 3, steepness: 2 },
      { month: 7, value: 5, steepness: 2 }, { month: 8, value: 5, steepness: 1 },
      { month: 9, value: 2, steepness: 2 }, { month: 11, value: 0.5, steepness: 2 },
    ],
    why: 'clear continental summers on the steppe',
  },
  {
    id: 'pakistan',
    anchors: [
      { month: 1, value: 1, steepness: 1 }, { month: 5, value: 3, steepness: 2 },
      { month: 7, value: 4, steepness: 2 }, { month: 8, value: 4, steepness: 1 },
      { month: 9, value: 3, steepness: 2 }, { month: 11, value: 1, steepness: 2 },
    ],
    why: 'northern summer sun, held down by conservative dress norms rather than by weather',
  },
  {
    id: 'tierra-del-fuego',
    anchors: [
      { month: 1, value: 2, steepness: 1 }, { month: 2, value: 2, steepness: 2 },
      { month: 4, value: 1, steepness: 2 }, { month: 10, value: 1, steepness: 1 },
      { month: 12, value: 2, steepness: 2 },
    ],
    why: 'long southern summer days, but wind and single-digit temperatures',
  },
  {
    id: 'greenland',
    anchors: [
      { month: 1, value: 0.5, steepness: 1 }, { month: 6, value: 2, steepness: 2 },
      { month: 7, value: 2, steepness: 1 }, { month: 9, value: 1, steepness: 2 },
      { month: 12, value: 0.5, steepness: 2 },
    ],
    why: 'the midnight sun is real; the temperature is not',
  },
  {
    id: 'churchill',
    anchors: [
      { month: 1, value: 0.5, steepness: 1 }, { month: 6, value: 2, steepness: 2 },
      { month: 7, value: 2, steepness: 1 }, { month: 9, value: 1, steepness: 2 },
      { month: 12, value: 0.5, steepness: 2 },
    ],
    why: 'brief sub-Arctic summer',
  },
  {
    id: 'svalbard',
    anchors: [
      { month: 1, value: 0.5, steepness: 1 }, { month: 6, value: 1.5, steepness: 2 },
      { month: 7, value: 1.5, steepness: 1 }, { month: 9, value: 1, steepness: 2 },
      { month: 12, value: 0.5, steepness: 2 },
    ],
    why: '24-hour daylight at 78 degrees north, and never warm',
  },
  {
    id: 'antarctica',
    anchors: [
      { month: 1, value: 1.5, steepness: 1 }, { month: 2, value: 1.5, steepness: 2 },
      { month: 4, value: 0.5, steepness: 2 }, { month: 10, value: 0.5, steepness: 1 },
      { month: 12, value: 1.5, steepness: 2 },
    ],
    why: 'people genuinely do sit out on deck in the austral summer sun',
  },
];

/**
 * Sunbathing peaks lowered by the since-removed "you sunbathe on the beach
 * you swim from" rule in audit-content-outliers.ts. Both are Mediterranean
 * summers with pools and terraces everywhere; neither deserved a cut for
 * having rocky coves.
 */
const REVERTS: { id: string; peak: number; why: string }[] = [
  { id: 'provence', peak: 8, why: 'reverting a cut made on a false premise — Provencal July' },
  { id: 'tuscany', peak: 7, why: 'reverting a cut made on a false premise — Tuscan summer' },
];

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

const KEY = 'sunbathing';

async function main() {
  const env = loadDotEnvLocal();
  if (!env.DATABASE_URL) {
    console.error('No DATABASE_URL in .env.local — refusing to run against the PGlite fallback.');
    process.exit(1);
  }
  process.env.DATABASE_URL = env.DATABASE_URL;
  // Dynamic, after the env is set — see review-scenic-saturation.ts.
  const { getAllScoredPlaces } = await import('../src/lib/db/queries/places');
  const dryRun = process.argv.includes('--dry-run');
  const db = drizzlePostgres(postgres(env.DATABASE_URL, { prepare: false }));

  const rows = await db.select().from(places).where(eq(places.isPrimaryDestination, true));
  // Mutable, patched at apply time — several destinations take both a curve
  // and an naSliders edit.
  const byId = new Map(rows.map((r) => [r.id, { ...r }]));
  const scored = await getAllScoredPlaces();

  const apply = async (id: string, patch: Record<string, unknown>, label: string) => {
    const row = byId.get(id);
    if (!row) { console.error(`${id}: not a primary destination`); process.exit(1); }
    const after = { ...row, ...patch };
    console.log(`  ${id.padEnd(20)} ${label}`);
    if (!dryRun) {
      await db.transaction(async (tx) => {
        await tx.update(places)
          .set({ ...(patch as Partial<typeof places.$inferInsert>), updatedAt: new Date() })
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
    byId.set(id, after as typeof row);
  };

  console.log('Authoring sunbathing curves:');
  for (const e of SUN) {
    const row = byId.get(e.id)!;
    const curve = parseSliderCurve({ anchors: e.anchors });
    const peak = Math.max(...e.anchors.map((a) => a.value));
    await apply(e.id, {
      sliderCurves: { ...(row.sliderCurves as Record<string, unknown>), [KEY]: curve },
      authoredCurves: Array.from(new Set([...(row.authoredCurves ?? []), KEY])),
    }, `peak ${peak} — ${e.why}`);
  }

  console.log('\nReverting cuts made on the beach premise:');
  for (const r of REVERTS) {
    const row = byId.get(r.id)!;
    const monthly = scored.find((x) => x.id === r.id)!.monthly[KEY] ?? [];
    const raw = (row.sliderCurves as Record<string, unknown>)[KEY];
    if (raw === undefined) { console.error(`${r.id}: no ${KEY} curve`); process.exit(1); }
    const rescaled = rescaleCurve(parseSliderCurve(raw), Math.min(...monthly), r.peak);
    await apply(r.id, {
      sliderCurves: { ...(row.sliderCurves as Record<string, unknown>), [KEY]: rescaled },
      authoredCurves: Array.from(new Set([...(row.authoredCurves ?? []), KEY])),
    }, `${Math.max(...monthly).toFixed(0)} -> ${r.peak} — ${r.why}`);
  }

  console.log('\nClearing dead sunbathing N/A claims:');
  let cleared = 0;
  for (const row of [...byId.values()]) {
    if (!(row.naSliders ?? []).includes(KEY)) continue;
    await apply(row.id, { naSliders: (row.naSliders ?? []).filter((k) => k !== KEY) }, 'naSliders -= sunbathing');
    cleared++;
  }

  console.log(dryRun ? `\ndry run — ${SUN.length} curves, ${REVERTS.length} reverts, ${cleared} N/A claims cleared.`
    : `\ndone: ${SUN.length} curves authored, ${REVERTS.length} reverted, ${cleared} dead N/A claims cleared.`);
  process.exit(0);
}

main().catch((err) => { console.error(err); process.exit(1); });
