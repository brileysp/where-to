// 15 Nov 2026: consistency check for the hotel price seasonality tables. Every summary must point at a current run for the same place and kind, and must equal what the
// summary function computes from that run's raw quotes today (so a rule change, or a hand edit to a quote, shows up here). Read-only.
// Usage: PLACE_ROWS_SNAPSHOT=1 npx tsx scripts/check-hotel-season.ts
import { readFileSync } from 'fs'; import { join } from 'path'; import { isDeepStrictEqual } from 'util';
for (const line of readFileSync(join(__dirname, '..', '.env.local'), 'utf8').split('\n')) { const t = line.trim(); if (!t || t.startsWith('#')) continue; const i = t.indexOf('='); if (i === -1) continue; let v = t.slice(i + 1).trim(); if (/^["'].*["']$/.test(v)) v = v.slice(1, -1); if (process.env[t.slice(0, i).trim()] === undefined) process.env[t.slice(0, i).trim()] = v; }
(async () => {
  const { installLabelFilter } = await import('../src/lib/places/console-labels'); await installLabelFilter(); // standard D03: a report never prints a place key
  const { db } = await import('../src/lib/db/client'); const { placeHotelQuoteRuns, placeHotelSeason } = await import('../src/lib/db/schema');
  const { summariseRun, swingOf } = await import('../src/lib/hotel-season/summary');
  const seasons = await db.select().from(placeHotelSeason); const runs = await db.select().from(placeHotelQuoteRuns);
  const byId = new Map(runs.map((r) => [r.id, r])); const bad: string[] = [];
  for (const s of seasons) {
    const r = byId.get(s.runId);
    if (!r) { bad.push(`${s.placeId}: its run is missing`); continue; }
    if (r.placeId !== s.placeId || r.kind !== s.kind) bad.push(`${s.placeId}: points at a run for ${r.placeId}/${r.kind}`);
    if (!r.isCurrent) bad.push(`${s.placeId}: its run is not marked current`);
    const fresh = summariseRun({ placeId: r.placeId, kind: r.kind as 'luxury', source: r.source, searchTerm: r.searchTerm, quotedOn: r.quotedOn, dates: r.dates, listed: r.listed, panel: r.panel, ...(r.note ? { note: r.note } : {}) });
    if (!isDeepStrictEqual(JSON.parse(JSON.stringify(fresh)), s.summary)) bad.push(`${s.placeId}: the stored summary differs from what the quotes give today`);
    if (JSON.stringify([...s.flags].sort()) !== JSON.stringify([...fresh.flags].sort())) bad.push(`${s.placeId}: flags column differs from the summary`);
    if ((s.swing ?? null) !== swingOf(fresh)) bad.push(`${s.placeId}: swing column differs`);
  }
  const current = new Map<string, number>(); for (const r of runs) if (r.isCurrent) current.set(`${r.placeId}/${r.kind}`, (current.get(`${r.placeId}/${r.kind}`) ?? 0) + 1);
  const seasonKeys = new Set(seasons.map((s) => `${s.placeId}/${s.kind}`));
  for (const [k, c] of current) { if (c > 1) bad.push(`${k}: ${c} current runs`); if (!seasonKeys.has(k)) bad.push(`${k}: a current run with no summary`); }
  console.log(`${seasons.length} summaries, ${runs.length} runs.`);
  console.log(bad.length ? 'PROBLEMS:\n  ' + bad.join('\n  ') : 'All summaries match their current runs.');
  process.exit(bad.length ? 1 : 0);
})();
