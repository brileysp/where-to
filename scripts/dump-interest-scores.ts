// Prints every non-NA place for one interest key, ranked by peak, with its 12 live monthly scores;
// add --text to also list each distinct blurb with the months that share it.
// Usage: npx tsx scripts/dump-interest-scores.ts <interestKey> [--text]
import { readFileSync } from 'fs';
import { join } from 'path';
import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import { places } from '../src/lib/db/schema';
import { scorePlace } from '../src/lib/db/queries/places';
const raw = readFileSync(join(__dirname, '..', '.env.local'), 'utf8');
const url = raw.split('\n').find((l) => l.startsWith('DATABASE_URL='))!.slice(13).replace(/^["']|["']$/g, '');
const K = process.argv[2]; const withText = process.argv.includes('--text');
(async () => {
  const db = drizzle(postgres(url, { prepare: false }));
  const rows = await db.select().from(places);
  const out: any[] = [];
  for (const r of rows) {
    if (((r as any).naSliders ?? []).includes(K)) continue;
    const v = scorePlace(r).monthly[K]; if (!v) continue;
    out.push({ r, v, peak: Math.max(...v) });
  }
  out.sort((a, b) => b.peak - a.peak || b.v.filter((x: number) => x >= 8).length - a.v.filter((x: number) => x >= 8).length);
  for (const o of out) {
    console.log(o.peak.toFixed(1).padStart(4), o.r.id.padEnd(24), o.v.map((x: number) => +x.toFixed(2)).join(' '));
    if (withText) {
      const tx = ((o.r.sliderMonthlyWeather as any)?.[K] ?? []) as (string | null)[];
      const seen = new Set<string>();
      tx.forEach((t, i) => { if (t && !seen.has(t)) { seen.add(t); console.log('      ' + tx.map((u, j) => (u === t ? j + 1 : null)).filter(Boolean).join(',') + ': ' + t.slice(0, 110)); } });
    }
  }
  process.exit(0);
})();
