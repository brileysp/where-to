// 22 Oct 2026: makes the Beaches & Swimming flags agree with the coast rule (owner, 22 Oct): a place scored for surfing needs a beach score,
// and a place too far from the coast for surfing is too far for a beach.
//  - ADD: 14 places scored for surfing, plus 4 coastal places scored for diving, get Beaches switched on with a first-draft curve (no text yet).
//  - REMOVE: 24 inland places lose Beaches (N/A with a stored reason); their beach text and drafted columns are backed up and removed.
// Polar diving-only places (Antarctica, Svalbard, Greenland, Tierra del Fuego, Churchill) and Pakistan stay N/A; so do the three lake-only diving places.
// Copenhagen and Acadia stay (coastal, no surf). A DRY RUN unless --apply. Usage: PLACE_ROWS_SNAPSHOT=1 npx tsx scripts/beach-coast-consistency-oct22.ts [--apply]
import { readFileSync, writeFileSync } from 'fs';
import { join } from 'path';
for (const line of readFileSync(join(__dirname, '..', '.env.local'), 'utf8').split('\n')) { const t = line.trim(); if (!t || t.startsWith('#')) continue; const i = t.indexOf('='); if (i === -1) continue; let v = t.slice(i + 1).trim(); if (/^["'].*["']$/.test(v)) v = v.slice(1, -1); if (process.env[t.slice(0, i).trim()] === undefined) process.env[t.slice(0, i).trim()] = v; }

type A = [month: number, value: number, steepness: number];
const ADD: Record<string, { why: string; anchors: A[] }> = {
  iceland: { why: 'black-sand beaches and geothermal pools; cold sea', anchors: [[1, 0.5, 1], [5, 1, 2], [6, 2, 2], [8, 2, 1], [9, 1, 2], [12, 0.5, 2]] },
  edinburgh: { why: 'Portobello and North Berwick in summer', anchors: [[1, 0.5, 1], [5, 2, 2], [6, 3.5, 2], [8, 3.5, 1], [9, 2, 2], [11, 0.5, 2]] },
  fjords: { why: 'a few sandy coves; cold water', anchors: [[1, 0.5, 1], [5, 1.5, 2], [6, 2, 2], [8, 2, 1], [9, 1, 2], [11, 0.5, 2]] },
  'southeast-alaska': { why: 'wild beaches, no swimming', anchors: [[1, 0.5, 1], [6, 1, 2], [8, 1, 1], [10, 0.5, 2]] },
  falklands: { why: 'white-sand penguin beaches in austral summer, cold sea', anchors: [[1, 1.5, 1], [2, 1.5, 1], [4, 0.5, 2], [10, 0.5, 1], [12, 1.5, 2]] },
  rome: { why: 'Ostia, Fregene and Sperlonga in summer', anchors: [[1, 0.5, 1], [4, 1.5, 2], [5, 3, 2], [6, 5, 2], [9, 5, 1], [10, 3, 2], [11, 0.5, 2]] },
  lofoten: { why: 'white-sand Arctic beaches in the summer light', anchors: [[1, 0.5, 1], [5, 1, 2], [6, 2.5, 2], [8, 2.5, 1], [9, 1, 2], [11, 0.5, 2]] },
  oaxaca: { why: 'Huatulco bays, Mazunte, Zipolite and Puerto Escondido; best in the dry season', anchors: [[1, 7.5, 1], [4, 7.5, 1], [5, 6, 2], [6, 4.5, 2], [9, 4, 1], [10, 5.5, 2], [11, 7, 2], [12, 7.5, 2]] },
  namibia: { why: 'Swakopmund and the Skeleton Coast; cold Benguela water', anchors: [[1, 2.5, 1], [3, 2.5, 1], [5, 1.5, 2], [8, 1, 1], [10, 1.5, 2], [12, 2.5, 2]] },
  seoul: { why: 'Incheon beaches and the east coast; crowded summer season', anchors: [[1, 0.5, 1], [5, 1, 2], [6, 2, 2], [7, 2.5, 1], [8, 3, 1], [9, 1.5, 2], [11, 0.5, 2]] },
  nyc: { why: 'Rockaway, Coney Island and Jones Beach', anchors: [[1, 0.5, 1], [5, 2, 2], [6, 4.5, 2], [7, 5.5, 1], [8, 5.5, 1], [9, 4.5, 2], [10, 1.5, 2], [11, 0.5, 2]] },
  napa: { why: 'the Sonoma Coast: wild, cold, not for swimming', anchors: [[1, 0.5, 1], [5, 1, 2], [7, 2, 2], [9, 2.5, 1], [10, 1, 2], [12, 0.5, 2]] },
  'faroe-islands': { why: 'a handful of small black-sand beaches, cold sea', anchors: [[1, 0.5, 1], [6, 0.5, 2], [8, 0.5, 1], [12, 0.5, 2]] },
  amsterdam: { why: 'Zandvoort and the Dutch coast', anchors: [[1, 0.5, 1], [5, 1.5, 2], [6, 3, 2], [7, 4, 1], [8, 4, 1], [9, 2, 2], [10, 0.5, 2]] },
  whistler: { why: 'Vancouver city beaches and mountain lakes in summer', anchors: [[1, 0.5, 1], [5, 1.5, 2], [6, 3, 2], [7, 4.5, 1], [8, 4.5, 1], [9, 2.5, 2], [10, 0.5, 2]] },
  angkor: { why: 'Koh Rong, Sihanoukville and Kep in the dry season', anchors: [[1, 6, 1], [3, 5.5, 1], [5, 3, 2], [6, 2, 2], [9, 2, 1], [10, 3, 2], [11, 5.5, 2], [12, 6, 2]] },
  bagan: { why: 'Ngapali and Ngwe Saung in the dry season', anchors: [[1, 6, 1], [3, 6, 1], [5, 3, 2], [6, 1.5, 2], [9, 1.5, 1], [10, 3, 2], [11, 5.5, 2], [12, 6, 2]] },
  'milford-sound-fiordland': { why: 'a few remote beaches, cold sea', anchors: [[1, 1.5, 1], [2, 1.5, 1], [4, 0.5, 2], [10, 0.5, 1], [12, 1.5, 2]] },
};
const REMOVE = ['berlin', 'bhutan', 'zambia', 'great-smoky-mountains', 'lake-district', 'nepal', 'luangprabang', 'yosemite', 'chilean-lake-district', 'rioja', 'sedona', 'black-forest', 'badlands-black-hills', 'chiang-mai', 'tbilisi-caucasus', 'queenstown', 'sequoia-kings-canyon', 'budapest', 'zion-bryce', 'zimbabwe', 'cotswolds', 'botswana', 'pantanal', 'peru'];
const KEY = 'beachesSwimming';
const REASON = 'Too far from the sea for a beach holiday. Lake and river swimming does not make a place a beach destination.';

(async () => {
  const apply = process.argv.includes('--apply');
  const { db } = await import('../src/lib/db/client');
  const { places, placeInterestFacts } = await import('../src/lib/db/schema');
  const { and, eq } = await import('drizzle-orm');
  const { applyAdminEdits } = await import('../src/lib/admin/apply-edits');
  const { CLAUDE_ACTOR } = await import('../src/lib/admin/auth');
  const { parseSliderCurve } = await import('../src/lib/scoring/curve');
  const rows = await db.select().from(places);
  const by = new Map(rows.map((r) => [r.id, r]));
  const patches: Array<{ entityType: string; entityId: string; field: string; value: unknown; loadedUpdatedAt: string }> = [];
  const backup: Record<string, unknown> = {};
  const P = (r: (typeof rows)[number], field: string, value: unknown) => patches.push({ entityType: 'destination', entityId: r.id, field, value, loadedUpdatedAt: r.updatedAt.toISOString() });
  for (const [id, e] of Object.entries(ADD)) {
    const r = by.get(id); if (!r) throw new Error(`no place ${id}`);
    if (!(r.naSliders ?? []).includes(KEY)) { console.log(`${id}: already has Beaches, skipped`); continue; }
    const curve = parseSliderCurve({ anchors: e.anchors.map(([month, value, steepness]) => ({ month, value, steepness })) });
    const reasons = { ...((r.naReasons as Record<string, unknown>) ?? {}) }; delete reasons[KEY];
    P(r, 'naSliders', (r.naSliders ?? []).filter((k) => k !== KEY));
    P(r, 'naReasons', reasons);
    P(r, 'sliderCurves', { ...(r.sliderCurves as Record<string, unknown>), [KEY]: curve });
    console.log(`ADD    ${id.padEnd(24)} peak ${Math.max(...e.anchors.map((a) => a[1]))}  ${e.why}`);
  }
  for (const id of REMOVE) {
    const r = by.get(id); if (!r) throw new Error(`no place ${id}`);
    if ((r.naSliders ?? []).includes(KEY)) { console.log(`${id}: already N/A, skipped`); continue; }
    const ov = { ...((r.sliderOverview as Record<string, string>) ?? {}) }; const mo = { ...((r.sliderMonthlyWeather as Record<string, unknown>) ?? {}) };
    const facts = (await db.select().from(placeInterestFacts).where(and(eq(placeInterestFacts.placeId, id), eq(placeInterestFacts.interestKey, KEY))))[0];
    backup[id] = { overview: ov[KEY] ?? null, monthly: mo[KEY] ?? null, curve: (r.sliderCurves as Record<string, unknown>)[KEY] ?? null, baseScore: (r.baseScores as Record<string, number>)?.[KEY] ?? null, facts: facts?.facts ?? null };
    delete ov[KEY]; delete mo[KEY];
    P(r, 'naSliders', [...(r.naSliders ?? []), KEY]);
    P(r, 'naReasons', { ...((r.naReasons as Record<string, unknown>) ?? {}), [KEY]: { reason: REASON, source: 'imported', by: 'owner rule 22 Oct 2026 (too far from the coast for surfing means too far for a beach)', at: new Date().toISOString() } });
    P(r, 'sliderOverview', ov);
    P(r, 'sliderMonthlyWeather', mo);
    console.log(`REMOVE ${id.padEnd(24)} beach score ${backup[id] && (backup[id] as { baseScore: number }).baseScore}, text ${(backup[id] as { overview: string | null }).overview ? 'removed' : 'none'}`);
  }
  console.log(`${Object.keys(ADD).length} add, ${REMOVE.length} remove, ${patches.length} patches`);
  if (!apply) { console.log('dry run'); process.exit(0); }
  writeFileSync(join(__dirname, '..', 'docs', 'backups', 'beaches-inland-removed-2026-10-22.json'), JSON.stringify(backup, null, 1));
  const res = await applyAdminEdits(patches, CLAUDE_ACTOR);
  console.log('saved', res.saved.length, 'conflicts', res.conflicts.length, 'errors', JSON.stringify(res.errors));
  if (!res.errors.length && !res.conflicts.length) for (const id of REMOVE) await db.delete(placeInterestFacts).where(and(eq(placeInterestFacts.placeId, id), eq(placeInterestFacts.interestKey, KEY)));
  process.exit(res.errors.length || res.conflicts.length ? 1 : 0);
})().catch((e) => { console.log('ERR', e.cause?.message ?? e.message); process.exit(1); });
