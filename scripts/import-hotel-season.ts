// 15 Nov 2026: loads the hotel price quotes collected on 14 and 15 Nov 2026 (scripts/data/hotel-quote-panel-nov14-part*.json, mapped to places by hotel-place-map-nov15.json)
// into the evidence table (place_hotel_quote_runs) and the summary table (place_hotel_season). Design: docs/hotel-season.md.
// A dry run is the default and writes nothing: it recomputes every summary, checks it against the index recorded at collection time, and prints what it would do.
// Usage: PLACE_ROWS_SNAPSHOT=1 npx tsx scripts/import-hotel-season.ts            (dry run)
//        PLACE_ROWS_SNAPSHOT=1 npx tsx scripts/import-hotel-season.ts --apply    (writes; safe to run again: a place whose current run is already this quote date is skipped)
import { readFileSync } from 'fs'; import { join } from 'path';
for (const line of readFileSync(join(__dirname, '..', '.env.local'), 'utf8').split('\n')) { const t = line.trim(); if (!t || t.startsWith('#')) continue; const i = t.indexOf('='); if (i === -1) continue; let v = t.slice(i + 1).trim(); if (/^["'].*["']$/.test(v)) v = v.slice(1, -1); if (process.env[t.slice(0, i).trim()] === undefined) process.env[t.slice(0, i).trim()] = v; }
(async () => {
  const { installLabelFilter } = await import('../src/lib/places/console-labels'); await installLabelFilter(); // standard D03: a report never prints a place key
  const apply = process.argv.includes('--apply');
  const { loadCollectionRuns, COLLECTION_METHOD } = await import('../src/lib/hotel-season/load-files');
  const { summariseRun, swingOf } = await import('../src/lib/hotel-season/summary');
  const { getPrimaryPlaceRows } = await import('../src/lib/db/queries/primary-place-rows');
  const { db } = await import('../src/lib/db/client'); const { placeHotelQuoteRuns, placeHotelSeason } = await import('../src/lib/db/schema'); const { and, eq } = await import('drizzle-orm');
  const known = new Set(((await getPrimaryPlaceRows()) as Array<{ id: string }>).map((r) => r.id));
  const runs = loadCollectionRuns(); const problems: string[] = []; const flagCount: Record<string, number> = {};
  for (const { key, run, recordedIdx } of runs) {
    if (!known.has(run.placeId)) problems.push(`${key}: no place with id ${run.placeId}`);
    const s = summariseRun(run);
    const computed = run.dates.map((d, i) => (i === 1 ? s.holiday.dec29 : i === 2 ? s.holiday.dec31 : s.months[Number(d.slice(5, 7)) - 1]));
    if (JSON.stringify(computed) !== JSON.stringify(recordedIdx)) problems.push(`${key}: the recomputed index differs from the one recorded at collection`);
    for (const f of s.flags.length ? s.flags : ['solid']) flagCount[f] = (flagCount[f] ?? 0) + 1;
  }
  console.log(`${runs.length} places read; flags: ${Object.entries(flagCount).map(([k, v]) => `${k} ${v}`).join(', ')}`);
  if (problems.length) { console.log('PROBLEMS (nothing written):\n  ' + problems.join('\n  ')); process.exit(1); }
  if (!apply) { console.log('Dry run: every summary recomputes to the recorded index and every place exists. Run with --apply to write.'); process.exit(0); }
  let wrote = 0, skipped = 0;
  for (const { run } of runs) {
    const cur = await db.select().from(placeHotelQuoteRuns).where(and(eq(placeHotelQuoteRuns.placeId, run.placeId), eq(placeHotelQuoteRuns.kind, run.kind), eq(placeHotelQuoteRuns.isCurrent, true)));
    if (cur.some((c) => c.quotedOn === run.quotedOn && c.source === run.source)) { skipped++; continue; }
    const s = summariseRun(run);
    await db.transaction(async (tx) => {
      await tx.update(placeHotelQuoteRuns).set({ isCurrent: false }).where(and(eq(placeHotelQuoteRuns.placeId, run.placeId), eq(placeHotelQuoteRuns.kind, run.kind), eq(placeHotelQuoteRuns.isCurrent, true)));
      const [row] = await tx.insert(placeHotelQuoteRuns).values({ placeId: run.placeId, kind: run.kind, source: run.source, searchTerm: run.searchTerm, method: COLLECTION_METHOD, quotedOn: run.quotedOn, dates: run.dates, listed: run.listed, panel: run.panel, note: run.note ?? '', isCurrent: true, createdBy: 'import-hotel-season' }).returning({ id: placeHotelQuoteRuns.id });
      await tx.insert(placeHotelSeason).values({ placeId: run.placeId, kind: run.kind, runId: row.id, summary: s, asOf: s.asOf, flags: s.flags, swing: swingOf(s) })
        .onConflictDoUpdate({ target: [placeHotelSeason.placeId, placeHotelSeason.kind], set: { runId: row.id, summary: s, asOf: s.asOf, flags: s.flags, swing: swingOf(s), updatedAt: new Date() } });
    });
    wrote++;
  }
  console.log(`Wrote ${wrote} places, skipped ${skipped} already loaded.`); process.exit(0);
})();
