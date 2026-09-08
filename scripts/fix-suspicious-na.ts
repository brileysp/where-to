import { readFileSync } from 'fs';
import { join } from 'path';
import { eq } from 'drizzle-orm';
import { drizzle as drizzlePostgres } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import { places, adminAuditLog } from '../src/lib/db/schema';
import { toScoringPlace } from '../src/lib/db/queries/places';
import { fitDestinationCurves } from '../src/lib/scoring/fitCurve';

/**
 * Corrects the false N/A claims the zero-triage sweep created, found by
 * scripts/audit-suspicious-na.ts: 64 flagged, 56 genuine errors, 8 correct.
 *
 * The sweep made N/A the default for every all-zero interest, so wherever
 * the hand-written exception list was incomplete the remainder became a
 * positive claim of inapplicability. That is the worse failure mode — a
 * zero announces itself as unauthored, a wrong N/A does not — so these get
 * fixed rather than left.
 *
 * Each entry removes the interest from naSliders AND gives it a real score.
 * KEEPS below are the deliberate opposite: flagged by the heuristic, but
 * correct as N/A, recorded so a future run does not re-litigate them.
 */

// [destinationId, score] per interest — removes N/A and authors a value.
const FIXES: Record<string, Array<[string, number]>> = {
  nationalParks: [
    ['bend-crater-lake', 9], ['big-island', 9], ['maui', 8], ['cape-town', 8], ['palawan', 8],
    ['southeast-alaska', 8], ['colombian-caribbean', 7], ['bhutan', 7], ['nova-scotia', 7],
    ['lapland', 7], ['fjords', 7], ['dolomites', 7], ['upper-peninsula', 7], ['queenstown', 7],
    ['scottish-highlands-skye', 7], ['kerala', 7], ['sicily', 6], ['colombian-andes', 6],
    ['provence', 6], ['monterey-big-sur', 6], ['whistler', 5], ['atacama', 5], ['sardinia', 5],
    ['chamonix', 5], ['swissalps', 5], ['mallorca', 5], ['tuscany', 5], ['guilin-yangshuo', 5],
    ['palau', 5], ['douro-valley-porto', 4], ['sedona', 4], ['aspen', 4], ['vermont', 4], ['amalfi', 4],
  ],
  trailRunning: [['ladakh', 5], ['pakistan', 5]],
  // The second group here surfaced only after the nationalParks fixes
  // above landed: scoring a park made these destinations' camping N/A newly
  // contradictory. The audit converges rather than resolving in one pass.
  campingBackcountry: [
    ['tierra-del-fuego', 7], ['borneo', 6], ['costa-rica', 6], ['croatia', 5], ['srilanka', 5],
    ['big-island', 6], ['nova-scotia', 6], ['colombian-caribbean', 5], ['maui', 5],
    ['palawan', 4], ['kerala', 3],
  ],
  historyArchaeology: [['rio', 4], ['dubai', 3]],
  cityExploration: [
    ['piedmont', 6], ['thailand', 6], ['guilin-yangshuo', 6], ['los-cabos', 4], ['palawan', 4],
    ['cape-cod-islands', 4], ['jordan', 3], ['bagan', 3],
  ],
  familyFun: [['beijing', 6]],
  geologyVolcanoes: [['chilean-lake-district', 8], ['taiwan', 6], ['banff', 5]],
  religiousSites: [['chicago', 3]],
};

/**
 * Flagged by the heuristic but correct as N/A. Kept as documentation of a
 * decision, not as data — the audit will keep flagging these and that is
 * fine; the reasoning lives here.
 *   antarctica/nationalParks   — Antarctic Treaty area, no national parks
 *   faroe-islands, falklands, lofoten, borabora — no designated parks
 *   komodo, galapagos/camping  — camping restricted; visits are boat-based
 *   budapest/geologyVolcanoes  — thermal springs are karst, not volcanic
 */

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

  type Edit = { scores: Record<string, number>; unNA: string[] };
  const edits = new Map<string, Edit>();
  const problems: string[] = [];
  let count = 0;

  for (const [interest, picks] of Object.entries(FIXES)) {
    for (const [id, value] of picks) {
      const row = byId.get(id);
      if (!row) { problems.push(`unknown destination: ${id} (${interest})`); continue; }
      // Already corrected by an earlier run — skip rather than fail, so
      // this script stays idempotent as entries are appended to it.
      if (!(row.naSliders ?? []).includes(interest)) continue;
      if (!edits.has(id)) edits.set(id, { scores: {}, unNA: [] });
      edits.get(id)!.scores[interest] = value;
      edits.get(id)!.unNA.push(interest);
      count++;
    }
  }
  if (problems.length) {
    console.error('Validation failed:\n  ' + problems.join('\n  '));
    process.exit(1);
  }

  console.log(`\ncorrecting ${count} false N/A claims across ${edits.size} destinations`);
  for (const [id, e] of edits) {
    console.log(`  ${id.padEnd(26)} ${Object.entries(e.scores).map(([k, v]) => `${k}=${v}`).join(' ')}`);
  }
  if (dryRun) {
    console.log('\ndry run — nothing written.');
    process.exit(0);
  }

  let written = 0;
  for (const [id, e] of edits) {
    const row = byId.get(id)!;
    const baseScores = { ...(row.baseScores as Record<string, number>), ...e.scores };
    const naSliders = (row.naSliders ?? []).filter((k) => !e.unNA.includes(k));
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
  }

  console.log(`\ndone: ${written} destinations updated, ${count} N/A claims corrected.`);
  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
