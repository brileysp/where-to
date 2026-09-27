import { readFileSync } from 'fs';
import { join } from 'path';
import { eq } from 'drizzle-orm';
import { drizzle as drizzlePostgres } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import { places, adminAuditLog } from '../src/lib/db/schema';

const KEY = 'windSports';

type Source = { url: string; label?: string; note?: string; addedAt: string };

const TODAY = new Date().toISOString().slice(0, 10);

const BASE: Source[] = [
  { url: 'https://wind-hounds.com', label: 'Wind-Hounds.com', addedAt: TODAY },
];

const EXTRA: Record<string, Source[]> = {
  'los-cabos': [{ url: 'https://www.laventanacamps.com', label: 'La Ventana Camps', note: 'Confirms real "El Norte" season starts late October, not November', addedAt: TODAY }],
};

const IDS = [
  'aruba', 'mauritius', 'sicily', 'turks-caicos', 'cornwall', 'dubai', 'gbr', 'lisbon',
  'los-cabos', 'madagascar', 'mallorca', 'namibia', 'sydney', 'vietnam', 'nova-scotia', 'canaries',
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

  for (const id of IDS) {
    const [row] = await db.select().from(places).where(eq(places.id, id));
    if (!row) { console.error(`${id}: not found`); process.exit(1); }
    const sources = [...BASE, ...(EXTRA[id] ?? [])];
    const patch = { sliderSources: { ...(row.sliderSources as Record<string, unknown>), [KEY]: sources } };
    console.log(`${id}: ${sources.length} source(s)`);
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
