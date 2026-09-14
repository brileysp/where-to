import { readFileSync } from 'fs';
import { join } from 'path';
import { eq } from 'drizzle-orm';
import { drizzle as drizzlePostgres } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import { places, adminAuditLog } from '../src/lib/db/schema';

/**
 * Thirteenth batch — flat world cities. Real specific facts where a
 * genuine nearby wetland/reserve exists (Lisbon's Tagus estuary, Hong
 * Kong's Mai Po, Singapore's Sungei Buloh, Dubai's Ras Al Khor
 * flamingos, Bangkok's inner Gulf of Thailand spoon-billed sandpiper
 * wintering grounds); honest generic urban text for the rest.
 */

const KEY = 'birding';

const FLAT_TEXT: Record<string, string> = {
  venice: 'The lagoon\'s shallow wetlands support herons and waders, though the historic center itself offers only common urban species.',
  rome: 'Common urban and parkland species; nothing tied to a specific seasonal spectacle.',
  london: 'Common urban and park species; nothing tied to a specific seasonal spectacle.',
  paris: 'Common urban and park species; nothing tied to a specific seasonal spectacle.',
  edinburgh: 'Common urban species, with real but modest seabird interest along the nearby Firth of Forth coastline.',
  amsterdam: 'Common urban and canal species; nothing tied to a specific seasonal spectacle.',
  barcelona: 'Common Mediterranean urban and coastal species; nothing tied to a specific seasonal spectacle.',
  lisbon: 'The nearby Tagus estuary holds a real wetland bird reserve, with wintering flamingos and large numbers of migrant waders.',
  athens: 'Common Mediterranean urban species; nothing tied to a specific seasonal spectacle.',
  seoul: 'Common urban and Han River waterfowl species; nothing tied to a specific seasonal spectacle.',
  'tokyo-kyoto': 'Common urban and park species; nothing tied to a specific seasonal spectacle.',
  hongkong: 'The nearby Mai Po wetlands are a globally significant shorebird stopover on the East Asian-Australasian Flyway, though the city itself offers a common urban baseline.',
  singapore: 'Sungei Buloh wetland reserve is a real stopover on the East Asian-Australasian Flyway, alongside a common urban baseline elsewhere in the city.',
  dubai: 'Ras Al Khor sanctuary holds a real flamingo population within the city, alongside common desert species elsewhere.',
  bangkok: 'The inner Gulf of Thailand near the city is one of the few wintering sites for the critically endangered spoon-billed sandpiper, alongside large numbers of other migrant shorebirds.',
  havana: 'Common urban and Caribbean species; nothing tied to a specific seasonal spectacle.',
  mexicocity: 'Common urban and high-altitude species from the surrounding volcanic belt; nothing tied to a specific seasonal spectacle.',
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
