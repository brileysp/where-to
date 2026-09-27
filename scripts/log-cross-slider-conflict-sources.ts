import { readFileSync } from 'fs';
import { join } from 'path';
import { eq } from 'drizzle-orm';
import { drizzle as drizzlePostgres } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import { places, adminAuditLog } from '../src/lib/db/schema';

type Source = { url: string; label?: string; note?: string; addedAt: string };
const TODAY = new Date().toISOString().slice(0, 10);

// { destId: { sliderKey: sources[] } }
const SOURCES: Record<string, Record<string, Source[]>> = {
  hokkaido: {
    birding: [{ url: 'https://www.japan.travel/en/japans-local-treasures/red-crowned-cranes-kushiro-2020/', label: 'Japan Travel (JNTO)', note: 'Same source already logged on wildlifeViewing — propagated the Dec-Mar widening to birding’s identical crane event, which had the pre-fix Jan-Feb-only shape', addedAt: TODAY }],
  },
  rwanda: {
    birding: [{ url: 'https://www.safaribookings.com', label: 'SafariBookings — Best Time to Visit pages', note: 'Same short-dry vs. long-dry tier-inversion pattern already corrected on safari and wildlifeViewing, found unpropagated on birding’s identical Rwanda trekking-access event', addedAt: TODAY }],
  },
  'monterey-big-sur': {
    wildlifeViewing: [{ url: 'https://montereybay.noaa.gov/visitor/seasons.html', label: 'Monterey Bay National Marine Sanctuary', note: 'Cross-checked against this destination’s own whaleWatching event, which already modeled the southbound Dec-Jan leg and May northbound peak that wildlifeViewing’s new event had omitted', addedAt: TODAY }],
  },
  zambia: {
    wildlifeViewing: [{ url: 'https://bushcampcompany.com/blogs/when-to-visit-south-luangwa-a-month-by-month-safari-guide/when-to-visit-south-luangwa-a-month-by-month-safari-guide', label: 'The Bush Camp Company', note: 'Confirms October as the dry season’s culmination for wildlife concentration, corroborating a pattern already fixed on Namibia', addedAt: TODAY }],
  },
  zimbabwe: {
    wildlifeViewing: [{ url: 'https://www.go2africa.com/african-travel-blog/south-luangwa-wildlife', label: 'Go2Africa', note: 'Confirms Hwange’s best elephant viewing runs through October as waterhole concentration peaks', addedAt: TODAY }],
  },
};

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

  for (const [id, keyed] of Object.entries(SOURCES)) {
    const [row] = await db.select().from(places).where(eq(places.id, id));
    if (!row) { console.error(`${id}: not found`); process.exit(1); }
    const newSources = { ...(row.sliderSources as Record<string, unknown>) };
    for (const [key, sources] of Object.entries(keyed)) newSources[key] = sources;
    const patch = { sliderSources: newSources };
    console.log(`${id}: ${Object.keys(keyed).join(', ')}`);
    if (!dryRun) {
      const afterRow = { ...row, ...patch };
      await db.transaction(async (tx) => {
        await tx.update(places).set({ ...patch, updatedAt: new Date() }).where(eq(places.id, id));
        await tx.insert(adminAuditLog).values({
          actorId: '00000000-0000-0000-0000-000000000000', entityType: 'destination', entityId: id,
          action: 'update', beforeValue: row, afterValue: afterRow,
        });
      });
    }
  }
  console.log(dryRun ? '\ndry run' : '\ndone');
  process.exit(0);
}
main().catch((err) => { console.error(err); process.exit(1); });
