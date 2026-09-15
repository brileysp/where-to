import { readFileSync } from 'fs';
import { join } from 'path';
import { eq } from 'drizzle-orm';
import { drizzle as drizzlePostgres } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import { places, adminAuditLog } from '../src/lib/db/schema';

const KEY = 'wildflowerBlooms';

const OVERVIEWS: Record<string, string> = {
  'scottish-highlands-skye': 'The heather bloom turns the Highlands and Skye\'s hillsides purple each late summer — a real, widely-photographed seasonal event, peaking in August.',
  'lake-district': 'Ullswater\'s daffodils — the ones Wordsworth actually wrote about — bloom each spring along the lakeshore, the reason for the "host of golden daffodils" line.',
  cotswolds: 'Bluebell woods across the Cotswolds carpet the forest floor blue-purple for a few weeks each spring — a well-known, if brief, local event.',
  'north-island': 'Pōhutukawa trees — New Zealand\'s "Christmas tree" — burst into brilliant red bloom each December, timed to the southern summer and genuinely tied to the season\'s identity here.',
};

const MONTHLY: Record<string, string[]> = {
  'scottish-highlands-skye': [
    'Outside heather season.', 'Outside heather season.', 'Outside heather season.', 'Outside heather season.',
    'Outside heather season.', 'Outside heather season.', 'Outside heather season.',
    'Peak heather bloom — hillsides across the Highlands and Skye turn purple.',
    'Heather bloom fading, still present into the month.',
    'Outside heather season.', 'Outside heather season.', 'Outside heather season.',
  ],
  'lake-district': [
    'Outside daffodil season.', 'Outside daffodil season.',
    'Daffodil season beginning along Ullswater, building toward peak.',
    'Peak daffodil season at Ullswater — the "host of golden daffodils" Wordsworth wrote about.',
    'Outside daffodil season.', 'Outside daffodil season.', 'Outside daffodil season.', 'Outside daffodil season.',
    'Outside daffodil season.', 'Outside daffodil season.', 'Outside daffodil season.', 'Outside daffodil season.',
  ],
  cotswolds: [
    'Outside bluebell season.', 'Outside bluebell season.', 'Outside bluebell season.',
    'Bluebell woods beginning to carpet the forest floor, building toward peak.',
    'Peak bluebell season across Cotswold woodlands.',
    'Outside bluebell season.', 'Outside bluebell season.', 'Outside bluebell season.',
    'Outside bluebell season.', 'Outside bluebell season.', 'Outside bluebell season.', 'Outside bluebell season.',
  ],
  'north-island': [
    'Pōhutukawa bloom fading, though still present into the month.',
    'Outside pōhutukawa season.', 'Outside pōhutukawa season.', 'Outside pōhutukawa season.',
    'Outside pōhutukawa season.', 'Outside pōhutukawa season.', 'Outside pōhutukawa season.',
    'Outside pōhutukawa season.', 'Outside pōhutukawa season.', 'Outside pōhutukawa season.', 'Outside pōhutukawa season.',
    'Peak pōhutukawa bloom — brilliant red flowers across the north, timed to the southern summer and Christmas.',
  ],
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

  for (const id of Object.keys(OVERVIEWS)) {
    const [row] = await db.select().from(places).where(eq(places.id, id));
    if (!row) { console.error(`${id}: not found`); process.exit(1); }
    if (MONTHLY[id].length !== 12) { console.error(`${id}: monthly array is not length 12`); process.exit(1); }

    const patch: Record<string, unknown> = {
      sliderOverview: { ...(row.sliderOverview as Record<string, string>), [KEY]: OVERVIEWS[id] },
      sliderMonthlyWeather: { ...(row.sliderMonthlyWeather as Record<string, (string | null)[]>), [KEY]: MONTHLY[id] },
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
