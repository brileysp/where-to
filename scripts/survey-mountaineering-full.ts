import { readFileSync } from 'fs';
import { join } from 'path';
import { drizzle as drizzlePostgres } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import { places } from '../src/lib/db/schema';
import { isSliderNA, deriveDestinationScores } from '../src/lib/scoring/destinations';
import { toScoringPlace } from '../src/lib/db/queries/places';

const KEY = 'mountaineering';

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
  const db = drizzlePostgres(postgres(env.DATABASE_URL, { prepare: false }));
  const rows = await db.select().from(places);

  let naCount = 0;
  const needsContent: { id: string; name: string; base: number; hasEvents: boolean; hasOverview: boolean; monthly: number[]; peak: number }[] = [];

  for (const row of rows) {
    const d = toScoringPlace(row as any);
    if (isSliderNA(d, KEY)) { naCount++; continue; }

    const base = (row.baseScores as Record<string, number> | undefined)?.[KEY] ?? 0;
    const hasEvents = Array.isArray((row.sliderEvents as any)?.[KEY]) && (row.sliderEvents as any)[KEY].length > 0;
    const hasOverview = !!(row.sliderOverview as Record<string, string> | undefined)?.[KEY];
    const derived = deriveDestinationScores(d, { skipHazards: true });
    const monthly: number[] = (derived.monthly?.[KEY] as number[]) ?? [];
    const peak = monthly.length ? Math.max(...monthly) : base;

    needsContent.push({ id: row.id, name: row.name, base, hasEvents, hasOverview, monthly, peak });
  }

  needsContent.sort((a, b) => b.peak - a.peak);

  console.log(`Total places: ${rows.length}`);
  console.log(`NA for ${KEY}: ${naCount}`);
  console.log(`Non-NA (candidates for content): ${needsContent.length}`);
  console.log(`Already have sliderOverview: ${needsContent.filter((r) => r.hasOverview).length}`);
  console.log(`Already have sliderEvents: ${needsContent.filter((r) => r.hasEvents).length}\n`);

  console.log('=== Peak-score tiers (sorted descending) ===');
  for (const r of needsContent) {
    console.log(`${r.peak.toFixed(1).padStart(5)}  base=${r.base.toString().padStart(3)}  ${r.hasEvents ? 'EVT' : '   '}  ${r.name} (${r.id})  monthly=[${r.monthly.map((m) => m.toFixed(1)).join(',')}]`);
  }

  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
