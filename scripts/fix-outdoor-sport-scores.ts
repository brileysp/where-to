import { readFileSync } from 'fs';
import { join } from 'path';
import { eq } from 'drizzle-orm';
import { drizzle as drizzlePostgres } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import { places, adminAuditLog } from '../src/lib/db/schema';
import { toScoringPlace } from '../src/lib/db/queries/places';
import { fitDestinationCurves } from '../src/lib/scoring/fitCurve';

/**
 * Corrections to mountainBiking, trailRunning and horsebackRiding, prompted
 * by an external top-20 list per sport and then checked against what the
 * catalogue actually holds. The list was treated as a question, not an
 * answer — several of its entries are not in the catalogue at all, a few
 * conflate places (Marathon des Sables is Saharan, not Atlas), and those
 * were left alone.
 *
 * What it did surface:
 *
 * 1. THE WORST SINGLE ERROR IN THE CATALOGUE. Whistler held mountainBiking
 *    = 2 while tagged 'signature'. Whistler Bike Park is the global
 *    reference for the sport. A score of 2 next to a signature claim is a
 *    flat self-contradiction, and it was pre-existing data, not from any
 *    pass this session.
 *
 * 2. ALPINE MTB SCORED AS IF IT DOESN'T EXIST. Dolomites, Zermatt and
 *    Chamonix all sat at 2 with a 'casual' tier, when hut-to-hut alpine
 *    riding and World Cup venues (Lenzerheide) are a real part of what
 *    those places offer.
 *
 * 3. TWO PURPOSE-BUILT MTB DESTINATIONS UNDERSCORED. Rotorua's
 *    Whakarewarewa forest (north-island) and Derby in Tasmania are among
 *    the best-known modern trail networks anywhere.
 *
 * 4. THE N/A SWEEP WAS TOO BROAD ON SPECIALIST SPORTS. horsebackRiding was
 *    marked inapplicable for 173 destinations because my exception list ran
 *    to twelve. That buried the Camargue — one of the most famous riding
 *    landscapes on earth — along with Welsh pony trekking, Berber mountain
 *    riding and Namibia's desert horses. Same shape for trailRunning, where
 *    the Great Smokies' 800 miles of trail came back N/A.
 *
 * Deliberately NOT changed, where the list overreaches: Queenstown stays at
 * 6 for trail running (it is an adventure-sports town more than a running
 * one), and Morocco stays at 4 (the famous desert ultra is not in the Atlas).
 */

type Tier = 'signature' | 'strong' | 'casual' | 'none';

const SCORES: Record<string, Record<string, number>> = {
  whistler: { mountainBiking: 10 },
  'north-island': { mountainBiking: 8 },
  tasmania: { mountainBiking: 8 },
  dolomites: { mountainBiking: 6, trailRunning: 8 },
  swissalps: { mountainBiking: 6 },
  chamonix: { mountainBiking: 5 },
  'rocky-mountain': { trailRunning: 8 },
  'scottish-highlands-skye': { trailRunning: 6 },
};

const TIERS: Record<string, Record<string, Tier>> = {
  mountainBiking: {
    tasmania: 'strong', dolomites: 'strong', swissalps: 'strong', chamonix: 'strong',
    'north-island': 'strong',
  },
  trailRunning: {
    'rocky-mountain': 'strong', 'scottish-highlands-skye': 'strong', dolomites: 'strong',
  },
};

// Interests wrongly swept to N/A, with the score they should carry.
const UN_NA: Record<string, Array<[string, number]>> = {
  provence: [['horsebackRiding', 8]],          // the Camargue and its white horses
  egypt: [['horsebackRiding', 5]],             // riding at the pyramids
  morocco: [['horsebackRiding', 6]],           // Berber mountain riding in the Atlas
  namibia: [['horsebackRiding', 6]],           // desert riding; the wild horses of the Namib
  snowdonia: [['horsebackRiding', 5]],         // Welsh pony trekking
  'douro-valley-porto': [['horsebackRiding', 4]], // Lusitano tradition
  'north-island': [['horsebackRiding', 5]],
  'great-smoky-mountains': [['trailRunning', 6]], // 800 miles of trail
  peru: [['trailRunning', 6]],                 // Sacred Valley and Inca trail network
  andalucia: [['trailRunning', 5]],            // Sierra Nevada
  cornwall: [['trailRunning', 5]],             // the South West Coast Path
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

  const ids = new Set([...Object.keys(SCORES), ...Object.keys(UN_NA), ...Object.values(TIERS).flatMap((t) => Object.keys(t))]);
  for (const id of ids) if (!byId.has(id)) { console.error(`unknown destination: ${id}`); process.exit(1); }

  for (const id of ids) {
    const row = byId.get(id)!;
    const baseScores = { ...(row.baseScores as Record<string, number>), ...(SCORES[id] ?? {}) };
    let naSliders = row.naSliders ?? [];
    for (const [k, v] of UN_NA[id] ?? []) {
      naSliders = naSliders.filter((x) => x !== k);
      baseScores[k] = v;
    }
    const signatureTier = { ...(row.signatureTier as Record<string, Tier>) };
    for (const [interest, picks] of Object.entries(TIERS)) if (picks[id]) signatureTier[interest] = picks[id];

    const after = { ...row, baseScores, naSliders, signatureTier };
    const desc = [
      ...Object.entries(SCORES[id] ?? {}).map(([k, v]) => `${k}=${v}`),
      ...(UN_NA[id] ?? []).map(([k, v]) => `${k}=${v}(un-N/A)`),
      ...Object.entries(TIERS).filter(([, p]) => p[id]).map(([k, p]) => `${k}:${p[id]}`),
    ].join(' ');
    console.log(`  ${id.padEnd(24)} ${desc}`);
    if (dryRun) continue;

    await db.transaction(async (tx) => {
      await tx.update(places).set({ baseScores, naSliders, signatureTier, updatedAt: new Date() }).where(eq(places.id, id));
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
  console.log(dryRun ? '\ndry run — nothing written.' : `\ndone: ${ids.size} destinations updated.`);
  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
