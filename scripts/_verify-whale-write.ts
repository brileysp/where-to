import { readFileSync } from 'fs';
import { join } from 'path';
import { eq } from 'drizzle-orm';
import { drizzle as drizzlePostgres } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import { places } from '../src/lib/db/schema';
import { scorePlace } from '../src/lib/db/queries/places';
import { MONTH_NAMES } from '../src/lib/scoring/constants';

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
  const client = postgres(env.DATABASE_URL, { prepare: false });
  const db = drizzlePostgres(client);
  const [row] = await db.select().from(places).where(eq(places.id, 'azores'));
  const scored = scorePlace(row);
  console.log('Azores whaleWatching (post-write):', scored.monthly.whaleWatching.map((v, i) => `${MONTH_NAMES[i].slice(0,3)}:${v}`).join(' '));
  console.log('scoreOverrides.whaleWatching:', JSON.stringify(row.scoreOverrides?.['whaleWatching']));
  await client.end();
}

main();
