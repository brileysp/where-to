// 13 Nov 2026: measures the last-digit spread (owner rule: .0 to .9 each about 10%) of every live monthly score (authored curves, not N/A), per interest and for the whole catalog, and of the best month
// of each place. Reads only. Usage: PLACE_ROWS_SNAPSHOT=1 npx tsx scripts/check-tenths.ts [--strict]   (--strict exits 1 when any interest or the catalog is uneven)
import { readFileSync } from 'fs'; import { join } from 'path';
for (const line of readFileSync(join(__dirname, '..', '.env.local'), 'utf8').split('\n')) { const t = line.trim(); if (!t || t.startsWith('#')) continue; const i = t.indexOf('='); if (i === -1) continue; let v = t.slice(i + 1).trim(); if (/^["'].*["']$/.test(v)) v = v.slice(1, -1); if (process.env[t.slice(0, i).trim()] === undefined) process.env[t.slice(0, i).trim()] = v; }
(async () => {
  const { getPrimaryPlaceRows } = await import('../src/lib/db/queries/primary-place-rows'); const { scorePlace } = await import('../src/lib/db/queries/places'); const { digitReport, peakSeries, describeDigits } = await import('../src/lib/gemini/even-tenths');
  const { getActiveInterests } = await import('../src/lib/scoring/active-interests'); const ACTIVE = new Set((await getActiveInterests()).map((i) => i.key)); // retired interests are not reported
  const rows = (await getPrimaryPlaceRows()) as any[]; const by = new Map<string, number[][]>(); const all: number[][] = [];
  for (const r of rows) { const m = (scorePlace(r) as any).monthly as Record<string, number[]>; for (const [k, s] of Object.entries(m)) { if (!ACTIVE.has(k) || !s || !(r.authoredCurves ?? []).includes(k) || (r.naSliders ?? []).includes(k) || s.every((x) => !x)) continue; const v = s.map((x) => Math.round(x * 10) / 10); (by.get(k) ?? by.set(k, []).get(k)!).push(v); all.push(v); } }
  let bad = 0; const line = (name: string, series: number[][]) => { const rep = digitReport(series); if (!rep.even) bad++; console.log(`${rep.even ? '  ok ' : ' BAD '} ${name.padEnd(22)} ${describeDigits(rep)}`); };
  // 14 Nov 2026: also the cells the owner reads (info only; the live catalog was evened by months, not cell by cell)
  {
    const { cellClump } = await import('../src/lib/gemini/clump'); let cells = 0, clumped = 0; const worst: string[] = [];
    for (const r of rows) { const m = (scorePlace(r) as any).monthly as Record<string, number[]>; for (const [k, sc] of Object.entries(m)) { if (!ACTIVE.has(k) || !sc || !(r.authoredCurves ?? []).includes(k) || (r.naSliders ?? []).includes(k)) continue; cells++; const c = cellClump(sc.map((x: number) => Math.round(x * 10) / 10)); if (c.clumped) { clumped++; if (worst.length < 8) worst.push(`${k}:${r.id} ${c.round}/${c.runs} runs round`); } } }
    console.log(`Cells clumped on .0/.5 (more than 40% of distinct runs, 3+ runs): ${clumped} of ${cells}${worst.length ? '; first: ' + worst.join(', ') : ''}`);
  }
  console.log('Every live monthly score (zeros and 10s not counted):');
  for (const [k, s] of [...by].sort((a, b) => b[1].length - a[1].length)) line(k, s);
  line('WHOLE CATALOG', all); line('best months (all)', peakSeries(all));
  process.exit(process.argv.includes('--strict') && bad ? 1 : 0);
})();
