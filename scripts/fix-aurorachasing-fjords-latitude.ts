import { readFileSync } from 'fs';
import { join } from 'path';
import { eq } from 'drizzle-orm';
import { drizzle as drizzlePostgres } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import { places, adminAuditLog } from '../src/lib/db/schema';

/**
 * Real error, caught by the user: batch1's auroraChasing content for `fjords`
 * (the "Norwegian Fjords" destination — Geiranger/Sognefjord/Ålesund/Bergen,
 * ~60-62°N, per its own `about` field and every other slider's content) was
 * written around Tromsø, a real place but ~70°N in Arctic Norway — not part
 * of this destination, not just an imprecise description of it.
 *
 * The score was ALSO wrong for the real fjord region — verified: Bergen/
 * Ålesund need a genuinely strong solar storm to see anything, a few times a
 * year, weaker even then (fjordsandbeaches.com, fiftydegreesnorth.com). That
 * matches the Faroe Islands/Scottish Highlands tier, not Tromsø/Iceland's
 * apex tier — event weight lowered 7 -> 4 accordingly (peak 9 -> 6).
 */
const KEY = 'auroraChasing';
const EVENT = [{ label: 'Aurora season (a storm-dependent chance, not a near-guarantee)', weight: 4, months: { 1: 1, 2: 1, 3: 1, 10: 1, 11: 1, 12: 1 } }];

const OVERVIEW = "Norway's fjord country sits far enough south that the aurora isn't a given — Bergen and Ålesund need a genuinely strong solar storm, arriving only a handful of times a year, and even then the display tends to be fainter than what Norway's true Arctic north sees routinely.";

const OFF_SEASON = 'Outside the real dark season — nights are too short here for a realistic look, even during a strong storm.';
const MONTHLY = [
  'Within the season — a genuinely strong storm is still needed, but nights are long and dark.',
  'Same odds as January, among the better months for a chance.',
  'Still within the season; the equinox can add a boost in activity.',
  OFF_SEASON, OFF_SEASON, OFF_SEASON, OFF_SEASON, OFF_SEASON,
  'A modest start to the season.',
  'Nights are dark enough again for a real, if occasional, chance.',
  'Within the season, same odds as January.',
  'Within the season, same odds as January.',
];

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
  const dryRun = process.argv.includes('--dry-run');
  const db = drizzlePostgres(postgres(env.DATABASE_URL, { prepare: false }));
  const { toScoringPlace } = await import('../src/lib/db/queries/places');
  const { deriveDestinationScores } = await import('../src/lib/scoring/destinations');

  const id = 'fjords';
  const [row] = await db.select().from(places).where(eq(places.id, id));
  if (!row) { console.error(`${id}: not found`); process.exit(1); }
  if (MONTHLY.length !== 12) { console.error('monthly array is not length 12'); process.exit(1); }
  const before = deriveDestinationScores(toScoringPlace(row), { skipHazards: true }).monthly.auroraChasing as number[];
  const patch = {
    sliderEvents: { ...(row.sliderEvents as Record<string, unknown>), auroraChasing: EVENT },
    sliderOverview: { ...(row.sliderOverview as Record<string, string>), [KEY]: OVERVIEW },
    sliderMonthlyWeather: { ...(row.sliderMonthlyWeather as Record<string, (string | null)[]>), [KEY]: MONTHLY },
  };
  const afterRow = { ...row, ...patch };
  const after = deriveDestinationScores(toScoringPlace(afterRow as typeof row), { skipHazards: true }).monthly.auroraChasing as number[];
  console.log(`${id}:\n  before [${before.join(',')}]\n  after  [${after.join(',')}]`);
  if (!dryRun) {
    await db.transaction(async (tx) => {
      await tx.update(places).set({ ...patch, updatedAt: new Date() }).where(eq(places.id, id));
      await tx.insert(adminAuditLog).values({ actorId: '00000000-0000-0000-0000-000000000000', entityType: 'destination', entityId: id, action: 'update', beforeValue: row, afterValue: afterRow });
    });
  }
  console.log(dryRun ? '\ndry run — nothing written.' : '\ndone.');
  process.exit(0);
}

main().catch((err) => { console.error(err); process.exit(1); });
