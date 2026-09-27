import { readFileSync } from 'fs';
import { join } from 'path';
import { eq } from 'drizzle-orm';
import { drizzle as drizzlePostgres } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import { places, adminAuditLog } from '../src/lib/db/schema';

const KEY = 'wildflowerBlooms';

const OVERVIEWS: Record<string, string> = {
  'cape-town': 'Namaqualand, a few hours north of the city, is the real event — a short, unpredictable window (roughly mid-August to mid-September, entirely dependent on that year\'s rain) when the semi-desert explodes into carpets of daisies and other wildflowers. It\'s genuinely the headline. Cape Town\'s own protea flowers — the fynbos vegetation they grow in is otherwise mostly unshowy scrub — bloom on a much longer, less synchronized calendar (Kirstenbosch has them nearly year-round), a lesser consolation rather than a comparable event.',
  iceland: 'Nootka lupine, introduced in 1945 to fight erosion, now blankets huge swaths of the country in purple each summer — genuinely one of the most photogenic moments of the Icelandic summer, and something visitors plan trips around. It\'s also a real controversy: the lupine spreads aggressively and can crowd out native flora.',
  'tokyo-kyoto': 'Sakura season is short and intensely weather-dependent — the exact peak week shifts year to year and is only forecast reliably a few weeks out. Ueno Park and the Philosopher\'s Path (Kyoto) are the classic viewing spots, but the bloom itself is the real draw, not any one location.',
};

const MONTHLY: Record<string, string[]> = {
  'cape-town': [
    'Outside Namaqualand\'s bloom season.',
    'Outside Namaqualand\'s bloom season.',
    'Outside Namaqualand\'s bloom season.',
    'Outside Namaqualand\'s bloom season.',
    'Outside Namaqualand\'s bloom season.',
    'Outside Namaqualand\'s bloom season.',
    'Namaqualand\'s bloom season beginning, still unpredictable — dependent on that year\'s rain.',
    'Peak Namaqualand bloom — daisies and other wildflowers carpet the semi-desert, though the exact timing varies with the year\'s rain.',
    'Still within Namaqualand\'s bloom season, usually winding down by mid-month.',
    'Outside Namaqualand\'s bloom season.',
    'Outside Namaqualand\'s bloom season.',
    'Outside Namaqualand\'s bloom season.',
  ],
  iceland: [
    'Outside lupine season.',
    'Outside lupine season.',
    'Outside lupine season.',
    'Outside lupine season.',
    'Lupine season beginning, building toward peak.',
    'Peak lupine season — purple fields across the South Coast and Volcanic Way.',
    'Peak lupine season — purple fields across the South Coast and Volcanic Way.',
    'Lupine season fading, still present in places.',
    'Outside lupine season.',
    'Outside lupine season.',
    'Outside lupine season.',
    'Outside lupine season.',
  ],
  'tokyo-kyoto': [
    'Outside sakura season.',
    'Outside sakura season.',
    'Sakura season beginning, building toward full bloom.',
    'Peak sakura season — full bloom, though the exact week shifts year to year.',
    'Outside sakura season.',
    'Outside sakura season.',
    'Outside sakura season.',
    'Outside sakura season.',
    'Outside sakura season.',
    'Outside sakura season.',
    'Outside sakura season.',
    'Outside sakura season.',
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
