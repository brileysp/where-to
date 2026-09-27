import { readFileSync } from 'fs';
import { join } from 'path';
import { eq } from 'drizzle-orm';
import { drizzle as drizzlePostgres } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import { places, adminAuditLog } from '../src/lib/db/schema';
import { parseSliderCurve, rescaleCurve } from '../src/lib/scoring/curve';

/**
 * Three destinations whose real signature was suppressed while padding led.
 *
 * The hiking deflation pass left Bavaria & Munich at rank 162, Bali at 139
 * and Sydney at 138 — all obviously wrong for destinations of that
 * prominence. Reading their top contributors shows the same disease in each
 * case, and it is not the hiking cut: the hiking cut just removed the prop
 * that was hiding it.
 *
 *   Munich led on architecture and street food, with the Alte Pinakothek
 *   and the Deutsches Museum scored 7 and the Altstadt, the Englischer
 *   Garten and the beer halls held at a "casual" 6.
 *
 *   Sydney led on NIGHTLIFE, with the Opera House and the Harbour Bridge
 *   sitting at an authored "casual" 8, and Bondi and Manly at "casual" too.
 *
 *   Bali led on nightlife as well, with Uluwatu, Tanah Lot and Besakih —
 *   the temple culture that is the whole cultural draw of the island — at
 *   "strong".
 *
 * A tier is not a description of quality; it answers "is this what the
 * place is FOR". All three answered it wrong.
 */

type Edit = { id: string; key: string; peak?: number; tier?: 'signature' | 'strong' | 'casual' | 'none'; why: string };

const EDITS: Edit[] = [
  { id: 'bavaria-munich', key: 'museumsArt', peak: 9, why: 'Alte Pinakothek and the Deutsches Museum, the largest science museum on earth' },
  { id: 'bavaria-munich', key: 'cityExploration', peak: 8, tier: 'strong', why: 'the Altstadt, Marienplatz, the Englischer Garten, the beer halls' },
  { id: 'bavaria-munich', key: 'historyArchaeology', peak: 7, tier: 'strong', why: 'the Residenz, the Documentation Centre, Dachau and Nuremberg' },
  { id: 'sydney', key: 'architecture', peak: 9, tier: 'signature', why: 'the Opera House and the Harbour Bridge — was a "casual" 8' },
  { id: 'sydney', key: 'beachesSwimming', tier: 'strong', why: 'Bondi and Manly are a reason people come, not incidental' },
  { id: 'bali', key: 'religiousSites', peak: 9, tier: 'signature', why: 'Uluwatu, Tanah Lot, Besakih and the daily offerings ARE Bali' },
  { id: 'bali', key: 'architecture', tier: 'strong', why: 'Balinese temple architecture is distinctive and part of the draw' },
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
  // Mutable, and every patch is built HERE against the live row — Munich
  // takes three edits and Sydney and Bali two each. Building patches
  // up-front against a startup snapshot is what silently ate 17 reshapes in
  // review-parks-hiking-saturation.ts and Venice's history in
  // fix-outlier-findings.ts.
  const byId = new Map(rows.map((r) => [r.id, { ...r }]));
  const scored = await getAllScoredPlaces();

  for (const e of EDITS) {
    const row = byId.get(e.id);
    if (!row) { console.error(`${e.id}: not a primary destination`); process.exit(1); }
    const d = scored.find((x) => x.id === e.id)!;
    const monthly = d.monthly[e.key] ?? [];
    if (monthly.length === 0) { console.error(`${e.id}: no ${e.key} scores`); process.exit(1); }

    const patch: Record<string, unknown> = {};
    const parts: string[] = [];

    if (e.peak !== undefined) {
      const raw = (row.sliderCurves as Record<string, unknown>)[e.key];
      if (raw === undefined) { console.error(`${e.id}: no ${e.key} curve`); process.exit(1); }
      const rescaled = rescaleCurve(parseSliderCurve(raw), Math.min(Math.min(...monthly), e.peak), e.peak);
      patch.sliderCurves = { ...(row.sliderCurves as Record<string, unknown>), [e.key]: rescaled };
      patch.authoredCurves = Array.from(new Set([...(row.authoredCurves ?? []), e.key]));
      parts.push(`${Math.max(...monthly).toFixed(0)} -> ${e.peak}`);
    }
    if (e.tier) {
      patch.signatureTier = { ...(row.signatureTier as Record<string, unknown>), [e.key]: e.tier };
      parts.push(`tier ${(row.signatureTier as Record<string, string>)[e.key] ?? '-'} -> ${e.tier}`);
    }

    const after = { ...row, ...patch };
    console.log(`  ${e.id.padEnd(16)} ${e.key.padEnd(20)} ${parts.join(', ').padEnd(30)} ${e.why}`);
    if (!dryRun) {
      await db.transaction(async (tx) => {
        await tx.update(places)
          .set({ ...(patch as Partial<typeof places.$inferInsert>), updatedAt: new Date() })
          .where(eq(places.id, e.id));
        await tx.insert(adminAuditLog).values({
          actorId: '00000000-0000-0000-0000-000000000000',
          entityType: 'destination',
          entityId: e.id,
          action: 'update',
          beforeValue: row,
          afterValue: after,
        });
      });
    }
    byId.set(e.id, after as typeof row);
  }

  console.log(dryRun ? `\ndry run — ${EDITS.length} would change.` : `\ndone: ${EDITS.length} edits.`);
  process.exit(0);
}

main().catch((err) => { console.error(err); process.exit(1); });
