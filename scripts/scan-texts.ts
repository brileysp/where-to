// 9 Nov 2026: scans texts against src/lib/authoring/rules.ts and lists which places break which rule. Reads either a Gemini results file (before anything is saved)
// or the texts saved in the app. Never writes anything. Usage:
//   PLACE_ROWS_SNAPSHOT=1 npx tsx scripts/scan-texts.ts --results=scripts/data/finish/<key>/results.json [--drinks]
//   PLACE_ROWS_SNAPSHOT=1 npx tsx scripts/scan-texts.ts --interest=<key> [--drinks]
import { readFileSync } from 'fs'; import { join, resolve } from 'path';
for (const line of readFileSync(join(__dirname, '..', '.env.local'), 'utf8').split('\n')) { const t = line.trim(); if (!t || t.startsWith('#')) continue; const i = t.indexOf('='); if (i === -1) continue; let v = t.slice(i + 1).trim(); if (/^["'].*["']$/.test(v)) v = v.slice(1, -1); if (process.env[t.slice(0, i).trim()] === undefined) process.env[t.slice(0, i).trim()] = v; }
const arg = (n: string) => process.argv.find((a) => a.startsWith(`--${n}=`))?.slice(n.length + 3);
(async () => {
  const { scanText, TEXT_RULES, scanStructure } = await import('../src/lib/authoring/rules'); const drinks = process.argv.includes('--drinks');
  const items: Array<{ id: string; ov: string; bl: string[]; blocks?: Array<{ months: number[]; text: string }>; scores?: number[] }> = [];
  if (arg('results')) for (const r of JSON.parse(readFileSync(resolve(join(__dirname, '..'), arg('results')!), 'utf8')) as any[]) { if (r.gemini?.applicable !== false) items.push({ id: `${r.k}:${r.id}`, ov: r.gemini.overview, bl: r.gemini.blurbs.map((b: any) => b.text), blocks: r.gemini.blurbs.map((b: any) => ({ months: b.months, text: b.text })), scores: r.gemini.monthly_scores }); }
  else if (arg('interest')) {
    const k = arg('interest')!; const { getPrimaryPlaceRows } = await import('../src/lib/db/queries/primary-place-rows'); const rows = await getPrimaryPlaceRows();
    for (const r of rows) { const ov = (r.sliderOverview as any)?.[k]; if (!ov) continue; { const wx = (((r.sliderMonthlyWeather as any)?.[k] ?? []) as string[]); const groups: Array<{ months: number[]; text: string }> = []; wx.forEach((t, i) => { const g = groups.find((x) => x.text === t); if (g) g.months.push(i + 1); else groups.push({ months: [i + 1], text: t }); }); items.push({ id: `${k}:${r.id}`, ov, bl: groups.map((g) => g.text), blocks: groups, scores: ((await import('../src/lib/db/queries/places')).scorePlace(r) as any).monthly[k] }); } }
  } else { console.log('Usage: --results=<file> or --interest=<key> [--drinks]'); process.exit(1); }
  const byRule = new Map<string, string[]>(); let any = 0;
  for (const it of items) { const h = [...scanText(it.ov, it.bl, { drinks, sky: it.id.startsWith('stargazing:'), casual: it.id.startsWith('sunbathing:') || it.id.startsWith('scenicLandscapes:') }), ...(it.blocks && it.blocks.length > 1 ? scanStructure(it.blocks, it.scores) : it.scores ? scanStructure([], it.scores) : [])]; if (h.length) any++; for (const r of h) byRule.set(r, [...(byRule.get(r) ?? []), it.id]); }
  console.log(`${items.length} texts scanned, ${any} with at least one hit`);
  const STRUCT: Record<string, string> = { otherMonth: 'a blurb names a month it does not cover', partialMonths: 'a blurb names only some of the months it covers', nonNeighbors: 'a blurb groups months that are not neighbors', disparateNamed: 'months that are not neighbors grouped, naming a month or season', wideGroup: 'one blurb covers scores more than 1.5 apart (must split)', splitConsider: 'one blurb covers scores more than 0.5 apart in a curve a reader might not expect (consider splitting)' };
  for (const id of Object.keys(STRUCT)) { const ids = byRule.get(id); if (!ids) continue; console.log(`  review ${id.padEnd(14)} ${String(ids.length).padStart(4)}  ${STRUCT[id]}`); if (process.argv.includes('--list')) console.log('         ' + ids.join(', ')); }
  for (const r of TEXT_RULES) { const ids = byRule.get(r.id); if (!ids) continue; console.log(`  ${r.kind === 'fix' ? 'fix   ' : 'review'} ${r.id.padEnd(14)} ${String(ids.length).padStart(4)}  ${r.label}`); if (process.argv.includes('--list')) console.log('         ' + ids.join(', ')); }
  process.exit(0);
})();
