// 9 Nov 2026: builds the input file for scripts/gemini-cleanup.ts from the texts SAVED in the app (not from a Gemini results file): one cell per place and interest,
// with the overview and the distinct month blurbs (in order of first month). Usage: PLACE_ROWS_SNAPSHOT=1 npx tsx scripts/build-cleanup-input-nov9.ts --interests=museumsArt,architecture --out=scripts/data/x-input.json
import { readFileSync, writeFileSync } from 'fs'; import { join } from 'path';
for (const line of readFileSync(join(__dirname, '..', '.env.local'), 'utf8').split('\n')) { const t = line.trim(); if (!t || t.startsWith('#')) continue; const i = t.indexOf('='); if (i === -1) continue; let v = t.slice(i + 1).trim(); if (/^["'].*["']$/.test(v)) v = v.slice(1, -1); if (process.env[t.slice(0, i).trim()] === undefined) process.env[t.slice(0, i).trim()] = v; }
const arg = (n: string) => process.argv.find((a) => a.startsWith(`--${n}=`))?.slice(n.length + 3);
(async () => {
  const keys = (arg('interests') ?? '').split(',').filter(Boolean); const out = arg('out')!;
  const { db } = await import('../src/lib/db/client'); const { places } = await import('../src/lib/db/schema');
  const rows = await db.select().from(places); const cells: any[] = [];
  for (const k of keys) for (const r of rows) {
    const ov = (r.sliderOverview as any)?.[k]; const mo = (r.sliderMonthlyWeather as any)?.[k] as string[] | undefined; if (!ov || !mo) continue;
    const order: string[] = []; const months = new Map<string, number[]>();
    mo.forEach((t, i) => { if (!months.has(t)) { months.set(t, []); order.push(t); } months.get(t)!.push(i + 1); });
    cells.push({ k, id: r.id, name: r.name, gemini: { applicable: true, overview: ov, blurbs: order.map((t) => ({ months: months.get(t)!, text: t })) } });
  }
  writeFileSync(join(__dirname, '..', out), JSON.stringify(cells)); console.log(cells.length, 'cells written to', out); process.exit(0);
})();
