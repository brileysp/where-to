import { readFileSync } from 'fs';
import { join } from 'path';
import { eq } from 'drizzle-orm';
import { drizzle as drizzlePostgres } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import { places, adminAuditLog } from '../src/lib/db/schema';

const KEY = 'birding';

const FLAT_TEXT: Record<string, string> = {
  paris: 'Naturalized ring-necked parakeets are common and conspicuous in the city\'s parks.',
  rome: 'Large winter starling murmurations form over the city most evenings.',
  amsterdam: 'Barnacle and white-fronted geese winter in the polders just outside the city by the tens of thousands.',
  london: 'Peregrine falcons nest on buildings across the city, including Tate Modern and the Houses of Parliament. The London Wetland Centre holds bittern and other waterfowl.',
  'upper-peninsula': 'Whitefish Point is a known hawk and owl migration watchpoint each spring and fall, with occasional winter finch and snowy owl irruptions.',
  'nova-scotia': 'The Bird Islands off Cape Breton hold an Atlantic puffin and razorbill colony.',
  'death-valley': 'Isolated oases, especially Furnace Creek, act as a vagrant trap — exhausted migrants and rare strays land here for lack of anywhere else in the surrounding desert.',
  seoul: 'The DMZ, a common day trip from Seoul, is a major wintering ground for red-crowned and white-naped cranes.',
  'bavaria-munich': 'Capercaillie are present in Bavaria\'s forests, though notoriously hard to see.',
  'black-forest': 'Capercaillie are present in the Black Forest\'s mature conifer stands.',
  swissalps: 'Bearded vultures, reintroduced across the Alps after being hunted to extinction, are now regularly seen over the high peaks.',
  oaxaca: 'The Sierra Madre del Sur nearby holds real Mexican highland endemics, including the dwarf jay, found nowhere else.',
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
  if (!env.DATABASE_URL) { console.error('No DATABASE_URL'); process.exit(1); }
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
