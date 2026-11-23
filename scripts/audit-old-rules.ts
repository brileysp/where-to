// 13 Nov 2026: runs the OLD pipeline's content validator (src/lib/gemini/validate.ts) over every text now saved in the app, plus a few checks that old scripts did
// by hand, and counts hits per rule per interest, to show which old rules the new family pipeline does not enforce. Reads only. Usage: PLACE_ROWS_SNAPSHOT=1 npx tsx scripts/audit-old-rules.ts [--only=key,key] [--examples=3]
import { readFileSync } from 'fs'; import { join } from 'path';
for (const line of readFileSync(join(__dirname, '..', '.env.local'), 'utf8').split('\n')) { const t = line.trim(); if (!t || t.startsWith('#')) continue; const i = t.indexOf('='); if (i === -1) continue; let v = t.slice(i + 1).trim(); if (/^["'].*["']$/.test(v)) v = v.slice(1, -1); if (process.env[t.slice(0, i).trim()] === undefined) process.env[t.slice(0, i).trim()] = v; }
const arg = (n: string) => process.argv.find((a) => a.startsWith(`--${n}=`))?.slice(n.length + 3);
(async () => {
  const { getPrimaryPlaceRows } = await import('../src/lib/db/queries/primary-place-rows'); const { scorePlace } = await import('../src/lib/db/queries/places'); const { validateContent } = await import('../src/lib/gemini/validate'); const { usesMonthsNotSeasons } = await import('../src/lib/gemini/hemisphere');
  const NEW = new Set(['museumsArt', 'architecture', 'fineDining', 'streetFood', 'coffeeTea', 'wineSpirits']); const only = arg('only')?.split(','); const resultsFile = arg('results'); const showEx = Number(arg('examples') ?? 0);
  const rows = (await getPrimaryPlaceRows()) as any[]; const byRule = new Map<string, Map<string, number>>(); const examples = new Map<string, string[]>(); const totals = new Map<string, number>();
  const norm = (m: string) => m.replace(/Month \d+/g, 'Month N').replace(/Months [\d, ]+/g, 'Months N').replace(/\([^)]*\)/g, '(...)').replace(/"[^"]*"/g, '"..."').replace(/\d+(\.\d+)?/g, 'N').slice(0, 95);
  if (resultsFile) {
    const byId = new Map(rows.map((r) => [r.id, r])); const res = JSON.parse(readFileSync(resultsFile, 'utf8')) as any[];
    for (const x of res) { const g = x.gemini; if (!g?.applicable) continue; const r = byId.get(x.id); const wx: string[] = new Array(12).fill(''); for (const b of g.blurbs) for (const m of b.months) wx[m - 1] = b.text;
      totals.set(x.k, (totals.get(x.k) ?? 0) + 1); let issues: any[] = []; const out = { overview: g.overview, monthly: wx.map((t, i) => ({ month: i + 1, text: t, score: g.monthly_scores[i] })), flags: [], confidence: 'high' } as any;
      try { issues = validateContent(out, x.k, x.id, { monthsNotSeasons: usesMonthsNotSeasons(r?.countryCode) }); } catch { continue; }
      for (const is of issues) console.log(`${x.k}:${x.id} [${is.severity}] ${is.message.slice(0, 190)}`); }
    process.exit(0);
  }
  for (const r of rows) {
    const mw = (r.sliderMonthlyWeather ?? {}) as Record<string, string[]>; const ov = (r.sliderOverview ?? {}) as Record<string, string>; const sc = (scorePlace(r) as any).monthly as Record<string, number[]>;
    for (const k of Object.keys(ov)) {
      if (only && !only.includes(k)) continue; if (!ov[k] || !mw[k]?.length || !sc[k]) continue;
      totals.set(k, (totals.get(k) ?? 0) + 1);
      const out = { overview: ov[k], monthly: mw[k].map((t, i) => ({ month: i + 1, text: t, score: Math.round(sc[k][i] * 10) / 10 })), flags: [], confidence: 'high' } as any;
      let issues: any[] = []; try { issues = validateContent(out, k, r.id, { monthsNotSeasons: usesMonthsNotSeasons(r.countryCode) }); } catch (e: any) { continue; }
      for (const is of issues) { const key = `${is.severity}: ${norm(is.message)}`; const m = byRule.get(key) ?? new Map(); m.set(k, (m.get(k) ?? 0) + 1); byRule.set(key, m); if (showEx) { const ex = examples.get(key) ?? []; if (ex.length < showEx) ex.push(`${k}:${r.id}`); examples.set(key, ex); } }
    }
  }
  const rank = [...byRule.entries()].map(([k, m]) => ({ k, newN: [...m].filter(([i]) => NEW.has(i)).reduce((a, [, n]) => a + n, 0), oldN: [...m].filter(([i]) => !NEW.has(i)).reduce((a, [, n]) => a + n, 0), m })).sort((a, b) => b.newN - a.newN);
  console.log('texts checked per interest:', [...totals].map(([k, n]) => `${k} ${n}`).join(', ')); console.log('\nrule (old validator)  | hits in the 6 new-pipeline interests | hits in the older interests');
  for (const x of rank) console.log(`${String(x.newN).padStart(5)} | ${String(x.oldN).padStart(5)} | ${x.k}${showEx ? '  e.g. ' + (examples.get(x.k) ?? []).join(', ') : ''}`);
  process.exit(0);
})().catch((e) => { console.log('ERR', e.stack ?? e); process.exit(1); });
