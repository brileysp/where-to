import { readFileSync } from 'fs';
import { join } from 'path';
import { eq } from 'drizzle-orm';
import { drizzle as drizzlePostgres } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import { places, adminAuditLog } from '../src/lib/db/schema';
import { toScoringPlace } from '../src/lib/db/queries/places';
import { fitDestinationCurves } from '../src/lib/scoring/fitCurve';

/**
 * Corrects four indefensible hiking scores, surfaced by the persona rebuild
 * putting Yellowstone 74th under an Active & Outdoors profile.
 *
 * The catalogue held Yellowstone at 3 and Yosemite at 4 for hiking, while
 * Zion & Bryce, Glacier and Rocky Mountain sat at 8. Yosemite is one of the
 * most famous hiking destinations on earth — Half Dome, the Mist Trail, the
 * northern terminus of the John Muir Trail — and Yellowstone has over 900
 * miles of maintained trail. These are not 3s and 4s on any scale where
 * Zion is an 8.
 *
 * Banff and Queenstown had the same problem for the same reason: scored
 * early against a different mental yardstick and never revisited.
 *
 * Yellowstone's trailRunning also comes back off N/A. The zero-triage sweep
 * marked it inapplicable, which is wrong for a park with that much trail —
 * that call was mine and it was too aggressive.
 */

const SCORES: Record<string, Record<string, number>> = {
  yellowstone: { hiking: 8 },
  yosemite: { hiking: 9 },
  banff: { hiking: 8 },
  queenstown: { hiking: 8 },
};

const UN_NA: Record<string, Array<[string, number]>> = {
  yellowstone: [['trailRunning', 6]],
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
  const db = drizzlePostgres(postgres(env.DATABASE_URL, { prepare: false }));
  const rows = await db.select().from(places).where(eq(places.isPrimaryDestination, true));
  const byId = new Map(rows.map((r) => [r.id, r]));

  const ids = new Set([...Object.keys(SCORES), ...Object.keys(UN_NA)]);
  for (const id of ids) {
    const row = byId.get(id);
    if (!row) { console.error(`unknown destination: ${id}`); process.exit(1); }
    const baseScores = { ...(row.baseScores as Record<string, number>), ...(SCORES[id] ?? {}) };
    let naSliders = row.naSliders ?? [];
    for (const [k, v] of UN_NA[id] ?? []) {
      naSliders = naSliders.filter((x) => x !== k);
      baseScores[k] = v;
    }
    const after = { ...row, baseScores, naSliders };
    console.log(`  ${id.padEnd(14)} ${Object.entries(SCORES[id] ?? {}).map(([k, v]) => `${k}=${v}`).join(' ')} ${(UN_NA[id] ?? []).map(([k, v]) => `${k}=${v} (un-N/A)`).join(' ')}`);
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
  }
  console.log(`\ndone: ${ids.size} destinations updated.`);
  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
