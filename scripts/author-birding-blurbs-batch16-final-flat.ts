import { readFileSync } from 'fs';
import { join } from 'path';
import { eq } from 'drizzle-orm';
import { drizzle as drizzlePostgres } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import { places, adminAuditLog } from '../src/lib/db/schema';

/**
 * Sixteenth batch — the last 15 genuinely flat destinations (verified,
 * via check-curve-variation-final44.ts, to have no real curve variation
 * beyond rounding noise). Completes the birding overview/monthly
 * content-authoring project for all 200 catalog destinations. Real
 * specific facts where they exist (Marlborough's endemic king shag,
 * Okinawa's flightless Okinawa rail, Doi Inthanon near Chiang Mai).
 */

const KEY = 'birding';

const FLAT_TEXT: Record<string, string> = {
  'turks-caicos': 'Caribbean flamingos are present in the islands\' shallow ponds, alongside common reef and shorebird species.',
  palau: 'Pacific seabird colonies and a handful of Micronesian endemics are present; nothing tied to a specific seasonal spectacle.',
  rio: 'Atlantic Forest remnants within the city, including Tijuca, hold toucans and other Brazilian forest species.',
  'big-island': 'High-elevation native forest holds Hawaiian honeycreepers, a highly endemic group found nowhere else, though many species are now rare.',
  'marlborough-abel-tasman': 'The Marlborough Sounds are the only home of the king shag, a cormorant found nowhere else in the world.',
  'chiang-mai': 'Doi Inthanon, Thailand\'s highest peak, is a renowned birding site for Himalayan-fringe species found nowhere else in the country.',
  'san-miguel-guanajuato': 'Common Mexican highland species; nothing tied to a specific seasonal spectacle.',
  tuscany: 'Common Italian countryside species in the vineyard landscape; nothing tied to a specific seasonal spectacle.',
  okinawa: 'The Okinawa rail, a flightless endemic, is restricted to the Yanbaru forest in the island\'s north.',
  maui: 'High-elevation native forest on Haleakalā holds Hawaiian honeycreepers, though many species are now rare.',
  borabora: 'Common Pacific seabird and reef-adjacent species; nothing tied to a specific seasonal spectacle.',
  'punta-cana': 'Common Caribbean coastal species; nothing tied to a specific seasonal spectacle.',
  rivieramaya: 'Yucatán jungle species, including motmots and toucans, are present inland; the coast itself offers a common Caribbean baseline.',
  bahamas: 'West Indian flamingos breed in large numbers on the remote southern islands, though the more visited northern islands offer a common Caribbean baseline.',
  jamaica: 'Jamaica holds around 30 endemic species, including the red-billed streamertail, the country\'s national bird.',
};

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
  const dryRun = process.argv.includes('--dry-run');
  const db = drizzlePostgres(postgres(env.DATABASE_URL, { prepare: false }));

  for (const [id, text] of Object.entries(FLAT_TEXT)) {
    const [row] = await db.select().from(places).where(eq(places.id, id));
    if (!row) { console.error(`${id}: not found`); process.exit(1); }
    const patch: Record<string, unknown> = {
      sliderOverview: { ...(row.sliderOverview as Record<string, string>), [KEY]: text },
      sliderMonthlyWeather: { ...(row.sliderMonthlyWeather as Record<string, (string | null)[]>), [KEY]: Array(12).fill(text) },
    };
    console.log(`  ${id}`);
    if (!dryRun) {
      const after = { ...row, ...patch };
      await db.transaction(async (tx) => {
        await tx.update(places).set({ ...patch, updatedAt: new Date() }).where(eq(places.id, id));
        await tx.insert(adminAuditLog).values({
          actorId: '00000000-0000-0000-0000-000000000000', entityType: 'destination', entityId: id,
          action: 'update', beforeValue: row, afterValue: after,
        });
      });
    }
  }
  console.log(dryRun ? '\ndry run — nothing written.' : '\ndone.');
  process.exit(0);
}

main().catch((err) => { console.error(err); process.exit(1); });
