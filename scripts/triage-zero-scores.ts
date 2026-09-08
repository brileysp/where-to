import { readFileSync, writeFileSync, mkdirSync } from 'fs';
import { join } from 'path';
import { eq } from 'drizzle-orm';
import { drizzle as drizzlePostgres } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import { places, adminAuditLog } from '../src/lib/db/schema';
import { toScoringPlace } from '../src/lib/db/queries/places';
import { fitDestinationCurves } from '../src/lib/scoring/fitCurve';
import { SLIDERS } from '../src/lib/scoring/constants';

/**
 * Applies the zero-triage decisions: every (destination, interest) pair
 * scoring zero in all twelve months gets an explicit disposition, because
 * an all-zero row can no longer mean anything else.
 *
 * The invariant: nothing should score zero every month. A genuine
 * year-round absence is an editorial claim and belongs in naSliders. So an
 * all-zero row is by definition unauthored content, never a claim — which
 * is what makes a blanket sweep safe to automate.
 *
 * Two phases, in this order on purpose:
 *   1. SCORE the ~250 pairs that were missed (Etna for Sicily, Plitvice for
 *      Croatia, Sámi culture for Lapland, Keukenhof for Amsterdam...).
 *   2. SWEEP everything still at zero into naSliders.
 * Reversing the order would mean writing ~3,300 N/As and then removing 250
 * of them; this way phase 2 is simply "whatever is still zero", so it is
 * idempotent and self-correcting.
 *
 * north-cascades is excluded from phase 2. It has 39 of 51 interests
 * unauthored — the least-documented destination in the catalogue by a wide
 * margin — so sweeping it would assert it has no scenic landscapes and no
 * hiking, which is false. It needs an authoring pass, not triage.
 */

const SWEEP_EXCLUDE = new Set(['north-cascades']);
const DERIVED = new Set(['deals', 'crowds']);

