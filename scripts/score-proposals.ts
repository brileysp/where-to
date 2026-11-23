// 1 Nov 2026: proposed month scores for texts Gemini wrote, from Gemini's own scores and ours. Replaces the first reconciliation (owner: rounds, random zeros, too much swing for museums).
// Rules: (1) start from Gemini's scores, which follow its text. (2) A swing larger than the interest's seasonal-variance score allows is compressed around the mean (museums: 1.5 points from
// best to worst month; closed months are left alone). (3) The peak is set halfway between Gemini's peak and ours; a gap over 2.5 is marked for the owner to decide. (4) Last digits are evened: each digit .0-.9 about 10%, counted together with the scores already live for that
// interest (balanceAgainstLive; the live ones are never touched). Flat seasons stay flat, zeros and 10s untouched. Owner rule, restated 13 Nov 2026: EVEN, not 'avoid .0 and .5'.
// Writes nothing to the app. Usage: PLACE_ROWS_SNAPSHOT=1 npx tsx scripts/score-proposals.ts --results=batch.json --scores=scores.json --out=proposals.json
import { readFileSync, writeFileSync } from 'fs';
import { join } from 'path';
for (const line of readFileSync(join(__dirname, '..', '.env.local'), 'utf8').split('\n')) { const t = line.trim(); if (!t || t.startsWith('#')) continue; const i = t.indexOf('='); if (i === -1) continue; let v = t.slice(i + 1).trim(); if (/^["'].*["']$/.test(v)) v = v.slice(1, -1); if (process.env[t.slice(0, i).trim()] === undefined) process.env[t.slice(0, i).trim()] = v; }
const arg = (n: string) => process.argv.find((a) => a.startsWith(`--${n}=`))?.slice(n.length + 3);
const r1 = (x: number) => Math.round(x * 10) / 10;
const capFor = (sv: number) => (sv <= 3 ? 1.5 : sv <= 5 ? 3 : sv <= 7 ? 5 : Infinity);
(async () => {
  const res = JSON.parse(readFileSync(arg('results')!, 'utf8')) as any[];
  const sc = new Map((JSON.parse(readFileSync(arg('scores')!, 'utf8')) as any[]).map((x) => [`${x.k}|${x.id}`, x]));
  const { db } = await import('../src/lib/db/client');
  const { sql } = await import('drizzle-orm');
  const { balanceAgainstLive, countDigits, describeDigits } = await import('../src/lib/gemini/even-tenths');
  const { getPrimaryPlaceRows } = await import('../src/lib/db/queries/primary-place-rows'); const { liveSeries } = await import('../src/lib/authoring/live-series');
  const meta = ((r: any) => (r.rows ?? r) as any[])(await db.execute(sql`select key, seasonal_variance sv from interest_meta`));
  const sv = new Map(meta.map((m: any) => [m.key, m.sv as number]));
  const cells: any[] = []; const series: Record<string, number[]> = {};
  for (const r of res) {
    const s = sc.get(`${r.k}|${r.id}`); const g = r.gemini;
    if (!s || !g?.applicable) continue;
    const G: number[] = s.scores.map(Number); const O: number[] = r.curve;
    const closed = new Set<number>(); for (const b of g.blurbs) if (b.level === 'closed') for (const m of b.months) closed.add(m - 1);
    const open = G.map((v, i) => ({ v, i })).filter((x) => !closed.has(x.i));
    let P = G.slice(); let compressed = false;
    if (open.length > 1) {
      const mean = open.reduce((a, x) => a + x.v, 0) / open.length; const range = Math.max(...open.map((x) => x.v)) - Math.min(...open.map((x) => x.v));
      const cap = capFor(sv.get(r.k) ?? 5);
      if (range > cap) { compressed = true; for (const x of open) P[x.i] = mean + (x.v - mean) * (cap / range); }
    }
    const peakG = Math.max(...P), peakO = Math.max(...O);
    const mid = (peakG + peakO) / 2; const k = peakG > 0 ? mid / peakG : 1;
    P = P.map((v) => Math.min(10, Math.max(0, r1(v * k))));
    const gap = Math.abs(Math.max(...G) - peakO);
    const cls = gap > 2.5 ? 'decide' : gap <= 1 && !compressed ? 'agree' : 'middle';
    const key = `${r.k}|${r.id}`; series[key] = P;
    cells.push({ k: r.k, id: r.id, name: r.name, ours: O.map(r1), gemini: G, proposed: P, cls, gap: r1(gap), compressed, svScore: sv.get(r.k) ?? null });
  }
  const before = countDigits(Object.values(series));
  const liveRows = (await getPrimaryPlaceRows()) as any[];
  const target: Record<string, number[]> = {};
  for (const k of new Set(cells.map((c) => c.k))) {
    const mine: Record<string, number[]> = {}; const ids = new Set<string>();
    for (const c of cells.filter((x) => x.k === k)) { mine[`${k}|${c.id}`] = series[`${k}|${c.id}`]; ids.add(c.id); }
    const bal = balanceAgainstLive(mine, liveSeries(liveRows, k, ids), { maxMove: 3 });
    Object.assign(target, bal.series);
    console.log(`${k}: new batch ${describeDigits(bal.before)}\n${' '.repeat(k.length + 2)}after balancing, with live: ${describeDigits(bal.combinedAfter)}`);
  }
  const after = countDigits(Object.values(target));
  for (const c of cells) c.proposed = target[`${c.k}|${c.id}`].map(r1);
  const pct = (c: number[]) => { const n = c.reduce((a, b) => a + b, 0) || 1; return c.map((x) => String(Math.round((100 * x) / n)).padStart(2) + '%').join(' '); };
  console.log(`${cells.length} cells; compressed ${cells.filter((c) => c.compressed).length}; classes`, ['agree', 'middle', 'decide'].map((k) => `${k} ${cells.filter((c) => c.cls === k).length}`).join(', '));
  console.log('digits .0-.9 before', pct(before)); console.log('digits .0-.9 after ', pct(after));
  writeFileSync(arg('out')!, JSON.stringify({ cells, digitsBefore: before, digitsAfter: after }));
  process.exit(0);
})().catch((e) => { console.log('ERR', e.cause?.message ?? e.stack); process.exit(1); });
