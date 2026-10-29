// Writes the two files the Python helpers (geo.py) read: places.json (id -> placeType, N/A list, base scores) and lat.json (id -> lat/lon/name).
// Usage: PLACE_ROWS_SNAPSHOT=1 npx tsx .claude/skills/research-a-column/scripts/dump-places-geo.ts <outputFolder>
import { readFileSync, writeFileSync, mkdirSync } from 'fs';
import { join } from 'path';
for (const line of readFileSync(join(process.cwd(), '.env.local'), 'utf8').split('\n')) { const t = line.trim(); if (!t || t.startsWith('#')) continue; const i = t.indexOf('='); if (i < 0) continue; let v = t.slice(i + 1).trim(); if (/^["'].*["']$/.test(v)) v = v.slice(1, -1); if (process.env[t.slice(0, i).trim()] === undefined) process.env[t.slice(0, i).trim()] = v; }
(async () => {
  const out = process.argv[2]; if (!out) throw new Error('give an output folder');
  mkdirSync(out, { recursive: true });
  const { db } = await import(join(process.cwd(), 'src/lib/db/client'));
  const { places } = await import(join(process.cwd(), 'src/lib/db/schema'));
  const rows = await db.select().from(places);
  const P: Record<string, unknown> = {}, L: Record<string, unknown> = {};
  for (const r of rows as any[]) {
    P[r.id] = { name: r.name, pt: r.placeType, na: r.naSliders ?? [], base: r.baseScores ?? {} };
    L[r.id] = { lat: r.latitude, lon: r.longitude, name: r.name };
  }
  writeFileSync(join(out, 'places.json'), JSON.stringify({ places: P }));
  writeFileSync(join(out, 'lat.json'), JSON.stringify(L));
  console.log(rows.length, 'places written to', out);
  process.exit(0);
})();
