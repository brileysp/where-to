import { readFileSync } from 'fs';
import { join } from 'path';
import { eq } from 'drizzle-orm';
import { drizzle as drizzlePostgres } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import { places, adminAuditLog } from '../src/lib/db/schema';

const KEY = 'whaleWatching';

const OVERVIEWS: Record<string, string> = {
  srilanka: 'Blue whales migrate close to Sri Lanka\'s southern coast each winter, one of the most reliable places in the world to see the largest animal on Earth — though the industry off Mirissa has a well-documented, ongoing problem with boat overcrowding, with a dozen or more vessels sometimes converging on a single whale.',
  iceland: 'Minke whales are a reliable year-round sighting in Iceland\'s fjords. Humpback and blue whales join to feed each summer, from April through October, concentrated particularly around Húsavík — though minke remains the most common sighting even in peak season, and blue whales are genuinely rare.',
  'cape-town': 'Southern right whales migrate from Antarctic feeding grounds to calve in the sheltered coastal waters off Cape Town each winter, visible directly from shore without a boat — though South Africa\'s southern right whale numbers have measurably declined since around 2009-2010, a documented, ongoing trend.',
};

const MONTHLY_OVERRIDES: Record<string, Partial<Record<number, string>>> = {
  srilanka: {
    0: 'Peak blue whale season off the southern coast, though overcrowding on the water is at its worst during these months.',
    1: 'Peak blue whale season off the southern coast, though overcrowding on the water is at its worst during these months.',
    11: 'Peak blue whale season off the southern coast, though overcrowding on the water is at its worst during these months.',
  },
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

  for (const id of Object.keys(OVERVIEWS)) {
    const [row] = await db.select().from(places).where(eq(places.id, id));
    if (!row) { console.error(`${id}: not found`); process.exit(1); }
    const currentMonthly = [...((row.sliderMonthlyWeather as Record<string, string[]>)?.[KEY] ?? [])];
    const overrides = MONTHLY_OVERRIDES[id];
    if (overrides) {
      for (const [idx, text] of Object.entries(overrides)) {
        currentMonthly[Number(idx)] = text as string;
      }
    }
    const patch: Record<string, unknown> = {
      sliderOverview: { ...(row.sliderOverview as Record<string, string>), [KEY]: OVERVIEWS[id] },
      sliderMonthlyWeather: { ...(row.sliderMonthlyWeather as Record<string, (string | null)[]>), [KEY]: currentMonthly },
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