// Phase 1: interest -> [destinationId, score][]
const SCORES: Record<string, Array<[string, number]>> = {
  themeParks: [
    ['copenhagen', 7], ['rivieramaya', 6], ['barcelona', 5], ['london', 5], ['amsterdam', 5],
    ['bavaria-munich', 4], ['nyc', 4], ['bangkok', 4], ['taiwan', 4], ['mexicocity', 4], ['sydney', 3],
  ],
  spectatorSports: [
    ['tokyo-kyoto', 7], ['paris', 7], ['rome', 6], ['mexicocity', 6], ['seoul', 5], ['amsterdam', 5],
    ['edinburgh', 5], ['ireland', 5], ['singapore', 5], ['istanbul', 5], ['nice-riviera', 4],
    ['beijing', 4], ['lisbon', 4], ['copenhagen', 3],
  ],
  hotSprings: [
    ['azores', 8], ['ecuadorian-andes', 7], ['chilean-lake-district', 7], ['banff', 6], ['aspen', 5],
    ['peru', 5], ['queenstown', 5], ['swissalps', 5], ['argentine-lake-district', 5], ['jordan', 4],
    ['rocky-mountain', 4], ['dolomites', 4], ['chamonix', 4], ['uyuni', 4], ['greenland', 3],
  ],
  safari: [
    ['rajasthan-golden-triangle', 6], ['nepal', 5], ['ethiopia', 3], ['ghana', 3], ['borneo', 3],
  ],
  yogaRetreats: [
    ['guatemala', 6], ['peru', 5], ['nicaragua', 5], ['morocco', 3], ['santorini', 3],
  ],
  horsebackRiding: [
    ['torres-del-paine', 7], ['banff', 6], ['chilean-lake-district', 6], ['yellowstone', 5],
    ['glacier-waterton', 5], ['badlands-black-hills', 5], ['mendoza', 5], ['ladakh', 4],
    ['cotswolds', 4], ['jordan', 4], ['vermont', 3], ['uluru', 3],
  ],
  allInclusive: [
    ['canaries', 7], ['mallorca', 6], ['thailand', 5], ['algarve', 5], ['puerto-rico', 5],
    ['bali', 4], ['colombian-caribbean', 4], ['panama', 4], ['belize', 4], ['okinawa', 3],
  ],
  whaleWatching: [
    ['madeira', 8], ['antarctica', 8], ['canaries', 7], ['costa-rica', 6], ['greenland', 6],
    ['punta-cana', 6], ['ireland', 5], ['svalbard', 5], ['marlborough-abel-tasman', 5],
    ['panama', 5], ['okinawa', 5], ['faroe-islands', 4], ['maldives', 4], ['tierra-del-fuego', 4],
  ],
  wildflowerBlooms: [
    ['amsterdam', 8], ['rocky-mountain', 6], ['madeira', 6], ['azores', 6], ['glacier-waterton', 6],
    ['olympic', 6], ['lake-district', 4], ['cotswolds', 4], ['canaries', 4], ['iceland', 4],
    ['santorini', 3], ['lapland', 3], ['badlands-black-hills', 3],
  ],
  traditionalCrafts: [
    ['san-miguel-guanajuato', 6], ['chiang-mai', 6], ['bagan', 6], ['north-island', 6], ['nepal', 6],
    ['papua-new-guinea', 6], ['ireland', 5], ['scottish-highlands-skye', 5], ['douro-valley-porto', 5],
    ['angkor', 5], ['ethiopia', 5], ['borneo', 5], ['ladakh', 5], ['colombian-andes', 5],
    ['uyuni', 4], ['egypt', 4], ['madagascar', 4], ['palau', 4],
  ],
  auroraChasing: [
    ['glacier-waterton', 2], ['vancouver-island', 2],
  ],
  mountaineering: [
    ['peru', 7], ['morocco', 6], ['kenya', 6], ['fjords', 6], ['lofoten', 6],
    ['milford-sound-fiordland', 6], ['queenstown', 5], ['uganda', 5], ['greenland', 5],
    ['iceland', 4], ['taiwan', 4], ['hokkaido', 4],
  ],
  indigenousCultures: [
    ['lapland', 7], ['badlands-black-hills', 6], ['grandcanyon', 6], ['chiang-mai', 6],
    ['arches-canyonlands', 5], ['sedona', 5], ['vietnam', 5], ['luangprabang', 5],
    ['zion-bryce', 4], ['kaziranga', 4], ['palawan', 4], ['fjords', 3], ['tasmania', 3], ['banff', 3],
  ],
  trailRunning: [
    ['hongkong', 6], ['iceland', 6], ['fjords', 6], ['hokkaido', 5], ['taiwan', 5], ['rio', 5],
    ['costa-rica', 5], ['morocco', 4], ['jordan', 4], ['greenland', 3],
  ],
  geologyVolcanoes: [
    ['sicily', 9], ['amalfi', 7], ['hokkaido', 7], ['tokyo-kyoto', 5], ['tbilisi-caucasus', 5],
    ['milford-sound-fiordland', 5], ['rajaampat', 4], ['kerala', 3],
  ],
  nationalParks: [
    ['croatia', 8], ['iceland', 8], ['taiwan', 7], ['canaries', 7], ['ethiopia', 7],
    ['ecuadorian-andes', 7], ['hokkaido', 6], ['thailand', 6], ['vietnam', 6], ['madeira', 6],
    ['peru', 6], ['jordan', 6], ['seoul', 5], ['ireland', 5], ['chiang-mai', 5], ['azores', 5],
    ['morocco', 5], ['uyuni', 5],
  ],
  campingBackcountry: [
    ['iceland', 7], ['jordan', 7], ['north-island', 6], ['queenstown', 6], ['peru', 6],
    ['uluru', 5], ['morocco', 5], ['hokkaido', 5], ['ireland', 4], ['cornwall', 4], ['taiwan', 4],
  ],
  historyArchaeology: [
    ['belize', 6], ['zimbabwe', 6], ['uluru', 5], ['badlands-black-hills', 5], ['grandcanyon', 4],
    ['guilin-yangshuo', 4], ['big-island', 3],
  ],
  religiousSites: [
    ['borneo', 3], ['palawan', 3], ['fiji', 3], ['madagascar', 3], ['big-island', 3],
  ],
  familyFun: [
    ['paris', 8], ['london', 8], ['nyc', 7], ['bavaria-munich', 7], ['chicago', 7], ['lake-district', 7],
    ['rome', 6], ['berlin', 6], ['vienna', 6], ['tuscany', 6], ['lisbon', 6], ['cotswolds', 6],
    ['black-forest', 6], ['bangkok', 6], ['mexicocity', 6], ['prague', 5], ['budapest', 5],
    ['edinburgh', 5], ['new-orleans', 5], ['buenosaires', 5],
  ],
  cityExploration: [
    ['kerala', 6], ['madeira', 5], ['rwanda', 5], ['uganda', 4], ['okinawa', 4], ['jamaica', 4],
    ['bahamas', 4], ['mauritius', 4], ['aruba', 4], ['azores', 4], ['zimbabwe', 3], ['big-island', 3],
    ['maui', 3], ['fiji', 3], ['seychelles', 3], ['madagascar', 3], ['papua-new-guinea', 3],
    ['turks-caicos', 3],
  ],
  coffeeTea: [
    ['colombian-caribbean', 6], ['oaxaca', 5], ['olympic', 4], ['uyuni', 3], ['pantanal', 3],
  ],
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
  const dryRun = process.argv.includes('--dry-run');
  const db = drizzlePostgres(postgres(env.DATABASE_URL, { prepare: false }));

  const rows = await db.select().from(places).where(eq(places.isPrimaryDestination, true));
  const byId = new Map(rows.map((r) => [r.id, r]));
  const sliderKeys = new Set(SLIDERS.map((s) => s.key));
  const authorable = SLIDERS.map((s) => s.key).filter((k) => !DERIVED.has(k));

  // Validate the decision table before touching anything: a typo'd id or
  // slider key must fail loudly, not write to the wrong place or vanish.
  const problems: string[] = [];
  for (const [interest, picks] of Object.entries(SCORES)) {
    if (!sliderKeys.has(interest)) problems.push(`unknown interest: ${interest}`);
    const seen = new Set<string>();
    for (const [id, value] of picks) {
      if (!byId.has(id)) problems.push(`unknown destination: ${id} (in ${interest})`);
      if (seen.has(id)) problems.push(`duplicate: ${id} listed twice in ${interest}`);
      seen.add(id);
      if (value < 1 || value > 10) problems.push(`out-of-range score ${value} for ${id}/${interest}`);
    }
  }
  if (problems.length) {
    console.error('Decision table failed validation:\n  ' + problems.join('\n  '));
    process.exit(1);
  }

  // Backup before any write. No git repo here, so the audit log's
  // beforeValue is the only other undo path — this is the cheap one.
  const backupDir = join(__dirname, '..', 'docs', 'backups');
  mkdirSync(backupDir, { recursive: true });
  const stamp = new Date().toISOString().replace(/[:.]/g, '-');
  const backupPath = join(backupDir, `pre-zero-triage-${stamp}.json`);
  const backup = rows.map((r) => ({ id: r.id, baseScores: r.baseScores, naSliders: r.naSliders }));
  if (!dryRun) writeFileSync(backupPath, JSON.stringify(backup, null, 1));

  // Build per-destination edits.
  type Edit = { scores: Record<string, number>; na: string[] };
  const edits = new Map<string, Edit>();
  const editFor = (id: string) => {
    if (!edits.has(id)) edits.set(id, { scores: {}, na: [] });
    return edits.get(id)!;
  };

  let phase1 = 0;
  for (const [interest, picks] of Object.entries(SCORES)) {
    for (const [id, value] of picks) {
      const row = byId.get(id)!;
      const cur = (row.baseScores as Record<string, number>)[interest];
      if (cur !== undefined && cur > 0) continue; // already authored — never overwrite
      editFor(id).scores[interest] = value;
      phase1++;
    }
  }

  let phase2 = 0;
  for (const row of rows) {
    if (SWEEP_EXCLUDE.has(row.id)) continue;
    const e = editFor(row.id);
    for (const k of authorable) {
      if ((row.naSliders ?? []).includes(k)) continue;
      if (e.scores[k] !== undefined) continue; // just given a real score
      const v = (row.baseScores as Record<string, number>)[k];
      if (v === undefined || v === 0) {
        e.na.push(k);
        phase2++;
      }
    }
  }

  console.log(`\nphase 1 — scores to write: ${phase1}`);
  console.log(`phase 2 — interests to mark N/A: ${phase2}`);
  console.log(`destinations touched: ${[...edits.values()].filter((e) => Object.keys(e.scores).length || e.na.length).length}`);
  console.log(`excluded from sweep: ${[...SWEEP_EXCLUDE].join(', ')}`);
  if (dryRun) {
    console.log('\ndry run — nothing written.');
    process.exit(0);
  }
  console.log(`backup written: ${backupPath}\n`);

  let written = 0;
  for (const [id, e] of edits) {
    if (!Object.keys(e.scores).length && !e.na.length) continue;
    const row = byId.get(id)!;
    const baseScores = { ...(row.baseScores as Record<string, number>), ...e.scores };
    const naSliders = Array.from(new Set([...(row.naSliders ?? []), ...e.na]));
    const after = { ...row, baseScores, naSliders };

    await db.transaction(async (tx) => {
      await tx.update(places).set({ baseScores, naSliders, updatedAt: new Date() }).where(eq(places.id, id));
      await tx.insert(adminAuditLog).values({
        actorId: '00000000-0000-0000-0000-000000000000',
        entityType: 'destination',
        entityId: id,
        action: 'update',
        beforeValue: row,
        afterValue: after,
      });
      const curves = fitDestinationCurves(toScoringPlace(after as Parameters<typeof toScoringPlace>[0]));
      await tx.update(places).set({ sliderCurves: curves }).where(eq(places.id, id));
    });
    written++;
    if (written % 25 === 0) console.log(`  ...${written} destinations written`);
  }

  console.log(`\ndone: ${written} destinations updated (${phase1} scores, ${phase2} N/A).`);
  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
