import { readFileSync } from 'fs';
import { join } from 'path';
import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import { places } from '../src/lib/db/schema';
import { scorePlace } from '../src/lib/db/queries/places';
const raw = readFileSync(join(__dirname, '..', '.env.local'), 'utf8');
const url = raw.split('\n').find((l) => l.startsWith('DATABASE_URL='))!.slice(13).replace(/^["']|["']$/g, '');
// Score-resolution audit: per interest, how much of the live monthly score data is
// still whole/half numbers (coarsePct) and how many distinct values the top 20
// places share in an average month (top20distinct, out of a max of 20). A high
// coarsePct / low top20distinct means the by-interest rank list is a wall of ties.
(async () => {
  const db = drizzle(postgres(url, { prepare: false }));
  const rows = await db.select().from(places);
  const scored = rows.map((r) => ({ r, s: scorePlace(r) }));
  const keys = Object.keys(scored[0].s.monthly);
  const out: any[] = [];
  for (const k of keys) {
    let n = 0, coarse = 0, places_ = 0, withOv = 0;
    const tieTop: number[] = [];
    for (const { r, s } of scored) {
      const na = ((r as any).naSliders ?? []).includes(k);
      if (na) continue;
      const v = s.monthly[k]; if (!v) continue;
      places_++;
      const ov = (r.scoreOverrides as any)?.[k];
      if (ov && Object.keys(ov).length >= 12) withOv++;
      for (let i = 0; i < 12; i++) { n++; const x = v[i]; if (Math.abs(x * 2 - Math.round(x * 2)) < 1e-6) coarse++; }
    }
    // tie-ness: for each month, among top 20 places, how many distinct values
    let distinctSum = 0;
    for (let m = 0; m < 12; m++) {
      const vals = scored.filter(({ r }) => !((r as any).naSliders ?? []).includes(k)).map(({ s }) => s.monthly[k]?.[m]).filter((x) => x != null).sort((a, b) => b - a).slice(0, 20);
      distinctSum += new Set(vals.map((x) => Math.round(x * 100))).size;
    }
    out.push({ k, places: places_, fullOv: withOv, coarsePct: Math.round((100 * coarse) / n), top20distinct: (distinctSum / 12).toFixed(1) });
  }
  out.sort((a, b) => b.coarsePct - a.coarsePct);
  console.table(out);
  process.exit(0);
})();
